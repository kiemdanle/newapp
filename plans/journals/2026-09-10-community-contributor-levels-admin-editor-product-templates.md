---
title: "Community Contributor Levels, Admin Editor & Product Templates"
date: 2026-09-10
summary: "Implemented 10-tier contributor leveling system, admin levels customizer & toggle, community contributions screen, and universal template slide actions"
---

# Community Contributor Levels, Admin Editor & Product Templates

## What happened
Implemented end-to-end community contributor levels, an Admin Dashboard level customizer and master toggle, separated public Community Contributions from personal quick-add Product Templates, and added universal slide-left Edit, Add, and Delete actions across all templates.

## Key Changes
1. `@expyrico/shared`:
   - Added seeded `DEFAULT_CONTRIBUTOR_LEVELS` (10 tiers) with strict Expyrico palette token schemas (`expyricoBadgeColorTokenSchema`).
   - Implemented `computeContributorProgression` with dual-gated points & products progression requirements and Level 0 (Unranked) state.
2. `api`:
   - Added `isDismissedFromTemplates` to `Product` model with composite index `@@index([createdByUserId, isDismissedFromTemplates, status])`.
   - Added `@@index([uploadedByUserId, productId])` on `ProductPhoto` and `@@index([submittedBy, status, productId])` on `ProductEdit`.
   - Mounted `GET /v1/me/contributions` under `meRoutes` with live ladder payload and cross-user XP isolation.
   - Updated `discardDraft` to mark active/pending items `isDismissedFromTemplates = true` instead of 409 Conflict, preserving catalog assets.
   - Mounted `GET` and `PATCH /v1/admin/settings/contributor-levels` with audit logging and fallback to defaults in `getSetting`.
3. `apps/admin`:
   - Added Settings > Contributor levels page with master toggle, 10-tier interactive table editor, Expyrico color token chip selector, and reset button.
4. `apps/mobile`:
   - Added `ContributorHeroCard` on Profile with animated progress bar and tap-to-open `ContributorLevelRoadmapModal`.
   - Built `CommunityContributionsScreen` listing catalog contributions with filter tabs (All, Approved, In Review, Changes Requested), search, and contextual review/edit navigation.
   - Updated Product Templates screen with universal slide-left Edit, Add to Pantry (with custom record contract for unsubmitted drafts), and Delete (with 5-second Undo banner) across all items.
5. Verification:
   - 161 shared unit tests passed.
   - 59 API integration tests passed.
   - 39 mobile tests passed across all 3 suites.
   - Workspace typecheck passed with 0 errors.
   - Local Gradle APK build successful in 19s and stream-installed to Xiaomi device `96d9c774`.
   - Live on-device screenshots captured and verified.
6. Code Review & Advisor Concerns Remediation:
- Restored unconditional `CREATE INDEX IF NOT EXISTS` in `migration.sql` for fail-fast prerequisite enforcement.
- Fixed `products-schema.test.ts` upgrade fixture replay to partition pre-A migrations, Migration A, and post-A migrations in chronological order.
- Normalized `user-contributions-and-dismissal.test.ts` fixture to `image/webp` matching schema constraints.
- Updated `DraftSwipeableRow.test.tsx` and `DraftGridActionDrawer.test.tsx` to assert universal Edit/Add/Delete contract.
- Added fake-timer 300ms debounce verification to `community-contributions.test.tsx`.
- Ran `products-schema.test.ts` in isolation (30/30 passing) and full regression sweep across all packages.

## Next Steps
Deploy updated API backend to production so `/v1/me/contributions` is live on the cloud host.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
