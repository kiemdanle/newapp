import { describe, expect, it } from 'vitest';
import { getRedis } from '../../src/redis.js';
import {
  moderationNotificationQueue,
  scheduleModerationNotifications,
} from '../../src/queues/jobs/moderation-notifications.js';

describe('moderation notification scheduler reconciliation', () => {
  it('upserts the stable 15-minute scheduler again after Redis scheduler state is flushed', async () => {
    await scheduleModerationNotifications();
    let schedulers = await moderationNotificationQueue().getJobSchedulers();
    expect(schedulers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'moderation-notification-every-15-minutes', every: 15 * 60_000 }),
    ]));

    await getRedis().flushdb();
    schedulers = await moderationNotificationQueue().getJobSchedulers();
    expect(schedulers).toHaveLength(0);

    await scheduleModerationNotifications();
    schedulers = await moderationNotificationQueue().getJobSchedulers();
    expect(schedulers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'moderation-notification-every-15-minutes', every: 15 * 60_000 }),
    ]));
  });
});
