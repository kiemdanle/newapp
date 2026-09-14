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
      - `reset: () => void` (resets `isSyncing = false`, `initialSyncCompleted = false`, `lastSyncError = null`).
    - **Session-Scoped Reset Contract**:
      - Hook `useSyncStateStore.getState().reset()` into `clearAllLocalUserData()` and `signIn()` in `session-store.ts`.
      - Guarantees that when a second user signs in, `initialSyncCompleted` is re-armed as `false` so the new user sees the shimmering skeleton instead of an empty pantry flash.
      - **Scope Switch Preservation**: Do NOT invoke `reset()` on local household scope changes (`usePantryScope.setScope`). Local scope changes perform instant in-memory SQLite queries over already-synced household data; re-arming the skeleton on scope switch would needlessly block empty households behind the 4-second timeout.
  - Sync Lifecycle Integration (`apps/mobile/src/db/sync.ts`):
    - Update `runSync()` to set `isSyncing = true` at start, and `isSyncing = false` / `initialSyncCompleted = true` in `finally`.
    - Catch errors and record `lastSyncError`.
  - `PantryListSkeleton.tsx`:
    - Renders a mock list/grid of 5–6 items wrapped in `SkeletonShimmer`:
      - If `viewMode === 'grid'`: renders 3 rows of 2-column `PantryGridCardSkeleton`.
      - If `viewMode === 'list'`: renders 5 stacked `RecordCardSkeleton` rows.
    - Matches list container padding, margin, and gap tokens exactly.
  - `RecordList.tsx` Integration & Chrome Shift Prevention:
    - Compute `isInitialSyncLoading = !initialSyncCompleted && records.length === 0`.
    - While `isInitialSyncLoading` is true, render `PantryListSkeleton` in place of the list items and suppress the `"Start your pantry"` empty state card.
    - **List Chrome Shift Prevention**: Always render `renderControls()` (search bar, sort pills) above `PantryListSkeleton` in an inactive/skeleton state. This pre-allocates the control space on Frame 0, preventing the search bar and sort row from popping in and pushing items down when records sync, ensuring zero layout shift.
    - Once sync settles:
      - If records were received, render them with smooth opacity transition.
      - If records are genuinely 0, render the empty pantry card.
  - **Deterministic Centralized 4-Second Timeout & SyncStatusBar**:
    - The 4,000ms fail-safe timer lives directly in `useSyncStateStore`, started on session initialization.
    - If sync does not settle within 4,000ms (whether due to offline status, slow connection, or server error):
      - `initialSyncCompleted` flips to `true` and `lastSyncError = 'timeout'`.
      - Guarantees a deterministic exit across ALL views (`RecordList`, `PantryHistoryView`, etc.) even if `PantryHistoryView` is opened first.
      - Gracefully unmasks the skeleton to display the empty state with an inline `SyncStatusBar` pill ("Offline · Showing cached items" / "Syncing in background...").
  - **Scoped Query Generation Invalidation** (`apps/mobile/src/api/records.ts`):
    - In `useActiveRecords()`, track an internal query generation key per `[scope, householdId]`.
    - When scope changes, invalidate previous records immediately so Android's asynchronous SQLite dispatcher does not display stale cards from the previous household during scope transitions.
  - Zero UI thread blocking.
  - Resilient to offline startup (deterministic store-level timer prevents infinite loading locks).

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
  - `apps/mobile/src/api/records.ts` (scope query generation tracking)
  - `apps/mobile/src/db/sync.ts`
  - `apps/mobile/src/features/records/RecordList.tsx`
  - `apps/mobile/src/auth/session-store.ts` (hook store reset and attachment purge in `clearAllLocalUserData`)
  - `apps/mobile/src/features/records/record-photo-storage.ts` (export `clearAllRecordPhotoAttachments`)

## Implementation Steps
1. Create `syncStateStore.ts`:
   - Implement Zustand store with `isSyncing`, `initialSyncCompleted`, `lastSyncError`, and `reset()`.
   - Add centralized 4,000ms timeout timer that forces `initialSyncCompleted = true` and `lastSyncError = 'timeout'` if sync takes longer than 4s.
2. Update `session-store.ts` and `record-photo-storage.ts`:
   - Export `clearAllRecordPhotoAttachments()` in `record-photo-storage.ts`.
   - Wire `useSyncStateStore.getState().reset()` and `clearAllRecordPhotoAttachments()` inside `clearAllLocalUserData()` and on `signIn()`.
3. Update `api/records.ts`:
   - Add query generation tracking to `useActiveRecords()` on `[scope, householdId]` changes.
4. Update `sync.ts`:
   - Import `syncStateStore` and hook into `runSync()` start, completion, and error handlers with session-generation validation.
5. Create `SyncStatusBar.tsx`:
   - Minimal theme-aware status chip for offline / background sync states.
6. Create `PantryListSkeleton.tsx`:
   - Render 5 `RecordCardSkeleton` items (list) or 6 `PantryGridCardSkeleton` items in a 2-column flex matrix (grid).
   - Pre-allocate search/filter control slots to prevent layout shift.
   - Wrap in `SkeletonShimmer`.
7. Update `RecordList.tsx`:
   - Subscribe to `useSyncStateStore`.
   - If `!initialSyncCompleted && records.length === 0`, render `PantryListSkeleton` below reserved controls.
   - Render `SyncStatusBar` when `lastSyncError === 'timeout'` or background sync is active.
8. Create `tests/unit/pantry-list-skeleton.test.tsx`:
   - Test that `RecordList` renders `PantryListSkeleton` when `initialSyncCompleted === false` and `records === []`.
   - Test that `useSyncStateStore` forces `initialSyncCompleted = true` at 4,000ms, unmasking the empty state.
   - Test that `RecordList` renders real records when sync completes without layout shifts.
   - Test scope transition query invalidation.
## Success Criteria
- [ ] On fresh install / sign-in with cold cache, users see shimmering skeleton cards immediately instead of `"Start your pantry"`.
- [ ] No sudden disappearing-and-reappearing UI flash when items sync down from server.
- [ ] If the phone is offline, the skeleton gracefully times out to the offline banner and empty state within 4 seconds.
- [ ] Unit tests pass with 100% assertions satisfied.

## Risk Assessment
- **Risk**: Device with slow connection triggers 4-second timeout while sync is still in-flight.
  - *Observable Signal*: Empty state flashes briefly at 4 seconds with syncing banner, followed by items rendering when sync finishes.
  - *Pre-decided Response*: Deterministic 4-second store-level timeout unmasks to empty state with a subtle "Syncing in background..." indicator; items smoothly append via WatermelonDB subscription when sync finishes without freezing user interaction.
