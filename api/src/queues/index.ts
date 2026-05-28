import type { ConnectionOptions, Queue } from 'bullmq';
import { getRedis } from '../redis.js';
import {
  PRODUCT_LOOKUP_QUEUE,
  productLookupQueue,
} from './product-lookup.js';
import {
  NOTIFICATION_SCHEDULE_QUEUE,
  notificationScheduleQueue,
} from './notification-schedule.js';
import {
  NOTIFICATION_SEND_QUEUE,
  notificationSendQueue,
} from './notification-send.js';

export * from './product-lookup.js';
export * from './notification-schedule.js';
export * from './notification-send.js';

// Canonical contract: returns a RAW ConnectionOptions. Callers wrap it as
// `{ connection: getQueueConnection() }` when constructing a Queue/Worker.
// Downstream milestones rely on this shape — do not re-wrap it here.
export function getQueueConnection(): ConnectionOptions {
  return getRedis() as unknown as ConnectionOptions;
}

export function getAllQueues(): { name: string; queue: Queue }[] {
  return [
    { name: PRODUCT_LOOKUP_QUEUE, queue: productLookupQueue() },
    { name: NOTIFICATION_SCHEDULE_QUEUE, queue: notificationScheduleQueue() },
    { name: NOTIFICATION_SEND_QUEUE, queue: notificationSendQueue() },
  ];
}
