---
phase: 6
title: "Automated Testing & Verification"
status: pending
priority: P1
effort: "4h"
dependencies: ["1", "2", "3", "4", "5"]
---

# Phase 6: Automated Testing & Verification

## Overview
Execute comprehensive verification across all updated packages (`@expyrico/shared`, `api`, `apps/mobile`, `apps/admin`), update all regression test suites to assert recommendation behavior, and build and verify the mobile application on Android.

## Requirements
- Functional:
  - Update all tests across the repository that previously asserted star ratings or stars counts to assert recommendation options and counters.
  - Verify complete end-to-end user journeys:
    1. Authenticated user navigates to product details and taps "Write a review".
    2. Form presents `Buy again`, `Buy on sale`, and `Won't buy` options (zero star rating elements).
    3. User selects `Buy again` and submits optional comment.
    4. Review immediately appears in `ProductReviewsSection` and `reviews.tsx` with `Buy again` badge.
    5. Product sentiment updates to include the new recommendation.
    6. User taps to edit review, changes recommendation to `Buy on sale`, and verifies updated badge.
    7. Admin console lists review under `Buy on sale` sentiment.
- Non-functional:
  - 100% automated test pass rate across all packages.
  - 0 TypeScript errors across all workspaces (`pnpm --filter shared typecheck`, `pnpm --filter api typecheck`, `pnpm --filter mobile typecheck`, `pnpm --filter admin typecheck`).
  - Android debug APK builds cleanly with local Gradle toolchain.

## Related Code Files
- Modify: `packages/shared/src/schemas/review.ts`
- Modify: `api/tests/unit/schemas-review.test.ts`
- Modify: `api/tests/unit/products-serializer.test.ts`
- Modify: `api/tests/unit/errors.test.ts`
- Modify: `apps/mobile/tests/unit/api-reviews.test.tsx`
- Modify: `apps/mobile/tests/unit/product-review-screen.test.tsx`
- Modify: `apps/mobile/tests/unit/product-reviews-page.test.tsx`
- Modify: `apps/mobile/tests/unit/product-reviews-section.test.tsx`
- Modify: `apps/mobile/tests/unit/reviews-hub.test.tsx`
- Modify: `apps/mobile/__tests__/routes/product-detail.test.tsx`
- Modify: `apps/admin/src/app/(admin)/reviews/page.tsx`

## Implementation Steps
1. Run shared package tests & typechecks:
   ```bash
   pnpm --filter @expyrico/shared test
   pnpm --filter @expyrico/shared typecheck
   ```
2. Run backend API tests & typechecks:
   ```bash
   pnpm --filter api test
   pnpm --filter api typecheck
   ```
3. Run mobile tests & typechecks:
   ```bash
   pnpm --filter mobile test
   pnpm --filter mobile typecheck
   ```
4. Run admin tests & typechecks:
   ```bash
   pnpm --filter admin test
   pnpm --filter admin typecheck
   ```
5. Build Android debug APK per repo policy:
   ```bash
   cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
   ```
6. Verify physical/emulator device install via `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
7. Production Deployment & Live Verification:
   - Run Prisma migration on production database:
     ```bash
     DATABASE_URL="<production-postgres-url>" pnpm --filter api exec prisma migrate deploy
     ```
   - Confirm backend and admin containers are refreshed to serve updated build.
   - Verify live endpoint response with admin authorization:
     ```bash
     curl -sS -H "Authorization: Bearer <admin-token>" "https://<api-domain>/v1/products/<id>/reviews" | jq '.items[0].rating'
     ```

## Success Criteria
- [x] All test suites across shared, api, mobile, and admin pass with 100% success.
- [x] Zero TypeScript errors in all packages.
- [x] Android APK builds successfully without Gradle or React Native errors.
- [x] Visual inspection confirms 3-option recommendation pills and total absence of star ratings.

## Risk Assessment
- **Risk:** Stale snapshots or mock data retaining legacy star assertions.
  - *Observable signal:* Unit test assertion failures expecting `out of 5 stars` or `stars.0`.
  - *Mitigation:* Audit all test files matching `test.tsx` or `test.ts` under `apps/mobile` and `api` for `stars`.
