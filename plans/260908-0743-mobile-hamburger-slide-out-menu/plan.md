---
title: "Mobile Hamburger Icon and Screen Slide-Right Drawer Navigation"
description: "Replace the draggable floating bottom menu button with an accessible top-left hamburger icon and implement a fluid slide-to-right drawer navigation architecture displaying the Expyrico app menu."
status: completed
priority: P1
effort: "1-2d"
tags: ["mobile", "navigation", "drawer", "hamburger", "gesture", "animation", "ui-ux", "react-native"]
created: 2026-09-08
---

# Mobile Hamburger Icon and Screen Slide-Right Drawer Navigation

## Overview

A focused architectural and UI transformation of the Expyrico mobile navigation system:
1. **Remove Draggable Floating Button**: Deprecate and remove the floating draggable bento button (`DraggableFloatingButton` / `SignatureMenuIcon`) from the bottom navigation area, eliminating gesture collisions and screen clutter over bottom action buttons.
2. **Top-Left Hamburger Icon**: Introduce an accessible, high-contrast hamburger icon button (`HamburgerButton`) positioned cleanly at the far-left in the top header row preceding the logo and screen title across all main tab screens (`Home`, `Deals`, `Giveaways`, `Reviews`, `Profile`).
3. **Screen Slide-Right Drawer Architecture**: When the hamburger icon is tapped (or upon edge swipe), the entire foreground screen slides smoothly to the right (`translateX: 0 -> 280px`, subtle 0.94 scale, dynamic card styling), revealing a dedicated, full-height left drawer menu (`LeftDrawerMenu`) underneath.
4. **Left Drawer Menu**: Renders the Expyrico brand header, active user profile status, and the 5 core navigation destinations (`Pantry`, `Giveaways`, `Deals`, `Reviews`, `Profile`) with active tab indicators in Expyrico Fresh Sage and Mint Mist, driving type-safe nested navigation (`Tabs`, `{ screen }`).
5. **Dismiss Gestures & Focus-Gated Back Button**: Tapping anywhere on the shifted foreground screen backdrop, pressing the drawer close button, or swiping left smoothly slides the screen back into full view (`translateX: 0`). Android hardware back button is focus-gated so it closes the drawer when open without trapping users on pushed stack screens.

## Problem Statement & Architectural Context

1. **Draggable Button Ergonomics & Clutter**: The floating draggable menu button introduced in Phase 4 of `260904-0155` was designed for reachability, but users reported that it floats unpredictably over critical UI elements, list items, and the bottom action buttons ("Scan an item", "Manually input", "Post a deal").
2. **Non-Standard Navigation Pattern**: Floating draggable navigation buttons are unfamiliar compared to industry-standard mobile navigation patterns. Users expect a stable hamburger icon in the top-left corner to access the app's primary menu.
3. **Immersive Slide-to-Right Drawer**: Revealing the menu by sliding the active screen to the right provides immediate spatial awareness—the user clearly sees where they came from and can tap the shifted screen or swipe back to return instantly.

## Goals & Acceptance Criteria

