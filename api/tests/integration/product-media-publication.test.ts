import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { getPrisma } from '../../src/db.js';
import { makeUser } from '../helpers/factories.js';
import { prepareMediaOperation, processMediaOutboxOnce } from '../../src/services/products/product-media-outbox.js';
import { publishProductPhoto } from '../../src/services/products/product-photos.js';
import {
  mediaKeyToPath,
  privateProductPhotoPrefix,
  publicProductPhotoPrefix,
} from '../../src/services/products/product-media-storage.js';
import { currentReservedMediaBytes, reserveMediaCapacity } from '../../src/services/products/product-media-capacity.js';

let root: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'media-publication-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
});

async function pathExists(key: string): Promise<boolean> {
  try {
    await stat(mediaKeyToPath(root, key));
    return true;
  } catch {
    return false;
  }
}

async function makeProductWithPrivatePhoto() {
  const user = await makeUser({ emailVerified: true });
  const product = await getPrisma().product.create({
    data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId: user.id, status: 'pending' },
  });
  const privatePrefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
  await mkdir(mediaKeyToPath(root, privatePrefix), { recursive: true });
  await writeFile(mediaKeyToPath(root, `${privatePrefix}/display.webp`), 'display-bytes');
  await writeFile(mediaKeyToPath(root, `${privatePrefix}/thumb.webp`), 'thumb-bytes');
  const photo = await getPrisma().productPhoto.create({
    data: {
      productId: product.id,
      position: 0,
      uploadedByUserId: user.id,
      moderationStatus: 'pending',
      mimeType: 'image/webp',
      displayByteSize: 13,
      displayWidth: 100,
      displayHeight: 100,
      thumbnailByteSize: 11,
      thumbnailWidth: 40,
      thumbnailHeight: 40,
      privateStorageKey: privatePrefix,
    },
  });
  return { product, photo, privatePrefix };
}

describe('publishProductPhoto', () => {
  it('copies (not moves) private variants to a fresh deterministic public prefix, leaving the private bytes intact', async () => {
    const { product, photo, privatePrefix } = await makeProductWithPrivatePhoto();
    const publicationId = randomUUID();
    const intent = await getPrisma().$transaction((tx) =>
      prepareMediaOperation(tx, { operation: 'publish_public', keys: [publicProductPhotoPrefix(product.id, publicationId)] }),
    );

    const result = await publishProductPhoto(photo.id, publicationId, intent.id);
    expect(result.publicKey).toBe(publicProductPhotoPrefix(product.id, publicationId));
    expect(result.display.bytes).toBe(photo.displayByteSize);

    expect(await pathExists(`${result.publicKey}/display.webp`)).toBe(true);
    expect(await pathExists(`${result.publicKey}/thumb.webp`)).toBe(true);
    // Private bytes are untouched — cleanup is the caller's job, only after its own
    // reference-changing transaction commits.
    expect(await pathExists(`${privatePrefix}/display.webp`)).toBe(true);
  });

  it('never overwrites an existing public path (immutable-by-construction, enforced not just assumed)', async () => {
    const { product, photo } = await makeProductWithPrivatePhoto();
    const publicationId = randomUUID();
    const publicPrefix = publicProductPhotoPrefix(product.id, publicationId);
    await mkdir(mediaKeyToPath(root, publicPrefix), { recursive: true });
    await writeFile(mediaKeyToPath(root, `${publicPrefix}/display.webp`), 'already-there');

    await expect(publishProductPhoto(photo.id, publicationId, 'intent-id')).rejects.toThrow();
    // The pre-existing file must survive untouched.
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(mediaKeyToPath(root, `${publicPrefix}/display.webp`), 'utf8');
    expect(content).toBe('already-there');
  });

  it('rejects publishing a photo with no private bytes (already published, or never uploaded)', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await getPrisma().product.create({
      data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId: user.id, status: 'active' },
    });
    const photo = await getPrisma().productPhoto.create({
      data: {
        productId: product.id,
        position: 0,
        uploadedByUserId: user.id,
        moderationStatus: 'approved',
        mimeType: 'image/webp',
        displayByteSize: 1,
        displayWidth: 1,
        displayHeight: 1,
        thumbnailByteSize: 1,
        thumbnailWidth: 1,
        thumbnailHeight: 1,
        publicStorageKey: publicProductPhotoPrefix(product.id, randomUUID()),
      },
    });
    await expect(publishProductPhoto(photo.id, randomUUID(), 'intent-id')).rejects.toMatchObject({ status: 409 });
  });

  it('leaves no public path behind for a publication ID that was never actually published (preapproval absence)', async () => {
    const { product } = await makeProductWithPrivatePhoto();
    const neverPublished = randomUUID();
    expect(await pathExists(publicProductPhotoPrefix(product.id, neverPublished))).toBe(false);
  });
});

describe('publishProductPhoto — crash recovery', () => {
  it('recovers an unreferenced published copy left behind by a prepared intent whose reference transaction never ran', async () => {
    const { product, photo } = await makeProductWithPrivatePhoto();
    const publicationId = randomUUID();
    const publicPrefix = publicProductPhotoPrefix(product.id, publicationId);

    const intent = await getPrisma().$transaction((tx) =>
      prepareMediaOperation(tx, { operation: 'publish_public', keys: [publicPrefix], leaseTtlSeconds: -1 }),
    );
    await publishProductPhoto(photo.id, publicationId, intent.id);
    expect(await pathExists(publicPrefix)).toBe(true);

    // Simulated process restart: nothing ever wrote `publicStorageKey` onto the
    // photo row (the "process died before the reference transaction ran" case).
    const swept = await processMediaOutboxOnce(10);
    expect(swept.completed).toBe(1);
    expect(await pathExists(publicPrefix)).toBe(false);
  });

  it('does not delete a published copy once the reference transaction actually completed', async () => {
    const { product, photo } = await makeProductWithPrivatePhoto();
    const publicationId = randomUUID();
    const publicPrefix = publicProductPhotoPrefix(product.id, publicationId);

    const intent = await getPrisma().$transaction((tx) =>
      prepareMediaOperation(tx, { operation: 'publish_public', keys: [publicPrefix], leaseTtlSeconds: -1 }),
    );
    await publishProductPhoto(photo.id, publicationId, intent.id);

    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const { completeMediaOperation } = await import('../../src/services/products/product-media-outbox.js');
      await tx.productPhoto.update({
        where: { id: photo.id },
        data: { publicStorageKey: publicPrefix, privateStorageKey: null, moderationStatus: 'approved' },
      });
      await completeMediaOperation(tx, intent.id);
    });

    const swept = await processMediaOutboxOnce(10);
    expect(swept.claimed).toBe(0); // already completed — nothing left to claim
    expect(await pathExists(publicPrefix)).toBe(true);
  });
});

describe('publishProductPhoto — capacity near the reserve', () => {
  it('a complete publication set can be reserved right up to (but not past) the configured budget', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    resetConfigForTests();

    const { photo } = await makeProductWithPrivatePhoto();
    const setBytes = photo.displayByteSize + photo.thumbnailByteSize; // the whole publication set's worst case
    const reservation = await reserveMediaCapacity({ bytes: 1000 - setBytes });
    // Exactly fills the remaining budget.
    await expect(reserveMediaCapacity({ bytes: setBytes })).resolves.toMatchObject({ bytes: setBytes });
    expect(await currentReservedMediaBytes()).toBe(1000);
    // One byte more must be refused.
    await expect(reserveMediaCapacity({ bytes: 1 })).rejects.toMatchObject({ status: 507, code: 'capacity_exceeded' });
    void reservation;
  });
});
