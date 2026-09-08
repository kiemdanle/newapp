---
title: Mobile Pantry Storage Location Selector and Filtering
date: 2026-09-08
summary: "Implemented 5-pill LocationSelector, dedicated custom location definition modal, multi-location filtering, and card badges"
---

# Mobile Pantry Storage Location Selector and Filtering

Implemented 5-pill LocationSelector, dedicated custom location definition modal, multi-location filtering, and card badges.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Work Summary

1. **Shared Schemas & Data Contracts (`@expyrico/shared`)**:
   - Added `locationField` schema accepting strings, null, and empty string coercion, rejecting control characters, and enforcing 50-character limit.
   - Updated `recordSchema`, `recordCreateBaseSchema`, and `recordPatchSchema`. Rebuilt and refreshed vendored `@expyrico/shared` distribution in `apps/mobile/local-packages/@expyrico/shared/dist`.
   - Verified 140/140 unit tests in `packages/shared`.

2. **Backend Postgres & Sync Engine (`api/`)**:
   - Added `location String?` to Prisma `model Record` and created migration SQL `api/prisma/migrations/20260908093000_add_record_location/migration.sql`.
   - Regenerated Prisma Client v5.22.0.
   - Wired `location` into `create.ts`, `patch.ts`, `duplicate.ts`, and `sync.ts` across household and personal sync branches.
   - Verified `records-sync.test.ts` and `records-sync-household.test.ts` pass with live Postgres.

3. **Mobile Storage & SQLite Migration (`apps/mobile/src/db/`)**:
   - Bumped WatermelonDB schema version to 5 in `schema.ts`.
   - Added non-destructive migration in `migrations.ts` adding `location` and `location_dirty` columns.
   - Verified on physical device that WatermelonDB upgraded database cleanly (`PRAGMA user_version = 5`).
   - Wired `RecordModel.location` and `RecordModel.locationDirty` with per-field dirty bit tracking in `patchLocalRecord` and `sync.ts`.

4. **UI Components (`LocationSelector` & `LocationPickerModal`)**:
   - Built `LocationSelector.tsx` with 4 fixed pills (`Fridge`, `Freezer`, `Pantry`, `Counter`) + adaptive 5th slot (`More ▾` / `${location} ▾`).
   - Implemented tap-to-deselect (`onChange(null)`).
   - Built `LocationPickerModal.tsx` with search input, 14 preset chips, a dedicated "DEFINE CUSTOM LOCATION" section with text input and `Apply` button, and an empty-search fallback chip (`+ Define "<Input>"`).
   - Ensured all touch targets satisfy `minHeight >= 44` (passing `touch-target.test.ts: 21/21`).

5. **Form Integrations**:
   - Integrated `LocationSelector` in `QuickEditModal.tsx` (between Unit and Expiry Date) with `lastRecordIdRef` hydration guard.
   - Integrated `LocationSelector` in `AddRecordForm.tsx` (after Unit and before Category).
   - Threaded location through `RecordList.tsx:handleSaveEdit` (including duplicated drafts) and `record/[id].tsx:handleSaveQuickEdit`.

6. **Pantry Multi-Location Filtering & Badging**:
   - Updated `pantryFilterTypes.ts` with `locations?: string[]`.
   - Updated `filterAndSortRecords.ts` with case-insensitive multi-location matching and search query inclusion.
   - Added "STORAGE LOCATION" section to `PantryFilterModal.tsx` with Title Case aggregation and dynamic count badges.
   - Updated `RecordList.tsx` filter gatekeepers (`isFiltered`, `activeFilterCount`, `resetKey`, per-value `onRemoveFilter`).
   - Added contextual location badges with dynamic icons via `getLocationIcon` to both `RecordCard.tsx` and `PantryGridCard.tsx`.

7. **Verification**:
   - Unit tests: 83/83 passed across all location test suites.
   - Full mobile suite: 143/143 suites, 892/892 tests passed.
   - Typechecks: 0 errors in both mobile and API.
   - Gradle Android debug build: `BUILD SUCCESSFUL in 22s`.
