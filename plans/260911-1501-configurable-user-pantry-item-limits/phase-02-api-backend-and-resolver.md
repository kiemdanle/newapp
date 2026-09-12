---
phase: 2
title: "API Backend Settings, Dynamic Resolver & Limit Enforcement"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: API Backend Settings, Dynamic Resolver & Limit Enforcement

## Overview
Implement the backend settings store, in-memory caching with TTL and invalidation, dynamic user pantry limit resolution service (`getUserPantryLimit` and `assertCanAddPantryItems`), admin REST endpoints with audit logging, public client setting endpoint, and enforce the dynamic limit across **every positive active-count transition** (`POST /v1/records`, `POST /v1/records/duplicate`, `PATCH /v1/records/:id` reactivation, `POST /v1/giveaways/:id/cancel` reactivation, and offline `sync.ts` reactivation/creation), backed by an **explicit per-owner PostgreSQL advisory transaction lock contract** (`hashtext(recordOwnerId)`), canonical lock ordering, idempotency cache release on quota failures, idempotent client-id pre-resolution, and **deterministic `(updatedAt, id)` composite seek pagination in delta sync**.

<!-- Updated: Advisory Review Session 1 - Findings F01, F02, F03, F04, F05, F06, F11, F12, F14, F15 -->

---

## Requirements

### Functional
1. **Settings Service Key & Cache (`api/src/services/admin/settings.ts`)**:
   - Add `SETTING_KEYS.PANTRY_LIMITS = 'pantry_limits'`.
   - Implement `getPantryLimits(): Promise<PantryLimitsSettings>` with 60s in-memory TTL caching.
   - Implement `invalidatePantryLimitsCache(): void`.
   - Update `getSetting` to fallback to `DEFAULT_PANTRY_LIMITS` when key missing.
2. **Pantry Limit Resolver Service (`api/src/services/records/pantry-limits.ts`)**:
   - `getUserPantryLimit(userId: string, tx?: PrismaClient)`:
     - Returns `{ limit: settings.defaultUserPantryLimit, source: 'default_setting' }`.
   - `lockUserPantryQuota(tx: PrismaTransaction, userId: string): Promise<void>`:
     - Issues `SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)` to serialize concurrent operations for this owner within the transaction.
   - `assertCanAddPantryItems(userId: string, countToAdd = 1, tx: PrismaTransaction)`:
     - Runs inside the interactive transaction under the advisory lock.
     - Counts active records: `tx.record.count({ where: { userId, status: 'active' } })`.
     - Throws `AppError({ status: 409, code: ERROR_CODES.ITEM_LIMIT_REACHED, title: ... })` if `activeCount + countToAdd > limit`.
3. **Strict Global Lock Ordering & Centralized Permission Helpers**:
   - Canonical lock ordering:
     1. **First**: `lockUserPantryQuota(tx, targetOwnerId)` (per-owner advisory lock via `hashtext`)
     2. **Second**: `lockHouseholdRow(tx, householdId)` (household advisory lock via hex key)
     3. **Third**: Record row locks (e.g. `SELECT ... FOR UPDATE`)
   - When moving between households in PATCH: sort household IDs `[oldHouseholdId, newHouseholdId].filter(Boolean).sort()` and lock in sorted order to prevent deadlocks (Advisory Finding F06).
   - **Centralize `lockHouseholdRow`**: Export `lockHouseholdRow(tx: Prisma.TransactionClient | PrismaClient, householdId: string): Promise<void>` from `api/src/services/households/permissions.ts` using normalized `parseInt(householdId.replace(/-/g, '').slice(0, 15), 16)` and replace duplicate implementations across the codebase (Advisory Finding F15).
   - **Transaction-aware `assertMember`**: Update `assertMember(householdId: string, userId: string, tx?: Prisma.TransactionClient | PrismaClient)` in `api/src/services/households/permissions.ts` to accept an optional transaction client and re-verify membership inside the transaction after acquiring `lockHouseholdRow` (Advisory Finding F06).
