---
title: "Admin Pantry Items Management"
description: "Comprehensive admin dashboard suite to view, search, filter, sort, paginate, edit, and safely delete all users' pantry items across the platform."
status: completed
priority: P1
effort: "3d"
tags: [admin, pantry-items, search, filtering, pagination, crud]
created: 2026-09-16
---

# Admin Pantry Items Management

## Overview

Provide administrators with a centralized, robust, and high-performance management console for all user pantry items (`Record` model) across the Expyrico platform. Administrators can inspect item details across personal and shared household pantries, search across multiple metadata dimensions, filter by storage location, product, category, brand, and status, sort dynamically by date, quantity, or name, and navigate via full page-based pagination with customizable items per page. Furthermore, administrators can edit item attributes with automatic notification rescheduling, and safely delete items with cascade cleanup of scheduled notification jobs and foreign-key safeguards.

---

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Define shared Zod contracts & DTO schemas for admin pantry query, row, detail, patch, and filter options in `@expyrico/shared` | P1 |
| 2 | Implement Fastify admin routes (`GET /`, `GET /filter-options`, `GET /:id`, `PATCH /:id`, `DELETE /:id`) with audit logging, multi-field search, relational filtering, and BullMQ cleanup | P1 |
| 3 | Build typed server API client methods in `apps/admin/src/lib/admin-api.ts` and Server Actions in `apps/admin/src/lib/actions.ts` | P1 |
| 4 | Develop reusable Pagination component and Pantry Items List view with search, multi-filter bar, sorting, and configurable items-per-page | P1 |
| 5 | Develop Pantry Item Detail view (`/pantry-items/[id]`), Edit form, and safe Delete confirmation modal adhering to the Expyrico design palette | P1 |
| 6 | Validate end-to-end functionality, mobile sync delta propagation, unit & integration test coverage, and TypeScript typechecking | P1 |

---

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Admin Dashboard (apps/admin)                         │
│                                                                        │
│  /pantry-items (List)        /pantry-items/[id] (Detail & Edit)        │
│  - Multi-dimension Search    - Full Record Attributes                  │
│  - FilterBar (Location/      - User & Product Relation Cards           │
│    Category/Brand/Status)    - Photo Gallery & Expiry Countdown        │
│  - Sortable DataTable        - Edit Form Modal / Page                  │
│  - Reusable Pagination       - Safe Delete Confirmation Modal          │
│    (10, 25, 50, 100 / page)                                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Server Actions & serverAdminApi
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Fastify API (api/src)                             │
│                                                                        │
│  GET    /v1/admin/pantry-items              (Search, Filter, Sort, Pag)│
│  GET    /v1/admin/pantry-items/filter-options (Distinct Locations, etc)│
│  GET    /v1/admin/pantry-items/:id          (Detailed with Relations)  │
│  PATCH  /v1/admin/pantry-items/:id          (Audit Log + Reschedule)   │
│  DELETE /v1/admin/pantry-items/:id          (Audit Log + FK + Queues)  │
└──────────────────┬───────────────────────────────┬─────────────────────┘
                   │                               │
                   ▼                               ▼
       ┌──────────────────────┐        ┌───────────────────────┐
       │   PostgreSQL /       │        │   BullMQ Notification │
       │   Prisma ORM         │        │   Queues (Redis)      │
       │   - records          │        │   - notificationSend  │
       │   - record_tombstones│        │   - notificationSched │
       │   - users            │        │   (Cancel/Reschedule) │
       │   - products         │        └───────────────────────┘
       │   - audit_logs       │
       └──────────┬───────────┘
                  │
                  │ Next Client Sync (/v1/records/sync)
                  │ - Tombstones merged into deletedIds
                  │ - Stale offline upserts blocked
                  ▼
       ┌──────────────────────┐
       │   Mobile Client      │
       │   (WatermelonDB)     │
       │   Delta pulls synced │
       │   updates & deletes  │
       └──────────────────────┘
