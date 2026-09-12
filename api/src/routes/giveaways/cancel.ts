import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, type GiveawayStatus } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertTransition } from '../../services/giveaways/state-machine.js';
import { lockHouseholdRow } from '../../services/households/permissions.js';
import { lockUserPantryQuota, assertCanAddPantryItems } from '../../services/records/pantry-limits.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function cancelGiveawayRoute(app: FastifyInstance) {
  app.post('/giveaways/:id/cancel', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const actorId = req.user!.id;
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Giveaway row lock first (serializes concurrent cancellations)
      const [lockedGiveaway] = await tx.$queryRaw<
        Array<{ id: string; giverUserId: string; status: GiveawayStatus; recordId: string | null; quantity: number }>
      >`
        SELECT id, giver_user_id AS "giverUserId", status, record_id AS "recordId", quantity::float
        FROM giveaways WHERE id = ${id}::uuid FOR UPDATE
      `;
      if (!lockedGiveaway) {
        throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
      }
      if (lockedGiveaway.giverUserId !== actorId) {
        throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your giveaway' });
      }
      assertTransition(lockedGiveaway.status, 'cancelled');

      if (lockedGiveaway.status === 'claimed' && lockedGiveaway.recordId) {
        // 2. Discover linked record ownership
        const [linkedRecordMeta] = await tx.$queryRaw<
          Array<{ id: string; userId: string; householdId: string | null }>
        >`
          SELECT id, user_id AS "userId", household_id AS "householdId"
          FROM records WHERE id = ${lockedGiveaway.recordId}::uuid
        `;

        if (linkedRecordMeta) {
          // 3. Acquire owner quota & household lock unconditionally before record row lock
          await lockUserPantryQuota(tx, linkedRecordMeta.userId);
          if (linkedRecordMeta.householdId) {
            await lockHouseholdRow(tx, linkedRecordMeta.householdId);
          }

          // 4. Record row lock last & in-lock transition classification
          const [freshRecord] = await tx.$queryRaw<
            Array<{ id: string; quantity: number; status: string }>
          >`
            SELECT id, quantity::float, status FROM records WHERE id = ${lockedGiveaway.recordId}::uuid FOR UPDATE
          `;

          if (freshRecord) {
            const restoreQty = lockedGiveaway.quantity || 1;
            if (freshRecord.status === 'consumed' && freshRecord.quantity === 0) {
              // Positive active transition (+1 active item): enforce quota against owner
              await assertCanAddPantryItems(linkedRecordMeta.userId, 1, tx);
              await tx.record.update({
                where: { id: freshRecord.id },
                data: {
                  quantity: restoreQty,
                  status: 'active',
                  consumedAt: null,
                },
              });
            } else if (freshRecord.status === 'active') {
              // Already active item (+0 active items): increment quantity
              await tx.record.update({
                where: { id: freshRecord.id },
                data: {
                  quantity: freshRecord.quantity + restoreQty,
                },
              });
            }
          }
        }
      }

      return tx.giveaway.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
          claims: true,
          _count: { select: { claims: true } },
        },
      });
    });
    return toApiGiveaway(updated, { myClaim: null });
  });
}
