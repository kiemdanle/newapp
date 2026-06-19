# Expyrico Admin Rename — String Replacement Sweep

**Date**: 2026-06-19 11:16
**Severity**: Low
**Component**: apps/admin (UI labels), api (backend user-facing text)
**Status**: Resolved

## What Happened

Product decision: rename all user-visible "Pantry" / "Pantry Admin" strings to "Expyrico" / "Expyrico Admin" across the admin interface and backend user-facing text. This was a pure string-replacement pass — no functional changes, no identifier migrations.

Scope: 8 string replacements across 6 files. Internal identifiers (cookie names, package scope `@pantry/*`, `User-Agent` header) were intentionally left untouched to avoid breaking auth/session contracts.

## The Brutal Truth

This was a tedious, low-risk sweep that still made me nervous. String renames feel safe until you realize some "Pantry" string is actually a cookie name or a Prisma enum that the mobile app depends on. I triple-checked every hit before touching it. The exhausting reality of renames is that grep lies — what looks like a label is often a key.

## Technical Details

Files touched:
- `apps/admin/src/app/login/login-form.tsx` — page title "Pantry Admin" → "Expyrico Admin"
- `apps/admin/src/app/(admin)/settings/admins/page.tsx` — invite modal title + toast
- `apps/admin/src/app/(admin)/settings/admins/admin-invite-form.tsx` — dialog title
- `apps/admin/src/app/(admin)/settings/moderation/page.tsx` — page heading + toast
- `apps/admin/src/app/(admin)/settings/notification-templates/page.tsx` — page heading + toast
- `apps/admin/src/app/(admin)/system/queue/page.tsx` — page heading
- `api/src/app/login/route.ts` — email subject "Pantry Admin" → "Expyrico Admin"

Left untouched (internal identifiers):
- `PANTRY_ADMIN_TOKEN` cookie name
- `X-Pantry-Admin-User-Agent` header
- `@pantry/*` package scope
- Prisma schema / database identifiers

Verification:
- `pnpm typecheck` in `apps/admin` — clean (0 errors)
- `pnpm test` in `apps/admin` — all 17 unit tests pass
- Manual spot-check of login page, settings pages, queue page

## What We Tried

N/A — single-pass replacement with verification. No iteration needed.

## Root Cause Analysis

Not a bug; a product rebrand. The real risk was collateral damage to internal identifiers. We avoided it by scoping the sweep to JSX text nodes and email subjects only.

## Lessons Learned

1. **Never do global find-and-replace on a monorepo.** Use `git grep` with context, review every hit individually.
2. **Cookie names and headers are API surface.** Changing them breaks clients silently. Always treat them as immutable unless you're coordinating a migration.
3. **Run typecheck + tests even for "just strings" changes.** TypeScript can catch JSX arity issues if you accidentally split a string across lines wrong.
4. **Document what you DIDN'T change.** The next person will see "Pantry" in a cookie name and wonder if it was missed. Now they know it was intentional.

## Next Steps

- Mobile app audit: check if any user-facing "Pantry" strings remain in `apps/mobile` (separate task, out of scope for this session).
- Marketing site / landing page: likely has "Pantry" references that need a parallel pass.
- No follow-up needed for admin/api — the rename is complete and verified.
