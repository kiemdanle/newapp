// Phase 7: scheduled sweep tying together Phase 3's durable outbox
// (`processMediaOutboxOnce`) and the stale-draft/stale-quarantine sweeps —
// BullMQ's repeat scheduler only *accelerates* delivery, the durable outbox
// polling loop and DB re-checks remain authoritative on their own. A Redis
// lock enforces one in-flight run at a time across every worker process.
//
// The lock is token-guarded (reviewer-p7 I3): the original version acquired
// with a constant value and released with an unconditional DEL, so any run
// exceeding the 55s TTL (entirely plausible — 25 outbox operations + 25
// draft-delete transactions + an unbounded quarantine walk) let a second run
// in, and then *that* run's own unconditional release deleted the second
// run's lock on its way out, silently admitting a third. This mirrors
// `product-media-coordinator.ts`'s `withMediaMutationLease` lease pattern
// exactly (unique token, compare-and-act Lua release, periodic renewal)
// rather than hand-rolling a second variant of the same idea.
import { randomUUID } from 'node:crypto';
import { Queue, Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../index.js';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';
import { processMediaOutboxOnce } from '../../services/products/product-media-outbox.js';
import { sweepStaleProductDrafts, sweepStaleQuarantine } from '../../services/products/product-media-cleanup.js';
import { recordCleanupFailure, recordCleanupSuccess } from '../../services/products/product-operational-health.js';

export const PRODUCT_MEDIA_CLEANUP_QUEUE = 'product-media-cleanup';

const REPEAT_EVERY_MS = 60_000;
const OUTBOX_BATCH_LIMIT = 25;
const DRAFT_BATCH_LIMIT = 25;
const LOCK_KEY = 'product-media-cleanup:lock';
// Self-healing ceiling: if the holder crashes without releasing, the lock
// expires on its own rather than wedging every future tick forever. Renewed
// well before this while a pass is genuinely still running (below), so a
// slow-but-alive run is never mistaken for a dead one.
const LOCK_TTL_SECONDS = 55;
const LOCK_RENEW_INTERVAL_MS = 20_000;

// Both scripts are token-guarded compare-and-act, identical in shape to
// product-media-coordinator.ts's RENEW_SCRIPT/RELEASE_SCRIPT — a holder whose
// lock already expired (and was possibly reclaimed by someone else) can
// never renew or release a lock it no longer owns.
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

export interface ProductMediaCleanupCounters {
  outboxClaimed: number;
  outboxCompleted: number;
  outboxFailed: number;
  staleDraftsScanned: number;
  staleDraftsDeleted: number;
  staleDraftsSkippedReferenced: number;
  staleQuarantineScanned: number;
  staleQuarantineDeleted: number;
}

let _queue: Queue | undefined;
export function productMediaCleanupQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(PRODUCT_MEDIA_CLEANUP_QUEUE, { connection: getQueueConnection() });
  }
  return _queue;
}

/** Registers the repeatable tick. Idempotent — BullMQ dedupes an identical
 * repeat configuration added more than once, so this is safe to call on
 * every app boot. */
export async function scheduleProductMediaCleanup(): Promise<void> {
  await productMediaCleanupQueue().add(
    PRODUCT_MEDIA_CLEANUP_QUEUE,
    {},
    { repeat: { every: REPEAT_EVERY_MS }, removeOnComplete: 100, removeOnFail: 100 },
  );
}

/**
 * Runs exactly one sweep pass: claims/executes a batch of due outbox work,
 * deletes a batch of stale drafts, and removes stale quarantine directories.
 * Returns `null` (not an error) when another run is already in flight —
 * the one-overlap-lock contract every scheduled invocation must honor.
 */
export async function processProductMediaCleanupOnce(): Promise<ProductMediaCleanupCounters | null> {
  const redis = getRedis();
  const token = randomUUID();
  const acquired = await redis.set(LOCK_KEY, token, 'EX', LOCK_TTL_SECONDS, 'NX');
  if (!acquired) {
    logger.info('product-media-cleanup: skipped — another run is already in flight');
    return null;
  }

  const heartbeat = setInterval(() => {
    redis.eval(RENEW_SCRIPT, 1, LOCK_KEY, token, LOCK_TTL_SECONDS).catch((err: unknown) => {
      logger.warn({ err }, 'product-media-cleanup: lock heartbeat failed');
    });
  }, LOCK_RENEW_INTERVAL_MS);
  heartbeat.unref();

  try {
    const outbox = await processMediaOutboxOnce(OUTBOX_BATCH_LIMIT);
    const drafts = await sweepStaleProductDrafts(DRAFT_BATCH_LIMIT);
    const quarantine = await sweepStaleQuarantine();
    const counters: ProductMediaCleanupCounters = {
      outboxClaimed: outbox.claimed,
      outboxCompleted: outbox.completed,
      outboxFailed: outbox.failed,
      staleDraftsScanned: drafts.scanned,
      staleDraftsDeleted: drafts.deleted,
      staleDraftsSkippedReferenced: drafts.skippedReferenced,
      staleQuarantineScanned: quarantine.scanned,
      staleQuarantineDeleted: quarantine.deleted,
    };
    logger.info(counters, 'product-media-cleanup: sweep complete');
    await recordCleanupSuccess();
    return counters;
  } catch (err) {
    await recordCleanupFailure();
    throw err;
  } finally {
    clearInterval(heartbeat);
    await redis.eval(RELEASE_SCRIPT, 1, LOCK_KEY, token).catch((err: unknown) => {
      logger.warn({ err }, 'product-media-cleanup: failed to release lock');
    });
  }
}

export function startProductMediaCleanupWorker(): Worker {
  return new Worker(
    PRODUCT_MEDIA_CLEANUP_QUEUE,
    async (_job: Job) => processProductMediaCleanupOnce(),
    { connection: getQueueConnection(), concurrency: 1 },
  );
}
