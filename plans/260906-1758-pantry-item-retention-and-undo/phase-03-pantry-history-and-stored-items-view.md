---
phase: 3
title: "Pantry History & Stored Items View"
status: complete
priority: P1
effort: "1 day"
dependencies: ["phase-02-local-state-and-immediate-undo"]
---

# Phase 3: Pantry History & Stored Items View

<!-- Updated: Validation Session 1 - Confirmed Dedicated History screen accessed via Pantry header icon -->
<!-- Updated: Red Team Review Session 1 - Applied findings 4 (WatermelonDB status index for fast reactive query), 9 (automatic personal fallback when restoring item from dissolved/revoked household) -->

## Overview
Build the dedicated Pantry History screen allowing users to browse, search, and restore stored items that were previously marked as used or discarded. This guarantees zero data loss, transparent consumption logging, visibility into waste reasons, and a persistent recovery mechanism beyond the 6-second immediate undo toast.

## Requirements
- Functional:
  - Add `PantryHistory` route to `AppNavigator.tsx` pointing to `apps/mobile/app/(app)/pantry/history.tsx`.
  - Add a dedicated "History" icon button (`testID="home-pantry-history-btn"`) in the Pantry tab header (`apps/mobile/app/(app)/(tabs)/home.tsx`) using `time-outline` icon.
  - Implement `usePantryHistoryRecords(filter?: 'all' | 'consumed' | 'discarded')` in `apps/mobile/src/api/records.ts` observing WatermelonDB records where `status IN ('consumed', 'discarded')` leveraging the newly indexed `status` column.
  - Provide a 3-pill segmented filter: `All` | `Used` | `Discarded`.
  - Provide summary cards showing count of used items, discarded items, and waste reasons.
  - Render historical items with date badges ("Used on Mon, Sep 4" in Fresh Sage, "Discarded (Expired) on Tue, Sep 5" in Muted Alert).
  - Include a prominent "Restore to Pantry" button on each card calling `restoreLocalRecord(record.id)`. If the item belonged to a household that is no longer accessible, automatically fall back to personal scope (`householdId: null`) with user confirmation.
  - Update `RecordDetail` (`apps/mobile/app/(app)/record/[id].tsx`) so that viewing a non-active record displays its historical status, waste reason, and a primary "Restore to Pantry" button instead of consume/discard buttons.
- Non-functional:
  - Adhere to Expyrico Colour Palette (`docs/design/expyrico-colour-palette.md`): Fresh Sage `#4BAE8A`, Mint Mist `#D6F0E6`, Warm White `#FAFAF8`, Honey `#F5A623`, Stone `#F0F0ED`.
  - Fast WatermelonDB indexed query with instant reactive updates when items are restored.

## Architecture & Screen Structure

### 1. Navigation & Header Entry Point
```tsx
// In apps/mobile/app/(app)/(tabs)/home.tsx headerActions:
<Pressable
  testID="home-pantry-history-btn"
  accessibilityRole="button"
  accessibilityLabel="View pantry history and discarded items"
  onPress={() => navigation.navigate('PantryHistory')}
  style={styles.iconBtn}
>
  <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
</Pressable>
```

### 2. History Query Hook (`apps/mobile/src/api/records.ts`)
```typescript
export function usePantryHistoryRecords(filter: 'all' | 'consumed' | 'discarded' = 'all'): LocalRecord[] {
  const [rows, setRows] = useState<LocalRecord[]>([]);
  const { scope, householdId } = usePantryScope();

  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const statusCondition =
      filter === 'all'
        ? Q.where('status', Q.oneOf(['consumed', 'discarded']))
        : Q.where('status', filter);

    const conditions = [
      statusCondition,
      Q.where('pending_delete', false),
    ];

    if (scope === 'personal') {
      conditions.push(Q.where('household_id', null));
    } else if (scope === 'household' && householdId) {
      conditions.push(Q.where('household_id', householdId));
    }

    const sub = col
      .query(...conditions, Q.sortBy('updated_at', Q.desc))
      .observe()
      .subscribe((res) => setRows(res.map(toLocal)));

    return () => sub.unsubscribe();
  }, [filter, scope, householdId]);

  return rows;
}
```

