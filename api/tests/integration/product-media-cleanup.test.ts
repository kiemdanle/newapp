import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { getPrisma } from '../../src/db.js';
import { getRedis } from '../../src/redis.js';
import { makeUser } from '../helpers/factories.js';
import { oldestQuarantineAgeMs, sweepStaleProductDrafts, sweepStaleQuarantine } from '../../src/services/products/product-media-cleanup.js';
import { mediaKeyToPath, quarantineDirKey } from '../../src/services/products/product-media-storage.js';
import { processProductMediaCleanupOnce } from '../../src/queues/jobs/product-media-cleanup.js';

let root: string;
const baseEnv = { ...process.env };
const THIRTY_ONE_DAYS_AGO = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
const TWENTY_NINE_DAYS_AGO = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
// A few minutes short of 30 days — deliberately not the literal millisecond
// boundary (which is racy against real wall-clock time between fixture setup
// and the sweep call); this still proves "not yet strictly older than 30
// days" is kept, without the test being inherently flaky.
const JUST_UNDER_THIRTY_DAYS_AGO = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'media-cleanup-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
  await getRedis().del('product-media-cleanup:lock');
});

async function makeDraft(createdByUserId: string, updatedAt: Date, status: 'draft' | 'pending' | 'active' | 'changes_required' = 'draft') {
  // Eligibility now keys on updatedAt (last activity), not createdAt
  // (reviewer-p7 M11) — set both to the same value so existing fixtures
  // that only ever cared about "how old is this draft" keep working.
  return getPrisma().product.create({
    data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId, status, createdAt: updatedAt, updatedAt },
  });
}

