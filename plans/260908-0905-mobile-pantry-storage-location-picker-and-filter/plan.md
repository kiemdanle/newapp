---
title: "Mobile Pantry Storage Location Selector and Filtering"
description: "Comprehensive implementation plan to add an optional 'Location' field to pantry Quick Edit and Add Item forms using a 5-pill selector (Fridge, Freezer, Pantry, Counter, More ▾), with full WatermelonDB migration, database sync, and pantry location filtering."
status: pending
priority: P1
effort: "1-2d"
tags: ["mobile", "pantry", "ui", "quick-edit", "location", "filtering", "watermelondb", "design-system"]
created: 2026-09-08
---

# Mobile Pantry Storage Location Selector and Filtering

## Overview

Add an optional **"Location"** field to pantry item editing (`QuickEditModal`) and item creation (`AddRecordForm`), adopting the exact ergonomic 5-pill picker pattern established by `UnitSelector`:
1. **4 Fixed Quick Pills**: `Fridge`, `Freezer`, `Pantry`, `Counter` directly selectable in one tap.
2. **Adaptive 5th Slot ("More ▾")**: Custom and less common storage locations (e.g., `Spice Rack`, `Cupboard`, `Basement`, `Wine Cooler`) accessible via a clean bottom sheet modal with search and freeform text input. When an alternate location is selected, it occupies the 5th pill in the active state (`[ Spice Rack ▾ ]`).
3. **Optional Selection & Tap-to-Deselect**: Since location is strictly optional, tapping an active pill deselects it (reverts to unassigned).
4. **Placement Hierarchy**: Positioned directly under **Unit** and immediately above **Expiry Date**, matching the visual style, typography, and spacing of existing pill groups.
5. **Pantry Location Filtering**: Users can filter their pantry inventory by location in `PantryFilterModal` with item count badges, quick active filter chips in `PantryActiveFilterChips`, and search matching in `filterAndSortRecords`.

---

## Architecture & Component Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                      QuickEditModal / AddRecordForm                    │
│                                                                        │
│  Unit                                                                  │
│  [ pcs ]    [ pack ]    [ can ]    [ bottle ]    [ More ▾ ]            │
│                                                                        │
│  Location (optional)                                                   │
│  [ Fridge ]  [ Freezer ]  [ Pantry ]  [ Counter ]  [ More ▾ / Custom ▾]│
│     (1)         (2)          (3)         (4)             (5)           │
│                                                           │            │
│  Expiry Date                                              │ Tap (5)    │
│  [ 📅 Select expiry date                               ▾] │            │
└───────────────────────────────────────────────────────────┼────────────┘
                                                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        LocationPickerModal Sheet                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search or enter custom location (e.g. Spice Rack)...    [Apply]│  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  COMMON LOCATIONS                                                      │
│  [Spice Rack] [Cupboard] [Cabinet] [Basement] [Cellar] [Wine Cooler]   │
│  [Drawer] [Office] [Garage] [Bar]                                      │
│                                                                        │
│  [✕ Clear Location]                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Goals & Acceptance Criteria

