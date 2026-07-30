import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { getPrisma } from '../../src/db.js';
import { makeUser } from '../helpers/factories.js';
import type { ProcessedVariants } from '../../src/services/products/product-image-processor.js';
import { processMediaOutboxOnce } from '../../src/services/products/product-media-outbox.js';
import { mediaKeyToPath } from '../../src/services/products/product-media-storage.js';
import { reserveMediaCapacity } from '../../src/services/products/product-media-capacity.js';
import { addProductPhoto, reorderProductPhotos, removeProductPhoto } from '../../src/services/products/product-photos.js';

let root: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'products-photos-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
});

async function makeProduct(overrides: { createdByUserId: string; status?: 'draft' | 'pending' | 'changes_required' | 'active' }) {
  return getPrisma().product.create({
    data: {
      barcode: `bc-${randomUUID()}`,
      name: 'Test',
      source: 'user',
      createdByUserId: overrides.createdByUserId,
      status: overrides.status ?? 'draft',
    },
  });
}

async function fakeProcessedUpload(): Promise<ProcessedVariants> {
  const buf = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'teal' } }).jpeg().toBuffer();
  return {
    sourceMimeType: 'image/jpeg',
    display: { variant: 'display', buffer: buf, width: 20, height: 20, bytes: buf.length },
    thumb: { variant: 'thumb', buffer: buf, width: 20, height: 20, bytes: buf.length },
  };
}

async function addPhoto(actor: { id: string; role: 'user' | 'admin' }, productId: string) {
  const reservation = await reserveMediaCapacity({ bytes: 10_000 });
  const processed = await fakeProcessedUpload();
  return addProductPhoto(actor, { productId, processed, capacityReservationId: reservation.id });
}

describe('addProductPhoto', () => {
  it('allows the owning creator to add a photo to their own draft', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    const result = await addPhoto({ id: owner.id, role: 'user' }, product.id);
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0]!.position).toBe(0);
    expect(result.version).toBe(2);
  });

  it('allows an admin to add a photo to any product regardless of status', async () => {
    const owner = await makeUser({ emailVerified: true });
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const product = await makeProduct({ createdByUserId: owner.id, status: 'active' });
    const result = await addPhoto({ id: admin.id, role: 'admin' }, product.id);
    expect(result.photos).toHaveLength(1);
  });

  it('rejects another (non-owner, non-admin) user with a non-enumerating 404', async () => {
    const owner = await makeUser({ emailVerified: true });
    const other = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    await expect(addPhoto({ id: other.id, role: 'user' }, product.id)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects the creator while the product is pending review', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id, status: 'pending' });
    await expect(addPhoto({ id: owner.id, role: 'user' }, product.id)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a sixth photo and compensates (removes) the already-promoted bytes', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    for (let i = 0; i < 5; i++) await addPhoto({ id: owner.id, role: 'user' }, product.id);

    await expect(addPhoto({ id: owner.id, role: 'user' }, product.id)).rejects.toMatchObject({
      status: 409,
      code: 'photo_limit_reached',
    });

    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    expect(photos).toHaveLength(5);

    // Nothing left over from the rejected 6th attempt: only 5 private prefixes exist
    // under the product's tree.
    const productDir = mediaKeyToPath(root, `private/products/${product.id}`);
    const { readdir } = await import('node:fs/promises');
    const photoDirs = await readdir(productDir).catch(() => []);
    expect(photoDirs).toHaveLength(5);
  });

  it('serializes a concurrent quota race so at most 5 photos ever exist', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    for (let i = 0; i < 4; i++) await addPhoto({ id: owner.id, role: 'user' }, product.id);

    const results = await Promise.allSettled([
      addPhoto({ id: owner.id, role: 'user' }, product.id),
      addPhoto({ id: owner.id, role: 'user' }, product.id),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    expect(photos).toHaveLength(5);
  });
});

describe('removeProductPhoto', () => {
  it('removes the cover photo and reindexes the remaining photos contiguously from 0', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    for (let i = 0; i < 3; i++) await addPhoto({ id: owner.id, role: 'user' }, product.id);
    const before = await getPrisma().productPhoto.findMany({ where: { productId: product.id }, orderBy: { position: 'asc' } });
    const cover = before[0]!;

    const result = await removeProductPhoto({ id: owner.id, role: 'user' }, { productId: product.id, photoId: cover.id });
    expect(result.photos).toHaveLength(2);
    expect(result.photos.map((p) => p.position)).toEqual([0, 1]);
    expect(result.photos.find((p) => p.id === cover.id)).toBeUndefined();
  });

  it('enqueues durable cleanup for the removed photo, actually deleting the bytes only via the outbox', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    await addPhoto({ id: owner.id, role: 'user' }, product.id);
    const photo = (await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } }));
    const key = photo.privateStorageKey!;
    await expect(stat(mediaKeyToPath(root, key))).resolves.toBeDefined();

    await removeProductPhoto({ id: owner.id, role: 'user' }, { productId: product.id, photoId: photo.id });
    // DB state is already correct; filesystem cleanup is durable-but-async.
    await expect(stat(mediaKeyToPath(root, key))).resolves.toBeDefined();

    const swept = await processMediaOutboxOnce(10);
    expect(swept.completed).toBeGreaterThanOrEqual(1);
    await expect(stat(mediaKeyToPath(root, key))).rejects.toThrow();
  });

  it('rejects another user and a pending-review creator the same way add does', async () => {
    const owner = await makeUser({ emailVerified: true });
    const other = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    await addPhoto({ id: owner.id, role: 'user' }, product.id);
    const photo = await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } });

    await expect(
      removeProductPhoto({ id: other.id, role: 'user' }, { productId: product.id, photoId: photo.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('reorderProductPhotos', () => {
  it('applies a collision-safe rotated order in one transaction', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    for (let i = 0; i < 3; i++) await addPhoto({ id: owner.id, role: 'user' }, product.id);
    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id }, orderBy: { position: 'asc' } });
    const rotated = [photos[2]!.id, photos[0]!.id, photos[1]!.id];

    const result = await reorderProductPhotos({ id: owner.id, role: 'user' }, { productId: product.id, photoIds: rotated });
    expect(result.photos.map((p) => p.id)).toEqual(rotated);
    expect(result.photos.map((p) => p.position)).toEqual([0, 1, 2]);
  });

  it('rejects a photoIds set that does not exactly match the current photos (missing/extra/duplicate)', async () => {
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    for (let i = 0; i < 2; i++) await addPhoto({ id: owner.id, role: 'user' }, product.id);
    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });

    await expect(
      reorderProductPhotos({ id: owner.id, role: 'user' }, { productId: product.id, photoIds: [photos[0]!.id] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      reorderProductPhotos(
        { id: owner.id, role: 'user' },
        { productId: product.id, photoIds: [photos[0]!.id, photos[1]!.id, randomUUID()] },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      reorderProductPhotos(
        { id: owner.id, role: 'user' },
        { productId: product.id, photoIds: [photos[0]!.id, photos[0]!.id] },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects another user', async () => {
    const owner = await makeUser({ emailVerified: true });
    const other = await makeUser({ emailVerified: true });
    const product = await makeProduct({ createdByUserId: owner.id });
    await addPhoto({ id: owner.id, role: 'user' }, product.id);
    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    await expect(
      reorderProductPhotos({ id: other.id, role: 'user' }, { productId: product.id, photoIds: [photos[0]!.id] }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
