---
phase: 4
title: "Pantry Cards, Search & Callers"
status: pending
priority: P1
effort: "45m"
dependencies: ["3"]
---

# Phase 4: Pantry Cards, Search & Callers

## Overview
Connect the edited `brand` attribute into all consuming caller components (`RecordList`, `RecordDetail`), update pantry display components to prioritize `record.brand || product?.brand`, and integrate `record.brand` into the pantry search matching engine.

## Requirements
- Functional:
  - In `RecordList.tsx:handleSaveEdit`: forward `patch.brand` to `patchLocalRecord` for in-place edits and `createLocalRecord` for duplicated records.
  - In `record/[id].tsx:handleSaveQuickEdit`: forward `patch.brand` to `patchLocalRecord`.
  - In `RecordCard.tsx`, `PantryGridCard.tsx`, `UseNextHero.tsx`, `PantrySelectModal.tsx`, and `record/[id].tsx`: resolve brand as `record.brand || product?.brand`.
  - In `filterAndSortRecords.ts:matchesPantryQuery`: match `record.brand` (user-edited brand), falling back to catalog product brand lookup if unset.
  <!-- Updated: Validation Session 1 - Match record.brand || product.brand in search filter -->
- Non-functional:
  - Clean fallbacks: if `record.brand` is null, catalog `product.brand` displays seamlessly. If both are null, the layout maintains its standard spacing without crashing.
  - Zero performance regression in search: search filter remains instantaneous on 1000+ records.

## Data Precedence Across UI Components
```
┌────────────────────────────────────────────────────────┐
│ UI Component (Card / Grid / Detail / Hero)             │
│                                                        │
│                    record.brand                        │
│                         │                              │
│                (Has custom brand?)                     │
│                    /          \                        │
│                  YES           NO                      │
│                  /              \                      │
│         Render record.brand    product?.brand          │
│                                 /          \           │
│                               YES           NO         │
│                               /              \         │
│                     Render product.brand    (Spacer)   │
└────────────────────────────────────────────────────────┘
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/app/(app)/record/[id].tsx`
- Modify: `apps/mobile/src/features/records/RecordCard.tsx`
- Modify: `apps/mobile/src/features/records/PantryGridCard.tsx`
- Modify: `apps/mobile/src/features/records/UseNextHero.tsx`
- Modify: `apps/mobile/src/features/giveaways/PantrySelectModal.tsx`
- Modify: `apps/mobile/src/features/records/filterAndSortRecords.ts`
- Modify: `apps/mobile/src/features/records/filterAndSortRecords.test.ts`

## Implementation Steps
1. **RecordList Wiring**:
   - In `apps/mobile/src/features/records/RecordList.tsx:handleSaveEdit`:
     - In duplicate draft branch:
       `brand: patch.brand !== undefined ? patch.brand : editingRecord.brand,`
     - In patch branch:
       `await patchLocalRecord(editingRecord.id, patch);`
2. **RecordDetail Wiring**:
   - In `apps/mobile/app/(app)/record/[id].tsx`:
     - In `handleSaveQuickEdit`: pass `patch` directly to `patchLocalRecord(record.id, patch)`.
     - In detail header resolution:
       `const brand = record.brand || product?.brand;`
3. **Card & Hero Component Updates**:
   - In `apps/mobile/src/features/records/RecordCard.tsx:55`:
     `const brand = record.brand || product?.brand;`
   - In `apps/mobile/src/features/records/PantryGridCard.tsx:60`:
     `const brand = record.brand || product?.brand;`
   - In `apps/mobile/src/features/records/UseNextHero.tsx:40`:
     `const brand = item.brand || product?.brand;`
   - In `apps/mobile/src/features/giveaways/PantrySelectModal.tsx:43`:
     `const brand = record.brand || product?.brand;`
4. **Search Filter Engine Integration**:
   - In `apps/mobile/src/features/records/filterAndSortRecords.ts:matchesPantryQuery`:
     Add search match for `record.brand` with fallback to catalog brand:
     ```typescript
     if (record.brand && record.brand.toLowerCase().includes(q)) {
       return true;
     }
     if (record.productId && productBrandLookup) {
       const brand = productBrandLookup[record.productId];
       if (brand && brand.toLowerCase().includes(q)) {
         return true;
       }
     }
     ```
   - In `apps/mobile/src/features/records/filterAndSortRecords.test.ts`:
     Add test: "matches record when query matches record.brand or fallback product brand".

## Success Criteria
- [ ] Saving an edited brand in `QuickEditModal` immediately updates `RecordCard` and `PantryGridCard` on screen.
- [ ] Duplicating an item with an edited brand preserves the brand on the duplicated item.
- [ ] Item detail screen (`record/[id].tsx`) displays the updated brand.
- [ ] Searching by the edited brand in `PantrySearchBar` filters and shows the item.
- [ ] All tests in `filterAndSortRecords.test.ts` pass.

## Risk Assessment
- **Risk**: Stale product brand showing if component does not re-render when local record updates.
  - **Mitigation**: WatermelonDB observable hooks (`useRecord`, `useActiveRecords`) trigger automatic re-render on record field changes.
  - **Observable Signal**: Brand updates only after a pull-to-refresh or app restart.
  - **Response**: Confirm `record.brand` is read directly from reactive `record` prop.
