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
  // Recompute three-option tallies from visible reviews.
  const byRating = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId, status: 'visible' },
    _count: { _all: true },
  });
  const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 };
  for (const row of byRating) tally[row.rating] = row._count._all;
  const ratingCount = tally.buy_again + tally.buy_again_on_sale + tally.wont_buy;
  const reviewCount = await prisma.review.count({
    where: { productId, status: 'visible', body: { not: null } },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      buyAgainCount: tally.buy_again,
      buyAgainOnSaleCount: tally.buy_again_on_sale,
      wontBuyCount: tally.wont_buy,
      ratingCount,
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
