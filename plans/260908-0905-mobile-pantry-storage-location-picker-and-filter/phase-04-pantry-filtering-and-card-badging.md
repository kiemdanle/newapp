---
phase: 4
title: "Pantry Search, Filter, and Card Badging Integration"
status: pending
priority: P1
effort: "3h"
dependencies: ["phase-01-schema-and-database-migrations", "phase-03-form-integrations-quick-edit-and-add"]
---

# Phase 4: Pantry Search, Filter, and Card Badging Integration

## Overview
Empower users to filter their pantry inventory by storage location within `PantryFilterModal`, surface active location chips in `PantryActiveFilterChips`, match locations in pantry text search queries (`filterAndSortRecords`), and render a clean location badge on `RecordCard`.
<!-- Updated: Red Team Review - RecordList gatekeepers, PantryGridCard badge, real test paths -->
<!-- Updated: Validation Session 1 - Multi-select location filters -->

## Requirements
- Functional:
  - Text search: searching for "fridge", "freezer", "spice rack", etc., in `PantrySearchBar` matches records stored in that location.
  - Filter state: `PantryFilterState` supports optional multi-select `locations?: string[]`.
  - Filter modal: `PantryFilterModal` features a dedicated "STORAGE LOCATION" section showing available locations with dynamic item counts (e.g. `Fridge (6)`, `Freezer (2)`). Tapping toggles multi-select inclusion.
  - Active filter chips: when filtered by locations, `PantryActiveFilterChips` displays a chip for each selected location (e.g. `Location: Fridge ✕`) with one-tap removal.
  - Card visual badge: `RecordCard` displays the item's location (e.g., `Fridge`) in the metadata row next to the expiry date or household badge.
- Non-functional:
  - Instant in-memory filtering performance over 500+ records.
  - Consistent typography, chip borders, and count badge styles matching existing category filter chips.

## Architecture
```
┌────────────────────────────────────────────────────────┐
│                  PantryFilterModal                     │
│                                                        │
│  STORAGE LOCATION                          [Clear]     │
│  [Fridge (6)]  [Freezer (2)]  [Pantry (12)]            │
│  [Counter (3)] [Spice Rack (1)]                        │
└───────────────────────────┬────────────────────────────┘
                            │ Apply Filter
                            ▼
┌────────────────────────────────────────────────────────┐
│                     RecordList                         │
│                                                        │
│  [🔍 Search pantry...                        ]         │
│  Active Filters: [Location: Fridge ✕] [Expiring Soon]  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🥛 Whole Organic Milk               1 bottle     │  │
│  │ [📍 Fridge]  Expires In 3 days                   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```
## Related Code Files
- Modify: `apps/mobile/src/features/records/pantryFilterTypes.ts`
- Modify: `apps/mobile/src/features/records/filterAndSortRecords.ts`
- Modify: `apps/mobile/src/features/records/PantryFilterModal.tsx`
- Modify: `apps/mobile/src/features/records/PantryActiveFilterChips.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/src/features/records/RecordCard.tsx`
- Modify: `apps/mobile/src/features/records/PantryGridCard.tsx`
- Modify: `apps/mobile/src/features/records/filterAndSortRecords.test.ts`
- Modify: `apps/mobile/tests/unit/pantry-filter-modal.test.tsx`

## Implementation Steps
1. **Filter Types Update (`apps/mobile/src/features/records/pantryFilterTypes.ts`)**:
   - Add `locations?: string[];` to `interface PantryFilterState` (multi-select support).

2. **Filter & Search Engine (`apps/mobile/src/features/records/filterAndSortRecords.ts`)**:
   - In `matchesPantryQuery`:
     ```typescript
     if (record.location && record.location.toLowerCase().includes(q)) {
       return true;
     }
     ```
   - In `filterAndSortRecords`:
     ```typescript
     if (filters.locations && filters.locations.length > 0) {
       const targetSet = new Set(filters.locations.map((l) => l.trim().toLowerCase()));
       if (!record.location || !targetSet.has(record.location.trim().toLowerCase())) {
         return false;
       }
     }
     ```