| # | Goal | Acceptance Criteria | Priority |
|---|------|---------------------|----------|
| 1 | **Drawer State & Layout Container** | `useDrawerStore` manages open/closed state and active tab. `SlidingDrawer` animates foreground screen `translateX` (0 to 280px) and `scale` (1.0 to 0.94) strictly with native-driver properties, outer/inner deck view separation, dimming backdrop, and touch-to-dismiss. | P1 |
| 2 | **Left Drawer Menu Component** | `LeftDrawerMenu` renders Expyrico brand header, user badge, and all 5 primary navigation tabs (`nav-Home`, `nav-Giveaways`, `nav-Deals`, `nav-Reviews`, `nav-Profile`) inside a `ScrollView`, with secondary shortcuts calling `closeDrawer()` before navigating. | P1 |
| 3 | **Top-Left Hamburger Icon** | `HamburgerButton` placed at the far-left preceding logo/title across all 5 tab screens with 44x44pt touch target and accessible labeling. Tapping toggles the sliding drawer. | P1 |
| 4 | **Clean TabsNavigator Cutover** | Remove `DraggableFloatingButton` and `SignatureMenuIcon` from `TabsNavigator.tsx`. Keep bottom action buttons ("Scan an item", "Post a deal", etc.) clean and unobstructed. | P1 |
| 5 | **Gesture & Back Handling** | Dedicated 24px edge-swipe strip opens drawer without list conflict; swipe left closes drawer. Android hardware back button is focus-gated to `Tabs`. Dimming backdrop closes drawer on tap. | P1 |
| 6 | **Automated Test Coverage** | 100% test coverage across `tabs-navigator.test.tsx`, `sliding-drawer.test.tsx`, `hamburger-button.test.tsx`, and `left-drawer-menu.test.tsx`. | P1 |

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | **Drawer State Management and Sliding Drawer Layout Architecture** | [phase-01-drawer-state-sliding-drawer-architecture.md](./phase-01-drawer-state-sliding-drawer-architecture.md) | completed | P1 | 3-4h |
| 2 | **Left Drawer Menu Component and Expyrico Theme Design** | [phase-02-left-drawer-menu-component.md](./phase-02-left-drawer-menu-component.md) | completed | P1 | 3-4h |
| 3 | **Top-Left Hamburger Button and Screen Header Integration** | [phase-03-hamburger-button-header-integration.md](./phase-03-hamburger-button-header-integration.md) | completed | P1 | 2-3h |
| 4 | **Deprecation of Draggable Floating Button and TabsNavigator Cutover** | [phase-04-tabs-navigator-cutover-cleanup.md](./phase-04-tabs-navigator-cutover-cleanup.md) | completed | P1 | 2-3h |
| 5 | **Verification, Integration Testing and Visual Quality** | [phase-05-verification-and-testing.md](./phase-05-verification-and-testing.md) | completed | P1 | 2-3h |

## Architecture & System Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXPYRICO MOBILE                                      │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              SlidingDrawer Container                             │  │
│  │                                                                                  │  │
│  │  ┌─────────────────────────┐      ┌───────────────────────────────────────────┐  │  │
│  │  │     LeftDrawerMenu      │      │        Animated Foreground Screen         │  │  │
│  │  │   (Inside ScrollView)   │      │  (translateX: 0 -> 280dp, scale: 1->0.94) │  │  │
│  │  │                         │      │  Outer: overflow:visible + shadow         │  │  │
│  │  │  • Expyrico Logo        │      │  Inner: borderRadius: isOpen ? 16 : 0     │  │  │
│  │  │  • User Status Badge    │      │  ┌─────────────────────────────────────┐  │  │  │
│  │  │  • Navigation Items:    │◄─────┼──┤ Top Bar: [ ☰ ] [ Logo ] Your pantry │  │  │  │
│  │  │    - 🏠 Pantry (Home)   │ tap  │  └─────────────────────────────────────┘  │  │  │
│  │  │    - 🎁 Giveaways       │ [ ☰ ]│  │                                     │  │  │  │
│  │  │    - 🏷️ Deals           │      │  │ Active Tab View (RecordList, etc.)   │  │  │  │
│  │  │    - ⭐ Reviews         │      │  │                                     │  │  │  │
│  │  │    - 👤 Profile         │      │  │ Bottom Action Row:                  │  │  │  │
│  │  │  • Secondary Shortcuts  │      │  │ [ Manually input ] [ Scan an item ] │  │  │  │
│  │  │  • Close Button (X)     │      │  └─────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────┘      └───────────────────────────────────────────┘  │  │
│  │                                                                                  │  │
│  │                 [ Backdrop Overlay on shifted screen: tap to close ]             │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                            │
│                                           ▼                                            │
│                                useDrawerStore (Zustand)                                │
│       { isOpen, activeTab, openDrawer, closeDrawer, toggleDrawer, setActiveTab, reset }│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Success Criteria Checklist

