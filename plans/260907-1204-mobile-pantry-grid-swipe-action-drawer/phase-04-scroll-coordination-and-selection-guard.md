---
phase: 4
title: "Scroll Coordination and Selection Guard"
status: completed
priority: P1
effort: "45m"
dependencies: ["phase-03-record-list-callback-wiring"]
---

# Phase 4: Scroll Coordination and Selection Guard

## Overview
Implement global drawer coordination in `RecordList.tsx` so only one card action drawer is open at any time, automatically dismiss drawers on vertical list scrolling, and disable gestures when selection mode is active.

## Requirements
- Functional:
  - **Mutual Exclusivity**:
    - Manage `const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);` in `RecordList.tsx`.
    - Pass `isDrawerOpen={activeDrawerId === item.id}` to each `PantryGridCard`.
    - When card B opens, `activeDrawerId` switches to `B`, immediately triggering card A to snap closed.
  - **Multi-Modal Dismissal (Scroll, Close Button, Action Execution)**:
    - In `RecordList.tsx`, `handleScrollBegin` resets `setActiveDrawerId(null)`.
    - Tapping the `[✕]` header button calls `onCloseDrawer()`, setting `setActiveDrawerId(null)`.
    - Executing any action (`+1`, `Edit`, `Delete`) automatically snaps the drawer shut.
    - The drawer interior uses `pointerEvents="box-none"` without an invisible background tap dismiss button, preventing mis-taps when aiming at action circles.
<!-- Updated: Red Team Session 1 - Header dismiss & touch target padding -->
  - **Selection Mode Guard & Action Freeze**:
    - When `selectionMode === true`, disable the swipe gesture in `PantryGridCard` (`enabled={!selectionMode}`).
    - Activating selection mode (via long-press on any card or global selection state change) immediately calls `setActiveDrawerId(null)` to snap shut any currently open drawer.
    - In selection mode, action callbacks (`onAddQuantity`, `onEdit`, `onDelete`) are not invokable on unselected rows, preventing accidental mutations while the bulk action bar is visible.
<!-- Updated: Red Team Session 1 - Selection mode drawer reset and action freeze -->
  - **View Mode Switch & Data Shift Reset**:
    - Toggling between List and Grid view resets `setActiveDrawerId(null)`.
    - If the item list mutates (e.g. sync insertion or item deletion), reset `setActiveDrawerId(null)` to prevent open drawers from desyncing across re-paired chunk tuples.
  - **SectionList Reactivity**:
    - Pass `activeDrawerId` in `SectionList`'s `extraData` object:
      `extraData={{ viewMode, selectionMode, selectedIds, householdNames, activeDrawerId }}`.
- Non-functional:
  - Zero frame drops or lag when scrolling.
  - Clean gesture isolation: vertical list scrolling takes precedence over horizontal card swiping.

## Architecture & Coordination Logic

```
User Action                         State Transition                Visual Result
─────────────────────────────────────────────────────────────────────────────────
Swipe Card A left              setActiveDrawerId('A')         Card A drawer opens
Swipe Card B left              setActiveDrawerId('B')         Card A closes, B opens
Scroll SectionList (vertical)  setActiveDrawerId(null)        Card B closes
Long-press Card (select)       selectionMode = true           Drawers disabled & closed
Toggle View Mode (List/Grid)   setActiveDrawerId(null)        Drawers closed
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/src/features/records/PantryGridCard.tsx`

## Implementation Steps
1. **Add `activeDrawerId` State in `RecordList.tsx`**:
   ```typescript
   const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
   ```
2. **Wire in `renderItem`**:
   ```typescript
   <PantryGridCard
     record={first}
     isDrawerOpen={activeDrawerId === first.id}
     onOpenDrawer={() => setActiveDrawerId(first.id)}
     onCloseDrawer={() => {
       if (activeDrawerId === first.id) setActiveDrawerId(null);
     }}
     ...
   />
   ```
3. **Reset on Scroll**:
   ```typescript
   const handleScrollBegin = useCallback(() => {
     onEndReachedCalledDuringMomentumRef.current = false;
     setActiveDrawerId(null);
   }, []);
   ```
4. **Disable on Selection Mode**:
   In `PantryGridCard.tsx`:
   `enabled={!selectionMode}` on `PanGestureHandler`.
5. **Add to `extraData`**:
   Ensure `SectionList` re-renders promptly when `activeDrawerId` changes.

## Success Criteria
- [x] Opening a second card drawer automatically closes the first card drawer.
- [x] Scrolling the SectionList smoothly closes any open drawer.
- [x] In bulk selection mode, swiping is disabled and tapping toggles selection checkboxes.
- [x] Switching view modes resets all drawers to front state.

## Risk Assessment
- *Risk*: Multiple state re-renders of the entire SectionList when `activeDrawerId` changes.
- *Mitigation*: Only the two affected card instances (the one closing and the one opening) re-render because `isDrawerOpen` is boolean-compared; other cards receive unchanged props.
