import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getBarcodeProviderSettings,
  updateBarcodeProviderSettings,
  reserveDailyQuota,
  getTodayDispatchedCount,
  dailyQuotaKey,
  utcDay,
  invalidateBarcodeProviderSettingsCache,
  resetProviderCooldown,
  isProviderCooldownActive,
} from './barcode-provider-settings.js';
import { pruneExpiredBarcodeApiLogs } from './barcode-api-tracker.js';
import { getRedis } from '../../redis.js';
import { getPrisma } from '../../db.js';
import '../products/off-client.js';
import { getBreaker } from './breakers.js';

describe('barcode-provider-settings', () => {
  beforeEach(() => {
    invalidateBarcodeProviderSettingsCache();
  });

  it('loads default config when setting row is absent', async () => {
    const config = await getBarcodeProviderSettings();
    expect(config.providers.off).toBeDefined();
    expect(config.providers.upcitemdb).toBeDefined();
    expect(config.retentionDays).toBe(30);
  });

  it('atomically enforces daily quota via Redis Lua script and denies requests when cap is reached', async () => {
    const redis = getRedis();
    const day = utcDay();
    const key = dailyQuotaKey('upcitemdb', day);

    // Seed Redis counter at 99 with limit 100
    await redis.set(key, '99');

    // First request should be granted and increment counter to 100
    const res1 = await reserveDailyQuota('upcitemdb');
    expect(res1.granted).toBe(true);
    expect(res1.currentCount).toBe(100);

    // Second request should be denied because limit 100 is reached
    const res2 = await reserveDailyQuota('upcitemdb');
    expect(res2.granted).toBe(false);
    expect(res2.currentCount).toBe(100);
  });

  it('handles concurrent quota race at limit boundary correctly', async () => {
    const redis = getRedis();
    const day = utcDay();
    const key = dailyQuotaKey('upcitemdb', day);

    // Seed Redis counter at 99 (1 slot remaining out of 100)
    await redis.set(key, '99');

    // 2 concurrent calls racing for the last slot
    const [callA, callB] = await Promise.all([
      reserveDailyQuota('upcitemdb'),
      reserveDailyQuota('upcitemdb'),
    ]);

    const grantedCount = [callA.granted, callB.granted].filter(Boolean).length;
    const deniedCount = [callA.granted, callB.granted].filter((g) => !g).length;

    expect(grantedCount).toBe(1);
    expect(deniedCount).toBe(1);
  });

  it('fails open when Redis throws an unexpected error', async () => {
    const redis = getRedis();
    const evalSpy = vi.spyOn(redis, 'eval').mockRejectedValue(new Error('Redis connection dropped'));

    const res = await reserveDailyQuota('upcitemdb');
    expect(res.granted).toBe(true); // Must fail open to protect user scan UX

    evalSpy.mockRestore();
  });

  it('CRITICAL ADVISOR TEST: partial PATCH preserves retentionDays: null across timeout updates', async () => {
    const adminId = '00000000-0000-0000-0000-000000000001';

    // 1. Admin sets retentionDays: null (unlimited retention)
    const step1 = await updateBarcodeProviderSettings(
      {
        retentionDays: null,
      },
      adminId,
    );
    expect(step1.retentionDays).toBeNull();

    // 2. Later, admin sends a timeout-only PATCH that omits retentionDays
    const step2 = await updateBarcodeProviderSettings(
      {
        providers: {
          off: { timeoutMs: 4200 },
        },
      },
      adminId,
    );

    // Must strictly preserve null and NOT revert to 30 days!
    expect(step2.retentionDays).toBeNull();
    expect(step2.providers.off?.timeoutMs).toBe(4200);

    // 3. Confirm that retention pruning with current settings skips pruning and preserves data
    const prisma = getPrisma();
    const deleteManySpy = vi.spyOn(prisma.barcodeApiCallLog, 'deleteMany');

    const prunedCount = await pruneExpiredBarcodeApiLogs();
    expect(prunedCount).toBe(0);
    expect(deleteManySpy).not.toHaveBeenCalled();

    deleteManySpy.mockRestore();
  });

  it('synchronizes circuit breaker timeout when provider timeout is adjusted', async () => {
    const adminId = '00000000-0000-0000-0000-000000000001';

    await updateBarcodeProviderSettings(
      {
        providers: {
          off: { timeoutMs: 4000 },
        },
      },
      adminId,
    );

    const breaker = getBreaker('off');
    if (typeof breaker === 'object' && breaker !== null && 'options' in breaker) {
      const bOpts = breaker.options as { timeout: number };
      expect(bOpts.timeout).toBe(4500); // 4000 + 500ms
    }
  });

  it('resets provider cooldown and reports cooldown active state', () => {
    resetProviderCooldown('upcitemdb');
    const status = isProviderCooldownActive('upcitemdb');
    expect(status.active).toBe(false);
    expect(status.remainingSeconds).toBeNull();
  });
});
