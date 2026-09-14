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
  - `RecordList.tsx` Integration:
    - Compute `isInitialSyncLoading = !initialSyncCompleted && records.length === 0`.
    - While `isInitialSyncLoading` is true, render `PantryListSkeleton` in place of the list items and suppress the `"Start your pantry"` empty state card.
    - Once sync settles:
      - If records were received, render them with smooth opacity transition.
      - If records are genuinely 0, render the empty pantry card.
  - Fail-Safe Timeout:
    - If `isInitialSyncLoading` persists for longer than 4,000ms (e.g. offline device or server 5xx), automatically flip a timeout fallback to reveal the genuine empty state with an offline banner, preventing infinite loading locks.
- **Non-functional**:
  - Zero UI thread blocking.
  - Resilient to offline startup (detects NetInfo connection and respects timeout).

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
  - `apps/mobile/tests/unit/pantry-list-skeleton.test.tsx`
- Modify:
  - `apps/mobile/src/db/sync.ts`
  - `apps/mobile/src/features/records/RecordList.tsx`
  - `apps/mobile/src/auth/session-store.ts` (hook store reset in `clearAllLocalUserData`)
## Implementation Steps
1. Create `syncStateStore.ts`:
   - Implement Zustand store with `isSyncing`, `initialSyncCompleted`, `lastSyncError`, and `reset()`.
2. Update `session-store.ts`:
   - Wire `useSyncStateStore.getState().reset()` inside `clearAllLocalUserData()` and `signIn()`.
3. Update `sync.ts`:
   - Import `syncStateStore` and hook into `runSync()` start, completion, and error handlers.
3. Create `PantryListSkeleton.tsx`:
   - Render 5 `RecordCardSkeleton` items (list) or 6 `PantryGridCardSkeleton` items in a 2-column flex matrix (grid).
   - Wrap in `SkeletonShimmer`.
4. Update `RecordList.tsx`:
   - Subscribe to `useSyncStateStore`.
   - If `!initialSyncCompleted && records.length === 0`, render `PantryListSkeleton` inside the list body below the header.
   - Add `useEffect` 4-second timeout to force `initialSyncCompleted` if network takes too long.
5. Create `tests/unit/pantry-list-skeleton.test.tsx`:
   - Test that `RecordList` renders `PantryListSkeleton` when `initialSyncCompleted === false` and `records === []`.
   - Test that `RecordList` switches to real records when sync completes.
   - Test that `RecordList` renders the empty card only when `initialSyncCompleted === true` and `records === []`.

## Success Criteria
- [ ] On fresh install / sign-in with cold cache, users see shimmering skeleton cards immediately instead of `"Start your pantry"`.
- [ ] No sudden disappearing-and-reappearing UI flash when items sync down from server.
- [ ] If the phone is offline, the skeleton gracefully times out to the offline banner and empty state within 4 seconds.
- [ ] Unit tests pass with 100% assertions satisfied.

## Risk Assessment
- **Risk**: Device with slow 2G connection triggers 4-second timeout while sync is still downloading 500+ items.
  - *Observable Signal*: Empty state flashes briefly at 4 seconds, followed by items popping in at 6 seconds.
  - *Pre-decided Response*: Only trigger timeout if `NetInfo` reports offline; otherwise, extend timeout to 8 seconds on slow connections.
