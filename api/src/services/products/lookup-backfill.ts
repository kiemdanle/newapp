import { logger } from '../../logger.js';

/**
 * Slow-path backfill enqueuer for product lookup misses.
 *
 * The actual BullMQ queue lives on the records/queues track. To keep ownership
 * clean (this file is owned by the products track), the queue track injects an
 * enqueuer here at boot via `setLookupBackfillEnqueuer(...)`. Until that hook
 * fires the call is a no-op, so the products route stays deployable on its own
 * and the test suite doesn't need a queue running.
 */
export type LookupBackfillEnqueuer = (
  barcode: string,
  requestedByUserId: string,
) => Promise<void>;

let enqueuer: LookupBackfillEnqueuer | null = null;

export function setLookupBackfillEnqueuer(fn: LookupBackfillEnqueuer | null): void {
  enqueuer = fn;
}

export async function enqueueLookupBackfill(
  barcode: string,
  requestedByUserId: string,
): Promise<void> {
  if (!enqueuer) return;
  try {
    await enqueuer(barcode, requestedByUserId);
  } catch (err) {
    logger.warn({ err, barcode }, 'product-lookup backfill enqueue failed');
  }
}
