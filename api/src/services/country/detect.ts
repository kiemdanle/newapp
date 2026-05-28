import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivate(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

interface Deps {
  fetch?: typeof fetch;
}

export async function detectCountryFromIp(ip: string, deps: Deps = {}): Promise<string | null> {
  const f = deps.fetch ?? globalThis.fetch;
  if (!ip || isPrivate(ip)) return null;

  // Cache (skipped if Redis is not available, e.g., in unit tests with injected fetch)
  let redis: ReturnType<typeof getRedis> | null;
  try {
    redis = getRedis();
  } catch {
    redis = null;
  }
  const cacheKey = `country:${ip}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached === '__null__' ? null : cached;
  }

  const cfg = getConfig();

  // Primary: ipapi.co (returns country_code)
  try {
    const res = await f(`${cfg.countryDetect.primary}/${encodeURIComponent(ip)}/json/`);
    if (res.ok) {
      const data = (await res.json()) as { country_code?: string };
      if (data.country_code && /^[A-Z]{2}$/.test(data.country_code)) {
        if (redis) await redis.set(cacheKey, data.country_code, 'EX', 86_400);
        return data.country_code;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'country detect primary failed');
  }

  // Fallback: ip-api.com (returns countryCode)
  try {
    const res = await f(
      `${cfg.countryDetect.fallback}/json/${encodeURIComponent(ip)}?fields=countryCode`,
    );
    if (res.ok) {
      const data = (await res.json()) as { countryCode?: string };
      if (data.countryCode && /^[A-Z]{2}$/.test(data.countryCode)) {
        if (redis) await redis.set(cacheKey, data.countryCode, 'EX', 86_400);
        return data.countryCode;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'country detect fallback failed');
  }

  if (redis) await redis.set(cacheKey, '__null__', 'EX', 3600);
  return null;
}
