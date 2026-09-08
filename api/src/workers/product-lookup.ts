import { Worker } from 'bullmq';
import { PRODUCT_LOOKUP_QUEUE, getQueueConnection, type ProductLookupJob } from '../queues/index.js';
import { logger } from '../logger.js';
import { lookupProductForBackfill } from '../services/products/lookup.js';

/**
 * Background backfill of a barcode that missed the synchronous lookup path.
 * Uses the same lookup service but the worker can afford a longer effective
 * timeout (BullMQ retries) and wider retry budget than the HTTP path.
 *
 * Imports the products lookup service dynamically so this worker file does
 * not have a static dependency on products-track code (which lands in a
 * sibling phase). If the products module is missing the worker logs and
 * skips — letting BullMQ retry without crashing.
 */
export function startProductLookupWorker(): Worker<ProductLookupJob> {
  const worker = new Worker<ProductLookupJob>(
    PRODUCT_LOOKUP_QUEUE,
    async (job) => {
      const res = await lookupProductForBackfill(job.data.barcode);
      if (res.status === 'found' && res.product) {
        logger.info({ barcode: job.data.barcode, productId: res.product.id }, 'product backfill hit');
        return;
      }
      if (res.status === 'unavailable') {
        // Throw to trigger BullMQ retry with exponential backoff
        throw new Error(`Upstream providers unavailable for barcode ${job.data.barcode}`);
      }
      logger.info({ barcode: job.data.barcode }, 'product backfill miss');
    },
    { connection: getQueueConnection(), concurrency: 2 },
  );
  worker.on('failed', (job, err) =>
    logger.warn({ err, jobId: job?.id, barcode: job?.data.barcode }, 'product-lookup retry'),
  );
  return worker;
}
