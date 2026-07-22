import { describe, expect, it, vi, beforeEach } from 'vitest';

const { sendFcmPushMock, revokePushTokenByIdMock } = vi.hoisted(() => ({
  sendFcmPushMock: vi.fn(),
  revokePushTokenByIdMock: vi.fn(),
}));

vi.mock('../../src/services/push/fcm-push.js', () => ({
  sendFcmPush: sendFcmPushMock,
  isInvalidFcmTokenError: (code: string | null) =>
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token',
}));
vi.mock('../../src/services/push/repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/push/repository.js')>()),
  revokePushTokenById: revokePushTokenByIdMock,
}));

import { processSendJob } from '../../src/workers/notification-send.js';
import { getPrisma } from '../../src/db.js';
import { makeUser, makeRecord } from '../helpers/factories.js';

const TOKEN_A = 'fcm-device-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TOKEN_B = 'fcm-device-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('notification-send worker', () => {
  beforeEach(() => {
    sendFcmPushMock.mockReset();
    revokePushTokenByIdMock.mockReset();
  });

  it('sends a push per active token and persists each FCM response by token order', async () => {
    sendFcmPushMock.mockResolvedValue([
      { providerMessageId: 'fcm-message-1', errorCode: null, errorMessage: null },
      { providerMessageId: 'fcm-message-2', errorCode: null, errorMessage: null },
    ]);
    const user = await makeUser({});
    const record = await makeRecord(user.id, { customName: 'Yogurt', expiryDate: new Date('2099-12-31') });
    await getPrisma().pushToken.create({ data: { userId: user.id, deviceToken: TOKEN_A, platform: 'ios' } });
    await getPrisma().pushToken.create({ data: { userId: user.id, deviceToken: TOKEN_B, platform: 'android' } });

    await processSendJob({ recordId: record.id, userId: user.id, fireAt: '2099-12-30T09:00:00.000Z', offsetDays: 1, templateKey: 'expiry.warning_1d' });

    expect(sendFcmPushMock).toHaveBeenCalledWith(expect.objectContaining({ tokens: [TOKEN_A, TOKEN_B] }));
    const logs = await getPrisma().pushLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    expect(logs).toHaveLength(2);
    expect(logs.map((log) => log.providerMessageId)).toEqual(['fcm-message-1', 'fcm-message-2']);
    expect(logs.every((log) => log.status === 'sent')).toBe(true);
  });

  it('revokes only the token whose FCM response says it is invalid', async () => {
    sendFcmPushMock.mockResolvedValue([
      { providerMessageId: null, errorCode: 'messaging/registration-token-not-registered', errorMessage: 'not registered' },
      { providerMessageId: 'fcm-message-2', errorCode: null, errorMessage: null },
    ]);
    const user = await makeUser({});
    const record = await makeRecord(user.id, { customName: 'X' });
    const first = await getPrisma().pushToken.create({ data: { userId: user.id, deviceToken: TOKEN_A, platform: 'ios' } });
    const second = await getPrisma().pushToken.create({ data: { userId: user.id, deviceToken: TOKEN_B, platform: 'android' } });

    await processSendJob({ recordId: record.id, userId: user.id, fireAt: '2099-12-31T09:00:00.000Z', offsetDays: 0, templateKey: 'expiry.today' });

    expect(revokePushTokenByIdMock).toHaveBeenCalledWith(first.id);
    expect(revokePushTokenByIdMock).not.toHaveBeenCalledWith(second.id);
    const logs = await getPrisma().pushLog.findMany({ where: { userId: user.id } });
    expect(logs).toHaveLength(2);
    expect(logs.find((log) => log.status === 'failed')?.errorMessage).toContain('not registered');
  });

  it('skips when record has been deleted or is not active', async () => {
    const user = await makeUser({});
    const record = await makeRecord(user.id, { status: 'consumed' });
    await processSendJob({ recordId: record.id, userId: user.id, fireAt: '2099-12-31T09:00:00.000Z', offsetDays: 0, templateKey: 'expiry.today' });
    expect(sendFcmPushMock).not.toHaveBeenCalled();
  });

  it('rethrows provider outages so BullMQ can retry', async () => {
    sendFcmPushMock.mockRejectedValue(new Error('circuit open'));
    const user = await makeUser({});
    const record = await makeRecord(user.id, { customName: 'Milk' });
    await getPrisma().pushToken.create({ data: { userId: user.id, deviceToken: TOKEN_A, platform: 'ios' } });

    await expect(
      processSendJob({
        recordId: record.id,
        userId: user.id,
        fireAt: '2099-12-31T09:00:00.000Z',
        offsetDays: 0,
        templateKey: 'expiry.today',
      }),
    ).rejects.toThrow('circuit open');

    const logs = await getPrisma().pushLog.findMany({ where: { userId: user.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe('failed');
    expect(revokePushTokenByIdMock).not.toHaveBeenCalled();
  });

  it('does not revoke on non-token FCM errors such as invalid-argument', async () => {
    sendFcmPushMock.mockResolvedValue([
      { providerMessageId: null, errorCode: 'messaging/invalid-argument', errorMessage: 'bad payload' },
    ]);
    const user = await makeUser({});
    const record = await makeRecord(user.id, { customName: 'Bread' });
    const token = await getPrisma().pushToken.create({
      data: { userId: user.id, deviceToken: TOKEN_A, platform: 'ios' },
    });

    await processSendJob({
      recordId: record.id,
      userId: user.id,
      fireAt: '2099-12-31T09:00:00.000Z',
      offsetDays: 0,
      templateKey: 'expiry.today',
    });

    expect(revokePushTokenByIdMock).not.toHaveBeenCalledWith(token.id);
  });
});
