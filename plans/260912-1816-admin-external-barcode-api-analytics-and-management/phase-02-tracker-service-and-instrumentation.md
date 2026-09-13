---
phase: 2
title: "High-Performance Tracker Service & Client Instrumentation"
status: pending
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: High-Performance Tracker Service & Client Instrumentation

<!-- Updated: Validation Session 1 - Dynamic retentionDays reading (30d default, null for unlimited) in pruning worker -->
<!-- Updated: Advisor Review - Merge logic strictly preserves omitted retentionDays during partial PATCH updates -->

## Overview
Implement the backend tracking infrastructure and instrument all external barcode API clients. This phase introduces an asynchronous, micro-batched tracker service (`barcode-api-tracker.ts`) that protects PostgreSQL connection pools, a durable Redis-backed atomic daily quota reservation engine (`barcode-provider-settings.ts`) that survives process restarts and coordinates across cluster instances, a metadata-preserving HTTP transport helper (`getJsonWithMeta`), dynamic breaker-timeout synchronization, and recurring retention pruning scheduled in the BullMQ worker runner respecting dynamic retention settings and safe partial merge logic.

## Requirements
- **Functional:**
  - `recordBarcodeApiCall(data)`: Asynchronously buffers call metrics and flushes them in micro-batches (flush every 1,000ms or 25 events via `createMany`). Must never throw or bubble errors.
  - `pruneExpiredBarcodeApiLogs(retentionDays?)`: Reads dynamic `retentionDays` from `Setting` (default: 30). If configured as `null`, pruning is skipped (unlimited retention). Batch deletes expired rows via `created_at < NOW() - INTERVAL '...'`. Registered in `api/src/workers/runner.ts` to run daily.
  - Metadata-Preserving HTTP Transport: Add `getJsonWithMeta<T>` to `api/src/lib/http.ts` returning `{ data: T; status: number; headers: Record<string, string>; sizeBytes: number; rawTextPreview: string }` so outer instrumentation captures real transport diagnostics.
  - Durable Redis-Backed Atomic Quota Reservation:
    - Maintain a shared atomic per-provider UTC-day reservation counter in Redis (`barcode:daily_quota:{provider}:{utcDay}`) with 48-hour TTL using an atomic Lua script:
      ```lua
      local current = redis.call('GET', KEYS[1])
      local limit = tonumber(ARGV[1])
      if limit and current and tonumber(current) >= limit then
        return { 0, tonumber(current) } -- Denied
      end
      local next_val = redis.call('INCR', KEYS[1])
      if next_val == 1 then
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
      end
      return { 1, next_val } -- Granted
      ```
    - Survives server restarts and synchronizes across API cluster processes and BullMQ background workers (`concurrency: 2`).
    - Store-failure policy: If Redis is transiently unreachable or rejects, fail-open with a logged warning (`logger.warn`) so database/cache outages never block critical mobile barcode scanning.
  - Strict Execution Order: Cooldown checks run BEFORE quota reservation. In `upcitemdb-client.ts`, if the provider is in cooldown (`Date.now() < upcQuotaCooldownUntil`), it logs `cooldown_skipped` (durationMs: 0) and returns immediately WITHOUT reserving or consuming quota.
  - Safe Partial Settings Merge: In `updateBarcodeProviderSettings(patch, adminId)`, if `patch.retentionDays === undefined`, the existing `current.retentionDays` is preserved unmodified:
    ```typescript
    const current = await getBarcodeProviderSettings();
    const nextRetentionDays = patch.retentionDays !== undefined 
      ? patch.retentionDays 
      : current.retentionDays;
    ```
    This guarantees that partial PATCH updates targeting only provider timeouts or quota limits will never reset an admin's configured `retentionDays: null` (unlimited) back to `30`.
  - Breaker & Timeout Coherence: When an admin adjusts provider `timeoutMs`, dynamically adjust the enclosing circuit breaker timeout (`breakerTimeout = timeoutMs + 500ms`) so breaker limits never trip before the HTTP timeout budget.
  - Instrument `lookupOff`: Check provider enabled state, reserve quota, execute query with `getJsonWithMeta`, and buffer log.
  - Instrument `lookupUpcitemdb`: Check cooldown FIRST (skip without quota consumption), then check provider enabled state and reserve quota, execute query, and buffer log.
  - Caller context: Accurately label the call origin (`sync_lookup` for mobile users, `backfill_worker` for BullMQ worker, `admin_probe` for admin test tools).
