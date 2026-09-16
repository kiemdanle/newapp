---
phase: 2
title: "Fastify Backend Admin API"
status: pending
priority: P1
effort: "6h"
dependencies: ["phase-01-contracts-and-schemas"]
---

# Phase 2: Fastify Backend Admin API

## Overview
Implement dedicated Fastify administrative endpoints for pantry item management in `api/src/routes/admin/pantry-items/`. This encompasses comprehensive multi-field keyword search, relational filtering, dynamic sorting, page-based pagination, detailed item lookup, audit-logged edits with notification rescheduling, and safe deletion with foreign-key detachment and BullMQ queue purging.

---

## Requirements

### Functional Requirements
- **`GET /v1/admin/pantry-items` (List)**:
  - Query parameters validated against `adminPantryItemsQuerySchema`.
  - Multi-field keyword search across: `customName`, product `name`, item `brand`, product `brand`, item `category`, product `category`, item `notes`, `store`, owner's `email`, owner's `firstName`, owner's `lastName`, and product `barcode`.
  - Filtering by `location`, `category`, `brand`, `productId`, `productType` (`all` | `catalog` | `custom`), `userId`, and `status` (`active` | `consumed` | `discarded`).
  - Dynamic sorting by `createdAt`, `expiryDate`, `updatedAt`, `quantity`, or `name` in `asc` or `desc` order (defaulting to `expiryDate asc` with secondary sort `id asc`).
  - Page-based pagination returning `{ items, total, page, limit, totalPages }`.
- **`GET /v1/admin/pantry-items/filter-options` (Filter Aggregates)**:
  - Returns distinct active locations (trimmed, non-empty), distinct categories, and top 50 brands from active records to populate client filter dropdowns efficiently.
- **`GET /v1/admin/pantry-items/:id` (Detail)**:
  - Fetches the target `Record` including relations: `user`, `product`, `household`, `pushLogs`, and `giveaways`.
  - Returns 404 with `NOT_FOUND` if record does not exist.
- **`PATCH /v1/admin/pantry-items/:id` (Edit & Canonical Status Lifecycle)**:
  - Validates body against `adminPantryItemPatchSchema`.
  - Runs inside Prisma interactive transaction with `lockUserPantryQuota(tx, ownerId)`:
    - Re-reads fresh record under lock.
    - Normalizes status transitions matching domain rules:
      - Setting `consumed`: sets `consumedAt = new Date()`, clears `discardedAt = null`, `discardReason = null`, `notifyAt = []`.
      - Setting `active` from `discarded`/`consumed`/`expired`: verifies owner capacity via `assertCanAddPantryItems(ownerId, 1, tx)`, recalculates `notifyAt = computeNotifyAt(...)`, clears `discardedAt = null`, `discardReason = null`, `consumedAt = null`.
      - Setting `discarded`: sets `discardedAt = new Date()`, saves `discardReason`, clears `consumedAt = null`, `notifyAt = []`.
      - Setting `expired`: sets `status = 'expired'`, clears `notifyAt = []`.
    - If `expiryDate` changes and item is `active`: recomputes `notifyAt` notification schedule.
    - Updates record in database.
    - Writes audit log atomically *inside* the transaction:
      `await writeAuditLog({ adminId, action: 'pantry_item.update', targetType: 'record', targetId: id, diff: { before, after } }, tx)`.
  - Outside transaction: enqueues notification rescheduling strictly *after* commit:
    `if (needsReschedule) await notificationScheduleQueue().add('schedule', { recordId: id });`.
- **`DELETE /v1/admin/pantry-items/:id` (Delete, Durable Tombstone & Shared Serialization Lock)**:
  - Safely handles foreign-key constraints: if any `Giveaway` references this `recordId`, nullifies `giveaway.recordId` in the transaction prior to deleting the record.
  - **Shared Serialization Lock & Fresh Scope Re-Read:** In the Prisma interactive transaction:
    1. `const existing = await tx.record.findUnique({ where: { id } });` If missing, throw 404.
    2. `await lockUserPantryQuota(tx, existing.userId);`
    3. Re-read fresh record under lock to ensure `householdId` has not transitioned:
       `const fresh = await tx.record.findUnique({ where: { id } });`
    4. If `fresh.householdId`, `await lockHouseholdRow(tx, fresh.householdId);`
  - Atomically creates `RecordTombstone` in PostgreSQL storing `{ recordId: fresh.id, clientId: fresh.clientId, userId: fresh.userId, householdId: fresh.householdId, deletedAt: new Date() }`.
  - Deletes the `Record` row in PostgreSQL.
  - Writes audit log atomically *inside* the transaction:
    `await writeAuditLog({ adminId, action: 'pantry_item.delete', targetType: 'record', targetId: id, diff: { before: freshSnapshot } }, tx)`.
  - Outside transaction: safely purges BullMQ queues in try/catch without failing response on Redis error.
  - Returns `204 No Content`.
