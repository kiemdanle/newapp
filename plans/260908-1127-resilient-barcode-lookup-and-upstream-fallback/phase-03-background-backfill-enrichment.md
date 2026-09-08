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

---

## Requirements

### Functional Requirements
1. **Queue Enqueue on `lookup-v2` Misses**:
   - In `api/src/routes/products/lookup-v2.ts`, when a barcode lookup yields `not_found`, enqueue the barcode to the background lookup queue (`enqueueLookupBackfill(input.barcode, req.user!.id)`).
   - Do NOT enqueue restricted in-store barcodes (`20`–`29`, `02`) to prevent wasteful background jobs on private retail barcodes.
2. **Worker Retry & Enrichment**:
   - In `workers/product-lookup.ts`, ensure the worker retries failed jobs with exponential backoff (BullMQ standard).
   - When the worker resolves an external product, it calls `persistExternal()` which inserts the active product row in PostgreSQL.

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
- Modify: `api/src/routes/products/lookup-v2.ts`
- Modify: `api/src/workers/product-lookup.ts`
- Modify: `api/src/services/products/lookup-backfill.ts`

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

2. **Harden Worker Error Handling in `api/src/workers/product-lookup.ts`**:
   - Verify worker concurrency and job retention options (`removeOnComplete: 100`, `removeOnFail: 200`).

3. **Verify with Integration Tests**:
   - Add test verifying `lookup-v2` fires `enqueueLookupBackfill` on a clean miss with standard barcode.

---

## Success Criteria
- [ ] Misses on `POST /v1/products/lookup-v2` enqueue backfill jobs to BullMQ.
- [ ] Restricted in-store barcodes (`20`–`29`, `02`) are excluded from backfill enqueuing.
- [ ] Client latency on `/lookup-v2` remains completely unaffected.
