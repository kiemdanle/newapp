import type { FastifyInstance } from 'fastify';
import { reviewListQuerySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { reviewReadRateLimit } from './rate-limits.js';

export async function myReviewsRoute(app: FastifyInstance) {
  app.get(
    '/me/reviews',
    {
      onRequest: app.requireAuth,
      config: { rateLimit: reviewReadRateLimit },
    },
    async (req) => {
      const query = reviewListQuerySchema.parse(req.query);
      const prisma = getPrisma();
      const viewerId = req.user!.id;

      // Caller sees all their own reviews except soft-deleted ones, including hidden.
      const where = { userId: viewerId, status: { not: 'deleted' as const } };
      const cursor = query.cursor ? { id: query.cursor } : undefined;
      const items = await prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
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

      return {
        items: page.map((r) => toApiReview(r, { viewerId })),
        cursor: hasMore ? page[page.length - 1]!.id : null,
      };
    },
  );
}
