---
phase: 5
title: "Integration Tests and On-Device Verification"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-01-action-drawer-layout-and-styling", "phase-02-swipe-gesture-and-state-machine", "phase-03-record-list-callback-wiring", "phase-04-scroll-coordination-and-selection-guard"]
---

# Phase 5: Integration Tests and On-Device Verification

## Overview
Comprehensive test suite coverage across unit and integration layers, validating gesture interaction, mutual exclusivity, action execution, selection mode guards, local Gradle debug build, and real-device physical verification on Xiaomi Mi 9.

## Requirements
- Functional:
  - Unit tests in `PantryGridActionDrawer.test.tsx`:
    - Renders buttons: `record-add-quantity-{id}`, `record-edit-{id}`, `record-delete-{id}`, `record-close-actions-{id}`.
    - Calls callbacks on press.
  - Unit tests in `PantryGridCard.test.tsx`:
    - Swiping left or tapping 3-dots (•••) button shows the action drawer.
    - `isDrawerOpen={false}` springs back to the front card.
    - Gestures disabled when `selectionMode === true`.
  - Integration tests in `pantry-view-mode.test.tsx`:
    - Toggling to grid mode enables grid cards.
    - Swiping a grid card reveals the 3 floating action circles.
    - Tapping 3-dots button reveals the action drawer.
    - Tapping `+1` calls `patchLocalRecord` and closes drawer.
    - Swiping a second card closes the first card.
    - Scrolling the list closes the active drawer.
    - Non-owner household item does not render or permit Delete action.
    - Rapid double-tap on `+1` increments safely without duplicate stale quantity mutation.
    - Pressing hidden action buttons while drawer is closed is a no-op (`pointerEvents="none"`).
    - Long-press to activate selection mode closes any open drawer.
<!-- Updated: Red Team Session 1 - Adversarial edge cases test matrix -->
- Non-functional:
  - 100% Jest test suite pass rate (all 137+ test suites).
  - TypeScript strict typecheck with 0 diagnostics.
  - Local Android debug APK compiles cleanly with Gradle `:app:assembleDebug` per `AGENTS.md`.
  - Live verification via ADB install on Xiaomi Mi 9 (`96d9c774`).

## Test Matrix

| Action | Test Layer | Expected Result |
| :--- | :--- | :--- |
| Render action drawer | Unit | Displays 3 floating icon circles (+1, Edit, Delete) and [✕] with correct Expyrico theme colors |
| Tap 3-dots (•••) button | Unit & Integration | Opens the action drawer immediately |
| Tap `+1 Quantity` | Unit & Integration | Calls `onAddQuantity` / `patchLocalRecord`, closes drawer |
| Tap `Edit Item` | Unit & Integration | Opens `QuickEditModal`, closes drawer |
| Tap `Delete Item` | Unit & Integration | Prompts confirmation alert with resolved product `displayName` |
| Non-owner household item | Unit & Integration | Delete action is hidden/disabled; only creator can delete |
| Rapid double-tap `+1` | Unit & Integration | Debounce lock blocks second tap; writes single increment |
| Closed drawer touch | Unit | Hidden actions receive no touches (`pointerEvents="none"`) |
| Open second drawer | Integration | Active drawer switches; previous drawer snaps shut |
| Scroll SectionList | Integration | Active drawer resets to `null`; all cards closed |
| Selection Mode | Integration | Swiping disabled; open drawers closed; single tap toggles checkboxes |

## Implementation Steps
1. **Unit Test Suite**:
   Create `PantryGridActionDrawer.test.tsx` and update `PantryGridCard.test.tsx`.
2. **Integration Test Suite**:
   Add test cases to `tests/integration/pantry-view-mode.test.tsx`.
3. **Typecheck & Full Test Run**:
   `npm run typecheck && npm test`.
4. **Local Android Gradle Build & Install**:
   ```bash
   cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
   adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```
5. **Physical Device Screencap & Verification**:
   Capture screenshots on device to verify swipe motion, drawer styling, button contrast, and dismiss responsiveness.

## Success Criteria
- [x] All unit and integration test suites pass 100%.
- [x] `npm run typecheck` passes with 0 diagnostics.
- [x] Android APK builds in $< 45\text{s}$ and installs via ADB.
- [x] Screencap proves on-device gesture reveal and visual fidelity.

## Risk Assessment
- *Risk*: Gesture events in Jest tests require specific mocks for `react-native-gesture-handler`.
- *Mitigation*: The project's `tests/setup.ts` already mocks `react-native-gesture-handler` and `react-native-reanimated`; test triggers can invoke handlers or toggle `isDrawerOpen` directly.
