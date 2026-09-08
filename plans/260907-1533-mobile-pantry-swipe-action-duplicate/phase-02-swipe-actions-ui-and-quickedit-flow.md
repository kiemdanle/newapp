---
phase: 2
title: "Swipe Actions UI (Edit / Duplicate / Delete)"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1]
---

# Phase 2: Swipe Actions UI (Edit / Duplicate / Delete)

## Overview
Update the swipe action rows and drawer across both List View (`RecordCard.tsx`) and Grid View (`PantryGridActionDrawer.tsx`, `PantryGridCard.tsx`). Remove the `+1` quick-increment button completely and introduce the `Duplicate` action in the middle position (`Edit` / `Duplicate` / `Delete`). Wire `onDuplicate` to the in-memory draft handler established in Phase 1.

<!-- Updated: Validation Session 3 - Focus on UI action order and wiring -->

## Requirements
- Functional:
  - In `RecordCard.tsx` (List View swipe row):
    - Remove the `+1` action button and its `onAddQuantity` prop.
    - Rearrange buttons in exact order: `Edit` (left), `Duplicate` (middle), `Delete` (right).
    - `Edit` button: icon `create-outline`, label `Edit`, background `theme.colors.accent` (`#F5A623`), `testID="record-edit-${record.id}"`.
    - `Duplicate` button: icon `copy-outline`, label `Duplicate`, background `theme.colors.primary` (`#4BAE8A`), `testID="record-duplicate-${record.id}"`.
    - `Delete` button: icon `trash-outline`, label `Delete`, background `theme.colors.danger` (`#E0442A`), `testID="record-delete-${record.id}"`.
    - When any action is tapped, automatically close the swipeable container via `swipeableRef.current?.close()`.
  - In `PantryGridActionDrawer.tsx` (Grid View drawer):
    - Remove `+1` action circle and its `onAddQuantity` prop.
    - Rearrange 3 action circles in exact order: `Edit` (top), `Duplicate` (middle), `Delete` (bottom).
    - `Edit` circle: icon `create-outline`, label `Edit`, background `theme.colors.accent`, `testID="record-edit-${record.id}"`.
    - `Duplicate` circle: icon `copy-outline`, label `Duplicate`, background `theme.colors.primary`, `testID="record-duplicate-${record.id}"`.
    - `Delete` circle: icon `trash-outline`, label `Delete`, background `theme.colors.danger`, `testID="record-delete-${record.id}"`.
    - Honor `isProcessing` flag to prevent rapid multiple taps while action is in flight.
  - In `PantryGridCard.tsx`:
    - Replace `onAddQuantity` prop with `onDuplicate?: (record: LocalRecord) => void;`.
    - Update `handleActionDuplicate` callback to set `isProcessingRef.current = true`, call `onCloseDrawer?.()`, invoke `onDuplicate?.(rec)`, and reset after debounce.
    - Forward `onDuplicate` to `PantryGridActionDrawer`.
  - In `RecordList.tsx`:
    - Pass `onDuplicate={handleDuplicate}` to `RecordCard` (List View) and `PantryGridCard` (Grid View).

## Architecture
```
[User Swipes Left on Item]
       |
       +---> List View (RecordCard):
       |     [ Edit | Duplicate | Delete ]
       |
       \---> Grid View (PantryGridCard / Drawer):
             ( ) Edit
             ( ) Duplicate
             ( ) Delete
       |
[User taps "Duplicate"]
       |
       +---> Closes swipeable / drawer
       \---> Calls handleDuplicate(record) -> opens QuickEditModal with draft
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/RecordCard.tsx`
- Modify: `apps/mobile/src/features/records/PantryGridActionDrawer.tsx`
- Modify: `apps/mobile/src/features/records/PantryGridCard.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`

## Success Criteria
- [x] List view swipe row displays `Edit / Duplicate / Delete` in that exact order with icons `create-outline`, `copy-outline`, `trash-outline`.
- [x] Grid view action drawer displays `Edit / Duplicate / Delete` in that exact order.
- [x] `+1` quick-increment button is completely removed from both swipe surfaces.
- [x] Tapping `Duplicate` closes the action surface and triggers `onDuplicate`.
- [x] Touch targets are $\ge 44 \times 44\text{ pt}$ and accessible.