### 3. History Screen Layout (`apps/mobile/app/(app)/pantry/history.tsx`)
```
+-----------------------------------------------------------+
| [< Back]               Pantry History                     |
+-----------------------------------------------------------+
| [ All (24) ]       [ Used (19) ]       [ Discarded (5) ]  |
+-----------------------------------------------------------+
|  +---------------------------+ +------------------------+ |
|  | 19 items consumed         | | 5 items discarded      | |
|  | 79% consumption rate      | | 21% waste rate         | |
|  +---------------------------+ +------------------------+ |
|                                                           |
|  [Item Card]                                              |
|  [Thumb] Organic Strawberries       [Used 2d ago]         |
|          Produce - 1 pack           [Restore to Pantry]   |
|                                                           |
|  [Item Card]                                              |
|  [Thumb] Sourdough Bread            [Discarded · Expired] |
|          Bakery - 1 loaf            [Restore to Pantry]   |
|                                                           |
+-----------------------------------------------------------+
```

## Related Code Files
- Create: `apps/mobile/app/(app)/pantry/history.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`
- Modify: `apps/mobile/src/api/records.ts`
- Modify: `apps/mobile/app/(app)/record/[id].tsx`
- Create: `apps/mobile/tests/unit/pantry-history.test.tsx`

## Implementation Steps
1. **Route Declaration**: Add `PantryHistory: undefined` to `AppStackParamList` in `apps/mobile/src/navigation/AppNavigator.tsx` and register `history.tsx`.
2. **Header Action**: Add the History button (`testID="home-pantry-history-btn"`) into `home.tsx` next to the household share icon.
3. **Query Hook**: Implement `usePantryHistoryRecords` in `apps/mobile/src/api/records.ts` supporting status filtering, scope filtering, and indexed sorting.
4. **History Screen Implementation**:
   - Build `PantryHistoryScreen` with segmented pill filters (`All`, `Used`, `Discarded`).
   - Add KPI summary row calculating total used vs discarded count.
   - Render history items using `HistoryRecordCard` component with distinct status badges (Fresh Sage for used, Alert/Honey for discarded, plus reason chip).
   - Wire "Restore to Pantry" action button to `restoreLocalRecord(record.id)`.
5. **RecordDetail Adaptation**:
   - When viewing a record where `record.status !== 'active'`, replace the bottom action bar with a single primary button: `"Restore to Pantry"`.
6. **Unit & Component Testing**:
   - Create `apps/mobile/tests/unit/pantry-history.test.tsx` verifying:
     - Filtering between All, Used, and Discarded.
     - Tapping "Restore to Pantry" restores the item and removes it from history.
     - Scope switching (personal vs household) filters history correctly.
     - Reverting to personal pantry when household membership was revoked.

## Success Criteria
- [x] Users can navigate to "Pantry History" from the Pantry tab header.
- [x] History lists all used and discarded items with exact status, timestamps, and discard reasons.
- [x] Switching filter tabs updates the list dynamically between All, Used, and Discarded.
- [x] Tapping "Restore to Pantry" restores the item to the active pantry list immediately.
- [x] In `RecordDetail`, non-active items display their status and allow restoration.
- [x] Tests pass covering history querying, filtering, and restoration.

## Risk Assessment
- **Risk:** Large history collections slowing down SQLite queries over time.
  - *Observable Signal:* Noticeable frame drop when opening History after hundreds of items.
  - *Mitigation:* WatermelonDB indexed query with virtualized list (`FlatList` with `windowSize={10}`).
- **Risk:** Confusing UX if a restored item reappears with an already-expired date.
  - *Observable Signal:* User restores a discarded item and it immediately flags red "Overdue".
  - *Mitigation:* Clear visual indicator showing the item's expiry date on the restore card, allowing user to tap into details and edit the expiry date if desired.
