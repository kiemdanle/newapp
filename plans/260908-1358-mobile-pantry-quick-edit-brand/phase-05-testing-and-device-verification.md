---
phase: 5
title: "Testing & Device Verification"
status: pending
priority: P1
effort: "45m"
dependencies: ["4"]
---

# Phase 5: Testing & Device Verification

## Overview
Execute comprehensive multi-layer automated tests across shared schemas, backend API, and mobile React Native components, followed by physical Android device build, install, and live UI screencap verification.

## Requirements
- Functional:
  - Run shared package unit tests covering `brand` schema validation.
  - Run backend API integration tests covering `brand` persistence and sync.
  - Run mobile Jest test suites covering `QuickEditModal`, `RecordCard`, `RecordList`, `filterAndSortRecords`, and touch targets.
  - Run full TypeScript typecheck on `apps/mobile` and `api`.
  - Build Android APK via local Gradle, install via ADB to physical device, open `QuickEditModal`, and capture visual proof of the Brand field directly below Item Name.
- Non-functional:
  - Strict compliance with `AGENTS.md` Android build policy (NO Expo CLI / EAS / Go).
  - Touch target size $\ge 44\text{ pt}$ verified via `touch-target.test.ts`.

## Test Execution Matrix

| Layer | Command | Expected Result |
|---|---|---|
| Shared Schemas | `pnpm --filter @expyrico/shared test` | All Zod tests pass |
| Backend Integration | `npm --prefix api run test:integration -- records-routes.test.ts` | Brand creation & patch pass |
| Mobile Components | `npm --prefix apps/mobile test -- QuickEditModal.test.tsx` | All 6+ modal tests pass |
| Mobile Search | `npm --prefix apps/mobile test -- filterAndSortRecords.test.ts` | Brand search match passes |
| Touch Target Audit | `npm --prefix apps/mobile test -- touch-target.test.ts` | All targets $\ge 44\text{ pt}$ pass |
| Mobile Typecheck | `npm --prefix apps/mobile run typecheck` | 0 diagnostics |
| Backend Typecheck | `npm --prefix api run typecheck` | 0 diagnostics |

## Physical Device Verification Runbook

1. **Local Gradle APK Build**:
   ```bash
   cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
   ```
2. **ADB Install**:
   ```bash
   adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```
3. **Launch App**:
   ```bash
   adb shell am start -n com.expyrico.app/.MainActivity
   ```
4. **Trigger Quick Edit**:
   - Tap a pantry item edit button or swipe action to open `QuickEditModal`.
5. **Visual Capture**:
   - Run: `adb exec-out screencap -p > /tmp/quick_edit_brand_rendered.png`
   - Inspect with `read` tool: `/tmp/quick_edit_brand_rendered.png?q=...`
   - Confirm:
     - `Item Name` input is visible at the top of the form.
     - `Brand` input is positioned directly below `Item Name`.
     - `Category` input and chips are positioned below `Brand`.
     - Value is correctly pre-populated.
6. **Save & Card Verification**:
   - Edit the brand (e.g. "Expyrico Farms"), tap Save.
   - Capture the pantry list: `adb exec-out screencap -p > /tmp/pantry_card_brand_updated.png`
   - Confirm the item card displays the updated brand.

## Success Criteria
- [x] All automated tests pass with 0 failures.
- [x] TypeScript typecheck passes with 0 diagnostics.
- [x] APK builds successfully and installs via ADB.
- [x] Screencap inspection confirms Brand field is placed directly below Item Name in Quick Edit modal.
- [x] Screencap inspection confirms updated brand renders on pantry card after save.

## Risk Assessment
- **Risk**: Physical device keyboard obstructing Save button during edit verification.
  - **Mitigation**: `QuickEditModal` is wrapped in `KeyboardAvoidingView`, and `ScrollView` has `keyboardShouldPersistTaps="handled"`. Dismiss keyboard via back key before tapping Save.
  - **Observable Signal**: Save button is offscreen beneath Gboard.
  - **Response**: Dispatch `adb shell input keyevent 4` to dismiss soft keyboard before screenshot.
