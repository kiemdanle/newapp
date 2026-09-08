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

---

## Requirements

### Functional Requirements
1. **Restricted In-Store Barcode Fast-Path (Prefixes `20`–`29`, `02`)**:
   - Detect GS1 restricted distribution prefixes for variable-weight items (e.g. `251010537516`).
   - If a barcode matches these prefixes and is not found in the local database, immediately return `{ outcome: 'not_found', canCreate: await isProductCreationEligible(actor) }` without making any upstream network calls to OpenFoodFacts or UPCitemdb.
2. **Resilient Provider Chaining**:
   - Query OpenFoodFacts first; if found, persist and classify immediately.
   - If OpenFoodFacts is unavailable or not found, query UPCitemdb.
   - If UPCitemdb is found, persist and classify immediately.
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
     // GS1 variable-weight / in-store prefixes: 02, 20-29
     return /^(02|2[0-9])\d{6,}$/.test(clean);
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

     let anyUnavailable = false;

     const off = await lookupOff(input.barcode);
     if (off.status === 'found') {
       return classifyLocal(await persistExternal(off.data), actor);
     }
     if (off.status === 'unavailable') anyUnavailable = true;

     const upc = await lookupUpcitemdb(input.barcode);
     if (upc.status === 'found') {
       return classifyLocal(await persistExternal(upc.data), actor);
     }
     if (upc.status === 'unavailable') anyUnavailable = true;

     // If the user can create products, never lock them out with a dead-end error.
     // Fall back to not_found so they can add the item immediately.
     if (anyUnavailable && !canCreate) {
       return { outcome: 'temporarily_unavailable' };
     }

     return { outcome: 'not_found', canCreate };
   }
   ```

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