- **`POST /v1/records` (Create Path Anti-Resurrection Guard)**:
  - In `api/src/routes/records/create.ts`, inside the owner-locked transaction, checks:
    `const tombstone = await tx.recordTombstone.findUnique({ where: { clientId } });`
  - If tombstoned: rejects with 409 `AppError` (`ERROR_CODES.RECORD_DELETED`) preventing recreation of deleted items via ordinary REST create.
- **Durable Deletion Propagation & In-Lock Anti-Resurrection Guard in `syncRecords()`**:
  - *In-Lock Anti-Resurrection Guard:* Inside transaction *after* `lockUserPantryQuota`, checks `tx.recordTombstone.findUnique({ where: { clientId: u.clientId } })`. If found, checks authorization: if caller owns it (`userId === tombstone.userId`) or belongs to its household (`tombstone.householdId && householdIds.has(tombstone.householdId)`), pushes `tombstone.recordId` to `deletedIds`. If foreign, drops silently. In all cases, halts upsert to prevent resurrection.
  - *Delta Pull Tombstone Propagation:* In step 3, queries `recordTombstone` only on the initial page (`batch.cursor == null`) with `take: 1000` where `deletedAt > sinceDate` for the caller's personal scope and accessible households. Merges `recordId`s into `deletedIds` (deduplicated).
### Non-functional Requirements
- Protected by `adminOnlyPlugin` (enforcing authenticated administrator role).
- Enclosed in `auditPlugin` for automatic request metadata capture.
- Fast execution using optimized PostgreSQL indexes (`records_user_id_status_expiry_date_idx`, etc.).

---

## Architecture

```
                  Client Request
                        │
                        ▼
         ┌──────────────────────────────┐
         │      Fastify Server          │
         │  (adminOnlyPlugin + audit)   │
         └──────────────┬───────────────┘
                        │
         ┌──────────────┴───────────────┐
         ▼                              ▼
  /v1/admin/pantry-items        /v1/admin/pantry-items/:id
  (GET List & GET Options)      (GET Detail, PATCH, DELETE)
         │                              │
         ├──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
  ┌──────────────┐              ┌──────────────┐              ┌────────────────┐
  │ Prisma ORM   │              │ BullMQ       │              │ Audit Service  │
  │ - findMany   │              │ - Purge jobs │              │ - writeAuditLog│
  │ - count      │              │ - Reschedule │              │                │
  │ - update     │              │   notifyAt   │              └────────────────┘
  │ - delete     │              └──────────────┘
  └──────────────┘
```

---

## Related Code Files
- Modify: `api/prisma/schema.prisma` (add `RecordTombstone` model)
- Modify: `api/src/routes/records/create.ts` (in-lock tombstone check rejecting recreation)
- Modify: `api/src/services/records/sync.ts` (authorized tombstone guard & bounded delta pull)
- Create: `api/src/routes/admin/pantry-items/index.ts`
- Create: `api/src/routes/admin/pantry-items/list.ts`
- Create: `api/src/routes/admin/pantry-items/filter-options.ts`
- Create: `api/src/routes/admin/pantry-items/get.ts`
- Create: `api/src/routes/admin/pantry-items/patch.ts`
- Create: `api/src/routes/admin/pantry-items/delete.ts`
- Modify: `api/src/routes/admin/index.ts` (register `/pantry-items` plugin)
- Create: `api/tests/integration/admin-pantry-items.test.ts`

---

## Implementation Steps
1. Create `api/src/routes/admin/pantry-items/list.ts`:
   - Parse `req.query` with `adminPantryItemsQuerySchema`.
   - Build Prisma `where` clause:
     - Search filter: `OR` across `customName`, `product.name`, `brand`, `product.brand`, `category`, `product.category`, `notes`, `store`, `user.email`, `user.firstName`, `user.lastName`, `product.barcode`.
     - Location filter: exact/insensitive match on `record.location`.
     - Category filter: check both `record.category` and `record.product.category`.
     - Brand filter: check both `record.brand` and `record.product.brand`.
     - Product type: `'catalog'` (`productId != null`) vs `'custom'` (`productId == null`).
     - Status: active, consumed, discarded, expired, or all.
   - Run parallel queries:
     - `prisma.record.findMany({ where, skip, take, orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }], include: { user, product, household } })`
     - `prisma.record.count({ where })`
   - Map records into serialized `adminPantryItemRowSchema` format.
2. Create `api/src/routes/admin/pantry-items/filter-options.ts`:
   - Query distinct `location`, `category`, and `brand` from active `record` table and return clean arrays, cached in Redis for 5 minutes.
