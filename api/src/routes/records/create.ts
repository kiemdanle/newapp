import type { FastifyInstance } from 'fastify';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { recordCreateSchema, ERROR_CODES, ITEM_LIMIT } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../queues/index.js';
import { maybeActivateReferral } from '../../services/referrals/referral-service.js';
import { assertMember } from '../../services/households/permissions.js';
import { fanOutHouseholdRecordReminders } from '../../services/households/household-reminders.js';

export async function createRecordRoute(app: FastifyInstance) {
  app.post(
    '/',
    { onRequest: app.requireAuth, config: { idempotent: 'required' } },
    async (req, reply) => {
      const input = recordCreateSchema.parse(req.body);
      const userId = req.user!.id;
      const prisma = getPrisma();

      // If householdId is set, verify membership BEFORE inserting.
      if (input.householdId) {
        await assertMember(input.householdId, userId);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      const offsets =
        input.notificationOffsetsDays ?? resolveOffsetsForUser(user?.notificationPreferences);
      const notifyAt = computeNotifyAt(new Date(input.expiryDate), offsets);

      // Active-record cap: free accounts are limited to ITEM_LIMIT active items.
      const activeCount = await prisma.record.count({
        where: { userId, status: 'active' },
      });
      if (activeCount >= ITEM_LIMIT) {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.ITEM_LIMIT_REACHED,
          title: `Item limit of ${ITEM_LIMIT} reached`,
        });
      }

      try {
        const row = await prisma.record.create({
          data: {
            userId,
            clientId: input.clientId,
            productId: input.productId ?? null,
            customName: input.customName ?? null,
            expiryDate: new Date(input.expiryDate),
            purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
            quantity: input.quantity,
            unit: input.unit,
            notes: input.notes ?? null,
            photoUrl: input.photoUrl ?? null,
            notifyAt,
            householdId: input.householdId ?? null,
          },
        });

        // For household records, the notification-schedule worker will fan out to
        // all members via the new per-member fan-out path. Queue the schedule job
        // so it runs the same path. For personal records, the worker handles the
        // single-owner schedule.
        await notificationScheduleQueue().add(
          'schedule',
          { recordId: row.id },
          { jobId: `schedule__${row.id}`, removeOnComplete: true, removeOnFail: 100 },
        );

        await maybeActivateReferral(userId).catch(() => {});
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
