import { randomUUID } from 'node:crypto';
import type { MediaOperationType } from '@prisma/client';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';

/** Every operation that can change a referenced private/public key or physical file
 * goes through `withMediaMutationLease` — the mandatory fence Phase 7 extends with
 * backup-freeze semantics. `MediaOperationType` already enumerates exactly the
 * reference-changing operation classes (Phase 1's outbox enum); `upload` is added
 * here for the one earlier step (generating variants into a not-yet-referenced key)
 * that still benefits from freeze/monitoring visibility even though it has no outbox
 * intent of its own. */
export type MediaLeaseKind = MediaOperationType | 'upload';

export interface MediaMutationLease {
  id: string;
  kind: MediaLeaseKind;
}

/** Injectable pre-acquire gate. Phase 3's default never blocks; Phase 7 swaps this
 * for a real implementation that rejects/waits while a backup freeze is active,
 * without any caller of `withMediaMutationLease` having to change. Throwing here
 * aborts the operation before any bytes are touched. */
export type MediaFreezePolicy = (kind: MediaLeaseKind) => Promise<void> | void;

let freezePolicy: MediaFreezePolicy = () => {};

export function setMediaFreezePolicy(policy: MediaFreezePolicy): void {
  freezePolicy = policy;
}

export function resetMediaFreezePolicyForTests(): void {
  freezePolicy = () => {};
}

const DEFAULT_LEASE_TTL_SECONDS = 30;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const ACTIVE_LEASES_SET = 'media:active-leases';

export interface MediaMutationLeaseOptions {
  /** Overridable only for tests — production callers rely on the defaults above,
   * which are tuned for real operation durations, not test speed. */
  ttlSeconds?: number;
  heartbeatIntervalMs?: number;
}

function leaseKey(kind: MediaLeaseKind, token: string): string {
  return `media:lease:${kind}:${token}`;
}

// Both scripts are token-guarded compare-and-act so a lease that already expired (and
// was possibly reused by someone else, however unlikely with a fresh UUID token) can
// never be renewed or released by a stale holder.
const RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 0
`;
const RELEASE_SCRIPT = `
redis.call('SREM', KEYS[2], KEYS[1])
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/**
 * The mandatory wrapper for every final referenced-file/key mutation (private
 * promotion, public publish, and every delete class). Checks the injectable freeze
 * policy, registers a renewable Redis lease (visible via `listActiveMediaLeaseIds`
 * for Phase 7's monitoring/backup-freeze reconciliation), heartbeats it while
 * `operation` runs, and always releases on completion or failure. This is a
 * visibility/fencing primitive, not a per-resource mutex — resource-level
 * serialization (e.g. one product's photo positions) is handled separately by the
 * DB transaction's row lock; concurrent leases of the same kind are expected and
 * fine.
 */
export async function withMediaMutationLease<T>(
  kind: MediaLeaseKind,
  operation: (lease: MediaMutationLease) => Promise<T>,
  options: MediaMutationLeaseOptions = {},
): Promise<T> {
  await freezePolicy(kind);

  const ttlSeconds = options.ttlSeconds ?? DEFAULT_LEASE_TTL_SECONDS;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  const redis = getRedis();
  const token = randomUUID();
  const key = leaseKey(kind, token);
  await redis.set(key, token, 'EX', ttlSeconds);
  await redis.sadd(ACTIVE_LEASES_SET, key);

  const heartbeat = setInterval(() => {
    redis.eval(RENEW_SCRIPT, 1, key, token, ttlSeconds).catch((err: unknown) => {
      logger.warn({ err, kind, leaseId: token }, 'media mutation lease heartbeat failed');
    });
  }, heartbeatIntervalMs);
  heartbeat.unref();

  try {
    return await operation({ id: token, kind });
  } finally {
    clearInterval(heartbeat);
    await redis.eval(RELEASE_SCRIPT, 2, key, ACTIVE_LEASES_SET, token).catch((err: unknown) => {
      logger.warn({ err, kind, leaseId: token }, 'failed to release media mutation lease');
    });
  }
}

/** Active lease keys, for Phase 7's monitoring/backup-freeze reconciliation. Lazily
 * self-heals: a key present in the set but already expired (process died before
 * releasing) is filtered out here rather than requiring a separate GC worker. */
export async function listActiveMediaLeaseKeys(): Promise<string[]> {
  const redis = getRedis();
  const keys = await redis.smembers(ACTIVE_LEASES_SET);
  if (keys.length === 0) return [];
  const exists = await Promise.all(keys.map((k) => redis.exists(k)));
  const stale = keys.filter((_, i) => !exists[i]);
  if (stale.length > 0) await redis.srem(ACTIVE_LEASES_SET, ...stale);
  return keys.filter((_, i) => exists[i] === 1);
}
