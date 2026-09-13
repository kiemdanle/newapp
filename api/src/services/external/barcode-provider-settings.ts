import {
  barcodeApiConfigSchema,
  type BarcodeApiConfig,
  type BarcodeApiConfigPatch,
  type BarcodeProviderSetting,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';
import {
  getSetting,
  putSetting,
  SETTING_KEYS,
  DEFAULT_BARCODE_API_CONFIG,
} from '../admin/settings.js';
import { getBreaker } from './breakers.js';
import { resetUpcQuotaCooldown, getUpcQuotaCooldownUntil } from '../products/upcitemdb-client.js';

let cachedConfig: { data: BarcodeApiConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10_000;

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dailyQuotaKey(provider: string, day: string): string {
  return `barcode:daily_quota:${provider}:${day}`;
}

const RESERVE_QUOTA_LUA = `
local current = redis.call('GET', KEYS[1])
local limit = tonumber(ARGV[1])
if limit and limit > 0 and current and tonumber(current) >= limit then
  return { 0, tonumber(current) }
end
local next_val = redis.call('INCR', KEYS[1])
if next_val == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return { 1, next_val }
`;

export async function getBarcodeProviderSettings(): Promise<BarcodeApiConfig> {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) {
    return cachedConfig.data;
  }
  const fresh = await getSetting(SETTING_KEYS.EXTERNAL_BARCODE_PROVIDERS, barcodeApiConfigSchema);
  cachedConfig = { data: fresh, expiresAt: now + CACHE_TTL_MS };
  return fresh;
}

export function invalidateBarcodeProviderSettingsCache(): void {
  cachedConfig = null;
}

export async function updateBarcodeProviderSettings(
  patch: BarcodeApiConfigPatch,
  adminId: string,
): Promise<BarcodeApiConfig> {
  const current = await getBarcodeProviderSettings();

  // CRITICAL: Safe partial merge. If retentionDays is omitted in the patch (undefined),
  // preserve the existing retentionDays (including null for unlimited retention).
  const nextRetentionDays = patch.retentionDays !== undefined ? patch.retentionDays : current.retentionDays;

  const mergedProviders: Record<string, BarcodeProviderSetting> = { ...current.providers };
  if (patch.providers) {
    for (const [providerKey, providerPatch] of Object.entries(patch.providers)) {
      if (!providerPatch) continue;
      const currentProv =
        mergedProviders[providerKey] ??
        DEFAULT_BARCODE_API_CONFIG.providers[providerKey] ?? {
          enabled: true,
          timeoutMs: 3000,
          dailyLimit: null,
          priority: 10,
        };

      mergedProviders[providerKey] = {
        enabled: providerPatch.enabled !== undefined ? providerPatch.enabled : currentProv.enabled,
        timeoutMs: providerPatch.timeoutMs !== undefined ? providerPatch.timeoutMs : currentProv.timeoutMs,
        dailyLimit: providerPatch.dailyLimit !== undefined ? providerPatch.dailyLimit : currentProv.dailyLimit,
        priority: providerPatch.priority !== undefined ? providerPatch.priority : currentProv.priority,
      };

      // Synchronize circuit breaker timeout to avoid early trips before HTTP timeout expires
      try {
        const breaker = getBreaker(providerKey);
        if (typeof breaker === 'object' && breaker !== null && 'options' in breaker) {
          const bOpts = breaker.options;
          if (typeof bOpts === 'object' && bOpts !== null && 'timeout' in bOpts) {
            (bOpts as { timeout: number | false }).timeout = mergedProviders[providerKey].timeoutMs + 500;
          }
        }
      } catch {
        // Breaker might not yet be registered or provider has no breaker
      }
    }
  }

  const newConfig: BarcodeApiConfig = {
    providers: mergedProviders,
    retentionDays: nextRetentionDays,
  };

  const saved = await putSetting(
    SETTING_KEYS.EXTERNAL_BARCODE_PROVIDERS,
    newConfig,
    barcodeApiConfigSchema,
    adminId,
  );

  invalidateBarcodeProviderSettingsCache();
  return saved;
}

export interface QuotaReservationResult {
  granted: boolean;
  currentCount: number;
  limit: number | null;
}

export async function reserveDailyQuota(
  provider: string,
  now = new Date(),
): Promise<QuotaReservationResult> {
  const config = await getBarcodeProviderSettings();
  const providerSetting = config.providers[provider];
  const limit = providerSetting?.dailyLimit ?? null;

  // Unlimited provider quota: always granted
  if (limit === null || limit <= 0) {
    return { granted: true, currentCount: 0, limit: null };
  }

  try {
    const redis = getRedis();
    const day = utcDay(now);
    const key = dailyQuotaKey(provider, day);
    const ttlSeconds = 48 * 3600; // 48 hours

    const result = (await redis.eval(RESERVE_QUOTA_LUA, 1, key, limit, ttlSeconds)) as [number, number];
    const granted = result[0] === 1;
    const currentCount = Number(result[1]);

    return {
      granted,
      currentCount,
      limit,
    };
  } catch (err) {
    // Fail-open policy: transient Redis outage must not block user barcode lookups
    logger.warn({ err, provider }, 'Redis failure during daily quota reservation; failing open');
    return {
      granted: true,
      currentCount: 0,
      limit,
    };
  }
}

export async function getTodayDispatchedCount(provider: string, now = new Date()): Promise<number> {
  const day = utcDay(now);
  const key = dailyQuotaKey(provider, day);

  try {
    const redis = getRedis();
    const val = await redis.get(key);
    if (val !== null) {
      return Number(val);
    }
  } catch (err) {
    logger.warn({ err, provider }, 'Failed to read today quota count from Redis, falling back to database');
  }

  // Fallback: count from database excluding cooldown skips
  try {
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const prisma = getPrisma();
    const count = await prisma.barcodeApiCallLog.count({
      where: {
        provider,
        createdAt: { gte: startOfDay },
        status: { not: 'cooldown_skipped' },
      },
    });
    return count;
  } catch (err) {
    logger.warn({ err, provider }, 'Failed to count barcode calls from database fallback');
    return 0;
  }
}

export async function isProviderEnabled(provider: string): Promise<boolean> {
  const config = await getBarcodeProviderSettings();
  const setting = config.providers[provider];
  return setting ? setting.enabled : true;
}

export async function getProviderTimeoutMs(provider: string, fallbackMs = 3000): Promise<number> {
  const config = await getBarcodeProviderSettings();
  const setting = config.providers[provider];
  return setting ? setting.timeoutMs : fallbackMs;
}

export function resetProviderCooldown(provider: string): void {
  if (provider === 'upcitemdb') {
    resetUpcQuotaCooldown();
  }
}

export function isProviderCooldownActive(provider: string): { active: boolean; remainingSeconds: number | null } {
  if (provider === 'upcitemdb') {
    const until = getUpcQuotaCooldownUntil();
    const now = Date.now();
    if (now < until) {
      return {
        active: true,
        remainingSeconds: Math.ceil((until - now) / 1000),
      };
    }
  }
  return { active: false, remainingSeconds: null };
}

export function resetProviderBreaker(provider: string): void {
  try {
    const breaker = getBreaker(provider);
    if (breaker) {
      breaker.close();
    }
  } catch (err) {
    logger.warn({ err, provider }, 'Failed to reset breaker');
  }
}
