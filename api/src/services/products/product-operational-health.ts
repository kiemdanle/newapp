// Phase 7 Task 7: the protected operational health payload. Every numeric
// threshold is read from config (spec defaults, env-overridable) rather than
// hardcoded, so Phase 8 monitoring can be tuned without a code change.
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';
import { mediaCapacitySnapshot, type MediaCapacitySnapshot } from './product-media-capacity.js';
import { oldestQuarantineAgeMs } from './product-media-cleanup.js';

const CLEANUP_LAST_SUCCESS_KEY = 'health:cleanup:last-success';
const CLEANUP_LAST_FAILURE_KEY = 'health:cleanup:last-failure';
const BACKUP_LAST_SUCCESS_KEY = 'health:backup:last-success';
const BACKUP_LAST_FAILURE_KEY = 'health:backup:last-failure';
// Signals are useful long after any real alerting window has passed (an
// operator debugging days later still wants "when did this last succeed") —
// generous, not tied to any of the staleness thresholds below.
const SIGNAL_TTL_SECONDS = 30 * 24 * 60 * 60;

// Three of the eight spec'd alert thresholds (assessment provider failure
// rate, API 5xx rate, upload rejection rate) were parsed into config with no
// consumer anywhere and omitted from the payload's `thresholds`, making the
// config look shipped when the rates themselves were never computed
// (reviewer-p7 IM5). Time-bucketed (not sliding-window) counters: cheap,
// TTL-self-cleaning, and adequate for a 15-minute alerting window — an
// operator doesn't need perfect precision, just "is this trending bad right
// now". `recordRateEvent` is the primitive every producer call site (the
// assessment service, the global error handler, the upload route) calls
// directly; `currentRatePercent` is what this module reads back.
const RATE_WINDOW_SECONDS = 15 * 60;
export type RateMetric = 'assessment' | 'api5xx' | 'uploadRejection';

function currentRateBucket(): number {
  return Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
}

/** Records one event toward a rolling 15-minute rate. Call with `outcome:
 * 'total'` on every attempt, and additionally with `outcome: 'failure'` when
 * that attempt is the kind this metric alerts on (a provider failure, a 5xx
 * response, a rejected upload — never an expected/frequent outcome like a
 * conservative reCAPTCHA reject, which the circuit breaker's own error
 * filter also excludes from its statistics for the same reason). */
export async function recordRateEvent(metric: RateMetric, outcome: 'total' | 'failure'): Promise<void> {
  const key = `health:rate:${metric}:${outcome}:${currentRateBucket()}`;
  const redis = getRedis();
  const val = await redis.incr(key);
  // TTL only set on first increment (redis.incr on a fresh key), generous
  // 2x the window so a read straddling a bucket rollover never 404s the key
  // it's still trying to read.
  if (val === 1) await redis.expire(key, RATE_WINDOW_SECONDS * 2);
}

/** Current 15-minute failure rate for `metric`, or `null` when there have
 * been zero attempts this window (never divides by zero, and `null` is
 * distinct from "0% failure rate" — no data yet is not the same claim as
 * "everything succeeded"). */
async function currentRatePercent(metric: RateMetric): Promise<number | null> {
  const bucket = currentRateBucket();
  const redis = getRedis();
  const [total, failures] = await Promise.all([
    redis.get(`health:rate:${metric}:total:${bucket}`),
    redis.get(`health:rate:${metric}:failure:${bucket}`),
  ]);
  const totalNum = total ? Number(total) : 0;
  if (totalNum === 0) return null;
  const failureNum = failures ? Number(failures) : 0;
  return (failureNum / totalNum) * 100;
}

async function recordSignal(key: string): Promise<void> {
  await getRedis().set(key, new Date().toISOString(), 'EX', SIGNAL_TTL_SECONDS);
}
async function readSignal(key: string): Promise<string | null> {
  return getRedis().get(key);
}

export const recordCleanupSuccess = (): Promise<void> => recordSignal(CLEANUP_LAST_SUCCESS_KEY);
export const recordCleanupFailure = (): Promise<void> => recordSignal(CLEANUP_LAST_FAILURE_KEY);
export const recordBackupSuccess = (): Promise<void> => recordSignal(BACKUP_LAST_SUCCESS_KEY);
export const recordBackupFailure = (): Promise<void> => recordSignal(BACKUP_LAST_FAILURE_KEY);

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (60 * 60 * 1000);
}

export interface OperationalHealthPayload {
  status: 'ok' | 'warning' | 'critical';
  capacity: MediaCapacitySnapshot & { status: 'ok' | 'warning' | 'critical' };
  cleanup: { lastSuccessAt: string | null; lastFailureAt: string | null; stale: boolean };
  pending: { count: number; oldestAgeHours: number | null; stale: boolean };
  quarantine: { oldestAgeHours: number | null };
  backup: { lastSuccessAt: string | null; lastFailureAt: string | null; stale: boolean };
  rates: {
    assessmentFailurePercent: number | null;
    assessmentFailureExceeded: boolean;
    api5xxPercent: number | null;
    api5xxExceeded: boolean;
    uploadRejectionPercent: number | null;
    uploadRejectionExceeded: boolean;
  };
  thresholds: {
    freeDiskWarningPercent: number;
    freeDiskHardStopPercent: number;
    pendingOldestWarningHours: number;
    cleanupStaleHours: number;
    backupStaleHours: number;
    assessmentFailureRatePercent: number;
    api5xxRatePercent: number;
    uploadRejectionRatePercent: number;
  };
}

