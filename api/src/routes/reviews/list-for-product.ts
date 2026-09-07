import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, reviewListQuerySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReview } from '../../services/reviews/repository.js';
import {
  getVisibleProduct,
  resolveCanonicalProduct,
  PRODUCT_INCLUDE,
} from '../../services/products/product-visibility.js';
import { reviewReadRateLimit } from './rate-limits.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function listForProductRoute(app: FastifyInstance) {
  app.get(
    '/products/:id/reviews',
    {
      onRequest: app.optionalAuth,
      config: { rateLimit: reviewReadRateLimit },
    },
    async (req) => {
      const { id: productId } = paramsSchema.parse(req.params);
      const query = reviewListQuerySchema.parse(req.query);
      const prisma = getPrisma();
      const viewerId = req.user?.id ?? null;

      // Product Visibility Gating
      if (req.user) {
        const product = await getVisibleProduct(
          { id: req.user.id, role: req.user.role },
          productId,
        );
        if (!product) {
          throw new AppError({
            status: 404,
            code: ERROR_CODES.NOT_FOUND,
            title: 'Product not found',
          });
        }
      } else {
        const raw = await prisma.product.findUnique({
          where: { id: productId },
          include: PRODUCT_INCLUDE,
        });
        if (!raw) {
          throw new AppError({
            status: 404,
            code: ERROR_CODES.NOT_FOUND,
            title: 'Product not found',
          });
        }
        const canonical = await resolveCanonicalProduct(raw, prisma);
        if (canonical.status !== 'active') {
          throw new AppError({
            status: 404,
            code: ERROR_CODES.NOT_FOUND,
            title: 'Product not found',
          });
        }
      }

      const where = viewerId
        ? { productId, OR: [{ status: 'visible' as const }, { userId: viewerId }] }
        : { productId, status: 'visible' as const };

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
        include: { user: { select: { firstName: true, avatarUrl: true } } },
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
