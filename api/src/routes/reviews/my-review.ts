import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../../db.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { reviewReadRateLimit } from './rate-limits.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function myReviewRoute(app: FastifyInstance) {
  app.get(
    '/products/:id/my-review',
    {
      onRequest: app.requireAuth,
      config: { rateLimit: reviewReadRateLimit },
    },
    async (req) => {
      const { id: productId } = paramsSchema.parse(req.params);
      const prisma = getPrisma();
      const viewerId = req.user!.id;

      const review = await prisma.review.findUnique({
        where: {
          userId_productId: {
            userId: viewerId,
            productId,
          },
        },
        include: {
          user: { select: { firstName: true, avatarUrl: true } },
          product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        },
      });

      if (!review || review.status === 'deleted') {
        return { review: null };
      }

      return {
        review: toApiReview(review, { viewerId }),
      };
    },
  );
}
