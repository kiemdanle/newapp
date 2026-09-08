---
phase: 1
title: "Database Schema, Shared Types, and WatermelonDB Migration"
status: pending
priority: P1
effort: "3-4h"
dependencies: []
---

# Phase 1: Database Schema, Shared Types, and WatermelonDB Migration

## Overview
Establish the foundational data contracts and storage persistence for the optional `location` field across `@expyrico/shared`, the backend Prisma schema/repository, and mobile WatermelonDB local SQLite database with automated migration (v4 → v5).

## Requirements
- Functional:
  - Store optional item storage location as a trimmed string (up to 50 chars), defaulting to `null`.
  - Enable seamless reading and writing of `location` via `LocalRecord`, `createLocalRecord`, `updateLocalRecord`, and `duplicateLocalRecord`.
  - Ensure background offline synchronization transfers `location` to/from backend API.
- Non-functional:
  - Non-destructive database migration (v4 → v5) preserves all existing pantry records.
  - Zero performance regression on local record queries and sync runs.

## Architecture
```
┌───────────────────────────┐         ┌───────────────────────────┐
│     @expyrico/shared      │         │        Backend API        │
│  recordSchema             │         │  Prisma Record (Postgres) │
│  location: string | null  │◄────────┤  location String?         │
└─────────────┬─────────────┘         └───────────────────────────┘
              │
              ▼
┌───────────────────────────┐
│        Mobile App         │
│  WatermelonDB (SQLite v5) │
│  RecordModel.location     │
│  LocalRecord.location     │
└───────────────────────────┘
```

## Related Code Files
- Modify: `packages/shared/src/schemas/record.ts`
- Modify: `packages/shared/src/schemas/record.test.ts`
- Modify: `api/prisma/schema.prisma`
- Modify: `api/src/services/records/repository.ts`
- Modify: `api/src/routes/records/create.ts`
- Modify: `api/src/routes/records/patch.ts`
- Modify: `api/src/routes/records/duplicate.ts`
- Modify: `api/src/services/records/sync.ts`
- Modify: `apps/mobile/src/db/schema.ts`
- Modify: `apps/mobile/src/db/migrations.ts`
- Modify: `apps/mobile/src/db/models/Record.ts`
- Modify: `apps/mobile/src/api/records.ts`
- Modify: `apps/mobile/src/db/sync.ts`

## Implementation Steps
1. **Shared Schema Update (`packages/shared/src/schemas/record.ts`)**:
   - Add `location: z.string().trim().max(50).nullable().optional()` to `recordSchema`.
   - Add `location: z.string().trim().max(50).nullable().optional()` to `recordCreateBaseSchema` and `recordPatchSchema`.
   - Update unit tests in `packages/shared/src/schemas/record.test.ts` to verify valid strings, null, whitespace trim, and length constraints (>50 rejection).

2. **Backend Prisma Schema & Endpoints**:
   - Add `location String?` to `model Record` in `api/prisma/schema.prisma`.
   - Update `toApiRecord` in `api/src/services/records/repository.ts` to include `location: r.location ?? null`.
   - Update `api/src/routes/records/create.ts` to write `location: input.location?.trim() || null` to Prisma.
   - Update `api/src/routes/records/patch.ts` to write `location: input.location !== undefined ? (input.location?.trim() || null) : undefined` to Prisma.
   - Update `api/src/routes/records/duplicate.ts` to copy `location: source.location ?? null` to Prisma.
3. **Mobile WatermelonDB Schema & Migration (`apps/mobile/src/db/`)**:
   - Bump `mySchema` version from 4 to 5 in `apps/mobile/src/db/schema.ts`.
   - Add `{ name: 'location', type: 'string', isOptional: true }` to the `records` table schema.
   - In `apps/mobile/src/db/migrations.ts`, append the migration block for `toVersion: 5`:
     ```typescript
     {
       toVersion: 5,
       steps: [
         {
           type: 'add_columns' as const,
           table: 'records',
           columns: [
             { name: 'location', type: 'string', isOptional: true },
           ],
         },
       ],
     }
     ```

4. **RecordModel & LocalRecord API Wiring (`apps/mobile/src/db/models/Record.ts`, `apps/mobile/src/api/records.ts`)**:
   - In `RecordModel`: add `@field('location') location!: string | null;`.
   - In `LocalRecord` interface: add `location: string | null;`.
   - In `toLocal(r: RecordModel)`: map `location: r.location ?? null`.
   - In `createLocalRecord`: assign `rec.location = input.location ? input.location.trim() : null;`.
   - In `updateLocalRecord`: handle `if (patch.location !== undefined) rec.location = patch.location ? patch.location.trim() : null;`.
   - In `duplicateLocalRecord`: map `location: record.location ?? null`.


5. **Live Sync Path & Multi-Branch Pull Wiring (`api/src/services/records/sync.ts`, `apps/mobile/src/db/sync.ts`)**:
   - In `api/src/services/records/sync.ts`:
     - Household record create branch (`tx.record.create`): map `location: u.location ?? null`.
     - Personal record upsert create branch: map `location: u.location ?? null`.
     - Personal record upsert update branch: map `location: u.location !== undefined ? (u.location ?? null) : undefined`.
   - In `apps/mobile/src/db/sync.ts`:
     - `pushPending`: include `if (rec.location) body.location = rec.location;` in POST `/records` body.
     - `pushPending`: include `if (rec.location !== undefined) patch.location = rec.location;` in PATCH `/records/:id` body.
     - `pullSince`: populate `r.location = ch.location ?? null;` across all pull update branches:
       1. Scope-change conflict resolution branch (`ch.location`).
       2. Household records sync branch (`ch.location`).
       3. Personal records create and update branches (`ch.location`).
     - Ensures household pull creates rows with location preserved, avoiding data drop.
## Success Criteria
- [ ] `packages/shared` tests pass with `location` field validations.
- [ ] WatermelonDB schema compiles with version 5 and includes `location` column.
- [ ] Migration v4 → v5 defined cleanly without table reconstruction.
- [ ] `LocalRecord` and `RecordModel` correctly expose and persist `location`.
- [ ] Record CRUD operations (`createLocalRecord`, `updateLocalRecord`, `duplicateLocalRecord`) retain `location`.

## Risk Assessment
- *Risk*: WatermelonDB migration failure on devices with existing v4 SQLite databases causing crashes on startup.
- *Observable Signal*: Crash with `Migration failed` or SQLite error `table records has no column named location`.
- *Pre-decided Response*: Verify `schemaMigrations` step order carefully; test migration from v4 by simulating existing DB instance in unit tests.
