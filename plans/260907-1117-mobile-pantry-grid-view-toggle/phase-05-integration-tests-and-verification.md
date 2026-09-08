---
phase: 5
title: "Integration Tests & Verification"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-01-ui-preferences-view-mode-store", "phase-02-search-bar-view-toggle-button", "phase-03-pantry-grid-card-component", "phase-04-record-list-grid-integration"]
---

# Phase 5: Integration Tests & Verification

## Overview
Implement automated regression and integration tests covering the view mode toggle, 2-column grid layout rendering, search and filter interaction in grid mode, AsyncStorage persistence, and bulk selection, followed by on-device verification via local Android Gradle build and ADB.

## Requirements
- Functional:
  - Unit tests in `uiPreferencesStore.test.ts`:
    - Verify store initializes with `pantryViewMode === 'list'`.
    - Verify `setPantryViewMode('grid')` updates state and persists to `@expyrico_pantry_view_mode`.
    - Verify hydration restores stored `'grid'` value.
    - Verify logout in `session-store.ts` clears `@expyrico_pantry_view_mode` and resets state to `'list'`.
  - Unit tests in `PantryGridCard.test.tsx`:
    - Verify renders 2-line title, brand, status pill, and thumbnail.
    - Verify tap navigates to `Record` screen.
    - Verify long-press triggers `onLongPress`.
    - Verify selection mode renders checkbox with `neutralMid` outline when unselected and `primary` fill when selected.
  - Integration tests in `pantry-filtering-and-pagination.test.tsx` or `pantry-view-mode.test.tsx`:
    - Tapping `testID="pantry-view-mode-toggle-btn"` toggles between List and Grid.
    - When in grid mode, cards render with `testID="pantry-grid-card-{id}"`.
    - Section headers (`Expired`, `Expires today`, `Use this week`, `Later`) display correct item counts in grid mode matching `SECTION_TITLES`.
    - Verify odd-number section counts (e.g. 1-item or 3-item section) render with trailing flex spacer without crashing or misalignment.
    - Verify rapid double-toggle does not drop frames or crash.
    - Toggling view mode does NOT trigger a false `loadMore()` / phantom page append.
<!-- Updated: Red Team Session 1 - Expyrico dark tokens & canonical test titles -->
- Non-functional:
  - Local Android debug APK builds cleanly with `:app:assembleDebug` per `AGENTS.md`.
  - Install to connected Android device (`96d9c774`) and verify 60fps scrolling and layout.

## Test Matrix

```
┌────────────────────────────┬─────────────────────────────┬───────────────────────────────┐
│ Action                     │ Expected State              │ List Presentation             │
├────────────────────────────┼─────────────────────────────┼───────────────────────────────┤
│ Launch pantry              │ pantryViewMode = 'list'     │ Full-width list rows          │
│ Tap view switch button     │ pantryViewMode = 'grid'     │ 2-column paired grid cards    │
│ Tap item in grid           │ Navigates to Record detail  │ Opens Record screen           │
│ Long-press item in grid    │ selectionMode = true        │ Grid cards show checkboxes    │
│ Type in search while grid  │ Filtered grid items         │ Input focus stays uninterrupted│
│ Restart app                │ pantryViewMode restored     │ Grid mode persists            │
└────────────────────────────┴─────────────────────────────┴───────────────────────────────┘
```

## Related Code Files
- Create: `apps/mobile/tests/integration/pantry-view-mode.test.tsx`
- Run: `apps/mobile/android` Gradle debug build (`:app:assembleDebug`)
- Verify: ADB install on connected device (`96d9c774`)

## Implementation Steps
1. **Write Unit Tests**:
   Create `uiPreferencesStore.test.ts` and `PantryGridCard.test.tsx`.
2. **Write Integration Flow Tests**:
   Create `apps/mobile/tests/integration/pantry-view-mode.test.tsx` executing full toggle, search, and selection flows.
3. **Run Test Suite**:
   Run `npm test` across all mobile tests to confirm 100% pass rate.
4. **Android Build & Device Verification**:
   Execute local Gradle debug build and install via ADB:
   ```bash
   cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
   adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```
   Take screenshots on device to verify visual polish.

## Success Criteria
- [x] All unit and integration tests pass cleanly.
- [x] Android Gradle build succeeds without errors.
- [x] Screen capture on device verifies 2-column grid layout and smooth toggle action.

## Risk Assessment
- *Risk*: Pre-existing integration tests expecting specific testIDs on `RecordCard` could fail if grid mode is active by default.
- *Mitigation*: Default remains strictly `'list'`, ensuring 100% backwards compatibility for all existing tests.
