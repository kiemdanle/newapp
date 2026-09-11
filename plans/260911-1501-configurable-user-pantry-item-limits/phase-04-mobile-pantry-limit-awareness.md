---
phase: 4
title: "Mobile App Limit Awareness, Soft-Ceiling & Feedback UI"
status: pending
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 4: Mobile App Limit Awareness, Soft-Ceiling & Feedback UI

## Overview
Equip the mobile React Native app with real-time pantry limit awareness and offline sync resilience. Introduce a cached `usePantryLimits` hook with foreground/sync invalidation, define a creator-scoped `useMyActiveRecordCount` hook, guard both Add Item and RecordList Duplicate flows when at capacity, and re-architect `apps/mobile/src/db/sync.ts` with disjoint deletion/mutation worksets, non-blocking 409 quota error isolation for both POST creates and PATCH restorations, and **composite cursor drainage in `pullSince()`** to guarantee zero data loss across equal-timestamp page boundaries up to the 10,000 limit.

<!-- Updated: Advisory Review Session 1 - Findings F01, F05, F07, F08, F09, F10, F12, F13, F16 -->

---

## Requirements

### Functional
1. **Pantry Limits & Usage Hook (`apps/mobile/src/utils/pantry-limits.ts`)**:
   - Fetches public limits from `GET /v1/settings/pantry-limits` and user usage from `GET /v1/me/usage`.
   - Caches limits in AsyncStorage under key `pantry.limits.v1` with a 24-hour stale time for offline fallback.
   - **Real-Time Freshness & Invalidation**: Invalidate `['pantry-limits']` and `['usage']` queries on `runSync()` completion and on manual pull-to-refresh in `RecordList.tsx` (Red Team Finding 14).
2. **Creator-Scoped Active Record Counter (`apps/mobile/src/features/records/record-counters.ts`)**:
   - Implements `useMyActiveRecordCount()`: Queries WatermelonDB records where `status = 'active'`, `pending_delete = false`, and `(user_id = currentUserId || user_id is null)`.
   - Ensures household items created by other members do NOT falsely consume the current user's personal quota (Red Team Finding 13).
3. **Add Item Form & Home Tab Capacity Awareness (`AddRecordForm.tsx` & `home.tsx`)**:
   - **Home Screen Capacity Indicator (`home.tsx`)**: Render subtle item count in segmented tab and header (`In Stock ({count}/{limit})`). When capacity $\ge 90\%$, style pill with `Honey` (`#F5A623`); when at $100\%$ capacity, style with `Alert Red` (`#E0442A`) (Advisory Finding F16).
   - **Add Item Form (`AddRecordForm.tsx`)**:
     - Stamped ownership: Pass `userId: currentUserId` (from `useSessionStore`) to `createLocalRecord()` so local unsynced rows have an owner immediately (Red Team Finding 13).
     - If `activeCount >= 0.9 * limit` and `activeCount < limit`: Render warning banner at top: *"Pantry nearly full ({count}/{limit} items). Consider consuming or sharing items."* (Advisory Finding F16).
     - If `activeCount >= limit`: Render prominent blocking card: *"Pantry Limit Reached ({count}/{limit} items). You must consume, discard, or delete existing items to add new ones."* and disable the save button with native alert feedback.
4. **Duplicate Record Guard & Ownership Stamping in `RecordList.tsx`**:
   - Guard `handleDuplicate(record)`: If `isAtCapacity`, immediately show native `Alert`: *"Pantry Limit Reached — You have reached the maximum allowed items ({limit} items). Remove or consume existing items to duplicate."*
   - Guard `handleSaveEdit`: If `editingRecord.id.startsWith('draft-duplicate-')`:
     - Check `isAtCapacity`: block creation and alert user if at limit (Red Team Finding 7).
     - **Stamp Current User**: In `createLocalRecord`, pass `userId: currentUserId` (from `useSessionStore`), NEVER copying `editingRecord.userId`, so creator-scoped quota accounting immediately reflects the duplicate for the duplicating user (Advisory Finding F09).