4. **Idempotency Layer Quota Release (`api/src/plugins/idempotency.ts`)**:
   - In `onSend` hook: if `reply.statusCode === 409 && isQuotaRejection(payload)` (code `'item_limit_reached'`), do NOT cache the 409 response in Redis for 24 hours. Delete reservation `await redis.del(key)` so subsequent retries after space is freed are evaluated fresh against the database (Red Team Finding 1).
5. **Locked Client-ID Replay & Terminal History Normalization in `create.ts`**:
   - In `createRecordRoute`: wrap creation in an interactive transaction with `lockUserPantryQuota(tx, userId)` first. If household, acquire `lockHouseholdRow(tx, input.householdId)` and re-verify `assertMember(input.householdId, userId, tx)` (Advisory Findings F04, F06).
   - Inside the transaction under the lock, check `tx.record.findUnique({ where: { clientId: input.clientId } })`:
     - If found and `existing.userId === userId`: return `201` with existing record (idempotent replay, quota already consumed by the committed create) (Advisory Finding F04).
     - If found and `existing.userId !== userId`: throw 409 `ERROR_CODES.CONFLICT` (`client_id already used by another user`).
   - Normalize status: `const effectiveStatus = input.status ?? 'active'`.
   - Quota assertion: ONLY call `assertCanAddPantryItems(userId, 1, tx)` if `effectiveStatus === 'active'`.
   - Persist terminal fields: `status: effectiveStatus`, `consumedAt: effectiveStatus === 'consumed' ? (input.consumedAt ? new Date(input.consumedAt) : new Date()) : null`, `discardedAt: effectiveStatus === 'discarded' ? (input.discardedAt ? new Date(input.discardedAt) : new Date()) : null`, `discardReason: effectiveStatus === 'discarded' ? (input.discardReason ?? 'other') : null`.
   - Only enqueue `notificationScheduleQueue` reminders if `effectiveStatus === 'active'` (Advisory Finding F05).
6. **Owner-Scoped PATCH Reactivation (`patch.ts`)**:
   - Separate `actorId = req.user.id` (for authorization) from `quotaOwnerId = existing.userId` (for quota locking, resolution, and counting) (Red Team Finding 2).
   - If `input.status !== undefined`: wrap in transaction, acquire locks first, re-read the row inside the lock, compute `isBecomingActive = input.status === 'active' && freshRow.status !== 'active'`. If becoming active, enforce quota against `quotaOwnerId` (Red Team Finding 3).
   - Non-increasing updates (metadata, notes, status to consumed/discarded) bypass quota checks.
7. **Giveaway Cancellation Quota & Lock Order (`cancel.ts`)**:
   - **Canonical Lock Sequence**:
     1. **Giveaway Row Lock First**: Exclusively lock the giveaway row inside transaction:
        ```sql
        SELECT id, giver_user_id AS "giverUserId", status, record_id AS "recordId", quantity::float
        FROM giveaways WHERE id = ${id}::uuid FOR UPDATE
        ```
        This serializes concurrent double-cancellations immediately. If status is already `'cancelled'`, `assertTransition` rejects the second request without touching quota or record locks.
     2. Re-verify `giverUserId === actorId` and `status === 'claimed' && recordId`.
     3. **Discover Linked Record Ownership**:
        ```sql
        SELECT id, user_id AS "userId", household_id AS "householdId"
        FROM records WHERE id = ${giveaway.recordId}::uuid
        ```
        Explicitly project `user_id AS "userId"` to prevent undefined property errors (Advisory Finding F03).
     4. **Acquire Owner Quota & Household Lock Unconditionally (Before Record Row Lock)**:
        - Acquire `await lockUserPantryQuota(tx, linkedRecordMeta.userId)`.
        - If household: acquire `await lockHouseholdRow(tx, linkedRecordMeta.householdId)`.
        Acquiring owner quota unconditionally before taking the record row lock guarantees that no concurrent transaction for this owner can interleave, consume items, or create replacement items while cancellation is deciding.
     5. **Record Row Lock & Locked State Classification**:
        ```sql
        SELECT id, quantity::float, status FROM records WHERE id = ${giveaway.recordId}::uuid FOR UPDATE
        ```
        Under the exclusive record lock, classify the fresh transition:
        - **Reactivation Branch** (`freshRecord.status === 'consumed' && freshRecord.quantity === 0`):
          This is a positive active-count transition (+1 active item).
          Call `assertCanAddPantryItems(linkedRecordMeta.userId, 1, tx)`. If at capacity, throw 409 `ITEM_LIMIT_REACHED` so transaction rolls back cleanly, keeping giveaway in `claimed` state and record in `consumed` state.
          If allowed, reactivate record: `status: 'active', quantity: restoreQty, consumedAt: null`.
        - **Active Increment Branch** (`freshRecord.status === 'active'`):
          Item is already active (quota-neutral, +0 active items).
          Increment existing quantity: `quantity: freshRecord.quantity + restoreQty` (retains existing active inventory, never overwriting active quantity).
     6. Update giveaway status to `'cancelled'`.
     This sequence preserves global lock order (Giveaway -> Quota -> Household -> Record) and is completely deadlock-free with PATCH (which only locks Quota -> Household -> Record and never locks giveaways).
