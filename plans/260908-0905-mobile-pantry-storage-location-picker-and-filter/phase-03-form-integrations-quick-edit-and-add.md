---
phase: 3
title: "Form Integrations in QuickEditModal and AddRecordForm"
status: pending
priority: P1
effort: "2-3h"
dependencies: ["phase-01-schema-and-database-migrations", "phase-02-location-selector-components"]
---

# Phase 3: Form Integrations in QuickEditModal and AddRecordForm

## Overview
Integrate the `LocationSelector` component into pantry item editing (`QuickEditModal`) and new item creation (`AddRecordForm`), positioned directly under **Unit** and above **Expiry Date**, ensuring the field is optional and saves smoothly with or without a value.
<!-- Updated: Red Team Review - Caller threading, hydration guard, real test paths -->

## Requirements
- Functional:
  - In `QuickEditModal`:
    - Place `LocationSelector` directly under `UnitSelector` and above `Expiry Date`.
    - Initialize state from `record.location ?? null`.
    - Saving with location updates local database record.
    - Saving without location (or cleared location) updates `location` to `null`.
  - In `AddRecordForm`:
    - Note field order discrepancy: in `AddRecordForm`, Expiry Date sits at ~line 300, above Quantity (~line 395) and Unit (~line 405).
    - Insert `LocationSelector` directly after `UnitSelector` (~line 410) and immediately before `Category (optional)` (~line 412). Only `QuickEditModal` sandwiches Location between Unit and Expiry.
    - Initialize state to `null`.
    - Submitting passes `location: location?.trim() || null` to `createLocalRecord`.
    - Resetting the form clears location to `null`.
- Non-functional:
  - Seamless vertical layout flow without pushing modal action buttons offscreen.
  - Zero disruption to existing steppers, category chips, or date picker controls.

## Architecture
```
┌────────────────────────────────────────────────────────┐
│                   QuickEditModal                       │
│                                                        │
│  Item Name Input                                       │
│  Quantity Stepper                                      │
│                                                        │
│  Unit                                                  │
│  [ pcs ] [ pack ] [ can ] [ bottle ] [ More ▾ ]        │
│                                                        │
│  Location (optional)                                   │
│  [ Fridge ] [ Freezer ] [ Pantry ] [ Counter ] [More ▾]│
│                                                        │
│  Expiry Date                                           │
│  [ 📅 2026-09-15                                    ▾] │
│                                                        │
│  Category                                              │
│  Notes                                                 │
│  [Cancel]                                 [Save Changes]│
└────────────────────────────────────────────────────────┘
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/QuickEditModal.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/app/(app)/record/[id].tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/features/records/QuickEditModal.test.tsx`
- Modify: `apps/mobile/src/tests/AddRecordForm.test.tsx`

## Implementation Steps
1. **QuickEditModal Integration (`apps/mobile/src/features/records/QuickEditModal.tsx`)**:
   - Import `LocationSelector` from `@/components/LocationSelector`.
   - Add state: `const [location, setLocation] = useState<string | null>(record.location ?? null);`.
   - **Hydration Guard**: Initialize `setLocation(record.location ?? null)` strictly inside the `if (lastRecordIdRef.current !== record.id)` block so that subsequent product hydration (`useProduct`) effects do not wipe user's in-progress pill selections.
   - Insert `<LocationSelector>` component:
     ```tsx
     {/* Unit Selector */}
     <UnitSelector
       value={unit}
       onChange={setUnit}
       label="Unit"
       testID="quick-edit-unit-selector"
     />

     {/* Storage Location Selector */}
     <LocationSelector
       value={location}
       onChange={setLocation}
       label="Location (optional)"
       testID="quick-edit-location-selector"
     />

     {/* Expiry Date */}
     <View style={{ gap: 6 }}>
     ...
     ```
   - In `QuickEditModal.tsx:onSave` interface & `handleSave`:
     - Extend `onSave` patch payload type to include `location?: string | null`.
     - Call `onSave({ ..., location: location?.trim() || null })`.
   - **Caller Threading to SQLite**:
     - In `RecordList.tsx` (`handleSaveEdit`): update the patch type to include `location?: string | null;`. When handling a duplicated draft (`draft-duplicate-*`), pass `location: patch.location ?? editingRecord.location` to `createLocalRecord`. For regular edits, forward `location: patch.location` to `patchLocalRecord`.
     - In `apps/mobile/app/(app)/record/[id].tsx` (`handleSaveQuickEdit`): update the patch type and forward `location: patch.location` to `patchLocalRecord`.
2. **AddRecordForm Integration (`apps/mobile/src/features/records/AddRecordForm.tsx`)**:
   - Import `LocationSelector` from `@/components/LocationSelector`.
   - Add state: `const [location, setLocation] = useState<string | null>(null);`.
   - Note exact layout order in `AddRecordForm`:
     1. Expiry Date input & quick buttons (~line 300)
     2. Quantity stepper & input (~line 395)
     3. `UnitSelector` (~line 405)
     4. Insert `<LocationSelector>` directly below UnitSelector (~line 411):
        ```tsx
        <LocationSelector
          value={location}
          onChange={setLocation}
          label="Location (optional)"
          testID="add-record-location-selector"
        />
        ```
     5. Category input & standard category chips (~line 413)
   - In `handleSubmit`:
     - Include `location: location?.trim() || null` in the `createLocalRecord` arguments.
   - In form reset logic, reset `setLocation(null)`.

3. **Form Tests Updating (`QuickEditModal.test.tsx`, `AddRecordForm.test.tsx`)**:
   - In `apps/mobile/src/features/records/QuickEditModal.test.tsx`:
     - Update existing `onSave` assertions (lines 86-93) to expect `location: null` in the payload.
     - Add test case: renders `LocationSelector` with initial `record.location`.
     - Add test case: clicking a location pill (e.g. `Fridge`) and saving passes `location: 'Fridge'` to `onSave`.
     - Add test case: clearing location and saving passes `location: null`.
   - In `apps/mobile/src/tests/AddRecordForm.test.tsx`:
     - Add test verifying that selecting a location passes `location: 'Fridge'` to `createLocalRecord`.
## Success Criteria
- [ ] `LocationSelector` appears between Unit and Expiry Date in `QuickEditModal`.
- [ ] Selecting a location in `QuickEditModal` saves to the database.
- [ ] Leaving location empty or deselecting it saves `location: null`.
- [ ] `AddRecordForm` creates new items with the chosen location or `null`.
- [ ] All form unit and integration tests pass.

## Risk Assessment
- *Risk*: Modal content height exceeds viewport on smaller screens causing bottom "Save Changes" button to be occluded by the keyboard or viewport edge.
- *Observable Signal*: User cannot see the "Save Changes" button without scrolling.
- *Pre-decided Response*: `QuickEditModal` already wraps contents in a flexible `ScrollView` with `keyboardShouldPersistTaps="handled"` and `paddingBottom: insets.bottom + 24`. Ensure the compact 38px 1-row pill layout preserves vertical headroom.
