import type { FastifyInstance } from 'fastify';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { recordCreateSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../queues/index.js';
import { maybeActivateReferral } from '../../services/referrals/referral-service.js';
import { assertMember, lockHouseholdRow } from '../../services/households/permissions.js';
import { lockUserPantryQuota, assertCanAddPantryItems } from '../../services/records/pantry-limits.js';
import { fanOutHouseholdRecordReminders } from '../../services/households/household-reminders.js';
import { assertProductUse } from '../../services/products/product-visibility.js';

export async function createRecordRoute(app: FastifyInstance) {
  app.post(
    '/',
    { onRequest: app.requireAuth, config: { idempotent: 'required' } },
    async (req, reply) => {
      const input = recordCreateSchema.parse(req.body);
      const userId = req.user!.id;
      const prisma = getPrisma();

      try {
        const { row, effectiveStatus, isReplay } = await prisma.$transaction(async (tx) => {
          // 1. Quota lock first
          await lockUserPantryQuota(tx, userId);

          // 2. Household lock second (if household)
          if (input.householdId) {
            await lockHouseholdRow(tx, input.householdId);
            await assertMember(input.householdId, userId, tx);
          }

          // 3. Check for existing clientId under lock (idempotent replay)
          const existing = await tx.record.findUnique({
            where: { clientId: input.clientId },
          });
          if (existing) {
            if (existing.userId === userId) {
              return { row: existing, effectiveStatus: existing.status, isReplay: true };
            }
            throw new AppError({
              status: 409,
              code: ERROR_CODES.CONFLICT,
              title: 'client_id already used by another user',
            });
          }

          if (input.productId) {
            await assertProductUse(
              userId,
              input.productId,
              {
                purpose: input.householdId ? 'household_record' : 'personal_record',
              },
              tx,
            );
          }

          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { notificationPreferences: true },
          });
          const offsets =
            input.notificationOffsetsDays ?? resolveOffsetsForUser(user?.notificationPreferences);

          const effectiveStatus = input.status ?? 'active';
          const notifyAt =
            effectiveStatus === 'active' ? computeNotifyAt(new Date(input.expiryDate), offsets) : [];

          // 4. Assert quota only for positive active additions
          if (effectiveStatus === 'active') {
            await assertCanAddPantryItems(userId, 1, tx);
          }

          const created = await tx.record.create({
            data: {
              userId,
              clientId: input.clientId,
              productId: input.productId ?? null,
              customName: input.customName ?? null,
              brand: input.brand ?? null,
              expiryDate: new Date(input.expiryDate),
              purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
              quantity: input.quantity,
              unit: input.unit,
              notes: input.notes ?? null,
              photoUrl: input.photoUrl ?? null,
              status: effectiveStatus,
              consumedAt:
                effectiveStatus === 'consumed'
                  ? input.consumedAt
                    ? new Date(input.consumedAt)
                    : new Date()
                  : null,
              discardedAt:
                effectiveStatus === 'discarded'
                  ? input.discardedAt
                    ? new Date(input.discardedAt)
                    : new Date()
                  : null,
              discardReason:
                effectiveStatus === 'discarded' ? input.discardReason ?? 'other' : null,
              notifyAt,
              householdId: input.householdId ?? null,
              location: input.location ? input.location.trim() : null,
            },
          });

          return { row: created, effectiveStatus, isReplay: false };
        });

        if (!isReplay && effectiveStatus === 'active') {
          await notificationScheduleQueue().add(
            'schedule',
            { recordId: row.id },
            { jobId: `schedule__${row.id}`, removeOnComplete: true, removeOnFail: 100 },
          );
        }

        if (!isReplay) {
          await maybeActivateReferral(userId).catch(() => {});
        }

        return reply.status(201).send(toApiRecord(row));
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await prisma.record.findUnique({
            where: { clientId: input.clientId },
          });
          if (existing && existing.userId === userId) {
            return reply.status(201).send(toApiRecord(existing));
          }
          throw new AppError({
            status: 409,
            code: ERROR_CODES.CONFLICT,
            title: 'client_id already used by another user',
          });
        }
        throw err;
      }
    },
  );
}
