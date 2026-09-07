---
phase: 1
title: "Database Schema & Synchronization Architecture"
status: complete
priority: P1
effort: "1 day"
dependencies: []
---

# Phase 1: Database Schema & Synchronization Architecture

<!-- Updated: Validation Session 1 - Added discard_reason column to Prisma and WatermelonDB schemas -->
<!-- Updated: Validation Session 2 - Indexed status column, client-honored timestamps, notification send queue cancellation, and pushPending race guard -->
<!-- Updated: Red Team Review Session 1 - Applied findings 4 (status index), 6 (pushPending in-flight race guard), 7 (notification-send BullMQ job cancellation), 8 (client-honored timestamps), 10 (discardReason max 50 char validation constraint) -->

## Overview
Establish the foundational data storage and synchronization layer for retaining used and discarded items across both the backend database (PostgreSQL/Prisma) and the mobile offline-first database (WatermelonDB), introducing exact timestamp tracking, structured waste reason telemetry, and robust sync race protection.

## Requirements
- Functional:
  - Track `discarded_at` timestamp and `discard_reason` (constrained string, max 50 chars) in the database alongside existing `consumed_at`.
  - Index `status` column in WatermelonDB `schema.ts` for fast reactive history queries.
  - Persist `status` (`'active'`, `'consumed'`, `'discarded'`), respective timestamps, and `discard_reason` during local mutations and remote sync.
  - On the backend, honor client-supplied `consumedAt` and `discardedAt` timestamps when provided (preserving offline consumption/discard time accuracy), falling back to `now()` only when omitted.
  - When status changes to `'consumed'`, set `consumedAt = clientTime ?? now()`, clear `discardedAt = null`, `discardReason = null`.
  - When status changes to `'discarded'`, set `discardedAt = clientTime ?? now()`, persist `discardReason`, clear `consumedAt = null`.
  - When status is restored to `'active'` (Undo), clear `consumedAt = null`, `discardedAt = null`, `discardReason = null`.
  - Cancel scheduled notification send jobs in BullMQ when items become inactive (`consumed` or `discarded`).
  - Reschedule push notifications when items are restored to `'active'`.
  - Guard `pushPending` against wiping `pendingSync = false` if user taps Undo while the consume PATCH is in flight.
- Non-functional:
  - Safe zero-downtime WatermelonDB migration (v3 $\rightarrow$ v4) ensuring existing offline user databases upgrade cleanly without data loss.
  - Full bidirectional sync parity in `POST /v1/records/sync`.

## Architecture & Data Schema

### 1. Backend PostgreSQL Schema (`api/prisma/schema.prisma`)
```prisma
model Record {
  id            String       @id @default(uuid()) @db.Uuid
  userId        String       @map("user_id") @db.Uuid
  productId     String?      @map("product_id") @db.Uuid
  customName    String?      @map("custom_name")
  category      String?
  expiryDate    DateTime     @map("expiry_date") @db.Date
  purchaseDate  DateTime?    @map("purchase_date") @db.Date
  quantity      Decimal      @default(1) @db.Decimal(12, 3)
  unit          String       @default("pcs")
  price         Decimal?     @db.Decimal(10, 2)
  store         String?
  notes         String?
  photoUrl      String?      @map("photo_url")
  status        RecordStatus @default(active)
  notifyAt      Json         @default("[]") @map("notify_at")
  clientId      String       @unique @map("client_id") @db.Uuid
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  consumedAt    DateTime?    @map("consumed_at")
  discardedAt   DateTime?    @map("discarded_at")
  discardReason String?      @map("discard_reason")
  householdId   String?      @map("household_id") @db.Uuid

  @@index([userId, status, expiryDate])
  @@index([householdId, status, expiryDate])
  @@index([userId, status, discardedAt])
  @@index([userId, status, consumedAt])
  @@map("records")
}
```

### 2. WatermelonDB Local Database Schema (`apps/mobile/src/db/`)
- In `schema.ts`: Bump schema version to `4`.
  - Update `status` column to `{ name: 'status', type: 'string', isIndexed: true }`.
  - Add `{ name: 'discarded_at', type: 'number', isOptional: true }`.
  - Add `{ name: 'discard_reason', type: 'string', isOptional: true }`.