8. **Deterministic Composite Cursor Delta Sync & HTTP Response Adapter (`sync.ts`)**:
   - Update `SyncOutcome` in `api/src/services/records/sync.ts` to include:
     ```typescript
     nextCursor?: { updatedAt: string; id: string } | null;
     hasMore?: boolean;
     ```
   - Update `api/src/routes/records/sync.ts` to expose `nextCursor: outcome.nextCursor ?? null` and `hasMore: outcome.hasMore ?? false` in the HTTP response payload (Advisory Finding F01).
   - In `syncRecords` delta pull, combine cursor seek and visibility predicates via strict `AND` composition:
     ```typescript
     const seekCondition = batch.cursor
       ? {
           OR: [
             { updatedAt: { gt: new Date(batch.cursor.updatedAt) } },
             { updatedAt: new Date(batch.cursor.updatedAt), id: { gt: batch.cursor.id } },
           ],
         }
       : { updatedAt: { gt: sinceDate } };

     const visibilityCondition = {
       OR: [
         { userId, householdId: null },
         ...(householdIdList.length > 0 ? [{ householdId: { in: householdIdList } }] : []),
       ],
     };

     const changes = await prisma.record.findMany({
       where: { AND: [seekCondition, visibilityCondition] },
       orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
       take: 1000,
     });
     ```
     This prevents Prisma query object key collision where a second top-level `OR` silently overwrites the first (Advisory Finding F12).
   - In `syncRecords` upsert processing: wrap each upsert in an isolated transaction `tx`. Inside `tx`, acquire `lockUserPantryQuota(tx, ownerId)` (and `lockHouseholdRow(tx, householdId)` if household). Re-read row state fresh from database under the lock. Compute `isBecomingActive = effectiveStatus === 'active' && freshRow?.status !== 'active'`. If becoming active, call `assertCanAddPantryItems(ownerId, 1, tx)`. Catch `AppError` where `err.code === ERROR_CODES.ITEM_LIMIT_REACHED` outside the transaction, append `{ clientId: u.clientId, reason: 'item_limit_reached' }` to `conflicts`, and continue processing other items without failing the entire sync batch (Advisory Finding F02).
9. **Usage Endpoint (`GET /v1/me/usage`)**:
   - Fetch `getUserPantryLimit(userId)`.
   - Recompute dynamic `readOnly: itemCount >= itemLimit` and return `itemLimit`.
10. **Atomic Admin Settings Persistence & Public Endpoints**:
    - `GET /v1/admin/settings/pantry-limits`: Authoritative direct DB read returning `PantryLimitsSettings`.
    - `PATCH /v1/admin/settings/pantry-limits`: Validates with `pantryLimitsPatchSchema`. Implements `updatePantryLimits(patch, adminId)` in `api/src/services/admin/settings.ts` wrapping read-for-update, partial merge (`tierLimits: patch.tierLimits ? { ...(current.tierLimits ?? {}), ...patch.tierLimits } : current.tierLimits`), database write, and `writeAuditLog` in a single `prisma.$transaction`. Invalidate in-memory cache ONLY after transaction commit succeeds (Advisory Findings F11, F14).
    - `GET /v1/settings/pantry-limits`: Public client route returning `{ defaultUserPantryLimit, tierLimits }`.

