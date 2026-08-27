import { randomUUID } from 'node:crypto';
import type { ModerationNotificationDelivery, Prisma } from '@prisma/client';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { logger } from '../../logger.js';
import { isInvalidFcmTokenError, sendFcmPush } from '../push/fcm-push.js';
import { revokePushTokenById } from '../push/repository.js';
import {
  assertValidModerationTemplatePatch,
  MODERATION_QUEUE_TEMPLATE_KEY,
  renderModerationTemplateText,
  type ModerationQueueCounts,
} from './moderation-template.js';
import { sendModerationQueueEmail } from './moderation-email.js';

const HEALTH_ID = 'moderation-notifications';
const DELIVERY_LEASE_MS = 45_000;
const MAX_DELIVERY_ATTEMPTS = 5;
const CLAIM_LIMIT = 100;
const EVENT_BATCH_LIMIT = 500;
const FCM_MULTICAST_LIMIT = 500;

type EventClaim = {
  id: string;
  kind: 'new_product' | 'product_revision';
  submittedAt: Date;
};

type DueDelivery = ModerationNotificationDelivery;

export type ModerationTickResult = {
  batchId: string | null;
  claimedEvents: number;
  deliveriesClaimed: number;
  zeroRecipients: boolean;
};

export type ModerationDeliveryResult = {
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
};

function deliveryBackoffMs(attempts: number): number {
  return Math.min(15 * 60_000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60_000);
}

export function moderationQueueUrl(): string {
  return new URL('/products/pending', getConfig().frontend.adminUrl).toString();
}

async function updateHealth(data: Prisma.ModerationNotificationHealthUpdateInput): Promise<void> {
  const prisma = getPrisma();
  // Ensure the singleton exists first, then apply the actual update. This keeps
  // increment operations atomic without trying to reuse an update-operation
  // object (which Prisma correctly rejects) as a create payload.
  await prisma.moderationNotificationHealth.upsert({
    where: { id: HEALTH_ID },
    create: { id: HEALTH_ID },
    update: {},
  });
  await prisma.moderationNotificationHealth.update({ where: { id: HEALTH_ID }, data });
}

export async function recordModerationSchedulerReconciliation(at = new Date()): Promise<void> {
  await updateHealth({ lastSchedulerReconciliationAt: at });
}

async function createBatchFromUnbatchedEvents(now: Date): Promise<{ batchId: string | null; claimedEvents: number; zeroRecipients: boolean }> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const events = await tx.$queryRaw<EventClaim[]>`
      SELECT id, kind, submitted_at AS "submittedAt"
      FROM moderation_notification_events
      WHERE batch_id IS NULL
      ORDER BY submitted_at ASC, id ASC
      LIMIT ${EVENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    `;
    if (events.length === 0) return { batchId: null, claimedEvents: 0, zeroRecipients: false };

    const batchId = randomUUID();
    const newProductCount = events.filter((event) => event.kind === 'new_product').length;
    const revisionCount = events.length - newProductCount;
    const recipients = await tx.user.findMany({
      where: { role: 'admin', status: 'active' },
      select: { id: true },
    });

    await tx.moderationNotificationBatch.create({
      data: {
        id: batchId,
        windowStart: events[0]!.submittedAt,
        windowEnd: now,
        newProductCount,
        revisionCount,
        recipientCount: recipients.length,
      },
    });
    await tx.moderationNotificationEvent.updateMany({
      where: { id: { in: events.map((event) => event.id) }, batchId: null },
      data: { batchId },
    });

    if (recipients.length > 0) {
      await tx.moderationNotificationDelivery.createMany({
        data: recipients.flatMap((recipient) => [
          { batchId, recipientUserId: recipient.id, channel: 'push' as const, availableAt: now },
          { batchId, recipientUserId: recipient.id, channel: 'email' as const, availableAt: now },
        ]),
      });
    }

    return { batchId, claimedEvents: events.length, zeroRecipients: recipients.length === 0 };
  });
}

