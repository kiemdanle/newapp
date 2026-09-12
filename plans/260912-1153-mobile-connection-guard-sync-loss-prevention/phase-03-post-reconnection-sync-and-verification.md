---
phase: 3
title: "Post-Reconnection State Synchronization, Lifecycle Triggers & Verification"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-start.md", "phase-02-facebook-style-connection-loss-notice-and-gating.md"]
---

# Phase 3: Post-Reconnection State Synchronization, Lifecycle Triggers & Verification

## Overview
Wire automatic data reconciliation into the reconnection lifecycle so that transitioning from disconnected to `ready` immediately triggers WatermelonDB `runSync()` and React Query cache invalidation. Complete full-stack verification via unit tests, typechecks, Gradle Android APK build, and on-device testing.

## Requirements
- Functional:
  - When connection status transitions from `offline | server_unreachable` to `ready`:
    - Dismiss `ConnectionNotice` smoothly.
    - Immediately execute `runSync()` to sync local SQLite pantry records with the backend. <!-- Updated: Validation Session 1 - Run WatermelonDB sync on reconnect -->
    - Invalidate React Query caches (`queryClient.invalidateQueries({ queryKey: ['records'] })`, etc.) so remote feeds (Deals, Giveaways, Contributions, Reviews) refresh fresh data. <!-- Updated: Validation Session 1 - Invalidate React Query caches on reconnect -->
  - Listen for AppState changes:
    - When user foregrounds the app (`change` -> `active`), execute an immediate connection health check.
    - If connection was lost while backgrounded, immediately transition to disconnected state before user can perform stale writes.
  - Clean lifecycle teardown on unmount.
- Non-functional:
  - Idempotent sync execution: guard against concurrent overlapping sync invocations (`syncing` lock in `sync.ts`).
  - No infinite loop or thrashing if server is unstable.
  - Zero TypeScript errors (`tsc --noEmit` exits 0 across all workspaces).
  - Clean local Gradle build and ADB installation.

## Architecture
- `apps/mobile/src/db/triggers.ts` & `apps/mobile/src/App.tsx`:
  - Hook `connectionStore.subscribe` to trigger `runSync()` and `queryClient.invalidateQueries()` on `ready` transitions.
  - Wire AppState listener into `connection-service` for automatic foreground health checks.
- Build & Verification:
  - Run full repo typecheck: `pnpm --filter @expyrico/shared typecheck && pnpm --filter api typecheck && pnpm --filter mobile typecheck`.
  - Run test suite: `pnpm --filter mobile test connection`.
  - Build Android APK via local Gradle toolchain and install on device via ADB:
    `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
    `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  - Exercise on physical device: toggle airplane mode / simulate offline, verify connection notice, tap retry, verify instant recovery and sync.

## Related Code Files
- Modify:
  - `apps/mobile/src/db/triggers.ts` (unify NetInfo triggers with `connectionStore`)
  - `apps/mobile/src/App.tsx` (wire sync and cache invalidation on connection restoration)
- Create:
  - `apps/mobile/src/__tests__/connection-sync-lifecycle.test.ts`

## Implementation Steps
1. Update `db/triggers.ts`:
   - Connect `connectionStore` state transitions to `runSync()`.
   - Ensure reconnection triggers both WatermelonDB sync and React Query query invalidation.
2. Wire AppState foreground listener to `connectionStore.checkConnection()`.
3. Add integration tests in `connection-sync-lifecycle.test.ts` verifying that going from offline -> ready fires `runSync()` and query invalidations.
4. Run full typechecks and unit tests.
5. Build and install Android APK on physical device, capturing screenshots of the disconnected notice and post-reconnection active state.

## Success Criteria
- [ ] Recovering from disconnected state automatically triggers `runSync()` without requiring app restart.
- [ ] React Query caches refresh fresh data upon reconnection.
- [ ] AppState transition to `active` immediately verifies backend connectivity.
- [ ] All unit, component, and integration tests pass.
- [ ] Clean Android Gradle build and installation on connected device (`96d9c774`).
- [ ] Live device screencap confirms Facebook-style connection loss notice when network is disabled, and clean dismissal when network is restored.

## Risk Assessment
- **Risk**: Repeated rapid connection state flips (e.g. driving through a tunnel) causing a thundering herd of sync calls.
  - **Mitigation**: `runSync()` already contains an in-flight `if (syncing) return;` guard. Add a minimum 5-second cooldown debounce between automatic reconnection sync triggers.
