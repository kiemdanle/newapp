---
phase: 1
title: "Upstream Client Resiliency & Rate-Limit Isolation"
status: todo
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Upstream Client Resiliency & Rate-Limit Isolation

## Overview
Harden the external product lookup clients (`off-client.ts` for OpenFoodFacts and `upcitemdb-client.ts` for UPCitemdb) against latency timeouts, trial-tier rate limiting (HTTP 429), and 12/13-digit EAN/UPC-A formatting mismatches.
<!-- Updated: Red Team Review - Quota cooldown & clean 3500ms timeout budget -->
<!-- Updated: Validation Session 1 - Silent 429 handling & 12/13-digit fallback -->

---

## Requirements

1. **OpenFoodFacts Latency Tolerance**:
   - Increase `getJson` timeout in `off-client.ts` from `1500ms` to `3500ms`.
   - Update `offBreaker` timeout from `2000ms` to `4000ms` to cleanly enclose the single HTTP request deadline.
   - Rely on OpenFoodFacts' native server-side read normalization (which automatically normalizes 12-digit UPCs to 13-digit EANs on lookup), eliminating redundant sequential 404 retries and keeping scan latency bounded under 3.5s.
2. **UPCitemdb Rate-Limit Isolation & Quota Cooldown (HTTP 429)**:
   - In `fetchUpc()`, intercept `HttpError` with status `429 Too Many Requests`.
   - Do NOT throw `429` into `upcBreaker`. Instead, return `{ status: 'not_found' }`.
   - Maintain an in-memory quota cooldown timestamp (`upcQuotaCooldownUntil`): when HTTP 429 is encountered, set a 5-minute cooldown (or respect `Retry-After` header if present). During cooldown, `lookupUpcitemdb` skips outbound network requests entirely and returns `{ status: 'not_found' }`, preventing quota hammering.
3. **Dedicated User-Agent & Headers**:
   - Maintain the compliant User-Agent header `'PantryApp/1.0 (+self-hosted)'` required by OpenFoodFacts.

### Non-Functional Requirements
- Circuit breaker remains active for genuine 5xx server errors or sustained network drops.
- Backward-compatible with existing `ExternalLookupResult` types (`found | not_found | unavailable`).

---

## Architecture

```
                  ┌──────────────────────────────┐
                  │        fetchOff(barcode)     │
                  └──────────────┬───────────────┘
                                 │
                   Timeout: 3500ms (was 1500ms)
                                 │
                        ┌────────┴────────┐
                        │ 404 on 12-digit?│
                        └───────┬─────────┘
                         Yes    │    No
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
        [ Retry 0${barcode} ]          [ Process Response ]

─────────────────────────────────────────────────────────────────

                  ┌──────────────────────────────┐
                  │       fetchUpc(barcode)      │
                  └──────────────┬───────────────┘
                                 │
                        ┌────────┴────────┐
                        │ Catch Error     │
                        └───────┬─────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
          Status 429 or 404              Status 5xx / Timeout
        [ Return 'not_found' ]          [ Throw to Circuit Breaker ]
        [ (Does not trip breaker) ]     [ (Trips breaker safely) ]
```

1. **Update `api/src/services/products/off-client.ts`**:
   - Change `timeoutMs` in `fetchOff` from `1500` to `3500`.
   - In `offBreaker` configuration, adjust `timeout` from `2000` to `4000`.
   - Clean single-request execution with 3500ms timeout:
     ```typescript
     let raw: unknown;
     try {
       raw = await getJson<unknown>(OFF_URL(barcode), {
         timeoutMs: 3500,
         headers: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
       });
     } catch (err) {
       if (err instanceof HttpError && err.status === 404) return { status: 'not_found' };
       throw err;
     }
     ```

2. **Update `api/src/services/products/upcitemdb-client.ts`**:
   - Implement 5-minute quota cooldown and 429 interception:
     ```typescript
     let upcQuotaCooldownUntil = 0;

     async function fetchUpc(barcode: string): Promise<ExternalLookupResult> {
       if (Date.now() < upcQuotaCooldownUntil) {
         return { status: 'not_found' }; // Quota cooldown active: skip network call
       }

       let raw: unknown;
       try {
         raw = await getJson<unknown>(UPC_URL(barcode), { timeoutMs: 2000 });
       } catch (err) {
         if (err instanceof HttpError) {
           if (err.status === 404) return { status: 'not_found' };
           if (err.status === 429) {
             // Rate limit reached: back off for 5 minutes without tripping breaker
             upcQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
             return { status: 'not_found' };
           }
         }
         throw err;
       }
       }
     }
     ```
   - Log a debug warning when 429 is encountered so quota exhaustion is observable in server metrics without affecting user scans.

3. **Verify Upstream Client Unit Tests**:
   - Run `npm --prefix api test -- src/services/products/lookup.test.ts`.

---

## Success Criteria
- [ ] OpenFoodFacts calls tolerate up to 3500ms latency without timing out.
- [ ] 12-digit barcodes query both 12-digit and 13-digit variants in OpenFoodFacts.
- [ ] UPCitemdb HTTP 429 responses return `{ status: 'not_found' }` without throwing errors into `upcBreaker`.
- [ ] `upcBreaker` remains closed when 429 occurs, keeping subsequent lookups functional.
- [ ] All unit tests in `src/services/products/lookup.test.ts` pass cleanly.

---

## Risk Assessment
- *Risk*: Increasing OpenFoodFacts timeout to 3500ms increases worst-case client latency when OpenFoodFacts is completely unresponsive.
- *Mitigation*: The circuit breaker volume threshold (5 failures) and 50% error rate threshold will quickly isolate OpenFoodFacts if it drops offline completely, keeping subsequent lookups fast.
