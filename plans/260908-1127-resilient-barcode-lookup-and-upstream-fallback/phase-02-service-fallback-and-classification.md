---
phase: 2
title: "Service-Level Fallback & Non-Blocking Classification"
status: todo
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Service-Level Fallback & Non-Blocking Classification

## Overview
Refactor `lookupProductV2` in `api/src/services/products/lookup.ts` to implement in-store restricted barcode fast-pathing, resilient provider chaining, and non-blocking fallback for product creators when external services are degraded.
<!-- Updated: Validation Session 1 - Parallel concurrent upstream queries & fail-open classification -->
<!-- Updated: Red Team Review - GTIN canonicalization for restricted prefix check -->

---

## Requirements

### Functional Requirements
1. **Restricted In-Store Barcode Fast-Path (Prefixes `20`–`29`, `02`)**:
   - Detect GS1 restricted distribution prefixes for variable-weight items (e.g. `251010537516`).
   - If a barcode matches these prefixes and is not found in the local database, immediately return `{ outcome: 'not_found', canCreate: await isProductCreationEligible(actor) }` without making any upstream network calls to OpenFoodFacts or UPCitemdb.
2. **True First-Hit Concurrent Upstream Queries**:
   - Dispatch OpenFoodFacts and UPCitemdb concurrently with immediate first-hit return: as soon as either provider returns `status === 'found'`, resolve immediately without waiting for the slower provider to finish or time out.
   - If both providers conclude not found or unavailable, resolve after both settle.
3. **Creator-Centric Fallback (No Dead Ends)**:
   - Check `canCreate = await isProductCreationEligible(actor)`.
   - If `canCreate === true` (user has permission to create products/drafts), an upstream timeout or 429 must **never block them** with `temporarily_unavailable`. Instead, return `{ outcome: 'not_found', canCreate: true }`, allowing them to proceed directly to the "Add New Product" screen.
   - Only return `{ outcome: 'temporarily_unavailable' }` if the actor is NOT eligible to create products (`canCreate: false`) and external providers were down.

### Non-Functional Requirements
- Preserve zero-overhead local database query speed (<10ms) via `findLocalExact`.
- Maintain atomic PostgreSQL persistence via `persistExternal`.

---

## Architecture

```
                    ┌──────────────────────────────┐
                    │    lookupProductV2(barcode)  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │       Local DB Search        │
                    └──────────────┬───────────────┘
                                   │ Miss
                                   ▼
                    ┌──────────────────────────────┐
                    │ Is In-Store Barcode (2/02)?  │
                    └──────────────┬───────────────┘
                        Yes        │        No
          ┌────────────────────────┘        └────────────────────────┐
          ▼                                                          ▼
   [ Fast-Path ]                                            ┌──────────────────┐
   [ not_found ]                                            │ Query Upstream   │
                                                            │ - OpenFoodFacts  │
                                                            │ - UPCitemdb      │
                                                            └────────┬─────────┘
                                                                     │
                                                    ┌────────────────┴────────────────┐
                                                    ▼                                 ▼
                                                Hit Found                       All Miss / Down
                                          [ Persist & Classify ]                      │
                                                                                      ▼
                                                                        ┌───────────────────────────┐
                                                                        │ canCreate (User Eligible)?│
                                                                        └─────────────┬─────────────┘
                                                                           Yes        │      No
                                                                    ┌─────────────────┘      └──────────────┐
                                                                    ▼                                       ▼
                                                             [ not_found ]                     [ temporarily_unavailable ]
                                                             [ (canCreate: true) ]             [ (Retry later) ]
```

---

## Related Code Files
- Modify: `api/src/services/products/lookup.ts`
- Test: `api/src/services/products/lookup.test.ts`
- Test: `api/tests/integration/products-draft-lifecycle.test.ts`

---

## Implementation Steps

