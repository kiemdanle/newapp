// Phase 7: real backup-freeze policy for Phase 3's `withMediaMutationLease`
// hook. The freeze flag lives in Redis (not process memory) because the
// process that ACQUIRES a freeze — a one-shot CLI invoked by backup.sh — is
// never the same process as the running `pantry-api` systemd service whose
// in-flight leases must actually stop. Redis is the only thing both
// processes share.
import { getRedis } from '../../redis.js';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import { setMediaFreezePolicy, listActiveMediaLeaseKeys, type MediaLeaseKind } from './product-media-coordinator.js';

const FREEZE_KEY = 'media:freeze:active';
// Self-healing ceiling: if the process that acquired a freeze crashes before
// releasing it, the flag expires on its own rather than wedging every media
// mutation forever. Generous relative to a real backup's expected duration.
const FREEZE_FLAG_TTL_SECONDS = 15 * 60;
const DRAIN_POLL_INTERVAL_MS = 250;

/**
 * Wires the real freeze check into `withMediaMutationLease` — call once at
 * server startup (mirrors `probeMediaCapabilities()`'s placement). A freeze
 * acquired by a separate CLI process becomes effective here on this
 * process's very next media mutation attempt, since both read the same
 * Redis key.
 */
export function installMediaFreezePolicy(): void {
  setMediaFreezePolicy(async (_kind: MediaLeaseKind) => {
    const frozen = await getRedis().exists(FREEZE_KEY);
    if (frozen) {
      throw new AppError({
        status: 503,
        code: ERROR_CODES.TEMPORARILY_UNAVAILABLE,
        title: 'Media operations are frozen for a backup in progress; retry shortly',
      });
    }
  });
}

export interface MediaFreezeResult {
  drained: boolean;
  remainingLeases: number;
}

/**
 * Sets the freeze flag — every `withMediaMutationLease` call across every
 * `pantry-api` process rejects from this point on — then polls
 * `listActiveMediaLeaseKeys()` (Redis-backed, so visible across processes)
 * until every already-in-flight lease has drained or `drainTimeoutMs`
 * elapses. Returns `drained: false` rather than throwing on timeout — the
 * caller (backup.sh, via the CLI wrapper) decides whether an undrained
 * freeze is fatal to the backup run.
 */
export async function acquireMediaFreeze(drainTimeoutMs = 30_000): Promise<MediaFreezeResult> {
  await getRedis().set(FREEZE_KEY, '1', 'EX', FREEZE_FLAG_TTL_SECONDS);
  const deadline = Date.now() + drainTimeoutMs;
  let remaining = (await listActiveMediaLeaseKeys()).length;
  while (remaining > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, DRAIN_POLL_INTERVAL_MS));
    remaining = (await listActiveMediaLeaseKeys()).length;
  }
  return { drained: remaining === 0, remainingLeases: remaining };
}

/** Idempotent — safe to call even if no freeze is active (e.g. a script's
 * cleanup trap running after a failed acquire). */
export async function releaseMediaFreeze(): Promise<void> {
  await getRedis().del(FREEZE_KEY);
}

export async function isMediaFreezeActive(): Promise<boolean> {
  return (await getRedis().exists(FREEZE_KEY)) === 1;
}
