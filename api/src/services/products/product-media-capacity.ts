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
// budget (the actual bytes on disk are always the source of truth; this only bounds
// how much *concurrent* work can be in flight at once).
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

/** Renews a reservation's TTL. A no-op (not an error) if the reservation already
 * expired or was released — the caller's own terminal-path handling is what matters,
 * not whether a heartbeat lands on an already-finished operation. */
export async function heartbeatMediaCapacityReservation(id: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
  await getRedis().expire(RES_PREFIX + id, ttlSeconds);
}

/** Updates a reservation's byte amount to the real measured size once known (e.g.
 * after encoding), preserving its current TTL. Reconciling down frees budget for
 * other concurrent operations immediately rather than holding the pessimistic
 * worst-case estimate for the reservation's full lifetime. */
export async function reconcileMediaCapacityReservation(id: string, actualBytes: number): Promise<void> {
  await getRedis().set(RES_PREFIX + id, actualBytes, 'KEEPTTL');
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