- **Non-functional:**
  - Zero connection pool saturation: Micro-batching eliminates concurrent single-row insert contention against user-facing `persistExternal` transactions.
  - Complete fault tolerance: Logging buffer overflow or database write failures drop telemetry rather than failing product lookups.

## Architecture
```
[ lookupProduct / lookupProductV2 / backfill ]
                     │
                     ▼
        [ off-client / upcitemdb-client ]
                     │
                     ├── 1. Cooldown Check (UPCitemdb FIRST)
                     │      └── If in cooldown: return not_found, buffer 'cooldown_skipped' (NO quota consumed)
                     │
                     ├── 2. Provider Enabled Check: isProviderEnabled(provider)
                     │      └── If disabled: return unavailable, buffer 'disabled_skipped' (NO quota consumed)
                     │
                     ├── 3. Durable Atomic Quota: reserveDailyQuota(provider) via Redis Lua
                     │      └── If exceeded: return unavailable, buffer 'quota_exceeded_skipped'
                     │      └── If Redis down: fail-open with warning, proceed to network
                     │
                     ├── 4. getJsonWithMeta<T>(url, { timeoutMs })
                     │      └── Captures exact status, sizeBytes, headers, and 4KB text preview
                     │
                     ├── 5. Determinate Outcome ('hit' | 'miss' | 'rate_limited' | 'timeout' | 'error')
                     │
                     └── 6. bufferBarcodeApiCallLog({ ... })
                                     │
                                     ▼ (In-memory ring buffer)
                         [ Bounded Batch Buffer ]
                           (Flush every 1s or 25 items)
                                     │
                                     ▼ (Single batch insert)
                         prisma.barcodeApiCallLog.createMany({ ... })
```

## Related Code Files
- Create:
  - `api/src/services/external/barcode-api-tracker.ts`
  - `api/src/services/external/barcode-api-tracker.test.ts`
  - `api/src/services/external/barcode-provider-settings.ts`
  - `api/src/services/external/barcode-provider-settings.test.ts`
- Modify:
  - `api/src/lib/http.ts`
  - `api/src/services/products/off-client.ts`
  - `api/src/services/products/upcitemdb-client.ts`
  - `api/src/services/products/lookup.ts`
  - `api/src/workers/product-lookup.ts`
  - `api/src/workers/runner.ts`
  - `api/src/constants/settings.ts`

## Implementation Steps
1. Add `BARCODE_PROVIDERS: 'external_barcode_providers'` to `SETTING_KEYS` in `api/src/constants/settings.ts`.
2. Update `api/src/lib/http.ts`:
   - Implement `getJsonWithMeta<T>(url, options)` which returns `{ data, status, headers, sizeBytes, rawTextPreview }`. Truncate `rawTextPreview` to max 4,096 characters and strip sensitive authorization headers.
3. Implement `barcode-provider-settings.ts`:
   - `getBarcodeProviderSettings()`: loads settings with 10-second in-memory TTL caching (including `retentionDays`).
   - `updateBarcodeProviderSettings(patch, adminId)`: performs safe deep merge preserving `current.retentionDays` when `patch.retentionDays === undefined`, saves to `Setting`, updates dynamic breaker options, and clears in-memory cache.
   - `reserveDailyQuota(provider)`: atomic Redis Lua script reserving count on key `barcode:daily_quota:{provider}:{utcDay}` with 48h TTL. Returns `{ granted: boolean, currentCount: number, limit: number | null }`. Fails open if Redis errors.
   - `getTodayDispatchedCount(provider)`: reads current count from Redis (or falls back to database count if Redis key expired).
   - `resetProviderCooldown(provider)` and `resetProviderBreaker(provider)`.
