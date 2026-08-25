import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendFcmPushMock = vi.hoisted(() => vi.fn());
const sendModerationQueueEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/push/fcm-push.js', () => ({
  sendFcmPush: sendFcmPushMock,
  isInvalidFcmTokenError: (code: string | null) =>
    code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token',
}));
vi.mock('../../src/services/notifications/moderation-email.js', () => ({
  sendModerationQueueEmail: sendModerationQueueEmailMock,
}));

import { getPrisma } from '../../src/db.js';
import { makeAdmin } from '../helpers/admin.js';
import { processModerationNotificationTick } from '../../src/services/notifications/moderation-queue.js';

beforeEach(() => {
  vi.clearAllMocks();
  sendModerationQueueEmailMock.mockResolvedValue({ messageId: 'email-message-id' });
});

async function seedTemplateAndEvent() {
  await getPrisma().notificationTemplate.create({
    data: {
      key: 'moderation_queue',
      title: 'Moderation queue needs review',
      body: '{total} item(s): {newProducts} products, {revisions} revisions.',
    },
  });
  await getPrisma().moderationNotificationEvent.create({
    data: { kind: 'new_product', sourceId: crypto.randomUUID(), submissionVersion: 2, submittedAt: new Date() },
  });
}

describe('moderation notification FCM delivery', () => {
  it('chunks more than 500 tokens, persists outcomes, and terminally succeeds on partial acceptance', async () => {
    const { admin } = await makeAdmin();
    const tokens = Array.from({ length: 501 }, (_, index) => ({
      userId: admin.id,
      deviceToken: `moderation-fcm-${index}-${crypto.randomUUID()}`,
      platform: 'android' as const,
    }));
    await getPrisma().pushToken.createMany({ data: tokens });
    await seedTemplateAndEvent();
    sendFcmPushMock.mockImplementation(async ({ tokens: chunk }: { tokens: string[] }) =>
      chunk.map((_, index) =>
        index === 0 && sendFcmPushMock.mock.calls.length === 1
          ? { providerMessageId: 'first-message', errorCode: null, errorMessage: null }
          : { providerMessageId: null, errorCode: 'messaging/registration-token-not-registered', errorMessage: 'not registered' },
      ),
    );

    const tick = await processModerationNotificationTick(new Date());
    expect(sendFcmPushMock).toHaveBeenCalledTimes(2);
    expect(sendFcmPushMock.mock.calls.map(([input]) => input.tokens.length)).toEqual([500, 1]);

    const pushDelivery = await getPrisma().moderationNotificationDelivery.findFirstOrThrow({
      where: { batchId: tick.batchId!, channel: 'push' },
    });
    expect(pushDelivery).toMatchObject({ status: 'sent', attempts: 1, providerMessageId: 'first-message' });
    expect(pushDelivery.completedAt).not.toBeNull();
    const outcomes = await getPrisma().moderationNotificationPushAttempt.findMany({ where: { deliveryId: pushDelivery.id } });
    expect(outcomes).toHaveLength(501);
    expect(outcomes.filter((outcome) => outcome.status === 'sent')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'invalid')).toHaveLength(500);
    expect(await getPrisma().pushToken.count({ where: { userId: admin.id, revokedAt: { not: null } } })).toBe(500);
    expect(sendModerationQueueEmailMock).toHaveBeenCalledTimes(1);
  });

  it('keeps an earlier accepted chunk terminal when a later chunk fails', async () => {
    const { admin } = await makeAdmin();
    await getPrisma().pushToken.createMany({
      data: Array.from({ length: 501 }, (_, index) => ({ userId: admin.id, deviceToken: `late-failure-${index}-${crypto.randomUUID()}`, platform: 'android' as const })),
    });
    await seedTemplateAndEvent();
    sendFcmPushMock
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => ({ providerMessageId: index === 0 ? 'accepted-first' : null, errorCode: index === 0 ? null : 'messaging/registration-token-not-registered', errorMessage: null })))
      .mockRejectedValueOnce(new Error('later FCM chunk failed'));

    const tick = await processModerationNotificationTick(new Date());
    const delivery = await getPrisma().moderationNotificationDelivery.findFirstOrThrow({ where: { batchId: tick.batchId!, channel: 'push' } });
    expect(delivery).toMatchObject({ status: 'sent', attempts: 1, providerMessageId: 'accepted-first' });
    expect(await getPrisma().moderationNotificationPushAttempt.count({ where: { deliveryId: delivery.id } })).toBe(500);
  });
});
