import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPrisma } from '../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { mergeProducts } from '../../src/services/admin/merge.js';
import * as auditLog from '../../src/services/audit/log.js';

// Captured before `vi.spyOn` replaces the module's export in place — calling the
// spy's own property from inside a mock implementation would recurse into itself.
const originalWriteAuditLog = auditLog.writeAuditLog;
const writeAuditLogSpy = vi.spyOn(auditLog, 'writeAuditLog');

// R2: an unconsumed `mockImplementationOnce` (a fault/delay test that never
// actually got consumed) otherwise leaks into the next test. `mockReset()`
// alone would also wipe the spy's passthrough-to-original default (verified
// empirically — it replaces the implementation with a no-op, not merely
// draining the once-queue), so it must be paired with re-applying the real
// implementation right after.
afterEach(() => {
  writeAuditLogSpy.mockReset();
  writeAuditLogSpy.mockImplementation(originalWriteAuditLog);
});

const adminActor = (id: string) => ({ id, role: 'admin' as const });

async function makeActiveProduct(overrides: { name?: string; barcode?: string | null; qrPayload?: string | null } = {}) {
  return getPrisma().product.create({
    data: {
      name: overrides.name ?? 'Product',
      source: 'off',
      status: 'active',
      barcode: overrides.barcode ?? null,
      qrPayload: overrides.qrPayload ?? null,
    },
  });
}

describe('mergeProducts — relations', () => {
  it('repoints records to the target', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    const u = await makeUserForAdmin();
    await getPrisma().record.create({ data: { userId: u.id, productId: source.id, expiryDate: new Date('2026-12-01'), clientId: randomUUID(), notifyAt: [] } });

    const result = await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    expect(result.movedRecords).toBe(1);
    const rec = await getPrisma().record.findFirstOrThrow({ where: { userId: u.id } });
    expect(rec.productId).toBe(target.id);
  });

  it('dedupes same-user reviews (keeps target\'s, drops source\'s) and recalculates counts', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    const reviewer = await makeUserForAdmin();
    const other = await makeUserForAdmin();
    await getPrisma().review.create({ data: { userId: reviewer.id, productId: target.id, rating: 'buy_again', body: 'target review' } });
    await getPrisma().review.create({ data: { userId: reviewer.id, productId: source.id, rating: 'wont_buy', body: 'source review, should drop' } });
    await getPrisma().review.create({ data: { userId: other.id, productId: source.id, rating: 'buy_again_on_sale', body: 'moves over' } });

    const result = await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    expect(result.movedReviews).toBe(1);
    const targetReviews = await getPrisma().review.findMany({ where: { productId: target.id } });
    expect(targetReviews).toHaveLength(2);
    expect(targetReviews.find((r) => r.userId === reviewer.id)?.body).toBe('target review');
    expect(result.newReviewCount).toBe(2);
  });

  it('I2: dedupes a reviewer who reviewed TWO sources (not the target) — keeps exactly one deterministically', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const sourceA = await makeActiveProduct();
    const sourceB = await makeActiveProduct();
    const reviewer = await makeUserForAdmin();
    const rA = await getPrisma().review.create({ data: { userId: reviewer.id, productId: sourceA.id, rating: 'buy_again', body: 'from A' } });
    const rB = await getPrisma().review.create({ data: { userId: reviewer.id, productId: sourceB.id, rating: 'wont_buy', body: 'from B' } });

    await mergeProducts(adminActor(admin.id), {}, [sourceA.id, sourceB.id], target.id, target.version);
    const targetReviews = await getPrisma().review.findMany({ where: { productId: target.id, userId: reviewer.id } });
    expect(targetReviews).toHaveLength(1);
    // Deterministic: the lower-id review survives (stable, reproducible ordering).
    const survivingId = [rA.id, rB.id].sort()[0];
    expect(targetReviews[0]!.id).toBe(survivingId);
  });

  it('M8: repoints reports filed against a merged-away product to the surviving target', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    const reporter = await makeUserForAdmin();
    const report = await getPrisma().report.create({
      data: { reporterId: reporter.id, targetType: 'product', targetId: source.id, reason: 'other' },
    });

    await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    const reloaded = await getPrisma().report.findUniqueOrThrow({ where: { id: report.id } });
    expect(reloaded.targetId).toBe(target.id);
  });

  it('repoints deals and giveaways', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    const u = await makeUserForAdmin();
    const deal = await getPrisma().deal.create({ data: { userId: u.id, productId: source.id, price: 1.5, currency: 'USD', storeName: 'Store' } });
    const giveaway = await getPrisma().giveaway.create({ data: { giverUserId: u.id, productId: source.id, title: 'Free', locationText: 'Here' } });

    await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    expect((await getPrisma().deal.findUniqueOrThrow({ where: { id: deal.id } })).productId).toBe(target.id);
    expect((await getPrisma().giveaway.findUniqueOrThrow({ where: { id: giveaway.id } })).productId).toBe(target.id);
  });

  it('rejects the merge while source or target has an open edit', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    const creator = await makeUserForAdmin();
    await getPrisma().productEdit.create({ data: { productId: source.id, submittedBy: creator.id, proposed: {}, status: 'draft', isLegacy: false } });

    await expect(mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version)).rejects.toMatchObject({ status: 409 });
  });

  it('leaves approved/legacy-rejected edit history linked to its original product (no repoint)', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    const creator = await makeUserForAdmin();
    const approvedEdit = await getPrisma().productEdit.create({
      data: { productId: source.id, submittedBy: creator.id, proposed: {}, status: 'approved', isLegacy: false },
    });

    await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    const reloaded = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: approvedEdit.id } });
    expect(reloaded.productId).toBe(source.id);
  });

  it('leaves source ProductPhoto rows untouched (history-only, no repoint)', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    const owner = await makeUserForAdmin();
    const photo = await getPrisma().productPhoto.create({
      data: {
        productId: source.id, position: 0, uploadedByUserId: owner.id, moderationStatus: 'approved',
        publicStorageKey: `public/products/${source.id}/${randomUUID()}`, mimeType: 'image/webp',
        displayByteSize: 1, displayWidth: 1, displayHeight: 1, thumbnailByteSize: 1, thumbnailWidth: 1, thumbnailHeight: 1,
      },
    });

    await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    const reloaded = await getPrisma().productPhoto.findUniqueOrThrow({ where: { id: photo.id } });
    expect(reloaded.productId).toBe(source.id);
  });
});

