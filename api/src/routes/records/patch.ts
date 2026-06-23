import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordPatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../queues/index.js';
import { assertCanWriteRecord, assertCanAssignToHousehold } from '../../services/households/permissions.js';
import { fanOutHouseholdRecordReminders, reschedulePersonalRecordReminders } from '../../services/households/household-reminders.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function patchRecordRoute(app: FastifyInstance) {
  app.patch('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const input = recordPatchSchema.parse(req.body);
    const userId = req.user!.id;
    const prisma = getPrisma();

    const existing = await prisma.record.findFirst({ where: { id } });
    if (!existing) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found' });
    }

    // Cross-household write predicate: the caller must be able to write the
    // record in its CURRENT scope. Throws 404 for another user's personal record
    // (never leak existence), 403 for a household the caller isn't in.
    await assertCanWriteRecord(existing, userId);

    // If the patch changes householdId to a non-null target, additionally verify
    // the caller belongs to the target household.
    const oldHouseholdId: string | null = existing.householdId;
    let newHouseholdId: string | null | undefined = input.householdId;
    // undefined means "don't change" — keep the existing value.
    if (newHouseholdId === undefined) {
      newHouseholdId = oldHouseholdId;
    }
    if (newHouseholdId !== null && newHouseholdId !== oldHouseholdId) {
      await assertCanAssignToHousehold(newHouseholdId, userId);
    }

    const expiryChanged =
      input.expiryDate !== undefined &&
      input.expiryDate !== existing.expiryDate.toISOString().slice(0, 10);
    const offsetsChanged = input.notificationOffsetsDays !== undefined;
    const scopeChanged = input.householdId !== undefined && input.householdId !== oldHouseholdId;
    const reschedule = expiryChanged || offsetsChanged || scopeChanged;

    const nextExpiry = input.expiryDate ? new Date(input.expiryDate) : existing.expiryDate;
    let nextNotifyAt: string[];
    if (reschedule) {
      let offsets = input.notificationOffsetsDays;
      if (offsets === undefined) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { notificationPreferences: true },
        });
        offsets = resolveOffsetsForUser(user?.notificationPreferences);
      }
      nextNotifyAt = computeNotifyAt(nextExpiry, offsets);
    } else {
      nextNotifyAt = (existing.notifyAt as string[]) ?? [];
    }

    const updated = await prisma.record.update({
      where: { id },
      data: {
        ...(input.customName !== undefined ? { customName: input.customName } : {}),
        ...(input.expiryDate !== undefined ? { expiryDate: new Date(input.expiryDate) } : {}),
        ...(input.purchaseDate !== undefined
          ? { purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null }
          : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.status === 'consumed' ? { consumedAt: new Date() } : {}),
        ...(reschedule ? { notifyAt: nextNotifyAt } : {}),
        ...(input.householdId !== undefined ? { householdId: input.householdId } : {}),
      },
    });

    // Reschedule reminders when scope, expiry, or offsets change.
    if (reschedule) {
      if (scopeChanged && oldHouseholdId) {
        // Record left a household — revert to creator-only reminders via the
        // schedule worker (which now handles personal path).
      }
      if (newHouseholdId && newHouseholdId !== null) {
        // Record is in a household (possibly moved from personal or another
        // household) — fan out to all current members.
        await fanOutHouseholdRecordReminders(id, newHouseholdId);
      } else if (!newHouseholdId) {
        // Record is personal — queue the normal schedule worker for
        // single-owner reminders.
        await notificationScheduleQueue().add(
          'schedule',
          { recordId: id },
          { jobId: `schedule__${id}`, removeOnComplete: true, removeOnFail: 100 },
        );
      }
    }

    return reply.send(toApiRecord(updated));
  });
}
