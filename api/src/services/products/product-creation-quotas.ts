// Phase 7: per-user fair-share limits, independent of and layered on top of
// Phase 3's global disk-capacity reservation — quotas bound one user's share,
// capacity bounds the whole server's budget. Never reimplements reservation or
// lease semantics; every byte-reservation call here delegates to the existing
// `reserveMediaCapacity`.
import type { Prisma, PrismaClient } from '@prisma/client';
import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';

type Db = PrismaClient | Prisma.TransactionClient;

const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;

function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function dailyBytesKey(actorId: string, day: string): string {
  return `product-creation:quota:bytes:${actorId}:${day}`;
}

/**
 * Throws a typed 409 when the actor already has `maxActiveDraftsPerUser`
 * draft/changes_required products — checked before a new draft is created,
 * never against an existing one being resumed.
 *
 * Accepts an optional transaction client so the caller can run this and the
 * subsequent `product.create` inside the same transaction, under a
 * per-actor `pg_advisory_xact_lock`. A plain count-then-create under
 * Postgres's default READ COMMITTED isolation lets two concurrent requests
 * from the same actor both read a count one under the cap and both create,
 * overshooting it by one (reviewer-p7 M1) — the advisory lock (taken by the
 * caller, not here) serializes just that one actor's own concurrent create
 * attempts against each other, never against unrelated actors.
 *
 * Deliberately bounds only *concurrently open* drafts, not lifetime creation
 * count (reviewer-p7 M2: cycling create -> submit -> create frees a slot
 * immediately, so total row creation is unbounded over time). The plan
 * spec's quota surface is exactly two dimensions — this active-draft cap and
 * `maxDailyBytesPerUser` below — with no daily-creation-count limit named
 * anywhere; adding one would be a new capability beyond that surface, not a
 * fix. Cycling create/submit/create is also the legitimate usage pattern for
 * a prolific real contributor. Revisit only as an explicit product decision,
 * not silently.
 */
export async function assertWithinActiveDraftQuota(actorId: string, db: Db = getPrisma()): Promise<void> {
  const cfg = getConfig().productCreation;
  const count = await db.product.count({
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

/** Bytes currently charged against this actor's today total — the sum of
 * every still-live reservation's (possibly since-reconciled) amount, UTC-day
 * bucketed. Read-only; does not itself reserve or charge anything. */
export async function currentDailyBytesAccepted(actorId: string, now: Date = new Date()): Promise<number> {
  const val = await getRedis().get(dailyBytesKey(actorId, utcDay(now)));
  return val ? Number(val) : 0;
}

// Atomically INCRBYs the worst-case estimate and only admits it if the running
// total stays within the cap, compensating with a DECRBY in the same script when
// it doesn't — the check and the reserve are one Redis command, so no window
// exists between them for a second concurrent request to read the same
// pre-reservation total (reviewer-p7 I1: the previous GET-then-later-INCRBY
// shape let 8 concurrent uploads all pass the same headroom check, landing a
// final total 70% over the configured cap). `EXPIRE` runs unconditionally on
// every call (a cheap no-op once already set) rather than only when the key was
// just created, closing the leak where a crash between INCRBY and a conditional
// EXPIRE left a permanent key (reviewer-p7 M4).
const RESERVE_SCRIPT = `
local key = KEYS[1]
local estimate = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local total = redis.call('INCRBY', key, estimate)
redis.call('EXPIRE', key, ttl)
if total > cap then
  redis.call('DECRBY', key, estimate)
  return {'EXCEEDED', total - estimate}
end
return {'OK', total}
`;

export interface DailyByteQuotaReservation {
  actorId: string;
  day: string;
  reservedBytes: number;
}

/**
 * Atomically reserves `estimatedBytes` (the worst-case ceiling for the
 * upload about to run) against the actor's today total, throwing a typed 429
 * when that would push them over `maxDailyBytesPerUser`. Callers must run
 * this *before* the Phase 3 capacity reservation for the same upload — a
 * quota rejection should never cost a capacity reservation round trip.
 *
 * The reservation must be reconciled exactly once, on every terminal path
 * (success or failure), via `reconcileDailyByteQuota` — mirroring how a
 * Phase 3 media-capacity reservation is always released/reconciled in a
 * `finally`, never left dangling.
 */
export async function reserveDailyByteQuota(
  actorId: string,
  estimatedBytes: number,
  now: Date = new Date(),
): Promise<DailyByteQuotaReservation> {
  const cfg = getConfig().productCreation;
  const day = utcDay(now);
  const [status] = (await getRedis().eval(
    RESERVE_SCRIPT,
    1,
    dailyBytesKey(actorId, day),
    estimatedBytes,
    cfg.maxDailyBytesPerUser,
    DAY_TTL_SECONDS,
  )) as [string, number];
  if (status === 'EXCEEDED') {
    throw new AppError({
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      title: 'Daily upload quota exceeded; try again tomorrow',
    });
  }
  return { actorId, day, reservedBytes: estimatedBytes };
}

/**
 * Reconciles a reservation down to what should actually be permanently
 * charged for this attempt, refunding only the unused headroom between the
 * worst-case reservation and `actualBytes`. On a successful upload,
 * `actualBytes` is the real accepted display+thumb total (unchanged
 * semantics from before this fix). On a failed/rejected upload, callers pass
 * however many source bytes were actually streamed before it failed (`0` if
 * it failed before any byte was read) — a corrupt/oversized/rejected upload
 * still costs the actor real quota instead of nothing, closing the unbounded
 * free-abuse vector where failed attempts were metered as zero bytes
 * (reviewer-p7 I2). Never increments beyond what was reserved; safe to call
 * at most once per reservation.
 */
export async function reconcileDailyByteQuota(reservation: DailyByteQuotaReservation, actualBytes: number): Promise<void> {
  const refund = Math.max(0, reservation.reservedBytes - actualBytes);
  if (refund === 0) return;
  await getRedis().decrby(dailyBytesKey(reservation.actorId, reservation.day), refund);
}
