import { enqueueOutbox } from '../services/notifications/outbox.js';
import type { Prisma } from '@prisma/client';
import { notificationSendQueue } from '../queues/index.js';

type Tx = Prisma.TransactionClient;

export const GIVEAWAY_TEMPLATE_KEYS = {
  newClaim: 'giveaway_new_claim',
  selected: 'giveaway_selected',
  rejected: 'giveaway_rejected',
  handedOff: 'giveaway_handed_off',
  completed: 'giveaway_completed',
  ratePrompt: 'giveaway_rate_prompt',
} as const;

export async function notifyNewClaim(giverUserId: string, giveawayId: string, title: string) {
  await notificationSendQueue().add(
    'send',
    {
      recordId: giveawayId,
      userId: giverUserId,
      fireAt: new Date().toISOString(),
      offsetDays: 0,
      templateKey: GIVEAWAY_TEMPLATE_KEYS.newClaim,
    },
    { removeOnComplete: 1000, removeOnFail: 100 },
  );
}

export async function outboxSelected(tx: Tx, recipientUserId: string, giveawayId: string) {
  await enqueueOutbox(tx, { userId: recipientUserId, templateKey: GIVEAWAY_TEMPLATE_KEYS.selected, payload: { giveawayId } });
}

export async function outboxRejected(tx: Tx, userId: string, giveawayId: string) {
  await enqueueOutbox(tx, { userId, templateKey: GIVEAWAY_TEMPLATE_KEYS.rejected, payload: { giveawayId } });
}

export async function outboxHandedOff(tx: Tx, recipientUserId: string, giveawayId: string) {
  await enqueueOutbox(tx, { userId: recipientUserId, templateKey: GIVEAWAY_TEMPLATE_KEYS.handedOff, payload: { giveawayId } });
}

export async function outboxCompleted(tx: Tx, giverUserId: string, recipientUserId: string, giveawayId: string) {
  await enqueueOutbox(tx, { userId: giverUserId, templateKey: GIVEAWAY_TEMPLATE_KEYS.completed, payload: { giveawayId } });
  await enqueueOutbox(tx, { userId: recipientUserId, templateKey: GIVEAWAY_TEMPLATE_KEYS.ratePrompt, payload: { giveawayId } });
}
