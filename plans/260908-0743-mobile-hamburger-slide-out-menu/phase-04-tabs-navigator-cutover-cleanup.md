---
phase: 4
title: "Deprecation of Draggable Floating Button and TabsNavigator Cutover"
status: completed
priority: P1
effort: "2-3h"
dependencies: [1, 2, 3]
---

# Phase 4: Deprecation of Draggable Floating Button and TabsNavigator Cutover

## Overview
Cut over `TabsNavigator.tsx` to the new slide-to-right drawer architecture. Remove the deprecated `DraggableFloatingButton`, `SignatureMenuIcon`, and the floating vertical popover menu. Wrap the tab screens in `SlidingDrawer` rendering `LeftDrawerMenu` on the left. Wire `Tabs.Navigator`'s `screenListeners` to sync active tab state to `useDrawerStore`. The bottom action row is preserved with its center-aligned action buttons ("Manually input" / "Scan an item" on Home, "Post a deal" on Deals, "Create giveaway" on Giveaways, "Scan to review" on Reviews) in an uncluttered, unobstructed layout.

## Requirements

### Functional
- **Remove Draggable Floating Button from `TabsNavigator.tsx`**:
  - Remove `<DraggableFloatingButton>` wrapper and coordinate-persistence callbacks.
  - Remove `SignatureMenuIcon` component (the 4-tile bento matrix icon).
  - Remove `styles.menuButton`, `styles.verticalMenuContainer`, and floating vertical menu backdrop.
- **Wrap Navigator in `SlidingDrawer` with Outer/Inner View Separation & Focus-Gated BackHandler**:
  <!-- Updated: Red Team Review Finding 2 & Finding 1 - Deck view separation and focus gating -->
  - In `TabsNavigator.tsx`:
    - Wrap the bottom tab navigator container inside `<SlidingDrawer drawerContent={<LeftDrawerMenu />}>`.
    - `SlidingDrawer` architecture:
      - Outer `Animated.View` manages native `translateX` (0 to 280dp) and `scale` (1.0 to 0.94) with `overflow: 'visible'` and elevation/shadow.
      - Inner view manages dynamic `borderRadius: isOpen ? 16 : 0` and `overflow: isOpen ? 'hidden' : 'visible'`, eliminating resting-state corner clipping and shadow eating.
      - Edge-swipe opening is strictly bound to a 24px left-edge strip (`x0 < 24`), preventing gesture conflict with `RecordCard` swipeable actions, horizontal filter pills, or list scrolling.
      - Android `BackHandler` is focus-gated using `useIsFocused()`, ensuring hardware back only intercepts when `isOpen === true` and the `Tabs` navigator is actively focused, so pushed stack screens (`Scan`, `Household`, `Settings`) pop normally.
    - Add `screenListeners` to `Tabs.Navigator`:
      ```tsx
      <Tabs.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomActionNavBar {...props} />}
        screenListeners={{
          state: (e) => {
            const currentRoute = e.data.state.routes[e.data.state.index]?.name;
            if (currentRoute) {
              useDrawerStore.getState().setActiveTab(currentRoute as keyof TabsParamList);
            }
          },
        }}
      >
      ```
    - When `isDrawerOpen` is true, the entire tab screen (including the bottom action bar) slides to the right by `DRAWER_WIDTH`.
- **Preserve Clean Bottom Action Row**:
  - Keep `BottomActionNavBar` focused exclusively on the context-sensitive center action buttons:
    - **Home (Pantry)**: Dual action buttons: `"Manually input"` (`home-manual-add-action`) and `"Scan an item"` (`home-scan-action`).
    - **Deals**: Single center action button: `"Post a deal"` (`deal-new-action`).
    - **Giveaways**: Single center action button: `"Create giveaway"` (`giveaway-new-action`).
    - **Reviews**: Single center action button: `"Scan to review"` (`reviews-scan-action`).
    - **Profile**: Empty action area.
  - Center buttons remain centered with no floating button crowding the right edge.
  - Selection mode hides the bottom action bar as before (`useSelectionModeStore((s) => s.isSelectionMode)`).
- **Store & Code Cleanup**:
  - In `apps/mobile/src/store/uiPreferencesStore.ts`:
    - Deprecate `menuButtonPosition` (keep type as optional in schemas for backwards compatibility, but remove active synchronization).
    - Preserve `pantryViewMode` ('list' | 'grid') functionality completely untouched.
  - Mark `apps/mobile/src/components/DraggableFloatingButton.tsx` as `@deprecated`.