async function claimDueDeliveries(_now: Date, limit = CLAIM_LIMIT): Promise<DueDelivery[]> {
  const prisma = getPrisma();
  const leaseOwner = randomUUID();
  return prisma.$transaction(async (tx) => {
    // Database time is the sole authority for due/expired decisions. App clocks
    // can diverge between worker instances, which otherwise risks reclaiming a
    // still-live provider call or unnecessarily delaying recovery.
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM moderation_notification_deliveries
      WHERE available_at <= NOW()
        AND (
          status = 'pending'::moderation_notification_delivery_status
          OR (
            status = 'processing'::moderation_notification_delivery_status
            AND lease_expires_at <= NOW()
          )
        )
      ORDER BY available_at ASC, created_at ASC, id ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    if (candidates.length === 0) return [];

    const claimed: DueDelivery[] = [];
    for (const candidate of candidates) {
      await tx.$executeRaw`
        UPDATE moderation_notification_deliveries
        SET status = 'processing'::moderation_notification_delivery_status,
            lease_owner = ${leaseOwner},
            lease_expires_at = NOW() + INTERVAL '45 seconds',
            attempts = attempts + 1
        WHERE id = ${candidate.id}::uuid
      `;
      const row = await tx.moderationNotificationDelivery.findUniqueOrThrow({ where: { id: candidate.id } });
      claimed.push(row);
    }
    return claimed;
  });
}

async function finalizeDelivery(
  delivery: DueDelivery,
  data: Prisma.ModerationNotificationDeliveryUpdateManyMutationInput,
): Promise<boolean> {
  const result = await getPrisma().moderationNotificationDelivery.updateMany({
    where: { id: delivery.id, status: 'processing', leaseOwner: delivery.leaseOwner },
    data,
  });
  return result.count === 1;
}

async function finalizeTerminal(
  delivery: DueDelivery,
  status: 'sent' | 'skipped' | 'failed',
  extras: Pick<Prisma.ModerationNotificationDeliveryUpdateManyMutationInput, 'providerMessageId' | 'errorMessage'> = {},
): Promise<boolean> {
  const finalized = await finalizeDelivery(delivery, {
    status,
    completedAt: new Date(),
    leaseOwner: null,
    leaseExpiresAt: null,
    ...extras,
  });
  if (finalized && status === 'failed') {
    await updateHealth({ terminalFailureCount: { increment: 1 } });
  }
  return finalized;
}

async function retryOrFail(delivery: DueDelivery, errorMessage: string): Promise<'retried' | 'failed'> {
  // Provider errors may contain recipient addresses or response text. Persist
  // only a caller-owned, redacted error class safe for operational history.
  if (delivery.attempts >= MAX_DELIVERY_ATTEMPTS) {
    await finalizeTerminal(delivery, 'failed', { errorMessage });
    return 'failed';
  }
  const backoffMs = deliveryBackoffMs(delivery.attempts);
  const finalized = await getPrisma().$executeRaw`
    UPDATE moderation_notification_deliveries
    SET status = 'pending'::moderation_notification_delivery_status,
        available_at = NOW() + (${backoffMs} * INTERVAL '1 millisecond'),
        error_message = ${errorMessage},
        lease_owner = NULL,
        lease_expires_at = NULL
    WHERE id = ${delivery.id}::uuid
      AND status = 'processing'::moderation_notification_delivery_status
      AND lease_owner = ${delivery.leaseOwner}
  `;
  return finalized === 1 ? 'retried' : 'failed';
}

const DEFAULT_MODERATION_TITLE = 'Moderation queue needs review';
const DEFAULT_MODERATION_BODY = '{total} new moderation item(s) awaiting review: {newProducts} new product(s), {revisions} revision(s).';

async function loadTemplateAndCounts(batchId: string): Promise<{ counts: ModerationQueueCounts; title: string; body: string } | null> {
  const prisma = getPrisma();
  const [batch, template] = await Promise.all([
    prisma.moderationNotificationBatch.findUnique({ where: { id: batchId } }),
    prisma.notificationTemplate.findUnique({ where: { key: MODERATION_QUEUE_TEMPLATE_KEY } }),
  ]);
  if (!batch) return null;
  if (template && !template.enabled) return null;

  let title = template?.title ?? DEFAULT_MODERATION_TITLE;
  let body = template?.body ?? DEFAULT_MODERATION_BODY;
  try {
    assertValidModerationTemplatePatch({ title, body });
  } catch {
    title = DEFAULT_MODERATION_TITLE;
    body = DEFAULT_MODERATION_BODY;
  }
  return {
    counts: { newProducts: batch.newProductCount, revisions: batch.revisionCount },
    title,
    body,
  };
}

