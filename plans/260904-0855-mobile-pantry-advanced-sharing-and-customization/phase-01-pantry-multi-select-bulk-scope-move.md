---
phase: 1
title: "Pantry Multi-Select and Bulk Scope Move"
status: done
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Pantry Multi-Select and Bulk Scope Move

## Overview
Enable users to long-press any grocery item in their pantry list to activate multi-select mode, select one or multiple items, and bulk-reassign their scope between Personal Pantry and any Household. Changes are applied immediately in local WatermelonDB and synced atomically to the backend Postgres database under household advisory locks.

## Requirements

### Functional
- **Long-Press Activation**: Long-pressing on any `RecordCard` activates multi-select mode with light haptic feedback (`react-native-haptic-feedback` or vibration fallback) and automatically selects the pressed item.
- **Selection Toggling**: In multi-select mode, tapping any item card toggles its selection checkbox rather than opening the record detail screen.
- **Bulk Action Bar**: When multi-select mode is active, an anchored bottom action bar appears displaying:
  - Selected count: `"N selected"`.
  - Action buttons: `"Select All"` / `"Deselect"`.
  - Destination trigger: `"Move to..."` opening a scope picker sheet.
  - Cancel button: `"Done"` or `"Cancel"` exiting multi-select mode.
- **Scope Reassignment Modal & Collision Handling**:
  <!-- Updated: Validation Session 1 - Skip items already in target scope -->
  - Displays `"Personal Pantry (Private)"` and each household the user belongs to (e.g., `"Our Kitchen (Shared)"`).
  - Highlights current scope if all selected items share the same scope.
  - **Collision Rule**: If any selected items are already in the chosen target destination, they are silently preserved in that destination while all remaining items are migrated. Feedback toast reflects the actual moved count: `"Moved N items to [Target]"`.
  - Tapping a destination immediately moves all eligible selected items and closes the sheet.
- **Hardware Back Handling**: On Android, pressing the hardware back button or back gesture exits multi-select mode cleanly without mutating records.
- **Backend Atomic Endpoint & Lock Ordering**:
  <!-- Updated: Red Team Review - Strict authorization, online-only operation, and deadlock-free lock ordering -->
  - `POST /v1/records/bulk-scope` accepting `{ recordIds: string[], targetHouseholdId: string | null }`.
  - **Batch Authorization (No IDOR)**: Queries all requested records. For each record, asserts caller has write access (`record.userId === req.user.id || isMemberOfSourceHousehold`). If `targetHouseholdId` is non-null, asserts caller is active member (`assertMember(targetHouseholdId, req.user.id)`). If any single record fails authorization, the entire transaction is rejected with 403 Forbidden.
  - **Deadlock-Free Lock Ordering**: Collects unique household IDs involved (source household IDs + target household ID). Sorts them in ascending lexicographical order and acquires `pg_advisory_xact_lock(hashtext(id::text))` sequentially with a 5-second statement timeout to prevent concurrent multi-household deadlocks.
  - Updates records in a single database transaction.
  - Reschedules personal expiry reminders when moving to personal; fans out shared reminders when moving to household.
  - Returns `{ updatedCount: number, recordIds: string[] }`.

### Non-Functional
- **Online Atomic Operation**: Bulk scope reassignment is an online-only operation executed directly via `POST /v1/records/bulk-scope`. Client invokes the API first; upon 200 OK, local WatermelonDB rows are updated to the confirmed server scope. If offline, the "Move" action displays a clear prompt: `"Internet connection required to move pantry items"`. This prevents client-server scope divergence rejected by the sync protocol.
- **Instant Local Feedback**: Once the server responds, WatermelonDB updates all records in a single `database.write(...)` batch, reflecting new badges and groupings with zero UI stutter.
- **Design System Alignment**: Selection checkboxes and badges use Expyrico Fresh Sage (`#4BAE8A`), Deep Sage (`#3A8F6F`), and Mint Mist (`#D6F0E6`).

## Architecture & Data Flow

```
[RecordCard] ──► onLongPress ──► Set selectionMode = true, selectedIds.add(id)
       │
       ▼
[RecordList] ──► Renders Selection Checkboxes on cards & Contextual Bottom Action Bar
       │
[Tap "Move to..."] ──► Displays Target Scope Sheet (Personal vs Household A / B)
       │
       ▼
[Client Handler]
  ├── 1. WatermelonDB batch update: records.map(r => r.update(household_id = target))
  ├── 2. Trigger POST /v1/records/bulk-scope { recordIds, targetHouseholdId }
  └── 3. Exit multi-select mode & show toast ("3 items moved to Our Kitchen")
       │
       ▼
[Backend POST /v1/records/bulk-scope]
  ├── Lock household rows with pg_advisory_xact_lock
  ├── Verify permissions (assertMember for household target, assertOwner/record owner)
  ├── UPDATE records SET household_id = target, updated_at = NOW() WHERE id IN (...)
  ├── Cancel/Fan-out member expiry reminders via BullMQ notificationSendQueue
  └── Return 200 OK { updatedCount: 3 }
```

