---
phase: 5
title: "Verification, Integration Testing and Visual Quality"
status: completed
priority: P1
effort: "2-3h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Verification, Integration Testing and Visual Quality

## Overview
Execute end-to-end verification and update the automated test suites to validate the new top-left hamburger button, native-driven slide-to-right drawer animation, nested tab switching, backdrop dismiss, gesture handling, and selection mode interactions. Ensure zero regressions across the mobile application suite, strict compliance with the Expyrico color palette, and passing TypeScript typechecks and linters.

## Requirements

### Functional
- **Updated `tabs-navigator.test.tsx`**:
  - Update tests to verify:
    1. Initial render displays the top-left hamburger button (`top-nav-menu-button`) and the Home scan action button (`home-scan-action`).
    2. Pressing `top-nav-menu-button` opens the drawer and renders all 5 navigation tabs (`nav-Home`, `nav-Giveaways`, `nav-Deals`, `nav-Reviews`, `nav-Profile`).
    3. Pressing the backdrop overlay (`drawer-backdrop`) closes the drawer.
    4. Pressing `nav-Deals` dispatches nested tab navigation, updates the center action button to `"Post a deal"`, and closes the drawer.
    5. Pressing `nav-Reviews` dispatches nested tab navigation, updates the center action button to `"Scan to review"`, and closes the drawer.
    6. Pressing `nav-Giveaways` dispatches nested tab navigation, updates the center action button to `"Create giveaway"`, and closes the drawer.
    7. Pressing `nav-Profile` dispatches nested tab navigation, leaves center action empty, and closes the drawer.
    8. Selection mode (`isSelectionMode: true`) hides the hamburger button, closes any open drawer, and hides bottom action bar cleanly.
- **New Component Unit Tests**:
  - `apps/mobile/tests/unit/sliding-drawer.test.tsx`:
    - Verifies slide animation triggers on `isOpen` state change strictly using native-driver supported properties (`transform`, `opacity`).
    - Verifies outer shadow view has `overflow: 'visible'` and inner deck view sets `borderRadius: 16` only when `isOpen === true`.
    - Verifies dedicated 24px edge touch strip opens drawer without whole-container gesture conflict.
    - Verifies backdrop tap calls `closeDrawer()`.
    - Verifies Android `BackHandler` closes drawer ONLY when `isOpen === true` AND screen is focused (`isFocused === true`).
    - Verifies `isSelectionMode: true` forces drawer closed and ignores edge swipes.
  - `apps/mobile/tests/unit/hamburger-button.test.tsx`:
    - Verifies rendering with icon, hit target, and accessibility props.
    - Verifies press invokes `toggleDrawer()`.
  - `apps/mobile/tests/unit/left-drawer-menu.test.tsx`:
    - Verifies all 5 tabs render with labels, icons, and active indicator.
    - Verifies nested tab navigation dispatch (`Tabs`, `{ screen: 'Deals' }`) and close actions.
    - Verifies secondary shortcuts (`Scan`, `Household`, `Settings`, `Feedback`) invoke `closeDrawer()` before navigating.
    - Verifies all menu content is wrapped in a `ScrollView`.

### Non-Functional
- **Type Safety**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors across the entire monorepo, verifying `AppStackParamList.Tabs: NavigatorScreenParams<TabsParamList> | undefined`.
- **Lint Cleanliness**: `npm run lint` (`eslint`) passes with 0 warnings or errors.
- **Expyrico Palette Verification**:
  - Hamburger button uses Almost Black `#2C2C28`.
  - Active navigation tab uses Mint Mist `#D6F0E6` background and Fresh Sage `#4BAE8A` icon/badge.
  - Inactive navigation tabs use Almost Black `#2C2C28` and Pebble `#8C8C85`.
  - Borders use Stone `#F0F0ED`.
  - No unapproved brand colors or rogue accents.

## Architecture & Data Flow

```
[Jest Test Runner]
       ├── tabs-navigator.test.tsx (Verifies top-left hamburger + slide-out drawer)
       ├── sliding-drawer.test.tsx (Verifies native-driver transform + focus-gated BackHandler)
       ├── hamburger-button.test.tsx (Verifies accessibility + toggle dispatch)
       ├── left-drawer-menu.test.tsx (Verifies tabs, ScrollView, & close-before-navigate shortcuts)
       └── full mobile test suite: PASS (zero regressions)
```

## Related Code Files

### Create
- `apps/mobile/tests/unit/sliding-drawer.test.tsx`
- `apps/mobile/tests/unit/hamburger-button.test.tsx`
- `apps/mobile/tests/unit/left-drawer-menu.test.tsx`

### Modify
- `apps/mobile/tests/unit/tabs-navigator.test.tsx`
- `apps/mobile/src/navigation/AppNavigator.tsx` (type definitions)

## Implementation Steps

1. **Update `tabs-navigator.test.tsx`**:
   - Refactor queries from `bottom-nav-menu-button` to `top-nav-menu-button`.
   - Assert that pressing `top-nav-menu-button` opens the drawer and displays `nav-Home`, `nav-Giveaways`, `nav-Deals`, `nav-Reviews`, `nav-Profile`.
   - Assert backdrop dismiss and nested tab navigation.
   - Assert selection mode closes drawer and hides button.
2. **Add Component Unit Tests**:
   - Implement `sliding-drawer.test.tsx` covering focus-gated BackHandler, edge strip, and dynamic card styling.
   - Implement `hamburger-button.test.tsx`.
   - Implement `left-drawer-menu.test.tsx` covering tab navigation and secondary shortcuts.
3. **Run Test Suites & Verification**:
   - Run `cd apps/mobile && npm test -- tests/unit/tabs-navigator.test.tsx tests/unit/sliding-drawer.test.tsx tests/unit/hamburger-button.test.tsx tests/unit/left-drawer-menu.test.tsx`.
   - Run full mobile test suite: `cd apps/mobile && npm test`.
   - Run TypeScript typecheck: `cd apps/mobile && npm run typecheck`.
   - Run lint: `cd apps/mobile && npm run lint`.

## Success Criteria

- [x] All unit and integration tests pass with 0 failures.
- [x] `tabs-navigator.test.tsx` validates the top-left hamburger icon and drawer navigation.
- [x] Focus-gated BackHandler behavior verified by tests.
- [x] No TypeScript type errors (`tsc --noEmit` exits 0).
- [x] No ESLint warnings or errors (`eslint` exits 0).
- [x] Expyrico color requirements strictly satisfied.

## Risk Assessment

- **Risk**: Jest timer or animation warnings with `Animated.spring`.
  - **Mitigation**: Wrap state-changing triggers in `act(...)` or mock `Animated.spring` to finish synchronously in unit test environments.
