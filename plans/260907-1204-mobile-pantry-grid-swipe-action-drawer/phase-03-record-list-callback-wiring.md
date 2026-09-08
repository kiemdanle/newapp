---
phase: 3
title: "RecordList Callback Wiring"
status: completed
priority: P1
effort: "45m"
dependencies: ["phase-02-swipe-gesture-and-state-machine"]
---

# Phase 3: RecordList Callback Wiring

## Overview
Connect the pantry inventory mutations (`onAddQuantity`, `onEdit`, `onDelete`) from `RecordList.tsx` down into `PantryGridCard.tsx`, ensuring grid actions behave identically to existing list swipe actions.

## Requirements
- Functional:
  - Extend `PantryGridCardProps` with action callbacks:
    ```typescript
    export interface PantryGridCardProps {
      record: LocalRecord;
      onPress: () => void;
      householdName?: string | null;
      showHouseholdBadge?: boolean;
      selectionMode?: boolean;
      isSelected?: boolean;
      onLongPress?: () => void;
      onToggleSelect?: () => void;
      onAddQuantity?: (record: LocalRecord) => void;
      onEdit?: (record: LocalRecord) => void;
      onDelete?: (record: LocalRecord) => void;
    }
    ```
  - In `RecordList.tsx`'s `renderItem`, pass the existing handlers to both slot 1 (`first`) and slot 2 (`second`):
    ```typescript
    onAddQuantity={handleAddQuantity}
    onEdit={handleEdit}
    onDelete={handleDelete}
    ```
  - Action circle execution & debounce lock:
    - When user taps any action circle, enforce an `isProcessing` lock preventing rapid double-taps from queueing duplicate stale mutations.
    - Invoke the callback with the record (`onAddQuantity(record)` / `onEdit(record)` / `onDelete(record)`).
    - Immediately call `snapClose()` to smoothly transition back to front card.
<!-- Updated: Red Team Session 1 - Action debounce & in-flight mutation lock -->
  - **Household Delete Creator Permission Gate**:
    - Server `DELETE /records/:id` enforces owner-only (`userId`). On 404, client sync permanently destroys the local row.
    - `PantryGridActionDrawer` checks whether the user is the creator: `isCreator = !record.householdId || record.userId === currentUserId`.
    - If `!isCreator`, the `Delete` action button is not rendered or disabled, preventing unauthorized deletion attempts that corrupt local sync state.
<!-- Updated: Red Team Session 1 - Household delete creator permission gate -->
  - **Deletion Confirmation Display Name**:
    - Deletion confirmation dialog must display `record.customName || product?.name || 'this item'`, resolving ambiguity for catalog-backed products where `customName` is null.
<!-- Updated: Red Team Session 1 - Deletion confirmation display name -->
- Non-functional:
  - Preserves exact confirmation dialog with resolved product name before delete.
  - Zero regression on existing list row action handlers.

## Architecture & Interaction Flow

```
RecordList.tsx
  ├── handleAddQuantity -> patchLocalRecord(id, qty + 1)
  ├── handleEdit -> opens QuickEditModal
  └── handleDelete -> Alert.alert confirmation -> deleteLocalRecord(id)
         │
         ▼
PantryGridCard (Slot 1 & Slot 2)
  └── PantryGridActionDrawer
        ├── [ +1 ]  ──► calls onAddQuantity(record) -> snapClose()
        ├── [Edit]  ──► calls onEdit(record)        -> snapClose()
        └── [Delete]──► calls onDelete(record)      -> snapClose()
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/PantryGridCard.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/src/features/records/PantryGridCard.test.tsx`

## Implementation Steps
1. **Extend `PantryGridCardProps`**:
   Add `onAddQuantity`, `onEdit`, `onDelete` to `PantryGridCardProps` in `PantryGridCard.tsx`.
2. **Wire in `RecordList.tsx`**:
   In `RecordList.tsx:renderItem`:
   ```typescript
   <PantryGridCard
     record={first}
     onPress={() => handlePressItem(first.id)}
     onAddQuantity={handleAddQuantity}
     onEdit={handleEdit}
     onDelete={handleDelete}
     ...
   />
   ```
   Repeat for `second` if present.
3. **Auto-Close on Action**:
   In `PantryGridCard.tsx`, wrap action triggers to call `snapClose()` after invoking the handler:
   ```typescript
   const handleAdd = () => {
     snapClose();
     onAddQuantity?.(record);
   };
   ```
4. **Unit Tests**:
   Update `PantryGridCard.test.tsx` verifying:
   - Tapping `+1` calls `onAddQuantity(mockRecord)` and triggers `snapClose`.
   - Tapping `Edit` calls `onEdit(mockRecord)`.
   - Tapping `Delete` calls `onDelete(mockRecord)`.

## Success Criteria
- [x] Tapping `+1` on a grid card increments item quantity by 1 in local database.
- [x] Tapping `Edit` on a grid card opens `QuickEditModal`.
- [x] Tapping `Delete` triggers the confirmation alert and removes item if confirmed.
- [x] Card snaps shut immediately when any action is tapped.

## Risk Assessment
- *Risk*: Rapid successive taps on `+1` could fire multiple mutations before drawer closes.
- *Mitigation*: Trigger `snapClose()` synchronously before invoking the mutation callback, preventing duplicate taps.
