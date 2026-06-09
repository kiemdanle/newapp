import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { reviewCreateSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { containsProfanity } from '../../services/reviews/profanity.js';
import { enqueueModerationFlag } from '../../queues/jobs/moderation-flag.js';
import { enqueueProductRatingRecalc } from '../../queues/jobs/product-rating-recalc.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function createReviewRoute(app: FastifyInstance) {
  app.post(
    '/products/:id/reviews',
    { onRequest: app.requireAuth },
    async (req, reply) => {
      const { id: productId } = paramsSchema.parse(req.params);
      const input = reviewCreateSchema.parse(req.body);
      const userId = req.user!.id;
      const prisma = getPrisma();

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
      }

      const hasProfanity = containsProfanity(input.body ?? null).matched;
      const status = hasProfanity ? ('hidden' as const) : ('visible' as const);

      let review;
      try {
        review = await prisma.review.create({
          data: {
            userId,
            productId,
            rating: input.rating,
            body: input.body ?? null,
            status,
          },
          include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
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

      await enqueueProductRatingRecalc(productId);

      return reply.status(201).send(toApiReview(review));
    },
  );
}
