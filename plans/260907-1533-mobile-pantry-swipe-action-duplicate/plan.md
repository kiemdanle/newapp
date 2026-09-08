---
title: "Mobile Pantry Swipe Action: Duplicate Item Flow (Edit / Duplicate / Delete)"
description: "Replace the +1 quick-increment action with Duplicate in the swipe action row and drawer for both List and Grid views. Duplicate clones item metadata as an in-memory draft, opens QuickEditModal to select expiry date, and persists on Save via createLocalRecord."
status: pending
priority: P1
effort: "4.5h"
tags: ["mobile", "pantry", "ux", "swipe-actions", "duplicate"]
created: 2026-09-07
---

# Mobile Pantry Swipe Action: Duplicate Item Flow (Edit / Duplicate / Delete)

## Overview
Enhance the mobile pantry item list interaction model in both **List View** and **Grid View**:
1. Remove the `+1` quick-increment action from the swipe row/drawer.
2. Introduce a **"Duplicate"** action in the middle between Edit and Delete (`Edit` / `Duplicate` / `Delete`).
3. Tapping **"Duplicate"** clones the item with identical user-facing metadata (`name`, `category`, `photo`, `quantity`, `unit`, `notes`, `store`, `price`, `householdId`, `userId`) as an in-memory draft with blank initial expiry date.
4. Opens the item directly in `QuickEditModal` so the user selects the new expiry date immediately.
5. In `QuickEditModal`, saving is blocked if `expiryDate` is blank (removing any fallback to `record.expiryDate`), automatically triggering `WheelDatePickerModal` to ensure valid input.
6. If the user dismisses/cancels, the draft is discarded from React state with zero database writes or sync traffic.
7. When the user selects a valid date and saves, existing `createLocalRecord` commits the valid record to WatermelonDB, resets lifecycle fields (`purchaseDate = null`, `consumedAt = null`), and queues background sync.

This avoids unnecessary code in `api/records.ts`, eliminates fallback bugs where original dates could be unintentionally restored, and guarantees complete database integrity.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Block saving in `QuickEditModal` on empty expiry date, auto-prompting date selection without stale fallbacks | P1 |
| 2 | Update List View swipe row (`RecordCard.tsx`) to show `Edit / Duplicate / Delete` with brand styling | P1 |
| 3 | Update Grid View action drawer (`PantryGridActionDrawer.tsx`) to show `Edit / Duplicate / Delete` | P1 |
| 4 | Wire `handleDuplicate` and save/cancel in `RecordList.tsx` to open `QuickEditModal` as an in-memory draft and persist via `createLocalRecord` | P1 |
| 5 | Verify via automated unit tests, clean Gradle build, and live ADB testing on Xiaomi MI 9 | P1 |

## User Flow
```
User buys multiple of an item (e.g. Organic Milk with different expiry dates)
                        |
                        v
        User swipes left on existing item
        (Supported in both List View and Grid View)
                        |
                        v
        Swipe menu reveals: [ Edit | Duplicate | Delete ]
                        |
                        v
              User taps "Duplicate"
                        |
                        v
        RecordList constructs in-memory draft (LocalRecord)
        with cloned metadata and expiryDate: ""
        (Zero DB writes at this stage)
                        |
                        v
        System opens QuickEditModal immediately (no toast clutter)
                        |
            +-----------+-----------+
            |                       |
      [User Cancels]          [User Taps Save]
            |                       |
            v                       v
    Discard draft from        Empty expiry? -> Auto-opens WheelDatePickerModal
    React state                     |
    (Zero DB clutter)         Valid expiry? -> createLocalRecord(...)
                                    |
                                    - Resets purchaseDate/consumedAt
                                    - pendingSync = true
                                    - triggerSyncSoon()
                                    v
                              Valid record committed to WatermelonDB!
                              Both items coexist in pantry!
```

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Phase 1: QuickEditModal Expiry Validation & In-Memory Draft Flow](./phase-01-database-and-duplicate-record-api.md) | Pending | 1h |
| 2 | [Phase 2: Swipe Actions UI (Edit / Duplicate / Delete)](./phase-02-swipe-actions-ui-and-quickedit-flow.md) | Pending | 1.5h |
| 3 | [Phase 3: Testing & Device Verification](./phase-03-testing-and-device-verification.md) | Pending | 1.5h |