- [x] Draggable floating button and matrix icon are completely removed from the bottom area.
- [x] Hamburger button is rendered at the far left preceding logos and titles across all tab headers with a minimum 44x44pt touch target.
- [x] Tapping the hamburger button triggers a 60fps native-driver spring animation sliding the screen to the right (`translateX = 280px`).
- [x] Outer/inner deck view separation guarantees 0 rest-state corner clipping and intact drop shadows.
- [x] Left drawer menu displays brand header, active user details, and all 5 navigation tabs inside a `ScrollView`.
- [x] Secondary shortcuts (`Scan`, `Household`, `Settings`, `Feedback`) close the drawer before navigating.
- [x] Active tab is highlighted with Expyrico Fresh Sage (`#4BAE8A`) and Mint Mist (`#D6F0E6`).
- [x] Tapping any navigation tab dispatches nested route navigation (`Tabs`, `{ screen }`) and slides the screen closed.
- [x] Tapping the backdrop overlay covering the shifted screen closes the drawer.
- [x] Android hardware back button is focus-gated to `Tabs` and never traps users on pushed stack screens.
- [x] Center-aligned bottom action buttons ("Scan an item", "Post a deal", etc.) remain clean and functional.
- [x] Multi-select mode on Pantry hides the hamburger button and forces drawer close immediately.
- [x] 100% automated test coverage in mobile test suite.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Native driver animation crash** | Critical | Low | Restrict `useNativeDriver: true` strictly to `transform` and `opacity`. Apply dynamic `borderRadius: isOpen ? 16 : 0` to inner deck view and shadow to outer deck view. |
| **Tab navigation route resolution** | High | Low | Type `AppStackParamList.Tabs: NavigatorScreenParams<TabsParamList> | undefined` and dispatch tab switches via `navigation.navigate('Tabs', { screen: routeName })`. |
| **Android back button trapping** | High | Low | Gate `BackHandler` with `useIsFocused()` on `TabsNavigator` and ensure secondary shortcuts invoke `closeDrawer()` before navigating. |
| **Gesture conflict with list scrolling** | Medium | Low | Use a dedicated 24px left-edge touch strip when closed; backdrop handles swipe-left when open while deck children set `pointerEvents="none"`. |
| **Selection mode state conflict** | Low | Low | When `isSelectionMode` is active, hide `HamburgerButton`, ignore edge-swipe, and close drawer immediately. |

## Validation Log

### Step 2.5 Verification Results (Full Tier — 5 Phases, All 4 Roles)
- **Tier:** Full (5 phases, all 4 roles active)
- **Claims checked:** 78
- **Verified:** 76 | **Failed:** 2 (both mitigated & reconciled) | **Unverified:** 0

#### Failures Identified & Reconciled
1. **[Fact Checker / Flow Tracer] Phase 1 Native Driver Style Support**:
   - *Claim:* `Animated.Value` with `useNativeDriver: true` interpolates `borderRadius`, `elevation`, and `shadow*`.
   - *Failure:* `NativeAnimatedNodesManager` in React Native strictly supports only non-layout properties (`transform` and `opacity`). Interpolating `borderRadius` or `elevation` on native driver crashes at runtime.
   - *Resolution:* Restricted `useNativeDriver: true` strictly to `transform: [{ translateX }, { scale }]` and `opacity`. Configured dynamic `borderRadius: isOpen ? 16 : 0` on inner deck and outer view with `overflow: 'visible'` for drop shadows.
2. **[Contract Verifier] Phase 4 Navigation Context & Route Scope**:
   - *Claim:* `LeftDrawerMenu` calls `navigation.navigate(routeName)` using tab-level routes.
   - *Failure:* Because `SlidingDrawer` wraps `Tabs.Navigator`, `LeftDrawerMenu` mounts at the `AppNavigator` stack level where `Tabs` was typed as `undefined`. Calling `navigate('Home')` directly throws a navigation error.
   - *Resolution:* Updated `AppStackParamList` to type `Tabs: NavigatorScreenParams<TabsParamList> | undefined`. Updated `LeftDrawerMenu` to dispatch nested route navigation `navigation.navigate('Tabs', { screen: routeName })`, and wired `Tabs.Navigator`'s `screenListeners` to keep `activeTab` synchronized in `useDrawerStore`.

