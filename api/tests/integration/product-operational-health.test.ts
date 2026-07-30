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
  recordRateEvent,
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

  describe('rate thresholds (reviewer-p7 IM5)', () => {
    it('reports null rate percentages and never exceeded when no events were recorded this window', async () => {
      const health = await getOperationalHealth();
      expect(health.rates.assessmentFailurePercent).toBeNull();
      expect(health.rates.assessmentFailureExceeded).toBe(false);
      expect(health.rates.api5xxPercent).toBeNull();
      expect(health.rates.api5xxExceeded).toBe(false);
      expect(health.rates.uploadRejectionPercent).toBeNull();
      expect(health.rates.uploadRejectionExceeded).toBe(false);
      expect(health.thresholds.assessmentFailureRatePercent).toBeGreaterThan(0);
      expect(health.thresholds.api5xxRatePercent).toBeGreaterThan(0);
      expect(health.thresholds.uploadRejectionRatePercent).toBeGreaterThan(0);
    });

    it('computes the assessment failure rate from recorded events and flags it once over threshold', async () => {
      process.env.HEALTH_ASSESSMENT_FAILURE_RATE_PERCENT = '25';
      resetConfigForTests();
      // 1 failure out of 4 attempts = 25% — at, not over, threshold.
      await recordRateEvent('assessment', 'total');
      await recordRateEvent('assessment', 'total');
      await recordRateEvent('assessment', 'total');
      await recordRateEvent('assessment', 'total');
      await recordRateEvent('assessment', 'failure');
      const atThreshold = await getOperationalHealth();
      expect(atThreshold.rates.assessmentFailurePercent).toBeCloseTo(25, 5);
      expect(atThreshold.rates.assessmentFailureExceeded).toBe(false);

      // One more attempt that also fails pushes it to 2/5 = 40%, over the
      // 25% threshold.
      await recordRateEvent('assessment', 'total');
      await recordRateEvent('assessment', 'failure');
      const overThreshold = await getOperationalHealth();
      expect(overThreshold.rates.assessmentFailurePercent).toBeCloseTo(40, 5);
      expect(overThreshold.rates.assessmentFailureExceeded).toBe(true);
      expect(overThreshold.status).not.toBe('ok');
    });

    it('tracks the API 5xx and upload rejection rates independently of each other and of assessment', async () => {
      await recordRateEvent('api5xx', 'total');
      await recordRateEvent('api5xx', 'total');
      await recordRateEvent('api5xx', 'failure');
      await recordRateEvent('uploadRejection', 'total');
      await recordRateEvent('uploadRejection', 'total');
      await recordRateEvent('uploadRejection', 'total');
      await recordRateEvent('uploadRejection', 'total');

      const health = await getOperationalHealth();
      expect(health.rates.api5xxPercent).toBeCloseTo(50, 5);
      expect(health.rates.uploadRejectionPercent).toBeCloseTo(0, 5);
      expect(health.rates.assessmentFailurePercent).toBeNull();
    });
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

  it('returns 503 when overall status is critical, so a systemd-timer credentialed check can alert on it (reviewer-p7 IM6)', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    process.env.HEALTH_FREE_DISK_HARD_STOP_PERCENT = '50';
    resetConfigForTests();
    await reserveMediaCapacity({ bytes: 900 }); // 10% free, below the 50% hard-stop -> critical
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/operational-health', headers });
    expect(res.statusCode).toBe(503);
    expect(res.json().status).toBe('critical');
    await app.close();
  });
});

describe('GET /health/operational — unauthenticated liveness variant (reviewer-p7 IM6)', () => {
  it('is reachable with no credential and exposes only the bare status, no detail', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health/operational' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({ status: expect.any(String) });
    expect(body).not.toHaveProperty('capacity');
    expect(body).not.toHaveProperty('thresholds');
    expect(body).not.toHaveProperty('rates');
    await app.close();
  });

  it('returns 503 when overall status is critical, exactly like the admin-gated endpoint', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    process.env.HEALTH_FREE_DISK_HARD_STOP_PERCENT = '50';
    resetConfigForTests();
    await reserveMediaCapacity({ bytes: 900 });
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health/operational' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'critical' });
    await app.close();
  });

  it('stays 200 for a warning (non-critical) status — only critical is treated as "down"', async () => {
    process.env.HEALTH_CLEANUP_STALE_HOURS = '1000000';
    process.env.HEALTH_BACKUP_STALE_HOURS = '1000000';
    process.env.HEALTH_PENDING_OLDEST_WARNING_HOURS = '1';
    resetConfigForTests();
    const user = await makeUserForAdmin();
    await makePendingProduct(user.id, new Date(Date.now() - 3 * 60 * 60 * 1000));
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health/operational' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'warning' });
    await app.close();
  });
});
