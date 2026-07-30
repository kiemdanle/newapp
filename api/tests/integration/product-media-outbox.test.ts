import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { getPrisma } from '../../src/db.js';
import {
  completeMediaOperation,
  enqueueMediaCleanup,
  prepareMediaOperation,
  processMediaOutboxOnce,
  renewMediaOperationLease,
} from '../../src/services/products/product-media-outbox.js';
import { mediaKeyToPath, privateProductPhotoPrefix, promoteKeyPrefix, writeQuarantineFile } from '../../src/services/products/product-media-storage.js';
import { Readable } from 'node:stream';

let root: string;
const baseEnv = { ...process.env };

async function makeUser() {
  return getPrisma().user.create({
    data: { email: `u-${randomUUID()}@test.local`, firstName: 'T', lastName: 'U', role: 'user' },
  });
}

async function makeProduct(createdByUserId: string) {
  return getPrisma().product.create({
    data: { barcode: `bc-${randomUUID()}`, name: 'Test', source: 'user', createdByUserId, status: 'draft' },
  });
}

async function makePhotoRow(productId: string, uploadedByUserId: string, privateStorageKey: string) {
  return getPrisma().productPhoto.create({
    data: {
      productId,
      position: 0,
      uploadedByUserId,
      moderationStatus: 'pending',
      mimeType: 'image/webp',
      displayByteSize: 100,
      displayWidth: 10,
      displayHeight: 10,
      thumbnailByteSize: 50,
      thumbnailWidth: 5,
      thumbnailHeight: 5,
      privateStorageKey,
    },
  });
}

/** Writes real display+thumb bytes under `prefix` so recovery tests operate on
 * genuine on-disk artifacts, not just DB rows. */
async function writeVariantBytes(prefix: string): Promise<void> {
  const requestId = randomUUID();
  await writeQuarantineFile(root, requestId, Readable.from(Buffer.from('display')), 1000);
  await promoteKeyPrefix(root, `quarantine/${requestId}`, prefix);
}

async function pathExists(key: string): Promise<boolean> {
  try {
    await stat(mediaKeyToPath(root, key));
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'media-outbox-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
});

describe('prepareMediaOperation / completeMediaOperation', () => {
  it('commits a prepared intent with a lease, then completes it inside a reference transaction', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());

    const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: [prefix] }));
    const row = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.status).toBe('prepared');
    expect(row.leaseOwner).toBe(intent.leaseOwner);
    expect(row.leaseExpiresAt).not.toBeNull();

    await prisma.$transaction(async (tx) => {
      await tx.productPhoto.create({
        data: {
          productId: product.id,
          position: 0,
          uploadedByUserId: user.id,
          moderationStatus: 'pending',
          mimeType: 'image/webp',
          displayByteSize: 1,
          displayWidth: 1,
          displayHeight: 1,
          thumbnailByteSize: 1,
          thumbnailWidth: 1,
          thumbnailHeight: 1,
          privateStorageKey: prefix,
        },
      });
      await completeMediaOperation(tx, intent.id, intent.leaseOwner);
    });

    const completed = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id: intent.id } });
    expect(completed.status).toBe('completed');
    expect(completed.leaseOwner).toBeNull();
    expect(completed.leaseExpiresAt).toBeNull();
  });

  it('throws and rolls back the reference transaction when the intent was already recovered by an outbox sweep (reviewer-p3 I1)', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix);

    // Prepared with an already-expired lease, exactly as if the producer's
    // reference transaction was slow enough for a recovery sweep to beat it.
    const intent = await prisma.$transaction((tx) =>
      prepareMediaOperation(tx, { operation: 'promote_private', keys: [prefix], leaseTtlSeconds: -1 }),
    );
    const swept = await processMediaOutboxOnce(10);
    expect(swept.completed).toBe(1);
    expect(await pathExists(prefix)).toBe(false); // recovery already deleted the bytes

    // The "producer" now tries to complete the same intent, unaware it was
    // already reclaimed and the bytes it's about to reference no longer exist.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.productPhoto.create({
          data: {
            productId: product.id,
            position: 0,
            uploadedByUserId: user.id,
            moderationStatus: 'pending',
            mimeType: 'image/webp',
            displayByteSize: 1,
            displayWidth: 1,
            displayHeight: 1,
            thumbnailByteSize: 1,
            thumbnailWidth: 1,
            thumbnailHeight: 1,
            privateStorageKey: prefix,
          },
        });
        await completeMediaOperation(tx, intent.id, intent.leaseOwner);
      }),
    ).rejects.toThrow();

    // The whole transaction rolled back — no dangling reference to deleted bytes.
    const photos = await prisma.productPhoto.findMany({ where: { productId: product.id } });
    expect(photos).toHaveLength(0);
  });

  it('throws when the lease owner does not match, even if the row is still prepared', async () => {
    const prisma = getPrisma();
    const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: ['private/x'] }));
    await expect(
      prisma.$transaction((tx) => completeMediaOperation(tx, intent.id, 'not-the-real-owner')),
    ).rejects.toThrow();
    const row = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.status).toBe('prepared'); // untouched
  });
});

