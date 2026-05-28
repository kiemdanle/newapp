import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reviewListQuerySchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { toApiReview } from '../../services/reviews/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function listForProductRoute(app: FastifyInstance) {
  app.get('/products/:id/reviews', async (req) => {
    const { id: productId } = paramsSchema.parse(req.params);
    const query = reviewListQuerySchema.parse(req.query);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;

    const where = viewerId
      ? {
          productId,
          OR: [{ status: 'visible' as const }, { userId: viewerId }],
        }
      : { productId, status: 'visible' as const };

    // "rating" ranks by avg of taste+value. Postgres can't sort that through Prisma's
    // typed orderBy; for "rating" we still paginate in DB by createdAt and reorder
    // in-memory after fetching. "score" (Wilson) and "new" stay DB-sorted.
    const orderBy =
      query.sort === 'new'
        ? [{ createdAt: 'desc' as const }]
        : query.sort === 'rating'
          ? [{ createdAt: 'desc' as const }]
          : [{ score: 'desc' as const }, { createdAt: 'desc' as const }];

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    let items = await prisma.review.findMany({
      where,
      orderBy,
      take: query.limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
    });

    if (query.sort === 'rating') {
      items = items.sort(
        (a, b) =>
          (b.tasteRating + b.valueRating) / 2 - (a.tasteRating + a.valueRating) / 2,
      );
    }
    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;

    let myVotes = new Map<string, -1 | 1>();
    if (viewerId && page.length > 0) {
      const votes = await prisma.reviewVote.findMany({
        where: { userId: viewerId, reviewId: { in: page.map((r) => r.id) } },
      });
      myVotes = new Map(votes.map((v) => [v.reviewId, v.value as -1 | 1]));
    }

    return {
      items: page.map((r) => toApiReview(r, { myVote: myVotes.get(r.id) ?? null })),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  });
}
