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
      const actorId = req.user!.id;

      const updated = await prisma.$transaction(async (tx) => {
        const giveaway = await tx.giveaway.findUnique({ where: { id: giveawayId } });
        if (!giveaway) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
        if (giveaway.giverUserId !== actorId) throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Only the giver can select' });
        if (giveaway.status !== 'open') {
          throw new AppError({ status: 409, code: ERROR_CODES.GIVEAWAY_NOT_OPEN, title: 'Giveaway is not open' });
        }

        const selectedClaim = await tx.giveawayClaim.findFirst({
          where: { id: claimId, giveawayId, status: 'requested' },
        });
        if (!selectedClaim) {
          throw new AppError({ status: 404, code: ERROR_CODES.CLAIM_NOT_FOUND, title: 'Claim not found' });
        }

        const claimed = await tx.giveaway.updateMany({
          where: { id: giveawayId, giverUserId: actorId, status: 'open' },
          data: { status: 'claimed', claimExpiresAt: new Date(Date.now() + 48 * 3600 * 1000) },
        });
        if (claimed.count === 0) {
          throw new AppError({ status: 409, code: ERROR_CODES.GIVEAWAY_NOT_OPEN, title: 'Giveaway is not open' });
        }

        const selected = await tx.giveawayClaim.updateMany({
          where: { id: claimId, giveawayId, status: 'requested' },
          data: { status: 'selected' },
        });
        if (selected.count === 0) {
          throw new AppError({ status: 409, code: ERROR_CODES.CLAIM_NOT_FOUND, title: 'Claim is no longer available' });
        }

        if (giveaway.recordId) {
          const [lockedRecord] = await tx.$queryRaw<Array<{ id: string; quantity: number; status: string }>>`
            SELECT id, quantity::float, status FROM records WHERE id = ${giveaway.recordId}::uuid FOR UPDATE
          `;

          if (lockedRecord && lockedRecord.status === 'active') {
            const currentQty = lockedRecord.quantity;
            const deductQty = giveaway.quantity || 1;
            const remaining = currentQty - deductQty;

            if (remaining > 0) {
              await tx.record.update({
                where: { id: lockedRecord.id },
                data: { quantity: remaining },
              });
            } else {
              await tx.record.update({
                where: { id: lockedRecord.id },
                data: {
                  quantity: 0,
                  status: 'consumed',
                  consumedAt: new Date(),
                },
              });
            }
          }
        }

        const rejected = await tx.giveawayClaim.findMany({
          where: { giveawayId, id: { not: claimId }, status: 'requested' },
          select: { claimerUserId: true },
        });
        await tx.giveawayClaim.updateMany({
          where: { giveawayId, id: { not: claimId }, status: 'requested' },
          data: { status: 'rejected' },
        });
        const result = await tx.giveaway.findUniqueOrThrow({
          where: { id: giveawayId },
          include: {
            giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
            claims: true,
            _count: { select: { claims: true } },
          },
        });
        await outboxSelected(tx, selectedClaim.claimerUserId, giveawayId);
        for (const claim of rejected) await outboxRejected(tx, claim.claimerUserId, giveawayId);
        return result;
      });

      sweepOutbox().catch(() => {});
      return toApiGiveaway(updated, { myClaim: null });
    },
  );
}
