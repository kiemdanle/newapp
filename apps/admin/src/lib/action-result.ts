import type { MergeIdentifierConflict } from '@expyrico/shared';

/**
 * The result shape every Phase 6 moderation server action returns instead of
 * throwing. A thrown `ApiError` does not survive a Server Action boundary with
 * its subclass/fields intact (Next.js reconstructs a plain `Error` client-side,
 * carrying only a message/digest) — so the structured fields the UI needs
 * (`code`, `currentVersion`, `identifierConflict`) must travel back as a plain,
 * serializable return value instead.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      detail?: string | undefined;
      currentVersion?: number | undefined;
      identifierConflict?: MergeIdentifierConflict | undefined;
    };

// reviewer-p6 M2: `version_conflict` is nearly unreachable on the routes that
// supply their own version token server-side (revision resolve/recover) — what
// an admin actually hits there is `edit_base_stale` (the live product moved
// since this revision was based on it) or `conflict` ("already resolved").
// Both are exactly as real a conflict as `version_conflict` and get the same
// refresh affordance; treating only `version_conflict` this way left the two
// *more* likely codes as unexplained dead ends.
const CONFLICT_CODES = new Set(['version_conflict', 'edit_base_stale', 'conflict']);

export function isConflictCode(code: string): boolean {
  return CONFLICT_CODES.has(code);
}

/**
 * Renders an `ActionResult` failure for inline display. Conflict codes and
 * `identifier_conflict` get fixed, actionable copy — the console never invites
 * a blind retry against a row that's since changed; the admin must refresh
 * (or, for merge, pick a different identifier) and re-review before acting
 * again.
 */
export function actionErrorMessage(result: Extract<ActionResult<unknown>, { ok: false }>): string {
  if (result.code === 'edit_base_stale') {
    return 'The live product changed since this revision was based on it. Refresh to review the current version — recovery (rebase/supersede) is the next step.';
  }
  if (isConflictCode(result.code)) {
    return 'This record changed since you loaded it. Refresh the page and review the current version before trying again.';
  }
  if (result.code === 'identifier_conflict' && result.identifierConflict) {
    const { slot, sourceValue, targetValue } = result.identifierConflict;
    return `Merge blocked: the source and target have different ${slot} values (${sourceValue} vs ${targetValue}). Resolve the conflict before merging.`;
  }
  return result.detail ?? `Action failed (${result.code}).`;
}
