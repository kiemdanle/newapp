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

### Verification Results (Full Tier)
- **Claims Checked**: 15 across upstream clients, lookup-v2, and mobile scanner
- **Verified**: 15 | **Failed**: 0 | **Unverified**: 0
- **Key Fact Checks**:
  - `api/src/services/products/off-client.ts`: Confirmed `timeoutMs: 1500` and `offBreaker` `timeout: 2000` causing premature timeout drops.
  - `api/src/services/products/upcitemdb-client.ts`: Confirmed endpoint is `https://api.upcitemdb.com/prod/trial/lookup` and unhandled 429 trips breaker.
  - `api/src/services/products/lookup.ts`: Confirmed `findLocalExact` candidates `[raw, 0${raw}, raw.slice(1)]`, but external lookups only receive raw string.
  - `api/src/services/products/lookup.ts`: Confirmed `anyUnavailable` forces `temporarily_unavailable` even for eligible creators.
  - `apps/mobile/app/(app)/scan.tsx`: Confirmed `ui.phase === 'unavailable'` only presents retry and lacks manual escape hatch.

### Validation Interview Decisions (Session 1)
1. **Fail-Open Policy on External Outages (`upstream_fail_open_policy`)**:
   - *Decision*: **Fail-Open to Product Creation**.
   - *Rationale*: When external APIs are slow, rate-limited, or down, return `outcome: 'not_found'` with `canCreate: true`. Users must never be blocked from entering item names and adding groceries to their pantry.
2. **Latency Tolerance & Query Dispatch (`off_timeout_threshold`)**:
   - *Decision*: **Parallel Concurrent Upstream Queries**.
   - *Rationale*: Dispatch OpenFoodFacts and UPCitemdb concurrently via `Promise.allSettled` instead of sequential cascading. If either finds the item, persist immediately. Cuts maximum lookup latency in half.
3. **UPCitemdb HTTP 429 Quota Handling (`upc_429_quota_strategy`)**:
   - *Decision*: **Silent Skip (Do Not Trip Circuit Breaker)**.
   - *Rationale*: Catch `HttpError` status `429` as a silent skip (`{ status: 'not_found' }`). UPCitemdb trial tier quota limits must never trip the circuit breaker into `unavailable` or penalize other providers.
4. **In-Store Variable-Weight Barcodes (`in_store_barcode_fastpath`)**:
   - *Decision*: **Fast-Path to Creation (<10ms)**.
   - *Rationale*: Barcodes beginning with `20`–`29` or `02` (GS1 restricted distribution codes for deli, meat, and weighed produce) never exist in public catalogs. Skip external lookups immediately and return `not_found` with `canCreate: true`.

### Whole-Plan Consistency Sweep
- **Status**: Zero unresolved contradictions.
- **Propagations**:
  - Updated Phase 1 (`phase-01-upstream-client-resiliency-and-rate-limit-isolation.md`) to reflect silent 429 handling and dual 12/13-digit fallback.
  - Updated Phase 2 (`phase-02-service-fallback-and-classification.md`) to specify concurrent parallel query dispatch (`Promise.allSettled`) and fail-open creation fallback.
  - Updated Phase 3 (`phase-03-background-backfill-enrichment.md`) to enqueue backfill on `not_found` without blocking client latency.
  - Updated Phase 4 (`phase-04-mobile-scanner-resilience.md`) to provide the "Add as Private Item" escape hatch on error screens.

<!-- slug: resilient-barcode-lookup-and-upstream-fallback -->
