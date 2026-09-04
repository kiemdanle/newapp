---
phase: 6
title: "Automated Testing, APK Build, and Device Live Verification"
status: pending
priority: P1
effort: "3-4h"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Automated Testing, APK Build, and Device Live Verification

## Overview
Perform end-to-end verification of the full-stack review system across all test suites, static typing, code formatting, Android debug APK compilation via local Gradle toolchain, installation to the connected physical device via `adb`, and live visual inspection of review creation and review reading.

<!-- Updated: Red Team Review Round 4 - Added integration tests for partial unique index duplicate report concurrency (P2002 -> 409), spec §2.8 distinct reporter auto-hide threshold (>3), and sanitized public review DTO -->

## Requirements

### Automated Verification
- **Backend Integration Tests**:
  - `api/tests/integration/reviews-community.test.ts`:
    - Keyset cursor pagination with deterministic tie-breaker.
    - Sorting by score and by newest.
    - Exclusion of hidden reviews, deleted reviews, and draft products.
    - Inclusion of both `user` and `product` projections with sanitized author DTO.
    - Correct resolution of viewer `myVote`.
  - `api/tests/integration/reviews-update.test.ts`:
    - Clean -> hidden transition triggers product rating recalculation.
    - Hidden -> visible transition triggers product rating recalculation.
    - Rating-only -> written comment transition recalculates `reviewCount`.
    - Written comment -> null transition recalculates `reviewCount`.
    - Atomic write prevents resurrection of soft-deleted review.
  - `api/tests/integration/reviews-helpful.test.ts`:
    - Rejection of author self-vote with `403 FORBIDDEN`.
    - Verification of thumbs-up only (POST `ReviewHelpful` -> DELETE).
    - Rejection of `{ helpful: false }` or conversion to thumbs-up only.
  - `api/tests/integration/reports-create.test.ts`:
    - Concurrent duplicate open reports trigger database partial unique constraint `reports_open_per_reporter_target_idx` returning `409 CONFLICT`.
    - `maybeAutoHide` requires $>3$ distinct reporters across `open` and `resolved` reports to auto-hide content.
  - `api/tests/integration/reviews-rate-limits.test.ts`:
    - Verifies 429 status when exceeding read (60/min), write (15/min), and vote (30/min) limits.
- **Mobile Unit & Component Tests**:
  - `apps/mobile/tests/unit/api-reviews.test.ts`:
    - React Query hooks and cache invalidation targeting `['products', productId]`.
    - Optimistic voting cache transitions (`null -> helpful`, `helpful -> null`, and rollback on error).
  - `apps/mobile/tests/unit/product-review-screen.test.tsx`:
    - Authoritative edit vs. create mode via `useMyProductReview`.
    - 3 recommendation pills with Expyrico palette (neutral Stone/Pebble for `wont_buy`).
    - Character counter (`0/2000`).
    - Explicit `body: null` submission when comment is cleared in edit mode.
    - Moderation feedback panel for profanity-flagged reviews.
  - `apps/mobile/tests/unit/product-reviews-section.test.tsx`:
    - Sentiment percentage calculation strictly using `product.ratingCount` as denominator (never exceeding 100%).
    - Sorting pills (`Top helpful` and `Newest`).
    - Self-vote suppression when viewer is author.
    - Helpful vote optimistic update.
  - `apps/mobile/tests/unit/reviews-hub.test.tsx`:
    - Navigation from ProfileScreen ActionRow to ReviewsHub.
    - Segmented toggle between My Reviews and Community.
    - Infinite scroll and empty state rendering.
- **Snapshot Suite**:
  - Update any modified screen snapshots (`profile.test.tsx`, `home.test.tsx`).
- **Monorepo Integrity**:
  - Mobile typecheck: `npm --prefix apps/mobile run typecheck` (0 errors).
  - Touch target audit: `npm --prefix apps/mobile test tests/unit/touch-target.test.ts` (all interactive components `minHeight >= 44`).
  - Vendored dist check: `node scripts/check-vendored-shared-dist.mjs` (must exit 0 with "OK - vendored dist matches a fresh build of packages/shared").

### Build & Device Installation Policy
- Strictly adhere to Project Instructions:
  - Do NOT use Expo CLI, EAS, Expo Go, or Expo dev workflows.
  - Build Android debug APK directly with local Gradle/Android toolchain:
    ```bash
    cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
    ```
  - Install to connected Android device (`96d9c774`) via `adb`:
    ```bash
    adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
    ```
  - Launch app:
    ```bash
    adb shell am start -n com.expyrico.app/.MainActivity
    ```
  - Capture and verify screenshots on device:
    - Product detail screen showing Community Reviews section and "Write a Review" button.
    - Review submission screen showing 3 recommendation pills and text body.
    - Reviews hub tab showing personal reviews feed and community picks.

## Related Code Files
- Read: `apps/mobile/android/app/build.gradle`
- Test: `api/tests/integration/reviews-community.test.ts`
- Test: `api/tests/integration/reviews-update.test.ts`
- Test: `api/tests/integration/reviews-helpful.test.ts`
- Test: `api/tests/integration/reports-create.test.ts`
- Test: `api/tests/integration/reviews-rate-limits.test.ts`
- Test: `apps/mobile/tests/unit/touch-target.test.ts`
- Test: `apps/mobile/tests/unit/reviews-hub.test.tsx`

## Implementation Steps

1. **Run Backend Integration Tests**:
   - `pnpm --filter @expyrico/api test tests/integration/reviews-community.test.ts tests/integration/reviews-update.test.ts tests/integration/reviews-helpful.test.ts tests/integration/reports-create.test.ts tests/integration/reviews-rate-limits.test.ts tests/integration/my-reviews.test.ts`.

2. **Run Mobile Unit Test Suite**:
   - Execute all review test suites: `npm --prefix apps/mobile test tests/unit/api-reviews.test.ts tests/unit/product-review-screen.test.tsx tests/unit/product-reviews-section.test.tsx tests/unit/reviews-hub.test.tsx`.
   - Run complete suite: `npm --prefix apps/mobile test`.

3. **Run Monorepo Typecheck & Vendored Integrity**:
   - `npm --prefix apps/mobile run typecheck`.
   - `node scripts/check-vendored-shared-dist.mjs`.

4. **Assemble Debug Android APK**:
   - Execute Gradle assemble task with local Android SDK/JBR environment variables.
   - Verify build artifact `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

5. **Install & Verify On-Device**:
   - Stream install APK via `adb install -r`.
   - Launch `com.expyrico.app/.MainActivity`.
   - Capture device screenshots into `/tmp/` and inspect.

## Success Criteria
- [ ] All backend and mobile unit/integration tests pass with 0 failures.
- [ ] Database partial unique index on open reports prevents concurrent duplicate reports.
- [ ] Touch target test passes for all newly introduced buttons and pills (`minHeight: 44`).
- [ ] Typecheck passes with 0 TypeScript errors.
- [ ] Debug APK builds cleanly via Gradle in $<60\text{s}$.
- [ ] APK installs successfully via `adb` and launches on connected Android phone.
- [ ] Live visual verification confirms recommendation pills, review card rendering, and reviews hub navigation.
