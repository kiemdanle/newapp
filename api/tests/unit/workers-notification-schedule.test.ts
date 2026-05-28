import { describe, expect, it, vi, beforeEach } from 'vitest';

const { addMock, removeMock, getJobsMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
  removeMock: vi.fn(),
  getJobsMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/queues/index.js', () => ({
  notificationSendQueue: () => ({
    add: addMock,
    getJobs: getJobsMock,
    getJob: vi.fn().mockResolvedValue(null),
  }),
  NOTIFICATION_SCHEDULE_QUEUE: 'notification-schedule',
  getQueueConnection: () => ({}),
}));

import { processScheduleJob } from '../../src/workers/notification-schedule.js';
import { makeUser, makeRecord } from '../helpers/factories.js';

describe('notification-schedule worker', () => {
  beforeEach(() => {
    addMock.mockReset();
    removeMock.mockReset();
    getJobsMock.mockReset().mockResolvedValue([]);
  });

  it('enqueues one notification-send per notify_at timestamp', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, {
      expiryDate: new Date('2099-12-31'),
      notifyAt: [
        '2099-12-24T09:00:00.000Z',
        '2099-12-30T09:00:00.000Z',
        '2099-12-31T09:00:00.000Z',
      ],
    });
    await processScheduleJob({ recordId: r.id });
    expect(addMock).toHaveBeenCalledTimes(3);
    const call0 = addMock.mock.calls[0]![1];
    expect(call0.userId).toBe(u.id);
    expect(call0.recordId).toBe(r.id);
    expect(call0.templateKey).toBe('expiry_reminder');
  });

  it('cancels existing delayed jobs for the record before re-enqueuing', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, { notifyAt: ['2099-12-31T09:00:00.000Z'] });
    const stale = { data: { recordId: r.id }, remove: removeMock };
    getJobsMock.mockResolvedValue([stale, { data: { recordId: 'other' }, remove: vi.fn() }]);
    await processScheduleJob({ recordId: r.id });
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('no-op when record has empty notify_at', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, { notifyAt: [] });
    await processScheduleJob({ recordId: r.id });
    expect(addMock).not.toHaveBeenCalled();
  });
});
