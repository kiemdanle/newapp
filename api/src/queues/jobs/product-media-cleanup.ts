// Phase 7: scheduled sweep tying together Phase 3's durable outbox
// (`processMediaOutboxOnce`) and the stale-draft/stale-quarantine sweeps —
// BullMQ's repeat scheduler only *accelerates* delivery, the durable outbox
// polling loop and DB re-checks remain authoritative on their own. A Redis
// lock enforces one in-flight run at a time across every worker process, so a
// slow tick can never overlap the next scheduled one.
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
// Below the repeat interval, so a crashed lock holder self-heals before the
// next scheduled tick rather than wedging the sweep forever.
const LOCK_TTL_SECONDS = 55;

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
  const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  if (!acquired) {
    logger.info('product-media-cleanup: skipped — another run is already in flight');
    return null;
  }
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
    await redis.del(LOCK_KEY);
  }
}

export function startProductMediaCleanupWorker(): Worker {
  return new Worker(
    PRODUCT_MEDIA_CLEANUP_QUEUE,
    async (_job: Job) => processProductMediaCleanupOnce(),
    { connection: getQueueConnection(), concurrency: 1 },
  );
}
