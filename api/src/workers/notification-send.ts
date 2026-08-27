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
  // 2. Product edit suggestion notifications
  else if (data.templateKey.startsWith('product_edit_')) {
    const editId = (data.payload?.editId as string) || '';
    const productId = (data.payload?.productId as string) || '';
    const edit = editId
      ? await prisma.productEdit.findUnique({
          where: { id: editId },
          include: { product: true },
        })
      : null;
    const product = (productId ? await prisma.product.findUnique({ where: { id: productId } }) : null) || edit?.product;
    const productName = product?.name || 'Product';

    const template = await prisma.notificationTemplate.findUnique({
      where: { key: data.templateKey },
    });

    if (data.templateKey === 'product_edit_approved') {
      title = template?.title ?? 'Product Edit Approved';
      const rawBody = template?.body ?? 'Your edit suggestions for {name} have been approved!';
      body = rawBody.replace(/\{name\}/g, () => productName);
      payloadData = {
        type: 'product_edit_approved',
        editId: editId || '',
        productId: product?.id || productId || '',
      };
    } else if (data.templateKey === 'product_edit_changes_required') {
      title = template?.title ?? 'Product Edit Update';
      const rawBody = template?.body ?? 'Changes were requested for your edit on {name}';
      body = rawBody.replace(/\{name\}/g, () => productName);
      payloadData = {
        type: 'product_edit_changes_required',
        editId: editId || '',
        productId: product?.id || productId || '',
        notes: (data.payload?.notes as string) || '',
      };
    } else {
      title = template?.title ?? 'Product Edit Update';
      body = (template?.body ?? 'Update on your edit for {name}').replace(/\{name\}/g, () => productName);
      payloadData = {
        type: data.templateKey,
        editId: editId || '',
        productId: product?.id || productId || '',
      };
    }
    associatedRecordId = null;
  }
  // 3. New product moderation notifications
  else if (data.templateKey.startsWith('product_')) {
    const productId = (data.payload?.productId as string) || data.recordId;
    const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;
    const productName = product?.name || 'Product';

    const template = await prisma.notificationTemplate.findUnique({
      where: { key: data.templateKey },
    });

    if (data.templateKey === 'product_approved') {
      title = template?.title ?? 'Product Approved';
      body = (template?.body ?? 'Your product {name} has been approved!').replace(/\{name\}/g, () => productName);
      payloadData = { type: 'product_approved', productId: product?.id || productId };
    } else if (data.templateKey === 'product_changes_required') {
      title = template?.title ?? 'Product Moderation Update';
      body = (template?.body ?? 'Changes were requested for {name}').replace(/\{name\}/g, () => productName);
      payloadData = {
        type: 'product_changes_required',
        productId: product?.id || productId,
        notes: (data.payload?.notes as string) || '',
      };
    } else {
      title = template?.title ?? 'Product Update';
      body = (template?.body ?? 'Update on product {name}').replace(/\{name\}/g, () => productName);
      payloadData = { type: data.templateKey, productId: product?.id || productId };
    }
    associatedRecordId = null;
  }
  // 4. Pantry record expiry notifications
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
