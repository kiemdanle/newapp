import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { transactionRatingCreateSchema, transactionRatingSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { inferRaterRole } from '../../services/giveaways/ratings.js';
import { recomputeReputation } from '../../services/reputation/recompute.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function ratingsRoute(app: FastifyInstance) {
  app.post(
    '/giveaways/:id/ratings',
    { onRequest: [app.requireAuth], config: { idempotent: 'required', rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const { id: giveawayId } = paramsSchema.parse(req.params);
      const input = transactionRatingCreateSchema.parse(req.body);
      const prisma = getPrisma();
      const userId = req.user!.id;

      const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { claims: true } });
      if (!giveaway) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
      if (giveaway.status !== 'completed') throw new AppError({ status: 409, code: ERROR_CODES.RATING_NOT_READY, title: 'Giveaway not completed yet' });
      const selectedClaim = giveaway.claims.find((c) => c.status === 'selected');
      const parties = {
        giverUserId: giveaway.giverUserId,
        selectedRecipientId: selectedClaim?.claimerUserId ?? null,
      };
      const raterInfo = inferRaterRole(parties, userId);
      if (!raterInfo) throw new AppError({ status: 403, code: ERROR_CODES.RATING_NOT_ALLOWED, title: 'Not a party to this transaction' });

      try {
        const rating = await prisma.$transaction(async (tx) => {
          const r = await tx.transactionRating.create({
            data: {
              giveawayId,
              raterUserId: userId,
              rateeUserId: raterInfo.rateeUserId,
              raterRole: raterInfo.role,
              stars: input.stars,
              comment: input.comment ?? null,
            },
          });
          await recomputeReputation(tx, raterInfo.rateeUserId);
          // Check if both parties have rated — reveal both if so
          const allRatings = await tx.transactionRating.findMany({ where: { giveawayId } });
          if (allRatings.length === 2) {
            await tx.transactionRating.updateMany({
              where: { giveawayId, revealedAt: null },
              data: { revealedAt: new Date() },
            });
          }
          return r;
        });
        return reply.status(201).send(transactionRatingSchema.parse({
          id: rating.id,
          giveawayId: rating.giveawayId,
          raterUserId: rating.raterUserId,
          rateeUserId: rating.rateeUserId,
          raterRole: rating.raterRole,
          stars: rating.stars,
          comment: rating.comment,
          createdAt: rating.createdAt.toISOString(),
        }));
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError({ status: 409, code: ERROR_CODES.RATING_ALREADY_EXISTS, title: 'Already rated' });
        }
        throw err;
      }
    },
  );
}
