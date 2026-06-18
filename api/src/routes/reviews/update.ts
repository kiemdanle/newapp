import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, reviewPatchSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { containsProfanity } from '../../services/reviews/profanity.js';
import { enqueueModerationFlag } from '../../queues/jobs/moderation-flag.js';
import { enqueueProductRatingRecalc } from '../../queues/jobs/product-rating-recalc.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function updateReviewRoute(app: FastifyInstance) {
  app.patch(
    '/reviews/:id',
    { onRequest: app.requireAuth },
    async (req, reply) => {
      const { id } = paramsSchema.parse(req.params);
      const input = reviewPatchSchema.parse(req.body);
      const prisma = getPrisma();

      const existing = await prisma.review.findUnique({ where: { id } });
      if (!existing || existing.status === 'deleted') {
        throw new AppError({ status: 404, code: ERROR_CODES.REVIEW_NOT_FOUND, title: 'Review not found' });
      }
      if (existing.userId !== req.user!.id) {
        throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your review' });
      }

      const nextBody = input.body !== undefined ? (input.body ?? null) : existing.body;
      const hasProfanity = containsProfanity(nextBody).matched;
      const status = hasProfanity ? ('hidden' as const) : ('visible' as const);

      const updated = await prisma.review.update({
        where: { id },
        data: {
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.body !== undefined ? { body: input.body ?? null } : {}),
          status,
        },
        include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
      });

      if (hasProfanity && existing.status !== 'hidden') {
        await enqueueModerationFlag(updated.id);
      }
      // A changed rating shifts the product's aggregate tallies.
      if (input.rating !== undefined && input.rating !== existing.rating) {
        await enqueueProductRatingRecalc(existing.productId);
      }

      return reply.status(200).send(toApiReview(updated));
    },
  );

  app.delete(
    '/reviews/:id',
    { onRequest: app.requireAuth },
    async (req, reply) => {
      const { id } = paramsSchema.parse(req.params);
      const prisma = getPrisma();

      const existing = await prisma.review.findUnique({ where: { id } });
      if (!existing || existing.status === 'deleted') {
        throw new AppError({ status: 404, code: ERROR_CODES.REVIEW_NOT_FOUND, title: 'Review not found' });
      }
      if (existing.userId !== req.user!.id) {
        throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your review' });
      }

      await prisma.review.update({ where: { id }, data: { status: 'deleted' } });
      await enqueueProductRatingRecalc(existing.productId);

      return reply.status(204).send();
    },
  );
}
