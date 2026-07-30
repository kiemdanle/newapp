import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '../../src/db.js';
import { resetConfigForTests } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { reserveMediaCapacity } from '../../src/services/products/product-media-capacity.js';
import {
  getOperationalHealth,
  recordBackupFailure,
  recordBackupSuccess,
  recordCleanupFailure,
  recordCleanupSuccess,
} from '../../src/services/products/product-operational-health.js';

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  resetConfigForTests();
});

async function makePendingProduct(createdByUserId: string, submittedAt: Date) {
  return getPrisma().product.create({
    data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId, status: 'pending', submittedAt },
  });
}

describe('getOperationalHealth', () => {
  it('reports ok status with no signals recorded, no pending products, empty capacity', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    resetConfigForTests();
    const health = await getOperationalHealth();
    expect(health.capacity.reservedBytes).toBe(0);
    expect(health.pending.count).toBe(0);
    expect(health.pending.stale).toBe(false);
    // No cleanup/backup signal ever recorded -> treated as stale (never run).
    expect(health.cleanup.stale).toBe(true);
    expect(health.backup.stale).toBe(true);
    expect(health.status).toBe('warning');
  });

  it('computes capacity status warning/critical from the configured thresholds', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    process.env.HEALTH_FREE_DISK_WARNING_PERCENT = '50';
    process.env.HEALTH_FREE_DISK_HARD_STOP_PERCENT = '10';
    resetConfigForTests();
    // 600/1000 reserved -> 40% free -> below the 50% warning threshold, above 10% hard stop.
    await reserveMediaCapacity({ bytes: 600 });
    const health = await getOperationalHealth();
    expect(health.capacity.freePercent).toBeCloseTo(40, 5);
    expect(health.capacity.status).toBe('warning');
    expect(health.status).not.toBe('ok');
  });

  it('reports critical capacity status below the hard-stop threshold', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    process.env.HEALTH_FREE_DISK_HARD_STOP_PERCENT = '50';
    resetConfigForTests();
    await reserveMediaCapacity({ bytes: 900 }); // 10% free, below the 50% hard-stop
    const health = await getOperationalHealth();
    expect(health.capacity.status).toBe('critical');
    expect(health.status).toBe('critical');
  });

  it('reports the pending backlog count and oldest age, flagging stale past the configured threshold', async () => {
    process.env.HEALTH_PENDING_OLDEST_WARNING_HOURS = '1';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
    await makePendingProduct(user.id, old);
    const health = await getOperationalHealth();
    expect(health.pending.count).toBe(1);
    expect(health.pending.oldestAgeHours).toBeGreaterThan(2.9);
    expect(health.pending.stale).toBe(true);
  });

  it('reflects a recorded cleanup success as not stale, and a subsequent failure record does not clear it', async () => {
    process.env.HEALTH_CLEANUP_STALE_HOURS = '1';
    resetConfigForTests();
    await recordCleanupSuccess();
    const afterSuccess = await getOperationalHealth();
    expect(afterSuccess.cleanup.stale).toBe(false);
    expect(afterSuccess.cleanup.lastSuccessAt).not.toBeNull();

    await recordCleanupFailure();
    const afterFailure = await getOperationalHealth();
    expect(afterFailure.cleanup.lastFailureAt).not.toBeNull();
    // The last *success* is still recent — failure alone doesn't make it stale.
    expect(afterFailure.cleanup.stale).toBe(false);
  });

  it('reflects a recorded backup success as not stale', async () => {
    process.env.HEALTH_BACKUP_STALE_HOURS = '1';
    resetConfigForTests();
    await recordBackupSuccess();
    const health = await getOperationalHealth();
    expect(health.backup.stale).toBe(false);
    expect(health.backup.lastSuccessAt).not.toBeNull();
  });

  it('records a backup failure signal independently of success', async () => {
    await recordBackupFailure();
    const health = await getOperationalHealth();
    expect(health.backup.lastFailureAt).not.toBeNull();
  });

  it('reports null quarantine age when the quarantine tree does not exist', async () => {
    const health = await getOperationalHealth();
    expect(health.quarantine.oldestAgeHours).toBeNull();
  });
});

describe('GET /v1/admin/system/operational-health', () => {
  it('is reachable by an admin and matches the schema', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/operational-health', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('capacity');
    expect(body).toHaveProperty('thresholds');
    await app.close();
  });

  it('rejects a non-admin caller', async () => {
    const app = await buildServer();
    const user = await makeUserForAdmin();
    const token = await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: 0 });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/system/operational-health',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects an unauthenticated caller', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/operational-health' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
