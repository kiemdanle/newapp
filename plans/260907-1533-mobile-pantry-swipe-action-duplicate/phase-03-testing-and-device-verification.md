---
phase: 3
title: "Testing & Device Verification"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1, 2]
---

# Phase 3: Testing & Device Verification

## Overview
Update existing unit tests in `RecordCard.test.tsx`, `PantryGridActionDrawer.test.tsx`, `PantryGridCard.test.tsx`, and `QuickEditModal.test.tsx`. Verify that saving with an empty expiry date is blocked and opens the date picker without stale fallbacks. Run full Jest test suites, typecheck, compile the Android debug APK with local Gradle, and verify live on the Xiaomi MI 9 device via ADB.

<!-- Updated: Validation Session 3 - Strict date validation & in-memory draft tests -->

## Requirements
- Functional:
  - Update `RecordCard.test.tsx`:
    - Remove test asserting `+1` action button.
    - Add test verifying `Edit / Duplicate / Delete` buttons rendered in correct order.
    - Add test verifying pressing `Duplicate` triggers `onDuplicate(mockRecord)` and closes swipeable.
  - Update `PantryGridActionDrawer.test.tsx`:
    - Remove test asserting `+1` action circle.
    - Add test asserting `Duplicate` circle is rendered with icon `copy-outline` and text `Duplicate`.
    - Add test verifying pressing `Duplicate` calls `onDuplicate(mockRecord)`.
    - Add test verifying pressing `Duplicate` is blocked when `isProcessing` is true.
  - Update `PantryGridCard.test.tsx`:
    - Remove `+1` test case.
    - Add test verifying tapping `Duplicate` inside the open drawer triggers `onDuplicate` callback.
  - Update `QuickEditModal.test.tsx`:
    - Add test asserting that attempting to save with an empty `expiryDate` blocks `onSave` and opens the date picker (`WheelDatePickerModal`).
    - Verify that `onSave` receives `trimmedExpiry` and never falls back to `record.expiryDate` when input is empty.
  - Integration tests in `RecordList.test.tsx`:
    - Verify that tapping `Duplicate` constructs draft with `expiryDate: ""` and opens modal.
    - Verify that canceling performs zero database writes.
    - Verify that saving invokes `createLocalRecord` with valid user-chosen date.
  - Run full Jest suite: `pnpm --filter mobile test`.
  - Run TypeScript typecheck: `pnpm --filter mobile typecheck` with 0 errors.
  - Build Android APK directly via local Gradle:
    `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
  - Install APK on device: `adb -s 96d9c774 install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  - Live device verification on Xiaomi MI 9:
    - Test List View: swipe left on item -> see `Edit | Duplicate | Delete`.
    - Tap `Duplicate` -> observe `QuickEditModal` open with blank expiry date ("Select expiry date").
    - Tap Cancel -> observe modal closes and no duplicate item was added to the pantry.
    - Tap `Duplicate` again -> tap Save without picking date -> observe date picker opens automatically.
    - Pick an expiry date (e.g. `20/09/2026`) and tap Save -> observe both items coexist in pantry list with distinct expiry dates.
    - Switch to Grid View: swipe left on card to reveal drawer -> see `Edit / Duplicate / Delete`.
    - Tap `Duplicate` -> observe same seamless behavior in Grid View.

## Success Criteria
- [x] All unit tests in `RecordCard.test.tsx`, `PantryGridActionDrawer.test.tsx`, `PantryGridCard.test.tsx`, and `QuickEditModal.test.tsx` pass.
- [x] Zero TypeScript errors in `apps/mobile`.
- [x] Debug APK builds cleanly with Gradle and installs onto Xiaomi MI 9.
- [x] Live device inspection confirms swipe actions order: `Edit`, `Duplicate`, `Delete`.
- [x] Empty expiry date blocks save in `QuickEditModal`.
- [x] Duplication flow functional on physical device in both List View and Grid View.
