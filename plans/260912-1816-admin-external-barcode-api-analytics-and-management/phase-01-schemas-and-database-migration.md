---
phase: 1
title: "Shared Schemas, Types & Database Migration"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Shared Schemas, Types & Database Migration

<!-- Updated: Validation Session 1 - Configurable retentionDays in barcodeApiConfigSchema (7 to unlimited) -->
<!-- Updated: Advisor Review - Strict PATCH schema separation: patch schema has NO default, preserving existing retentionDays on partial updates -->

## Overview
Establish the foundational data contracts and persistence layer for external barcode API tracking and administrative management. This phase creates the PostgreSQL `barcode_api_call_logs` table via Prisma with explicit column name mappings, configures compound indexes for performant analytical queries, adds diagnostic transport fields for full-fidelity payload inspection, adds provider configuration schemas to the `Setting` model (including configurable log retention with safe partial PATCH semantics), and exports strongly typed Zod schemas from `@expyrico/shared`.

## Requirements
- **Functional:**
  - Record every external barcode lookup event: `id`, `provider`, `barcode`, `endpoint`, `httpMethod`, `status` (`hit`, `miss`, `rate_limited`, `timeout`, `error`, `cooldown_skipped`), `httpStatus`, `durationMs`, `errorMessage`, `responseSizeBytes`, `callerContext` (`sync_lookup`, `backfill_worker`, `admin_probe`), `requestHeaders`, `responseHeaders`, `rawResponsePreview`, `userId`, and `createdAt`.
  - Store provider runtime settings in the `Setting` table under key `external_barcode_providers` (enablement, timeout in ms, daily quota limit, priority, and configurable `retentionDays: number | null` where default is 30, min is 7, and `null` disables pruning for unlimited retention).
  - Export comprehensive Zod validation schemas for stats aggregation, request logs, request detail inspection, live barcode probes, and configuration updates in `@expyrico/shared`.
  - **Safe Partial PATCH Contract:** The full configuration schema (`barcodeApiConfigSchema`) specifies `.default(30)` for default state initialization, while the mutation patch schema (`barcodeApiConfigPatchSchema`) defines `retentionDays` as `z.number().int().min(7).nullable().optional()` with **no default value**. An unrelated PATCH (e.g. updating a provider timeout or quota) omitting `retentionDays` leaves it `undefined` and must never reset an admin's unlimited retention (`null`) back to 30 days.
- **Non-functional:**
  - Strict field-level `@map` mappings on all camelCase fields to ensure physical PostgreSQL snake_case columns (`created_at`, `duration_ms`, etc.) strictly match raw analytical SQL queries and pruning operations.
  - High-performance indexing on `[provider, createdAt]`, `[createdAt]`, `[barcode]`, and `[status, createdAt]` to guarantee sub-50ms analytics aggregations over millions of rows.
  - Diagnostic payload preservation: store sanitized headers and bounded raw response previews (truncated to 4KB) for reliable admin inspection without re-querying upstream services.

## Architecture
### 1. Database Schema (`api/prisma/schema.prisma`)
```prisma
model BarcodeApiCallLog {
  id                 String   @id @default(uuid()) @db.Uuid
  provider           String   @db.VarChar(64)       // 'off' | 'upcitemdb' | etc.
  barcode            String   @db.VarChar(64)
  endpoint           String   @db.Text
  httpMethod         String   @default("GET") @map("http_method") @db.VarChar(16)
  status             String   @db.VarChar(32)       // 'hit' | 'miss' | 'rate_limited' | 'timeout' | 'error' | 'cooldown_skipped'
  httpStatus         Int?     @map("http_status") @db.SmallInt // 200, 404, 429, 500, etc.
  durationMs         Int      @map("duration_ms") @db.Integer  // Response latency in milliseconds
  errorMessage       String?  @map("error_message") @db.Text
  responseSizeBytes  Int?     @map("response_size_bytes") @db.Integer
  callerContext      String   @default("sync_lookup") @map("caller_context") @db.VarChar(32) // 'sync_lookup' | 'backfill_worker' | 'admin_probe'
  requestHeaders     Json?    @map("request_headers")
  responseHeaders    Json?    @map("response_headers")
  rawResponsePreview String?  @map("raw_response_preview") @db.Text
  userId             String?  @map("user_id") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([provider, createdAt])
  @@index([createdAt])
  @@index([barcode])
  @@index([status, createdAt])
  @@map("barcode_api_call_logs")
}
```

