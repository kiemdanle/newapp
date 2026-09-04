---
phase: 4
title: "Draggable Floating Menu Button with Persistent Database Storage"
status: done
priority: P2
effort: "3-4h"
dependencies: [3]
---

# Phase 4: Draggable Floating Menu Button with Persistent Database Storage

## Overview
Upgrade the signature bottom navigation menu button (`SignatureMenuIcon`) into a fluidly draggable, dock-snapping affordance. Users can position the menu trigger anywhere along the screen's horizontal edges (left or right side, at custom heights) to accommodate left- or right-handed use. The customized placement is saved immediately to local storage for zero-flicker app launches and synchronized to the backend database so preferences follow the user's account across devices.

## Requirements

### Functional
- **Pan Gesture Interaction**:
  - The menu trigger button in `TabsNavigator.tsx` can be dragged freely across the screen using a pan gesture (`react-native-gesture-handler` or `PanResponder`).
  - **Tap vs. Drag Discrimination**:
    - Tap threshold: A touch release with less than 6px movement is treated as a tap and toggles the navigation menu open/closed.
    - Drag movement: Movement beyond 6px initiates dragging with immediate visual feedback (slight elevation lift and subtle scale pulse to 1.05).
- **Freeform Placement & Safe Clamping**:
  <!-- Updated: Validation Session 1 - Freeform placement anywhere -->
  - While dragging, the button directly tracks the user's touch.
  - On release, the button settles at the exact user-chosen coordinates `(x, y)`.
  - Clamping enforces that the button stays fully within safe, interactive bounds:
    - `minX = insets.left + 12`, `maxX = screenWidth - buttonWidth - insets.right - 12`.
    - `minY = insets.top + 60`, `maxY = screenHeight - buttonHeight - insets.bottom - 70`.
  - Prevents overlap with system notches, dynamic islands, navigation bars, or hardware edges.
- **Dynamic Popover Menu Orientation**:
  - The vertical popover menu calculates its opening alignment based on the button's relative screen quadrant:
    - **Horizontal**: If `x > screenWidth / 2`, popover opens aligned to the right of the button; if `x <= screenWidth / 2`, popover opens aligned to the left of the button.
    - **Vertical**: If `y > screenHeight / 2`, popover opens upward above the button; if `y <= screenHeight / 2`, popover opens downward below the button.
  - Guarantees the popover menu is always 100% visible and never clips off-screen regardless of where the button is placed.
- **Permanent Storage & Multi-Device Sync**:
  - **Tier 1 (Instant Local Storage)**: On release, `{ x: number, y: number }` is saved to `AsyncStorage` (`@expyrico_menu_button_position`) so subsequent app mounts position the button immediately without flicker.
  - **Tier 2 (Database Persistence)**: Coordinates are synchronized to the backend database via `PATCH /v1/me/preferences`:
    ```json
    {
      "uiPreferences": {
        "menuButtonPosition": {
          "x": 280,
          "y": 620
        }
      }
    }
    ```
  - **Tier 3 (Hydration on Login)**: User profile loads `uiPreferences.menuButtonPosition` on sign-in, restoring custom placement across all user devices.

### Non-Functional
- **60fps Gesture Performance**: Uses native driver animations (`useNativeDriver: false` or Reanimated worklets) to ensure buttery smooth 60fps tracking on both low-end and high-end devices.
- **Accessibility**: Preserves `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState={{ expanded: isMenuOpen }}`. Screen reader users can activate the button with a standard double-tap without needing drag gestures.

## Architecture & Data Flow

```
[User drags Menu Button beyond 6px threshold]
       │
       ▼
[PanResponder / Gesture Handler]
  ├── Tracks touch coordinates (x, y) with clamping inside safe area
  │
[User Releases Touch]
  ├── Clamps coordinates within safe area bounds (insets + margins)
  │
  ├── 1. AsyncStorage.setItem('@expyrico_menu_button_position', JSON.stringify({ x, y }))
  └── 2. Debounced PATCH /v1/me/preferences { uiPreferences: { menuButtonPosition: { x, y } } }
       │
       ▼
[BottomActionNavBar Dynamic Quadrant Adaptation]
  ├── Horizontally: opens rightward if x <= screenWidth / 2, leftward if x > screenWidth / 2
  └── Vertically: opens downward if y <= screenHeight / 2, upward if y > screenHeight / 2
```

