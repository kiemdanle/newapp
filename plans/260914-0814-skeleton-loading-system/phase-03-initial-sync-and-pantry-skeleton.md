---
phase: 3
title: "Initial Sync State Tracking & Pantry View Skeletons"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-skeleton-primitives", "phase-02-thumbnail-and-card-loading"]
---

# Phase 3: Initial Sync State Tracking & Pantry View Skeletons

## Overview
Eliminate premature empty state flashes (`"Start your pantry"`) during fresh app installs, new device sign-ins, or cold cache boots. Introduce an observable `useSyncStateStore` that tracks initial synchronization progress, and integrate `PantryListSkeleton` into `RecordList` so users see polished shimmering cards while their pantry items sync from the server.

## Requirements
- **Functional**:
  - `useSyncStateStore`:
    - Zustand store tracking:
      - `isSyncing: boolean` (true while `runSync()` is pulling/pushing).
      - `initialSyncCompleted: boolean` (false on app launch; becomes true after the first `runSync()` settles).
      - `lastSyncError: string | null`.
      - `beginInitialSync: () => void`:
        - Idempotent: no-op if `initialSyncCompleted` is already true or timer is already active.
        - Unconditionally arms a 4,000ms timer that forces `initialSyncCompleted = true` and `lastSyncError = 'timeout'` if sync has not settled within 4s.
        - Guarantees that offline launches exit the skeleton even when `runSync()` cannot execute.
      - `reset: () => void`:
        - Clears any pending timer (`clearTimeout(timerRef)`).
        - Resets `isSyncing = false`, `initialSyncCompleted = false`, `lastSyncError = null`.
    - **Explicit Caller & Ordering Contract (`AppSyncManager` in `App.tsx`)**:
      - `AppSyncManager` calls `useSyncStateStore.getState().beginInitialSync()` *unconditionally* whenever `accessToken` is present, BEFORE `startSyncTriggers()` and before the `connectionStore.status === 'ready'` network check.
      - Guarantees the deadline starts immediately upon session restoration, regardless of connectivity status.
    - **Session-Scoped Reset Contract**:
      - Hook `useSyncStateStore.getState().reset()` into `clearAllLocalUserData()` and `signIn()` in `session-store.ts`.
      - Guarantees that when a second user signs in, `initialSyncCompleted` is re-armed as `false` so the new user sees the shimmering skeleton instead of an empty pantry flash.
      - **Scope Switch Preservation**: Do NOT invoke `reset()` on local household scope changes (`usePantryScope.setScope`). Local scope changes perform instant in-memory SQLite queries over already-synced household data; re-arming the skeleton on scope switch would needlessly block empty households behind the 4-second timeout.
  - Sync Lifecycle Integration & Cross-Session Isolation (`apps/mobile/src/db/sync.ts`):
    - Track `currentSyncEpoch = 0` and `pendingSyncRequestedEpoch: number | null = null`.
    - Provide `invalidateSyncEpoch()`: increments `currentSyncEpoch++` and clears pending sync flags. Hook into `clearAllLocalUserData()` and `signIn()` in `session-store.ts`.
    - **Pre-Mutation Stale Checks**: In `pushPending(runEpoch)` and `pullSince(runEpoch)`:
      - Capture `runEpoch` at the start of `runSync()`.
      - Check `if (runEpoch !== currentSyncEpoch) return;` immediately before every post-await database/storage mutation (inside `database.write`, before calling `apiClient.delete` or writing to SQLite, and at the entry of `applySyncChanges()`).
      - Completely prevents old-session API responses from writing into a newly signed-in user's wiped database.
    - **Queued Generation Recovery**:
      - If `runSync()` is invoked while `syncing === true` (e.g. `signIn()` or `AppSyncManager` triggers during an active await), store `pendingSyncRequestedEpoch = currentSyncEpoch`.
      - In `finally`: release `syncing = false`. If `pendingSyncRequestedEpoch !== null && pendingSyncRequestedEpoch === currentSyncEpoch`, clear the flag and immediately schedule `void runSync()`.
      - Guarantees the newly signed-in user's sync is never dropped or starved by an aborted previous-session run, avoiding timeout false alarms.
    - Update `useSyncStateStore` on settle: `setSyncSuccess()` / `setSyncError()`, updating `initialSyncCompleted = true`.
  - `PantryListSkeleton.tsx`:
    - Renders a mock list/grid of 5–6 items wrapped in `SkeletonShimmer`:
      - If `viewMode === 'grid'`: renders 3 rows of 2-column `PantryGridCardSkeleton`.
      - If `viewMode === 'list'`: renders 5 stacked `RecordCardSkeleton` rows.
    - Matches list container padding, margin, and gap tokens exactly.
  - `RecordList.tsx` Integration & Scope Resolution Gating:
    - Consume `useActiveRecordsWithStatus()`:
      ```tsx
      const { records, isLoading: isRecordsLoading, isResolved: isRecordsResolved } = useActiveRecordsWithStatus();
      const isInitialSyncLoading = !initialSyncCompleted && records.length === 0;
      const isScopeQueryPending = !isRecordsResolved;
      const showListSkeleton = isInitialSyncLoading || isScopeQueryPending;
      ```
    - While `showListSkeleton` is true, render `PantryListSkeleton` in place of the list items and suppress the `"Start your pantry"` empty state card.
    - **List Chrome Shift Prevention**: Always render `renderControls()` (search bar, sort pills) above `PantryListSkeleton` in an inactive/skeleton state. This pre-allocates the control space on Frame 0, preventing the search bar and sort row from popping in and pushing items down when records sync, ensuring zero layout shift.
    - Once sync settles AND `isRecordsResolved` is true:
      - If records were received (`records.length > 0`), render them with smooth opacity transition.
      - If records are genuinely 0, render the empty pantry card.
  - **Deterministic Centralized 4-Second Timeout & SyncStatusBar**:
    - The 4,000ms fail-safe timer lives directly in `useSyncStateStore`, started on session initialization.
    - If sync does not settle within 4,000ms (whether due to offline status, slow connection, or server error):
      - `initialSyncCompleted` flips to `true` and `lastSyncError = 'timeout'`.
      - Guarantees a deterministic exit across ALL views (`RecordList`, `PantryHistoryView`, etc.) even if `PantryHistoryView` is opened first.
      - Gracefully unmasks the skeleton to display the empty state with an inline `SyncStatusBar` pill ("Offline · Showing cached items" / "Syncing in background...").
  - **Scoped Query Generation & Status Discrimination** (`apps/mobile/src/api/records.ts`):
    - Export `useActiveRecordsWithStatus(): { records: LocalRecord[]; isLoading: boolean; isResolved: boolean }`.
    - Preserve backward compatibility: export `useActiveRecords(): LocalRecord[] => useActiveRecordsWithStatus().records`.
    - In `useActiveRecordsWithStatus()`, track an internal query generation key `queryKey = `${scope}:${householdId ?? 'none'}`;`.
    - On scope change, reset `isResolved = false` and `isLoading = true` immediately, preventing Android's asynchronous SQLite dispatcher from displaying stale cards or premature empty flashes during scope transitions.
