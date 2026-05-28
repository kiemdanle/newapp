import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordPatchSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../queues/index.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function patchRecordRoute(app: FastifyInstance) {
  app.patch('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const input = recordPatchSchema.parse(req.body);
    const userId = req.user!.id;
    const prisma = getPrisma();
    const existing = await prisma.record.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Record not found',
      });
    }

    const expiryChanged =
      input.expiryDate !== undefined &&
      input.expiryDate !== existing.expiryDate.toISOString().slice(0, 10);
    const offsetsChanged = input.notificationOffsetsDays !== undefined;
    const reschedule = expiryChanged || offsetsChanged;

    const nextExpiry = input.expiryDate ? new Date(input.expiryDate) : existing.expiryDate;
    let nextNotifyAt: string[];
    if (reschedule) {
      // Explicit per-request offsets win; otherwise fall back to the user's
      // notificationPreferences.offsetsDays (default [3,1,0] when null).
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
      },
    });

    if (reschedule) {
      await notificationScheduleQueue().add(
        'schedule',
        { recordId: id },
        { jobId: `schedule__${id}`, removeOnComplete: true, removeOnFail: 100 },
      );
    }

    return reply.send(toApiRecord(updated));
  });
}
