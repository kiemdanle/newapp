import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { writeAuditLog } from '../../../services/audit/log.js';
import { lockUserPantryQuota } from '../../../services/records/pantry-limits.js';
import { lockHouseholdRow } from '../../../services/households/permissions.js';
import {
  notificationSendQueue,
  notificationScheduleQueue,
} from '../../../queues/index.js';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function adminPantryItemsDeleteRoute(app: FastifyInstance) {
  app.delete('/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.record.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'Pantry item not found',
        });
      }

      // 1. Acquire shared serialization advisory lock on owner
      await lockUserPantryQuota(tx, existing.userId);

      // 2. Re-read fresh record under lock to guarantee scope accuracy
      const fresh = await tx.record.findUnique({ where: { id } });
      if (!fresh) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'Pantry item not found',
        });
      }

      // 3. Acquire household lock if item belongs to a household
      if (fresh.householdId) {
        await lockHouseholdRow(tx, fresh.householdId);
      }

      // 4. Detach giveaways linked to this record
      await tx.giveaway.updateMany({
        where: { recordId: id },
        data: { recordId: null },
      });

      // 5. Atomically insert durable tombstone
      await tx.recordTombstone.upsert({
        where: { clientId: fresh.clientId },
        update: { deletedAt: new Date() },
        create: {
          recordId: fresh.id,
          clientId: fresh.clientId,
          userId: fresh.userId,
          householdId: fresh.householdId,
          deletedAt: new Date(),
        },
      });

      // 6. Delete record
      await tx.record.delete({ where: { id } });

      // 7. Atomically write audit log inside transaction
      await writeAuditLog(
        {
          adminId: req.user!.id,
          action: 'pantry_item.delete',
          targetType: 'record',
          targetId: id,
          diff: {
            before: fresh as unknown as Record<string, unknown>,
            after: null,
          },
          requestId: req.id,
          ip: req.ip,
        },
        tx,
      );
    });

    // Clean up queues outside transaction in try/catch
    try {
      const sendQ = notificationSendQueue();
      const scheduleQ = notificationScheduleQueue();
      const jobs = await sendQ.getJobs(['delayed', 'waiting']);
      await Promise.all(
        jobs.filter((j) => j.data?.recordId === id).map((j) => j.remove()),
      );
      const scheduleJob = await scheduleQ.getJob(`schedule__${id}`);
      if (scheduleJob) await scheduleJob.remove();
    } catch {
      // Redis cleanup failure does not prevent successful response
    }

    return reply.status(204).send();
  });
}
