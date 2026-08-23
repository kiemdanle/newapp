import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  decodeCursor,
  encodeCursor,
  moderationNotificationBatchesListSchema,
  moderationNotificationBatchesQuerySchema,
  moderationNotificationDeliveriesListSchema,
  moderationNotificationHealthSchema,
  moderationNotificationSummarySchema,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { z } from 'zod';

const batchParamsSchema = z.object({ batchId: z.string().uuid() });

function asIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function adminSystemModerationNotificationsRoute(app: FastifyInstance) {
  app.get('/moderation-notifications/summary', async () => {
    const prisma = getPrisma();
    const [newProducts, revisions] = await Promise.all([
      prisma.product.count({ where: { status: 'pending' } }),
      prisma.productEdit.count({ where: { status: 'pending' } }),
    ]);
    return moderationNotificationSummarySchema.parse({ newProducts, revisions, total: newProducts + revisions });
  });

  app.get('/moderation-notifications', async (req) => {
    const query = moderationNotificationBatchesQuerySchema.parse(req.query);
    const cursor = decodeCursor(query.cursor);
    const where: Prisma.ModerationNotificationBatchWhereInput = {
      ...(query.status ? { deliveries: { some: { status: query.status } } } : {}),
      ...(cursor
        ? { OR: [{ createdAt: { lt: cursor.t } }, { AND: [{ createdAt: cursor.t }, { id: { lt: cursor.i } }] }] }
        : {}),
    };
    const prisma = getPrisma();
    const rows = await prisma.moderationNotificationBatch.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, -1) : rows;
    const summaries = await prisma.moderationNotificationDelivery.groupBy({
      by: ['batchId', 'status'],
      where: { batchId: { in: page.map((batch) => batch.id) } },
      _count: { _all: true },
    });
    const countsByBatch = new Map<string, { pending: number; processing: number; sent: number; skipped: number; failed: number }>();
    for (const summary of summaries) {
      const counts = countsByBatch.get(summary.batchId) ?? { pending: 0, processing: 0, sent: 0, skipped: 0, failed: 0 };
      counts[summary.status] = summary._count._all;
      countsByBatch.set(summary.batchId, counts);
    }
    const items = page.map((batch) => ({
      id: batch.id,
      createdAt: batch.createdAt.toISOString(),
      windowStart: batch.windowStart.toISOString(),
      windowEnd: batch.windowEnd.toISOString(),
      newProductCount: batch.newProductCount,
      revisionCount: batch.revisionCount,
      recipientCount: batch.recipientCount,
      deliverySummary: countsByBatch.get(batch.id) ?? { pending: 0, processing: 0, sent: 0, skipped: 0, failed: 0 },
    }));
    const last = items.at(-1);
    return moderationNotificationBatchesListSchema.parse({
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });

  app.get('/moderation-notifications/:batchId/deliveries', async (req) => {
    const { batchId } = batchParamsSchema.parse(req.params);
    const query = moderationNotificationBatchesQuerySchema.parse(req.query);
    const cursor = decodeCursor(query.cursor);
    const where: Prisma.ModerationNotificationDeliveryWhereInput = {
      batchId,
      ...(query.status ? { status: query.status } : {}),
      ...(cursor
        ? { OR: [{ createdAt: { lt: cursor.t } }, { AND: [{ createdAt: cursor.t }, { id: { lt: cursor.i } }] }] }
        : {}),
    };
    const prisma = getPrisma();
    const rows = await prisma.moderationNotificationDelivery.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { pushAttempts: { select: { status: true } } },
    });
    const hasMore = rows.length > query.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((delivery) => {
      const tokenSummary = delivery.channel === 'push'
        ? delivery.pushAttempts.reduce((summary, attempt) => {
            summary[attempt.status]++;
            return summary;
          }, { sent: 0, failed: 0, invalid: 0 })
        : null;
      return {
        id: delivery.id,
        batchId: delivery.batchId,
        channel: delivery.channel,
        status: delivery.status,
        attempts: delivery.attempts,
        errorMessage: delivery.errorMessage,
        completedAt: asIso(delivery.completedAt),
        tokenSummary,
      };
    });
    const last = items.at(-1);
    return moderationNotificationDeliveriesListSchema.parse({
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(rows[items.length - 1]!.createdAt), last.id) : null,
    });
  });

  app.get('/moderation-notifications/health', async () => {
    const prisma = getPrisma();
    const now = new Date();
    const [health, oldestUnbatched, oldestDue, pendingDeliveries] = await Promise.all([
      prisma.moderationNotificationHealth.findUnique({ where: { id: 'moderation-notifications' } }),
      prisma.moderationNotificationEvent.findFirst({ where: { batchId: null }, orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }] }),
      prisma.moderationNotificationDelivery.findFirst({
        where: {
          availableAt: { lte: now },
          OR: [{ status: 'pending' }, { status: 'processing', leaseExpiresAt: { lte: now } }],
        },
        orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.moderationNotificationDelivery.count({ where: { status: { in: ['pending', 'processing'] } } }),
    ]);
    return moderationNotificationHealthSchema.parse({
      lastSuccessfulTickAt: asIso(health?.lastSuccessfulTickAt),
      lastRecoveryAt: asIso(health?.lastRecoveryAt),
      lastSchedulerReconciliationAt: asIso(health?.lastSchedulerReconciliationAt),
      lastCleanupAt: asIso(health?.lastCleanupAt),
      lastZeroRecipientBatchAt: asIso(health?.lastZeroRecipientBatchAt),
      oldestUnbatchedEventAt: asIso(oldestUnbatched?.submittedAt),
      oldestDueDeliveryAt: asIso(oldestDue?.availableAt),
      pendingDeliveries,
      terminalFailures: health?.terminalFailureCount ?? 0,
      deletedBatches: health?.deletedBatchCount ?? 0,
    });
  });
}
