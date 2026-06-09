import type { Review, User, Prisma, PrismaClient } from '@prisma/client';
import type { Review as ApiReview } from '@pantry/shared';
import { wilsonLowerBound } from './wilson.js';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Recomputes a review's denormalized helpful tallies + Wilson score from its
 * votes. The score ranks by helpfulness (helpful vs not-helpful), independent
 * of the product rating aggregate.
 */
export async function recomputeReviewScore(db: Db, reviewId: string): Promise<void> {
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

type ReviewWithAuthor = Review & {
  user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
};

export function toApiReview(
  r: ReviewWithAuthor,
  opts: { myVote?: 'helpful' | 'not_helpful' | null } = {},
): ApiReview {
  const out: ApiReview = {
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    rating: r.rating,
    body: r.body,
    helpfulCount: r.helpfulCount,
    notHelpfulCount: r.notHelpfulCount,
    score: Number(r.score),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    myVote: opts.myVote ?? null,
  };
  if (r.user) {
    out.author = {
      id: r.user.id,
      firstName: r.user.firstName,
      avatarUrl: r.user.avatarUrl,
    };
  }
  return out;
}