#### Verified Fact Checker & Contract Citations
- `apps/mobile/src/navigation/TabsNavigator.tsx:25` (`TabsParamList`), line 168 (`BottomActionNavBar`), line 496 (`TabsNavigator`)
- `apps/mobile/src/navigation/AppNavigator.tsx:33` (`AppStackParamList`), line 83 (`AppNavigator`)
- `apps/mobile/app/(app)/(tabs)/home.tsx:66` (`brandRow`), line 292 (`styles.brandRow`)
- `apps/mobile/src/features/deals/DealFeed.tsx:104` (`headerRow`), line 370 (`styles.headerRow`)
- `apps/mobile/src/features/giveaways/GiveawayFeed.tsx:195` (`headerRow`), line 473 (`styles.headerRow`)
- `apps/mobile/src/features/reviews/ReviewsHubScreen.tsx:76` (`brandRow`), line 384 (`styles.brandRow`)
- `apps/mobile/app/(app)/(tabs)/profile.tsx:141` (`header`)
- `apps/mobile/src/components/DraggableFloatingButton.tsx:47` (2 callers across project)
- `apps/mobile/src/store/uiPreferencesStore.ts:16` (`menuButtonPosition` preserved for server DTO compatibility)
- `apps/mobile/src/features/records/RecordList.tsx:207` (`BackHandler.addEventListener`)
- `apps/mobile/tests/unit/tabs-navigator.test.tsx:110` (10 test assertions mapped to `top-nav-menu-button`)

### Interview Decisions
1. **Drawer Motion & Visual Physics**: Confirmed **Card Deck Perspective**. The active foreground screen smoothly shifts to the right (`translateX: 0 -> 280px`), scales subtly to `0.94` with `16px` rounded corners and soft elevation shadow (`shadowOpacity: 0.18, elevation: 12`), giving tangible spatial deck depth. Left drawer menu appears underneath. Tapping the dimming backdrop overlay, swiping left, or tapping the drawer close button slides the screen back into full view.
2. **Top-Left Hamburger Placement**: Confirmed **Integrated in Screen Header Row, Far-Left Preceding Logo**. Positioned at the very start on the left, immediately followed by the Logo/title (e.g., `[ ☰ ] [Logo] Your pantry` on Home and Reviews; `[ ☰ ] Deals` on Deals; `[ ☰ ] Giveaways` on Giveaways; `[ ☰ ] [Logo with Wordmark]` on Profile), ensuring natural vertical centering, 44x44pt hit target, and zero clipping.
3. **Bottom Action Bar**: Confirmed **Centered Bottom Action Buttons Retained**. Action buttons (`"Manually input"` and `"Scan an item"` on Home, `"Post a deal"` on Deals, `"Create giveaway"` on Giveaways, `"Scan to review"` on Reviews) remain anchored at the bottom with the floating draggable button completely removed, providing a clean, focused, and unobstructed bottom interaction area.

## Red Team Review

### Session — 2026-09-08
**Findings:** 6 (6 accepted, 0 rejected)
**Severity breakdown:** 1 Critical, 4 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Unfocused `BackHandler` Swallows Android Back on Stacked Screens | Critical | Accept | Phase 1, Phase 2 |
| 2 | Static `borderRadius: 16` and `overflow: 'hidden'` Clips Live Resting UI and Eats Shadows | High | Accept | Phase 1, Phase 4 |
| 3 | Foreground `PanResponder` Collides with RNGH `Swipeable`, List Scrolls, and iOS Stack Gestures | High | Accept | Phase 1, Phase 5 |
| 4 | In-Flight Spring Animation Race Between Unmounting Backdrop and Navigation | High | Accept | Phase 1 |
| 5 | `LeftDrawerMenu` Lacks `ScrollView` and Compact-Screen Layout Budget | High | Accept | Phase 2, Phase 3 |
| 6 | LeftDrawerMenu Missing Accessibility Isolation and Exposing PII When Closed | Medium | Accept | Phase 1, Phase 2 |

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01-drawer-state-sliding-drawer-architecture.md`, `phase-02-left-drawer-menu-component.md`, `phase-03-hamburger-button-header-integration.md`, `phase-04-tabs-navigator-cutover-cleanup.md`, `phase-05-verification-and-testing.md`.
- Decision deltas checked: 6 accepted red-team findings.
- Reconciled stale references: 12 across all phase files.
- Unresolved contradictions: 0.

<!-- slug: mobile-hamburger-slide-out-menu -->
