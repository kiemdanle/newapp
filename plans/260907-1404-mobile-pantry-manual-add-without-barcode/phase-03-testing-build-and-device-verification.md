---
phase: 3
title: "Testing Build and Device Verification"
status: pending
priority: P1
effort: "3h"
dependencies: [1, 2]
---

# Phase 3: Testing Build and Device Verification

## Overview
Implement automated unit and integration tests covering the manual add flow, compile the Android debug APK with local Gradle, and verify end-to-end functionality live on the connected physical device (Xiaomi MI 9).

## Requirements
- Functional:
  - Automated Jest test suite for `scan.test.tsx` verifying:
    - Render of `"Add without barcode"` button (`testID="scan-manual-add"`).
    - Tapping `"Add without barcode"` switches state to `manual-entry` without triggering camera lookups.
    - Route parameter `{ initialPhase: 'manual' }` boots directly into manual entry.
    - `CameraPermissionDeniedModal` allows triggering manual entry.
  - Automated tests for `AddRecordForm`:
    - Renders editable item name input when `productId` is null.
    - Rejects empty item names with validation error.
    - Category chips update category field.
    - Calls `createLocalRecord` with correct payload on submit.
  - Local Android debug APK compilation via Gradle (`:app:assembleDebug`).
  - Physical device installation via ADB (`adb -s 96d9c774 install -r`).
  - Live on-device verification:
    - Navigate from Home -> Scan an item -> Add without barcode.
    - Create a non-barcode item (e.g., `"Honeycrisp Apples"`, Category `"Produce"`, 4 pcs).
    - Save and confirm item appears in the In-Stock pantry list.
- Non-functional:
  - Zero TypeScript errors across mobile workspace (`pnpm --filter mobile typecheck`).
  - All existing mobile tests continue to pass (`pnpm --filter mobile test`).
  - Touch targets $\ge 44 \times 44\text{ pt}$ verified on device.

## Architecture
```
Verification Pipeline
┌────────────────────────────────────────────────────────┐
│ 1. TypeScript Validation (tsc --noEmit)                │
├────────────────────────────────────────────────────────┤
│ 2. Automated Jest Tests (scan.test.tsx, AddRecordForm) │
├────────────────────────────────────────────────────────┤
│ 3. Local Gradle Android Build (:app:assembleDebug)     │
├────────────────────────────────────────────────────────┤
│ 4. ADB Streamed Install on Xiaomi MI 9 (96d9c774)      │
├────────────────────────────────────────────────────────┤
│ 5. Live UIAutomator Hierarchy & Screencap Verification │
└────────────────────────────────────────────────────────┘
```

## Related Code Files
- Test: `apps/mobile/__tests__/routes/scan.test.tsx`
- Test: `apps/mobile/src/features/records/__tests__/AddRecordForm.test.tsx`
- Build: `apps/mobile/android/`

## Implementation Steps
1. Unit Tests:
   - Add test cases in `scan.test.tsx` for manual add button presence, tap interaction, and permission denied bypass.
   - Add test cases for `AddRecordForm` covering custom item name validation and category chip selection.
   - Run `pnpm --filter mobile test` and verify green.
2. Typecheck:
   - Run `pnpm --filter mobile typecheck` and verify 0 errors.
3. Gradle Build:
   - Execute:
     `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
4. ADB Installation:
   - Install APK:
     `adb -s 96d9c774 install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
5. Live Device Verification:
   - Launch app via ADB:
     `adb -s 96d9c774 shell am start -n com.expyrico.app/.MainActivity`
   - Tap `"Scan an item"` from Home tab.
   - Inspect UI hierarchy to verify `"Add without barcode"` button exists and is positioned correctly over the camera viewfinder.
   - Tap `"Add without barcode"`.
   - Fill out item name (`"Honeycrisp Apples"`), select `"Produce"` category chip, select expiry date, and tap `"Save"`.
   - Verify modal/screen closes and item is displayed in the active pantry inventory list.
   - Capture screenshot and visual confirmation.

## Success Criteria
- [ ] 100% passing Jest tests for scan and form manual add paths.
- [ ] Clean TypeScript typecheck (0 errors).
- [ ] Android APK successfully built and installed on Xiaomi MI 9.
- [ ] Live device test confirms manual creation of non-barcode produce/bakery/meat items works seamlessly from start to finish.

## Risk Assessment
- Risk: Jest mock for camera permissions or navigation might need updating for the new `initialPhase` param.
  - Mitigation: Use existing mock patterns in `tests/setup.ts` and `scan.test.tsx`.
- Risk: Android Gradle build cache staleness.
  - Mitigation: Gradle daemon incrementally builds in ~35-40 seconds.
