---
phase: 5
title: "Automated Testing, Gradle Build, and Live Device Verification"
status: pending
priority: P1
effort: "2-3h"
dependencies: ["phase-01-schema-and-database-migrations", "phase-02-location-selector-components", "phase-03-form-integrations-quick-edit-and-add", "phase-04-pantry-filtering-and-card-badging"]
---

# Phase 5: Automated Testing, Gradle Build, and Live Device Verification

## Overview
Validate the entire end-to-end location selection, persistence, and filtering system across unit tests, TypeScript typechecking, local Android Gradle build (`assembleDebug`), and physical device verification via ADB.

## Requirements
- Functional:
  - 100% test passing rate across Jest and Vitest suites for all new components and modified features.
  - TypeScript type check passes with 0 errors across `@expyrico/shared`, `api`, and `apps/mobile`.
  - Android debug APK compiles cleanly with local Gradle toolchain (`assembleDebug`).
  - ADB installation and live device verification confirm:
    - Quick Edit renders 5-pill LocationSelector under Unit and above Expiry Date.
    - Selecting a location saves properly to local SQLite database.
    - Custom location sheet allows creating custom locations.
    - Location filter in Pantry Filter Modal works accurately with active filter chip.
- Non-functional:
  - Strictly adhere to Android build policy: no Expo CLI, EAS, or Expo Go. Local Gradle and ADB only.

## Verification Matrix

| Component / Layer | Verification Command | Target Result |
|-------------------|----------------------|---------------|
| Shared Schema | `npm --prefix packages/shared test` | All validation tests pass |
| Mobile Components | `npm --prefix apps/mobile test -- tests/unit/location-selector.test.tsx tests/unit/location-picker-modal.test.tsx` | All tests pass |
| Mobile Filters | `npm --prefix apps/mobile test -- apps/mobile/src/features/records/filterAndSortRecords.test.ts` | All filter tests pass |
| Mobile Forms | `npm --prefix apps/mobile test -- apps/mobile/src/features/records/QuickEditModal.test.tsx` | Form tests pass |
| Full Mobile Suite | `npm --prefix apps/mobile test` | All 140+ test suites pass |
| TypeScript | `npm --prefix apps/mobile run typecheck` | 0 type errors |
| Gradle Build | `cd apps/mobile && JAVA_HOME=... ANDROID_HOME=... ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug` | BUILD SUCCESSFUL |
| ADB Install | `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` | Success |
| Live Device | `adb exec-out screencap -p > /tmp/location_verify.png` | Vision analysis confirms UI |

## Related Code Files
- Modify: `apps/mobile/tests/unit/location-selector.test.tsx`
- Modify: `apps/mobile/tests/unit/location-picker-modal.test.tsx`
- Modify: `apps/mobile/src/features/records/filterAndSortRecords.test.ts`
- Modify: `apps/mobile/src/features/records/QuickEditModal.test.tsx`
- Modify: `apps/mobile/src/features/records/PantryFilterModal.test.tsx`

## Implementation Steps
1. **Automated Test Suite Execution**:
   - Run shared package unit tests: `npm --prefix packages/shared test`.
   - Run newly created and updated mobile unit tests:
     ```bash
     npm --prefix apps/mobile test -- \
       tests/unit/location-selector.test.tsx \
       tests/unit/location-picker-modal.test.tsx \
       apps/mobile/src/features/records/filterAndSortRecords.test.ts \
       apps/mobile/src/features/records/QuickEditModal.test.tsx \
       apps/mobile/src/features/records/PantryFilterModal.test.tsx
     ```
   - Run full regression suite across mobile app: `npm --prefix apps/mobile test`.

2. **TypeScript Compilation Check**:
   - Execute `npm --prefix apps/mobile run typecheck` and ensure zero diagnostic errors.

3. **Android Local Gradle Compilation**:
   - Compile Android debug APK directly on local workstation per policy:
     ```bash
     cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
     ```

4. **Streamed ADB Install**:
   - Install APK onto connected physical phone:
     ```bash
     adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
     ```

5. **Live Device Functional & Visual Verification**:
   - Launch app: `adb shell am start -n com.expyrico.app/.MainActivity`.
   - Trigger Quick Edit modal on a pantry item via ADB tap or swipe gesture.
   - Capture screenshot via ADB: `adb exec-out screencap -p > /tmp/screen_location.png`.
   - Perform vision analysis to verify:
     - 5-pill LocationSelector appears below Unit and above Expiry Date.
     - Pills match existing visual style (height 38, rounded pill, muted borders).
     - Tap selects "Fridge" and deselects on second tap.
     - Tapping "More ▾" displays `LocationPickerModal` with custom input.
     - Saving updates the card with the location badge.
     - Filter modal filters list by selected location.

## Success Criteria
- [ ] All automated tests pass without regressions.
- [ ] TypeScript typecheck passes with 0 errors.
- [ ] Local Gradle build succeeds.
- [ ] APK installs successfully onto attached device.
- [ ] Visual inspection confirms exact layout placement, styling, and behavior.

## Risk Assessment
- *Risk*: Physical device disconnected or unauthorized during ADB install.
- *Observable Signal*: `adb: no devices/emulators found` or `device unauthorized`.
- *Pre-decided Response*: Check `adb devices`, confirm authorization prompt on phone screen, re-run install.
