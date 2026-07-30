import { randomUUID } from 'node:crypto';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';

const INDEX_KEY = 'media:capacity:index';
const RES_PREFIX = 'media:capacity:res:';
const DEFAULT_TTL_SECONDS = 120;

export interface MediaCapacityReservation {
  id: string;
  bytes: number;
}

// Atomically sums every still-live reservation (lazily dropping any index entry
// whose key already expired — no separate GC worker needed) and only admits the new
// reservation if the total stays within the configured usable-minus-reserve budget.
// This is soft, Redis-only abuse/exhaustion protection, not a durability guarantee —
// a Redis restart resets it to zero, which is an accepted trade-off for a capacity
// budget. **Scope, precisely**: this bounds concurrent in-flight work (uploads
// decoding, publication sets being written) so a burst of activity can't spike disk
// usage past the budget *while it's happening*. It does not persist a running total
// of bytes already durably on disk — nothing here prevents cumulative disk usage
// from a large volume of *completed*, no-longer-reserved uploads over time from
// exceeding the configured usable bytes. A persisted, reconciled-against-real-disk
// -usage counter is Phase 7's operational-sweeper territory (`currentReservedMediaBytes`
// below is the primitive it would pair with real `du`/quota data), not implemented
// here (reviewer-p3 M3).

const RESERVE_SCRIPT = `
local index_key = KEYS[1]
local usable_minus_reserve = tonumber(ARGV[1])
local new_bytes = tonumber(ARGV[2])
local new_id = ARGV[3]
local ttl = tonumber(ARGV[4])
local res_prefix = ARGV[5]

local ids = redis.call('SMEMBERS', index_key)
local sum = 0
for _, id in ipairs(ids) do
  local val = redis.call('GET', res_prefix .. id)
  if val then
    sum = sum + tonumber(val)
  else
    redis.call('SREM', index_key, id)
  end
end

if sum + new_bytes > usable_minus_reserve then
  return 'EXCEEDED'
end

redis.call('SET', res_prefix .. new_id, new_bytes, 'EX', ttl)
redis.call('SADD', index_key, new_id)
return 'OK'
`;

function budgetBytes(): number {
  const cfg = getConfig().media;
  return Math.max(0, cfg.capacityUsableBytes - cfg.capacityReserveBytes);
}

/**
 * Atomically reserves `bytes` against the configured usable-capacity budget.
 * Callers must reserve worst-case bytes *before* writing anything to disk (upload:
 * max compressed source + max generated display/thumb; publication: the sum of
 * every display/thumb byte size in the set) — reservation is the gate, not an
 * after-the-fact accounting entry.
 */
export async function reserveMediaCapacity(input: { bytes: number; ttlSeconds?: number }): Promise<MediaCapacityReservation> {
  if (input.bytes < 0) throw new AppError({ status: 400, code: 'validation_error', title: 'reservation bytes must be non-negative' });
  const redis = getRedis();
  const id = randomUUID();
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const result = (await redis.eval(
    RESERVE_SCRIPT,
    1,
    INDEX_KEY,
    budgetBytes(),
    input.bytes,
    id,
    ttl,
    RES_PREFIX,
  )) as string;
  if (result === 'EXCEEDED') {
    throw new AppError({
      status: 507,
      code: 'capacity_exceeded',
      title: 'Not enough media capacity available right now; try again shortly',
    });
  }
  return { id, bytes: input.bytes };
}

/** Renews a reservation's TTL, returning whether it was actually still live to
 * renew. Not an error on its own if the reservation already expired or was
 * released — callers that must not proceed without a live reservation (e.g.
 * `publishProductPhoto`) check the return value themselves via
 * `assertMediaCapacityReservationLive`. */
