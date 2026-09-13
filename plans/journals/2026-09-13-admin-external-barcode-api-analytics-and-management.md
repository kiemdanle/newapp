---
title: Admin External Barcode API Analytics and Management
date: 2026-09-13
summary: "Completed full implementation of barcode API persistence, micro-batched tracking, durable Redis daily quota reservation, SQL percentile analytics, and Admin Command Center dashboard."
---

# Admin External Barcode API Analytics and Management

Completed full implementation of barcode API persistence, micro-batched tracking, durable Redis daily quota reservation, SQL percentile analytics, and Admin Command Center dashboard across `@expyrico/shared`, `api`, and `apps/admin`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Key Changes
1. **Persistence & Shared Contracts (`@expyrico/shared` & `api/prisma`):**
   - Added `BarcodeApiCallLog` model to `api/prisma/schema.prisma` with explicit snake_case `@map` attributes and compound indexes on `[provider, createdAt]`, `[createdAt]`, `[barcode]`, and `[status, createdAt]`.
   - Applied migration `20260912190000_add_barcode_api_call_logs/migration.sql` to both `pantry` (dev) and `pantry_test` databases.
   - Defined shared Zod validation schemas in `packages/shared/src/schemas/admin/barcode-api.ts` with safe partial PATCH semantics (`retentionDays` is optional with no default value in patch schema).

2. **High-Performance Tracker & Client Instrumentation (`api`):**
   - Implemented `getJsonWithMeta<T>` in `api/src/lib/http.ts`, capturing HTTP status, duration, response size, sanitized headers, and 4KB bounded response preview.
   - Built `barcode-api-tracker.ts` using an in-memory ring buffer (up to 1,000 items) flushing batches of 25 items or every 1,000ms via `createMany`, preventing connection pool starvation.
   - Implemented `barcode-provider-settings.ts` with durable atomic Redis quota reservation on `barcode:daily_quota:{provider}:{utcDay}` with 48h TTL and fail-open policy on Redis errors.
   - Enforced execution order: cooldown check runs FIRST, recording `cooldown_skipped` (`durationMs: 0`) without consuming upstream daily quota allowance.
   - Synchronized circuit breaker timeouts dynamically (`breakerTimeout = timeoutMs + 500ms`).
   - Scheduled daily retention pruning in `api/src/workers/runner.ts`, respecting dynamic `retentionDays` (`null` disables pruning).

3. **Analytics Engine & Admin Routes (`api`):**
   - Built SQL analytics engine in `barcode-api-analytics.ts` computing p50/p95/p99 latency percentiles via `percentile_cont` and time-series buckets (hourly for 24h, daily for 7d/30d), strictly isolating `caller_context = 'admin_probe'` from organic user metrics.
   - Implemented `barcode-probe.ts` live diagnostic service.
   - Mounted admin REST routes (`/stats`, `/requests`, `/requests/:id`, `/probe`, `/config`, `/reset`) with `adminOnlyPlugin` and `req.auditLog`.

4. **Admin Dashboard Overhaul (`apps/admin`):**
   - Replaced static breaker table with full Provider Command Center at `/system/external-apis`.
   - Built KPI cards, quota progress bars with color thresholds, interactive volume charts, searchable request log table with lazy JSON inspection modal, live probe tool, and provider settings dialog.
   - Configured auto-refresh to default Off with 15s/30s polling toggle.

## Verification
- Unit & integration test suites passing 100%:
  - `@expyrico/shared`: 13 test files (196/196 tests passing).
  - `api`: 6 test files (29/29 tests passing).
  - `apps/admin`: 16 test files (80/80 tests passing).
- Zero TypeScript compiler errors across `@expyrico/shared`, `api`, and `apps/admin`.
- Production Next.js build of `apps/admin` succeeded cleanly.