4. Implement `barcode-api-tracker.ts`:
   - Ring buffer with max capacity 1,000 items.
   - Flushes via `prisma.barcodeApiCallLog.createMany({ data: batch, skipDuplicates: true })` every 1,000ms or when batch reaches 25 items.
   - Process exit hook to flush remaining buffered items.
   - `pruneExpiredBarcodeApiLogs(retentionDays?)`: reads dynamic setting. If `null`, exits cleanly without pruning. Otherwise executes batch deletion using `DELETE FROM barcode_api_call_logs WHERE created_at < NOW() - INTERVAL '...'`.
5. Update `api/src/workers/runner.ts`:
   - Register recurring daily job calling `pruneExpiredBarcodeApiLogs()` in `startPeriodicWorkers` and graceful shutdown.
6. Update `api/src/services/products/off-client.ts`:
   - Check `isProviderEnabled('off')`.
   - Check `reserveDailyQuota('off')`.
   - Use `getJsonWithMeta` with dynamic timeout.
   - Buffer log record including `requestHeaders`, `responseHeaders`, `rawResponsePreview`.
7. Update `api/src/services/products/upcitemdb-client.ts`:
   - Check cooldown FIRST (`Date.now() < upcQuotaCooldownUntil`). If in cooldown, buffer `status: 'cooldown_skipped', durationMs: 0` and return immediately without reserving quota.
   - Check `isProviderEnabled('upcitemdb')`.
   - Check `reserveDailyQuota('upcitemdb')`.
   - Use `getJsonWithMeta` with dynamic timeout.
   - If HTTP 429 encountered, set 5-minute cooldown (`upcQuotaCooldownUntil = Date.now() + 5 * 60 * 1000`).
   - Export helper `clearUpcQuotaCooldown()` and breaker synchronizer.
8. Update `api/src/services/products/lookup.ts` and `api/src/workers/product-lookup.ts` to thread `callerContext` (`sync_lookup` vs `backfill_worker`).
9. Write unit tests for tracker and settings services in `barcode-api-tracker.test.ts` and `barcode-provider-settings.test.ts`:
   - Test that `updateBarcodeProviderSettings` with `{ providers: { off: { timeoutMs: 4000 } } }` preserves existing `retentionDays: null`.
   - Test process restart persistence and Redis fail-open tests.
   - Test dynamic `retentionDays` null check in pruning.

## Success Criteria
- [x] Every call to OpenFoodFacts and UPCitemdb produces a corresponding row in `barcode_api_call_logs`.
- [x] 429 responses from UPCitemdb correctly log `status: 'rate_limited'` with `httpStatus: 429` and headers.
- [x] Cooldown check executes FIRST: cooldown periods record `status: 'cooldown_skipped'` with `durationMs: 0` and do not consume daily quota.
- [x] Daily quota enforcement atomically blocks calls past limit using Redis Lua script, surviving process restarts and coordinating across API and worker processes.
- [x] Redis failures safely fail-open without blocking user scans.
- [x] Partial PATCH updates omitting `retentionDays` strictly preserve existing retention configuration.
- [x] Retention pruning respects dynamic `retentionDays` (skips when null, prunes when number).
- [x] Micro-batching flushes telemetry in groups without holding open Prisma transaction connections.
- [x] Unit tests pass with 100% assertions satisfied.

## Risk Assessment
- **Risk:** Redis connection outage blocks product lookups.
- **Mitigation:** Quota reservation catches Redis errors and fails open (`granted: true`), logging a warning.
- **Risk:** Transport envelope overhead increases memory usage.
- **Mitigation:** `rawTextPreview` is strictly clamped to 4KB and headers are sanitized to essential diagnostic keys.
