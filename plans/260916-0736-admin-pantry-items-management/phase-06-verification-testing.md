---
phase: 6
title: "Verification, Testing & Mobile Sync Integrity"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-04-list-view-table-pagination", "phase-05-detail-view-edit-delete"]
---

# Phase 6: Verification, Testing & Mobile Sync Integrity

## Overview
Execute end-to-end verification, automated testing, security validation, and mobile synchronization integrity checks for the admin pantry items management system. Ensure seamless data propagation to user mobile devices (WatermelonDB), zero regression on existing platform features, strict role-based access control, and complete compliance with the Expyrico design system.

---

## Requirements

### Functional Requirements
- **Automated Test Suites (Vitest across workspaces)**:
  - Run shared schema unit tests (`packages/shared/src/schemas/admin/pantry-items.test.ts` via Vitest).
  - Run Fastify integration test suite (`api/tests/integration/admin-pantry-items.test.ts` via Vitest).
  - Run Admin unit test suite (`apps/admin/tests/unit/pagination.test.ts` via Vitest matching `vitest.config.ts`).
- **Mobile Client Synchronization & Durable Deletion Verification**:
  - **Owner Delta Pull Propagation**: When an administrator hard-deletes an item, an atomic `RecordTombstone` is created. The owner's next `/v1/records/sync` call (with `since` < deletion time) receives `record.id` in `deletedIds` and permanently deletes the local record in WatermelonDB.
  - **Household Delta Pull Propagation**: When an administrator hard-deletes an item assigned to a household, all household co-members receive `record.id` in `deletedIds` during their next delta pull and purge their local copies.
  - **Stale Offline Upsert Anti-Resurrection Guard**: When a client goes offline before the admin deletion and later reconnects sending an upsert with `u.clientId`, the server detects the `RecordTombstone`, rejects record creation, appends `tombstone.recordId` to `deletedIds`, and avoids resurrecting the item as a zombie record.
  - **Barrier-Controlled Concurrency Serialization Test**: A dedicated test using a barrier latch to fire simultaneous admin deletion and client sync upsert transactions on the same item. Verifies that the shared `lockUserPantryQuota` advisory lock forces strict serial ordering. Verifies that regardless of which transaction arrives first, the in-transaction tombstone re-check eliminates the TOCTOU gap, resulting in zero zombie record recreations.
  - **Tombstone Idempotency & Retention**: Repeated sync calls from multiple devices for the same tombstoned record cleanly return `deletedIds` without duplicate key errors or transaction aborts.
  - **Soft Discard Verification**: When an administrator marks a record as `discarded` (soft discard), the record's `updatedAt` is bumped, and `/v1/records/sync` delivers the status change in `changes`, properly routing the item to the mobile Discarded/Archive tab with retention and undo capability.
  - **Mobile 404 Sync Unblocking Verification**: When a personal record is deleted by an admin on the server while mobile has local edits, `apps/mobile/src/db/sync.ts` catches 404 from `PATCH /records/:id`, destroys the local record permanently, and unblocks `pullSince` from getting stuck in an infinite sync retry loop.
  - **Create Endpoint Tombstone Rejection**: Verify that calling `POST /v1/records` with a `clientId` matching a `RecordTombstone` is rejected with 409 conflict, closing the creation-route resurrection bypass.
  - **Atomic In-Transaction Audit Logging**: Verify that audit log entries commit atomically with record deletion and patch mutations, and simulate Redis failure during queue cleanup proving that the audit trail remains intact.
  - Verify that non-admin tokens return `403 Forbidden` on all `/v1/admin/pantry-items*` endpoints.
  - Verify that unauthenticated requests return `401 Unauthorized`.
  - Verify that all mutations write complete before/after snapshots to the `audit_logs` table.
- **Design System & Palette Compliance**:
  - Audit UI colors against `docs/design/expyrico-colour-palette.md`: Fresh Sage (`#4BAE8A`), Deep Sage (`#3A8F6F`), Warm White (`#FAFAF8`), Honey (`#F5A623`), Alert Red (`#E0442A`), Almost Black (`#2C2C28`).

### Non-functional Requirements
- 100% test pass rate across the new integration and unit test files.
- `npm run typecheck` passes with zero errors across `@expyrico/shared`, `api`, and `apps/admin`.

---

