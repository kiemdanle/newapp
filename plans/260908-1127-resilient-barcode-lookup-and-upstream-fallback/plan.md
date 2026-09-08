---
title: "Resilient Barcode Lookup and Upstream Fallback Architecture"
description: "Eliminate 'Lookup is temporarily unavailable' errors through upstream rate-limit isolation, dual 12/13-digit fallback queries, increased timeout tolerance, and graceful degradation to manual pantry creation."
status: in-progress
priority: P1
effort: "2d"
tags: [barcode, lookup, openfoodfacts, upcitemdb, resilience, circuit-breaker, fallback]
created: 2026-09-08
---

# Resilient Barcode Lookup and Upstream Fallback Architecture

## Overview
Eliminate the `"Lookup is temporarily unavailable"` blocking state in the mobile pantry scanner and ensure 100% operational uptime for barcode scanning and item addition. This plan addresses root causes across upstream API timeouts, trial-tier rate limiting (HTTP 429), missing 12/13-digit barcode normalization, and circuit breaker cascading, ensuring users are never prevented from adding items to their pantry.

---

## Root Cause Analysis & Problem Statement

When users scan barcodes, two distinct user-facing outcomes can occur:
1. **"We couldn't find this item"** (`outcome: 'not_found'`): A conclusive miss where the user is immediately presented with an **"Add New Product"** button to input details.
2. **"Lookup is temporarily unavailable"** (`outcome: 'temporarily_unavailable'`): A dead-end error panel that tells the user to check their connection and retry, completely blocking product creation.

The investigation revealed that `temporarily_unavailable` is triggered by three compounding upstream flaws:
- **OpenFoodFacts Latency vs. Aggressive Timeout (`timeoutMs: 1500`)**: OpenFoodFacts servers are hosted in Europe (`world.openfoodfacts.org`). Live queries from Vietnam and mobile networks regularly take **1.6s to 3.2s**. The backend aborts queries at 1.5s, treating valid products as upstream timeouts.
- **UPCitemdb Trial Tier Rate Limit (HTTP 429)**: The backend queries `https://api.upcitemdb.com/prod/trial/lookup`. When the free trial rate limit is exceeded, UPCitemdb responds with `HTTP 429`. `upcitemdb-client.ts` treats 429 as an unhandled exception, which trips `upcBreaker` into `unavailable`.
- **Cascading `anyUnavailable` Flag**: In `api/src/services/products/lookup.ts`, if *either* upstream provider returns `unavailable` (even if UPCitemdb simply hit a 429 quota), `anyUnavailable = true`. When both providers finish without a hit, the backend returns `{ outcome: 'temporarily_unavailable' }` instead of concluding `not_found`, locking the user out.
- **Missing Upstream 12/13 Digit Normalization**: `findLocalExact()` tries both 12-digit UPC-A and 13-digit EAN (`0${barcode}`), but `lookupOff()` and `lookupUpcitemdb()` only transmit raw digits. Many UPC-A products exist in OpenFoodFacts under standard 13-digit EAN keys, returning false 404s when queried with 12 digits.

---

## Architectural Solution Design

```
                     ┌───────────────────────────────┐
                     │   User Scans Barcode / QR     │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │    findLocalExact (Postgres)  │
                     └───────┬───────────────┬───────┘
                             │ Local Hit     │ Local Miss
                             ▼               ▼
                      [ Instant Return ]  [ In-Store Check: Prefix 2 / 02? ]
                           (<10ms)           │ Yes: Skip upstream
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │        Parallel / Cascading Upstream          │
                     │  - OpenFoodFacts: 3500ms timeout + 12/13 pad │
                     │  - UPCitemdb: 429 caught as silent skip       │
                     └───────┬───────────────────────────────┬───────┘
                             │ External Hit                  │ All Missed / Down
                             ▼                               ▼
                     [ Cache in Postgres ]      [ Graceful Fallback ]
                     [ Return Product    ]      [ not_found + canCreate: true ]
                                                [ Immediate "Add Item" Screen ]
```

