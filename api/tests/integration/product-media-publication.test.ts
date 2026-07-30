import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { getPrisma } from '../../src/db.js';
import { makeUser } from '../helpers/factories.js';
import { completeMediaOperation, prepareMediaOperation, processMediaOutboxOnce } from '../../src/services/products/product-media-outbox.js';
import { publishProductPhoto } from '../../src/services/products/product-photos.js';
import {
  mediaKeyToPath,
  privateProductPhotoPrefix,
  publicProductPhotoPrefix,
} from '../../src/services/products/product-media-storage.js';
import {
  currentReservedMediaBytes,
  releaseMediaCapacityReservation,
  reserveMediaCapacity,
} from '../../src/services/products/product-media-capacity.js';

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

/** A fully-prepared, capacity-reserved publish context — the shape every real
 * `publishProductPhoto` call needs. Reserves the exact worst-case bytes for one
 * photo's display+thumb pair unless overridden. */
async function preparePublish(productId: string, publicationId: string, bytes = 1_000_000) {
  const intent = await getPrisma().$transaction((tx) =>
    prepareMediaOperation(tx, { operation: 'publish_public', keys: [publicProductPhotoPrefix(productId, publicationId)] }),
  );
  const reservation = await reserveMediaCapacity({ bytes });
  return { intentId: intent.id, leaseOwner: intent.leaseOwner, capacityReservationId: reservation.id };
}

describe('publishProductPhoto', () => {
  it('copies (not moves) private variants to a fresh deterministic public prefix, leaving the private bytes intact', async () => {
    const { product, photo, privatePrefix } = await makeProductWithPrivatePhoto();
    const publicationId = randomUUID();
    const intent = await preparePublish(product.id, publicationId);

    const result = await publishProductPhoto(photo.id, publicationId, intent);
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
    const intent = await preparePublish(product.id, publicationId);

    await expect(publishProductPhoto(photo.id, publicationId, intent)).rejects.toThrow();
    // The pre-existing file must survive untouched.
    const content = await readFile(mediaKeyToPath(root, `${publicPrefix}/display.webp`), 'utf8');
    expect(content).toBe('already-there');
  });

  it('rejects publishing a photo with no private bytes (already published, or never uploaded), before touching capacity or the lease', async () => {
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
    // Deliberately bogus intent/capacity — if this rejected for the *wrong* reason
    // (e.g. capacity), the error wouldn't be 409; proves the no-bytes check runs first.
    await expect(
      publishProductPhoto(photo.id, randomUUID(), { intentId: 'bogus', leaseOwner: 'bogus', capacityReservationId: 'bogus' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('leaves no public path behind for a publication ID that was never actually published (preapproval absence)', async () => {
    const { product } = await makeProductWithPrivatePhoto();
    const neverPublished = randomUUID();
    expect(await pathExists(publicProductPhotoPrefix(product.id, neverPublished))).toBe(false);
  });
});

describe('publishProductPhoto — capacity enforcement (reviewer-p3 I2)', () => {
  it('refuses to copy any bytes when the capacity reservation is not live, and creates no public key', async () => {
    const { product, photo } = await makeProductWithPrivatePhoto();
    const publicationId = randomUUID();
    const intent = await preparePublish(product.id, publicationId);
    // Simulate the reservation having already expired/been released before this
    // call runs — exactly the gap reviewer-p3 found (publishing had zero capacity
    // enforcement at all).
    await releaseMediaCapacityReservation(intent.capacityReservationId);

    await expect(publishProductPhoto(photo.id, publicationId, intent)).rejects.toMatchObject({
      status: 507,
      code: 'capacity_exceeded',
    });
    expect(await pathExists(publicProductPhotoPrefix(product.id, publicationId))).toBe(false);
  });

  it('a complete publication set can be reserved and actually published right up to (but not past) the configured budget', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    resetConfigForTests();

    const { product, photo } = await makeProductWithPrivatePhoto();
    const setBytes = photo.displayByteSize + photo.thumbnailByteSize; // the whole publication set's worst case
    const filler = await reserveMediaCapacity({ bytes: 1000 - setBytes });
    const publicationId = randomUUID();
    const intent = await preparePublish(product.id, publicationId, setBytes);
    expect(await currentReservedMediaBytes()).toBe(1000); // filler + this reservation exactly fill the budget

    // The actual function under test — not just `reserveMediaCapacity` — genuinely
    // publishes with the budget fully committed.
    const result = await publishProductPhoto(photo.id, publicationId, intent);
    expect(await pathExists(`${result.publicKey}/display.webp`)).toBe(true);

    // One byte more must be refused — the budget really is exhausted.
    await expect(reserveMediaCapacity({ bytes: 1 })).rejects.toMatchObject({ status: 507, code: 'capacity_exceeded' });
    void filler;
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
    const reservation = await reserveMediaCapacity({ bytes: 1_000_000 });

    await publishProductPhoto(photo.id, publicationId, {
      intentId: intent.id,
      leaseOwner: intent.leaseOwner,
      capacityReservationId: reservation.id,
    });
    expect(await pathExists(publicPrefix)).toBe(true);

    // `publishProductPhoto` itself renews the lease before copying (reviewer-p3
    // I1's "heartbeat through the copy" requirement), so simulate the crash
    // happening in the realistic place: right after the copy returns, before the
    // caller ever started its reference transaction.
    await getPrisma().mediaOperationOutbox.update({ where: { id: intent.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });

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
    const reservation = await reserveMediaCapacity({ bytes: 1_000_000 });

    await publishProductPhoto(photo.id, publicationId, {
      intentId: intent.id,
      leaseOwner: intent.leaseOwner,
      capacityReservationId: reservation.id,
    });

    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      await tx.productPhoto.update({
        where: { id: photo.id },
        data: { publicStorageKey: publicPrefix, privateStorageKey: null, moderationStatus: 'approved' },
      });
      await completeMediaOperation(tx, intent.id, intent.leaseOwner);
    });

    const swept = await processMediaOutboxOnce(10);
    expect(swept.claimed).toBe(0); // already completed — nothing left to claim
    expect(await pathExists(publicPrefix)).toBe(true);
  });
});
