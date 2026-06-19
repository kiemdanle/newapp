import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertOwner } from '../../services/households/permissions.js';
import { cancelAllRemindersForHousehold, reschedulePersonalRecordReminders } from '../../services/households/household-reminders.js';

const paramsSchema = z.object({ id: z.string().uuid() });

async function lockHouseholdRow(tx: ReturnType<typeof getPrisma>, householdId: string): Promise<void> {
  // Hash the UUID into a bigint Prisma can bind: take first 15 hex chars as a
  // 60-bit integer that fits in both JS safe integer range and PostgreSQL bigint.
  const hex = householdId.replace(/-/g, '').slice(0, 15);
  const lockKey = parseInt(hex, 16);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
}

export async function dissolveHouseholdRoute(app: FastifyInstance) {
  app.delete('/households/:id', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const household = await prisma.household.findUnique({ where: { id } });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });
    await assertOwner(id, req.user!.id);

    // Capture the record IDs that will be reverted so we can reschedule
    // their creator-only reminders after the FK nullifies them.
    const affectedRecordIds = (
      await prisma.record.findMany({ where: { householdId: id }, select: { id: true } })
    ).map((r) => r.id);

    await prisma.$transaction(async (tx) => {
      await lockHouseholdRow(tx as unknown as ReturnType<typeof getPrisma>, id);

      // Cancel ALL pending household reminders before FK cascade nullifies records.
      await cancelAllRemindersForHousehold(id);

      // FK onDelete:SetNull reverts all shared records to creator-private automatically.
      await tx.household.delete({ where: { id } });
    });

    // Re-schedule single-owner (creator) reminders for each reverted record.
    if (affectedRecordIds.length > 0) {
      await reschedulePersonalRecordReminders(affectedRecordIds);
    }

    return reply.status(204).send();
  });
}