- In `migrations.ts`: Add migration step `toVersion: 4` with `add_columns` on `records` table for `discarded_at` and `discard_reason`.
- In `RecordModel` (`Record.ts`):
  ```typescript
  @date('consumed_at') consumedAt!: Date | null;
  @date('discarded_at') discardedAt!: Date | null;
  @field('discard_reason') discardReason!: string | null;
  ```

### 3. Sync & Notification Hygiene
- In `@expyrico/shared` (`packages/shared/src/schemas/record.ts`):
  - Add `discardReason: z.string().trim().min(1).max(50).nullable().optional()` with strict input sanitization.
- In `api/src/routes/records/patch.ts`:
  - Honor client timestamps:
    ```typescript
    ...(input.status === 'consumed' ? { consumedAt: input.consumedAt ? new Date(input.consumedAt) : new Date(), discardedAt: null, discardReason: null } : {}),
    ...(input.status === 'discarded' ? { discardedAt: input.discardedAt ? new Date(input.discardedAt) : new Date(), discardReason: input.discardReason || 'other', consumedAt: null } : {}),
    ...(input.status === 'active' ? { consumedAt: null, discardedAt: null, discardReason: null } : {}),
    ```
  - Notification Cancellation: When transitioning to non-active status (`consumed` or `discarded`), clear `notifyAt: []` and remove any delayed jobs matching `send__${id}__*` in the notification send queue.
  - When transitioning back to `active`, recompute `notifyAt` and schedule reminder.
- In `apps/mobile/src/db/sync.ts` (`pushPending`):
  - In-flight race guard: before clearing `pendingSync = false` after PATCH success, re-fetch or compare `r.status === patch.status` to ensure an in-flight Undo (which set `r.status = 'active'`, `r.pendingSync = true`) is not clobbered.

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/XXXXXXXX_add_record_discarded_fields/migration.sql`
- Modify: `packages/shared/src/schemas/record.ts`
- Modify: `api/src/routes/records/patch.ts`
- Modify: `api/src/services/records/sync.ts`
- Modify: `api/src/services/records/repository.ts`
- Modify: `apps/mobile/src/db/schema.ts`
- Modify: `apps/mobile/src/db/migrations.ts`
- Modify: `apps/mobile/src/db/models/Record.ts`
- Modify: `apps/mobile/src/db/sync.ts`
- Modify: `apps/mobile/src/api/records.ts`

## Implementation Steps
1. **Prisma & Migration**: Update `api/prisma/schema.prisma` to add `discardedAt` and `discardReason`. Run migration.
2. **Shared DTO Contracts**: Update `recordSchema` and sync request/response Zod schemas in `packages/shared/src/schemas/record.ts` (enforcing max 50 chars on `discardReason`).
3. **Backend Route & Sync**:
   - Update `patch.ts` to honor client-provided `consumedAt` and `discardedAt`.
   - Update `patch.ts` to cancel notification send jobs on non-active status, and reschedule on restore.
   - Update `sync.ts` to support `discardedAt` and `discardReason` in upserts and delta pulls.
4. **WatermelonDB v4 Migration**:
   - Bump version to 4 in `schema.ts`, mark `status` indexed, and add `discarded_at`, `discard_reason` columns.
   - Add migration step in `migrations.ts`.
   - Update `RecordModel` with `@date('discarded_at')` and `@field('discard_reason')`.
5. **Mobile Sync Integration**:
   - Update `LocalRecord` interface in `records.ts`.
   - Update `apps/mobile/src/db/sync.ts` with in-flight race guard in `pushPending`.

## Success Criteria
- [x] Database migration runs cleanly on Postgres without breaking existing records.
- [x] WatermelonDB v4 migration upgrades existing local database with indexed `status`.
- [x] Server honors client-supplied timestamps for offline fidelity.
- [x] Status transitions to consumed/discarded reliably cancel pending BullMQ send jobs.
- [x] In-flight Undo during background sync does not lose `pendingSync: true`.

## Risk Assessment
- **Risk:** Existing WatermelonDB schema changes causing runtime crashes on client startup if migrations are misconfigured.
  - *Observable Signal:* SQLite errors like `no such column: discarded_at` in app logs.
  - *Mitigation:* Explicit schema migration tests verifying upgrade from v3 to v4 database.
- **Risk:** Stale notifications firing for items after they have been consumed or discarded.
  - *Observable Signal:* User receives an expiry reminder for a product they consumed days ago.
  - *Mitigation:* Explicitly clear `notify_at` and cancel scheduled BullMQ jobs when status transitions to non-active in `patch.ts`.