describe('renewMediaOperationLease', () => {
  it('extends the lease when the token matches', async () => {
    const prisma = getPrisma();
    const intent = await prisma.$transaction((tx) =>
      prepareMediaOperation(tx, { operation: 'publish_public', keys: ['public/x'], leaseTtlSeconds: 1 }),
    );
    const before = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id: intent.id } });
    await renewMediaOperationLease(intent.id, intent.leaseOwner, 3600);
    const after = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id: intent.id } });
    expect(after.leaseExpiresAt!.getTime()).toBeGreaterThan(before.leaseExpiresAt!.getTime());
  });

  it('does nothing for a mismatched lease owner (a stale/reclaimed holder)', async () => {
    const prisma = getPrisma();
    const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'publish_public', keys: ['public/x'] }));
    const before = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id: intent.id } });
    await renewMediaOperationLease(intent.id, 'not-the-real-owner', 3600);
    const after = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id: intent.id } });
    expect(after.leaseExpiresAt!.getTime()).toBe(before.leaseExpiresAt!.getTime());
  });
});

describe('processMediaOutboxOnce — prepared-intent recovery', () => {
  it('deletes an expired prepared intent whose key is unreferenced (crash between byte write and reference commit)', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix);
    expect(await pathExists(prefix)).toBe(true);

    // Simulate: prepared intent committed, then the process died before the
    // reference transaction ever ran — lease already expired, no ProductPhoto row
    // references this key.
    await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: [prefix], leaseTtlSeconds: -1 }));

    const result = await processMediaOutboxOnce(10);
    expect(result.claimed).toBe(1);
    expect(result.completed).toBe(1);
    expect(await pathExists(prefix)).toBe(false);
  });

  it('does not delete an expired prepared intent whose key turns out to be referenced (last-moment recheck)', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix);
    await makePhotoRow(product.id, user.id, prefix);

    await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: [prefix], leaseTtlSeconds: -1 }));

    const result = await processMediaOutboxOnce(10);
    expect(result.completed).toBe(1);
    expect(await pathExists(prefix)).toBe(true); // never deleted
  });

  it('leaves an unexpired prepared intent alone (producer may still be actively working)', async () => {
    const prisma = getPrisma();
    await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: ['private/still-fresh'], leaseTtlSeconds: 3600 }));
    const result = await processMediaOutboxOnce(10);
    expect(result.claimed).toBe(0);
  });
});

describe('processMediaOutboxOnce — pending cleanup', () => {
  it('deletes the keys of a ready pending cleanup row and marks it completed', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix);

    await prisma.$transaction((tx) => enqueueMediaCleanup(tx, { operation: 'delete_private', keys: [prefix] }));
    const result = await processMediaOutboxOnce(10);
    expect(result.completed).toBe(1);
    expect(await pathExists(prefix)).toBe(false);
  });

  it('recovers a processing row whose worker lease expired (worker crash mid-processing)', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix);

    const { id } = (await prisma.$transaction((tx) => enqueueMediaCleanup(tx, { operation: 'delete_private', keys: [prefix] })))!;
    // Simulate a worker that claimed the row (processing, leased) and then died
    // before finishing — lease already expired.
    await prisma.mediaOperationOutbox.update({
      where: { id },
      data: { status: 'processing', leaseOwner: 'dead-worker', leaseExpiresAt: new Date(Date.now() - 1000) },
    });

    const result = await processMediaOutboxOnce(10);
    expect(result.completed).toBe(1);
    expect(await pathExists(prefix)).toBe(false);
  });

  it('does not claim a pending row whose availableAt is still in the future', async () => {
    const prisma = getPrisma();
    const { id } = (await prisma.$transaction((tx) => enqueueMediaCleanup(tx, { operation: 'delete_private', keys: ['private/not-yet'] })))!;
    await prisma.mediaOperationOutbox.update({ where: { id }, data: { availableAt: new Date(Date.now() + 60_000) } });
    const result = await processMediaOutboxOnce(10);
    expect(result.claimed).toBe(0);
  });
});

describe('processMediaOutboxOnce — duplicate delivery and concurrency', () => {
  it('only one of two concurrent callers processes a single ready row', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix);
    await prisma.$transaction((tx) => enqueueMediaCleanup(tx, { operation: 'delete_private', keys: [prefix] }));

    const [a, b] = await Promise.all([processMediaOutboxOnce(10), processMediaOutboxOnce(10)]);
    const totalClaimed = a.claimed + b.claimed;
    const totalCompleted = a.completed + b.completed;
    expect(totalClaimed).toBe(1);
    expect(totalCompleted).toBe(1);
    expect(await pathExists(prefix)).toBe(false);
  });
});

describe('processMediaOutboxOnce — retry/backoff', () => {
  it('increments attempts and reschedules availableAt into the future on failure, eventually marking the row failed', async () => {
    const prisma = getPrisma();
    // A key that fails path-containment validation (`..` segment) so removeKeyPrefix
    // throws deterministically, exercising the failure path without mocking fs.
    const badKey = 'private/../escape';
    const { id } = (await prisma.$transaction((tx) => enqueueMediaCleanup(tx, { operation: 'delete_private', keys: [badKey] })))!;

    let lastStatus = '';
    for (let i = 0; i < 5; i++) {
      const result = await processMediaOutboxOnce(10);
      expect(result.claimed).toBe(1);
      expect(result.failed).toBe(1);
      const row = await prisma.mediaOperationOutbox.findUniqueOrThrow({ where: { id } });
      lastStatus = row.status;
      expect(row.attempts).toBe(i + 1);
      if (row.status === 'failed') break;
      expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
      expect(row.lastError).toBeTruthy();
      // Fast-forward past the backoff window instead of waiting for real time to pass.
      await prisma.mediaOperationOutbox.update({ where: { id }, data: { availableAt: new Date() } });
    }
    expect(lastStatus).toBe('failed');
  });
});