## Related Code Files

### Create
- `api/src/routes/records/bulk-scope.ts` — Backend endpoint for atomic bulk scope migration.
- `api/tests/integration/records-bulk-scope.test.ts` — Integration tests verifying permissions, reminder scheduling, and concurrency.
- `apps/mobile/src/features/records/BulkScopeModal.tsx` — Modal sheet for selecting destination household or personal pantry.
- `apps/mobile/tests/unit/record-bulk-scope.test.tsx` — Unit tests for multi-select state, select all, and batch update.

### Modify
- `packages/shared/src/schemas/record.ts` — Add `recordBulkScopeSchema` and `recordBulkScopeResponseSchema`.
- `apps/mobile/src/features/records/RecordList.tsx` — Integrate selection state, hardware back handler, long-press wiring, and bulk action bar.
- `apps/mobile/src/features/records/RecordCard.tsx` — Add `selectionMode`, `isSelected`, `onToggleSelect`, and `onLongPress` props with checkbox UI.
- `apps/mobile/src/api/records.ts` — Add `bulkPatchLocalRecordScope(...)` helper.
- `api/src/routes/records/index.ts` — Register bulk scope route.

## Implementation Steps

1. **Shared Contract (`packages/shared`)**:
   - Define `recordBulkScopeSchema`:
     ```typescript
     export const recordBulkScopeSchema = z.object({
       recordIds: z.array(z.string().uuid()).min(1).max(100),
       targetHouseholdId: z.string().uuid().nullable(),
     });
     export type RecordBulkScope = z.infer<typeof recordBulkScopeSchema>;
     ```
   - Rebuild `@expyrico/shared` and sync to `apps/mobile/local-packages/@expyrico/shared/dist`.

2. **Backend Route (`api/src/routes/records/bulk-scope.ts`)**:
   - Verify caller has access to all requested records (`record.userId === req.user.id || memberOfRecordHousehold`).
   - If `targetHouseholdId` is provided, verify caller is an active member (`assertMember(targetHouseholdId, req.user.id)`).
   - In a transaction, lock involved households and execute `prisma.record.updateMany(...)`.
   - Manage reminders: invoke `reschedulePersonalRecordReminders` for items moving to personal; invoke `fanOutHouseholdRecordReminders` for items moving to household.

3. **Mobile WatermelonDB & API (`apps/mobile/src/api/records.ts`)**:
   - Implement `bulkPatchLocalRecordScope(recordIds: string[], targetHouseholdId: string | null)`:
     - Run `database.write` iterating over records and setting `householdId`, `pendingSync = true`.
     - Call `apiClient.post('/records/bulk-scope', ...)`.

4. **Component Updates (`RecordCard.tsx` & `RecordList.tsx`)**:
   - In `RecordCard.tsx`:
     - Add animated checkmark circle on the leading side when `selectionMode === true`.
     - Add `onLongPress` callback to card `Pressable`.
   - In `RecordList.tsx`:
     - Maintain `selectionMode: boolean`, `selectedIds: Set<string>`.
     - When `selectionMode` is true, render fixed floating bottom action bar above tabs.
     - Add `BackHandler.addEventListener('hardwareBackPress', ...)` on Android.

5. **Destination Picker Modal (`BulkScopeModal.tsx`)**:
   - Clean bottom sheet listing "Personal Pantry" and available households.
   - Shows summary: `"Move {N} items to..."`.

## Success Criteria

- [x] Long-pressing any record card enters multi-select mode with that item selected.
- [x] Tapping cards in selection mode toggles selection; "Select All" selects all filtered records.
- [x] Destination picker allows moving items to Personal or any joined Household.
- [x] Backend updates records atomically and adjusts notification reminders.
- [x] Android hardware back button cancels multi-select mode.
- [x] 100% automated test coverage in API and mobile suites.

## Risk Assessment

- **Risk**: Concurrent record edits while bulk moving.
  - **Observable Signal**: P2002/P2025 or version conflict on backend sync.
  - **Mitigation**: Backend acquires `pg_advisory_xact_lock` for affected household IDs; WatermelonDB uses local batch write with sync queue retry.
- **Risk**: Performance lag when selecting dozens of items in a long list.
  - **Observable Signal**: Frame drops on checkbox tap.
  - **Mitigation**: Store selection as `Set<string>` and use shallow component memoization (`React.memo` on `RecordCard` with custom `arePropsEqual` checking `isSelected`).
