---
phase: 5
title: "Automated Testing, APK Build, and Device Live Verification"
status: pending
priority: P1
effort: "3-4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Automated Testing, APK Build, and Device Live Verification

## Overview
Perform end-to-end verification of the mobile review system across all test suites, static typing, code formatting, Android debug APK compilation via local Gradle toolchain, installation to the connected physical device via `adb`, and live visual inspection of review creation and review reading.

## Requirements

### Automated Verification
- **Unit & Component Tests**:
  - `apps/mobile/tests/unit/api-reviews.test.ts`: 100% pass for React Query hooks and cache invalidation.
  - `apps/mobile/tests/unit/product-review-screen.test.tsx`: 100% pass for recommendation selection, text validation, submit mutation, and profanity feedback.
  - `apps/mobile/tests/unit/product-reviews-section.test.tsx`: 100% pass for sentiment banner, sort toggling, review cards, and helpfulness voting.
  - `apps/mobile/tests/unit/reviews-tab.test.tsx`: 100% pass for Reviews tab segmentation, personal reviews feed, and empty states.
- **Snapshot Suite**:
  - Update any modified screen snapshots (`home.test.tsx`, `reviews.test.tsx`).
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
    - Reviews hub tab showing personal reviews feed.

## Related Code Files
- Read: `apps/mobile/android/app/build.gradle`
- Test: `apps/mobile/tests/unit/touch-target.test.ts`
- Test: `apps/mobile/tests/snapshots/reviews.test.tsx`

## Implementation Steps

1. **Run Mobile Unit Test Suite**:
   - Execute all review test suites: `npm --prefix apps/mobile test tests/unit/api-reviews.test.ts tests/unit/product-review-screen.test.tsx tests/unit/product-reviews-section.test.tsx tests/unit/reviews-tab.test.tsx`.
   - Run complete suite: `npm --prefix apps/mobile test`.

2. **Run Monorepo Typecheck & Vendored Integrity**:
   - `npm --prefix apps/mobile run typecheck`.
   - `node scripts/check-vendored-shared-dist.mjs`.

3. **Assemble Debug Android APK**:
   - Execute Gradle assemble task with local Android SDK/JBR environment variables.
   - Verify build artifact `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

4. **Install & Verify On-Device**:
   - Stream install APK via `adb install -r`.
   - Launch `com.expyrico.app/.MainActivity`.
   - Capture device screenshots into `/tmp/` and inspect.

## Success Criteria
- [ ] All mobile unit and snapshot tests pass with 0 failures.
- [ ] Touch target test passes for all newly introduced buttons and pills (`minHeight: 44`).
- [ ] Typecheck passes with 0 TypeScript errors.
- [ ] Debug APK builds cleanly via Gradle in $<60\text{s}$.
- [ ] APK installs successfully via `adb` and launches on connected Android phone.
- [ ] Live visual verification confirms recommendation pills, review card rendering, and review tab navigation.

## Risk Assessment
- **Risk**: Android device disconnects or unauthorized during adb install.
- **Mitigation**: Verify `adb devices` reports `device` before running install.
