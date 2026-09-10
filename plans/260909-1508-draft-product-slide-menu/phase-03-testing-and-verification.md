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
<!-- Updated: Red Team Review Session 1 - Failure Rollback & Multi-Draft Queue Tests -->

## Overview
Comprehensive test coverage and on-device validation for the slide-left action menu on product drafts:
1. Component unit tests for `DraftSwipeableRow` and `DraftGridActionDrawer`.
2. Integration tests for `ProductDraftsScreen` covering swipe action presses, multi-draft discard queue, failure rollback, and the Undo toast.
3. Assemble Android debug APK via local Gradle toolchain and install via ADB to phone `96d9c774`.

## Test Plan
- Unit Tests:
  - `DraftSwipeableRow.test.tsx`:
    - Renders product name, cover/placeholder, and status pill.
    - Swiping exposes Edit, Add, and Delete action buttons.
    - Pressing Edit calls `onEdit`.
    - Pressing Add calls `onAddToPantry`.
    - Pressing Delete calls `onDelete`.
    - Hides Delete button on active/pending catalog products.
    - Hides Add to Pantry button on unsubmitted draft/changes_required products.
  - `DraftGridActionDrawer.test.tsx`:
    - Renders action drawer with Edit, conditional Add to Pantry, and conditional Delete button.
    - Action clicks trigger props and close drawer.
  - `product-drafts.test.tsx`:
    - Tests draft listing with `DraftSwipeableRow` and `DraftGridCard`.
    - Verifies instant deletion hides item into `pendingDiscards` and shows Undo toast.
    - Verifies rapid dual deletion: deleting A at t=0 and B at t=1 keeps both hidden without prematurely dispatching DELETE for A before t=5.
    - Verifies pressing Undo cancels delete and restores item.
    - Verifies mutation failure triggers rollback: restores item from `pendingDiscards` and displays error alert.
    - Verifies contextual Edit routing by item status.
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
