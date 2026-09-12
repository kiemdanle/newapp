import type { Review, User, Product, Prisma, PrismaClient } from '@prisma/client';
import type { Review as ApiReview } from '@expyrico/shared';
import { wilsonLowerBound } from './wilson.js';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Recomputes a review's denormalized helpful tallies + Wilson score from its
 * votes. Locks the review row first via SELECT FOR UPDATE to serialize concurrent
 * vote recalculations and prevent stale snapshot overwrites.
 */
export async function recomputeReviewScore(db: Db, reviewId: string): Promise<void> {
  // Lock review row first to serialize concurrent vote recalculations
  await db.$executeRaw`SELECT id FROM reviews WHERE id = ${reviewId}::uuid FOR UPDATE`;

  const agg = await db.reviewVote.groupBy({
    by: ['value'],
    where: { reviewId },
    _count: { _all: true },
  });
  let helpful = 0;
  let notHelpful = 0;
  for (const row of agg) {
    if (row.value === 'helpful') helpful = row._count._all;
    else if (row.value === 'not_helpful') notHelpful = row._count._all;
  }
  await db.review.update({
    where: { id: reviewId },
    data: {
      helpfulCount: helpful,
      notHelpfulCount: notHelpful,
      score: wilsonLowerBound(helpful, notHelpful),
    },
  });
}

type ReviewWithRelations = Review & {
  user?: Pick<User, 'firstName' | 'avatarUrl'> | null;
  product?: Pick<Product, 'id' | 'name' | 'brand' | 'imageUrl'> | null;
};

export function toApiReview(
  r: ReviewWithRelations,
  opts: { viewerId?: string | null; myVote?: 'helpful' | 'not_helpful' | null } = {},
): ApiReview {
  const out: ApiReview = {
    id: r.id,
    productId: r.productId,
    stars: r.stars,
    rating: r.rating ?? (r.stars >= 4 ? 'buy_again' : r.stars === 3 ? 'buy_again_on_sale' : 'wont_buy'),
    body: r.body,
    helpfulCount: r.helpfulCount,
    notHelpfulCount: r.notHelpfulCount,
    score: Number(r.score),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    isOwnReview: Boolean(opts.viewerId && r.userId === opts.viewerId),
    myVote: opts.myVote ?? null,
  };
  if (r.user) {
    out.author = {
      firstName: r.user.firstName,
      avatarUrl: r.user.avatarUrl,
    };
  }
  if (r.product) {
    out.product = {
      id: r.product.id,
      name: r.product.name,
      brand: r.product.brand ?? null,
      imageUrl: r.product.imageUrl ?? null,
    };
  }
  return out;
}
