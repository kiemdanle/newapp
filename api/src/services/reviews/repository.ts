import type { Review, User } from '@prisma/client';
import type { Review as ApiReview } from '@pantry/shared';

type ReviewWithAuthor = Review & {
  user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
};

export function toApiReview(
  r: ReviewWithAuthor,
  opts: { myVote?: -1 | 1 | null } = {},
): ApiReview {
  const out: ApiReview = {
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    tasteRating: r.tasteRating,
    valueRating: r.valueRating,
    body: r.body,
    upvoteCount: r.upvoteCount,
    downvoteCount: r.downvoteCount,
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