describe('mergeProducts — chains, cycles, and locking', () => {
  it('resolves the target through an existing merge chain to its canonical active row', async () => {
    const { admin } = await makeAdmin();
    const canonical = await makeActiveProduct();
    const intermediate = await getPrisma().product.update({
      where: { id: (await makeActiveProduct()).id },
      data: { status: 'merged_into', mergedIntoProductId: canonical.id },
    });
    const source = await makeActiveProduct();

    const result = await mergeProducts(adminActor(admin.id), {}, [source.id], intermediate.id, canonical.version);
    expect(result.targetId).toBe(canonical.id);
  });

  it('rejects a self-merge and a cycle where target resolves into a requested source', async () => {
    const { admin } = await makeAdmin();
    const p = await makeActiveProduct();
    await expect(mergeProducts(adminActor(admin.id), {}, [p.id], p.id, p.version)).rejects.toMatchObject({ status: 409 });

    const canonical = await makeActiveProduct();
    const merged = await getPrisma().product.update({ where: { id: (await makeActiveProduct()).id }, data: { status: 'merged_into', mergedIntoProductId: canonical.id } });
    await expect(mergeProducts(adminActor(admin.id), {}, [canonical.id], merged.id, canonical.version)).rejects.toMatchObject({ status: 409 });
  });

  it('exactly one of two opposite-direction concurrent merges wins; the loser gets a typed conflict', async () => {
    const { admin } = await makeAdmin();
    const a = await makeActiveProduct();
    const b = await makeActiveProduct();

    const results = await Promise.allSettled([
      mergeProducts(adminActor(admin.id), {}, [b.id], a.id, a.version),
      mergeProducts(adminActor(admin.id), {}, [a.id], b.id, b.version),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);

    const [reA, reB] = await Promise.all([
      getPrisma().product.findUniqueOrThrow({ where: { id: a.id } }),
      getPrisma().product.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    // Exactly one of the two ended up merged_into the other, not both/neither.
    const oneIsMerged = (reA.status === 'merged_into') !== (reB.status === 'merged_into');
    expect(oneIsMerged).toBe(true);
  });

  it('rejects a stale target version', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();
    await expect(mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version + 1)).rejects.toMatchObject({ status: 409, code: 'version_conflict' });
  });
});

describe('mergeProducts — identifier transfer', () => {
  it('target acquires a missing barcode from a source, clearing it from the source in the same transaction', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct({ barcode: null });
    const source = await makeActiveProduct({ barcode: '1234567890123' });

    await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    const [reTarget, reSource] = await Promise.all([
      getPrisma().product.findUniqueOrThrow({ where: { id: target.id } }),
      getPrisma().product.findUniqueOrThrow({ where: { id: source.id } }),
    ]);
    expect(reTarget.barcode).toBe('1234567890123');
    expect(reSource.barcode).toBeNull();
  });

  it('a conflicting non-equal barcode requires explicit admin choice: whole merge aborts, no silent overwrite', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct({ barcode: 'AAA' });
    const source = await makeActiveProduct({ barcode: 'BBB' });

    await expect(mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version)).rejects.toMatchObject({
      status: 409,
      identifierConflict: { slot: 'barcode', sourceValue: 'BBB', targetValue: 'AAA' },
    });
    const reTarget = await getPrisma().product.findUniqueOrThrow({ where: { id: target.id } });
    expect(reTarget.barcode).toBe('AAA');
    const reSource = await getPrisma().product.findUniqueOrThrow({ where: { id: source.id } });
    expect(reSource.status).toBe('active');
  });

  // An "equal value on both sides" scenario is unreachable for barcode/qr in
  // practice: the DB's own global unique constraint on each column means two
  // products can never simultaneously hold the same non-null value in the first
  // place, so `planIdentifierTransfer`'s equal-value branch is defensive-only —
  // nothing to fixture a test around.

  it('barcode and QR transfer independently', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct({ barcode: null, qrPayload: 'qr-target' });
    const source = await makeActiveProduct({ barcode: 'bc-source', qrPayload: null });

    await mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    const reTarget = await getPrisma().product.findUniqueOrThrow({ where: { id: target.id } });
    expect(reTarget.barcode).toBe('bc-source');
    expect(reTarget.qrPayload).toBe('qr-target');
  });

  it('M5: a failure after the source\'s barcode was cleared rolls the whole transaction back — the source keeps its original barcode', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct({ barcode: null });
    const source = await makeActiveProduct({ barcode: 'bc-source' });

    // `writeAuditLog` runs after the identifier clear/assign writes but before
    // commit — throwing from it proves the whole transaction (including the
    // already-issued `barcode: null` on the source) rolls back together, never
    // partially applied.
    writeAuditLogSpy.mockImplementationOnce(() => {
      throw new Error('forced failure after source-clear, before commit');
    });

    await expect(
      mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version),
    ).rejects.toThrow('forced failure after source-clear, before commit');

    const [reTarget, reSource] = await Promise.all([
      getPrisma().product.findUniqueOrThrow({ where: { id: target.id } }),
      getPrisma().product.findUniqueOrThrow({ where: { id: source.id } }),
    ]);
    expect(reTarget.barcode).toBeNull();
    expect(reTarget.status).toBe('active');
    expect(reSource.barcode).toBe('bc-source');
    expect(reSource.status).toBe('active');
  });

  it('M5: a concurrent lookup never observes the merge\'s half-applied state — the source is either still active or fully merged_into, never in between', async () => {
    const { admin } = await makeAdmin();
    const target = await makeActiveProduct();
    const source = await makeActiveProduct();

    let releaseHold: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    writeAuditLogSpy.mockImplementationOnce(async (...args) => {
      await held;
      return originalWriteAuditLog(...args);
    });

    const mergePromise = mergeProducts(adminActor(admin.id), {}, [source.id], target.id, target.version);
    // Give the merge transaction time to reach (and block on) the held audit
    // write — by then it has already issued the source's `merged_into` update
    // inside its still-uncommitted transaction.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const midFlight = await getPrisma().product.findUniqueOrThrow({ where: { id: source.id } });
    // READ COMMITTED: a reader outside the transaction sees only the last
    // committed state — never the uncommitted `merged_into` write in flight.
    expect(midFlight.status).toBe('active');

    releaseHold();
    await mergePromise;

    const afterCommit = await getPrisma().product.findUniqueOrThrow({ where: { id: source.id } });
    expect(afterCommit.status).toBe('merged_into');
  });
});
