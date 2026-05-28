import { Queue } from 'bullmq';
import { getQueueConnection } from './index.js';

export interface NotificationSendJob {
  recordId: string;
  userId: string;
  fireAt: string; // ISO timestamp, for tracking
  offsetDays: number; // 3, 1, 0 etc.
  templateKey: string; // written to push_logs.templateKey (NOT NULL)
}

export const NOTIFICATION_SEND_QUEUE = 'notification-send';

let _q: Queue<NotificationSendJob> | undefined;
export function notificationSendQueue(): Queue<NotificationSendJob> {
  if (!_q) {
    _q = new Queue<NotificationSendJob>(NOTIFICATION_SEND_QUEUE, {
      connection: getQueueConnection(),
    });
  }
  return _q;
}