3. Create `api/src/routes/admin/pantry-items/get.ts`:
   - Fetch target record by ID with `user`, `product`, `household`, `pushLogs` (take 5), and `giveaways` (take 5).
   - Format response matching `adminPantryItemDetailSchema`.
4. Create `api/src/routes/admin/pantry-items/patch.ts`:
   - Start transaction and acquire `lockUserPantryQuota(tx, ownerId)`.
   - Re-read fresh record under lock. If missing, throw 404.
   - Apply canonical status lifecycle transitions:
     - `consumed`: `consumedAt = new Date()`, clear `discardedAt`, `discardReason`, `notifyAt = []`.
     - `active`: verify owner capacity via `assertCanAddPantryItems(ownerId, 1, tx)`, recalculate `notifyAt = computeNotifyAt(...)`, clear `discardedAt`, `discardReason`, `consumedAt`.
     - `discarded`: `discardedAt = new Date()`, save `discardReason`, clear `consumedAt`, `notifyAt = []`.
     - `expired`: `status = 'expired'`, clear `notifyAt = []`.
   - Update record in database.
   - Write audit log atomically *inside* transaction: `writeAuditLog(..., tx)`.
   - Outside transaction, enqueue reschedule job to `notificationScheduleQueue` if active expiry changed.
5. Create `api/src/routes/admin/pantry-items/delete.ts`:
   - Start transaction:
     - Query existing record, acquire `lockUserPantryQuota(tx, existing.userId)`.
     - Re-read fresh record under lock. If missing, throw 404.
     - If `fresh.householdId`, acquire `lockHouseholdRow(tx, fresh.householdId)`.
     - Nullify `Giveaway.recordId` for any giveaway referencing this record ID.
     - Atomically record deletion in `RecordTombstone`.
     - Delete the record from `record` table.
     - Write audit log atomically *inside* transaction: `writeAuditLog(..., tx)`.
   - Outside transaction: safely purge BullMQ queues in try/catch without failing response on Redis error.
5b. Update `syncRecords` in `api/src/services/records/sync.ts`:
   - In step 2 (upserts): inside the interactive transaction *after* `await lockUserPantryQuota(tx, ownerId)` is acquired, execute:
     `const tombstone = await tx.recordTombstone.findUnique({ where: { clientId: u.clientId } });`
     If found, verify authorization (owner or household member) before pushing `tombstone.recordId` to `deletedIds`, and return early from the transaction (preventing `record.create`).
   - In step 3 (delta pull): query `prisma.recordTombstone.findMany` only when `batch.cursor == null`, bounded to `take: 1000` where `deletedAt > sinceDate` for the user's personal scope and active household scopes. Merge `recordId`s into `deletedIds` array.
5c. Update `createRecordRoute` in `api/src/routes/records/create.ts`:
   - Inside the owner-locked transaction, check `tx.recordTombstone.findUnique({ where: { clientId } })`. If found, reject with 409 `AppError` (`ERROR_CODES.RECORD_DELETED`).
6. Create `api/src/routes/admin/pantry-items/index.ts` to bundle the routes, and register in `api/src/routes/admin/index.ts`.
7. Write automated integration tests in `api/tests/integration/admin-pantry-items.test.ts`.


---

## Success Criteria
- [x] All 5 endpoints (`/`, `/filter-options`, `/:id`, `PATCH /:id`, `DELETE /:id`) respond according to schema.
- [x] List endpoint correctly calculates `total` and `totalPages` and handles multi-parameter filter combinations without SQL/Prisma errors.
- [x] Non-admin access is rejected with 403 Forbidden.
- [x] Patching an item properly records before/after diffs in the audit logs table and normalizes status transitions.
- [x] Deleting an item with a linked giveaway succeeds without foreign-key constraint violations and creates a `RecordTombstone`.
- [x] Integration tests in `api/tests/integration/admin-pantry-items.test.ts` pass cleanly.

<!-- Updated: Red Team Review - Added create.ts tombstone guard, atomic in-tx audit logs, fresh scope re-reading, and bounded cursor tombstones -->

---

## Risk Assessment
- **Risk:** Performance degradation on `count(*)` with large table sizes when complex `OR` text searches are executed.
  - *Mitigation:* Prisma query uses indexed fields (`userId`, `status`, `expiryDate`, `householdId`). Compound text search is bounded to filtered subsets when status/location are specified.
  - *Breakage Signal:* API response time for list queries exceeds 500ms under test loads.
  - *Response:* Add specific functional indexes on PostgreSQL (`LOWER(custom_name)`, `location`) if query analysis shows table scans.


<!-- Updated: Validation Session 1 - Default sort expiryDate asc and dual soft-discard/hard-delete backend support -->