### Non-Functional
- **Clean Architecture & No Dead Code**: Remove all orphaned styles, unused animation interpolations (`iconRotation`, `menuScale`, `menuTranslateY`), and imports in `TabsNavigator.tsx`.
- **Zero UI Regression**: Bottom action buttons remain at the exact same vertical and horizontal coordinates, responding to taps with identical navigation targets.

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TabsNavigator                             │
│                                                                        │
│  <SlidingDrawer drawerContent={<LeftDrawerMenu />}>                    │
│    │  (Outer View: native translateX/scale, overflow:visible, shadow)  │
│    │  (Inner View: borderRadius: isOpen ? 16 : 0, overflow:dynamic)   │
│    │  (BackHandler: focus-gated via useIsFocused())                    │
│    │                                                                   │
│    └── <Tabs.Navigator                                                 │
│          screenListeners={{ state: updateActiveTabInDrawerStore }}     │
│          tabBar={(props) => <BottomActionNavBar {...props} />}        │
│        >                                                               │
│          ├── HomeTabScreen (contains top-left HamburgerButton)         │
│          ├── DealsTabScreen (contains top-left HamburgerButton)        │
│          ├── GiveawaysTabScreen (contains top-left HamburgerButton)    │
│          ├── ReviewsTabScreen (contains top-left HamburgerButton)      │
│          ├── ProfileTabScreen (contains top-left HamburgerButton)      │
│          │                                                             │
│          └── BottomActionNavBar                                        │
│                └── Center Action Button: [ Scan an item ] (Clean!)     │
│                    (NO floating button overlapping on right)           │
│                                                                        │
│  </SlidingDrawer>                                                      │
└────────────────────────────────────────────────────────────────────────┘
```

## Related Code Files

### Create
- None in Phase 4.

### Modify
- `apps/mobile/src/navigation/TabsNavigator.tsx` — Cut over to `SlidingDrawer`, remove `DraggableFloatingButton`, remove popover menu, wire `screenListeners`.
- `apps/mobile/src/store/uiPreferencesStore.ts` — Deprecate `menuButtonPosition` while keeping `pantryViewMode`.
- `apps/mobile/src/components/DraggableFloatingButton.tsx` — Add `@deprecated` JSDoc header.

## Implementation Steps

1. **Refactor `TabsNavigator.tsx`**:
   - Remove `SignatureMenuIcon`, `DraggableFloatingButton`, and associated menu animations.
   - Refactor `BottomActionNavBar` to only render `styles.bottomRowWrapper` with the center-aligned action buttons.
   - Wrap `Tabs.Navigator` inside `<SlidingDrawer drawerContent={<LeftDrawerMenu />}>`.
   - Ensure `SlidingDrawer` adheres to outer view (transform/shadow) and inner view (`borderRadius: isOpen ? 16 : 0`) structure.
   - Ensure `BackHandler` is focus-gated with `useIsFocused()` on `TabsNavigator`.
   - Wire `screenListeners` on `Tabs.Navigator` to update `useDrawerStore.getState().setActiveTab(...)`.
   - Remove unused styles from `StyleSheet.create`: `verticalMenuContainer`, `menuItem`, `menuItemLabel`, `backdrop`, `menuButton`, etc. (now owned by `LeftDrawerMenu`).
2. **Update `uiPreferencesStore.ts`**:
   - Clean up or deprecate `menuButtonPosition`. Ensure `pantryViewMode` continues to load and persist without regression.
3. **Verify Cutover**:
   - Verify that tapping the top-left hamburger button triggers the slide-right drawer.
   - Verify that bottom action buttons ("Scan an item", "Post a deal", etc.) work properly.
   - Verify Android hardware back pops pushed stack screens without interference.

## Success Criteria

- [x] `DraggableFloatingButton` and `SignatureMenuIcon` are completely removed from `TabsNavigator.tsx`.
- [x] `TabsNavigator` renders `SlidingDrawer` with `LeftDrawerMenu`.
- [x] `Tabs.Navigator` updates `activeTab` in `useDrawerStore` via `screenListeners`.
- [x] Bottom action buttons ("Scan an item", "Post a deal", etc.) remain cleanly positioned and fully functional.
- [x] No dead styles, unused state, or orphaned imports left in `TabsNavigator.tsx`.
- [x] `pantryViewMode` in `uiPreferencesStore` continues to work cleanly.
- [x] Android hardware back button pops stack screens without trapped drawer focus.

## Risk Assessment

- **Risk**: Breaking navigation props, trapping back navigation, or clipping resting UI when nesting `Tabs.Navigator` in `SlidingDrawer`.
  - **Observable Signal**: Tab switches fail to re-render, Android back does not exit pushed screens, or list edges are clipped at rest.
  - **Mitigation**: `SlidingDrawer` separates layout concerns into an outer animated view (handling native translateX/scale, drop shadow, and elevation with `overflow: 'visible'`) and an inner view with dynamic `borderRadius: isOpen ? 16 : 0`. It avoids whole-deck PanResponder interference by using a dedicated 24px edge strip when closed, and gates hardware `BackHandler` to when `Tabs` is focused (via `useIsFocused()`), preventing event capture on pushed stack screens.