describe('sweepStaleProductDrafts', () => {
  it('deletes a draft older than 30 days with no record and no open edit', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    const result = await sweepStaleProductDrafts(10);
    expect(result.deleted).toBe(1);
    expect(await getPrisma().product.findUnique({ where: { id: draft.id } })).toBeNull();
  });

  it('leaves a draft younger than 30 days untouched', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, TWENTY_NINE_DAYS_AGO);
    const result = await sweepStaleProductDrafts(10);
    expect(result.deleted).toBe(0);
    expect(await getPrisma().product.findUnique({ where: { id: draft.id } })).not.toBeNull();
  });

  it('leaves a draft just under 30 days old untouched — only strictly older qualifies', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, JUST_UNDER_THIRTY_DAYS_AGO);
    const result = await sweepStaleProductDrafts(10);
    expect(result.deleted).toBe(0);
    expect(await getPrisma().product.findUnique({ where: { id: draft.id } })).not.toBeNull();
  });

  it('never touches pending/changes_required/active products, even if old', async () => {
    const user = await makeUser({ emailVerified: true });
    const pending = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO, 'pending');
    const changesRequired = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO, 'changes_required');
    const active = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO, 'active');
    await sweepStaleProductDrafts(10);
    expect(await getPrisma().product.findUnique({ where: { id: pending.id } })).not.toBeNull();
    expect(await getPrisma().product.findUnique({ where: { id: changesRequired.id } })).not.toBeNull();
    expect(await getPrisma().product.findUnique({ where: { id: active.id } })).not.toBeNull();
  });

  it('skips a stale draft that still has a personal record referencing it', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    await getPrisma().record.create({
      data: { userId: user.id, productId: draft.id, expiryDate: new Date(), clientId: randomUUID() },
    });
    const result = await sweepStaleProductDrafts(10);
    expect(result.deleted).toBe(0);
    expect(result.skippedReferenced).toBe(1);
    expect(await getPrisma().product.findUnique({ where: { id: draft.id } })).not.toBeNull();
  });

  it('skips a stale draft that has an open (pending) product edit', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    await getPrisma().productEdit.create({
      data: { productId: draft.id, submittedBy: user.id, proposed: {}, status: 'pending' },
    });
    const result = await sweepStaleProductDrafts(10);
    expect(result.deleted).toBe(0);
    expect(result.skippedReferenced).toBe(1);
  });

  it.each(['draft', 'changes_required'] as const)(
    'skips a stale draft that has an open (%s) product edit, not just pending (reviewer-p7 M8)',
    async (openStatus) => {
      const user = await makeUser({ emailVerified: true });
      const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
      await getPrisma().productEdit.create({
        data: { productId: draft.id, submittedBy: user.id, proposed: {}, status: openStatus },
      });
      const result = await sweepStaleProductDrafts(10);
      expect(result.deleted).toBe(0);
      expect(result.skippedReferenced).toBe(1);
    },
  );

  it('does not skip a stale draft whose only product edit is already resolved (approved/rejected)', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    await getPrisma().productEdit.create({
      data: { productId: draft.id, submittedBy: user.id, proposed: {}, status: 'approved', resolvedBy: user.id, resolvedAt: new Date() },
    });
    const result = await sweepStaleProductDrafts(10);
    expect(result.deleted).toBe(1);
  });

  it('enqueues a durable cleanup for private photo bytes, and never deletes the row before the outbox entry exists', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    const privateKey = `private/products/${draft.id}/${randomUUID()}/${randomUUID()}`;
    await getPrisma().productPhoto.create({
      data: {
        productId: draft.id,
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
        privateStorageKey: privateKey,
      },
    });
    await sweepStaleProductDrafts(10);
    const outboxRow = await getPrisma().mediaOperationOutbox.findFirst({
      where: { operation: 'delete_private' },
    });
    expect(outboxRow).not.toBeNull();
    expect((outboxRow!.payload as { keys: string[] }).keys).toContain(privateKey);
  });

  it('enqueues a public-key photo under delete_public, not mislabelled as delete_private (reviewer-p7 M10)', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    const publicKey = `public/products/${draft.id}/${randomUUID()}`;
    await getPrisma().productPhoto.create({
      data: {
        productId: draft.id,
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
        publicStorageKey: publicKey,
      },
    });
    await sweepStaleProductDrafts(10);
    const privateRow = await getPrisma().mediaOperationOutbox.findFirst({ where: { operation: 'delete_private' } });
    const publicRow = await getPrisma().mediaOperationOutbox.findFirst({ where: { operation: 'delete_public' } });
    expect(privateRow).toBeNull();
    expect(publicRow).not.toBeNull();
    expect((publicRow!.payload as { keys: string[] }).keys).toContain(publicKey);
  });

  it('never deletes a product that transitions off draft status mid-sweep (reviewer-p7 C1)', async () => {
    // Reproduces the exact proven data-loss repro: a draft crosses the
    // sweep's staleness threshold at the same moment its creator submits it.
    // The sweep's unlocked pre-check (`fresh`) has already read status='draft'
    // by the time this hook fires — injecting the concurrent, submitDraft
    // -shaped transition here, strictly *after* that read and *before* the
    // sweep's own locked transaction opens, is exactly the proven-vulnerable
    // window. The sweep must never delete a row a concurrent writer just
    // legitimately claimed.
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);

    const prisma = getPrisma();
    const result = await sweepStaleProductDrafts(10, false, async (productId) => {
      // Fires right after the unlocked pre-check confirmed status='draft',
      // strictly before the sweep opens its locked transaction — the exact
      // window C1 proved vulnerable.
      await prisma.product.updateMany({
        where: { id: productId, status: { in: ['draft', 'changes_required'] } },
        data: { status: 'pending', version: { increment: 1 } },
      });
    });

    const after = await prisma.product.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.status).toBe('pending'); // the concurrent submit's write survives
    expect(result.deleted).toBe(0); // and the sweep must not have deleted it
  });

  it('respects the batch limit', async () => {
    const user = await makeUser({ emailVerified: true });
    await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    const result = await sweepStaleProductDrafts(2);
    expect(result.scanned).toBe(2);
    expect(result.deleted).toBe(2);
  });

  it('a dry run reports what would be deleted without deleting anything', async () => {
    const user = await makeUser({ emailVerified: true });
    const draft = await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    const result = await sweepStaleProductDrafts(10, true);
    expect(result.deleted).toBe(1);
    expect(await getPrisma().product.findUnique({ where: { id: draft.id } })).not.toBeNull();
  });

  it('repeat idempotency: running the sweep twice in a row only ever deletes each qualifying draft once', async () => {
    const user = await makeUser({ emailVerified: true });
    await makeDraft(user.id, THIRTY_ONE_DAYS_AGO);
    const first = await sweepStaleProductDrafts(10);
    const second = await sweepStaleProductDrafts(10);
    expect(first.deleted).toBe(1);
    expect(second.deleted).toBe(0);
    expect(second.scanned).toBe(0);
  });
});

async function touch(path: string, mtime: Date): Promise<void> {
  await utimes(path, mtime, mtime);
}

