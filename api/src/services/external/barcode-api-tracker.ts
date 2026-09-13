import prismaPkg from '@prisma/client';
const { Prisma: PrismaRuntime } = prismaPkg;
import type { Prisma } from '@prisma/client';
import type { BarcodeApiStatus, BarcodeApiCallerContext } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { logger } from '../../logger.js';
import { getBarcodeProviderSettings } from './barcode-provider-settings.js';
export interface BarcodeApiCallLogInput {
  provider: string;
  barcode: string;
  endpoint: string;
  httpMethod?: string;
  status: BarcodeApiStatus;
  httpStatus?: number | null;
  durationMs: number;
  errorMessage?: string | null;
  responseSizeBytes?: number | null;
  callerContext?: BarcodeApiCallerContext;
  requestHeaders?: Record<string, unknown> | null;
  responseHeaders?: Record<string, unknown> | null;
  rawResponsePreview?: string | null;
  userId?: string | null;
}

type StoredLogItem = Prisma.BarcodeApiCallLogCreateManyInput;

const MAX_BUFFER_SIZE = 1000;
const FLUSH_BATCH_SIZE = 25;
const FLUSH_INTERVAL_MS = 1000;

const buffer: StoredLogItem[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let isFlushing = false;

function ensureTimer(): void {
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      void flushBarcodeApiCallLogs();
    }, FLUSH_INTERVAL_MS);
    if (flushTimer.unref) {
      flushTimer.unref();
    }
  }
}

export function bufferBarcodeApiCallLog(input: BarcodeApiCallLogInput): void {
  try {
    if (buffer.length >= MAX_BUFFER_SIZE) {
      buffer.shift(); // Drop oldest to prevent unbounded memory growth
      logger.warn('Barcode API call log buffer reached maximum capacity; dropped oldest log item');
    }

    const item: StoredLogItem = {
      provider: input.provider,
      barcode: input.barcode,
      endpoint: input.endpoint,
      httpMethod: input.httpMethod ?? 'GET',
      status: input.status,
      httpStatus: input.httpStatus ?? null,
      durationMs: input.durationMs,
      errorMessage: input.errorMessage ?? null,
      responseSizeBytes: input.responseSizeBytes ?? null,
      callerContext: input.callerContext ?? 'sync_lookup',
      requestHeaders: input.requestHeaders ? (input.requestHeaders as Prisma.InputJsonValue) : PrismaRuntime.JsonNull,
      responseHeaders: input.responseHeaders ? (input.responseHeaders as Prisma.InputJsonValue) : PrismaRuntime.JsonNull,
      rawResponsePreview: input.rawResponsePreview ?? null,
      userId: input.userId ?? null,
      createdAt: new Date(),
    };

    buffer.push(item);

    if (buffer.length >= FLUSH_BATCH_SIZE) {
      void flushBarcodeApiCallLogs();
    } else {
      ensureTimer();
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to buffer barcode API call log');
  }
}

export async function flushBarcodeApiCallLogs(): Promise<void> {
  if (isFlushing || buffer.length === 0) return;
  isFlushing = true;

  try {
    const itemsToInsert = buffer.splice(0, buffer.length);
    if (itemsToInsert.length === 0) return;

    const prisma = getPrisma();
    await prisma.barcodeApiCallLog.createMany({
      data: itemsToInsert,
      skipDuplicates: true,
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to flush barcode API call logs batch to database');
  } finally {
    isFlushing = false;
    if (buffer.length === 0 && flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }
}

export function getBarcodeApiTrackerBufferSize(): number {
  return buffer.length;
}

export function clearBarcodeApiTrackerBuffer(): void {
  buffer.length = 0;
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export async function pruneExpiredBarcodeApiLogs(customRetentionDays?: number | null): Promise<number> {
  let retentionDays: number | null;
  if (customRetentionDays !== undefined) {
    retentionDays = customRetentionDays;
  } else {
    try {
      const config = await getBarcodeProviderSettings();
      retentionDays = config.retentionDays;
    } catch {
      retentionDays = 30;
    }
  }

  // Unlimited retention: never prune
  if (retentionDays === null) {
    logger.info('Barcode API log retention is unlimited; skipping pruning');
    return 0;
  }

  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const prisma = getPrisma();
    const result = await prisma.barcodeApiCallLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });

    logger.info({ count: result.count, retentionDays, cutoff }, 'Pruned expired barcode API call logs');
    return result.count;
  } catch (err) {
    logger.error({ err, retentionDays }, 'Failed to prune expired barcode API call logs');
    return 0;
  }
}
