import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { selectClaimSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';
import { outboxSelected, outboxRejected } from '../../notifications/giveaway-templates.js';
import { sweepOutbox } from '../../services/notifications/outbox.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function selectClaimRoute(app: FastifyInstance) {
  app.post(
    '/giveaways/:id/select',
    { onRequest: [app.requireAuth], config: { idempotent: 'required' } },
    async (req) => {
      const { id: giveawayId } = paramsSchema.parse(req.params);
      const { claimId } = selectClaimSchema.parse(req.body);
      const prisma = getPrisma();
      const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { claims: true } });
      if (!giveaway) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
      if (giveaway.giverUserId !== req.user!.id) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Only the giver can select' });
      if (giveaway.status !== 'open') throw new AppError({ status: 409, code: ERROR_CODES.GIVEAWAY_NOT_OPEN, title: 'Giveaway is not open' });
      const selectedClaim = giveaway.claims.find((c) => c.id === claimId);
      if (!selectedClaim) throw new AppError({ status: 404, code: ERROR_CODES.CLAIM_NOT_FOUND, title: 'Claim not found' });

      const updated = await prisma.$transaction(async (tx) => {
        await tx.giveawayClaim.update({ where: { id: claimId }, data: { status: 'selected' } });
        const rejected = giveaway.claims.filter((c) => c.id !== claimId);
        if (rejected.length) {
          await tx.giveawayClaim.updateMany({
            where: { id: { in: rejected.map((c) => c.id) } },
            data: { status: 'rejected' },
          });
        }
        const result = await tx.giveaway.update({
          where: { id: giveawayId },
          data: { status: 'claimed', claimExpiresAt: new Date(Date.now() + 48 * 3600 * 1000) },
          include: {
            giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
            claims: true,
            _count: { select: { claims: true } },
          },
        });
        await outboxSelected(tx, selectedClaim.claimerUserId, giveawayId);
        for (const c of rejected) await outboxRejected(tx, c.claimerUserId, giveawayId);
        return result;
      });

      sweepOutbox().catch(() => {});
      return toApiGiveaway(updated, { myClaim: null });
    },
  );
}
