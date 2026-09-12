---
phase: 1
title: "Dual-Layer Connection & Server Health Engine"
status: in-progress
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Dual-Layer Connection & Server Health Engine

## Overview
Implement the core network reachability and server readiness verification service and state store in `apps/mobile`, combining physical network interface status from `@react-native-community/netinfo` with a lightweight, timeout-guarded HTTP health probe to the Expyrico backend server.

## Requirements
- Functional:
  - Check client internet connectivity via `NetInfo.fetch()` and `NetInfo.addEventListener`.
  - Check backend server availability via HTTP `GET ${getBaseUrl()}/health/ready` with a 4-second timeout using `AbortController` (verifies both Prisma DB and Redis readiness). <!-- Updated: Validation Session 1 - Use /health/ready -->
  - Disambiguate failure reasons: `offline` (no client internet connection) vs. `server_unreachable` (internet connected, but server returned error, 503, connection refused, or timed out).
  - Expose a centralized Zustand connection store (`connectionStore.ts`) tracking `status` (`'checking' | 'ready' | 'offline' | 'server_unreachable'`), `isRetrying`, `clientOnline`, `serverReady`, and `lastCheckedAt`.
  - Provide an explicit `retry()` action returning a promise that re-runs both checks with UI loading feedback.
- Non-functional:
  - Resilient to slow network; abort timeout defaults to 4000ms to avoid blocking users indefinitely.
  - Pure event-driven + manual retry model: no battery-draining timer polling; only probe on startup, NetInfo network recovery, AppState foreground transition (`active`), or manual user "Try Again" tap. <!-- Updated: Validation Session 1 - Pure event-driven retry -->
  - 100% type-safe with unit test coverage.

## Architecture
- `apps/mobile/src/services/network/connection-service.ts`:
  - `probeServerHealth(timeoutMs = 4000): Promise<boolean>` (probes `/health/ready`, checking status === 'ready')
  - `evaluateConnection(): Promise<ConnectionEvaluationResult>`
  - Dispatches to `getBaseUrl()` without auth headers.
- `apps/mobile/src/store/connectionStore.ts`:
  - Zustand store managing reactive connection state across the application.
  - Keeps listeners for `NetInfo` and exposes `checkConnection()` and `retry()`.

## Related Code Files
- Create:
  - `apps/mobile/src/services/network/connection-service.ts`
  - `apps/mobile/src/store/connectionStore.ts`
  - `apps/mobile/src/services/network/__tests__/connection-service.test.ts`
  - `apps/mobile/src/store/__tests__/connectionStore.test.ts`
- Modify:
  - `api/src/routes/health.ts` (ensure `/health` route is fast, unauthenticated, and CORS/header ready)
  - `apps/mobile/src/api/client.ts` (export `getBaseUrl` cleanly if needed)

## Implementation Steps
1. Create `connection-service.ts`:
   - Implement `probeServerHealth(baseUrl, timeoutMs)` using `fetch` with `AbortController` against `/health/ready`.
   - Implement `evaluateConnection()` combining `NetInfo.fetch()` and `probeServerHealth()`.
2. Create `connectionStore.ts`:
   - Define state interface: `status`, `isRetrying`, `clientOnline`, `serverReady`, `lastCheckedAt`, `errorDetail`.
   - Implement `initConnectionMonitoring()`, `checkConnection()`, and `retry()`.
3. Verify backend `/health` endpoint compatibility with mobile client.
4. Write unit tests for `connection-service.ts` and `connectionStore.ts` with mock NetInfo and mock fetch responses.

## Success Criteria
- [x] `evaluateConnection()` accurately identifies online + server ready as `ready`.
- [x] `evaluateConnection()` accurately distinguishes between device offline (`offline`) and backend down (`server_unreachable`).
- [x] Health probe aborts and fails safely after 4 seconds on unresponsive networks.
- [x] Zustand store reflects immediate updates during manual retries.
- [x] Unit tests pass for all connection scenarios (online, offline, server down, server timeout).

## Risk Assessment
- **Risk**: Unstable or slow mobile cell connections (e.g. 3G/Edge) timing out on `/health`.
  - **Mitigation**: Use a 4s timeout (sufficient for a lightweight ~20-byte `/health` ping) and allow manual "Try Again" without delay.
- **Risk**: Device captive portals (e.g. hotel Wi-Fi) returning 200 HTML on any URL.
  - **Mitigation**: Validate JSON response payload (`status === 'ready'`) rather than just checking HTTP 200.
