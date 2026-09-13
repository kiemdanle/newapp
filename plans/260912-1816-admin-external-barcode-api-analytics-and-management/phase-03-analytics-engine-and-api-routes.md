---
phase: 3
title: "Analytics Engine & Admin API Routes"
status: pending
priority: P1
effort: "6h"
dependencies: [1, 2]
---

# Phase 3: Analytics Engine & Admin API Routes

<!-- Updated: Validation Session 1 - Probe queries logged with callerContext: 'admin_probe' and filtered out of organic user scan KPIs -->

## Overview
Build the high-performance SQL aggregation engine, live barcode diagnostic probing service, and the full suite of Admin REST API endpoints. This phase delivers consolidated SQL aggregations calculating percentiles (`p50`, `p95`, `p99`), hourly and daily time-series buckets (filtering out admin probe noise from organic user lookups), quota tracking, paginated request log filtering with context tags, single-request diagnostic inspection, and admin mutation endpoints using the application's existing `adminOnlyPlugin` and `req.auditLog` infrastructure.

## Requirements
- **Functional:**
  - `getBarcodeApiStats({ range: '24h' | '7d' | '30d' | '90d' })`:
    - Summary metrics: total calls, hit rate %, error rate %, avg latency, p50, p95, p99 latencies, 429 rate limit count, timeout count, cooldown skip count.
    - **Organic Traffic Isolation:** All global user KPIs, hit rates, and volume charts strictly filter for `caller_context != 'admin_probe'` (or `caller_context IN ('sync_lookup', 'backfill_worker')`) so that administrative diagnostic probes never distort production application metrics.
    - Per-provider metrics (`off`, `upcitemdb`): state, daily calls vs daily quota limit, hit/miss/error counts, latency distribution (min, avg, p50, p95, p99, max), circuit breaker state, cooldown status, and active configuration.
    - Time-series buckets: hourly for `24h` range; daily for `7d`, `30d`, and `90d` ranges, grouped by provider and outcome.
    - Top queried barcodes: top 10 most looked-up barcodes with hit/miss ratios and last queried timestamp.
  - `listBarcodeApiRequests(query)`:
    - Paginated cursor-based listing of individual API calls with filtering by `provider`, `status`, `callerContext` (`All`, `sync_lookup`, `backfill_worker`, `admin_probe`), `barcode` search, and date range.
  - `getBarcodeApiRequestDetail(id)`:
    - Fetches full diagnostic details for a specific call, including `requestHeaders`, `responseHeaders`, and `rawResponsePreview`.
  - `probeBarcodeApi({ barcode, providers })`:
    - Live diagnostic test executing real-time queries against selected external providers via `getJsonWithMeta`, capturing raw HTTP latency, status code, response headers, raw payload snippet, and parsed product fields. Logged into `barcode_api_call_logs` with `callerContext: 'admin_probe'`.
  - Admin REST Routes (under `api/src/routes/admin/system/external-apis.ts`):
    - `GET /v1/admin/system/external-apis/stats`: Returns complete statistical payload validated against `barcodeApiStatsSchema`.
    - `GET /v1/admin/system/external-apis/requests`: Returns paginated request logs validated against `barcodeApiRequestsListSchema`.
    - `GET /v1/admin/system/external-apis/requests/:id`: Returns full request diagnostics validated against `barcodeApiCallLogDetailSchema`.
    - `POST /v1/admin/system/external-apis/probe`: Executes live barcode diagnostic test.
    - `PATCH /v1/admin/system/external-apis/config`: Updates provider enablement, timeouts, daily quota limits, and `retentionDays`.
    - `POST /v1/admin/system/external-apis/reset`: Clears active cooldown and resets circuit breakers for a given provider.
- **Non-functional:**
  - Sub-100ms response time on `/stats` endpoint via optimized single-query SQL aggregation with PostgreSQL `FILTER` clauses and `percentile_cont` on physical snake_case columns (`created_at`, `duration_ms`).
  - In-memory 15-second caching on aggregated stats to prevent database hammering during admin refreshes.
  - Strict RBAC & Auditing: Inherit `adminOnlyPlugin` (`app.requireAdmin` verifying active admin role and token version) and log all mutations with `req.auditLog`.

## Architecture
```
[ Admin Dashboard Client ]
            │
            ├─► GET   /v1/admin/system/external-apis/stats ──► barcode-api-analytics.ts (SQL Aggregates, filters admin_probe)
            ├─► GET   /v1/admin/system/external-apis/requests ──► barcode-api-analytics.ts (Paginated List with callerContext filter)
            ├─► GET   /v1/admin/system/external-apis/requests/:id ──► barcode-api-analytics.ts (Full Diagnostic Detail)
            ├─► POST  /v1/admin/system/external-apis/probe ──► barcode-probe.ts (Live getJsonWithMeta + logs admin_probe)
            ├─► PATCH /v1/admin/system/external-apis/config ──► barcode-provider-settings.ts (Audit Logged)
            └─► POST  /v1/admin/system/external-apis/reset ──► upcitemdb-client.ts & breaker registry (Audit Logged)
```

