import { randomUUID } from 'node:crypto';
import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';
import { getQueueConnection } from '../index.js';
import {
  cleanupModerationNotificationHistory,
  processDueModerationDeliveries,
  processModerationNotificationTick,
  recordModerationSchedulerReconciliation,
} from '../../services/notifications/moderation-queue.js';

export const MODERATION_NOTIFICATION_QUEUE = 'moderation-notifications';
const JOB_NAME = 'moderation-notification-tick';
const SCHEDULER_ID = 'moderation-notification-every-15-minutes';
const REPEAT_EVERY_MS = 15 * 60_000;
const WATCHDOG_EVERY_MS = 15 * 60_000;
const LOCK_KEY = 'moderation-notifications:tick-lock';
const LOCK_TTL_SECONDS = 55;

const RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 0
`;
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

let _queue: Queue | undefined;
let watchdog: NodeJS.Timeout | undefined;

export function moderationNotificationQueue(): Queue {
  if (!_queue) _queue = new Queue(MODERATION_NOTIFICATION_QUEUE, { connection: getQueueConnection() });
  return _queue;
}

/**
 * Creates/reconciles the stable BullMQ scheduler. The scheduler is only a
 * wake-up mechanism: the durable database ledger drives every tick and the
 * watchdog calls this reconciliation after Redis scheduler state is lost.
 */
export async function scheduleModerationNotifications(): Promise<void> {
  await moderationNotificationQueue().upsertJobScheduler(
    SCHEDULER_ID,
    { every: REPEAT_EVERY_MS },
    {
      name: JOB_NAME,
      data: {},
      opts: { removeOnComplete: 100, removeOnFail: 100 },
    },
  );
  await recordModerationSchedulerReconciliation();
}

/**
 * One durable tick protected from redundant concurrent scans by a short Redis
 * lock. PostgreSQL `FOR UPDATE SKIP LOCKED` event/delivery claims remain the
 * authority, so a lost lock can at worst add a harmless scan — never duplicate
 * a batch or delivery.
 */
export async function processModerationNotificationTickWithLock(now = new Date()): Promise<void> {
  const redis = getRedis();
  const token = randomUUID();
  const acquired = await redis.set(LOCK_KEY, token, 'EX', LOCK_TTL_SECONDS, 'NX');
  if (!acquired) return;
  const heartbeat = setInterval(() => {
    redis.eval(RENEW_SCRIPT, 1, LOCK_KEY, token, LOCK_TTL_SECONDS).catch((error: unknown) => {
      logger.warn({ error }, 'moderation notifications: tick lock heartbeat failed');
    });
  }, 20_000);
  heartbeat.unref();
  try {
    const tick = await processModerationNotificationTick(now);
    await cleanupModerationNotificationHistory(now);
    logger.info(tick, 'moderation notifications: tick complete');
  } finally {
    clearInterval(heartbeat);
    await redis.eval(RELEASE_SCRIPT, 1, LOCK_KEY, token).catch((error: unknown) => {
      logger.warn({ error }, 'moderation notifications: failed to release tick lock');
    });
  }
}

export function startModerationNotificationWorker(): Worker {
  const worker = new Worker(
    MODERATION_NOTIFICATION_QUEUE,
    async (_job: Job) => processModerationNotificationTickWithLock(),
    { connection: getQueueConnection(), concurrency: 1 },
  );
  worker.on('failed', (job, error) => {
    logger.error({ error, jobId: job?.id }, 'moderation notification worker failed');
  });
  return worker;
}

/**
 * Starts a lifecycle-owned fallback that both runs durable work and reconciles
 * the scheduler. It is unref'd so it cannot keep a graceful shutdown alive;
 * `stopModerationNotificationWatchdog` stops it before workers close.
 */
export function startModerationNotificationWatchdog(): void {
  if (watchdog) return;
  const run = () => {
    // Reconcile the BullMQ scheduler after Redis loss. Recovery scans existing
    // delivery rows but never claims fresh events, preserving the 15-minute
    // batching cadence while still reclaiming expired provider work.
    Promise.all([scheduleModerationNotifications(), processDueModerationDeliveries()]).catch((error: unknown) => {
      logger.warn({ error }, 'moderation notification watchdog reconciliation failed');
    });
  };
  run();
  watchdog = setInterval(run, WATCHDOG_EVERY_MS);
  watchdog.unref();
}

export function stopModerationNotificationWatchdog(): void {
  if (watchdog) clearInterval(watchdog);
  watchdog = undefined;
}
