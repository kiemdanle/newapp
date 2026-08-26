import { Worker } from 'bullmq';
import { getPrisma } from '../db.js';
import {
  NOTIFICATION_SEND_QUEUE,
  getQueueConnection,
  type NotificationSendJob,
} from '../queues/index.js';
import { isInvalidFcmTokenError, sendFcmPush, type FcmPushResult } from '../services/push/fcm-push.js';
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
  const tokens = await activeTokensForUser(data.userId);
  if (tokens.length === 0) return;

  let title = 'Expyrico';
  let body = '';
  let payloadData: Record<string, string> = {};
  let associatedRecordId: string | null = null;

  // 1. Giveaway notifications
  if (data.templateKey.startsWith('giveaway_')) {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: data.recordId },
      include: { product: true },
    });
    if (!giveaway) return;
    const itemName = giveaway.title || giveaway.product?.name || 'Item';
    const template = await prisma.notificationTemplate.findUnique({
      where: { key: data.templateKey },
    });
    title = template?.title ?? 'Expyrico Community';
    const rawBody = template?.body ?? 'Update on giveaway for {name}';
    body = rawBody.replace(/\{name\}/g, () => itemName);
    payloadData = { giveawayId: giveaway.id, type: data.templateKey };
    associatedRecordId = null;
  }
  // 2. Pantry record expiry notifications
  else {
    const record = await prisma.record.findUnique({
      where: { id: data.recordId },
      include: { product: true },
    });
    if (!record || record.status !== 'active') return;
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { notificationPreferences: true },
    });
    let hideItemNames = false;
    if (user?.notificationPreferences && typeof user.notificationPreferences === 'object' && 'hideItemNames' in user.notificationPreferences) {
      hideItemNames = Boolean(user.notificationPreferences.hideItemNames);
    }

    const name = hideItemNames ? 'An item' : (record.customName ?? record.product?.name ?? 'Item');
    const template = await prisma.notificationTemplate.findUnique({
      where: { key: data.templateKey },
    });
    title = template?.title ?? 'Expyrico';
    const rawBody = template?.body ?? (
      data.offsetDays === 0 ? '{name} expires today' :
      data.offsetDays === 1 ? '{name} expires tomorrow' :
      `{name} expires in {days} days`
    );
    body = rawBody
      .replace(/\{name\}/g, () => name)
      .replace(/\{days\}/g, () => String(data.offsetDays));
    payloadData = { recordId: record.id, type: 'expiry' };
    associatedRecordId = record.id;
  }

  let results: FcmPushResult[];
  try {
    results = await sendFcmPush({
      tokens: tokens.map((token) => token.deviceToken),
      title,
      body,
      data: payloadData,
    });
  } catch (err) {
    logger.warn({ err, templateKey: data.templateKey, recordId: data.recordId }, 'FCM push send failed (circuit?)');
    for (const _token of tokens) {
      await prisma.pushLog.create({
        data: {
          userId: data.userId,
          recordId: associatedRecordId,
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
        recordId: associatedRecordId,
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