async function deliverPush(delivery: DueDelivery, template: { title: string; body: string; counts: ModerationQueueCounts }): Promise<'sent' | 'skipped' | 'retried' | 'failed'> {
  const prisma = getPrisma();
  const recipient = await prisma.user.findUnique({
    where: { id: delivery.recipientUserId },
    select: { role: true, status: true, pushTokens: { where: { revokedAt: null }, select: { id: true, deviceToken: true } } },
  });
  if (!recipient || recipient.role !== 'admin' || recipient.status !== 'active') {
    await finalizeTerminal(delivery, 'skipped', { errorMessage: 'recipient is no longer an active admin' });
    return 'skipped';
  }
  if (recipient.pushTokens.length === 0) {
    await finalizeTerminal(delivery, 'skipped', { errorMessage: 'recipient has no active push tokens' });
    return 'skipped';
  }

  const rendered = renderModerationTemplateText(template, template.counts);
  let accepted: { providerMessageId: string | null } | undefined;
  let sawRetryableFailure = false;
  try {
    for (let index = 0; index < recipient.pushTokens.length; index += FCM_MULTICAST_LIMIT) {
      const chunk = recipient.pushTokens.slice(index, index + FCM_MULTICAST_LIMIT);
      const chunkResults = await sendFcmPush({
        tokens: chunk.map((token) => token.deviceToken),
        title: rendered.title,
        body: rendered.body,
        data: { type: 'moderation_queue', url: moderationQueueUrl(), batchId: delivery.batchId },
      });
      if (chunkResults.length !== chunk.length) throw new Error('FCM response count mismatch');
      const outcomes = chunk.map((token, resultIndex) => ({ tokenId: token.id, ...chunkResults[resultIndex]! }));
      // Persist each successful provider response before advancing to the next
      // chunk. A later provider failure must never erase accepted-token evidence
      // and cause those tokens to be resent on a parent-delivery retry.
      await prisma.moderationNotificationPushAttempt.createMany({
        data: outcomes.map((outcome) => ({
          deliveryId: delivery.id,
          pushTokenId: outcome.tokenId,
          attemptNumber: delivery.attempts,
          status: outcome.errorCode === null ? 'sent' : isInvalidFcmTokenError(outcome.errorCode) ? 'invalid' : 'failed',
          providerMessageId: outcome.providerMessageId,
          errorMessage: outcome.errorMessage?.slice(0, 500) ?? null,
        })),
      });
      await Promise.all(outcomes.filter((outcome) => isInvalidFcmTokenError(outcome.errorCode)).map((outcome) => revokePushTokenById(outcome.tokenId)));
      accepted ??= outcomes.find((outcome) => outcome.errorCode === null);
      sawRetryableFailure ||= outcomes.some((outcome) => outcome.errorCode !== null && !isInvalidFcmTokenError(outcome.errorCode));
    }
  } catch (error) {
    if (accepted) {
      await finalizeTerminal(delivery, 'sent', { providerMessageId: accepted.providerMessageId });
      return 'sent';
    }
    logger.warn({ deliveryId: delivery.id }, 'moderation push provider failed');
    return retryOrFail(delivery, 'push provider unavailable');
  }

  if (accepted) {
    await finalizeTerminal(delivery, 'sent', { providerMessageId: accepted.providerMessageId });
    return 'sent';
  }
  if (sawRetryableFailure) return retryOrFail(delivery, 'all push tokens failed with retryable errors');
  await finalizeTerminal(delivery, 'failed', { errorMessage: 'all active push tokens are invalid' });
  return 'failed';
}

async function deliverEmail(delivery: DueDelivery, template: { title: string; body: string; counts: ModerationQueueCounts }): Promise<'sent' | 'skipped' | 'retried' | 'failed'> {
  const recipient = await getPrisma().user.findUnique({
    where: { id: delivery.recipientUserId },
    select: { role: true, status: true, email: true },
  });
  if (!recipient || recipient.role !== 'admin' || recipient.status !== 'active') {
    await finalizeTerminal(delivery, 'skipped', { errorMessage: 'recipient is no longer an active admin' });
    return 'skipped';
  }
  try {
    const result = await sendModerationQueueEmail({
      to: recipient.email,
      template: { title: template.title, body: template.body },
      counts: template.counts,
      queueUrl: moderationQueueUrl(),
    });
    await finalizeTerminal(delivery, 'sent', { providerMessageId: result.messageId });
    return 'sent';
  } catch (error) {
    logger.warn({ deliveryId: delivery.id }, 'moderation email provider failed');
    return retryOrFail(delivery, 'email provider unavailable');
  }
}