5. **Offline Sync Loop Re-Ordering & Quota Isolation (`apps/mobile/src/db/sync.ts`)**:
   - **Disjoint Worksets**: Fetch `deletes` first and execute `destroyPermanently()`. THEN query surviving dirty records:
     `recordsCol.query(Q.where('pending_sync', true), Q.where('pending_delete', false)).fetch()`
     This prevents attempting to update or POST destroyed models (Red Team Finding 5).
   - **Prioritize Capacity-Freeing Updates**:
     - Partition surviving dirty rows:
       1. Capacity-decreasing updates (status changing to `consumed` or `discarded`) execute first.
       2. Neutral metadata updates execute second.
       3. Brand-new creates (`!rec.serverId`) and reactivations (`status: 'active'`) execute third.
   - **Dual 409 Error Isolation & Terminal Creation Serialization (POST and PATCH)**:
     - For `POST /records` (creates): Serialize complete status fields (`status: rec.status`, `consumedAt: rec.consumedAt?.toISOString()`, `discardedAt: rec.discardedAt?.toISOString()`, `discardReason: rec.discardReason`) so offline split-history records persist terminal without consuming active quota (Advisory Finding F05).
     - For `POST /records` (creates) and `PATCH /records/:id` (restorations): if response returns status 409 with `code: 'item_limit_reached'`, do NOT throw and abort `pushPending()`.
     - Record persistent per-item error in `syncQuotaErrorsStore` keyed by `clientId`, leaving `rec.pendingSync = true` (Red Team Finding 6).
     - Continue loop so remaining items, deletes, and `pullSince` run unhindered.
   - **Model Lifetime & In-Flight Invalidation Protection**:
     - Snapshot operation identity and payload before network await. Inside `database.write`, re-fetch `recordsCol.find(rec.id)`. If destroyed by undo or marked `pendingDelete`, skip update (or call compensating delete if remote serverId was created). Acknowledge only fields sent, preserving newer local edits made while request was in flight (Advisory Finding F08).
     - Prune `syncQuotaErrorsStore` upon successful sync or local deletion.
   - **Record Card Sync Error Badge (`RecordCard.tsx`)**:
     - If record `clientId` is in `syncQuotaErrorsStore`, render amber warning chip: *"Saved locally — server capacity reached. Free space to sync."* (Advisory Finding F16).
6. **Deterministic Composite Cursor Delta Sync Drainage in `pullSince()`**:
   - **No Arbitrary Page Limit**: Accounts with tens of thousands of historical or shared household records (which are not bounded by the active pantry quota) must drain completely without looping or stopping at an artificial page ceiling.
   - **Uncapped Non-Persistent In-Memory Drainage Loop**:
     - Drainage state is maintained strictly in function memory during `pullSince()`, requiring no global AsyncStorage keys and completely eliminating cross-account cursor leakage or stale cursor resumption after account sign-out / database reset (Advisory Review Blocker).
     - If a network interruption occurs mid-drainage, the next sync simply restarts from `lastSyncAt`. Because WatermelonDB record processing is fully idempotent (keyed by `client_id`), re-applying previously received pages is 100% safe and conflict-free.
     - Checkpoint `saveLastSync(new Date(initialServerTime))` is advanced **ONLY AFTER** all pages drain completely without error (`hasMore === false`).
   - **Implementation Structure**:
     ```typescript
     let cursor: { updatedAt: string; id: string } | null = null;
     let initialServerTime: string | null = null;
     let hasMore = true;

     while (hasMore) {
       const res = await apiClient.post<RecordSyncResponse>('/records/sync', {
         since: cursor ? null : (since ? since.toISOString() : null),
         cursor,
         upserts: [],
         deletes: [],
       });
       if (!initialServerTime) {
         initialServerTime = res.serverTime;
       }
       await applySyncChanges(res.changes, res.deletedIds, res.conflicts);
       if (res.hasMore && (!res.nextCursor || (cursor && res.nextCursor.id === cursor.id && res.nextCursor.updatedAt === cursor.updatedAt))) {
         // Non-advancing cursor protocol error: abort without advancing lastSync!
         throw new Error('Sync protocol error: non-advancing cursor received');
       }
       cursor = res.nextCursor ?? null;
       hasMore = Boolean(res.hasMore && cursor);
     }
     // Advance checkpoint ONLY AFTER all pages are completely drained without error:
     if (!hasMore && initialServerTime) {
       await saveLastSync(new Date(initialServerTime));
     }
     ```
   - **Preserve Quota-Rejected Local Writes on Pull**: In `applySyncChanges`, do NOT let a server pull overwrite a pending local restore if `syncQuotaErrorsStore.has(ch.clientId)`. Only `scope_changed` forces overwrite; `item_limit_reached` retains local pending row with error badge (Advisory Findings F01, F07, F12).
---

## Architecture: Resilient Sync & Deterministic Drainage