| # | Goal | Acceptance Criteria | Priority |
|---|------|---------------------|----------|
| 1 | **Ergonomic 5-Pill LocationSelector** | Reusable component with 4 fixed pills (`Fridge`, `Freezer`, `Pantry`, `Counter`) + adaptive 5th slot (`More ▾` / `${location} ▾`). Tap-to-deselect supported. 44x44pt touch targets. | P1 |
| 2 | **LocationPickerModal Sheet** | Bottom sheet modal with search/custom text input, "Apply" button, common location preset chips, and "Clear Location" action. | P1 |
| 3 | **QuickEditModal Placement & Integration** | Placed directly under Unit and above Expiry Date. Field is optional; saves seamlessly when selected or empty (`null`). | P1 |
| 4 | **AddRecordForm Integration** | Integrated into new item creation form matching the Quick Edit visual sequence. Optional; defaults to null. | P1 |
| 5 | **Database & Offline Migration** | WatermelonDB schema bump (v4 → v5) with SQLite column `location` (string, optional) and Postgres migration `20260908093000_add_record_location` + Prisma client generate. Model `@field('location')` and `LocalRecord` interface updated. Shared schemas updated with validation. | P1 |
| 6 | **Pantry Location Filtering & Chips** | Multi-select `PantryFilterState.locations?: string[]` integrated into `filterAndSortRecords`. "STORAGE LOCATION" section in `PantryFilterModal` with counts. Per-location dismissible chips in `PantryActiveFilterChips` with wired array removal. | P1 |
| 7 | **Card Location Indicator** | Display subtle location badge on `RecordCard` metadata row so users immediately recognize storage location at a glance. | P2 |
| 8 | **Automated Testing & Device Verification** | Unit tests for selector, modal, filters, forms. Typecheck passes. Gradle debug APK builds successfully and verified on attached physical device via ADB. | P1 |

---

## Phases Roadmap

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | **Database Schema, Shared Types, and WatermelonDB Migration** | [phase-01-schema-and-database-migrations.md](./phase-01-schema-and-database-migrations.md) | pending | P1 | 3-4h |
| 2 | **Reusable LocationSelector and LocationPickerModal Components** | [phase-02-location-selector-components.md](./phase-02-location-selector-components.md) | pending | P1 | 3-4h |
| 3 | **Form Integrations in QuickEditModal and AddRecordForm** | [phase-03-form-integrations-quick-edit-and-add.md](./phase-03-form-integrations-quick-edit-and-add.md) | pending | P1 | 2-3h |
| 4 | **Pantry Search, Filter, and Card Badging Integration** | [phase-04-pantry-filtering-and-card-badging.md](./phase-04-pantry-filtering-and-card-badging.md) | pending | P1 | 3h |
| 5 | **Automated Testing, Gradle Build, and Live Device Verification** | [phase-05-testing-build-and-device-verification.md](./phase-05-testing-build-and-device-verification.md) | pending | P1 | 2-3h |

---

## Key Technical Decisions & Invariants

1. **Strictly Optional Storage Field**: Location is never required to save an item. If not provided or cleared, it safely defaults to `null` on both local SQLite and backend Prisma.
2. **Tap-to-Deselect Behavior**: Unlike `UnitSelector` (where an item must always have a unit like `pcs`), `Location` is optional. Tapping an already-active location pill unselects it, returning the value to `null`.
3. **Pill Group Visual Continuity**: Matches `UnitSelector` with `height: 38`, `minWidth: 44`, `borderRadius: theme.radii.pill`, Fresh Sage `#4BAE8A` for active state, and `#FFFFFF` active text.
4. **WatermelonDB v4 → v5 & Postgres Schema Migration**: Using `@nozbe/watermelondb/Schema/migrations` `add_columns` ensures existing mobile pantries upgrade seamlessly without SQLite table drops. In Postgres, `api/prisma/migrations/20260908093000_add_record_location/migration.sql` adds nullable `location` column, followed by `prisma generate` to update `@prisma/client`.
5. **Full Live Sync Path Wiring**: In addition to Prisma schema and `recordSchema`, `location` is integrated end-to-end: `recordCreateSchema` & `recordPatchSchema` allow it, `create.ts`/`patch.ts` write it, `duplicate.ts` preserves it, `sync.ts` writes it on push, and all pull branches (conflict, household, personal create, personal update) populate `r.location = ch.location ?? null`.
6. **Per-Value Filter Removal Wiring**: `PantryActiveFilterChipsProps.onRemoveFilter` is typed `(key: keyof PantryFilterState, value?: string) => void`. `RecordList.tsx:632` filters out `value` from `prev.locations` instead of wiping the entire array.

---

## Success Criteria

