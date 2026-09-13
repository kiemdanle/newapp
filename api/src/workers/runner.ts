import type { Worker } from 'bullmq';
import { startScheduleWorker } from './notification-schedule.js';
import { startSendWorker } from './notification-send.js';
import { startProductLookupWorker } from './product-lookup.js';
import { startScoreRecalcWorker } from '../queues/jobs/score-recalc.js';
import { startModerationFlagWorker } from '../queues/jobs/moderation-flag.js';
import { startProductMediaCleanupWorker, scheduleProductMediaCleanup } from '../queues/jobs/product-media-cleanup.js';
import { startIndependentOutboxPoller, stopIndependentOutboxPoller } from '../services/products/product-media-outbox.js';
import {
  scheduleModerationNotifications,
  startModerationNotificationWatchdog,
  startModerationNotificationWorker,
  stopModerationNotificationWatchdog,
} from '../queues/jobs/moderation-notifications.js';
import {
  startFeedbackAdminAlertPoller,
  stopFeedbackAdminAlertPoller,
} from '../services/feedback/admin-alert-outbox.js';
import { sweepOutbox } from '../services/notifications/outbox.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import {
  pruneExpiredBarcodeApiLogs,
  flushBarcodeApiCallLogs,
} from '../services/external/barcode-api-tracker.js';

let _workers: Worker[] | null = null;
let _outboxInterval: NodeJS.Timeout | null = null;
let _barcodePruneInterval: NodeJS.Timeout | null = null;
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
  startFeedbackAdminAlertPoller();
  startModerationNotificationWatchdog();
  if (!_outboxInterval) {
    _outboxInterval = setInterval(() => {
      void sweepOutbox();
    }, 60_000);
    _outboxInterval.unref();
  }
  if (!_barcodePruneInterval) {
    // Run once on startup (deferred) and repeat every 24 hours
    pruneExpiredBarcodeApiLogs().catch((err: unknown) => {
      logger.error({ err }, 'failed initial barcode api log pruning sweep');
    });
    _barcodePruneInterval = setInterval(() => {
      void pruneExpiredBarcodeApiLogs();
    }, 24 * 60 * 60 * 1000);
    _barcodePruneInterval.unref();
  }
  logger.info({ count: _workers.length }, 'workers started');
  return _workers;
}

export async function stopWorkers(): Promise<void> {
  if (!_workers) return;
  if (_outboxInterval) {
    clearInterval(_outboxInterval);
    _outboxInterval = null;
  }
  if (_barcodePruneInterval) {
    clearInterval(_barcodePruneInterval);
    _barcodePruneInterval = null;
  }
  await flushBarcodeApiCallLogs();
  stopFeedbackAdminAlertPoller();
  stopIndependentOutboxPoller();
  stopModerationNotificationWatchdog();
  await Promise.all(_workers.map((w) => w.close()));
  _workers = null;
}
