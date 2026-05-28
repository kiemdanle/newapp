import { Worker } from 'bullmq';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { getPrisma } from '../db.js';
import {
  NOTIFICATION_SEND_QUEUE,
  getQueueConnection,
  type NotificationSendJob,
} from '../queues/index.js';
import { sendPush } from '../services/push/expo-push.js';
import { activeTokensForUser } from '../services/push/repository.js';
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

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.expoPushToken,
    sound: 'default',
    title: 'Pantry',
    body: bodyFor(data.offsetDays, name),
    data: { recordId: record.id, type: 'expiry' },
  }));

  let tickets: Array<{ status?: string; id?: string; message?: string }> = [];
  try {
    tickets = (await sendPush(messages)) as typeof tickets;
  } catch (err) {
    logger.warn({ err, recordId: record.id }, 'expo push send failed (circuit?)');
    for (const _t of tokens) {
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
    throw err; // let BullMQ retry per attempts config
  }

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]!;
    await prisma.pushLog.create({
      data: {
        userId: data.userId,
        recordId: record.id,
        expoTicketId: ticket.id ?? null,
        templateKey: data.templateKey,
        status: ticket.status === 'ok' ? 'sent' : 'failed',
        errorMessage: ticket.status === 'ok' ? null : ticket.message ?? 'unknown',
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