1. **Add Barcode Prefix Helper in `api/src/services/products/lookup.ts`**:
   ```typescript
   export function isRestrictedInStoreBarcode(barcode?: string): boolean {
     if (!barcode) return false;
     const clean = barcode.trim();
     if (!/^\d{8,14}$/.test(clean)) return false;
     // Canonicalize to GTIN-13 representation: pad 12-digit UPC-A with leading zero
     const gtin13 = clean.length === 12 ? `0${clean}` : clean;
     // GS1 prefix 200-299 (restricted circulation) or prefix 02 (US retailer variable-measure)
     return /^(02|2[0-9])\d{6,}$/.test(gtin13);
   }
   ```

2. **Refactor `lookupProductV2` in `api/src/services/products/lookup.ts`**:
   ```typescript
   export async function lookupProductV2(
     input: LookupInput,
     actor: LookupActor,
   ): Promise<ProductLookupV2Response> {
     const local = await findLocalExact(input);
     if (local) return classifyLocal(local, actor);

     const canCreate = await isProductCreationEligible(actor);

     // QR local miss is conclusive; QR payloads aren't queryable externally.
     if (!input.barcode) return { outcome: 'not_found', canCreate };

     // In-store restricted barcodes are never registered externally.
     if (isRestrictedInStoreBarcode(input.barcode)) {
       return { outcome: 'not_found', canCreate };
     }

     // Concurrently race for first 'found' hit without waiting for slower provider
     const { data: externalHit, anyUnavailable } = await queryExternalProvidersConcurrently(input.barcode);
     if (externalHit) {
       return classifyLocal(await persistExternal(externalHit), actor);
     }

     // If the user can create products, never lock them out with a dead-end error.
     // Fall back to not_found so they can add the item immediately.
     if (anyUnavailable && !canCreate) {
       return { outcome: 'temporarily_unavailable' };
     }

     return { outcome: 'not_found', canCreate };
   }

   /**
    * Concurrently queries OpenFoodFacts and UPCitemdb. Resolves immediately
    * on the first positive 'found' hit, avoiding blocking on slower timeouts.
    */
   async function queryExternalProvidersConcurrently(barcode: string): Promise<{
     data?: ExternalProductData;
     anyUnavailable: boolean;
   }> {
     return new Promise((resolve) => {
       let settled = 0;
       let anyUnavailable = false;
       let completed = false;

       const checkProvider = async (
         lookupFn: (b: string) => Promise<ExternalLookupResult>,
       ) => {
         try {
           const res = await lookupFn(barcode);
           if (completed) return;
           if (res.status === 'found') {
             completed = true;
             resolve({ data: res.data, anyUnavailable });
             return;
           }
           if (res.status === 'unavailable') {
             anyUnavailable = true;
           }
         } catch {
           anyUnavailable = true;
         } finally {
           settled++;
           if (settled === 2 && !completed) {
             resolve({ anyUnavailable });
           }
         }
       };

       void checkProvider(lookupOff);
       void checkProvider(lookupUpcitemdb);
     });
   }

3. **Update Unit Tests in `lookup.test.ts`**:
   - Add test case verifying restricted in-store barcodes bypass external lookups.
   - Add test case verifying eligible creator receives `not_found` with `canCreate: true` even when external providers return `unavailable`.
   - Add test case verifying ineligible actor receives `temporarily_unavailable` when providers return `unavailable`.

---

## Success Criteria
- [ ] In-store barcodes starting with `20`–`29` or `02` resolve to `not_found` in <10ms without calling external APIs.
- [ ] Eligible creators are never blocked by `temporarily_unavailable`.
- [ ] Found external products are cached in PostgreSQL on first hit.
- [ ] All unit and integration tests in `api` pass without regressions.

---

## Risk Assessment
- *Risk*: If an external provider is temporarily unavailable, an eligible creator might create a draft for a product that could have been auto-filled.
- *Mitigation*: This is an intentional and beneficial trade-off: preventing a user from adding groceries to their pantry is far worse than allowing them to type the product name manually. Furthermore, Phase 3 backfills metadata asynchronously.
