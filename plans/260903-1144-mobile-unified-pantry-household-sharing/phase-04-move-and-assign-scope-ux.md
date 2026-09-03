---
phase: 4
title: "Move & Assign Scope in Item Detail and Creation"
status: completed
priority: P1
effort: "4-5h"
dependencies: ["phase-03-item-card-attribution-badges.md"]
---

# Phase 4: Move & Assign Scope in Item Detail and Creation

## Overview
Enable users to seamlessly move existing pantry items between Personal and Household pantries within the `RecordDetail` screen, and ensure item creation flows (scanner and manual add) inherit the active pantry scope.

## Requirements
- Functional:
  - Add a "Pantry Location" row in `apps/mobile/app/(app)/record/[id].tsx` (`RecordDetail`):
    - Displays current assignment: `Personal Pantry` or `[Household Name]`.
    - If user belongs to $\ge 1$ household, tapping presents an Expyrico modal/action picker allowing them to change the assignment.
    - Selecting an option updates the record via `patchLocalRecord(record.id, { householdId })`.
    - Instantly updates local UI and queues sync to server (`PATCH /v1/records/:id`).
  - In creation flows (`ScanScreen`, `createLocalRecord` call sites):
    - Always default newly scanned or added items to `householdId: null` (Personal Pantry), ensuring personal ownership by default, while offering the option to assign to a member household.
- Non-functional & Security:
  - User can only assign a record to households they are an active member of.
  - Reassignment to null cleanly converts a shared item to a personal item.

## Architecture
```tsx
// apps/mobile/app/(app)/record/[id].tsx
export function RecordLocationRow({
  record,
  households,
  onReassign,
}: {
  record: LocalRecord;
  households: Household[];
  onReassign: (newHouseholdId: string | null) => Promise<void>;
}) {
  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const currentHousehold = households.find((h) => h.id === record.householdId);
  const locationLabel = currentHousehold ? currentHousehold.name : 'Personal Pantry';

  return (
    <View style={styles.row}>
      <Text style={styles.label}>STORED IN</Text>
      <Pressable
        testID="record-reassign-scope-btn"
        disabled={households.length === 0}
        onPress={() => setModalVisible(true)}
        style={styles.selector}
      >
        <Ionicons
          name={record.householdId ? 'people-outline' : 'person-outline'}
          size={16}
          color={theme.colors.primaryDark}
        />
        <Text style={styles.valueText}>{locationLabel}</Text>
        {households.length > 0 && (
          <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
        )}
      </Pressable>

      {/* Scope Selection Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        {/* Render Personal option and Household options */}
      </Modal>
    </View>
  );
}
```

## Related Code Files
- Modify:
  - `apps/mobile/app/(app)/record/[id].tsx`
  - `apps/mobile/app/(app)/scan.tsx`
  - `apps/mobile/src/api/records.ts`
- Create:
  - `apps/mobile/tests/unit/record-scope-reassign.test.tsx`

## Implementation Steps
1. Add `RecordLocationRow` in `apps/mobile/app/(app)/record/[id].tsx` with modal dialog to select `Personal` or a member `Household`.
2. Connect selection to `patchLocalRecord(record.id, { householdId: selectedId })`.
3. In `apps/mobile/app/(app)/scan.tsx` (and pantry add flows), pass `householdId` from `usePantryScope()` when `scope === 'household'`.
4. Write unit tests in `apps/mobile/tests/unit/record-scope-reassign.test.tsx`:
   - Verifies changing location from Personal to Household updates `householdId` in WatermelonDB.
   - Verifies changing location from Household back to Personal clears `householdId` to null.
5. Verify tests with Jest.

## Success Criteria
- [x] Users can view the current pantry location of any item in `RecordDetail`.
- [x] Users belonging to $\ge 1$ household can tap to reassign the item between Personal and any member Household.
- [x] Reassigning an item updates the local database immediately and schedules server sync.
- [x] Scanning an item while in a household scope assigns it to that household.
- [x] Unit tests pass with 100% assertions green.

## Risk Assessment
- **Risk**: Moving an item to a household with sync offline might cause a race condition if another user deletes it concurrently.
- **Mitigation**: `db/sync.ts` already implements split conflict resolution: for household records, server state wins; on deletion conflict, the local record is purged cleanly.
- **Observable Signal**: Sync conflict reported in `RecordSyncConflict`.
- **Pre-decided Response**: Rely on existing `db/sync.ts` split conflict policy.