export async function heartbeatMediaCapacityReservation(id: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<boolean> {
  const renewed = await getRedis().expire(RES_PREFIX + id, ttlSeconds);
  return renewed === 1;
}

/** Heartbeats `id` and throws a typed 507 if it was not actually live to renew.
 * The gate every final-byte-writing operation must pass before writing: a
 * capacity reservation is not optional bookkeeping, it's what makes "no
 * final/public key is created without a live reservation" true (reviewer-p3 I2). */
export async function assertMediaCapacityReservationLive(id: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
  const live = await heartbeatMediaCapacityReservation(id, ttlSeconds);
  if (!live) {
    throw new AppError({
      status: 507,
      code: 'capacity_exceeded',
      title: 'Media capacity reservation expired before the operation completed',
    });
  }
}

/** Updates a reservation's byte amount to the real measured size once known (e.g.
 * after encoding), preserving its current TTL. Reconciling down frees budget for
 * other concurrent operations immediately rather than holding the pessimistic
 * worst-case estimate for the reservation's full lifetime.
 *
 * Uses `SET ... KEEPTTL XX` (not a plain `SET ... KEEPTTL`) — `XX` makes this a
 * no-op when the key is already gone (expired or released) instead of
 * resurrecting it with no TTL and no index entry: a plain `SET` on a missing
 * key creates one, and `KEEPTTL` on a key that never had a TTL to begin with
 * means that resurrected key lives forever, invisible to `currentReservedMediaBytes`
 * (which only sums IDs still in the index) and never cleaned up — a permanent
 * Redis leak on every crash between reserve and reconcile (reviewer-p3 R2).
 * Returns whether the reservation was actually still live to reconcile. */
export async function reconcileMediaCapacityReservation(id: string, actualBytes: number): Promise<boolean> {
  const result = await getRedis().set(RES_PREFIX + id, actualBytes, 'KEEPTTL', 'XX');
  return result === 'OK';
}

/** Releases a reservation. Idempotent — safe to call from a `finally` on every
 * terminal path (success, failure, or already-expired) without checking state first. */
export async function releaseMediaCapacityReservation(id: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(INDEX_KEY, id).catch((err: unknown) => {
    logger.warn({ err, reservationId: id }, 'failed to remove media capacity index entry');
  });
  await redis.del(RES_PREFIX + id).catch((err: unknown) => {
    logger.warn({ err, reservationId: id }, 'failed to delete media capacity reservation');
  });
}

export interface MediaCapacitySnapshot {
  usableBytes: number;
  reserveBytes: number;
  budgetBytes: number;
  reservedBytes: number;
  freeBytes: number;
  freePercent: number;
}

/** Phase 7 health-endpoint primitive — a point-in-time read of the same
 * self-healing summation `reserveMediaCapacity`/`currentReservedMediaBytes`
 * already use, shaped for the operational health payload. Read-only; adds no
 * new reservation/lease semantics. */
export async function mediaCapacitySnapshot(): Promise<MediaCapacitySnapshot> {
  const cfg = getConfig().media;
  const budget = budgetBytes();
  const reserved = await currentReservedMediaBytes();
  const free = Math.max(0, budget - reserved);
  return {
    usableBytes: cfg.capacityUsableBytes,
    reserveBytes: cfg.capacityReserveBytes,
    budgetBytes: budget,
    reservedBytes: reserved,
    freeBytes: free,
    freePercent: budget > 0 ? (free / budget) * 100 : 0,
  };
}

/** Sum of every currently-live reservation. Read-only variant of the reserve
 * script's summation, exposed for monitoring/ops and for tests. */
export async function currentReservedMediaBytes(): Promise<number> {
  const redis = getRedis();
  const ids = await redis.smembers(INDEX_KEY);
  if (ids.length === 0) return 0;
  let sum = 0;
  const stale: string[] = [];
  for (const id of ids) {
    const val = await redis.get(RES_PREFIX + id);
    if (val === null) stale.push(id);
    else sum += Number(val);
  }
  if (stale.length > 0) await redis.srem(INDEX_KEY, ...stale);
  return sum;
}
