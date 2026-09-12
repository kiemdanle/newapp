import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordPatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue, notificationSendQueue } from '../../queues/index.js';
import {
  lockHouseholdRow,
  assertCanWriteRecord,
  assertCanAssignToHousehold,
} from '../../services/households/permissions.js';
import { lockUserPantryQuota, assertCanAddPantryItems } from '../../services/records/pantry-limits.js';
import { fanOutHouseholdRecordReminders, reschedulePersonalRecordReminders } from '../../services/households/household-reminders.js';
import { assertProductUse } from '../../services/products/product-visibility.js';
import type { ProductUsePurpose } from '../../services/products/product-visibility.js';

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
    if (newHouseholdId === null && oldHouseholdId !== null) {
      if (existing.userId !== userId) {
        throw new AppError({
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
          title: 'Only the item creator can move it to personal pantry',
        });
      }
    }

    const effectiveStatus = input.status ?? existing.status;
    const isBecomingInactive =
      (input.status === 'consumed' || input.status === 'discarded') && existing.status === 'active';
    const isBecomingActive =
      input.status === 'active' && existing.status !== 'active';
    const isRemainingActive = effectiveStatus === 'active';

    const expiryChanged =
      input.expiryDate !== undefined &&
      input.expiryDate !== existing.expiryDate.toISOString().slice(0, 10);
    const offsetsChanged = input.notificationOffsetsDays !== undefined;
    const scopeChanged = input.householdId !== undefined && input.householdId !== oldHouseholdId;
    const reschedule = isRemainingActive && (expiryChanged || offsetsChanged || scopeChanged || isBecomingActive);

    const nextExpiry = input.expiryDate ? new Date(input.expiryDate) : existing.expiryDate;
    let nextNotifyAt: string[];
    if (effectiveStatus !== 'active') {
      nextNotifyAt = [];
    } else if (reschedule) {
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

    // Moving into a (possibly different) household is a new use of the product in
    // that scope, not a preserved reference — only an unchanged scope (including a
    // household->personal downgrade) counts as "existing" for a changes_required
    // product. Scope-transition authorization and the record write share this one
    // transaction so the product's state/reference can't change between them.
    const movingIntoHousehold = newHouseholdId !== null && newHouseholdId !== oldHouseholdId;
    const usePurpose: ProductUsePurpose = newHouseholdId ? 'household_record' : 'personal_record';

    const quotaOwnerId = existing.userId;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Quota lock on the record's true owner
      await lockUserPantryQuota(tx, quotaOwnerId);

      // 2. Household locks in sorted order
      const householdIdsToLock = Array.from(
        new Set([oldHouseholdId, newHouseholdId].filter(Boolean) as string[])
      ).sort();
      for (const hid of householdIdsToLock) {
        await lockHouseholdRow(tx, hid);
      }

      // 3. Re-read row under lock
      const freshRecord = await tx.record.findUnique({ where: { id } });
      if (!freshRecord) {
        throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found' });
      }

      // 4. Assert quota on positive active transition
      const isTransitioningToActive = input.status === 'active' && freshRecord.status !== 'active';
      if (isTransitioningToActive) {
        await assertCanAddPantryItems(quotaOwnerId, 1, tx);
      }

      if (freshRecord.productId) {
        await assertProductUse(
          userId,
          freshRecord.productId,
          { purpose: usePurpose, existingRecordReference: !movingIntoHousehold },
          tx,
        );
      }
      return tx.record.update({
        where: { id },
        data: {
          ...(input.customName !== undefined ? { customName: input.customName } : {}),
          ...(input.brand !== undefined ? { brand: input.brand } : {}),
          ...(input.expiryDate !== undefined ? { expiryDate: new Date(input.expiryDate) } : {}),
          ...(input.purchaseDate !== undefined
            ? { purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null }
            : {}),
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.status === 'consumed'
            ? {
                consumedAt: input.consumedAt ? new Date(input.consumedAt) : new Date(),
                discardedAt: null,
                discardReason: null,
              }
            : {}),
          ...(input.status === 'discarded'
            ? {
                discardedAt: input.discardedAt ? new Date(input.discardedAt) : new Date(),
                discardReason: input.discardReason || 'other',
                consumedAt: null,
              }
            : {}),
          ...(input.status === 'active'
            ? {
                consumedAt: null,
                discardedAt: null,
                discardReason: null,
              }
            : {}),
          ...(effectiveStatus !== 'active' ? { notifyAt: [] } : reschedule ? { notifyAt: nextNotifyAt } : {}),
          ...(input.householdId !== undefined ? { householdId: input.householdId } : {}),
          ...(input.location !== undefined ? { location: input.location ? input.location.trim() : null } : {}),
        },
      });
    });

    // Notification hygiene: cancel pending notifications when inactive, reschedule when active.
    if (effectiveStatus !== 'active') {
      const sendQ = notificationSendQueue();
      const scheduleQ = notificationScheduleQueue();
      const jobs = await sendQ.getJobs(['delayed', 'waiting', 'paused']);
      await Promise.all(
        jobs.filter((j) => j.data?.recordId === id).map((j) => j.remove()),
      );
      const scheduleJob = await scheduleQ.getJob(`schedule__${id}`);
      if (scheduleJob) await scheduleJob.remove();
    } else if (reschedule) {
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
