import type { Prisma } from '@prisma/client';
import { notificationSendQueue } from '../../queues/index.js';
import { getPrisma } from '../../db.js';
import { logger } from '../../logger.js';
import { processSendJob } from '../../workers/notification-send.js';
type Tx = Prisma.TransactionClient;

export async function enqueueOutbox(
  tx: Tx,
  entry: { userId: string; templateKey: string; payload: Record<string, unknown> },
): Promise<void> {
  await tx.notificationOutbox.create({
    data: {
      userId: entry.userId,
      templateKey: entry.templateKey,
      payload: entry.payload as never,
    },
  });
}

export async function dispatchOutbox(limit = 50): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.notificationOutbox.findMany({
    where: { dispatchedAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let dispatched = 0;
  for (const row of rows) {
    // Atomic claim so concurrent workers/pollers do not duplicate delivery
    const claimed = await prisma.notificationOutbox.updateMany({
      where: { id: row.id, dispatchedAt: null },
      data: { dispatchedAt: new Date() },
    });
    if (claimed.count === 0) continue;

    try {
      const payload = (row.payload && typeof row.payload === 'object') ? (row.payload as Record<string, unknown>) : {};
      const giveawayId = typeof payload.giveawayId === 'string' ? payload.giveawayId : '';
      const recordId = typeof payload.recordId === 'string' ? payload.recordId : giveawayId;
      const productId = typeof payload.productId === 'string' ? payload.productId : '';
      const editId = typeof payload.editId === 'string' ? payload.editId : '';

      const jobData = {
        recordId,
        userId: row.userId,
        fireAt: new Date().toISOString(),
        offsetDays: 0,
        templateKey: row.templateKey,
        payload: {
          ...payload,
          giveawayId,
          productId,
          editId,
        },
      };

      try {
        await notificationSendQueue().add('send', jobData, {
          jobId: `outbox-${row.id}`,
          removeOnComplete: 1000,
          removeOnFail: 100,
        });
      } catch (queueErr) {
        logger.warn({ queueErr, outboxId: row.id }, 'queue add failed, attempting direct send');
        await processSendJob(jobData);
      }
      dispatched++;
    } catch (err) {
      logger.warn({ err, outboxId: row.id }, 'outbox dispatch failed');
    }
  }
  return dispatched;
}

export async function sweepOutbox(): Promise<void> {
  await dispatchOutbox(50).catch((err) =>
    logger.warn({ err }, 'outbox sweep failed'),
  );
}
