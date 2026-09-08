---
phase: 1
title: "Drawer State Management and Sliding Drawer Layout Architecture"
status: completed
priority: P1
effort: "3-4h"
dependencies: []
---

# Phase 1: Drawer State Management and Sliding Drawer Layout Architecture

## Overview
Establish the foundational state management and container layout for the slide-to-right navigation drawer. A dedicated Zustand store (`useDrawerStore`) manages the open/closed state and active tab tracking, while a high-performance `SlidingDrawer` component orchestrates the 60fps native-driven horizontal translation, scaling, edge-swiping, backdrop dimming, and Android hardware back button interception.

## Requirements

### Functional
- **Drawer State Store (`useDrawerStore`)**:
  - Global Zustand store with state:
    - `isOpen: boolean` (defaults to `false`).
    - `activeTab: keyof TabsParamList` (defaults to `'Home'`).
    - `openDrawer: () => void` (sets `isOpen = true`).
    - `closeDrawer: () => void` (sets `isOpen = false`).
    - `toggleDrawer: () => void` (toggles `isOpen`).
    - `setActiveTab: (tab: keyof TabsParamList) => void` (updates active tab).
    - `reset: () => void` (resets to initial state; integrated into `clearAllLocalUserData` on logout).
- **Sliding Drawer Container (`SlidingDrawer.tsx`)**:
  - Encapsulates two primary layers:
    1. **Background Drawer Layer**:
       <!-- Updated: Red Team Review - Accessibility & pointerEvents isolation when closed -->
       - Renders `LeftDrawerMenu` anchored at `left: 0`, `top: 0`, `bottom: 0`, width `DRAWER_WIDTH` (default `Math.min(width * 0.75, 300)`).
       - When closed: Sets `pointerEvents="none"`, `accessibilityElementsHidden={!isOpen}`, and `importantForAccessibility={isOpen ? "yes" : "no-hide-descendants"}` so off-screen drawer items and user info are never focused by screen readers or tapped through gutters.
    2. **Foreground Sliding Screen Container (Outer + Inner Deck Architecture)**:
       <!-- Updated: Red Team Review - Separate outer shadow view from inner clipping deck -->
       - **Outer Animated View**:
         - Manages `useNativeDriver: true` transforms: `transform: [{ translateX }, { scale }]`.
         - `translateX`: Interpolates from `0` (closed) to `DRAWER_WIDTH` (open) via spring physics (`tension: 65, friction: 9`).
         - `scale`: Interpolates from `1.0` (closed) to `0.94` (open) pinned to top-left origin.
         - Houses outer shadow and elevation (`overflow: 'visible'`, `shadowColor: '#000'`, `shadowOffset: { width: -4, height: 0 }`, `shadowOpacity: isOpen ? 0.18 : 0`, `shadowRadius: 10`, `elevation: isOpen ? 12 : 0`).
       - **Inner Deck View**:
         - Wraps tab navigator content.
         - Applies dynamic plain styles: `borderRadius: isOpen ? 16 : 0` and `overflow: isOpen ? 'hidden' : 'visible'`.
         - Zero corner clipping or rest-state shadow eating when the drawer is closed.
- **Backdrop Dimming & Touch Dismiss**:
  - When open, an animated overlay covers the shifted foreground screen.
  - Background color interpolates `opacity` from `0` to `0.35` on the native driver.
  - While open, deck children have `pointerEvents="none"` so underlying cards and lists cannot be tapped or swiped.
  - Tapping anywhere on the backdrop overlay triggers `closeDrawer()`.
- **Gesture Handling (Isolated Edge Touch Strip)**:
  <!-- Updated: Red Team Review - Dedicated 24px edge strip prevents gesture contention with Swipeables/lists -->
  - **Closed State**: A dedicated, invisible 24px touch strip (`position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, zIndex: 50`) handles horizontal edge-swipe (`x0 < 24`, `dx > 15`, `vx > 0.3`) to open. No PanResponder is placed across the entire deck, ensuring zero contention with RNGH `Swipeable` card actions or horizontal filter pill scrolling.
  - **Open State**: The backdrop overlay handles leftward swipes (`dx < -15`, `vx < -0.3`) to smoothly spring the drawer closed.
  - **Selection Mode Lockout**: When `isSelectionMode === true` in `useSelectionModeStore`, edge-swipe is disabled and `closeDrawer()` is immediately called.
- **Android Hardware Back Button (Focus-Gated)**:
  <!-- Updated: Red Team Review - Gated with useIsFocused to avoid swallowing back on pushed stack screens -->
  - Hooks `BackHandler` conditionally:
    - Only active when `isOpen === true && isFocused === true`.
    - If user pushes a stack screen (Scan, Household, Settings), `isFocused` becomes false on `Tabs`, allowing Android back to pop the stack screen normally instead of being swallowed.
    - Closes drawer and returns `true` only when `Tabs` is the actively focused screen.
- **Animation Race Safety**:
  <!-- Updated: Red Team Review - Cancel prior in-flight springs to prevent double-navigate or stuck states -->
  - Always calls `anim.stop()` on the active spring before dispatching a new animation.

