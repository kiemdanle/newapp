---
phase: 3
title: "Testing & Verification"
status: pending
priority: P1
effort: "1h"
dependencies: [1, 2]
---

# Phase 3: Testing & Verification

<!-- Updated: Validation Session 1 - Undo Toast & Dual View Tests -->

## Overview
Comprehensive test coverage and on-device validation for the slide-left action menu on product drafts:
1. Component unit tests for `DraftSwipeableRow` and `DraftGridActionDrawer`.
2. Integration tests for `ProductDraftsScreen` covering swipe action presses, optimistic deletion, and the Undo toast.
3. Assemble Android debug APK via local Gradle toolchain and install via ADB to phone `96d9c774`.

## Test Plan
- Unit Tests:
  - `DraftSwipeableRow.test.tsx`:
    - Renders product name, cover/placeholder, and status pill.
    - Swiping exposes Edit, Add, and Delete action buttons.
    - Pressing Edit calls `onEdit`.
    - Pressing Add calls `onAddToPantry`.
    - Pressing Delete calls `onDelete`.
    - Hides Delete button on active catalog products.
  - `DraftGridActionDrawer.test.tsx`:
    - Renders action drawer with Edit, Add to Pantry, and conditional Delete button.
    - Action clicks trigger props and close drawer.
  - `product-drafts.test.tsx`:
    - Tests draft listing with `DraftSwipeableRow` and `DraftGridCard`.
    - Verifies instant deletion hides item and shows Undo toast.
    - Verifies pressing Undo cancels delete and restores item.
    - Verifies timeout expiry commits `useDiscardDraft` mutation.
- Device Verification:
  - Compile debug APK directly on local Gradle/Android toolchain:
    `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
  - Install to device `96d9c774`:
    `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  - Live verification of swipe gestures in both List and Grid views, action triggers, and Undo toast dismiss timing.

## Related Code Files
- Create: `apps/mobile/src/features/products/__tests__/DraftSwipeableRow.test.tsx`
- Create: `apps/mobile/src/features/products/__tests__/DraftGridActionDrawer.test.tsx`
- Modify: `apps/mobile/__tests__/routes/product-drafts.test.tsx`

## Success Criteria
- [ ] All Jest test suites pass in `apps/mobile`.
- [ ] No regression in existing product draft routes or pantry tests.
- [ ] Android APK builds successfully.
- [ ] Smooth physical swipe gesture confirmed on phone in both List and Grid view modes.
