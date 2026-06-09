import type { User } from '@prisma/client';
import type { Reputation } from '@pantry/shared';

export function toApiReputation(user: User): Reputation {
  return {
    userId: user.id,
    giverRatingAvg: user.giverRatingAvg !== null ? Number(user.giverRatingAvg) : null,
    recipientRatingAvg: user.recipientRatingAvg !== null ? Number(user.recipientRatingAvg) : null,
    transactionCount: user.transactionCount,
  };
}
