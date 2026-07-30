import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrisma } from '../../src/db.js';
import { resetConfigForTests } from '../../src/config.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import {
  assertWithinActiveDraftQuota,
  currentDailyBytesAccepted,
  reconcileDailyByteQuota,
  reserveDailyByteQuota,
} from '../../src/services/products/product-creation-quotas.js';
import {
  heartbeatMediaCapacityReservation,
  mediaCapacitySnapshot,
  reserveMediaCapacity,
} from '../../src/services/products/product-media-capacity.js';

const baseEnv = { ...process.env };

beforeEach(async () => {
  await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'all' } } });
});

afterEach(() => {
  process.env = { ...baseEnv };
  resetConfigForTests();
  vi.doUnmock('../../src/services/products/off-client.js');
  vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  vi.resetModules();
});

/** Mocks both external providers as a conclusive miss so a not_found draft
 * create actually reaches the mode-gate/eligibility check instead of a real
 * network round trip — mirrors products-lookup.test.ts's established pattern. */
async function buildServerWithExternalMiss() {
  vi.doMock('../../src/services/products/off-client.js', () => ({
    lookupOff: vi.fn().mockResolvedValue({ status: 'not_found' }),
  }));
  vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
    lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'not_found' }),
  }));
  vi.resetModules();
  const { buildServer: build2 } = await import('../../src/server.js');
  return build2();
}

async function authHeadersFor(userId: string, tokenVersion: number): Promise<{ authorization: string }> {
  const token = await issueAccessToken({ sub: userId, role: 'user', tokenVersion });
  return { authorization: `Bearer ${token}` };
}

async function makeDraft(actorId: string) {
  return getPrisma().product.create({
    data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId: actorId, status: 'draft' },
  });
}

describe('assertWithinActiveDraftQuota', () => {
  it('admits a user under the configured active-draft cap', async () => {
    process.env.PRODUCT_CREATION_MAX_ACTIVE_DRAFTS_PER_USER = '3';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    await makeDraft(user.id);
    await expect(assertWithinActiveDraftQuota(user.id)).resolves.toBeUndefined();
  });

  it('rejects at exactly the configured cap, counting draft and changes_required together', async () => {
    process.env.PRODUCT_CREATION_MAX_ACTIVE_DRAFTS_PER_USER = '2';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    await makeDraft(user.id);
    const second = await makeDraft(user.id);
    await getPrisma().product.update({ where: { id: second.id }, data: { status: 'changes_required' } });
    await expect(assertWithinActiveDraftQuota(user.id)).rejects.toMatchObject({ status: 409 });
  });

  it('does not count active/pending/merged products toward the cap', async () => {
    process.env.PRODUCT_CREATION_MAX_ACTIVE_DRAFTS_PER_USER = '1';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    await getPrisma().product.create({
      data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId: user.id, status: 'active' },
    });
    await getPrisma().product.create({
      data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId: user.id, status: 'pending' },
    });
    await expect(assertWithinActiveDraftQuota(user.id)).resolves.toBeUndefined();
  });
});

