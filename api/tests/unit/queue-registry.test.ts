import { describe, expect, it } from 'vitest';
import {
  getAllQueues,
  getQueueConnection,
  PRODUCT_LOOKUP_QUEUE,
  NOTIFICATION_SCHEDULE_QUEUE,
  NOTIFICATION_SEND_QUEUE,
} from '../../src/queues/index.js';

describe('queue registry', () => {
  it('getAllQueues returns the three M1 queues by name', () => {
    const names = getAllQueues().map((q) => q.name).sort();
    expect(names).toEqual(
      [PRODUCT_LOOKUP_QUEUE, NOTIFICATION_SCHEDULE_QUEUE, NOTIFICATION_SEND_QUEUE].sort(),
    );
  });

  it('getQueueConnection returns a raw ConnectionOptions (not a wrapper)', () => {
    const out = getQueueConnection();
    // Raw connection options object, NOT `{ connection: ... }`.
    expect(out).not.toHaveProperty('connection');
    expect(out).toBeTypeOf('object');
  });
});