---

## Architecture: Multi-Vector Quota & Deterministic Sync

```
                                      Ingestion / Reactivation Vectors
                                                      │
         ┌───────────────────┬────────────────────────┼────────────────────────┬───────────────────┐
         ▼                   ▼                        ▼                        ▼                   ▼
  POST /records      POST /duplicate         PATCH /records/:id      POST /giveaways/cancel   POST /records/sync
  (new active)        (new active)          (isBecomingActive: +1)   (consumed restore: +1)   (new or reactivated)
         │                   │                        │                        │                   │
         └───────────────────┴────────────────────────┼────────────────────────┴───────────────────┘
                                                      │
                                                      ▼
                                       Interactive Transaction
                                                      │
                                                      ├─► Check existing clientId (if POST) ──► Replay 201
                                                      │
                                                      ├─► 1. lockUserPantryQuota(targetOwnerId)
                                                      ├─► 2. lockHouseholdRow(householdId) [if household]
                                                      ├─► 3. re-verify assertMember(householdId) inside lock
                                                      ├─► 4. re-read row status inside lock (if PATCH/cancel)
                                                      ├─► 5. assertCanAddPantryItems(targetOwnerId, 1, tx)
                                                      │        └─► If exceeded: throw 409 (Idempotency cache DEL)
                                                      └─► 6. Execute write / status update

                                          Deterministic Delta Sync
                                                      │
                                                      ▼
                                       POST /v1/records/sync (Pull)
                                                      │
                                      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }]
                                      seek: (updatedAt > cursor.updatedAt) OR
                                            (updatedAt = cursor.updatedAt AND id > cursor.id)
                                                      │
                                     emit nextCursor + hasMore (no timestamp-boundary loss)
```

---

## Related Code Files

- Create: `api/src/services/records/pantry-limits.ts`
- Create: `api/src/routes/admin/settings/pantry-limits.ts`
- Create: `api/src/routes/settings/pantry-limits.ts`
- Create: `api/tests/integration/admin-pantry-limits-settings.test.ts`
- Create: `api/tests/integration/pantry-quota-transitions.test.ts`
- Create: `api/tests/integration/pantry-quota-concurrency.test.ts`
- Create: `api/tests/integration/delta-sync-pagination.test.ts`
- Modify: `api/src/plugins/idempotency.ts`
- Modify: `api/src/services/admin/settings.ts`
- Modify: `api/src/services/households/permissions.ts`
- Modify: `api/src/routes/admin/index.ts`
- Modify: `api/src/server.ts`
- Modify: `api/src/routes/records/create.ts`
- Modify: `api/src/routes/records/duplicate.ts`
- Modify: `api/src/routes/records/patch.ts`
- Modify: `api/src/routes/records/sync.ts`
- Modify: `api/src/routes/giveaways/cancel.ts`
- Modify: `api/src/routes/me/usage.ts`
- Modify: `api/src/services/records/sync.ts`

---

## Implementation Steps

1. **Update `api/src/plugins/idempotency.ts`**:
   - In `onSend` hook, check if `reply.statusCode === 409`.
   - If response payload contains `code: 'item_limit_reached'`, call `await redis.del(key)` so the uncommitted reservation is deleted and subsequent retries are processed fresh.
2. **Update `api/src/services/admin/settings.ts`**:
   - Add `SETTING_KEYS.PANTRY_LIMITS = 'pantry_limits'`.
   - Implement `cachedPantryLimits` with 60s TTL and `invalidatePantryLimitsCache`.
3. **Create `api/src/services/records/pantry-limits.ts`**:
   - Implement `getUserPantryLimit`, `lockUserPantryQuota`, and `assertCanAddPantryItems`.
4. **Update `api/src/services/households/permissions.ts`**:
   - Export centralized `lockHouseholdRow(tx, householdId)` and update `assertMember` to accept optional `tx`.