- [ ] `LocationSelector` renders 4 fixed pills (`Fridge`, `Freezer`, `Pantry`, `Counter`) + `More ▾`.
- [ ] Tapping active pill deselects it (`null`).
- [ ] Tapping `More ▾` opens `LocationPickerModal` with custom input and presets; selecting a custom location displays it in the 5th pill.
- [ ] In `QuickEditModal`, Location sits directly under Unit and above Expiry Date.
- [ ] Saving in `QuickEditModal` persists the chosen location or `null` without validation errors.
- [ ] `AddRecordForm` supports selecting and saving item location.
- [ ] `PantryFilterModal` includes "STORAGE LOCATION" section with item counts and multi-select support.
- [ ] Selecting one or multiple locations filters the pantry list accurately and renders per-location dismissible chips in `PantryActiveFilterChips`.
- [ ] Postgres migration `20260908093000_add_record_location` created and Prisma client generated.
- [ ] WatermelonDB migration v4 → v5 runs without errors.
- [ ] Full test suite passes; APK builds and installs cleanly on physical device via ADB.

---

## Validation Log

### Verification Results (Full Tier)
- **Claims Checked**: 15 across mobile DB, shared schemas, and UI components
- **Verified**: 15 | **Failed**: 0 | **Unverified**: 0
- **Key Fact Checks**:
  - `packages/shared/src/schemas/record.ts`: confirmed `recordSchema`, `recordCreateBaseSchema`, `recordPatchSchema` are the authoritative data contracts.
  - `apps/mobile/src/db/schema.ts` & `migrations.ts`: confirmed current schema version is 4, next bump is version 5 via `add_columns`.
  - `apps/mobile/src/features/records/QuickEditModal.tsx`: confirmed `UnitSelector` is at line 281, `Expiry Date` is at line 289.
  - `apps/mobile/src/features/records/filterAndSortRecords.ts`: confirmed filtering engine structure and `matchesPantryQuery`.

### Validation Interview Decisions (Session 1)
1. **Tap-to-Deselect Behavior (`tap_to_deselect`)**:
   - *Decision*: **Toggle Off on Tap (Deselect)**.
   - *Rationale*: Tapping an already active location pill toggles it off, setting `location` to `null`. This provides a fast, one-tap unassign affordance without requiring modal entry.
2. **Card Visual Badge (`card_badge_display`)**:
   - *Decision*: **Show Location Badge on Cards**.
   - *Rationale*: Display a subtle compact pill (e.g. `[📍 Fridge]`) in the secondary metadata row of `RecordCard` next to the expiry date. Users immediately see storage context in the pantry list at a glance.
3. **Pantry Location Filter Mode (`location_filter_mode`)**:
   - *Decision*: **Multi-Select Locations**.
   - *Rationale*: `PantryFilterState` will support `locations?: string[]`. In `PantryFilterModal`, users can toggle multiple storage locations (e.g. `Fridge` + `Freezer`), enabling flexible multi-zone inventory sweeps.

### Validation Interview Decisions (Session 2)
4. **Offline Sync Conflict Policy (`sync_conflict_policy`)**:
   - *Decision*: **Standard Scope-Aware LWW**.
   - *Rationale*: For personal records, client mutations win if `updatedAt` is newer than server; for shared household records, the server remains authoritative, avoiding fragmented household states.
5. **Location Casing Normalization (`casing_normalization`)**:
   - *Decision*: **Title Case & Grouped**.
   - *Rationale*: Custom locations are normalized to Title Case (e.g. `spice rack` → `Spice Rack`) and grouped case-insensitively in `PantryFilterModal` with aggregate counts.
6. **Card Badge Iconography (`badge_iconography`)**:
   - *Decision*: **Dynamic Contextual Icons**.
   - *Rationale*: Display contextual icons on `RecordCard` badges: `snow-outline` for Freezer, `thermometer-outline` for Fridge, `basket-outline` for Pantry, `tablet-landscape-outline` for Counter, and `cube-outline` for custom locations.
7. **Search Matching Scope (`search_matching_scope`)**:
   - *Decision*: **Include Location in Search**.
   - *Rationale*: `matchesPantryQuery` tests `record.location` case-insensitively so typing "fridge" or "pantry" immediately surfaces all items stored there.

