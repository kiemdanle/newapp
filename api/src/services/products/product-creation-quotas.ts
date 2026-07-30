// Phase 7: per-user fair-share limits, independent of and layered on top of
// Phase 3's global disk-capacity reservation — quotas bound one user's share,
// capacity bounds the whole server's budget. Never reimplements reservation or
// lease semantics; every byte-reservation call here delegates to the existing
// `reserveMediaCapacity`.
import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';

const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;

function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function dailyBytesKey(actorId: string, day: string): string {
  return `product-creation:quota:bytes:${actorId}:${day}`;
}

/** Throws a typed 409 when the actor already has `maxActiveDraftsPerUser`
 * draft/changes_required products — checked before a new draft is created,
 * never against an existing one being resumed. */
export async function assertWithinActiveDraftQuota(actorId: string): Promise<void> {
  const cfg = getConfig().productCreation;
  const count = await getPrisma().product.count({
    where: { createdByUserId: actorId, status: { in: ['draft', 'changes_required'] } },
  });
  if (count >= cfg.maxActiveDraftsPerUser) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: `You may have at most ${cfg.maxActiveDraftsPerUser} active drafts at a time`,
    });
  }
}

/** Bytes this actor has already had *accepted* (not merely attempted) today,
 * UTC-day bucketed. */
export async function currentDailyBytesAccepted(actorId: string, now: Date = new Date()): Promise<number> {
  const val = await getRedis().get(dailyBytesKey(actorId, utcDay(now)));
  return val ? Number(val) : 0;
}

/** Throws a typed 429 when accepting `estimatedBytes` more would push the
 * actor's today total over `maxDailyBytesPerUser`. Callers must run this
 * *before* the Phase 3 capacity reservation for the same upload — a quota
 * rejection should never cost a capacity reservation round trip. */
export async function assertWithinDailyByteQuota(
  actorId: string,
  estimatedBytes: number,
  now: Date = new Date(),
): Promise<void> {
  const cfg = getConfig().productCreation;
  const used = await currentDailyBytesAccepted(actorId, now);
  if (used + estimatedBytes > cfg.maxDailyBytesPerUser) {
    throw new AppError({
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      title: 'Daily upload quota exceeded; try again tomorrow',
    });
  }
}

/** Records bytes actually accepted toward the actor's daily quota. Call only
 * after a successful, reservation-backed write commits — never for a
 * rejected/failed/abandoned upload, so the counter reflects real accepted
 * usage rather than attempts. Idempotent-by-construction is the caller's job
 * (call exactly once per accepted upload); this function itself is a plain
 * increment. */
export async function recordDailyBytesAccepted(actorId: string, bytes: number, now: Date = new Date()): Promise<void> {
  if (bytes <= 0) return;
  const redis = getRedis();
  const key = dailyBytesKey(actorId, utcDay(now));
  const total = await redis.incrby(key, bytes);
  if (total === bytes) await redis.expire(key, DAY_TTL_SECONDS);
}
