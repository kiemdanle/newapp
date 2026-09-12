import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { reviewCreateSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { containsProfanity } from '../../services/reviews/profanity.js';
import { enqueueModerationFlag } from '../../queues/jobs/moderation-flag.js';
import {
  lockProductForReviewMutation,
  recomputeAndSyncProductTallies,
} from '../../services/reviews/product-tallies.js';
import { assertProductUse } from '../../services/products/product-visibility.js';
import { reviewWriteRateLimit } from './rate-limits.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function createReviewRoute(app: FastifyInstance) {
  app.post(
    '/products/:id/reviews',
    {
      onRequest: app.requireAuth,
      config: { idempotent: 'required', rateLimit: reviewWriteRateLimit },
    },
    async (req, reply) => {
      const { id: productId } = paramsSchema.parse(req.params);
      const input = reviewCreateSchema.parse(req.body);
      const userId = req.user!.id;
      const prisma = getPrisma();

      await assertProductUse(userId, productId, { purpose: 'review' });

      const hasProfanity = containsProfanity(input.body ?? null).matched;
      const status = hasProfanity ? ('hidden' as const) : ('visible' as const);

      let review;
      try {
        review = await prisma.$transaction(async (tx) => {
          await lockProductForReviewMutation(tx, productId);
          const created = await tx.review.create({
            data: {
              userId,
              productId,
              stars: input.stars,
              rating: input.rating,
              body: input.body ?? null,
              status,
            },
            include: { user: { select: { firstName: true, avatarUrl: true } } },
          });
          await recomputeAndSyncProductTallies(tx, productId);
          return created;
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
            title: 'You have already reviewed this product',
          });
        }
        throw err;
      }

      if (hasProfanity) {
        await enqueueModerationFlag(review.id);
      }

      return reply.status(201).send(toApiReview(review, { viewerId: userId }));
    },
  );
}