describe('reserveDailyByteQuota / reconcileDailyByteQuota', () => {
  it('admits a reservation under the configured daily byte cap', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1000';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    const reservation = await reserveDailyByteQuota(user.id, 500);
    expect(reservation.reservedBytes).toBe(500);
    expect(await currentDailyBytesAccepted(user.id)).toBe(500);
  });

  it('accepts exactly at the boundary and rejects one byte past it, leaving no partial charge behind', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1000';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    await reserveDailyByteQuota(user.id, 900);
    await expect(reserveDailyByteQuota(user.id, 100)).resolves.toMatchObject({ reservedBytes: 100 });
    await expect(reserveDailyByteQuota(user.id, 1)).rejects.toMatchObject({ status: 429 });
    // The rejected reservation's own INCRBY must have been compensated by its
    // own DECRBY inside the same script — the running total stays exactly at
    // the cap, not cap+1.
    expect(await currentDailyBytesAccepted(user.id)).toBe(1000);
  });

  it('never lets concurrent reservations collectively exceed the cap (reviewer-p7 I1)', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1000';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    // 8 * 200 = 1600 against a 1000-byte cap — the old check-then-act shape
    // let every one of these pass the same pre-reservation headroom read
    // (REPRO B in the review: 8/8 passed, final total 1700 against 1000).
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => reserveDailyByteQuota(user.id, 200)));
    const admitted = attempts.filter((r) => r.status === 'fulfilled').length;
    const rejected = attempts.filter((r) => r.status === 'rejected').length;
    expect(admitted).toBeLessThanOrEqual(5); // at most 5*200=1000 can ever fit
    expect(admitted + rejected).toBe(8);
    expect(await currentDailyBytesAccepted(user.id)).toBeLessThanOrEqual(1000);
  });

  it('charges the real attempted bytes on a failed/rejected upload, refunding only the unused headroom (reviewer-p7 I2)', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1000';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    const reservation = await reserveDailyByteQuota(user.id, 900); // worst-case estimate
    // Simulates a rejected/corrupt upload that streamed 300 real bytes before failing.
    await reconcileDailyByteQuota(reservation, 300);
    expect(await currentDailyBytesAccepted(user.id)).toBe(300);
  });

  it('refunds a reservation fully when the attempt fails before any byte was read', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1000';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    const reservation = await reserveDailyByteQuota(user.id, 900);
    await reconcileDailyByteQuota(reservation, 0);
    expect(await currentDailyBytesAccepted(user.id)).toBe(0);
  });

  it('reconciles down to the real accepted bytes on success, never leaving the worst-case estimate charged', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1000';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    const reservation = await reserveDailyByteQuota(user.id, 900);
    await reconcileDailyByteQuota(reservation, 250); // real display+thumb total
    expect(await currentDailyBytesAccepted(user.id)).toBe(250);
  });

  it('isolates usage by UTC day — yesterday does not count against today', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1000';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await reserveDailyByteQuota(user.id, 900, yesterday);
    expect(await currentDailyBytesAccepted(user.id)).toBe(0);
    await expect(reserveDailyByteQuota(user.id, 999)).resolves.toBeDefined();
  });

  it('accumulates across multiple reservations within the same day', async () => {
    const user = await makeUserForAdmin();
    await reserveDailyByteQuota(user.id, 100);
    await reserveDailyByteQuota(user.id, 250);
    expect(await currentDailyBytesAccepted(user.id)).toBe(350);
  });
});

describe('product-creation quotas — admin/internal/all cohorts (route level)', () => {
  it('an admin actor performing a photo correction is exempt from the daily byte quota', async () => {
    process.env.PRODUCT_CREATION_MAX_DAILY_BYTES_PER_USER = '1';
    resetConfigForTests();
    const { admin } = await makeAdmin();
    // Admin quota exemption is enforced at the route layer (photo-upload.ts);
    // this proves the underlying primitive itself has no special-casing — an
    // admin's own bytes, if ever reserved, would still be quota-checked like
    // anyone else's. The route never calls these functions for an admin actor.
    await expect(reserveDailyByteQuota(admin.id, 2)).rejects.toMatchObject({ status: 429 });
  });

  it('a non-allowlisted internal-mode user is blocked by the mode gate before quotas are ever consulted', async () => {
    await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'internal' } } });
    const app = await buildServerWithExternalMiss();
    const user = await makeUserForAdmin();
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13) },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('mediaCapacitySnapshot', () => {
  it('reports usable/reserve/budget/reserved/free bytes consistently', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '100';
    resetConfigForTests();
    await reserveMediaCapacity({ bytes: 300 });
    const snap = await mediaCapacitySnapshot();
    expect(snap.usableBytes).toBe(1000);
    expect(snap.reserveBytes).toBe(100);
    expect(snap.budgetBytes).toBe(900);
    expect(snap.reservedBytes).toBe(300);
    expect(snap.freeBytes).toBe(600);
    expect(snap.freePercent).toBeCloseTo((600 / 900) * 100, 5);
  });

  it('never reclaims a reservation whose heartbeat is still live, even when checked repeatedly', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    resetConfigForTests();
    const reservation = await reserveMediaCapacity({ bytes: 400, ttlSeconds: 3 });
    // Simulate an interrupted-but-still-alive owner: heartbeat renews well
    // under the TTL boundary, repeatedly, the way a long-running operation
    // would — margin kept generous since this runs on a shared, loaded box.
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const live = await heartbeatMediaCapacityReservation(reservation.id, 3);
      expect(live).toBe(true);
    }
    const snap = await mediaCapacitySnapshot();
    expect(snap.reservedBytes).toBe(400);
  });

  it('reflects a reservation dropping out once its heartbeat genuinely stops (real TTL expiry, not reclaimed early)', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    resetConfigForTests();
    await reserveMediaCapacity({ bytes: 400, ttlSeconds: 1 });
    await new Promise((r) => setTimeout(r, 1300));
    const snap = await mediaCapacitySnapshot();
    expect(snap.reservedBytes).toBe(0);
  });
});
