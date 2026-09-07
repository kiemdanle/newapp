---
title: Fix pantry item fresh status duplicate expiry date
date: 2026-09-06
summary: Display days until expiration for fresh items instead of duplicating date
---

# Fix pantry item fresh status duplicate expiry date

Display days until expiration for fresh items instead of duplicating date

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Problem
In the pantry item detail screen (`apps/mobile/app/(app)/record/[id].tsx`), the 2-column Bento Stat Cards include an Expiry Card displaying a primary value (`bentoValue`) and subtext (`bentoSubtext`).
- For items nearing expiry ($\le 7$ days), `getRelativeExpiryLabel` returned relative labels (e.g. `In 3 days`), while `bentoSubtext` displayed the formatted date (e.g. `09/09/2026`).
- However, for fresh items ($> 7$ days), `getRelativeExpiryLabel` fell back to `formatDate(expiryDateStr, country)`, matching the subtext exactly and resulting in duplicated dates on the card (e.g. `10/15/2026` above `10/15/2026`).

## Root Cause
In `getRelativeExpiryLabel`:
```typescript
if (diffDays <= 7) return `In ${diffDays} days`;
return formatDate(expiryDateStr, country);
```
The hardcoded 7-day cutoff forced fresh items to fall back to the formatted calendar date instead of relative days.

## Fix
1. Updated `getRelativeExpiryLabel` in `apps/mobile/app/(app)/record/[id].tsx` to calculate `diffDays` with UTC date normalization (aligning with `expiryStatus` calculation) and return `In ${diffDays} days` for any future date $> 1$ day out.
2. Preserved special cases:
   - Negative diffDays: `${Math.abs(diffDays)}d overdue`
   - Zero diffDays: `Expires today`
   - 1 day: `Tomorrow`
   - $> 1$ day: `In ${diffDays} days`
   - Invalid/empty: fallback to `formatDate` or empty string
3. Added comprehensive unit tests in:
   - `apps/mobile/tests/unit/record-relative-expiry.test.ts`
   - `apps/mobile/tests/unit/record-detail-expiry-card.test.tsx`

## Verification
- Unit tests pass: 9/9 tests across both test suites.
- Full test suite passes: 32 test suites in `apps/mobile/tests/unit/` (194 tests).
- TypeScript check passes cleanly (`npm --prefix apps/mobile run typecheck`).
