---
phase: 2
title: "Left Drawer Menu Component and Expyrico Theme Design"
status: completed
priority: P1
effort: "3-4h"
dependencies: [1]
---

# Phase 2: Left Drawer Menu Component and Expyrico Theme Design

## Overview
Design and build the dedicated `LeftDrawerMenu` component revealed when the screen slides right. The drawer renders the Expyrico brand logo, active user account information, the five primary navigation destinations (`Pantry`, `Giveaways`, `Deals`, `Reviews`, `Profile`) with active tab indicators and Expyrico color palette styling, plus secondary shortcuts, a ScrollView for compact devices, and an accessible close button. Tab navigation is dispatched via type-safe nested navigation (`navigation.navigate('Tabs', { screen })`), and all secondary stack shortcuts close the drawer before navigating.

## Requirements

### Functional
- **Brand Header Row**:
  - Expyrico Logo (`<Logo size={30} withWordmark />`).
  - Subtitle: `"Zero Food Waste"` in Pebble (`#8C8C85`).
  - Close button: An accessible `X` button (`testID="drawer-close-button"`, `accessibilityLabel="Close menu"`) in the top-right corner of the drawer.
- **User Status / Household Card**:
  - Reads authenticated user from `useSessionStore` (`s.user`).
  - Displays user avatar (`Avatar` component), full name, and email.
  - Displays active pantry scope (e.g., `"Personal Pantry"` or `"Our Kitchen (Shared)"`) using `usePantryScope()`.
  - Tapping user card closes the drawer and navigates to `ProfileEdit` or `Household`.
- **Primary Navigation Items (`MENU`)**:
  - Section title: `"MENU"` in Pebble uppercase mono font.
  - Renders the 5 primary tabs based on `TAB_META`:
    1. **Pantry (Home)**: `testID="nav-Home"`, Icon: `grid-outline`, Label: `"Pantry"`, Sublabel: `"Expiring & in stock"`
    2. **Giveaways**: `testID="nav-Giveaways"`, Icon: `gift-outline`, Label: `"Giveaways"`, Sublabel: `"Community food sharing"`
    3. **Deals**: `testID="nav-Deals"`, Icon: `pricetag-outline`, Label: `"Deals"`, Sublabel: `"Discounted groceries"`
    4. **Reviews**: `testID="nav-Reviews"`, Icon: `star-outline`, Label: `"Reviews"`, Sublabel: `"Community ratings"`
    5. **Profile**: `testID="nav-Profile"`, Icon: `person-outline`, Label: `"Profile"`, Sublabel: `"Account & preferences"`
  - **Active State Highlighting**:
    - Reads active route from `useDrawerStore((s) => s.activeTab)`.
    - Highlight background: Mint Mist (`#D6F0E6`) with subtle 8px border radius.
    - Icon color: Fresh Sage (`#4BAE8A`) on active; Pebble (`#8C8C85`) on inactive.
    - Text color: Deep Sage (`#3A8F6F`) on active; Almost Black (`#2C2C28`) on inactive.
    - Trailing active indicator: Small circular pill with a white checkmark icon (`Ionicons name="checkmark" size={12} color="#FFF"` on Fresh Sage `#4BAE8A` background).
  - **Type-Safe Nested Navigation Dispatch**:
    - Consumes `useNavigation<AppNavigationProp>()`.
    - Tapping an item dispatches:
      ```typescript
      useDrawerStore.getState().closeDrawer();
      navigation.navigate('Tabs', { screen: routeName });
      ```
- **Secondary Shortcuts Section (Always Closes Drawer First)**:
  <!-- Updated: Red Team Review - Explicit closeDrawer() before navigating to prevent stuck BackHandler -->
  - Section title: `"QUICK ACCESS"`
  - Direct links to key sub-features:
    - `"Scan Barcode"`:
      ```typescript
      useDrawerStore.getState().closeDrawer();
      navigation.navigate('Scan');
      ```
    - `"Household Sharing"`:
      ```typescript
      useDrawerStore.getState().closeDrawer();
      navigation.navigate('Household');
      ```
    - `"Settings & Theme"`:
      ```typescript
      useDrawerStore.getState().closeDrawer();
      navigation.navigate('SettingsIndex');
      ```
    - `"Feedback & Support"`:
      ```typescript
      useDrawerStore.getState().closeDrawer();
      navigation.navigate('FeedbackHub');
      ```
- **Vertical ScrollView for Compact Screens**:
  <!-- Updated: Red Team Review - Prevent content clipping on iPhone SE / compact Android (< 640pt height) -->
  - Wraps all menu content in a `ScrollView` (`showsVerticalScrollIndicator={false}`, `bounces={false}`).
  - Content container padding ensures bottom items (Settings, Feedback, version) are fully reachable on compact devices.