```

---

## Phases

| # | Phase | Status | Priority | Effort | Dependencies |
|---|-------|--------|----------|--------|--------------|
| 1 | [Phase 1: Contracts & Shared Schemas](./phase-01-contracts-and-schemas.md) | Completed | P1 | 3h | None |
| 2 | [Phase 2: Fastify Backend Admin API](./phase-02-backend-api.md) | Completed | P1 | 6h | Phase 1 |
| 3 | [Phase 3: Admin Client & Server Actions](./phase-03-admin-client-and-actions.md) | Completed | P1 | 3h | Phase 1, 2 |
| 4 | [Phase 4: List View, Table & Reusable Pagination](./phase-04-list-view-table-pagination.md) | Completed | P1 | 6h | Phase 3 |
| 5 | [Phase 5: Detail View, Edit Form & Delete Modal](./phase-05-detail-view-edit-delete.md) | Completed | P1 | 5h | Phase 3, 4 |
| 6 | [Phase 6: Verification, Testing & Mobile Sync Integrity](./phase-06-verification-testing.md) | Completed | P1 | 4h | Phase 4, 5 |

---

## Success Criteria

- [x] Schema validation contracts in `@expyrico/shared` strictly parse query parameters, list outputs, details, and mutations.
- [x] Admin API endpoints (`/v1/admin/pantry-items/*`) support multi-field search, multi-field filtering, multi-field sorting, and page-based pagination returning exact total counts and page metadata.
- [x] Fast filter options endpoint provides dynamic distinct locations, categories, and top brands for responsive dropdown options.
- [x] Reusable `Pagination` component supports jumping to pages, previous/next buttons, and selectable items per page (10, 25, 50, 100) while preserving existing URL search/filter state.
- [x] Pantry items list view accurately presents item name, brand, category, user email/name, location, status badge, expiry date, quantity, unit, and actions.
- [x] Item detail page renders full relational context (owner, product, household, photos, push logs, giveaways).
- [x] Edit action properly mutates item fields, creates an audit log entry (`pantry_item.update`), and reschedules notifications if expiry date changes.
- [x] Delete action safely detaches foreign key constraints (nullifying `Giveaway.recordId`), purges queued BullMQ notification jobs, creates a durable `RecordTombstone`, writes an audit log entry (`pantry_item.delete`), and deletes the record.
- [x] Durable deletion architecture ensures: (1) `RecordTombstone` entries are propagated as `deletedIds` during owner and household member delta pulls in `/v1/records/sync`, (2) stale offline upserts matching tombstoned `clientId`s are rejected rather than resurrected as zombie records, and (3) admin delete and sync upsert paths are strictly serialized using the shared owner quota advisory lock (`lockUserPantryQuota`) with in-transaction tombstone re-checking to eliminate TOCTOU race windows.
- [x] Full automated test suites (unit tests for schemas, integration tests for API routes, component tests for admin UI) pass cleanly.
- [x] TypeScript typecheck passes across all packages with zero errors.

---

## Validation Log

### Verification Results
- Claims checked: 14
- Verified: 13 | Failed: 1 (`packages/shared/src/schemas/admin/index.ts` does not exist) | Unverified: 0
- Tier: Full
- Corrections applied: Export schemas directly from `packages/shared/src/index.ts` via `./schemas/admin/pantry-items.js`.

### User Validation Decisions (Session 1)
1. **Export Structure:** Direct re-export from `packages/shared/src/index.ts` (maintains standard monorepo pattern).
2. **Deletion Strategy:** Dual action in Admin Console — both "Mark as Discarded" (soft discard, setting `status='discarded'` with retention and undo on mobile) and "Permanently Delete" (hard cascade delete unlinking giveaways and purging BullMQ notification jobs).
3. **Sidebar Placement:** Dedicated 'Pantry' navigation section in `NAV` (`apps/admin/src/lib/nav.ts`), providing clear visual grouping.
4. **Default Sorting & Pagination:** Default 25 items per page, sorted by Expiry Date ascending (`expiryDate asc`), presenting urgent items first.

### Whole-Plan Consistency Sweep
- Plan files reviewed: `plan.md`, `phase-01-contracts-and-schemas.md`, `phase-02-backend-api.md`, `phase-03-admin-client-and-actions.md`, `phase-04-list-view-table-pagination.md`, `phase-05-detail-view-edit-delete.md`, `phase-06-verification-testing.md`.
- Stale references checked:
  - `packages/shared/src/schemas/admin/index.ts` eliminated in favor of direct re-export from `packages/shared/src/index.ts`.
  - Default sort order unified to `expiryDate asc` with secondary sort `id asc` across all schemas, queries, and UI components.
  - Dual deletion strategy (Soft Discard with reason vs. Permanent Hard Delete with cascade cleanup) unified across backend PATCH/DELETE, Server Actions (`discardPantryItemAction`, `deletePantryItemAction`), table row actions, detail actions, and verification test cases.
  - Sidebar navigation unified to a dedicated 'Pantry' group with 'Pantry Items' link and `Archive` icon.
- Unresolved contradictions: 0
- Status: Ready for implementation (`/ak:cook`).

### Advisory Review & Durable Deletion Resolution (Session 2)
- **Finding:** Hard admin deletes would leave no tombstone trail in `api/src/services/records/sync.ts`. Offline clients sending stale upserts for absent `clientId`s would trigger `tx.record.create` and resurrect deleted items as zombies; furthermore, co-members in households would never receive `deletedIds`.
- **Resolution Added:**
  1. Created `RecordTombstone` Prisma model (`id`, `recordId`, `clientId`, `userId`, `householdId`, `deletedAt`).
  2. In `DELETE /v1/admin/pantry-items/:id`: atomically insert `RecordTombstone` before record deletion.
  3. In `syncRecords()` step 2 (upserts): guard against resurrection by checking `RecordTombstone` by `clientId`. If tombstoned, reject creation and append `recordId` to `deletedIds`.
  4. In `syncRecords()` step 3 (delta pull): query `RecordTombstone` where `deletedAt > sinceDate` for the caller's personal scope and accessible household scopes, merging `recordId`s into `deletedIds` for clean client-side WatermelonDB permanent destruction.
  5. In `phase-06`: added 4 explicit sync interaction tests for owner delta pull, household delta pull, stale offline upsert rejection, and tombstone idempotency.


### Advisory Review & TOCTOU Serialization Resolution (Session 3)
- **Finding:** A Time-Of-Check-To-Time-Of-Use (TOCTOU) concurrency window existed between administrative deletion and client sync upsert. If sync observed no tombstone before admin delete committed, sync's subsequent upsert could recreate the deleted row as a zombie.
- **Resolution Added:**
  1. **Shared Advisory Lock:** Both admin `delete.ts` and `sync.ts` (personal and household paths) strictly acquire the same PostgreSQL transaction-level advisory lock: `await lockUserPantryQuota(tx, ownerId)` (and `lockHouseholdRow(tx, householdId)` if applicable) in consistent lock acquisition order.
  2. **In-Lock Tombstone Re-Check:** In `sync.ts`, the `tx.recordTombstone.findUnique({ where: { clientId: u.clientId } })` check is executed *inside* the interactive transaction *after* `lockUserPantryQuota` is obtained. If a tombstone is found, creation is aborted and `tombstone.recordId` is pushed to `deletedIds`.
  3. **Barrier-Controlled Concurrency Test:** In `phase-06`, added a dedicated barrier-controlled integration test simulating concurrent admin deletion and client upsert execution to mechanically prove that transactions serialize without zombie resurrection.

---

## Red Team Review

### Session — 2026-09-16
**Findings:** 14 (14 accepted, 0 rejected)
**Severity breakdown:** 8 High, 6 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `POST /v1/records` ordinary create path lacks tombstone check, bypassing anti-resurrection | High | Accept | Phase 2, Phase 6 |
| 2 | Stale dirty personal items deleted on server cause mobile `pushPending` 404 sync loop | High | Accept | Phase 2, Phase 6 |
| 3 | `delete.ts` reads household scope before acquiring lock, risking wrong tombstone audience | High | Accept | Phase 2 |
| 4 | Status contracts omit persisted `expired` status enum, risking list Zod parsing failure | High | Accept | Phase 1, Phase 4 |
| 5 | Admin patch schema allows unbounded strings, risking mobile client sync payload crash | High | Accept | Phase 1, Phase 5 |
| 6 | Audit logging occurs after commit and after fallible Redis purge; failure erases audit trail | High | Accept | Phase 2 |
| 7 | `patch.ts` enqueues notification rescheduling before database update, causing race | High | Accept | Phase 2 |
| 8 | Admin status edits omit domain transition invariants (quota check on active, timestamp clears) | High | Accept | Phase 2, Phase 5 |
| 9 | Unbounded tombstone delta pull on cursor continuation requests sends full history from epoch | High | Accept | Phase 2 |
| 10| Pre-commit tombstone timestamps can fall permanently behind device watermark | Medium | Accept | Phase 2 |
| 11| Tombstone lookup discloses deleted record IDs to unauthorized foreign callers | Medium | Accept | Phase 2 |
| 12| List row edit action lacks notes/discardReason present only on detail DTO | Medium | Accept | Phase 4 |
| 13| Verification phase calls for Jest and nonexistent test paths instead of project Vitest stack | Medium | Accept | Phase 6 |
| 14| Distinct filter options endpoint executes unbounded scans across entire records table | Medium | Accept | Phase 2, Phase 4 |

### Whole-Plan Consistency Sweep
- **Plan files reviewed:** `plan.md`, `phase-01-contracts-and-schemas.md`, `phase-02-backend-api.md`, `phase-03-admin-client-and-actions.md`, `phase-04-list-view-table-pagination.md`, `phase-05-detail-view-edit-delete.md`, `phase-06-verification-testing.md`.
- **Decision delta applied across files:**
  - Unified status enum across shared schemas, Fastify routes, UI filter bar, and status badges to include `expired`.
  - Aligned admin patch schema string length constraints with mobile `recordPatchSchema` to prevent client sync serialization crashes.
  - Added `POST /v1/records` in-lock tombstone rejection, closing the ordinary creation bypass.
  - Hardened `delete.ts` with lock-then-reread for accurate household scoping and atomic in-transaction audit logging.
  - Hardened `patch.ts` with canonical domain status transitions, quota capacity checks, atomic in-transaction audit logging, and post-commit notification rescheduling.
  - Bounded tombstone queries in delta pull to initial sync pages (`take: 1000`) and authorized tombstone disclosure.
  - Handled mobile 404 unblocking in `apps/mobile/src/db/sync.ts` when personal records are deleted on the server.
  - Unified testing framework to Vitest across packages.
- **Unresolved contradictions:** 0
- **Status:** Ready for implementation (`/ak:cook`).
<!-- slug: admin-pantry-items-management -->