---

## Goals

| # | Goal | Priority | Description |
|---|------|----------|-------------|
| 1 | **Isolate UPCitemdb 429 Errors** | P1 | Catch HTTP 429 as a quota skip (`{ status: 'not_found' }`) so trial tier limits never trip circuit breakers or block users. |
| 2 | **OpenFoodFacts Latency Tolerance** | P1 | Increase `timeoutMs` to 3500ms with a single retry and dual 12/13-digit query fallback. |
| 3 | **Non-Blocking Service Classification** | P1 | Ensure upstream outages fall back to `not_found` with `canCreate: true`, allowing instant manual product creation. |
| 4 | **Asynchronous Background Backfill** | P2 | Enqueue manually added barcoded items to `workers/product-lookup.ts` for delayed metadata and photo enrichment. |
| 5 | **Mobile Scanner UI Resilience** | P2 | Update `scan.tsx` to provide an immediate "Add as Private Item" action on error screens. |

---

## Phases

| # | Phase | Status | Objective |
|---|-------|--------|-----------|
| 1 | [Upstream Client Resiliency & Rate-Limit Isolation](./phase-01-upstream-client-resiliency-and-rate-limit-isolation.md) | Todo | Harden `off-client.ts` and `upcitemdb-client.ts` against timeouts, 429s, and formatting mismatches. |
| 2 | [Service-Level Fallback & Non-Blocking Classification](./phase-02-service-fallback-and-classification.md) | Todo | Refactor `lookup.ts` so upstream downtime falls back to `not_found` with `canCreate: true`. |
| 3 | [Background Backfill & Barcode Queue](./phase-03-background-backfill-enrichment.md) | Todo | Ensure manually added barcoded items are enqueued for background metadata backfill. |
| 4 | [Mobile Scanner UI Resilience](./phase-04-mobile-scanner-resilience.md) | Todo | Update mobile scan screen to offer instant manual creation even if connectivity fails. |
| 5 | [Automated Testing & End-to-End Verification](./phase-05-testing-and-verification.md) | Todo | Validate 429 rate limit tolerance, timeout fallback, 12/13-digit normalization, and APK verification. |

---

## Success Criteria

- [ ] UPCitemdb `429 Too Many Requests` returns `{ status: 'not_found' }` (or skips) without tripping `upcBreaker`.
- [ ] OpenFoodFacts timeout increased to 3500ms and queries both raw and padded 13-digit barcodes on 12-digit input.
- [ ] In-store restricted barcodes (`20`–`29`, `02`) bypass external lookups directly to `not_found` with `canCreate: true`.
- [ ] `lookupProductV2` never returns `temporarily_unavailable` to users who are eligible to create products.
- [ ] Mobile scan screen allows users to immediately proceed to add the item even if external networks are completely offline.
- [ ] 100% test pass rate across API and mobile test suites; zero regression to existing product draft workflows.

---

## Validation Log

### Verification Results (Full Tier — 4 Roles Across 5 Phases)
- **Tier**: Full (all 4 roles active: Fact Checker, Flow Tracer, Scope Auditor, Contract Verifier)
- **Claims Checked**: 80 claims across all 5 phases (16 claims/phase)
- **Verified**: 79 | **Failed**: 1 | **Unverified**: 0
- **Failures**:
  1. `[Contract Verifier] api/src/workers/product-lookup.ts:19-42` — Failed return contract: worker types `lookupProduct` as `Promise<{ id: string } | null>`. In JavaScript, the actual wrapper object `{ product: null, privateReservation: false }` is truthy, so every lookup miss was treated as a false hit with `productId: undefined`. Furthermore, `lookupProduct` swallowed `unavailable` upstream statuses and returned `{ product: null }`, so transient outages completed as "hits" and BullMQ **never retried**. Reconciled in Phase 3 by exporting `lookupProductForBackfill` returning `{ product, status: 'found' | 'not_found' | 'unavailable' }` and throwing a retryable Error on `unavailable`.
