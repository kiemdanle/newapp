import { logger } from '../../logger.js';

/**
 * Enqueue a slow background backfill for a barcode that missed the synchronous
 * lookup path (local cache → OFF → UPCitemdb). The actual BullMQ queue is wired
 * up by the records/queues track; until that lands this is a no-op so the route
 * stays deployable on its own. The records-track wiring replaces this body with
 * a `productLookupQueue().add(...)` call that dedupes on `lookup:{barcode}`.
 */
export async function enqueueLookupBackfill(barcode: string, requestedByUserId: string): Promise<void> {
  // Lazy-load the queue module so this file doesn't take a hard dependency on
  // the records track. When `api/src/queues/index.ts` lands and exports
  // `productLookupQueue`, this branch activates automatically.
  try {
    const mod = (await import('../../queues/index.js').catch(() => null)) as
      | { productLookupQueue?: () => { add: (name: string, data: unknown, opts?: unknown) => Promise<unknown> } }
      | null;
    if (mod?.productLookupQueue) {
      await mod.productLookupQueue().add(
        'backfill',
        { barcode, requestedByUserId },
        { jobId: `lookup:${barcode}`, removeOnComplete: true, removeOnFail: 100 },
      );
    }
  } catch (err) {
    logger.warn({ err, barcode }, 'product-lookup backfill enqueue skipped');
  }
}
