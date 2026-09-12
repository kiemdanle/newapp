---
title: "Mobile Connection Guard & Sync Loss Prevention"
description: "Dual-layer connection gating (client network + server health) on mobile startup and runtime, paired with a polished Facebook-style connection notice and automatic post-reconnection sync to eliminate local-server desynchronization."
status: in-progress
priority: P1
effort: "1.5d"
tags: ["mobile", "network", "sync", "offline", "ui-ux", "resilience"]
created: 2026-09-12
---

# Mobile Connection Guard & Sync Loss Prevention

## Overview

In the Expyrico mobile app, pantry inventory uses local WatermelonDB SQLite storage, while products, deals, giveaways, reviews, and household data rely on remote API queries. When the app is opened or operated without a verified, healthy server connection, users can perform local modifications or navigate stale screens. This leads to silent background sync failures, merge conflicts, and lost data synchronization between the user's device and the server ("sync lost problem").

This plan introduces a strict **Dual-Layer Connection Guard**:
1. **Client Network Check**: NetInfo verifies physical interface connectivity and internet reachability.
2. **Server Health Probe**: A lightweight probe to the Expyrico API (`/health` with a 4s timeout) ensures backend availability.
3. **App Startup & Runtime Interaction Gating**: Prevents interactive usage when disconnected, displaying a serene, Facebook-style full-screen connection notice with detailed status diagnostics ("Internet Offline" vs. "Server Unreachable") and a responsive "Try Again" retry button.
4. **Immediate Post-Reconnection Reconciliation**: Seamlessly triggers WatermelonDB `runSync()` and React Query invalidation upon connection restoration, guaranteeing consistent data state across client and server.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Prevent unsynced local mutations by verifying both client internet and server readiness before allowing app usage | P1 |
| 2 | Deliver a polished, Facebook-style connection loss notice with clear diagnostics, Expyrico theme compliance, and a "Try Again" retry CTA | P1 |
| 3 | Automatically reconcile local SQLite records and React Query caches as soon as connectivity is restored | P1 |
| 4 | Ensure zero false positives through resilient timeout handling, exponential retry backoff, and foreground AppState re-verification | P2 |

## Architecture & Data Flow

```
+-------------------------------------------------------------------------+
|                              App Startup                                |
+-------------------------------------------------------------------------+
                                     |
                                     v
                  +------------------------------------+
                  |     Initial Connection Probe       |
                  |  (NetInfo + GET /health 4s timeout)|
                  +------------------------------------+
                                     |
                    +----------------+----------------+
                    |                                 |
           [Success: Ready]                  [Failure: Disconnected]
                    |                                 |
                    v                                 v
   +---------------------------------+  +---------------------------------+
   |      Allow App Usage            |  |      Block App Usage            |
   | - Render RootNavigator          |  | - Display ConnectionNotice      |
   | - Trigger Initial runSync()     |  |   (Facebook-style card/overlay) |
   | - Normal React Query operations |  | - Show "Try Again" Button       |
   +---------------------------------+  | - Show Diagnostic Status        |
                    ^                   +---------------------------------+
                    |                                 |
                    | User taps "Try Again" or        |
                    | NetInfo/AppState detects online |
                    +---------------------------------+
```

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Dual-Layer Connection & Server Health Engine](./phase-01-start.md) | In Progress |
| 2 | [Phase 2: Facebook-Style Connection Loss Notice & App-Level Gating](./phase-02-facebook-style-connection-loss-notice-and-gating.md) | Pending |
| 3 | [Phase 3: Post-Reconnection State Synchronization, Lifecycle Triggers & Verification](./phase-03-post-reconnection-sync-and-verification.md) | Pending |

## Success Criteria

- [ ] App blocks interaction on boot if device has no internet or Expyrico server is unreachable.
- [ ] Facebook-style connection loss notice displays with clear visual badge, diagnostic status, and "Try Again" retry button.
- [ ] Notice dynamically respects Expyrico color palette in both Dark and Light themes.
- [ ] Tapping "Try Again" triggers immediate re-verification with loading spinner feedback.
- [ ] Restoring connection automatically dismisses the notice, initiates WatermelonDB `runSync()`, and refreshes React Query caches.
- [ ] All unit and integration tests pass with 100% type safety.
- [ ] Tested and verified on physical Android device via ADB.