- **Role-by-Role Audit Summary**:
  1. **Fact Checker (20 claims)**:
     - Confirmed `api/src/services/products/off-client.ts` (`lookupOff`, `offBreaker`) and `upcitemdb-client.ts` (`lookupUpcitemdb`, `upcBreaker`).
     - Confirmed `api/src/services/products/lookup-backfill.ts` (`enqueueLookupBackfill`, `setLookupBackfillEnqueuer`).
     - Confirmed `api/src/workers/product-lookup.ts` (`startProductLookupWorker`, `PRODUCT_LOOKUP_QUEUE`).
     - Confirmed mobile files `apps/mobile/app/(app)/scan.tsx` and `apps/mobile/src/api/products.ts`.
  2. **Flow Tracer (20 claims)**:
     - Traced `fetchOff()` 1500ms timeout and circuit breaker fallback to `{ status: 'unavailable' }`.
     - Traced `fetchUpc()` 429 status throwing error to `upcBreaker`.
     - Traced `lookupProductV2()` `findLocalExact` -> `classifyLocal` -> external fallback.
     - Traced `scan.tsx` `runLookup` -> `temporarily_unavailable` -> `setUi({ phase: 'unavailable' })`.
  3. **Scope Auditor (20 claims)**:
     - Audited `persistExternal` transaction lifetime, row-locking `SELECT ... FOR UPDATE`, and `P2002` race-retry safety.
     - Audited BullMQ worker job lifetime (`concurrency: 2`) and clean async enqueueing.
     - Audited screen-scoped UI states in `scan.tsx`.
  4. **Contract Verifier (20 claims)**:
     - Enumerated all callers of `lookupProductV2`: `lookup-v2.ts:8`, `product-drafts.ts:122, 160`, and 9 test suites in `lookup.test.ts`.
     - Enumerated callers of `enqueueLookupBackfill`: `routes/products/lookup.ts:25`.
     - Verified `ProductLookupV2Response` discriminated union schema in `@expyrico/shared`.

### Validation Interview Decisions (Session 1)
1. **Fail-Open Policy on External Outages (`upstream_fail_open_policy`)**:
   - *Decision*: **Fail-Open to Product Creation**.
   - *Rationale*: When external APIs are slow, rate-limited, or down, return `outcome: 'not_found'` with `canCreate: true`. Users must never be blocked from entering item names and adding groceries to their pantry.