async function dispatchDelivery(delivery: DueDelivery): Promise<'sent' | 'skipped' | 'retried' | 'failed'> {
  const template = await loadTemplateAndCounts(delivery.batchId);
  if (!template) {
    await finalizeTerminal(delivery, 'skipped', { errorMessage: 'moderation template is disabled or invalid' });
    return 'skipped';
  }
  return delivery.channel === 'push' ? deliverPush(delivery, template) : deliverEmail(delivery, template);
}

async function dispatchWithLeaseRenewal(delivery: DueDelivery): Promise<'sent' | 'skipped' | 'retried' | 'failed'> {
  const renew = async () => {
    const result = await getPrisma().$executeRaw`
      UPDATE moderation_notification_deliveries
      SET lease_expires_at = NOW() + INTERVAL '45 seconds'
      WHERE id = ${delivery.id}::uuid
        AND status = 'processing'::moderation_notification_delivery_status
        AND lease_owner = ${delivery.leaseOwner}
    `;
    if (result === 0) logger.warn({ deliveryId: delivery.id }, 'moderation notification delivery lease was lost');
  };
  // Provider deadlines are below the lease, and renewal protects the margin if
  // SMTP/FCM uses most of that deadline under a loaded event loop.
  const heartbeat = setInterval(() => {
    renew().catch((error: unknown) => logger.warn({ error, deliveryId: delivery.id }, 'moderation notification delivery lease renewal failed'));
  }, 15_000);
  heartbeat.unref();
  try {
    return await dispatchDelivery(delivery);
  } finally {
    clearInterval(heartbeat);
  }
}

export async function processDueModerationDeliveries(now = new Date()): Promise<ModerationDeliveryResult> {
  const result: ModerationDeliveryResult = { claimed: 0, sent: 0, skipped: 0, retried: 0, failed: 0 };
  // Claim immediately before processing. A page claimed upfront then processed
  // serially could let later leases expire while earlier SMTP/FCM calls run.
  for (let processed = 0; processed < CLAIM_LIMIT; processed += 1) {
    const [delivery] = await claimDueDeliveries(now, 1);
    if (!delivery) break;
    result.claimed++;
    const outcome = await dispatchWithLeaseRenewal(delivery);
    result[outcome]++;
  }
  if (result.claimed > 0) await updateHealth({ lastRecoveryAt: now });
  return result;
}

export async function processModerationNotificationTick(now = new Date()): Promise<ModerationTickResult> {
  const batch = await createBatchFromUnbatchedEvents(now);
  const deliveries = await processDueModerationDeliveries(now);
  await updateHealth({
    lastSuccessfulTickAt: now,
    ...(batch.zeroRecipients ? { lastZeroRecipientBatchAt: now } : {}),
  });
  if (batch.zeroRecipients) {
    logger.warn({ batchId: batch.batchId, claimedEvents: batch.claimedEvents }, 'moderation notification batch had no active admin recipients');
  }
  return { ...batch, deliveriesClaimed: deliveries.claimed };
}

export async function cleanupModerationNotificationHistory(now = new Date(), limit = 100): Promise<number> {
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60_000);
  const prisma = getPrisma();
  const batchIds = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT batch.id
    FROM moderation_notification_batches batch
    WHERE batch.created_at < ${cutoff}
      AND NOT EXISTS (
        SELECT 1
        FROM moderation_notification_deliveries delivery
        WHERE delivery.batch_id = batch.id
          AND delivery.status NOT IN ('sent'::moderation_notification_delivery_status, 'skipped'::moderation_notification_delivery_status, 'failed'::moderation_notification_delivery_status)
      )
    ORDER BY batch.created_at ASC
    LIMIT ${limit}
  `;
  if (batchIds.length === 0) return 0;
  const ids = batchIds.map((batch) => batch.id);
  await prisma.$transaction(async (tx) => {
    const deliveryIds = await tx.moderationNotificationDelivery.findMany({ where: { batchId: { in: ids } }, select: { id: true } });
    if (deliveryIds.length > 0) {
      await tx.moderationNotificationPushAttempt.deleteMany({ where: { deliveryId: { in: deliveryIds.map((delivery) => delivery.id) } } });
      await tx.moderationNotificationDelivery.deleteMany({ where: { id: { in: deliveryIds.map((delivery) => delivery.id) } } });
    }
    await tx.moderationNotificationEvent.deleteMany({ where: { batchId: { in: ids } } });
    await tx.moderationNotificationBatch.deleteMany({ where: { id: { in: ids } } });
  });
  await updateHealth({ lastCleanupAt: now, deletedBatchCount: { increment: ids.length } });
  return ids.length;
}
