export const DEFAULT_OFFSETS_DAYS = [3, 1, 0];

/**
 * Given a UTC expiry date (date-only) and a list of offsets in days,
 * return the absolute notification timestamps at 09:00 UTC, deduplicated,
 * sorted ascending, with past timestamps removed.
 */
export function computeNotifyAt(
  expiryDate: Date,
  offsetsDays: number[] = DEFAULT_OFFSETS_DAYS,
  now: Date = new Date(),
): string[] {
  const out = new Set<string>();
  for (const offset of offsetsDays) {
    const ts = new Date(expiryDate.getTime());
    ts.setUTCDate(ts.getUTCDate() - offset);
    ts.setUTCHours(9, 0, 0, 0);
    if (ts.getTime() > now.getTime()) {
      out.add(ts.toISOString());
    }
  }
  return [...out].sort();
}

/**
 * Resolve the offsets to use for a user when the request did not specify any.
 * Reads `users.notificationPreferences.offsetsDays`, falling back to the
 * default [3,1,0] when the column is null or malformed. An explicit
 * per-request `notificationOffsetsDays` (passed by the caller) takes
 * precedence over this and should be applied before calling here.
 */
export function resolveOffsetsForUser(prefs: unknown): number[] {
  if (prefs && typeof prefs === 'object') {
    const offs = (prefs as { offsetsDays?: unknown }).offsetsDays;
    if (Array.isArray(offs) && offs.every((n) => typeof n === 'number')) {
      return offs as number[];
    }
  }
  return DEFAULT_OFFSETS_DAYS;
}
