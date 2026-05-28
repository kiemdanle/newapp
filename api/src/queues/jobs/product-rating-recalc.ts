// api/src/queues/jobs/product-rating-recalc.ts
import { Queue, Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../index.js';
import { getPrisma } from '../../db.js';

export const PRODUCT_RATING_RECALC_QUEUE = 'product-rating-recalc';

interface ProductRatingData {
  productId: string;
}

let _queue: Queue<ProductRatingData> | undefined;
export function getProductRatingQueue(): Queue<ProductRatingData> {
  if (!_queue) {
    _queue = new Queue<ProductRatingData>(PRODUCT_RATING_RECALC_QUEUE, {
      connection: getQueueConnection(),
    });
  }
  return _queue;
}

/**
 * Idempotent: collapse multiple updates for the same product within a short
 * window using a deterministic jobId.
 */
export async function enqueueProductRatingRecalc(
  productId: string,
): Promise<void> {
  await getProductRatingQueue().add(
    PRODUCT_RATING_RECALC_QUEUE,
    { productId },
    {
      // BullMQ 5 disallows ':' in custom job IDs.
      jobId: `product-rating-recalc-${productId}`,
      removeOnComplete: 1000,
      removeOnFail: 100,
    },
  );
}

export async function processProductRatingRecalc(
  job: Job<ProductRatingData>,
): Promise<void> {
  const { productId } = job.data;
  const prisma = getPrisma();
  const agg = await prisma.review.aggregate({
    where: { productId, status: 'visible' },
    _avg: { tasteRating: true, valueRating: true },
    _count: { _all: true },
  });
  const reviewCount = agg._count._all;
  // numeric(3,2) in products.taste_avg / value_avg — keep two decimals.
  const tasteAvg = reviewCount > 0 ? Number(agg._avg.tasteRating ?? 0) : 0;
  const valueAvg = reviewCount > 0 ? Number(agg._avg.valueRating ?? 0) : 0;
  await prisma.product.update({
    where: { id: productId },
    data: {
      tasteAvg,
      valueAvg,
      reviewCount,
    },
  });
}

export function startProductRatingWorker(): Worker<ProductRatingData> {
  return new Worker<ProductRatingData>(
    PRODUCT_RATING_RECALC_QUEUE,
    processProductRatingRecalc,
    { connection: getQueueConnection(), concurrency: 2 },
  );
}