### 2. Shared Zod Schemas (`packages/shared/src/schemas/admin/barcode-api.ts`)
- `barcodeApiStatusSchema`: `'hit' | 'miss' | 'rate_limited' | 'timeout' | 'error' | 'cooldown_skipped'`
- `barcodeApiCallerContextSchema`: `'sync_lookup' | 'backfill_worker' | 'admin_probe'`
- `barcodeApiCallLogRowSchema`: Schema for paginated request logs table (excludes heavy payloads for list performance).
- `barcodeApiCallLogDetailSchema`: Full diagnostic schema including `requestHeaders`, `responseHeaders`, and `rawResponsePreview`.
- `barcodeApiRequestsQuerySchema`: Filters (`provider`, `status`, `barcode`, `callerContext`, `range`, `limit`, `cursor`).
- `barcodeApiStatsSchema`: Complete statistical payload including:
  - Global summary KPIs (total calls, hit rate %, error rate %, avg latency ms, p95 latency ms, 429 count, timeout count — filtering organic user lookups from probe diagnostics).
  - Per-provider deep metrics (state, daily usage vs quota, hit/miss/error counts, latency distribution: min, avg, p50, p95, p99, max, breaker state, cooldown status, and configuration).
  - Time-series volume arrays (hourly for 24h, daily for 7d/30d) split by provider and outcome.
  - Top queried barcodes and most frequent misses.
- `barcodeApiConfigSchema`: Full stored configuration:
  - `providers`: Record of provider settings (enabled, timeoutMs, dailyLimit, priority).
  - `retentionDays`: `z.number().int().min(7).nullable().default(30)`.
- `barcodeApiConfigPatchSchema`: Mutation request contract:
  - `providers`: Optional record of provider patch objects.
  - `retentionDays`: `z.number().int().min(7).nullable().optional()` (**NO default**, so omitted fields remain `undefined`).
- `barcodeApiProbeRequestSchema` & `barcodeApiProbeResponseSchema`: Diagnostic live probe contracts.
- `barcodeApiResetActionSchema`: Cooldown and breaker reset contracts.

## Related Code Files
- Create:
  - `packages/shared/src/schemas/admin/barcode-api.ts`
  - `packages/shared/src/schemas/admin/barcode-api.test.ts`
  - `api/prisma/migrations/20260912190000_add_barcode_api_call_logs/migration.sql`
- Modify:
  - `api/prisma/schema.prisma`
  - `packages/shared/src/schemas/admin/system.ts`
  - `packages/shared/src/schemas/admin/index.ts`
  - `packages/shared/src/index.ts`

## Implementation Steps
1. Add `BarcodeApiCallLog` model to `api/prisma/schema.prisma` with explicit `@map` attributes on all non-PK/non-string fields.
2. Generate PostgreSQL migration `20260912190000_add_barcode_api_call_logs/migration.sql` with partial/compound indexes.
3. Apply migration to local development database and run `prisma generate`.
4. Create `packages/shared/src/schemas/admin/barcode-api.ts` defining all Zod schemas. Ensure `barcodeApiConfigPatchSchema.shape.retentionDays` is optional without a `.default(...)`.
5. Export new schemas through `packages/shared/src/index.ts`.
6. Write unit tests in `packages/shared/src/schemas/admin/barcode-api.test.ts` verifying schema parsing, edge cases, and that parsing `{}` with `barcodeApiConfigPatchSchema` leaves `retentionDays` as `undefined`.
7. Build `@expyrico/shared` and sync dist to local packages:
   `pnpm --filter @expyrico/shared build && cp -r packages/shared/dist apps/mobile/local-packages/@expyrico/shared/ && cp -r packages/shared/dist apps/mobile/node_modules/@expyrico/shared/`.

## Success Criteria
- [x] Prisma schema validates and compiles with `prisma generate`.
- [x] Database migration executes cleanly creating `barcode_api_call_logs` with all 4 indexes and explicit snake_case columns.
- [x] All Zod schemas parse valid and invalid payloads according to contract tests.
- [x] `barcodeApiConfigPatchSchema` parsing a payload without `retentionDays` outputs `retentionDays: undefined` rather than `30`.
- [x] `pnpm --filter @expyrico/shared build` and `pnpm --filter @expyrico/shared test` pass with 100% coverage.

## Risk Assessment
- **Risk:** Unintended overwrite of retention settings during provider timeout updates.
- **Mitigation:** Patch schema defines `retentionDays` as optional without default, and settings service preserves current retention when omitted.
- **Risk:** High-frequency logging causes table bloat over time.
- **Mitigation:** Index on `[createdAt]` allows efficient batch deletion for log retention cleanup (scheduled in Phase 2 via worker runner based on `retentionDays`).
- **Risk:** Storing large raw payloads exhausts storage.
- **Mitigation:** `rawResponsePreview` is strictly bounded to max 4KB, and headers sanitize sensitive authorization keys.