- **Non-functional**:
  - Zero UI thread blocking.
  - Resilient to offline startup (deterministic store-level timer prevents infinite loading locks).
  - Backward compatibility: existing `useActiveRecords()` callers remain 100% functional without changes.

## Architecture

```
+-----------------------------------------------------------------+
|                       Mobile App Launch                         |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                      AppSyncManager                             |
|  - Triggers runSync() on startup                                |
|  - Sets useSyncStateStore.isSyncing = true                      |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                      RecordList Component                       |
|  - records.length === 0 && !initialSyncCompleted                |
|  +-----------------------------------------------------------+  |
|  |  TRUE  -> Render <PantryListSkeleton viewMode={viewMode} />|  |
|  +-----------------------------------------------------------+  |
|  +-----------------------------------------------------------+  |
|  |  FALSE -> Render real SectionList items or genuine empty  |  |
|  +-----------------------------------------------------------+  |
+-----------------------------------------------------------------+
```

## Related Code Files
- Create:
  - `apps/mobile/src/store/syncStateStore.ts`
  - `apps/mobile/src/features/records/PantryListSkeleton.tsx`
  - `apps/mobile/src/components/SyncStatusBar.tsx`
  - `apps/mobile/tests/unit/pantry-list-skeleton.test.tsx`
- Modify:
  - `apps/mobile/src/App.tsx` (call `beginInitialSync()` in `AppSyncManager` before `startSyncTriggers()`)
  - `apps/mobile/src/api/records.ts` (scope query generation tracking)
  - `apps/mobile/src/db/sync.ts`
  - `apps/mobile/src/features/records/RecordList.tsx`
  - `apps/mobile/src/auth/session-store.ts` (hook store reset and attachment purge in `clearAllLocalUserData`)
  - `apps/mobile/src/features/records/record-photo-storage.ts` (export `clearAllRecordPhotoAttachments`)