## Related Code Files
- Create:
  - `api/src/services/admin/barcode-api-analytics.ts`
  - `api/src/services/admin/barcode-api-analytics.test.ts`
  - `api/src/services/admin/barcode-probe.ts`
  - `api/src/services/admin/barcode-probe.test.ts`
- Modify:
  - `api/src/routes/admin/system/external-apis.ts`
  - `api/src/routes/admin/system/external-apis.test.ts`
  - `api/src/services/admin/breakers.ts`

## Implementation Steps
1. Create `api/src/services/admin/barcode-api-analytics.ts`:
   - Implement `getBarcodeApiStats`: Construct consolidated SQL query filtering organic scans:
     `SELECT date_trunc('hour'|'day', created_at) AS bucket, provider, status, COUNT(*)::bigint AS count, percentile_cont(ARRAY[0.5, 0.95, 0.99]) WITHIN GROUP (ORDER BY duration_ms) AS percentiles FROM barcode_api_call_logs WHERE created_at >= $1 AND caller_context != 'admin_probe' GROUP BY bucket, provider, status ORDER BY bucket ASC`.
   - Calculate time-series volume buckets grouped by provider and outcome.
   - Aggregate top 10 queried barcodes.
   - Merge live circuit breaker snapshots and cooldown timestamps from `breakers.ts` and `upcitemdb-client.ts`.
   - Implement 15s in-memory caching.
   - Implement `listBarcodeApiRequests`: Cursor-paginated query selecting summary fields for table display with optional `callerContext` filter.
   - Implement `getBarcodeApiRequestDetail`: Selects single row with `request_headers`, `response_headers`, and `raw_response_preview`.
2. Create `api/src/services/admin/barcode-probe.ts`:
   - Implement `probeBarcodeApi`: Concurrently queries OpenFoodFacts and UPCitemdb using `getJsonWithMeta`, capturing HTTP status, duration, error messages, raw payload preview, and parsed product data labeled with `callerContext: 'admin_probe'`, buffering the diagnostic record to `barcode_api_call_logs`.
3. Overhaul `api/src/routes/admin/system/external-apis.ts`:
   - Inherit `adminOnlyPlugin` and `auditPlugin` from admin routes parent.
   - Mount `GET /stats`, `GET /requests`, `GET /requests/:id`, `POST /probe`, `PATCH /config`, and `POST /reset`.
   - Audit-log configuration updates: `req.auditLog({ action: 'barcode_provider.update_config', targetType: 'system_setting', targetId: 'external_barcode_providers', details: body })`.
   - Audit-log reset actions: `req.auditLog({ action: 'barcode_provider.reset', targetType: 'external_api', targetId: provider, details: {} })`.
4. Update `api/src/services/admin/breakers.ts` to export helper for resetting circuit breakers by name.
5. Write comprehensive unit and route tests in `barcode-api-analytics.test.ts`, `barcode-probe.test.ts`, and `external-apis.test.ts`, including tests confirming probe logs are omitted from KPI totals.

## Success Criteria
- [x] `/v1/admin/system/external-apis/stats` responds with full KPI breakdown, latency percentiles, quota numbers, and time-series arrays, strictly excluding probe noise.
- [x] `/v1/admin/system/external-apis/requests` returns filtered paginated log rows with cursor navigation and `callerContext` filtering.
- [x] `/v1/admin/system/external-apis/requests/:id` returns full diagnostic headers and raw preview.
- [x] `/v1/admin/system/external-apis/probe` executes live diagnostic queries, returns formatted analysis, and logs row with `callerContext: 'admin_probe'`.
- [x] `/v1/admin/system/external-apis/config` updates provider settings including `retentionDays`.
- [x] `/v1/admin/system/external-apis/reset` successfully clears UPCitemdb cooldown and resets circuit breakers with audit logging.
- [x] Route tests pass with 100% assertion coverage.

## Risk Assessment
- **Risk:** Calculating `percentile_cont` over millions of rows causes CPU spikes on PostgreSQL.
- **Mitigation:** The query filters on `created_at >= since` using the `[createdAt]` index, and 15s in-memory caching prevents concurrent duplicate executions.
- **Risk:** Live probe times out if external provider is unresponsive.
- **Mitigation:** Live probe applies an isolated 4000ms timeout per provider and returns a structured timeout status rather than failing the HTTP request.
