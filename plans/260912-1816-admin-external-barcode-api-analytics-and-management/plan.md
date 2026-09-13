---
title: "Admin External Barcode API Calling, Usage Analytics and Management Architecture"
status: completed
priority: P1
effort: "3d"
tags: [admin, barcode, openfoodfacts, upcitemdb, analytics, metrics, monitoring, circuit-breaker, quota, rate-limit]
created: 2026-09-12
---

# Admin External Barcode API Calling, Usage Analytics and Management Architecture

## Overview

Provide administrators with complete operational visibility and active management control over external barcode API providers (OpenFoodFacts, UPCitemdb, and future integrations). The system records every external barcode lookup attempt with microsecond-level timing, HTTP status codes, outcome classifications, and error details into a high-performance database log. A dedicated analytics engine computes real-time KPIs (hit rates, latency percentiles, 429 rate limit spikes, daily quota utilization, hourly/daily call volume trends, and top queried barcodes). 

The Admin Dashboard is overhauled from a static circuit breaker table into a full **Provider Command Center**, featuring live health statuses, daily quota gauges (e.g. tracking UPCitemdb's 100/day trial tier limit backed by durable Redis atomic reservation), interactive call volume charts, a searchable granular request inspector, live barcode diagnostic probing, and per-provider management controls (enable/disable toggles, timeout tuning, daily quota limits, configurable log retention with safe partial PATCH semantics, and instant cooldown/breaker resets).

---

## Architectural Solution Design

```
                                 [ Mobile App / Background Worker ]
                                                │
                                                ▼
                                   [ lookupProductV2 (API) ]
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 │                                                             │
                 ▼                                                             ▼
        [ off-client.ts ]                                             [ upcitemdb-client.ts ]
                 │                                                             │
                 ├──────────────────────────────┬──────────────────────────────┤
                 │                              │                              │
                 ▼                              ▼                              ▼
     [ Check Provider Config ]       [ 1. Cooldown Check FIRST ]    [ 2. Cooldown Active? ]
     (Enabled? Quota Reached?)       (Skip if in 5m cooldown)       (Skip without quota charge)
                 │                              │                              │
                 ▼                              ▼                              ▼
     [ Durable Redis Quota ]         [ Durable Redis Quota ]        [ 3. Network Dispatched ]
     (INCR with 48h TTL)             (INCR with 48h TTL)            (getJsonWithMeta)
                 │                              │                              │
                 ▼                              ▼                              ▼
     [ HTTP GET (Time & Size) ]      [ HTTP GET (Time & Size) ]     [ Micro-Batched Buffer ]
                 │                              │                              │
                 └──────────────────────────────┬──────────────────────────────┘
                                                │
                                                ▼
                              [ barcode_api_call_logs (PostgreSQL) ]
                                                │
               ┌────────────────────────────────┴────────────────────────────────┐
               │                                                                 │
               ▼                                                                 ▼
   [ SQL Analytics Engine ]                                          [ Admin API Endpoints ]
   - Single-query p50/p95/p99 percentiles                            - GET  /admin/system/external-apis/stats
   - Time-series call volume buckets                                 - GET  /admin/system/external-apis/requests
   - Filters out admin_probe from organic KPIs                       - GET  /admin/system/external-apis/requests/:id
   - Top queried & failing barcodes                                  - POST /admin/system/external-apis/probe
   - Today's quota usage vs limits                                   - PATCH /admin/system/external-apis/config
               │                                                     - POST /admin/system/external-apis/reset
               └────────────────────────────────┬────────────────────────────────┘
                                                │
                                                ▼
                         [ Admin Dashboard: Provider Command Center ]
                         - Live Health & Breaker Status Badges
                         - Daily Quota Progress Bars (UPCitemdb 100/day)
                         - Interactive Volume & Latency Trend Charts
                         - Live Barcode Diagnostic Probe Tool
                         - Granular Request Log Table & JSON Inspector
                         - Provider Configuration, Timeout & Retention Controls
```

---

## Goals

| # | Goal | Priority | Description |
|---|------|----------|-------------|
| 1 | **Comprehensive Barcode API Persistence** | P1 | Record every external barcode lookup attempt (provider, barcode, endpoint, HTTP status, durationMs, outcome, error message, callerContext, timestamp) in PostgreSQL with explicit snake_case column mappings, optimized composite indexing, and auto-pruning. |
| 2 | **Non-Blocking Micro-Batched Architecture** | P1 | Ensure tracking execution uses an in-memory micro-batch buffer flushed every 1s or 25 items so database logging never adds latency or saturates the connection pool during user barcode scans. |
| 3 | **Real-Time Statistical Analytics Engine** | P1 | Compute high-density operational metrics via single-query PostgreSQL analytics: total volume, hit rates, 429 rate limits, timeouts, p50/p95/p99 latencies, time-series volume buckets (24h/7d/30d), and top queried barcodes. |
| 4 | **Active Provider Management & Durable Quota Controls** | P1 | Allow admins to dynamically enable/disable providers, adjust timeouts, configure log retention (7 to unlimited days), enforce atomic daily quota limits via Redis that survive process restarts without charging cooldown skips, and reset circuit breakers or cooldown periods. |
| 5 | **Admin Command Center & Granular Request Inspector** | P1 | Revamp the Admin Dashboard with KPI cards, daily quota progress bars, time-series visual charts, a searchable/filterable request log table with lazy-loaded JSON diagnostics via `GET /requests/:id`, and a live barcode diagnostic probe modal. |
| 6 | **End-to-End Test Suite & Verification** | P1 | Deliver unit, integration, and UI test coverage defending logging isolation, aggregation correctness, quota limits under concurrency, process restart persistence, safe partial PATCH retention preservation, and admin audit logging. |

---

## Phases

| # | Phase | Status | Objective |
|---|-------|--------|-----------|
| 1 | [Shared Schemas, Types & Database Migration](./phase-01-schemas-and-database-migration.md) | Completed | Define Prisma `BarcodeApiCallLog` model with explicit `@map` attributes, migration, retention index, and shared Zod schemas (`@expyrico/shared`), including safe partial PATCH retention schema (no default). |
| 2 | [High-Performance Tracker Service & Client Instrumentation](./phase-02-tracker-service-and-instrumentation.md) | Completed | Implement micro-batched async tracker, durable Redis-backed atomic daily quota reservation, pre-reservation cooldown check, metadata-preserving HTTP transport helper (`getJsonWithMeta`), safe partial settings merge preserving omitted retention, and instrument `off-client.ts` and `upcitemdb-client.ts`. |
| 3 | [Analytics Engine & Admin API Routes](./phase-03-analytics-engine-and-api-routes.md) | Completed | Build SQL aggregation engine for latency percentiles and time-series buckets (filtering out admin probes from organic user KPIs), plus admin endpoints (`/stats`, `/requests`, `/requests/:id`, `/probe`, `/config`, `/reset`) utilizing existing `adminOnlyPlugin` and `req.auditLog`. |
| 4 | [Admin Dashboard Redesign & Management UI](./phase-04-admin-dashboard-and-management-ui.md) | Completed | Overhaul `/system/external-apis` with KPI cards, quota bars, time-series charts, request inspector table with callerContext filter and lazy-loaded JSON detail modal, live probe modal, and settings dialog with retention configuration. |
| 5 | [Automated Testing & End-to-End Verification](./phase-05-testing-and-verification.md) | Completed | Write comprehensive unit and integration tests across `@expyrico/shared`, `api`, and `apps/admin`, verifying concurrent quota bounds, restart persistence, partial PATCH retention preservation, connection pool resilience, and typecheck passes. |

---

## Success Criteria

- [x] Every call to OpenFoodFacts and UPCitemdb is durably logged with exact start/end latency, HTTP code, headers, and outcome status (`hit`, `miss`, `rate_limited`, `timeout`, `error`, `cooldown_skipped`).
- [x] Micro-batched buffer isolates PostgreSQL connection pool from user-facing `persistExternal` transactions; logging failures never degrade scan responses.
- [x] Admin dashboard provides detailed statistical visibility across selectable time ranges (`24h`, `7d`, `30d`) with global and per-provider breakdowns, strictly isolating organic user metrics from admin probes.
- [x] Daily quota consumption for rate-limited providers (e.g. UPCitemdb 100/day trial tier) is atomically enforced via Redis before network dispatch, survives process restarts, and excludes non-dispatched cooldown skips.
- [x] Admins can instantly test any barcode using the live diagnostic probe tool, viewing raw latencies, response codes, and parsed product fields.
- [x] Admins can toggle providers on/off, adjust timeout budgets, change retention days, and reset cooldowns or circuit breakers directly from the dashboard with full `req.auditLog` tracking.
- [x] Partial PATCH mutations omitting `retentionDays` strictly preserve existing retention settings (including `retentionDays: null`), preventing unintended deletion of historical logs.
- [x] Request log table supports pagination, barcode search, and filtering by provider, status, and callerContext, with click-to-inspect JSON diagnostics loaded via `/requests/:id`.
- [x] 100% test pass rate across unit, integration, and typecheck suites in `@expyrico/shared`, `api`, and `apps/admin`.

---

## Red Team Review

### Session — 2026-09-12
**Findings:** 7 consolidated finding groups (7 accepted, 0 rejected)  
**Severity Breakdown:** 1 Critical, 5 High, 1 Medium  

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Align Prisma column mappings (`@map`) with raw SQL physical column names (`created_at`, `duration_ms`) | Critical | Accept | Phase 1, Phase 3 |
| 2 | Reserve daily quota atomically via Redis before network dispatch and check cooldown FIRST to exclude skips | High | Accept | Phase 2, Phase 4, Phase 5 |
| 3 | Define metadata-preserving HTTP transport (`getJsonWithMeta`) and request detail inspection route (`/requests/:id`) | High | Accept | Phase 1, Phase 2, Phase 3, Phase 4 |
| 4 | Coordinate configurable HTTP timeouts with circuit breaker budgets (`breakerTimeout = timeoutMs + 500ms`) | High | Accept | Phase 2 |
| 5 | Replace unbuffered fire-and-forget inserts with bounded micro-batch buffer to isolate DB connection pool | High | Accept | Phase 2, Phase 5 |
| 6 | Use existing Fastify authorization (`adminOnlyPlugin` -> `app.requireAdmin`) and audit logging (`req.auditLog`) | High | Accept | Phase 3, Phase 5 |
| 7 | Connect log retention pruning to scheduled worker execution path in `api/src/workers/runner.ts` | Medium | Accept | Phase 2 |

---

## Validation Log

### Session 1 — 2026-09-12
**Trigger:** `/ak:plan validate` critical questions interview & advisor review  
**Questions asked:** 4  

#### Questions & Answers

1. **[Scope / Retention]** How long should historical barcode API call logs be retained before automated daily pruning?
   - **Options:** 30 days | 14 days | 60 days | Configurable via Admin UI
   - **Answer:** Store 30 days by default, but allow admin to customize retention (7 to unlimited days) in dashboard settings.
   - **Rationale:** Gives admins full control over database disk footprint and historical depth; default 30 days keeps storage lean while settings dialog allows 7 to 0 (unlimited/no pruning) retention.

2. **[Architecture / Fallback]** When an external provider hits its daily quota cap (e.g. UPCitemdb 100/day trial limit), how should lookups handle it?
   - **Options:** Skip exhausted provider & fallback (Recommended) | Bypass all external queries to manual creation
   - **Answer:** Skip exhausted provider & fallback (Recommended)
   - **Rationale:** Preserves resilience by skipping only the exhausted provider and querying other active providers (OpenFoodFacts); if all providers are exhausted, gracefully falls back to instant manual product creation (`canCreate: true`).

3. **[Architecture / UI UX]** What should be the default refresh strategy for the Admin External APIs dashboard?
   - **Options:** Manual refresh by default with optional 15s/30s toggle (Recommended) | Active 30s auto-polling by default
   - **Answer:** Manual refresh by default with optional 15s/30s toggle (Recommended)
   - **Rationale:** Prevents needless background polling against the database when admin dashboard tabs are left open, while providing a clean switch for live monitoring during maintenance or testing.

4. **[Architecture / Telemetry]** Should live diagnostic tests run via the Admin 'Barcode Probe' tool be persisted in call logs?
   - **Options:** Log as 'admin_probe' and filter from user KPIs (Recommended) | Ephemeral only (do not persist probe queries)
   - **Answer:** Log as 'admin_probe' and filter from user KPIs (Recommended)
   - **Rationale:** Allows administrators to review historical probe tests in the granular request logs table while ensuring production user-scan analytics, hit rates, and volume charts strictly reflect organic app traffic.

#### Confirmed Decisions & Advisor Safeguards
- **Retention Period:** 30 days default, configurable in Admin Settings from 7 to unlimited days (`retentionDays: number | null`).
- **Safe Partial PATCH Contract:** `barcodeApiConfigPatchSchema` defines `retentionDays` as optional without default value; `updateBarcodeProviderSettings` preserves existing `current.retentionDays` when omitted in partial PATCH updates, preventing unintended deletion of unlimited historical data.
- **Quota Fallback:** Skip exhausted provider and race remaining active providers; fail-open to manual creation if all exhausted.
- **Dashboard Polling:** Manual refresh by default with 15s/30s live toggle in the header.
- **Probe Logging:** Persist live probe results with `callerContext: 'admin_probe'` and exclude them from organic mobile scan KPIs (`caller_context != 'admin_probe'`).

#### Action Items
- [x] Add `retentionDays: z.number().int().min(7).nullable().default(30)` to `barcodeApiConfigSchema` and `retentionDays: z.number().int().min(7).nullable().optional()` (NO default) to patch schema in Phase 1.
- [x] Wire dynamic `retentionDays` into `pruneExpiredBarcodeApiLogs` in Phase 2, skipping deletion when `retentionDays === null`.
- [x] Enforce safe merge preserving omitted `retentionDays` in `updateBarcodeProviderSettings` in Phase 2.
- [x] Filter out `caller_context = 'admin_probe'` from organic scan KPIs in Phase 3 SQL analytics.
- [x] Add `callerContext` filter chips to `RequestLogTable` in Phase 4.
- [x] Add `retentionDays` input to `ProviderSettingsModal` in Phase 4.
- [x] Configure dashboard client to manual refresh by default with 15s/30s toggle in Phase 4.
- [x] Add test in Phase 5 verifying that setting `retentionDays: null`, followed by a timeout-only PATCH, preserves `retentionDays: null` and leaves historical logs intact.

### Whole-Plan Consistency Sweep
- **Status:** Zero unresolved contradictions.
- **Verified Invariants Across All Plan Files:**
  1. **Schema & Database Alignment:** `BarcodeApiCallLog` defines explicit `@map` attributes on all camelCase fields (`created_at`, `duration_ms`, `http_status`, `http_method`, `response_size_bytes`, `caller_context`, `request_headers`, `response_headers`, `raw_response_preview`, `user_id`), matching all analytical SQL queries and retention deletion queries.
  2. **Durable Redis Quota & Cooldown Isolation:** `barcode-provider-settings.ts` implements an atomic UTC-day reservation counter in Redis (`barcode:daily_quota:{provider}:{utcDay}`) that survives process restarts and shares state across cluster instances. Cooldown checks execute FIRST: in-cooldown events (`durationMs: 0`) and breaker skips are tracked for analytics but explicitly bypassed from consuming upstream quota. Redis outages safely fail-open to ensure mobile scanning uptime.
  3. **Transport & Diagnostic Contract:** `api/src/lib/http.ts` provides `getJsonWithMeta` capturing real HTTP status, sanitized headers, and bounded raw text preview. Phase 3 provides `GET /requests/:id` and Phase 4 connects the admin inspector modal to lazy-load these diagnostic fields.
  4. **Connection Pool Protection:** `barcode-api-tracker.ts` buffers telemetry in memory and flushes micro-batches every 1s or 25 items using `createMany`, preventing connection pool starvation under scan spikes.
  5. **Security & Auditing:** Route integration preserves existing `adminOnlyPlugin` inheritance (`app.requireAdmin` checking token version and DB role) and invokes `req.auditLog` for config updates and provider resets.
  6. **Lifecycle Retention & Safe Partial PATCH:** `api/src/workers/runner.ts` registers a recurring daily cleanup job for `pruneExpiredBarcodeApiLogs()`, reading dynamic `retentionDays` from settings. `barcodeApiConfigPatchSchema` has no default on `retentionDays`, and `updateBarcodeProviderSettings` strictly preserves existing retention settings when omitted.
  7. **Probe Telemetry Isolation:** Probe diagnostic executions are recorded as `callerContext: 'admin_probe'` and surfaced in request logs, but filtered out of organic user scan analytics and hit rates.

<!-- slug: admin-external-barcode-api-analytics-and-management -->
