import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { notificationSendQueue, notificationScheduleQueue } from '../../queues/index.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function deleteRecordRoute(app: FastifyInstance) {
  app.delete('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const userId = req.user!.id;
    const existing = await getPrisma().record.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Record not found',
      });
    }
    await getPrisma().record.delete({ where: { id } });

    // Cancel pending notifications for this record
    const sendQ = notificationSendQueue();
    const scheduleQ = notificationScheduleQueue();
    const jobs = await sendQ.getJobs(['delayed', 'waiting']);
    await Promise.all(
      jobs.filter((j) => j.data?.recordId === id).map((j) => j.remove()),
    );
    const scheduleJob = await scheduleQ.getJob(`schedule__${id}`);
    if (scheduleJob) await scheduleJob.remove();

    return reply.status(204).send();
  });
}