### Whole-Plan Consistency Sweep
- **Status**: Zero unresolved contradictions.
- **Propagations**:
  - Updated Phase 1 (`phase-01-schema-and-database-migrations.md`) to reflect standard scope-aware LWW for location fields in sync upserts.
  - Updated Phase 2 (`phase-02-location-selector-components.md`) to include `normalizeLocationTitleCase` helper in `apps/mobile/src/utils/locations.ts`.
  - Updated Phase 4 (`phase-04-pantry-filtering-and-card-badging.md`) to define contextual icon mapping (`getLocationIcon`) on `RecordCard` and case-insensitive Title Case aggregation in `PantryFilterModal`.

---

## Red Team Review

### Session — 2026-09-08
**Findings:** 8 consolidated finding groups (8 accepted, 0 rejected)
**Severity Breakdown:** 3 Critical, 4 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Fictional `updateLocalRecord`/`duplicateLocalRecord` replaced with real mutators (`patchLocalRecord`, `createLocalRecord`, `markRecordStatusWithQuantity`, `RecordList.handleSaveEdit`, `record/[id].tsx:handleSaveQuickEdit`) | Critical | Accept | Phase 1, Phase 3 |
| 2 | Postgres migration deploy (`npm --prefix api run db:migrate:deploy`) must run before API serves traffic to avoid column missing 500s | Critical | Accept | Phase 1, Phase 5 |
| 3 | `RecordList.tsx` filter gatekeepers (`isFiltered`, `activeFilterCount`, `resetKey`, Select All, empty state) omitted `locations` | Critical | Accept | Phase 4 |
| 4 | Vendored `@expyrico/shared` in `apps/mobile/local-packages` must be rebuilt/copied to avoid stale contract stripping `location` | High | Accept | Phase 1 |
| 5 | Location string length (50-char max clamp) & control character sanitization in schema and `LocationPickerModal` | High | Accept | Phase 1, Phase 2 |
| 6 | `QuickEditModal` hydration guard (`lastRecordIdRef`) to prevent `useProduct` from wiping in-progress location selection | High | Accept | Phase 3 |
| 7 | Target test paths corrected (`src/tests/AddRecordForm.test.tsx`, `tests/unit/pantry-filter-modal.test.tsx`) & relative paths in Jest | High | Accept | Phase 3, Phase 4, Phase 5 |
| 8 | Location badge parity on `PantryGridCard.tsx` for grid view users and explicit `onClose()` on modal select | Medium | Accept | Phase 2, Phase 4 |

### Whole-Plan Consistency Sweep
- **Status**: Zero unresolved contradictions.
- **Verified Invariants Across All Plan Files**:
  1. **Purged Fictional Methods**: All references to `updateLocalRecord` and `duplicateLocalRecord` have been completely removed and replaced with the actual mutator pipeline (`patchLocalRecord`, `createLocalRecord`, `handleSaveEdit`, `markRecordStatusWithQuantity`).
  2. **Migration & Build Deployment**: Phase 1 and Phase 5 explicitly include `prisma migrate deploy` (`npm --prefix api run db:migrate:deploy`) and `@expyrico/shared` vendoring rebuild.
  3. **Filter Gatekeepers**: Phase 4 explicitly wires `filters.locations` into `isFiltered`, `activeFilterCount`, `resetKey`, and per-value `onRemoveFilter` in `RecordList.tsx`.
  4. **Component State Safety**: Phase 2 enforces `maxLength={50}` and `onClose()` dismiss; Phase 3 guards `setLocation` hydration with `lastRecordIdRef`.
  5. **Card Parity**: Both `RecordCard.tsx` and `PantryGridCard.tsx` render the dynamic location badge with `getLocationIcon`.
  6. **Test File Realignment**: All test commands and file lists point to verified real filesystem locations.
<!-- slug: mobile-pantry-storage-location-picker-and-filter -->