```
User Action (Duplicate / Add)
  │
  ├──► Check useMyActiveRecordCount() >= effectiveLimit
  │         │
  │         ├─► At Capacity ──► Immediate Native Alert, Block Action
  │         └─► Under Limit ──► Write WatermelonDB (pendingSync=true, userId=currentUserId)
  │
  ▼
runSync()
  │
  ├──► STEP 1: Deletes First (deletesCol) ───────► apiClient.delete()
  │
  ├──► STEP 2: Refetch Surviving Dirty Records (pending_delete == false)
  │         ├─► Process Status Decreases (consumed/discarded) ──► Free Server Capacity
  │         ├─► Process Metadata Edits ────────────────────────► Safe Soft-Ceiling
  │         └─► Process Creates & Reactivations ───────────────► apiClient.post/patch
  │               │
  │               ├─► Success ──► Clear pendingSync, clearQuotaError(clientId)
  │               └─► 409 ──────► setQuotaError(clientId), keep pendingSync=true, DO NOT THROW!
  │
  ├──► STEP 3: pullSince() Drainage Loop (Composite Cursor Seek)
  │         │
  │         ├─► Page 1: POST /records/sync (since: lastSyncAt)
  │         │     └─► Captures initialServerTime, changes, nextCursor, hasMore
  │         │
  │         └─► While hasMore: POST /records/sync (cursor: nextCursor)
  │               └─► Applies all records across equal-timestamp boundaries
  │
  └──► STEP 4: All Drained ──► saveLastSync(initialServerTime)
        │
        └──► Invalidate ['pantry-limits'] & ['usage']
```

---

## Related Code Files

- Create: `apps/mobile/src/utils/pantry-limits.ts`
- Create: `apps/mobile/src/features/records/record-counters.ts`
- Create: `apps/mobile/src/store/syncQuotaErrorsStore.ts`
- Create: `apps/mobile/tests/unit/pantry-limits-hook.test.tsx`
- Create: `apps/mobile/tests/unit/sync-quota-resilience.test.ts`
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/src/features/records/RecordCard.tsx`
- Modify: `apps/mobile/src/db/sync.ts`

---

## Implementation Steps

1. **Create `record-counters.ts`**:
   - Implement `useMyActiveRecordCount()` filtering `records` where `status = 'active'`, `pending_delete = false`, and `userId = currentUserId`.
2. **Update `RecordList.tsx`**:
   - Import `useMyActiveRecordCount()` and `usePantryLimits()`.
   - In `handleDuplicate`, check capacity and alert before creating draft.
   - In `handleSaveEdit`, verify capacity if duplicate draft.
   - In `onRefresh` (pull-to-refresh), invalidate `['pantry-limits']` and `['usage']`.
3. **Update `AddRecordForm.tsx` and `home.tsx`**:
   - In `home.tsx`, display capacity indicator in tab and header with color transition (Honey at 90%, Alert Red at 100%).
   - In `AddRecordForm.tsx`, pass `userId: currentUserId` into `createLocalRecord`.
   - Render warning banner at 90% and blocking banner at 100%.
4. **Refactor `pushPending()` & `pullSince()` in `sync.ts`**:
   - Add uncapped composite cursor loop in `pullSince()` using `nextCursor` while `hasMore === true`, maintaining cursor state in-memory.
   - Advance checkpoint `saveLastSync(initialServerTime)` only when `hasMore === false` has been reached cleanly.
   - Test disjoint workset: offline create then delete does not POST destroyed model.
   - Test PATCH restoration 409 isolation: rejected restore does not abort subsequent consumption updates or `pullSince`.
   - Test offline quota overflow followed by delete and successful retry.
   - Test composite cursor pagination drainage across equal-timestamp boundaries (1,005 items with identical timestamps).

---

## Success Criteria

- [ ] `RecordList.tsx` duplicate action blocked with native alert when at capacity, and stamps current user ID on created duplicate.
- [ ] Subtle capacity indicator in `home.tsx` displays active count and transitions color at 90% (Honey) and 100% (Alert Red).
- [ ] `RecordCard.tsx` displays visual indicator for records with pending sync quota rejections.
- [ ] Local active count accurately reflects the current user's creations across personal and household pantries.
- [ ] Offline creates and edits followed by offline deletion do not crash with destroyed model errors.
- [ ] 409 quota errors on both POST and PATCH are isolated and never wedge the sync loop.
- [ ] Delta synchronization drains deterministically over equal-timestamp page boundaries without dropping rows or imposing an arbitrary page cap.
- [ ] In-memory drainage prevents cross-account cursor leakage or stale resumption after sign-out / database reset.
- [ ] Incomplete delta drainage does not advance `lastSync` checkpoint.
- [ ] All Jest unit and resilience tests pass in `apps/mobile`.