## Architecture & Verification Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Test & Verification Flow                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ 1. Schema Validation (Vitest)                                          │
│    packages/shared/src/schemas/admin/pantry-items.test.ts              │
│    - Validates coercions, defaults, limits, and edge cases.           │
│                                                                        │
│ 2. API Integration Tests (Vitest + Supertest)                          │
│    api/tests/integration/admin-pantry-items.test.ts                    │
│    - RBAC: 401/403 checks.                                             │
│    - Multi-field search, location/brand/category/status filters.       │
│    - Sort order (asc/desc) across date, name, quantity.               │
│ 3. Client Sync Integrity Tests (Vitest + Supertest)                     │
│    api/tests/integration/records-sync-admin-interaction.test.ts        │
│    - test: admin hard delete emits tombstone and propagates deletedIds  │
│      to owner delta pull.                                              │
│    - test: admin delete propagates deletedIds to household co-members. │
│    - test: stale offline upsert matching tombstone clientId is         │
│      rejected and returned in deletedIds (no zombie resurrection).      │
│    - test: barrier-controlled concurrent delete vs upsert strictly      │
│      serializes via lockUserPantryQuota preventing TOCTOU resurrection. │
│    - test: POST /records with tombstoned clientId returns 409 conflict. │
│    - test: mobile pushPending absorbs personal 404 and unblocks sync.   │
│    - test: atomic in-tx audit log persists even if Redis purge fails.   │
│    - test: admin soft discard updates status and syncs via changes[].  │
│ 4. Admin UI Unit Tests (Vitest)                                        │
│    apps/admin/tests/unit/pagination.test.ts                            │
│    - Range text, page buttons, ellipsis, limit select URL updating.    │
│                                                                        │
│ 5. Full Repository Typecheck                                           │
│    - tsc --noEmit across all touched packages                          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Related Code Files
- Create: `api/tests/integration/records-sync-admin-interaction.test.ts`
- Modify: `api/tests/integration/admin-pantry-items.test.ts`
- Modify: `packages/shared/src/schemas/admin/pantry-items.test.ts`
- Modify: `apps/admin/src/components/__tests__/pagination.test.tsx`

---

## Implementation Steps
1. Execute schema unit tests:
   ```bash
   npm test -- packages/shared/src/schemas/admin/pantry-items.test.ts
   ```
2. Execute Fastify API integration tests:
   ```bash
   npm test -- api/tests/integration/admin-pantry-items.test.ts
   ```
3. Execute sync interaction test verifying that an admin edit propagates cleanly in the sync delta pull:
   ```bash
   npm test -- api/tests/integration/records-sync-admin-interaction.test.ts
   ```
4. Execute admin frontend unit tests:
   ```bash
   npm test -- apps/admin/src/components/__tests__/pagination.test.tsx
   ```
5. Run full workspace typechecking:
   ```bash
   npm run typecheck
   ```
6. Inspect the admin dashboard in development mode to visually confirm the Expyrico color palette, responsive filter bar, sorting behavior, and modal interactions.

---

## Success Criteria
- [x] All unit, integration, and component tests pass with 0 failures.
- [x] Administrative mutations correctly trigger client delta updates in `records/sync`.
- [x] Audit logs accurately capture all administrative pantry item modifications and deletions.
- [x] TypeScript compilation across all touched packages passes cleanly without errors.
- [x] UI visually complies with the Expyrico design guidelines.

---

## Risk Assessment
- **Risk:** Concurrency race (TOCTOU gap) where an incoming client sync checks for tombstones just before an administrative deletion transaction commits, and then inserts the row after the delete, resurrecting the deleted item as a zombie.
  - *Mitigation:* Both admin `delete.ts` and `sync.ts` upsert branches acquire the shared PostgreSQL transaction-level advisory lock `lockUserPantryQuota(tx, ownerId)` (and `lockHouseholdRow` when shared) in consistent acquisition order. In `sync.ts`, the tombstone existence check is performed *inside* the transaction *after* acquiring the lock, guaranteeing that the delete transaction commits and writes its tombstone before sync can inspect it.
  - *Breakage Signal:* Intermittent test failure or resurrection under high-concurrency sync simulation.
  - *Response:* Validated by barrier-controlled concurrency test in `api/tests/integration/records-sync-admin-interaction.test.ts`.

<!-- Updated: Validation Session 3 - Added shared lockUserPantryQuota serialization, in-lock tombstone re-check, and barrier-controlled concurrency tests -->
<!-- Updated: Validation Session 2 - Replaced false sync mitigation with durable RecordTombstone architecture, anti-resurrection guards, and 4 explicit sync interaction test suites -->

<!-- Updated: Red Team Review - Aligned test suite with Vitest and added create endpoint & sync 404 unblocking tests -->