export async function getOperationalHealth(): Promise<OperationalHealthPayload> {
  const cfg = getConfig().health;
  const prisma = getPrisma();

  const [
    snapshot,
    cleanupSuccessAt,
    cleanupFailureAt,
    backupSuccessAt,
    backupFailureAt,
    pendingCount,
    oldestPending,
    quarantineAgeMs,
    assessmentFailurePercent,
    api5xxPercent,
    uploadRejectionPercent,
  ] = await Promise.all([
    mediaCapacitySnapshot(),
    readSignal(CLEANUP_LAST_SUCCESS_KEY),
    readSignal(CLEANUP_LAST_FAILURE_KEY),
    readSignal(BACKUP_LAST_SUCCESS_KEY),
    readSignal(BACKUP_LAST_FAILURE_KEY),
    prisma.product.count({ where: { status: 'pending' } }),
    prisma.product.findFirst({ where: { status: 'pending' }, orderBy: { submittedAt: 'asc' }, select: { submittedAt: true } }),
    oldestQuarantineAgeMs(),
    currentRatePercent('assessment'),
    currentRatePercent('api5xx'),
    currentRatePercent('uploadRejection'),
  ]);

  const capacityStatus: 'ok' | 'warning' | 'critical' =
    snapshot.freePercent < cfg.freeDiskHardStopPercent
      ? 'critical'
      : snapshot.freePercent < cfg.freeDiskWarningPercent
        ? 'warning'
        : 'ok';

  const pendingOldestAgeHours = oldestPending?.submittedAt
    ? (Date.now() - oldestPending.submittedAt.getTime()) / (60 * 60 * 1000)
    : null;
  const pendingStale = pendingOldestAgeHours !== null && pendingOldestAgeHours > cfg.pendingOldestWarningHours;

  const cleanupAgeHours = hoursSince(cleanupSuccessAt);
  const cleanupStale = cleanupAgeHours === null || cleanupAgeHours > cfg.cleanupStaleHours;

  const backupAgeHours = hoursSince(backupSuccessAt);
  const backupStale = backupAgeHours === null || backupAgeHours > cfg.backupStaleHours;

  // `null` (no attempts yet this window) never counts as exceeded — there is
  // nothing to alert on when nothing has happened.
  const assessmentFailureExceeded = assessmentFailurePercent !== null && assessmentFailurePercent > cfg.assessmentFailureRatePercent;
  const api5xxExceeded = api5xxPercent !== null && api5xxPercent > cfg.api5xxRatePercent;
  const uploadRejectionExceeded = uploadRejectionPercent !== null && uploadRejectionPercent > cfg.uploadRejectionRatePercent;

  const overall: 'ok' | 'warning' | 'critical' =
    capacityStatus === 'critical'
      ? 'critical'
      : capacityStatus === 'warning' ||
          pendingStale ||
          cleanupStale ||
          backupStale ||
          assessmentFailureExceeded ||
          api5xxExceeded ||
          uploadRejectionExceeded
        ? 'warning'
        : 'ok';

  return {
    status: overall,
    capacity: { ...snapshot, status: capacityStatus },
    cleanup: { lastSuccessAt: cleanupSuccessAt, lastFailureAt: cleanupFailureAt, stale: cleanupStale },
    pending: { count: pendingCount, oldestAgeHours: pendingOldestAgeHours, stale: pendingStale },
    quarantine: { oldestAgeHours: quarantineAgeMs === null ? null : quarantineAgeMs / (60 * 60 * 1000) },
    backup: { lastSuccessAt: backupSuccessAt, lastFailureAt: backupFailureAt, stale: backupStale },
    rates: {
      assessmentFailurePercent,
      assessmentFailureExceeded,
      api5xxPercent,
      api5xxExceeded,
      uploadRejectionPercent,
      uploadRejectionExceeded,
    },
    thresholds: {
      freeDiskWarningPercent: cfg.freeDiskWarningPercent,
      freeDiskHardStopPercent: cfg.freeDiskHardStopPercent,
      pendingOldestWarningHours: cfg.pendingOldestWarningHours,
      cleanupStaleHours: cfg.cleanupStaleHours,
      backupStaleHours: cfg.backupStaleHours,
      assessmentFailureRatePercent: cfg.assessmentFailureRatePercent,
      api5xxRatePercent: cfg.api5xxRatePercent,
      uploadRejectionRatePercent: cfg.uploadRejectionRatePercent,
    },
  };
}