2. **Latency Tolerance & Query Dispatch (`off_timeout_threshold`)**:
   - *Decision*: **True First-Hit Concurrent Resolution (`queryExternalProvidersConcurrently`)**.
   - *Rationale*: Query OpenFoodFacts and UPCitemdb in parallel, but resolve immediately on the first positive `found` hit without waiting for the slower provider (e.g. if UPCitemdb returns in 200ms, the response returns in 200ms without waiting for OpenFoodFacts' 3500ms timeout). Only if both providers miss or fail does the call wait for both to settle before falling back.
3. **UPCitemdb HTTP 429 Quota Handling (`upc_429_quota_strategy`)**:
   - *Decision*: **Silent Skip (Do Not Trip Circuit Breaker)**.
   - *Rationale*: Catch `HttpError` status `429` as a silent skip (`{ status: 'not_found' }`). UPCitemdb trial tier quota limits must never trip the circuit breaker into `unavailable` or penalize other providers.
4. **In-Store Variable-Weight Barcodes (`in_store_barcode_fastpath`)**:
   - *Decision*: **Fast-Path to Creation (<10ms)**.
   - *Rationale*: Barcodes beginning with `20`–`29` or `02` (GS1 restricted distribution codes for deli, meat, and weighed produce) never exist in public catalogs. Skip external lookups immediately and return `not_found` with `canCreate: true`.

### Whole-Plan Consistency Sweep
- **Status**: Zero unresolved contradictions.
- **Propagations & Reconciliations**:
  - Reconciled Phase 3 (`phase-03-background-backfill-enrichment.md`): corrected worker return contract bug (`lookupProductForBackfill`), added retryable Error throw on `unavailable`, and added `api/src/workers/product-lookup.test.ts`.
  - Reconciled Phase 2 (`phase-02-service-fallback-and-classification.md`): replaced `Promise.allSettled` (which waited for the slower provider) with `queryExternalProvidersConcurrently` to fulfill the promised immediate first-hit return.
  - Reconciled Phase 1 (`phase-01-upstream-client-resiliency-and-rate-limit-isolation.md`): silent 429 handling and dual 12/13-digit fallback.
  - Reconciled Phase 4 (`phase-04-mobile-scanner-resilience.md`): "Add as Private Item" escape hatch on error screens.
  - Reconciled Phase 5 (`phase-05-testing-and-verification.md`): updated verification matrix with `product-lookup.test.ts`.

---

## Red Team Review

### Session — 2026-09-08
**Findings:** 9 consolidated finding groups (9 accepted, 0 rejected)
**Severity Breakdown:** 1 Critical, 6 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Backfill enqueuer hook registration missing in `server.ts` bootstrap | High | Accept | Phase 3 |
| 2 | OpenFoodFacts timeout vs breaker budget mismatch and redundant 12/13 retry | High | Accept | Phase 1 |
| 3 | Barcode preservation missing when falling back to manual pantry creation | High | Accept | Phase 4 |
| 4 | Mobile escape hatch unreachable during hanging in-flight network request | High | Accept | Phase 4 |
| 5 | Household scope leak risk in scanner manual fallback | High | Accept | Phase 4 |
| 6 | Photo attachment blocking local save in manual fallback | High | Accept | Phase 4 |
| 7 | UPCitemdb trial cooldown & Retry-After backoff to avoid quota hammering | Medium | Accept | Phase 1 |
| 8 | In-store barcode prefix regex normalization precision (GTIN-13) | Medium | Accept | Phase 2 |
| 9 | In-flight lookup continuation race: late settlement after cancel navigates away | Critical | Accept | Phase 4 |

### Whole-Plan Consistency Sweep
- **Status**: Zero unresolved contradictions.
- **Verified Invariants Across All Plan Files**:
  1. **Worker Contract & Bootstrap**: `server.ts` registers `setLookupBackfillEnqueuer` with BullMQ retry options; `workers/product-lookup.ts` consumes `lookupProductForBackfill` and throws a retryable Error on `unavailable`.
  2. **Timeout Boundaries**: `off-client.ts` uses a clean single-request 3500ms timeout enclosed by a 4000ms breaker, with zero redundant retries.
  3. **Quota Protection**: `upcitemdb-client.ts` implements a 5-minute quota cooldown when HTTP 429 is encountered, returning `not_found` without hitting the network.
  4. **True Concurrent Resolution**: `lookup.ts` races external providers concurrently via `queryExternalProvidersConcurrently`, returning immediately on the first `found` hit.
  5. **Durable Barcode & Scope**: `scan.tsx` preserves `scannedBarcode` in `AddRecordForm`, honors active scope, applies a 5s client timeout, and renders an in-flight manual escape button.
  6. **Prefix Precision**: `isRestrictedInStoreBarcode` canonicalizes to GTIN-13 before checking prefix `02` or `20-29`.
  7. **Generation Invalidation & AbortSignal**: `scan.tsx` tracks a monotonic generation counter and active `AbortController`, guarding both try/catch continuations so late network arrivals after cancel/timeout never tear down the user's manual entry form; `apiClient` natively passes `AbortSignal` to `fetch` to cancel in-flight HTTP requests.
<!-- slug: resilient-barcode-lookup-and-upstream-fallback -->