- **Sign Out Action**:
  <!-- Updated: Red Team Review - Confirmation dialog matches profile.tsx with token/push revocation -->
  - Prompts with `Alert.alert('Sign Out', 'Are you sure you want to sign out of Expyrico?', [...])` matching `profile.tsx:118-133`.
  - On confirm, calls `signOut()` from `useSessionStore`, which resets session and clears drawer state.

### Non-Functional
- **Expyrico Color Palette Strictness**:
  - Active headers / icons: Fresh Sage (`#4BAE8A`).
  - Active text / pressed states: Deep Sage (`#3A8F6F`).
  - Active highlights / soft panels: Mint Mist (`#D6F0E6`).
  - Main background: Warm White (`#FAFAF8`) or elevated panel.
  - Primary text: Almost Black (`#2C2C28`).
  - Secondary text / borders: Pebble (`#8C8C85`) and Stone (`#F0F0ED`).
- **Touch Target & Accessibility**:
  - Every row has a minimum touch height of 48pt (exceeding WCAG 44pt minimum).
  - Explicit `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState={{ selected: isFocused }}`.

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│             LeftDrawerMenu (ScrollView)                │
│                                                        │
│  [ Tap 'Scan Barcode' ]                                │
│            │                                           │
│            ▼                                           │
│  1. useDrawerStore.getState().closeDrawer()            │
│  2. navigation.navigate('Scan')                        │
│            │                                           │
│            ▼                                           │
│  AppNavigator pushes Scan screen                       │
│  BackHandler on SlidingDrawer is inactive (not focused)│
└────────────────────────────────────────────────────────┘
```

## Related Code Files

### Create
- `apps/mobile/src/navigation/LeftDrawerMenu.tsx` — Left drawer navigation component with ScrollView and close-before-navigate shortcuts.
- `apps/mobile/tests/unit/left-drawer-menu.test.tsx` — Unit tests for rendering menu items, active tab highlight, ScrollView wrapping, and navigation dispatch.

### Modify
- `apps/mobile/src/navigation/AppNavigator.tsx` — Type `Tabs: NavigatorScreenParams<TabsParamList> | undefined` in `AppStackParamList`.

## Implementation Steps

1. **Update `AppNavigator.tsx` Types**:
   - Import `type { NavigatorScreenParams } from '@react-navigation/native'` and `type { TabsParamList } from './TabsNavigator'`.
   - Update `AppStackParamList`: `Tabs: NavigatorScreenParams<TabsParamList> | undefined`.
2. **Implement `LeftDrawerMenu` (`apps/mobile/src/navigation/LeftDrawerMenu.tsx`)**:
   - Wrap content in `SafeAreaView` + `ScrollView` with safe insets.
   - Build brand header row with `Logo`, wordmark, subtitle, and close button (`testID="drawer-close-button"`).
   - Build user card reading from `useSessionStore` and `usePantryScope`.
   - Render `MENU` section mapping over `TAB_META` with active route detection via `useDrawerStore((s) => s.activeTab)`.
   - Add active styling (Mint Mist `#D6F0E6` background, Fresh Sage `#4BAE8A` checkmark pill).
   - Wire secondary shortcuts (`Scan`, `Household`, `SettingsIndex`, `FeedbackHub`) ensuring each calls `closeDrawer()` before navigating.
   - Add sign-out row with `Alert.alert` confirmation matching `profile.tsx`.
3. **Unit Tests (`apps/mobile/tests/unit/left-drawer-menu.test.tsx`)**:
   - Test that all 5 navigation tabs render with correct labels and testIDs.
   - Test that tapping a tab calls `closeDrawer()` and `navigation.navigate('Tabs', { screen: 'Deals' })`.
   - Test that secondary shortcuts call `closeDrawer()` before navigating to stack screens.
   - Test that close button calls `closeDrawer()`.

## Success Criteria

- [x] `LeftDrawerMenu` renders inside a `ScrollView` ensuring full reachability on compact screens.
- [x] All secondary shortcuts (`Scan`, `Household`, `Settings`, `Feedback`) call `closeDrawer()` before navigating.
- [x] Sign-out includes confirmation dialog and server session revocation.
- [x] All 5 navigation tabs render with icons, labels, sublabels, and active Mint Mist highlight.
- [x] Strictly satisfies Expyrico color palette guidelines.
- [x] 100% test coverage in unit suite.

## Risk Assessment

- **Risk**: User double-taps shortcut before navigation transition completes.
  - **Mitigation**: `closeDrawer()` is synchronous and sets `pointerEvents="none"` on drawer during transition.