describe('sweepStaleQuarantine', () => {
  it('removes a quarantine directory older than 24h', async () => {
    const requestId = randomUUID();
    const dir = mediaKeyToPath(root, quarantineDirKey(requestId));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'source'), 'stale-bytes');
    await touch(dir, new Date(Date.now() - 25 * 60 * 60 * 1000));

    const result = await sweepStaleQuarantine();
    expect(result.deleted).toBe(1);
    await expect(stat(dir)).rejects.toThrow();
  });

  it('leaves a fresh quarantine directory untouched', async () => {
    const requestId = randomUUID();
    const dir = mediaKeyToPath(root, quarantineDirKey(requestId));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'source'), 'fresh-bytes');

    const result = await sweepStaleQuarantine();
    expect(result.deleted).toBe(0);
    await expect(stat(dir)).resolves.toBeTruthy();
  });

  it('returns zero scanned/deleted when the quarantine root does not exist yet', async () => {
    const result = await sweepStaleQuarantine();
    expect(result).toEqual({ scanned: 0, deleted: 0 });
  });

  it('continues past an individual removal failure instead of throwing', async () => {
    const requestId1 = randomUUID();
    const requestId2 = randomUUID();
    const dir1 = mediaKeyToPath(root, quarantineDirKey(requestId1));
    const dir2 = mediaKeyToPath(root, quarantineDirKey(requestId2));
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });
    await touch(dir1, new Date(Date.now() - 25 * 60 * 60 * 1000));
    await touch(dir2, new Date(Date.now() - 25 * 60 * 60 * 1000));

    const storage = await import('../../src/services/products/product-media-storage.js');
    const spy = vi.spyOn(storage, 'removeKeyPrefix');
    spy.mockImplementationOnce(async () => {
      throw new Error('simulated unlink failure');
    });

    const result = await sweepStaleQuarantine();
    // One failed, one succeeded — the failure must not abort the whole sweep.
    expect(result.scanned).toBe(2);
    expect(result.deleted).toBe(1);
    spy.mockRestore();
  });
});

describe('oldestQuarantineAgeMs', () => {
  it('returns null when the quarantine tree does not exist', async () => {
    await expect(oldestQuarantineAgeMs()).resolves.toBeNull();
  });

  it('returns null for an empty (but existing) quarantine tree', async () => {
    await mkdir(mediaKeyToPath(root, 'quarantine'), { recursive: true });
    await expect(oldestQuarantineAgeMs()).resolves.toBeNull();
  });

  it('reports the age of the oldest entry, and never deletes anything', async () => {
    const older = randomUUID();
    const newer = randomUUID();
    const olderDir = mediaKeyToPath(root, quarantineDirKey(older));
    const newerDir = mediaKeyToPath(root, quarantineDirKey(newer));
    await mkdir(olderDir, { recursive: true });
    await mkdir(newerDir, { recursive: true });
    await touch(olderDir, new Date(Date.now() - 5 * 60 * 60 * 1000)); // 5h old
    await touch(newerDir, new Date(Date.now() - 1 * 60 * 60 * 1000)); // 1h old

    const ageMs = await oldestQuarantineAgeMs();
    expect(ageMs).toBeGreaterThan(4.9 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThan(5.5 * 60 * 60 * 1000);

    // Both entries still on disk — this is a read-only helper.
    await expect(stat(olderDir)).resolves.toBeTruthy();
    await expect(stat(newerDir)).resolves.toBeTruthy();
  });
});

describe('processProductMediaCleanupOnce — overlap lock', () => {
  it('only one of two concurrent calls actually runs; the other returns null', async () => {
    const [a, b] = await Promise.all([processProductMediaCleanupOnce(), processProductMediaCleanupOnce()]);
    const results = [a, b];
    const ran = results.filter((r) => r !== null);
    const skipped = results.filter((r) => r === null);
    expect(ran).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });

  it('releases the lock on completion so a subsequent call can run', async () => {
    const first = await processProductMediaCleanupOnce();
    const second = await processProductMediaCleanupOnce();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  it('never releases a lock a different holder legitimately re-acquired after this run\'s own token expired (reviewer-p7 I3)', async () => {
    // Simulates the exact bug: this run's TTL expires mid-pass, a second
    // process reclaims the now-free lock key under its own token, and this
    // run's own finally-block release must not be able to delete it — only a
    // release whose token still matches the stored value is allowed to
    // succeed. Injected via the outbox step (the first thing the pass calls)
    // so the mutation lands squarely inside this run's own critical section.
    const outboxModule = await import('../../src/services/products/product-media-outbox.js');
    const spy = vi.spyOn(outboxModule, 'processMediaOutboxOnce');
    const foreignToken = 'foreign-holder-token';
    spy.mockImplementationOnce(async () => {
      await getRedis().set('product-media-cleanup:lock', foreignToken, 'EX', 55);
      return { claimed: 0, completed: 0, failed: 0 };
    });

    const result = await processProductMediaCleanupOnce();
    expect(result).not.toBeNull(); // this run still completes its own pass

    const remaining = await getRedis().get('product-media-cleanup:lock');
    expect(remaining).toBe(foreignToken); // the foreign holder's lock survives untouched

    spy.mockRestore();
    await getRedis().del('product-media-cleanup:lock');
  });
});
