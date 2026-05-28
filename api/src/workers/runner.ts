import type { Worker } from 'bullmq';
import { startScheduleWorker } from './notification-schedule.js';
import { startSendWorker } from './notification-send.js';
import { startProductLookupWorker } from './product-lookup.js';
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
  _workers = [startScheduleWorker(), startSendWorker(), startProductLookupWorker()];
  logger.info({ count: _workers.length }, 'workers started');
  return _workers;
}

export async function stopWorkers(): Promise<void> {
  if (!_workers) return;
  await Promise.all(_workers.map((w) => w.close()));
  _workers = null;
}
