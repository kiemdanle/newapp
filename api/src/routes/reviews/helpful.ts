import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, reviewHelpfulSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { recomputeReviewScore } from '../../services/reviews/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const voteRateLimit = { max: 30, timeWindow: '1 minute' } as const;

export async function reviewHelpfulRoutes(app: FastifyInstance) {
  app.post(
    '/reviews/:id/helpful',
    { onRequest: [app.requireAuth], config: { rateLimit: voteRateLimit } },
    async (req, reply) => {
      const { id: reviewId } = paramsSchema.parse(req.params);
      const { helpful } = reviewHelpfulSchema.parse(req.body);
      const prisma = getPrisma();

      const review = await prisma.review.findUnique({ where: { id: reviewId } });
      if (!review || review.status === 'deleted') {
        throw new AppError({ status: 404, code: ERROR_CODES.REVIEW_NOT_FOUND, title: 'Review not found' });
      }
      // Helpfulness voting only applies to reviews that carry a comment.
      if (review.body === null) {
        throw new AppError({
          status: 422,
          code: ERROR_CODES.REVIEW_HAS_NO_COMMENT,
          title: 'Review has no comment to vote on',
        });
      }

      const value = helpful ? 'helpful' : 'not_helpful';
      await prisma.$transaction(async (tx) => {
        await tx.reviewVote.upsert({
          where: { userId_reviewId: { userId: req.user!.id, reviewId } },
          create: { userId: req.user!.id, reviewId, value },
          update: { value },
        });
        await recomputeReviewScore(tx, reviewId);
      });
      return reply.status(204).send();
    },
  );

  app.delete(
    '/reviews/:id/helpful',
    { onRequest: [app.requireAuth], config: { rateLimit: voteRateLimit } },
    async (req, reply) => {
      const { id: reviewId } = paramsSchema.parse(req.params);
      const prisma = getPrisma();
      await prisma.$transaction(async (tx) => {
        await tx.reviewVote.deleteMany({ where: { userId: req.user!.id, reviewId } });
        await recomputeReviewScore(tx, reviewId);
      });
      return reply.status(204).send();
    },
  );
}
