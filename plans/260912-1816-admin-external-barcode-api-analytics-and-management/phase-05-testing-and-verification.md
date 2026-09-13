---
phase: 5
title: "Automated Testing & End-to-End Verification"
status: pending
priority: P1
effort: "6h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Automated Testing & End-to-End Verification

<!-- Updated: Advisor Review - Added PATCH partial merge & retention preservation test -->

## Overview
Validate the entire barcode API tracking, analytics, and management system through comprehensive automated tests, strict typechecking, and live end-to-end verification across `@expyrico/shared`, `api`, and `apps/admin`. This phase guarantees that high-volume tracking never degrades user lookups, analytical queries compute accurate percentiles and time-series buckets, durable Redis quota limits are strictly enforced under concurrency and survive process restarts, partial PATCH updates safely preserve retention configuration, and administrative actions function reliably.

## Requirements
- **Functional:**
  - **Shared Schema Tests:** Validate all Zod schemas in `barcode-api.test.ts` with valid and edge-case inputs (invalid statuses, negative latencies, malformed ranges, detail diagnostic schemas). Assert that `barcodeApiConfigPatchSchema.parse({})` leaves `retentionDays` as `undefined` rather than injecting a default `30`.
  - **Tracker Service Tests (`barcode-api-tracker.test.ts`):** Verify micro-batching flush (flush on 25 items or 1s timer), verify database errors are safely swallowed without throwing, and verify log retention pruning.
  - **Provider Settings Tests (`barcode-provider-settings.test.ts`):**
    - Verify durable Redis-backed `reserveDailyQuota` atomically denies the 101st request when 2 concurrent requests race at `limit - 1 = 99`.
    - Verify process restart persistence (new process instance reads correct existing Redis count).
    - Verify Redis outage fail-open policy (returns `granted: true` with warning, does not block scans).
    - Verify execution order: cooldown check runs FIRST, and `cooldown_skipped` events never consume quota.
    - Verify partial PATCH merge: Set `retentionDays: null` (unlimited). Send a PATCH with only provider timeout changes `{ providers: { off: { timeoutMs: 4000 } } }`. Verify `retentionDays` strictly remains `null`. Verify subsequent pruning run leaves historical records intact.
    - Verify dynamic circuit breaker synchronization (`breakerTimeout = timeoutMs + 500ms`).
  - **Analytics Engine Tests (`barcode-api-analytics.test.ts`):** Verify SQL aggregations using physical snake_case columns (`created_at`, `duration_ms`), latency percentiles (`p50`, `p95`, `p99`), time-series bucketing, and top barcode ranking.
  - **Admin Route Tests (`external-apis.test.ts`):** Verify `GET /stats`, `GET /requests`, `GET /requests/:id`, `PATCH /config`, and `POST /reset`. Test RBAC denials for anonymous users, ordinary users, deactivated accounts, and revoked tokens, plus audit logging verification on mutations.
  - **Admin UI Component Tests:** Verify `ProviderCard`, `RequestLogTable`, `RequestDetailModal` (lazy loading), and `BarcodeProbeModal` rendering and interactions.
  - **End-to-End Verification:** Live test script verifying that a barcode lookup in `api` buffers and creates a log row in PostgreSQL, that `GET /stats` reflects the new call, and that `POST /probe` returns valid diagnostic data.
- **Non-functional:**
  - 100% test pass rate across all new and modified test suites.
  - Zero TypeScript compiler errors across `@expyrico/shared`, `api`, and `apps/admin`.
  - Zero regressions in existing barcode lookup tests (`lookup.test.ts`, `off-client.test.ts`, `upcitemdb-client.test.ts`).

## Architecture
```
[ Test Execution Matrix ]
├── 1. packages/shared: pnpm --filter @expyrico/shared test && pnpm --filter @expyrico/shared typecheck
├── 2. api: pnpm --filter api test barcode-api && pnpm --filter api test external-apis && pnpm --filter api typecheck
├── 3. apps/admin: pnpm --filter admin test && pnpm --filter admin typecheck
└── 4. End-to-End Smoke Test: Exercise lookup -> Verify log row -> Check /stats -> Execute live probe
```

