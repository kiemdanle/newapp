import type { Prisma } from '@prisma/client';

/**
 * Locks the Product row FIRST inside the transaction to enforce strict lock ordering
 * and prevent deadlocks/races during concurrent review mutations.
 */
export async function lockProductForReviewMutation(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
}

/**
 * Recomputes three-option tallies from visible reviews and writes them synchronously
 * to the Product row in the same transaction.
 */
export async function recomputeAndSyncProductTallies(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const visibleReviews = await tx.review.aggregate({
    where: { productId, status: 'visible' },
    _avg: { stars: true },
    _count: { _all: true },
  });

  const ratingCount = visibleReviews._count._all;
  const rawAvg = visibleReviews._avg.stars ?? 0;
  const averageRating = Number(rawAvg.toFixed(2));

  const byRating = await tx.review.groupBy({
    by: ['rating'],
    where: { productId, status: 'visible', rating: { not: null } },
    _count: { _all: true },
  });
  const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 };
  for (const row of byRating) {
    if (row.rating && row.rating in tally) {
      tally[row.rating as keyof typeof tally] = row._count._all;
    }
  }
  const reviewCount = await tx.review.count({
    where: { productId, status: 'visible', body: { not: null } },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      averageRating,
      buyAgainCount: tally.buy_again,
      buyAgainOnSaleCount: tally.buy_again_on_sale,
      wontBuyCount: tally.wont_buy,
      ratingCount,
      reviewCount,
    },
  });
}
