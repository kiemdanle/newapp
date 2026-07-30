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
  thresholds: {
    freeDiskWarningPercent: number;
    freeDiskHardStopPercent: number;
    pendingOldestWarningHours: number;
    cleanupStaleHours: number;
    backupStaleHours: number;
  };
}

export async function getOperationalHealth(): Promise<OperationalHealthPayload> {
  const cfg = getConfig().health;
  const prisma = getPrisma();

  const [snapshot, cleanupSuccessAt, cleanupFailureAt, backupSuccessAt, backupFailureAt, pendingCount, oldestPending, quarantineAgeMs] =
    await Promise.all([
      mediaCapacitySnapshot(),
      readSignal(CLEANUP_LAST_SUCCESS_KEY),
      readSignal(CLEANUP_LAST_FAILURE_KEY),
      readSignal(BACKUP_LAST_SUCCESS_KEY),
      readSignal(BACKUP_LAST_FAILURE_KEY),
      prisma.product.count({ where: { status: 'pending' } }),
      prisma.product.findFirst({ where: { status: 'pending' }, orderBy: { submittedAt: 'asc' }, select: { submittedAt: true } }),
      oldestQuarantineAgeMs(),
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

  const overall: 'ok' | 'warning' | 'critical' =
    capacityStatus === 'critical'
      ? 'critical'
      : capacityStatus === 'warning' || pendingStale || cleanupStale || backupStale
        ? 'warning'
        : 'ok';

  return {
    status: overall,
    capacity: { ...snapshot, status: capacityStatus },
    cleanup: { lastSuccessAt: cleanupSuccessAt, lastFailureAt: cleanupFailureAt, stale: cleanupStale },
    pending: { count: pendingCount, oldestAgeHours: pendingOldestAgeHours, stale: pendingStale },
    quarantine: { oldestAgeHours: quarantineAgeMs === null ? null : quarantineAgeMs / (60 * 60 * 1000) },
    backup: { lastSuccessAt: backupSuccessAt, lastFailureAt: backupFailureAt, stale: backupStale },
    thresholds: {
      freeDiskWarningPercent: cfg.freeDiskWarningPercent,
      freeDiskHardStopPercent: cfg.freeDiskHardStopPercent,
      pendingOldestWarningHours: cfg.pendingOldestWarningHours,
      cleanupStaleHours: cfg.cleanupStaleHours,
      backupStaleHours: cfg.backupStaleHours,
    },
  };
}
