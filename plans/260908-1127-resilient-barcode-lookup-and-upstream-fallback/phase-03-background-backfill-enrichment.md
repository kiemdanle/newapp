---
phase: 3
title: "Background Backfill & Barcode Queue"
status: todo
priority: P2
effort: "3h"
dependencies: [2]
---

# Phase 3: Background Backfill & Barcode Queue

## Overview
Connect `lookup-v2` and manual item creation to the background backfill queue (`enqueueLookupBackfill` / `workers/product-lookup.ts`) so that products missed during synchronous scanning due to transient upstream network latency are asynchronously fetched, enriched, and cached in PostgreSQL for subsequent scans.
<!-- Updated: Contract Verifier Audit - Worker return contract correction and retryable outage error propagation -->
<!-- Updated: Red Team Review - Server bootstrap enqueuer registration & BullMQ retry options -->

---

## Requirements

### Functional Requirements
1. **Queue Enqueue on `lookup-v2` Misses**:
   - In `api/src/routes/products/lookup-v2.ts`, when a barcode lookup yields `not_found`, enqueue the barcode to the background lookup queue (`enqueueLookupBackfill(input.barcode, req.user!.id)`).
   - Do NOT enqueue restricted in-store barcodes (`20`–`29`, `02`) to prevent wasteful background jobs on private retail barcodes.
2. **Worker Return Contract Correction & Retryable Outage Propagation**:
   - **Root Cause & Contract Bug**: Currently, `lookup.ts:138` returns `LegacyLookupResult` (`{ product: ProductWithPhotos | null; privateReservation: boolean }`), but `workers/product-lookup.ts:19-38` dynamically casts it as `Promise<{ id: string } | null>`. In JavaScript, the wrapper object `{ product: null, privateReservation: false }` is truthy, so every lookup miss is logged as a false hit with `productId: undefined`. Furthermore, `lookupProduct` swallows `unavailable` upstream statuses and returns `{ product: null }`, so transient outages complete successfully as "hits" and BullMQ **never retries**!
   - **Correction**: Export a dedicated backfill method from `api/src/services/products/lookup.ts`:
     ```typescript
     export async function lookupProductForBackfill(barcode: string): Promise<{
       product: ProductWithPhotos | null;
       status: 'found' | 'not_found' | 'unavailable';
     }>
     ```
   - In `workers/product-lookup.ts`:
     * On `status === 'found'`: Log `product backfill hit` with `product.id`, completing the job.
     * On `status === 'unavailable'`: **Throw a retryable Error** so BullMQ logs the failure and automatically retries the job with exponential backoff!
     * On `status === 'not_found'`: Log `product backfill miss` and complete the job cleanly without retry.

### Non-Functional Requirements
- Enqueuing must be fire-and-forget (`void enqueueLookupBackfill(...)`) so the client HTTP response is never blocked.
- Safe when queue infrastructure (Redis) is disabled or unreachable.

---

## Architecture

```
                    User Scans Uncached Barcode
                               │
                               ▼
                       POST /v1/lookup-v2
                               │
                Synchronous Miss (not_found)
                               │
          ┌────────────────────┴────────────────────┐
          ▼                                         ▼
   Immediate Response                    Background BullMQ Job
   to Mobile App:                        enqueueLookupBackfill()
   { outcome: 'not_found' }                         │
   (User creates item without waiting)              ▼
                                          Worker: lookupProduct()
                                          (Longer timeout / retries)
                                                    │
                                                    ▼
                                           Found in Upstream?
                                         Yes        │        No
                            ┌───────────────────────┘        └──────────┐
                            ▼                                           ▼
                 [ Save to PostgreSQL ]                             [ End Job ]
                 (Next scan is instant hit!)
```

---

## Related Code Files
- Modify: `api/src/server.ts`
- Modify: `api/src/routes/products/lookup-v2.ts`
- Modify: `api/src/workers/product-lookup.ts`
- Modify: `api/src/services/products/lookup-backfill.ts`
- Modify: `api/src/services/products/lookup.ts`
- Create: `api/src/workers/product-lookup.test.ts`
---