5. **Update `create.ts`**:
   - In transaction: acquire `lockUserPantryQuota(tx, userId)`. If household, acquire `lockHouseholdRow(tx, input.householdId)` and re-verify `assertMember(input.householdId, userId, tx)`.
   - Re-check `findUnique({ where: { clientId } })` inside lock: if found for user, return 201 immediately; if found for other user, throw 409 conflict.
   - Normalize `effectiveStatus = input.status ?? 'active'`. If active, call `assertCanAddPantryItems(userId, 1, tx)`.
   - Persist terminal fields and conditionally enqueue reminders only for active items.
6. **Update `patch.ts`**:
   - Identify `quotaOwnerId = existing.userId`.
   - If moving between households, sort household IDs and lock both in sorted order.
   - When status is updated: lock in transaction, re-read row, compute `isBecomingActive`. If true, assert quota for `quotaOwnerId`.
7. **Update `giveaways/cancel.ts`**:
   - Lock giveaway row first via `FOR UPDATE`, re-verifying giver authorization and transition state.
   - Query record ownership with `user_id AS "userId"`.
   - Unconditionally acquire `lockUserPantryQuota` (and `lockHouseholdRow` if household).
   - Lock record row via `FOR UPDATE` and classify transition from locked row:
     - If consumed and quantity 0: assert quota, then reactivate (`status = 'active', quantity = restoreQty, consumedAt = null`); quota rejection rolls back both giveaway and record.
     - If active: increment quantity (`quantity = freshRecord.quantity + restoreQty`), no quota assertion needed.
   - Update giveaway to cancelled.
8. **Update `sync.ts` (Service and Route)**:
   - In `api/src/services/records/sync.ts`: Add `nextCursor` and `hasMore` to `SyncOutcome`. Combine cursor seek and visibility via `AND: [seekCondition, visibilityCondition]`.
   - In `api/src/routes/records/sync.ts`: Pass `nextCursor` and `hasMore` to HTTP response.
   - In `syncRecords` upsert loop: wrap each upsert in short transaction, lock quota, re-read fresh row, check quota on positive transition, and push `item_limit_reached` conflict on quota rejection without aborting the batch.
9. **Add Tests**:
   - `pantry-quota-concurrency.test.ts`: Concurrent `Promise.all([create, duplicate (POST /records/:id/duplicate), sync])` at `limit - 1`.
   - `delta-sync-pagination.test.ts`:
     - **Equal-Timestamp Boundary Test**: Seed database with 1,005 records having the EXACT same `updatedAt` timestamp and distinct IDs.
     - Verify Page 1 delivers 1,000 records with `hasMore = true` and `nextCursor`.
     - Verify Page 2 delivers the remaining 5 records with `hasMore = false` and `nextCursor = null`.
     - Assert all 1,005 records are received without a single record dropped or duplicated.
   - `pantry-quota-transitions.test.ts`:
     - Cross-member household restore: User A full, Member B restores A's record -> rejected 409.
     - Giveaway cancel at quota: giver ≠ owner, owner at full capacity, giver cancels giveaway -> rejected 409 because owner is at capacity; giveaway remains claimed and record remains consumed.
     - Concurrent double-cancel race: `Promise.all([cancelGiveaway(id), cancelGiveaway(id)])` simultaneously -> exactly one succeeds with 200, second rejected with transition conflict, inventory restored exactly once.
     - Giveaway cancel / PATCH record concurrent execution -> zero deadlocks under PostgreSQL.
     - Interleaved active-read -> consume -> replacement -> stale active write -> rejected 409.
     - Commit drop recovery: committed create with dropped response retried with same clientId succeeds without quota block.
     - Idempotency 24h uncache: 409 quota failure followed by delete and retry with same clientId succeeds.

---

## Success Criteria

- [x] All positive active transitions (create, duplicate, patch reactivation, giveaway cancel, sync) enforce quota against the record's true owner.
- [x] Concurrent requests from the same user serialize under advisory lock without overshooting.
- [x] 409 quota errors are not cached in Redis, enabling immediate retry after capacity is freed.
- [x] Idempotent retries of committed creations return 201 without quota conflict.
- [x] Delta sync paginates deterministically over identical-timestamp boundaries without dropping rows.
- [x] Delta sync HTTP endpoint outputs `nextCursor` and `hasMore`.
- [x] All integration and concurrency tests pass against PostgreSQL.