## Implementation Steps
1. Create `syncStateStore.ts`:
   - Implement Zustand store with `isSyncing`, `initialSyncCompleted`, `lastSyncError`, `beginInitialSync()`, and `reset()`.
   - Add centralized 4,000ms timeout timer that forces `initialSyncCompleted = true` and `lastSyncError = 'timeout'` if sync takes longer than 4s.
   - Ensure `beginInitialSync()` is idempotent and safe to invoke multiple times.
2. Update `apps/mobile/src/App.tsx`:
   - In `AppSyncManager`, call `useSyncStateStore.getState().beginInitialSync()` unconditionally when `accessToken` exists, before `startSyncTriggers()`.
3. Update `session-store.ts` and `record-photo-storage.ts`:
   - Export `clearAllRecordPhotoAttachments()` in `record-photo-storage.ts`.
   - Wire `useSyncStateStore.getState().reset()` and `clearAllRecordPhotoAttachments()` inside `clearAllLocalUserData()` and on `signIn()`.
4. Update `api/records.ts`:
   - Implement and export `useActiveRecordsWithStatus()` with query generation key tracking (`[scope, householdId]`).
   - Retain `useActiveRecords()` as a convenience wrapper returning `.records` for complete backward compatibility with other callers (`UseNextHero`, modals, existing tests).
5. Update `sync.ts`:
   - Import `syncStateStore` and hook into `runSync()` start, completion, and error handlers with session-generation validation.
   - Implement `currentSyncEpoch`, `pendingSyncRequestedEpoch`, and export `invalidateSyncEpoch()`.
   - Add stale checks before every post-await mutation in `pushPending` and `applySyncChanges`.
   - Implement queued generation trigger in `finally` when `pendingSyncRequestedEpoch === currentSyncEpoch`.
6. Create `SyncStatusBar.tsx`:
   - Minimal theme-aware status chip for offline / background sync states.
7. Create `PantryListSkeleton.tsx`:
   - Render 5 `RecordCardSkeleton` items (list) or 6 `PantryGridCardSkeleton` items in a 2-column flex matrix (grid).
   - Pre-allocate search/filter control slots to prevent layout shift.
   - Wrap in `SkeletonShimmer`.
8. Update `RecordList.tsx`:
   - Consume `useActiveRecordsWithStatus()`.
   - Compute: `const showListSkeleton = (!initialSyncCompleted && records.length === 0) || !isRecordsResolved;`.
   - Render `PantryListSkeleton` while `showListSkeleton` is true.
   - Render `SyncStatusBar` when `lastSyncError === 'timeout'` or background sync is active.
9. Create `tests/unit/pantry-list-skeleton.test.tsx`:
   - Test that `RecordList` renders `PantryListSkeleton` when `initialSyncCompleted === false` and `records === []`.
   - Test that `useSyncStateStore` forces `initialSyncCompleted = true` at 4,000ms, unmasking the empty state.
   - Test cold-restored session in offline mode: verify `beginInitialSync()` arms the 4,000ms timer, `runSync()` is not invoked, and at 4,000ms `initialSyncCompleted` flips to `true` and unmasks the empty state with `SyncStatusBar`.
   - Test that `RecordList` renders real records when sync completes without layout shifts.
   - Test scope transition query invalidation and `useActiveRecordsWithStatus` transitions.
## Success Criteria
- [ ] On fresh install / sign-in with cold cache, users see shimmering skeleton cards immediately instead of `"Start your pantry"`.
- [ ] No sudden disappearing-and-reappearing UI flash when items sync down from server.
- [ ] If the phone is offline, the skeleton gracefully times out to the offline banner and empty state within 4 seconds.
- [ ] Unit tests pass with 100% assertions satisfied.

## Risk Assessment
- **Risk**: Device with slow connection triggers 4-second timeout while sync is still in-flight.
  - *Observable Signal*: Empty state flashes briefly at 4 seconds with syncing banner, followed by items rendering when sync finishes.
  - *Pre-decided Response*: Deterministic 4-second store-level timeout unmasks to empty state with a subtle "Syncing in background..." indicator; items smoothly append via WatermelonDB subscription when sync finishes without freezing user interaction.
