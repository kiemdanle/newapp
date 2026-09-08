---
title: Resilient Barcode Lookup and Upstream Fallback
date: 2026-09-08
summary: "Hardened barcode lookup pipeline against external API timeouts, rate limiting, and outages"
---

# Resilient Barcode Lookup and Upstream Fallback

Hardened barcode lookup pipeline against external API timeouts, rate limiting, and outages.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Problem

Mobile barcode scanning frequently resulted in a blocking `"Lookup is temporarily unavailable"` dead-end. The root causes were:
1. OpenFoodFacts latency regularly taking 1.6s to 3.2s from mobile networks, exceeding the 1500ms client timeout and tripping circuit breakers.
2. UPCitemdb free trial tier responding with HTTP 429, which was previously treated as an unhandled error, tripping the circuit breaker.
3. Cascading `anyUnavailable` flag poisoning conclusive misses into `temporarily_unavailable`, completely blocking eligible creators from manually adding products or private items.
4. In-flight lookup continuation race in `scan.tsx` where late network arrivals overwrote manual input forms after users pressed cancel.

## Changes Applied

### 1. Upstream Client Resiliency (`api/src/services/products/`)
- `off-client.ts`: Increased `timeoutMs` to 3500ms and circuit breaker timeout to 4000ms.
- `upcitemdb-client.ts`: Intercepted HTTP 429 responses, returning `{ status: 'not_found' }` without tripping the breaker, and activated an in-memory 5-minute quota cooldown (`upcQuotaCooldownUntil`) with warning log.

### 2. Service-Level Fallback & Fast-Path (`lookup.ts`)
- Added `isRestrictedInStoreBarcode()` canonicalizing barcodes to GTIN-13 and detecting variable-weight prefixes (`02`, `20`–`29`), returning `not_found` with `canCreate: true` in <10ms without upstream network calls.
- Implemented `queryExternalProvidersConcurrently()` to race OpenFoodFacts and UPCitemdb concurrently, resolving immediately on the first positive hit. Replaced `Promise.withResolvers` with standard `new Promise` constructor to guarantee full Node 20 runtime compatibility in CI and production.
- Refactored `lookupProductV2` to fail-open for eligible creators: if external providers are unavailable, return `{ outcome: 'not_found', canCreate: true }` so users can add items immediately.

### 3. Background Backfill Queue (`lookup-v2.ts`, `server.ts`, `workers/product-lookup.ts`)
- Wired `setLookupBackfillEnqueuer` in `server.ts` to enqueue `not_found` non-restricted barcode misses to BullMQ (`product-lookup` queue) with deduplication (`jobId: backfill__${barcode}`), 3 attempts, and exponential backoff.
- Exported `lookupProductForBackfill` returning `{ product, status: 'found' | 'not_found' | 'unavailable' }`.
- Hardened worker to throw a retryable `Error` on `unavailable` so BullMQ automatically retries on transient network outages.

### 4. Mobile Scanner UI Resilience (`apps/mobile/`)
- Wired `signal?: AbortSignal` into `apiClient` and `useProductLookupV2`.
- Added monotonic generation counter (`lookupGenerationRef`) and `activeAbortControllerRef` in `scan.tsx`, guarding both `try` and `catch` continuations so late-settling responses after cancel or unmount never tear down manual forms.
- Added "Cancel & Enter Manually" button in the `looking-up` phase.
- Added "Add to Pantry Manually" button on the `unavailable` card.
- Retained timer in `lookupTimeoutRef` with 8s timeout, cleanly cleared on unmount, cancel, and completion.
- Threaded `scannedBarcode` into `AddRecordForm`, creating a private product draft with barcode attached and locking personal scope (`lockedPersonalScope={true}`).

## Verification

- `api/src/services/products/lookup.test.ts`: 37/37 tests pass.
- `api/src/services/products/upcitemdb-client.test.ts`: 4/4 tests pass.
- `api/src/workers/product-lookup.test.ts`: 3/3 tests pass.
- `api/tests/integration/products-draft-lifecycle.test.ts`: 42/42 tests pass.
- `apps/mobile/__tests__/routes/scan.test.tsx`: 30/30 tests pass.
- Full mobile test suite: 143/143 test suites and 899/899 tests pass.
- Full TypeScript typecheck on `api` and `apps/mobile`: 0 errors.
- Android APK debug build via local Gradle: `BUILD SUCCESSFUL in 19s`.
- Streamed install to physical device via ADB: `Success`.
- Live device smoke test: application launched cleanly with Expyrico branding, navigated to scanner, and opened manual item entry.
