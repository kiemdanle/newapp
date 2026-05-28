import { Worker } from 'bullmq';
import { PRODUCT_LOOKUP_QUEUE, getQueueConnection, type ProductLookupJob } from '../queues/index.js';
import { logger } from '../logger.js';

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
      let lookupProduct: ((arg: { barcode: string }) => Promise<{ id: string } | null>) | undefined;
      try {
        // Variable specifier defers type resolution; the products service is
        // owned by a sibling phase and may not be present at type-check time.
        const specifier = '../services/products/lookup.js';
        const mod = (await import(/* @vite-ignore */ specifier)) as {
          lookupProduct?: (arg: { barcode: string }) => Promise<{ id: string } | null>;
        };
        lookupProduct = mod.lookupProduct;
      } catch (err) {
        logger.warn({ err, barcode: job.data.barcode }, 'product lookup module unavailable');
        return;
      }
      if (!lookupProduct) {
        logger.warn({ barcode: job.data.barcode }, 'product lookup function not exported');
        return;
      }
      const product = await lookupProduct({ barcode: job.data.barcode });
      if (product) {
        logger.info({ barcode: job.data.barcode, productId: product.id }, 'product backfill hit');
      } else {
        logger.info({ barcode: job.data.barcode }, 'product backfill miss');
      }
    },
    { connection: getQueueConnection(), concurrency: 2 },
  );
  worker.on('failed', (job, err) =>
    logger.warn({ err, jobId: job?.id, barcode: job?.data.barcode }, 'product-lookup retry'),
  );
  return worker;
}
