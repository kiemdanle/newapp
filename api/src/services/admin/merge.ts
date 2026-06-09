import { getPrisma } from '../../db.js';

export type MergeResult = {
  winnerId: string;
  movedRecords: number;
  movedReviews: number;
  newReviewCount: number;
  newRatingCount: number;
  newBuyAgainCount: number;
  newBuyAgainOnSaleCount: number;
  newWontBuyCount: number;
};

export async function mergeProducts(winnerId: string, loserIds: string[]): Promise<MergeResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const movedRec = await tx.record.updateMany({
      where: { productId: { in: loserIds } },
      data: { productId: winnerId },
    });

    const loserReviews = await tx.review.findMany({ where: { productId: { in: loserIds } } });
    const winnerUserIds = new Set(
      (await tx.review.findMany({ where: { productId: winnerId }, select: { userId: true } }))
        .map((r) => r.userId),
    );
    const toDelete = loserReviews.filter((r) => winnerUserIds.has(r.userId)).map((r) => r.id);
    if (toDelete.length) {
      await tx.review.deleteMany({ where: { id: { in: toDelete } } });
    }
    const movedRev = await tx.review.updateMany({
      where: {
        productId: { in: loserIds },
        ...(toDelete.length ? { id: { notIn: toDelete } } : {}),
      },
      data: { productId: winnerId },
    });

    const byRating = await tx.review.groupBy({
      by: ['rating'],
      where: { productId: winnerId, status: 'visible' },
      _count: { _all: true },
    });
    const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 };
    for (const row of byRating) tally[row.rating] = row._count._all;
    const newBuyAgainCount = tally.buy_again;
    const newBuyAgainOnSaleCount = tally.buy_again_on_sale;
    const newWontBuyCount = tally.wont_buy;
    const newRatingCount = newBuyAgainCount + newBuyAgainOnSaleCount + newWontBuyCount;
    const newReviewCount = await tx.review.count({
      where: { productId: winnerId, status: 'visible', body: { not: null } },
    });

    await tx.product.update({
      where: { id: winnerId },
      data: {
        reviewCount: newReviewCount,
        ratingCount: newRatingCount,
        buyAgainCount: newBuyAgainCount,
        buyAgainOnSaleCount: newBuyAgainOnSaleCount,
        wontBuyCount: newWontBuyCount,
      },
    });
    await tx.product.updateMany({
      where: { id: { in: loserIds } },
      data: { status: 'merged_into', mergedIntoProductId: winnerId },
    });

    return {
      winnerId,
      movedRecords: movedRec.count,
      movedReviews: movedRev.count,
      newReviewCount,
      newRatingCount,
      newBuyAgainCount,
      newBuyAgainOnSaleCount,
      newWontBuyCount,
    };
  });
}
