export type ExpiryStatus = 'green' | 'amber' | 'red';

export const DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS = 7;

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Map an ISO date-only expiry (YYYY-MM-DD) to a traffic-light status.
 * - red:   expired or expires today (expiry <= today)
 * - amber: expires within the "expiring soon" threshold (1…thresholdDays out)
 * - green: beyond the threshold
 * thresholdDays comes from the user's expiring_soon_threshold_days (default 7).
 */
export function expiryStatus(
  expiryDate: string,
  now: Date = new Date(),
  thresholdDays: number = DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
): ExpiryStatus {
  const today = startOfDayUtc(now);
  const exp = startOfDayUtc(new Date(`${expiryDate}T00:00:00Z`));
  const days = Math.round((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'red';
  if (days <= thresholdDays) return 'amber';
  return 'green';
}

/** Maps a status to the matching theme color token name. */
export const EXPIRY_STATUS_TOKEN: Record<ExpiryStatus, 'success' | 'warning' | 'danger'> = {
  green: 'success',
  amber: 'warning',
  red: 'danger',
};