## Related Code Files
- Create:
  - `packages/shared/src/schemas/admin/barcode-api.test.ts`
  - `api/src/services/external/barcode-api-tracker.test.ts`
  - `api/src/services/external/barcode-provider-settings.test.ts`
  - `api/src/services/admin/barcode-api-analytics.test.ts`
  - `api/src/services/admin/barcode-probe.test.ts`
  - `api/src/routes/admin/system/external-apis.test.ts`
  - `apps/admin/src/app/(admin)/system/external-apis/components/provider-card.test.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/request-log-table.test.tsx`
- Modify:
  - `api/src/services/products/lookup.test.ts`
  - `api/src/services/products/off-client.test.ts`
  - `api/src/services/products/upcitemdb-client.test.ts`

## Implementation Steps
1. Write unit tests for `@expyrico/shared` schemas in `barcode-api.test.ts`:
   - Assert `barcodeApiConfigPatchSchema.parse({})` leaves `retentionDays` as `undefined`.
2. Write unit tests for `barcode-api-tracker.ts`:
   - Mock Prisma client and verify micro-batching flushes after 25 items or timer.
   - Verify that when `prisma.barcodeApiCallLog.createMany` rejects with an error, the function resolves cleanly without throwing.
3. Write unit tests for `barcode-provider-settings.ts`:
   - Test `reserveDailyQuota` atomically denies the 101st request when 2 concurrent requests race at `limit - 1 = 99`.
   - Test that `cooldown_skipped` logs do not consume quota.
   - Test process restart persistence and Redis fail-open fallback.
   - Test partial PATCH merge: set `retentionDays: null`, execute timeout-only PATCH, assert `retentionDays` remains `null`.
   - Test in-memory TTL caching and cache invalidation on update.
4. Write integration tests for `barcode-api-analytics.ts`:
   - Seed sample `BarcodeApiCallLog` rows with diverse statuses and latencies.
   - Assert computed `totalCalls`, `hitRate`, `errorRate`, `avgDurationMs`, and `p95DurationMs`.
   - Assert time-series buckets align with the requested date range.
5. Write API route tests for `external-apis.ts`:
   - Test RBAC: anonymous requests return 401; ordinary user returns 403; deactivated admin returns 401; valid admin passes.
   - Test `GET /stats`, `GET /requests`, `GET /requests/:id`, `PATCH /config`, and `POST /reset`.
   - Verify `req.auditLog` records admin mutations.
6. Write UI component tests in `apps/admin`:
   - Test `ProviderCard` shows correct badge and quota bar percentage.
   - Test `RequestLogTable` renders monospace barcode, status pill, and opens details modal with lazy-loaded headers.
7. Run workspace-wide typechecking and test execution:
   `pnpm --filter @expyrico/shared typecheck && pnpm --filter api typecheck && pnpm --filter admin typecheck`.

## Success Criteria
- [x] All new unit, integration, and UI tests pass.
- [x] Schema test confirms `barcodeApiConfigPatchSchema` leaves omitted `retentionDays` undefined.
- [x] Partial PATCH test confirms `retentionDays: null` is preserved across provider updates and historical logs are retained.
- [x] Concurrent quota reservation tests prove zero overshoot under backfill worker race and survive process restarts.
- [x] Existing product lookup and client tests (`lookup.test.ts`, `off-client.test.ts`, `upcitemdb-client.test.ts`) continue to pass with zero regressions.
- [x] TypeScript compilation across the entire workspace exits with 0 errors.
- [x] End-to-end verification script confirms real-time logging and stats reflection.

## Risk Assessment
- **Risk:** Existing tests mock external fetch without expecting `bufferBarcodeApiCallLog`.
- **Mitigation:** Tracker service is designed with fire-and-forget execution and safe mocks in unit tests.
- **Risk:** Timezone discrepancies in test assertions for daily time-series buckets.
- **Mitigation:** Standardize all test dates and SQL date truncations to UTC.
