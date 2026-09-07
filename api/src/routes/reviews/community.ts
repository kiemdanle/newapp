import type { FastifyInstance } from 'fastify';
import { reviewListQuerySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { reviewReadRateLimit } from './rate-limits.js';

export async function communityReviewsRoute(app: FastifyInstance) {
  app.get(
    '/reviews/community',
    {
      onRequest: app.optionalAuth,
      config: { rateLimit: reviewReadRateLimit },
    },
    async (req) => {
      const query = reviewListQuerySchema.parse(req.query);
      const prisma = getPrisma();
      const viewerId = req.user?.id ?? null;

      const where = {
        status: 'visible' as const,
        body: { not: null },
        product: { status: 'active' as const },
      };

      const orderBy =
        query.sort === 'new'
          ? [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
          : [{ score: 'desc' as const }, { id: 'desc' as const }];

      const cursor = query.cursor ? { id: query.cursor } : undefined;
      const items = await prisma.review.findMany({
        where,
        orderBy,
        take: query.limit + 1,
        skip: cursor ? 1 : 0,
        ...(cursor ? { cursor } : {}),
        include: {
          user: { select: { firstName: true, avatarUrl: true } },
          product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        },
      });

      const hasMore = items.length > query.limit;
      const page = hasMore ? items.slice(0, query.limit) : items;

      let myVotes = new Map<string, 'helpful' | 'not_helpful'>();
      if (viewerId && page.length > 0) {
        const votes = await prisma.reviewVote.findMany({
          where: { userId: viewerId, reviewId: { in: page.map((r) => r.id) } },
        });
        myVotes = new Map(votes.map((v) => [v.reviewId, v.value as 'helpful' | 'not_helpful']));
      }

      return {
        items: page.map((r) =>
          toApiReview(r, {
            viewerId,
            myVote: myVotes.get(r.id) ?? null,
          }),
        ),
        cursor: hasMore ? page[page.length - 1]!.id : null,
      };
    },
  );
}
