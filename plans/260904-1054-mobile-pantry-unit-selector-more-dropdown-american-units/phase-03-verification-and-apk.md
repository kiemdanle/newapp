---
phase: 3
title: "End-to-End Verification, APK Build, and Live Device Testing"
status: done
priority: P1
effort: "2-3h"
dependencies: [2]
---

# Phase 3: End-to-End Verification, APK Build, and Live Device Testing

## Overview
Perform end-to-end verification across automated unit tests, static typechecking, and Gradle Android APK compilation. Install the updated APK on the connected physical Android device via `adb` and capture live screenshots confirming that both the item edit modal (`QuickEditModal`) and new item creation form (`AddRecordForm`) display the 5-button unit selector with American imports support.

## Requirements

### Functional
- **Automated Test Suite Verification**:
  - Run all mobile unit tests:
    ```bash
    npm --prefix apps/mobile test tests/unit/unit-selector.test.tsx src/features/records/QuickEditModal.test.tsx
    ```
  - Run the full mobile unit test suite (30+ tests).
  - Run backend API integration tests (`pnpm --filter @expyrico/api test`).
- **Static Typecheck**:
  - `npm --prefix apps/mobile run typecheck` exits 0 with 0 errors.
  - `node scripts/check-vendored-shared-dist.mjs` verifies shared package dist is in sync.
- **Android APK Build & Install**:
  - Compile Android debug APK directly on local computer using the Gradle toolchain:
    ```bash
    cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
    ```
  - Install APK to connected phone:
    ```bash
    adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
    ```
- **Live Device Visual Verification**:
  - Open `QuickEditModal` on the device: capture screenshot verifying the 5-pill row `[ pcs ] [ pack ] [ can ] [ bottle ] [ More ▾ ]`.
  - Tap `More ▾`: capture screenshot verifying American imports (`oz`, `lb`, `fl oz`, `gal`, `pt`, `qt`) are clearly categorized and selectable.
  - Select `oz`: capture screenshot verifying the 5th pill displays `[ oz ▾ ]` in active Fresh Sage.
  - Save: verify the record updates with unit `"oz"` in local WatermelonDB and syncs to backend.

### Non-Functional
- **Compliance with Android Build Policy**: Do not use Expo CLI, EAS, or Expo dev workflows; local Gradle compilation and `adb` streaming only.
- **Visual Design Quality**: No clipping, no line-wrapping of the 5 pills, clean tap feedback adhering to `ak:ui-ux-pro-max` touch target standards (>= 44×44pt).

## Related Code Files
- `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` — Compiled debug Android package.

## Implementation Steps

1. **Test Execution**:
   - Run unit test suites for `UnitSelector` and `QuickEditModal`.
   - Run monorepo typechecks.

2. **Gradle Debug APK Compilation**:
   - Execute `:app:assembleDebug` with local Android SDK and Java 17 toolchain.

3. **Device Deployment via ADB**:
   - Install APK with `adb install -r`.
   - Launch application on device (`com.expyrico.app/.MainActivity`).

4. **Visual Verification**:
   - Capture device screenshots verifying:
     - 5-button row layout in `QuickEditModal`.
     - "More" picker sheet with American imports.
     - Active state reflection on the 5th pill.

## Success Criteria
- [x] Mobile unit tests pass 100% with 0 failures.
- [x] Backend integration tests pass 100%.
- [x] TypeScript typecheck exits 0.
- [x] Android APK builds successfully via Gradle in under 60 seconds.
- [x] APK installed to connected phone and verified live on-screen.
- [x] Screenshots confirm 10-button grid is replaced with clean 5-button row, and American units are fully functional.

## Risk Assessment
- **Risk**: Device USB debugging authorization or offline status during install.
- **Observable Signal**: `adb devices` shows device unauthorized or disconnected.
- **Mitigation**: Check `adb devices` before compilation and streaming.