## Validation Log

### Session 1 — 2026-09-12
**Trigger:** Post-plan validation interview to confirm architecture, gating UX, readiness endpoints, and reconnection sync.
**Questions asked:** 4

### Verification Results
- Claims checked: 10
- Verified: 10 | Failed: 0 | Unverified: 0
- Tier: Standard
- Key verified anchors:
  - `@react-native-community/netinfo` (11.4.1) installed in `apps/mobile/package.json:28`.
  - `api/src/routes/health.ts` defines `GET /health` and deep `GET /health/ready`.
  - `apps/mobile/src/api/client.ts` exports `getBaseUrl()`.
  - `apps/mobile/src/db/sync.ts` exports `runSync()`.
  - `apps/mobile/src/App.tsx` controls boot splash via `splashReady` and sync triggers via `startSyncTriggers()`.

#### Questions & Answers

1. **[Architecture / Gating UX]** When connection is lost during active app usage, how should the UI guard user interaction?
   - Options: Full-screen blocking overlay (Facebook style) (Recommended) | Persistent top banner + write disabling | Read-only modal guard
   - **Answer:** Full-screen blocking overlay (Facebook style)
   - **Rationale:** Immediate full-screen blocking overlay eliminates any opportunity for local edits or stale screen mutations to diverge from the server, satisfying the primary goal of preventing lost sync.

2. **[Architecture / Server Probe]** Which server endpoint should the mobile client probe to verify backend readiness?
   - Options: GET /health (Lightweight Process Ping) (Recommended) | GET /health/ready (Deep DB & Redis Readiness) | GET /v1/me (Server + Session Validity)
   - **Answer:** GET /health/ready (Deep DB & Redis Readiness)
   - **Rationale:** Probing `/health/ready` ensures both database (PostgreSQL) and cache (Redis) layers are fully ready to accept writes, preventing the client from attempting sync against a booting or migrating database.

3. **[Tradeoffs / Auto-Retry]** How should the app attempt automatic reconnection while the error notice is displayed?
   - Options: Event-driven + Exponential Backoff Timer (Recommended) | Pure Event-Driven + Manual Only | Fixed 10s Polling
   - **Answer:** Pure Event-Driven + Manual Only
   - **Rationale:** Avoids constant background polling that drains mobile battery while offline. Reconnects promptly on NetInfo network changes, AppState foreground switches, and direct user "Try Again" taps.

4. **[Scope / Post-Reconnect Sync]** What sync actions should run immediately when connection transitions back to ready?
   - Options: Run WatermelonDB Sync + Invalidate React Query Caches (Recommended) | Sync + Floating 'Connected' Toast | WatermelonDB Sync Only
   - **Answer:** Run WatermelonDB Sync + Invalidate React Query Caches
   - **Rationale:** Instantly reconciles SQLite pantry items via `runSync()` and invalidates React Query caches so remote screens (Deals, Giveaways, Contributions, Reviews) refresh with fresh server data.

#### Confirmed Decisions
- **Gating Mechanism:** Full-screen modal barrier component (`ConnectionNotice.tsx`) anchored at root level in `App.tsx`.
- **Backend Probe URL:** `${getBaseUrl()}/health/ready` with a 4-second timeout via `AbortController`.
- **Reconnection Triggers:** NetInfo `change` event, AppState `active` event, and "Try Again" CTA press.
- **Reconnection Workflow:** Transition state to `ready` -> dismiss overlay -> call `runSync()` -> `queryClient.invalidateQueries()`.

### Whole-Plan Consistency Sweep
- Zero unresolved contradictions across all phases.
- Updated `/health` references in Phase 1 & 2 to `/health/ready`.
- Confirmed pure event-driven + manual retry model in Phase 1 & 3 (timer polling removed).

<!-- slug: mobile-connection-guard-sync-loss-prevention -->
