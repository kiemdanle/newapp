---
phase: 2
title: "Local Database Persistence"
status: pending
priority: P1
effort: "45m"
dependencies: ["1"]
---

# Phase 2: Local Database Persistence

## Overview
Update the mobile offline-first SQLite database (WatermelonDB) to persist `brand` on `records`, implement migration v5 → v6, update models and local record APIs, and wire up bidirectional cloud synchronization.

## Requirements
- Functional:
  - Migrate WatermelonDB schema from version 5 to version 6, adding an optional `brand` column (`type: 'string'`) to `records`.
  - Expose `@field('brand') brand!: string | null;` on `RecordModel`.
  - Include `brand: string | null` in `LocalRecord` interface and `toLocal` transform.
  - Support `brand` in `createLocalRecord` and `patchLocalRecord`.
  - Include `brand` in `pushPending()` and `pullSince()` in `apps/mobile/src/db/sync.ts`.
- Non-functional:
  - Zero-downtime client database migration: existing app installations preserve all existing records upon upgrade to v6.
  - Safe trimming: brand is trimmed and bounded to 120 characters before persistence.

## Architecture
```
LocalRecord { id, customName, brand, category, ... }
       ▲
       │ toLocal() / createLocalRecord() / patchLocalRecord()
       ▼
RecordModel (@field('brand'))
       ▲
       │ WatermelonDB v6 Schema (migration step: add_columns 'brand')
       ▼
SQLite `records` Table (Column: `brand TEXT`)
       ▲
       │ pushPending() / pullSince()
       ▼
REST API (`/v1/records`, `/v1/records/sync`)
```

## Related Code Files
- Modify: `apps/mobile/src/db/schema.ts`
- Modify: `apps/mobile/src/db/migrations.ts`
- Modify: `apps/mobile/src/db/models/Record.ts`
- Modify: `apps/mobile/src/api/records.ts`
- Modify: `apps/mobile/src/db/sync.ts`

## Implementation Steps
1. **Schema Definition & Migration**:
   - In `apps/mobile/src/db/schema.ts`:
     - Bump `version: 6`.
     - In `tables.records.columns`, append `{ name: 'brand', type: 'string', isOptional: true }`.
   - In `apps/mobile/src/db/migrations.ts`:
     - Add migration step for `toVersion: 6`:
       ```typescript
       {
         toVersion: 6,
         steps: [
           {
             type: 'add_columns' as const,
             table: 'records',
             columns: [{ name: 'brand', type: 'string', isOptional: true }],
           },
         ],
       }
       ```
2. **WatermelonDB Model & LocalRecord Mapping**:
   - In `apps/mobile/src/db/models/Record.ts`:
     - Add `@field('brand') brand!: string | null;`
   - In `apps/mobile/src/api/records.ts`:
     - Add `brand: string | null;` to `LocalRecord`.
     - In `toLocal(r: RecordModel)`: map `brand: r.brand ?? null`.
     - In `createLocalRecord(input)`: accept `brand?: string | null`, write `r.brand = input.brand ? input.brand.trim().slice(0, 120) : null`.
     - In `patchLocalRecord(id, patch)`: include `'brand'` in `Pick<LocalRecord, ...>`, apply `if (patch.brand !== undefined) r.brand = patch.brand ? patch.brand.trim().slice(0, 120) : null`.
3. **Synchronization Mapping**:
   - In `apps/mobile/src/db/sync.ts`:
     - In `pushPending`:
       - For record create (`POST /records`): include `brand: rec.brand ?? null` in `body`.
       - For record update (`PATCH /records/:id`): include `brand: rec.brand ?? null` in `patch`.
    - In `pullSince`:
      - Explicitly map `r.brand = ch.brand ?? null` in all 4 mutation branches:
        1. Conflict overwrite (`apps/mobile/src/db/sync.ts:146-168`)
        2. Household record overwrite (`apps/mobile/src/db/sync.ts:185-208`)
        3. Household record create (`apps/mobile/src/db/sync.ts:209-233`)
        4. Personal record update/create (`apps/mobile/src/db/sync.ts:234-287`)
      <!-- Updated: Red Team Session 1 - Explicitly map r.brand in all 4 pullSince mutation branches -->

## Success Criteria
- [x] Schema version is 6 and migrations table includes step `toVersion: 6`.
- [x] `LocalRecord` includes `brand: string | null`.
- [x] `createLocalRecord` and `patchLocalRecord` correctly set and persist `brand`.
- [x] Mobile TypeScript typecheck compiles with zero diagnostics (`npm --prefix apps/mobile run typecheck`).

## Risk Assessment
- **Risk**: Existing SQLite database on user devices fails to migrate if migrations list is out of sequence.
  - **Mitigation**: Add strictly sequential `toVersion: 6` matching the exact schema version bump.
  - **Observable Signal**: WatermelonDB startup error `Database version mismatch`.
  - **Response**: Confirm `schema.ts:version === 6` and `migrations.ts` has matching `toVersion: 6`.
