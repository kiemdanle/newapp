import { Worker } from 'bullmq';
import { getPrisma } from '../db.js';
import {
  NOTIFICATION_SCHEDULE_QUEUE,
  notificationSendQueue,
  getQueueConnection,
  type NotificationScheduleJob,
} from '../queues/index.js';
import { logger } from '../logger.js';

// Default notification template written into every send job. push_logs.templateKey
// is NOT NULL, so the send job must always carry one. M2 may vary this per-record.
const DEFAULT_TEMPLATE_KEY = 'expiry_reminder';

export async function processScheduleJob(data: NotificationScheduleJob): Promise<void> {
  const prisma = getPrisma();
  const record = await prisma.record.findUnique({ where: { id: data.recordId } });
  if (!record || record.status !== 'active') return;

  const sendQ = notificationSendQueue();
  // Remove any previously enqueued send jobs for this record
  const pending = await sendQ.getJobs(['delayed', 'waiting', 'paused']);
  for (const job of pending) {
    if (job.data?.recordId === data.recordId) {
      await job.remove();
    }
  }

  const notifyAt = (record.notifyAt as string[]) ?? [];
  const now = Date.now();
  for (const isoTs of notifyAt) {
    const fireAt = new Date(isoTs).getTime();
    const delay = Math.max(0, fireAt - now);
    const expiryMs = record.expiryDate.getTime();
    const offsetDays = Math.round((expiryMs - fireAt) / (24 * 3600 * 1000));
    await sendQ.add(
      'send',
      {
        recordId: record.id,
        userId: record.userId,
        fireAt: isoTs,
        offsetDays,
        templateKey: DEFAULT_TEMPLATE_KEY,
      },
      {
        delay,
        jobId: `send__${record.id}__${isoTs}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }
}

export function startScheduleWorker(): Worker<NotificationScheduleJob> {
  const worker = new Worker<NotificationScheduleJob>(
    NOTIFICATION_SCHEDULE_QUEUE,
    async (job) => processScheduleJob(job.data),
    { connection: getQueueConnection(), concurrency: 8 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ err, jobId: job?.id }, 'notification-schedule worker failed'),
  );
  return worker;
}
