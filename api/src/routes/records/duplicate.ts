import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, ITEM_LIMIT } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../queues/index.js';
import { randomUUID } from 'node:crypto';

const paramSchema = z.object({ id: z.string().uuid() });

const bodySchema = z.object({
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
  notificationOffsetsDays: z.array(z.number().int().min(0).max(365)).max(10).optional(),
});

export async function duplicateRecordRoute(app: FastifyInstance) {
  app.post('/:id/duplicate', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const body = bodySchema.parse(req.body);
    const userId = req.user!.id;
    const prisma = getPrisma();

    const source = await prisma.record.findFirst({ where: { id, userId } });
    if (!source) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found' });
    }

    // Duplicate counts against the active-record cap (spec §2.17).
    const activeCount = await prisma.record.count({ where: { userId, status: 'active' } });
    if (activeCount >= ITEM_LIMIT) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.ITEM_LIMIT_REACHED,
        title: `Item limit of ${ITEM_LIMIT} reached`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    const offsets =
      body.notificationOffsetsDays ?? resolveOffsetsForUser(user?.notificationPreferences);
    const notifyAt = computeNotifyAt(new Date(body.expiryDate), offsets);

    const row = await prisma.record.create({
      data: {
        userId,
        clientId: randomUUID(),
        productId: source.productId,
        customName: source.customName,
        category: source.category,
        expiryDate: new Date(body.expiryDate),
        purchaseDate: null,
        quantity: Number(source.quantity),
        unit: source.unit,
        price: source.price,
        store: source.store,
        notes: source.notes,
        photoUrl: source.photoUrl,
        notifyAt,
      },
    });

    await notificationScheduleQueue().add(
      'schedule',
      { recordId: row.id },
      { jobId: `schedule__${row.id}`, removeOnComplete: true, removeOnFail: 100 },
    );

    return reply.status(201).send(toApiRecord(row));
  });
}