### Non-Functional
- **60fps Native Performance**: All transform and opacity interpolations run strictly on the native thread (`useNativeDriver: true`). No unsupported style properties (`borderRadius`, `elevation`, `shadow*`) are animated via native driver.
- **Safe Area Insets**: Respects top and bottom safe area insets via `react-native-safe-area-context`.
- **Zero Memory Leaks**: Proper cleanup of `BackHandler` listeners and animation instances on unmount.

## Architecture & Data Flow

```
[User Taps Hamburger Button]
            │
            ▼
   useDrawerStore.toggleDrawer()  ──► sets isOpen = true
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│                      SlidingDrawer                      │
│                                                         │
│  anim.stop() -> Animated.spring(slideAnim, {            │
│    toValue: 1, useNativeDriver: true                    │
│  }).start()                                             │
│                                                         │
│  Outer Container (overflow: 'visible'):                 │
│  ├── transform: [ { translateX: 0->280 }, scale ]       │
│  └── shadow / elevation (active when open)              │
│                                                         │
│  Inner Deck (borderRadius: isOpen ? 16 : 0):            │
│  ├── Tabs.Navigator                                     │
│  └── Backdrop: opacity 0% -> 35% (pointerEvents="auto") │
│                                                         │
│  Left Drawer View (pointerEvents: isOpen ? auto : none) │
│  └── accessibilityElementsHidden: !isOpen               │
└─────────────────────────────────────────────────────────┘
            │
     [Backdrop Press / Swipe Left / Focus-Gated Back Button]
            │
            ▼
   useDrawerStore.closeDrawer()   ──► sets isOpen = false
```

## Related Code Files

### Create
- `apps/mobile/src/store/drawerStore.ts` — Zustand store for drawer state (`isOpen`, `activeTab`, `openDrawer`, `closeDrawer`, `toggleDrawer`, `setActiveTab`, `reset`).
- `apps/mobile/src/components/SlidingDrawer.tsx` — Sliding screen container and drawer wrapper with native-driver compliance, outer/inner deck separation, edge strip, and focus-gated back handling.
- `apps/mobile/tests/unit/sliding-drawer.test.tsx` — Unit tests for state changes, animation triggers, backdrop dismiss, edge-swipe isolation, and back button handling.

### Modify
- `apps/mobile/src/auth/session-store.ts` — Call `useDrawerStore.getState().reset()` inside `clearAllLocalUserData()` on logout.

## Implementation Steps

1. **Create Drawer State Store (`apps/mobile/src/store/drawerStore.ts`)**:
   - Implement Zustand store with `isOpen`, `activeTab`, `openDrawer`, `closeDrawer`, `toggleDrawer`, `setActiveTab`, `reset`.
   - Export convenient hooks `useDrawerStore` and helper actions.
2. **Implement `SlidingDrawer` Component (`apps/mobile/src/components/SlidingDrawer.tsx`)**:
   - Accept props: `drawerContent: React.ReactNode`, `children: React.ReactNode`, `drawerWidth?: number`.
   - Outer view with `transform: [{ translateX }, { scale }]` and shadow/elevation.
   - Inner view with `borderRadius: isOpen ? 16 : 0` and `overflow: isOpen ? 'hidden' : 'visible'`.
   - Dedicated 24px left-edge touch strip when closed; backdrop swipe/press when open.
   - Focus-gated `BackHandler` listener (`useIsFocused()`).
   - Subscribe to `useSelectionModeStore`: force `closeDrawer()` if selection mode activates.
3. **Session Teardown Hookup (`session-store.ts`)**:
   - In `clearAllLocalUserData()`, invoke `useDrawerStore.getState().reset()`.
4. **Unit Tests (`apps/mobile/tests/unit/sliding-drawer.test.tsx`)**:
   - Test store initial state, toggle, and reset.
   - Test `SlidingDrawer` renders drawer content with proper `pointerEvents` and `accessibilityElementsHidden`.
   - Test backdrop press triggers `closeDrawer()`.
   - Test Android back button intercepts only when open and focused.

## Success Criteria

- [x] `useDrawerStore` reliably tracks and toggles `isOpen` and `activeTab`.
- [x] Outer/inner deck view architecture guarantees 0 corner clipping and intact shadows at rest.
- [x] Native driver is strictly restricted to `transform` and `opacity`.
- [x] Dedicated 24px edge touch strip eliminates gesture collisions with card `Swipeables` and list scrolls.
- [x] `BackHandler` is focus-gated and never swallows back on pushed stack screens (Scan, Household, Settings).
- [x] Drawer and user details are aria-hidden and pointerEvents-disabled when closed.
- [x] Logout clears drawer store state.
- [x] 100% unit test coverage.

## Risk Assessment

- **Risk**: PanResponder interferes with horizontal swipeables.
  - **Mitigation**: Dedicated 24px edge touch strip only when closed; backdrop handles gestures when open with deck children set to `pointerEvents="none"`.