## Success Criteria
- [ ] Swipe action row in List View displays `Edit`, `Duplicate`, `Delete` in that exact order.
- [ ] Action drawer in Grid View displays `Edit`, `Duplicate`, `Delete` in that exact order.
- [ ] `+1` action button is completely removed from both swipe surfaces.
- [ ] Tapping `Duplicate` clones the item's name, category, photo, quantity, and unit.
- [ ] Initial expiry date on the clone is left blank, prompting the user to select/type the date.
- [ ] Cloned item immediately opens in `QuickEditModal` without toast banner clutter.
- [ ] Canceling/dismissing `QuickEditModal` discards the draft with zero database operations.
- [ ] `QuickEditModal` blocks saving if `expiryDate` is empty and no longer falls back to `record.expiryDate`.
- [ ] Saving `QuickEditModal` requires a valid expiry date and commits `createLocalRecord`.
- [ ] All unit tests pass and Android debug APK installs cleanly on Xiaomi MI 9.

## Validation Log

### Verification Results
- Claims checked: 5
- Verified: 5 | Failed: 0 | Unverified: 0
- Tier: Standard (Fact Checker + Contract Verifier)
- Verified items:
  - `apps/mobile/src/api/records.ts`: `createLocalRecord`, `database.get('records')`, `col.create`, `triggerSyncSoon`, `toLocal` confirmed.
  - `RecordCard.tsx`: `renderRightActions`, `record-add-quantity-${record.id}`, `swipeableRef.current?.close()` confirmed.
  - `PantryGridActionDrawer.tsx`: `actionsColumn`, `record-add-quantity-${record.id}`, `isProcessing` confirmed.
  - `PantryGridCard.tsx`: `PantryGridActionDrawer` wiring confirmed.
  - `RecordList.tsx`: `editingRecord`, `setEditingRecord`, `handleSaveEdit`, `createLocalRecord`, `patchLocalRecord`, `QuickEditModal` confirmed.

### User & Advisor Validation Decisions
1. **Initial Expiry Date**: Leave expiry date blank until selected. The clone starts with an empty expiry date (`""`), prompting the user to pick or naturally type the new expiry date in `QuickEditModal`.
2. **Modal Dismissal / Cancellation**: Discard in-memory draft on cancel. If the user closes `QuickEditModal` without saving, the draft is cleared from state without touching WatermelonDB, preventing invalid schema rows and premature sync calls.
3. **Visual Feedback**: Immediate `QuickEditModal` opening only. Closing the swipe action drawer and launching the edit modal provides clear, frictionless feedback without toast banner clutter.
4. **No Redundant API Helper**: Do not add a redundant `duplicateLocalRecord` helper in `api/records.ts`. The in-memory draft directly invokes the battle-tested `createLocalRecord` on Save, guaranteeing clean lifecycle fields without duplicate logic.
5. **No Date Fallback**: Remove `expiryDate.trim() || record.expiryDate` fallback in `QuickEditModal.handleSave`. Reject empty dates and open `WheelDatePickerModal`, preventing stale original dates from being silently restored.

### Whole-Plan Consistency Sweep
- All phases updated and reconciled:
  - Phase 1: `QuickEditModal` date validation (no fallback, auto-prompt picker) + in-memory draft save via `createLocalRecord`.
  - Phase 2: Swipe actions UI order (`Edit / Duplicate / Delete`) in `RecordCard`, `PantryGridActionDrawer`, and `PantryGridCard`.
  - Phase 3: Tests for date validation without fallback, in-memory draft lifecycle, and UI action order.
- Unresolved contradictions: 0.

<!-- slug: mobile-pantry-swipe-action-duplicate -->
