import { Worker } from 'bullmq';
import { getPrisma } from '../db.js';
import {
  NOTIFICATION_SEND_QUEUE,
  getQueueConnection,
  type NotificationSendJob,
} from '../queues/index.js';
import { isInvalidFcmTokenError, sendFcmPush } from '../services/push/fcm-push.js';
import { activeTokensForUser, revokePushTokenById } from '../services/push/repository.js';
import { logger } from '../logger.js';

function bodyFor(offsetDays: number, name: string): string {
  if (offsetDays >= 7) return `${name} expires in ${offsetDays} days`;
  if (offsetDays > 1) return `${name} expires in ${offsetDays} days`;
  if (offsetDays === 1) return `${name} expires tomorrow`;
  return `${name} expires today`;
}

export async function processSendJob(data: NotificationSendJob): Promise<void> {
  const prisma = getPrisma();
  const record = await prisma.record.findUnique({
    where: { id: data.recordId },
    include: { product: true },
  });
  if (!record || record.status !== 'active') return;

  const name = record.customName ?? record.product?.name ?? 'Item';
  const tokens = await activeTokensForUser(data.userId);
  if (tokens.length === 0) return;

  let results: Awaited<ReturnType<typeof sendFcmPush>>;
  try {
    results = await sendFcmPush({
      tokens: tokens.map((token) => token.deviceToken),
      title: 'Expyrico',
      body: bodyFor(data.offsetDays, name),
      data: { recordId: record.id, type: 'expiry' },
    });
  } catch (err) {
    logger.warn({ err, recordId: record.id }, 'FCM push send failed (circuit?)');
    for (const _token of tokens) {
      await prisma.pushLog.create({
        data: {
          userId: data.userId,
          recordId: record.id,
          templateKey: data.templateKey,
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'send failed',
        },
      });
    }
    // Rethrow so BullMQ retries the job on provider/circuit outages.
    throw err;
  }

  if (results.length !== tokens.length) {
    throw new Error(
      `FCM response count mismatch: expected ${tokens.length}, got ${results.length}`,
    );
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const result = results[index]!;

    if (isInvalidFcmTokenError(result.errorCode)) {
      await revokePushTokenById(token.id);
    }

    await prisma.pushLog.create({
      data: {
        userId: data.userId,
        recordId: record.id,
        providerMessageId: result.providerMessageId,
        templateKey: data.templateKey,
        status: result.errorCode === null ? 'sent' : 'failed',
        errorMessage: result.errorMessage,
      },
    });
  }
}

export function startSendWorker(): Worker<NotificationSendJob> {
  const worker = new Worker<NotificationSendJob>(
    NOTIFICATION_SEND_QUEUE,
    async (job) => processSendJob(job.data),
    { connection: getQueueConnection(), concurrency: 4 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ err, jobId: job?.id }, 'notification-send worker failed'),
  );
  return worker;
}
