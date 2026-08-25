import type { Worker } from 'bullmq';
import { startScheduleWorker } from './notification-schedule.js';
import { startSendWorker } from './notification-send.js';
import { startProductLookupWorker } from './product-lookup.js';
import { startScoreRecalcWorker } from '../queues/jobs/score-recalc.js';
import { startModerationFlagWorker } from '../queues/jobs/moderation-flag.js';
import { startProductRatingWorker } from '../queues/jobs/product-rating-recalc.js';
import { startProductMediaCleanupWorker, scheduleProductMediaCleanup } from '../queues/jobs/product-media-cleanup.js';
import { startIndependentOutboxPoller, stopIndependentOutboxPoller } from '../services/products/product-media-outbox.js';
import {
  scheduleModerationNotifications,
  startModerationNotificationWatchdog,
  startModerationNotificationWorker,
  stopModerationNotificationWatchdog,
} from '../queues/jobs/moderation-notifications.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

let _workers: Worker[] | null = null;

export function startWorkers(): Worker[] {
  if (_workers) return _workers;
  // Skip in test env unless explicitly requested
  if (getConfig().env === 'test' && process.env.RUN_WORKERS !== '1') {
    logger.info('workers disabled in test env');
    return [];
  }
  _workers = [
    startScheduleWorker(),
    startSendWorker(),
    startProductLookupWorker(),
    startScoreRecalcWorker(),
    startModerationFlagWorker(),
    startProductRatingWorker(),
    startProductMediaCleanupWorker(),
    startModerationNotificationWorker(),
  ];
  // Registers (or idempotently re-registers) the repeatable tick — BullMQ
  // dedupes an identical repeat config, so this is safe on every boot.
  scheduleProductMediaCleanup().catch((err: unknown) => {
    logger.error({ err }, 'failed to schedule product-media-cleanup repeat job');
  });
  scheduleModerationNotifications().catch((err: unknown) => {
    logger.error({ err }, 'failed to schedule moderation notification job');
  });
  // Scheduler-independent fallback: keeps draining the
  // durable outbox on its own timer even if BullMQ's repeat key is lost or
  // the queue is paused — polling the outbox is the authoritative path,
  // BullMQ delivery only accelerates it.
  startIndependentOutboxPoller();
  startModerationNotificationWatchdog();
  logger.info({ count: _workers.length }, 'workers started');
  return _workers;
}

export async function stopWorkers(): Promise<void> {
  if (!_workers) return;
  stopIndependentOutboxPoller();
  stopModerationNotificationWatchdog();
  await Promise.all(_workers.map((w) => w.close()));
  _workers = null;
}
