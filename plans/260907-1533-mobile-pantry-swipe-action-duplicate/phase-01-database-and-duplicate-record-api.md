---
phase: 1
title: "QuickEditModal Expiry Validation & In-Memory Draft Flow"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: QuickEditModal Expiry Validation & In-Memory Draft Flow

## Overview
Implement the in-memory draft flow in `RecordList.tsx` and date validation in `QuickEditModal.tsx`. No database modifications or helper wrappers are needed in `api/records.ts`; the existing `createLocalRecord` already handles all lifecycle fields, sync triggers, and IDs cleanly when the user saves. In `QuickEditModal.tsx`, remove the fallback `expiryDate.trim() || record.expiryDate` and reject empty dates by prompting `WheelDatePickerModal`, ensuring that blank-until-selected drafts cannot be saved without an explicit expiry date.

<!-- Updated: Validation Session 3 - No duplicateLocalRecord, use existing createLocalRecord + strict date validation -->

## Requirements
- Functional:
  - In `QuickEditModal.tsx`:
    - Remove the silent fallback `expiryDate: expiryDate.trim() || record.expiryDate`.
    - In `handleSave`, validate that `expiryDate.trim()` is non-empty:
      ```typescript
      const trimmedExpiry = expiryDate.trim();
      if (!trimmedExpiry) {
        setShowDatePicker(true);
        return;
      }
      ```
    - Pass `expiryDate: trimmedExpiry` to `onSave`.
  - In `RecordList.tsx`:
    - Implement `handleDuplicate` using an in-memory draft:
      ```typescript
      const handleDuplicate = useCallback((record: LocalRecord) => {
        const draft: LocalRecord = {
          ...record,
          id: `draft-duplicate-${record.id}`,
          serverId: null,
          clientId: uuidv4(),
          expiryDate: '', // Blank until selected by user
          status: 'active',
        };
        setEditingRecord(draft);
      }, []);
      ```
    - In `handleCloseEdit`:
      ```typescript
      const handleCloseEdit = useCallback(() => {
        setEditingRecord(null);
      }, []);
      ```
      (If canceled, the draft is cleared from state. Zero database writes, zero sync requests, zero cleanup transactions).
    - In `handleSaveEdit`:
      ```typescript
      const handleSaveEdit = useCallback(async (patch) => {
        if (!editingRecord) return;
        if (editingRecord.id.startsWith('draft-duplicate-')) {
          // Commit new clone via existing createLocalRecord
          await createLocalRecord({
            productId: editingRecord.productId,
            customName: patch.customName !== undefined ? patch.customName : editingRecord.customName,
            category: patch.category !== undefined ? patch.category : editingRecord.category,
            expiryDate: patch.expiryDate,
            quantity: patch.quantity,
            unit: patch.unit,
            price: editingRecord.price,
            store: editingRecord.store,
            notes: editingRecord.notes,
            photoUrl: editingRecord.photoUrl,
            householdId: editingRecord.householdId,
            userId: editingRecord.userId,
          });
        } else {
          await patchLocalRecord(editingRecord.id, patch);
        }
      }, [editingRecord]);
      ```
- Non-functional:
  - Zero changes required to `api/records.ts`.
  - Zero database writes or schema hazards on cancellation.
  - Zero possibility of unexpired items slipping into the inventory.

## Architecture
```
[User taps "Duplicate"]
       |
       v
RecordList constructs in-memory draft (LocalRecord)
  - id: "draft-duplicate-${record.id}"
  - expiryDate: ""
       |
       v
QuickEditModal opens with draft
       |
       +------------------------------------+
       |                                    |
  [User Cancels]                   [User Taps Save]
       |                                    |
       v                                    v
  setEditingRecord(null)           Check expiryDate.trim()
  Zero DB operations!                       |
  Zero sync traffic!               If empty -> opens WheelDatePickerModal
                                            |
                                   If valid -> calls createLocalRecord(...)
                                            - Fresh clientId & recordId
                                            - Clean purchaseDate/consumedAt
                                            - pendingSync = true
                                            - triggerSyncSoon()
                                            v
                                   Lands in active pantry inventory!
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/QuickEditModal.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`

## Success Criteria
- [x] `QuickEditModal` blocks saving if `expiryDate` is empty and automatically triggers `WheelDatePickerModal`.
- [x] `QuickEditModal` no longer falls back to `record.expiryDate` when `expiryDate` is blank.
- [x] In-memory draft clones all metadata without writing to WatermelonDB.
- [x] Canceling the modal performs zero database calls.
- [x] Saving the modal commits via existing `createLocalRecord`.

## Risk Assessment
- Risk: User taps Save without noticing date is blank.
  - Mitigation: Automatically opening `WheelDatePickerModal` directly guides the user to pick a date without frustrating error banners.
