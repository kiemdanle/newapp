---
phase: 2
title: "Form Integrations in QuickEditModal and AddRecordForm"
status: done
priority: P1
effort: "2-3h"
dependencies: [1]
---

# Phase 2: Form Integrations in QuickEditModal and AddRecordForm

## Overview
Replace the legacy 10-button wrap grid in `QuickEditModal.tsx` and the plain text input in `AddRecordForm.tsx` with the new unified `UnitSelector` component. This delivers a consistent, space-efficient 5-button row across all item creation and editing interfaces, allowing American imports and metric units to be seamlessly selected without keyboard friction.

## Requirements

### Functional
- **QuickEditModal Integration (`QuickEditModal.tsx`)**:
  - Replace the 2-row, 10-button unit wrap block with `<UnitSelector value={unit} onChange={setUnit} />`.
  <!-- Updated: Red Team Review - Case normalization & nested modal isolation -->
  - Maintains existing initial unit hydration from `record.unit || 'pcs'`, normalized case-insensitively.
  - If the record currently has an uncommon or American unit (e.g. `oz` or `lb`), `UnitSelector` automatically displays that unit on the 5th pill in active state.
  - Keeps standard stepper controls `[-]  quantity  [+]` and date picker untouched.
- **AddRecordForm Integration (`AddRecordForm.tsx`)**:
  - Replace the single freeform `TextInput` with `<UnitSelector value={unit} onChange={setUnit} />`.
  - Defaults to `'pcs'` or the detected unit from catalog product data.
  - Provides instant 1-tap selection for top units and 2-tap selection for American imports.
- **Backend & Database Contract Validation**:
  <!-- Updated: Red Team Review - VARCHAR(16) & downstream giveaways buffer clearance -->
  - Confirmed that `@expyrico/shared` (`recordCreateBaseSchema`, `recordPatchSchema`), `api` Postgres database (`records.unit VARCHAR(16)`), WatermelonDB `RecordModel`, and downstream consumer flows (`giveaways.unit VARCHAR(16)`) fully support multi-word American units like `fl oz` (5 characters) without clipping or database truncation.

### Non-Functional
- **Visual Polish & Ergonomics**:
  - Cuts the vertical height of the unit section in `QuickEditModal` by ~40%, preventing the Save/Cancel buttons from being shoved down on small mobile screens.
  - Matches the Expyrico color palette (`#4BAE8A` Fresh Sage, `#FAFAF8` Warm White, `#F0F0ED` Stone).

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│             Pantry Record Flow (Edit / Create)         │
│                                                        │
│  [QuickEditModal] (Pantry edit)                        │
│         │                                              │
│         ├── Uses <UnitSelector value={unit} ... />     │
│         │      └── [pcs] [pack] [can] [bottle] [More▾] │
│         │                                              │
│  [AddRecordForm] (Pantry create / scan)                │
│         │                                              │
│         └── Uses <UnitSelector value={unit} ... />     │
│                └── [pcs] [pack] [can] [bottle] [More▾] │
│                                                        │
│  On Save:                                              │
│  patchLocalRecord(id, { unit }) /                      │
│  createLocalRecord({ ..., unit })                      │
│         │                                              │
│         ▼                                              │
│  WatermelonDB ('records' table, 'unit' column)         │
│         │                                              │
│         ▼                                              │
│  Sync via POST /v1/records or PATCH /v1/records/:id    │
│  Postgres DB: records.unit VARCHAR(16)                 │
└────────────────────────────────────────────────────────┘
```

## Related Code Files

### Modify
- `apps/mobile/src/features/records/QuickEditModal.tsx` — Integrate `UnitSelector` and remove obsolete `COMMON_UNITS` 10-button grid.
- `apps/mobile/src/features/records/AddRecordForm.tsx` — Replace plain text input with `UnitSelector`.
- `apps/mobile/src/features/records/QuickEditModal.test.tsx` — Update tests to assert 5-button layout and modal selection.
- `apps/mobile/tests/unit/record-scope-reassign.test.tsx` — Verify `AddRecordForm` unit tests still pass.

## Implementation Steps

1. **Update QuickEditModal (`QuickEditModal.tsx`)**:
   - Import `UnitSelector` from `../../components/UnitSelector`.
   - Remove local `COMMON_UNITS` array.
   - Replace the `COMMON_UNITS.map(...)` block with:
     ```tsx
     <UnitSelector
       value={unit}
       onChange={setUnit}
       testID="quick-edit-unit-selector"
     />
     ```

2. **Update AddRecordForm (`AddRecordForm.tsx`)**:
   - Import `UnitSelector` from `../../components/UnitSelector`.
   - Replace the `TextInput` for unit with `UnitSelector`.
   - Ensure the layout sits harmoniously alongside the Quantity stepper.

3. **Update & Expand Unit Tests (`QuickEditModal.test.tsx`)**:
   - Update tests that previously looked for 10 individual unit buttons.
   - Add test case verifying top 4 units are rendered as direct pills.
   - Add test case verifying American unit (e.g. `oz`) selected via "More" updates the modal state and saves correctly.

## Success Criteria
- [x] `QuickEditModal` displays clean 5-pill row instead of 10 wrapping buttons.
- [x] `AddRecordForm` features the same 5-pill `UnitSelector` for new items.
- [x] Existing records with American or custom units (e.g. `oz`, `lb`, `fl oz`) display their unit in the 5th pill on edit.
- [x] All unit tests in `QuickEditModal.test.tsx` and related suites pass with 0 regressions.

## Risk Assessment
- **Risk**: Existing unit tests in `QuickEditModal.test.tsx` looking for specific testIDs from the old 10-button layout.
- **Observable Signal**: Jest test failure in `QuickEditModal.test.tsx`.
- **Mitigation**: Update test assertions to target `testID="unit-pill-{unit}"` and the "More" picker sheet.
