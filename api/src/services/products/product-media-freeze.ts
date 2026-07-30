// Phase 7: real backup-freeze policy for Phase 3's `withMediaMutationLease`
// hook. The freeze flag lives in Redis (not process memory) because the
// process that ACQUIRES a freeze — a one-shot CLI invoked by backup.sh — is
// never the same process as the running `pantry-api` systemd service whose
// in-flight leases must actually stop. Redis is the only thing both
// processes share.
import { randomUUID } from 'node:crypto';
import { getRedis } from '../../redis.js';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import { setMediaFreezePolicy, listActiveMediaLeaseKeys, type MediaLeaseKind } from './product-media-coordinator.js';

const FREEZE_KEY = 'media:freeze:active';
// Self-healing ceiling: if the process that acquired a freeze crashes before
// renewing or releasing it, the flag expires on its own rather than wedging
// every media mutation forever. `backup.sh` renews well before this while its
// capture runs (reviewer-p7 II3) — this is only the crash-recovery ceiling,
// not the expected freeze lifetime.
const FREEZE_FLAG_TTL_SECONDS = 15 * 60;
const DRAIN_POLL_INTERVAL_MS = 250;

// Token-guarded compare-and-act, identical in shape to
// product-media-coordinator.ts's RENEW_SCRIPT/RELEASE_SCRIPT and
// queues/jobs/product-media-cleanup.ts's cleanup lock — a holder whose
// freeze already expired (and was possibly reclaimed by a second, unrelated
// backup run) can never renew or release a freeze it no longer owns
// (reviewer-p7 II3: the previous unconditional `SET`/`DEL` let a second
// backup silently "acquire" an already-held freeze and reset its TTL, and
// let whichever run finished first unfreeze the other).
const RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 0
`;
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

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
  /** Unique per acquisition — required by `renewMediaFreeze`/`releaseMediaFreeze`
   * so a holder whose freeze already expired (and was possibly reclaimed by a
   * second, unrelated run) can never renew or release someone else's freeze. */
  token: string;
  drained: boolean;
  remainingLeases: number;
}

/** Thrown by `acquireMediaFreeze` when a freeze is already held by another
 * run — mutual exclusion between concurrent backups (reviewer-p7 II3), never
 * silently overwriting an in-progress freeze's token/TTL. */
export class MediaFreezeAlreadyActiveError extends Error {
  constructor() {
    super('a media freeze is already active');
    this.name = 'MediaFreezeAlreadyActiveError';
  }
}

/**
 * Sets the freeze flag — every `withMediaMutationLease` call across every
 * `pantry-api` process rejects from this point on — then polls
 * `listActiveMediaLeaseKeys()` (Redis-backed, so visible across processes)
 * until every already-in-flight lease has drained or `drainTimeoutMs`
 * elapses. Returns `drained: false` rather than throwing on timeout — the
 * caller (backup.sh, via the CLI wrapper) decides whether an undrained
 * freeze is fatal to the backup run.
 *
 * Throws `MediaFreezeAlreadyActiveError` (via `SET … NX`) instead of
 * silently acquiring over an already-held freeze — the caller must not
 * proceed as though it holds a freeze it doesn't.
 */
export async function acquireMediaFreeze(drainTimeoutMs = 30_000): Promise<MediaFreezeResult> {
  const token = randomUUID();
  const acquired = await getRedis().set(FREEZE_KEY, token, 'EX', FREEZE_FLAG_TTL_SECONDS, 'NX');
  if (!acquired) {
    throw new MediaFreezeAlreadyActiveError();
  }
  const deadline = Date.now() + drainTimeoutMs;
  let remaining = (await listActiveMediaLeaseKeys()).length;
  while (remaining > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, DRAIN_POLL_INTERVAL_MS));
    remaining = (await listActiveMediaLeaseKeys()).length;
  }
  return { token, drained: remaining === 0, remainingLeases: remaining };
}

/** Renews a held freeze's TTL, returning whether it was actually still this
 * holder's freeze to renew. `backup.sh` calls this periodically while its
 * capture (pg_dump / manifest generate / tar) runs, well under
 * `FREEZE_FLAG_TTL_SECONDS`, so a capture slower than the TTL never silently
 * loses the freeze mid-capture while believing it still holds it
 * (reviewer-p7 II3). */
export async function renewMediaFreeze(token: string): Promise<boolean> {
  const renewed = await getRedis().eval(RENEW_SCRIPT, 1, FREEZE_KEY, token, FREEZE_FLAG_TTL_SECONDS);
  return renewed === 1;
}

/** Idempotent — safe to call even when no freeze is active, or when this
 * token no longer owns it (e.g. a script's cleanup trap running after a
 * failed acquire, or after the freeze already expired and was reclaimed by a
 * different run — token-guarded so that reclaiming run's freeze is never
 * deleted out from under it). */
export async function releaseMediaFreeze(token: string): Promise<void> {
  await getRedis().eval(RELEASE_SCRIPT, 1, FREEZE_KEY, token);
}

export async function isMediaFreezeActive(): Promise<boolean> {
  return (await getRedis().exists(FREEZE_KEY)) === 1;
}

/** Test-only: force-clears the freeze flag regardless of token, so a test's
 * cleanup hook can't leak a held freeze into the next test even when it
 * doesn't have (or care about) the acquiring token. Never used by production
 * code — `releaseMediaFreeze` is the real, token-fenced release. */
export async function resetMediaFreezeForTests(): Promise<void> {
  await getRedis().del(FREEZE_KEY);
}
