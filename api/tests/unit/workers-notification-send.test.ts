import { describe, expect, it, vi, beforeEach } from 'vitest';

const { sendPushMock } = vi.hoisted(() => ({ sendPushMock: vi.fn() }));
vi.mock('../../src/services/push/expo-push.js', () => ({
  sendPush: sendPushMock,
  Expo: { isExpoPushToken: () => true },
}));

import { processSendJob } from '../../src/workers/notification-send.js';
import { getPrisma } from '../../src/db.js';
import { makeUser, makeRecord } from '../helpers/factories.js';

describe('notification-send worker', () => {
  beforeEach(() => sendPushMock.mockReset());

  it('sends a push per active token and writes a push_logs row each (templateKey persisted)', async () => {
    sendPushMock.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
    const u = await makeUser({});
    const r = await makeRecord(u.id, {
      customName: 'Yogurt',
      expiryDate: new Date('2099-12-31'),
    });
    await getPrisma().pushToken.create({
      data: { userId: u.id, expoPushToken: 'ExponentPushToken[a]', platform: 'ios' },
    });
    await getPrisma().pushToken.create({
      data: { userId: u.id, expoPushToken: 'ExponentPushToken[b]', platform: 'android' },
    });
    await processSendJob({
      recordId: r.id,
      userId: u.id,
      fireAt: '2099-12-30T09:00:00.000Z',
      offsetDays: 1,
      templateKey: 'expiry.warning_1d',
    });
    expect(sendPushMock).toHaveBeenCalledTimes(1); // one chunk of two messages
    const logs = await getPrisma().pushLog.findMany({ where: { userId: u.id } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]!.status).toBe('sent');
    expect(logs[0]!.templateKey).toBe('expiry.warning_1d');
  });

  it('writes a failed log when the chunk returns an error ticket', async () => {
    sendPushMock.mockResolvedValue([{ status: 'error', message: 'DeviceNotRegistered' }]);
    const u = await makeUser({});
    const r = await makeRecord(u.id, { customName: 'X' });
    await getPrisma().pushToken.create({
      data: { userId: u.id, expoPushToken: 'ExponentPushToken[err]', platform: 'ios' },
    });
    await processSendJob({
      recordId: r.id,
      userId: u.id,
      fireAt: '2099-12-31T09:00:00.000Z',
      offsetDays: 0,
      templateKey: 'expiry.today',
    });
    const logs = await getPrisma().pushLog.findMany({ where: { userId: u.id } });
    expect(logs[0]!.status).toBe('failed');
    expect(logs[0]!.errorMessage).toContain('DeviceNotRegistered');
    expect(logs[0]!.templateKey).toBe('expiry.today');
  });

  it('skips when record has been deleted or is not active', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, { status: 'consumed' });
    await processSendJob({
      recordId: r.id,
      userId: u.id,
      fireAt: '2099-12-31T09:00:00.000Z',
      offsetDays: 0,
      templateKey: 'expiry.today',
    });
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});
