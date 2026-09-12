---
phase: 4
title: "Admin Dashboard Adaptation & End-to-End Verification"
status: pending
priority: P1
effort: "5h"
dependencies: ["phase-01-start.md", "phase-02-mobile-review-form-streamlining.md", "phase-03-mobile-display-cards-and-feed-overhaul.md"]
---

# Phase 4: Admin Dashboard Adaptation & End-to-End Verification

## Overview
Adapt the Admin moderation console and analytics pages to display and filter reviews by 1-to-5 star ratings instead of the tri-state recommendation enum. Complete full-stack verification with automated test suites, typechecks, Gradle Android APK build, and on-device testing.

## Requirements
- Functional:
  - `apps/admin/src/app/(admin)/reviews/page.tsx`:
    - Replace `RATING_LABEL` (`buy_again: 'Buy again'`) with star labels:
      - `5`: `5 Stars ★★★★★`
      - `4`: `4 Stars ★★★★☆`
      - `3`: `3 Stars ★★★☆☆`
      - `2`: `2 Stars ★★☆☆☆`
      - `1`: `1 Star ★☆☆☆☆`
    - Update rating filter dropdown options to 1–5 stars.
    - Display star rating pill in the reviews table.
  - `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`:
    - Display star rating in review detail view.
  - `apps/admin/src/app/(admin)/analytics/reviews/page.tsx` (and `api/src/services/admin/analytics.ts`):
    - Update review breakdown analytics to show star rating distribution (percentage of 5★, 4★, 3★, 2★, 1★).
- Non-functional:
  - Zero TypeScript errors across `@expyrico/shared`, `api`, `apps/admin`, and `apps/mobile`.
  - Clean local Gradle Android build and successful ADB installation.
  - Live on-device verification of the streamlined review submission and display screens.

## Architecture
- `apps/admin/src/app/(admin)/reviews/`:
  - Admin review moderation interface for filtering and managing flagged/reported reviews.
- Full-stack test pipeline:
  - API integration tests (`pnpm --filter api test`).
  - Mobile unit tests (`pnpm --filter mobile test`).
  - Repo typecheck (`pnpm -r typecheck`).

## Related Code Files
- Modify:
  - `apps/admin/src/app/(admin)/reviews/page.tsx`
  - `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`
  - `api/src/services/admin/analytics.ts`
  - `api/tests/integration/admin/reviews.test.ts`
  - `api/tests/integration/admin-product-merge.test.ts`

## Implementation Steps
1. Update `apps/admin/src/app/(admin)/reviews/page.tsx` and `[id]/page.tsx` to display and filter star ratings.
2. Update admin analytics services in `api/src/services/admin/analytics.ts`.
3. Update admin review tests.
4. Run full workspace typecheck:
   `pnpm --filter @expyrico/shared typecheck && pnpm --filter api typecheck && pnpm --filter admin typecheck && pnpm --filter mobile typecheck`
5. Run full test suites:
   `pnpm --filter api test && pnpm --filter mobile test`
6. Build Android APK using local Gradle toolchain:
   `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
7. Install on connected phone (`adb install -r`) and capture screencaps of:
   - Streamlined review submission form with only 1-to-5 star selector.
   - Streamlined review cards with star ratings.

## Success Criteria
- [ ] Admin reviews console displays star ratings (1-5 stars) and allows filtering by stars.
- [ ] All API integration tests and mobile unit tests pass with zero regressions.
- [ ] Workspace typecheck exits 0 across all 4 packages.
- [ ] Android APK builds and installs cleanly on physical device (`96d9c774`).
- [ ] Physical device screencaps prove complete removal of "Buy again", "Buy on sale", and "Won't buy" options.

## Risk Assessment
- **Risk**: Database query timeouts when aggregating average star ratings across large product tables.
  - **Mitigation**: `average_rating` is stored directly on `products` table and maintained during review mutations, avoiding expensive full-table scans.