## Implementation Steps

1. **Wire Backfill in `api/src/routes/products/lookup-v2.ts`**:
   - Import `enqueueLookupBackfill` from `../../services/products/lookup-backfill.js`.
   - Import `isRestrictedInStoreBarcode` from `../../services/products/lookup.js`.
   - After computing `response`:
     ```typescript
     if (
       response.outcome === 'not_found' &&
       input.barcode &&
       !isRestrictedInStoreBarcode(input.barcode)
     ) {
       void enqueueLookupBackfill(input.barcode, req.user!.id);
     }
     ```

2. **Register Enqueuer in `api/src/server.ts`**:
   - In `buildServer()`, register the live BullMQ queue adapter with deduplication and retry options:
     ```typescript
     import { productLookupQueue } from './queues/product-lookup.js';
     import { setLookupBackfillEnqueuer } from './services/products/lookup-backfill.js';

     setLookupBackfillEnqueuer(async (barcode: string, requestedByUserId: string) => {
       const queue = productLookupQueue();
       await queue.add(
         'product-lookup',
         { barcode, requestedByUserId },
         {
           jobId: `backfill__${barcode}`, // Deduplicate identical in-flight barcodes
           attempts: 3,
           backoff: { type: 'exponential', delay: 5000 },
           removeOnComplete: 100,
           removeOnFail: 200,
         },
       );
     });
     ```

3. **Implement `lookupProductForBackfill` in `api/src/services/products/lookup.ts`**:
   - Re-use `queryExternalProvidersConcurrently(barcode)` to check OpenFoodFacts and UPCitemdb in parallel:
     ```typescript
     export async function lookupProductForBackfill(barcode: string): Promise<{
       product: ProductWithPhotos | null;
       status: 'found' | 'not_found' | 'unavailable';
     }> {
       const local = await findLocalExact({ barcode });
       if (local && local.status === 'active') return { product: local, status: 'found' };
       if (local) return { product: null, status: 'not_found' }; // private/under_review

       const { data: externalHit, anyUnavailable } = await queryExternalProvidersConcurrently(barcode);
       if (externalHit) {
         const persisted = await persistExternal(externalHit);
         return { product: persisted.status === 'active' ? persisted : null, status: 'found' };
       }
       if (anyUnavailable) {
         return { product: null, status: 'unavailable' };
       }
       return { product: null, status: 'not_found' };
     }
     ```

4. **Correct Worker Contract and Error Throw in `api/src/workers/product-lookup.ts`**:
   - Import `lookupProductForBackfill`:
     ```typescript
     const res = await lookupProductForBackfill(job.data.barcode);
     if (res.status === 'found' && res.product) {
       logger.info({ barcode: job.data.barcode, productId: res.product.id }, 'product backfill hit');
       return;
     }
     if (res.status === 'unavailable') {
       // Throw to let BullMQ handle retry with exponential backoff
       throw new Error(`Upstream providers unavailable for barcode ${job.data.barcode}`);
     }
     logger.info({ barcode: job.data.barcode }, 'product backfill miss');
     ```

5. **Add Unit Tests in `api/src/workers/product-lookup.test.ts`**:
   - Test job completes on `status === 'found'`.
   - Test job completes without retry on conclusive `status === 'not_found'`.
   - Test job throws Error on `status === 'unavailable'`, verifying BullMQ retry trigger.
---

## Success Criteria
- [ ] Misses on `POST /v1/products/lookup-v2` enqueue backfill jobs to BullMQ.
- [ ] Restricted in-store barcodes (`20`–`29`, `02`) are excluded from backfill enqueuing.
- [ ] `workers/product-lookup.ts` correctly consumes `lookupProductForBackfill` without treating `{ product: null }` as a hit.
- [ ] Upstream outages (`status === 'unavailable'`) throw a retryable error, triggering BullMQ retry with backoff.
- [ ] Unit tests in `api/src/workers/product-lookup.test.ts` pass cleanly.
- [ ] Client latency on `/lookup-v2` remains completely unaffected.
