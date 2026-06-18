import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';
import { outboxCompleted } from '../../notifications/giveaway-templates.js';
import { sweepOutbox } from '../../services/notifications/outbox.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function confirmReceivedRoute(app: FastifyInstance) {
  app.post(
    '/giveaways/:id/confirm-received',
    { onRequest: [app.requireAuth], config: { idempotent: 'required' } },
    async (req) => {
      const { id: giveawayId } = paramsSchema.parse(req.params);
      const prisma = getPrisma();
      const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { claims: true } });
      if (!giveaway) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
      const selectedClaim = giveaway.claims.find((c) => c.status === 'selected');
      if (!selectedClaim) throw new AppError({ status: 409, code: ERROR_CODES.CLAIM_NOT_FOUND, title: 'No selected claim' });
      if (selectedClaim.claimerUserId !== req.user!.id) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Only the recipient can confirm' });
      if (giveaway.status !== 'handed_off') throw new AppError({ status: 409, code: ERROR_CODES.CONFIRM_NOT_ALLOWED, title: 'Can only confirm a handed-off giveaway' });

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.giveaway.update({
          where: { id: giveawayId },
          data: { status: 'completed', confirmedAt: new Date(), completedAt: new Date() },
          include: {
            giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
            claims: true,
            _count: { select: { claims: true } },
          },
        });
        await outboxCompleted(tx, giveaway.giverUserId, selectedClaim.claimerUserId, giveawayId);
        return result;
      });

      sweepOutbox().catch(() => {});
      return toApiGiveaway(updated, { myClaim: null });
    },
  );
}
