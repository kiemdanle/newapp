import { Queue } from 'bullmq';
import { getQueueConnection } from './index.js';

export interface NotificationScheduleJob {
  recordId: string;
}

export const NOTIFICATION_SCHEDULE_QUEUE = 'notification-schedule';

let _q: Queue<NotificationScheduleJob> | undefined;
export function notificationScheduleQueue(): Queue<NotificationScheduleJob> {
  if (!_q) {
    _q = new Queue<NotificationScheduleJob>(NOTIFICATION_SCHEDULE_QUEUE, {
      connection: getQueueConnection(),
    });
  }
  return _q;
}