## Related Code Files

### Create
- `apps/mobile/src/components/DraggableFloatingButton.tsx` — Gesture-enabled draggable wrapper with spring docking physics.
- `apps/mobile/src/store/uiPreferencesStore.ts` — Store managing UI customization preferences with local cache and backend sync.
- `apps/mobile/tests/unit/draggable-floating-button.test.tsx` — Unit tests for tap vs drag detection, boundary clamping, and dock snapping.

### Modify
- `apps/mobile/src/navigation/TabsNavigator.tsx` — Integrate `DraggableFloatingButton` and adapt popover menu anchor styles.
- `api/src/routes/me/preferences.ts` — Expand preference schema to accept and persist `uiPreferences.menuButtonPosition`.
- `packages/shared/src/schemas/user.ts` — Add `uiPreferencesSchema` with `menuButtonPosition` type definitions.

## Implementation Steps

1. **Shared Schema & API (`packages/shared`, `api`)**:
   <!-- Updated: Red Team Review - Registered under /v1/me/preferences with strict zod parsing -->
   - Add Prisma migration adding `uiPreferences Json? @map("ui_preferences")` to `model User`.
   - In `packages/shared/src/schemas/user.ts`, define:
     ```typescript
     export const menuButtonPositionSchema = z.object({
       x: z.number().min(0).max(4000),
       y: z.number().min(0).max(4000),
     }).strict();
     export const userUiPreferencesSchema = z.object({
       menuButtonPosition: menuButtonPositionSchema.optional(),
     }).strict();
     export type UserUiPreferences = z.infer<typeof userUiPreferencesSchema>;
     ```
   - In `api/src/routes/me/preferences.ts`, implement `PATCH /v1/me/preferences` allowing the authenticated user to update their own `uiPreferences`.
2. **UI Preferences Store (`uiPreferencesStore.ts`)**:
   - Create Zustand store:
     ```typescript
     interface UiPreferencesState {
       menuButtonPosition: { x: number; y: number } | null;
       setMenuButtonPosition: (pos: { x: number; y: number }) => void;
       hydrate: () => Promise<void>;
     }
     ```
   - Auto-saves to `AsyncStorage` and triggers debounced API sync.

3. **Draggable Component (`DraggableFloatingButton.tsx`)**:
   - Implement with `PanResponder` and `Animated.ValueXY`:
     - Displace position during touch.
     - On release: clamp `x` within `[safeLeft + 12, screenWidth - buttonWidth - safeRight - 12]`, clamp `y` within `[safeTop + 60, screenHeight - buttonHeight - safeBottom - 70]`.
     - Fire `onPress` callback if total movement was under 6px.
     - Fire `onPositionChange({ x, y })` on release.
4. **Integration in `TabsNavigator.tsx`**:
   - Wrap `menuButton` inside `DraggableFloatingButton`.
   - Update `styles.verticalMenuContainer`:
     - Dynamically toggle `left: 16` vs `right: 16` based on active dock side.
     - Dynamically position above the button's vertical position.

5. **Unit & Behavioral Testing**:
   - Test tap execution without drag.
   - Test release on left half snaps to left side.
   - Test release on right half snaps to right side.
   - Test storage persistence and API call payload.

## Success Criteria

- [x] Menu button can be dragged across the screen and smoothly springs to the nearest left or right screen edge.
- [x] Tapping without dragging continues to reliably open/close the navigation menu.
- [x] Dragged position is clamped within safe margins, never overflowing the screen.
- [x] Menu popover dynamically anchors to the same side as the button so it never clips off-screen.
- [x] Position is saved to AsyncStorage immediately, mounting with zero flicker on app restart.
- [x] Position is synchronized to backend database and restored across sessions/devices.
- [x] Automated tests verify gesture thresholds, snapping math, and storage persistence.

## Risk Assessment

- **Risk**: Gesture conflict between dragging the menu button and scrolling the underlying list (`RecordList`).
  - **Observable Signal**: List scrolls when user tries to drag the button, or button blocks list scrolling.
  - **Mitigation**: `DraggableFloatingButton` manages touch responder termination cleanly: it only captures touch once horizontal or vertical delta exceeds 6px, and releases responder gracefully. The button has `zIndex: 101` and pointerEvents isolated.
