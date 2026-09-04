import type { FastifyInstance } from 'fastify';
import { recordBulkScopeSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertCanWriteRecord, assertCanAssignToHousehold } from '../../services/households/permissions.js';
import { fanOutHouseholdRecordReminders, reschedulePersonalRecordReminders } from '../../services/households/household-reminders.js';
import { assertProductUse } from '../../services/products/product-visibility.js';
import type { ProductUsePurpose } from '../../services/products/product-visibility.js';

export async function bulkScopeRecordsRoute(app: FastifyInstance) {
  app.post('/bulk-scope', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = recordBulkScopeSchema.parse(req.body);
    const userId = req.user!.id;
    const prisma = getPrisma();

    // 1. If targetHouseholdId is provided, assert caller is an active member of the target household
    if (input.targetHouseholdId !== null) {
      await assertCanAssignToHousehold(input.targetHouseholdId, userId);
    }

    // 2. Fetch all requested records
    const records = await prisma.record.findMany({
      where: { id: { in: input.recordIds } },
    });

    if (records.length !== input.recordIds.length) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'One or more records not found',
      });
    }

    // 3. Batch Authorization: Verify caller can write each record in its current scope
    // and enforce that only the creator can move an item from a household back to personal.
    for (const record of records) {
      await assertCanWriteRecord(record, userId);

      if (input.targetHouseholdId === null && record.householdId !== null) {
        if (record.userId !== userId) {
          throw new AppError({
            status: 403,
            code: ERROR_CODES.FORBIDDEN,
            title: 'Only the item creator can move it to personal pantry',
          });
        }
      }
    }

    // 4. Collision rule: filter out records that are already in the target scope
    const recordsToMove = records.filter((r) => r.householdId !== input.targetHouseholdId);
    if (recordsToMove.length === 0) {
      return reply.send({
        updatedCount: 0,
        recordIds: [],
      });
    }

    // 5. Deadlock-free Advisory Lock Ordering:
    // Collect all unique involved household IDs (source household IDs + targetHouseholdId if present)
    const involvedHouseholdIds = new Set<string>();
    if (input.targetHouseholdId !== null) {
      involvedHouseholdIds.add(input.targetHouseholdId);
    }
    for (const rec of recordsToMove) {
      if (rec.householdId !== null) {
        involvedHouseholdIds.add(rec.householdId);
      }
    }

    const sortedHouseholdIds = Array.from(involvedHouseholdIds).sort();

    // 6. Execute atomic update in transaction
    const targetHouseholdId = input.targetHouseholdId;
    const usePurpose: ProductUsePurpose = targetHouseholdId ? 'household_record' : 'personal_record';
    const movingIntoHousehold = Boolean(targetHouseholdId);
    const idsToUpdate = recordsToMove.map((r) => r.id);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      for (const hid of sortedHouseholdIds) {
        const hex = hid.replace(/-/g, '').slice(0, 15);
        const lockKey = parseInt(hex, 16);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
      }

      for (const rec of recordsToMove) {
        if (rec.productId) {
          await assertProductUse(
            userId,
            rec.productId,
            { purpose: usePurpose, existingRecordReference: !movingIntoHousehold },
            tx,
          );
        }
      }

      await tx.record.updateMany({
        where: { id: { in: idsToUpdate } },
        data: {
          householdId: targetHouseholdId,
          updatedAt: new Date(),
        },
      });
    });

    // 7. Post-transaction reminder rescheduling
    if (targetHouseholdId === null) {
      await reschedulePersonalRecordReminders(idsToUpdate);
    } else {
      for (const id of idsToUpdate) {
        await fanOutHouseholdRecordReminders(id, targetHouseholdId);
      }
    }

    return reply.send({
      updatedCount: idsToUpdate.length,
      recordIds: idsToUpdate,
    });
  });
}
