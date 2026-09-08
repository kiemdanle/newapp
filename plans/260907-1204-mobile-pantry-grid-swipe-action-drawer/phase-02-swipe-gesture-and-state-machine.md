---
phase: 2
title: "Swipe Gesture and State Machine"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-01-action-drawer-layout-and-styling"]
---

# Phase 2: Swipe Gesture and State Machine

## Overview
Integrate horizontal swipe-to-reveal gesture mechanics and an animated two-layer state machine into `PantryGridCard.tsx`, sliding the front product card surface to reveal the `PantryGridActionDrawer` beneath with responsive threshold snap-open and spring-close physics.

## Requirements
- Functional:
  - Two-layer architecture with hit-testing & accessibility isolation:
    - **Layer 1 (Underneath)**: `PantryGridActionDrawer` with `pointerEvents={isDrawerOpen ? 'auto' : 'none'}` and `accessibilityElementsHidden={!isDrawerOpen}` so closed drawers never receive accidental touches or TalkBack focus.
<!-- Updated: Red Team Session 1 - Under-drawer a11y & touch isolation -->
    - **Layer 2 (Front)**: Animated product card surface that slides leftward (`translateX: 0` to `-cardWidth`), with `pointerEvents={isDrawerOpen ? 'none' : 'auto'}` so open cards never intercept taps intended for the drawer.
<!-- Updated: Red Team Session 1 - PointerEvents isolation & 3-dots touch separation -->
  - Dual trigger mechanisms:
    - **Swipe Left**: Valid RNGH configuration using `Swipeable` (matching `RecordCard.tsx`'s proven implementation with `rightThreshold={35}, friction={1}, overshootRight={false}`) OR `PanGestureHandler` with `activeOffsetX={-20}`, `failOffsetX={20}`, and `failOffsetY={[-15, 15]}`. Never use illegal syntax `activeOffsetX={[-20, -1]}`.
<!-- Updated: Red Team Session 1 - Valid RNGH gesture config & Swipeable reuse -->
    - **3-Dots (•••) Tap Button**: Positioned in the top row immediately to the left of the status/qty pill, with `testID="record-open-actions-{id}"`. Rendered with `e.stopPropagation()` and touch isolation outside the main card `Pressable` so tapping `•••` opens the drawer without navigating to the record detail screen. Automatically hidden when `selectionMode === true`.
    - **Top-Row De-Crowding**: Remove the permanent idle 22pt checkbox spacer when not in selection mode (`selectionMode ? <Checkbox /> : null`). Apply `flexShrink: 1, numberOfLines={1}` on the status pill so long units (e.g. `12 bottles`) do not collide with the 3-dots button.
<!-- Updated: Red Team Session 1 - Top-row de-crowding and idle spacer removal -->
  - State control:
    - Accept `isDrawerOpen?: boolean` and `onOpenDrawer?: () => void` / `onCloseDrawer?: () => void`.
    - When `isDrawerOpen` transitions to `false`, smoothly animate `translateX` back to `0`.
  - Dismissal:
    - When the drawer is open, tapping the dismiss header `[✕]`, executing an action, or scrolling the list snaps the card shut.
- Non-functional:
  - 60fps native-driven animation using `useNativeDriver: true`.
  - Smooth spring physics (`friction: 7, tension: 40`).
  - No visual flickering between layer changes.

## Architecture & State Machine

```
               Idle (Front Card Visible)
                  translateX = 0
                       │
                       │ User drags left > 45pt
                       ▼
            Dragging (Finger Tracking)
           translateX: 0 -> -cardWidth
                       │
         ┌─────────────┴─────────────┐
         │                           │
  Released < 45pt             Released >= 45pt
  or rightward drag           or velocity < -500
         │                           │
         ▼                           ▼
   Spring to 0              Spring to -cardWidth
 (Front Restored)          (Action Drawer Active)
         ▲                           │
         │   Tap [✕], Tap Outside,   │
         │   List Scroll, or Action  │
         └───────────────────────────┘
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/PantryGridCard.tsx`
- Modify: `apps/mobile/src/features/records/PantryGridCard.test.tsx`

## Implementation Steps
1. **Layer Structure in `PantryGridCard.tsx`**:
   Wrap card contents in an outer container with `overflow: 'hidden'`. Place `<PantryGridActionDrawer>` absolutely positioned beneath the front surface.
2. **Gesture Handler Configuration**:
   Use `PanGestureHandler` with `activeOffsetX={[-20, -1]}` and `failOffsetY={[-10, 10]}`.
   Bind `translateX` value clamped between `-cardWidth` and `0`.
3. **Snap Animation & State Synchronization**:
   ```typescript
   const snapOpen = () => {
     Animated.spring(translateX, {
       toValue: -cardWidth,
       useNativeDriver: true,
       bounciness: 0,
     }).start();
     onOpenDrawer?.();
   };

   const snapClose = () => {
     Animated.spring(translateX, {
       toValue: 0,
       useNativeDriver: true,
       bounciness: 0,
     }).start();
     onCloseDrawer?.();
   };
   ```
4. **Synchronize `isDrawerOpen` Prop**:
   Use `useEffect` on `isDrawerOpen`: when it flips to `false`, call `snapClose()`.
5. **Unit Testing**:
   Verify gesture triggers `onOpenDrawer`, tapping close triggers `snapClose`, and `isDrawerOpen={false}` animates back to front.

## Success Criteria
- [x] Swiping left $> 45\text{ pt}$ snaps the card open to reveal the action drawer.
- [x] Swiping left $< 45\text{ pt}$ springs the card back to the closed state.
- [x] Action drawer buttons are clickable and receive events when open.
- [x] Setting `isDrawerOpen={false}` programmatically closes the drawer.

## Risk Assessment
- *Risk*: `cardWidth` might vary across screen sizes (e.g. 360pt vs 412pt), causing over-slide or under-slide.
- *Mitigation*: Capture dynamic card width via `onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}`, guaranteeing pixel-perfect translation across any device width.