3. **PantryFilterModal Location Section (`apps/mobile/src/features/records/PantryFilterModal.tsx`)**:
   - Compute `locationOptions` with `useMemo`:
     - Aggregate counts for all records with a non-empty `location`, grouping case-insensitively and normalizing display labels to Title Case via `normalizeLocationTitleCase` (e.g. `spice rack` → `Spice Rack`).
     - Merge with `DEFAULT_TOP_LOCATIONS` (`Fridge`, `Freezer`, `Pantry`, `Counter`).
     - Return array `{ name: string, count: number }` sorted with top 4 first, then custom alphabetically.
   - Render "STORAGE LOCATION" section with chips:
     - Selected chip: `backgroundColor: theme.colors.primaryLight`, `borderColor: theme.colors.primary`, `color: theme.colors.primaryDark`.
     - Count badge displaying `opt.count`.
    - Tapping a chip toggles inclusion in `draftFilters.locations` (adds if absent, removes if present).
    - "Clear" button in section header when `draftFilters.locations` has items (resets to empty array).
  - Update `handleReset`: reset `locations: undefined`.

4. **Active Filter Chips & Per-Value Removal Wiring (`PantryActiveFilterChips.tsx`, `RecordList.tsx`)**:
   - In `PantryActiveFilterChips.tsx`:
     - Extend `onRemoveFilter` prop signature to support optional value:
       `onRemoveFilter: (key: keyof PantryFilterState, value?: string) => void;`
     - For each `loc` in `filters.locations`:
       ```typescript
       chips.push({
         id: `location-${loc}`,
         label: `Location: ${loc}`,
         color: theme.colors.primaryDark,
         bg: theme.colors.primaryLight,
         onRemove: () => onRemoveFilter('locations', loc),
       });
       ```
   - In `RecordList.tsx`:
     - **Update `isFiltered` (lines 212-221)**: Add `|| Boolean(filters.locations && filters.locations.length > 0)`. Without this, chips never mount, the filter button badge stays 0, filter-empty state never appears, and Select All uses unfiltered records.
     - **Update `activeFilterCount` (lines 222-231)**: Add `+ (filters.locations?.length ?? 0)`.
     - **Update `resetKey` (lines 252-261)**: Append `filters.locations?.join(',')` so pagination resets when location filters change.
     - **Update `onRemoveFilter` (line ~632)**: Handle per-value removal:
       ```tsx
       onRemoveFilter={(key, value) =>
         setFilters((prev) => {
           if (key === 'locations' && value) {
             const remaining = prev.locations?.filter((l) => l !== value);
             return {
               ...prev,
               locations: remaining && remaining.length > 0 ? remaining : undefined,
             };
           }
           return { ...prev, [key]: undefined };
         })
       }
       ```
5. **RecordCard Badging (`apps/mobile/src/features/records/RecordCard.tsx`)**:
   - If `record.location`:
     - Render a compact pill badge in the secondary metadata row:
       ```tsx
       <View
         testID={`record-location-badge-${record.id}`}
         style={{
           flexDirection: 'row',
           alignItems: 'center',
           gap: 3,
           backgroundColor: theme.colors.bgGlass,
           borderColor: theme.colors.border,
           borderWidth: 1,
           paddingHorizontal: 7,
           paddingVertical: 2,
           borderRadius: theme.radii.pill,
         }}
       >
         <Ionicons
           name={getLocationIcon(record.location)}
           size={11}
           color={theme.colors.textMuted}
         />
         <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
           {record.location}
         </Text>
       </View>
     - In `apps/mobile/src/features/records/PantryGridCard.tsx`:
       - Render the same compact location badge in the grid card footer metadata row (lines 316-343) alongside household/personal badges so grid view users see location at a glance.

6. **Unit Tests (`filterAndSortRecords.test.ts`, `pantry-filter-modal.test.tsx`)**:
   - Update `apps/mobile/src/features/records/filterAndSortRecords.test.ts`:
     - Text query matching against `location`.
     - Filtering records specifically by `locations` array.
     - Case-insensitive location filter matching.
   - Update `apps/mobile/tests/unit/pantry-filter-modal.test.tsx`:
     - Verify rendering of "STORAGE LOCATION" section, multi-selecting location chips, and clearing.

## Success Criteria
- [ ] Searching "fridge" returns records whose `location` is "Fridge".
- [ ] Selecting "Freezer" in `PantryFilterModal` filters records strictly to freezer items.
- [ ] Active filter chips display `Location: Freezer` with working removal button.
- [ ] `RecordCard` renders the storage location badge clearly.
- [ ] All unit tests pass.

## Risk Assessment
- *Risk*: A user with 0 records assigned to a location sees all counts at `(0)`.
- *Observable Signal*: Cluttered modal with 0-count chips.
- *Pre-decided Response*: If total records with location is 0, show the 4 fixed defaults (`Fridge`, `Freezer`, `Pantry`, `Counter`) without count badges, or with count 0 subtle styling, enabling immediate forward-looking assignment.
