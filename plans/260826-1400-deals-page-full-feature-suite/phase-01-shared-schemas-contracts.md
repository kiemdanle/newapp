---
phase: 1
title: "Shared Schemas & Contracts"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Shared Schemas & Contracts

<!-- Updated: Validation Session 1 - Mandatory photo proof, hybrid store facets, optional expiry -->

## Overview
Expand the shared TypeScript contracts and Zod validation schemas for deals to support multi-faceted searching, store filtering, price range filtering, expiry filtering, new sorting options, mandatory photo proof on creation, and store facet querying. Build and sync `@expyrico/shared` to `apps/mobile/local-packages/@expyrico/shared`.

## Requirements

### Functional Requirements
- Expand `dealSortSchema` to support:
  - `'score'` (Top / Highest Wilson score)
  - `'new'` (Newest posted deals)
  - `'price_asc'` (Lowest price first)
  - `'price_desc'` (Highest price first)
  - `'expiry_asc'` (Expiring soonest first)
- Expand `dealListQuerySchema` to accept optional filters:
  - `q`: optional trimmed string (max 100 chars) for search across product name, brand, store name, note.
  - `store`: optional trimmed string (max 120 chars) for store name filter.
  - `minPrice`: optional positive number.
  - `maxPrice`: optional positive number.
  - `country`: optional 2-letter uppercase ISO country code or `'ALL'`.
  - `expiryStatus`: optional enum `['all', 'unexpired', 'expiring_soon']`.
  - `productId`: optional UUID to fetch deals for a specific product.
  - `sort`: default `'score'`.
  - `cursor`: optional string for pagination.
  - `limit`: number between 1 and 50 (default 20).
- Update `dealCreateSchema` to require mandatory `photoUrl` (receipt or price tag photo on app CDN) to prevent spam:
  ```ts
  export const dealCreateSchema = z.object({
    productId: z.string().uuid(),
    price: priceField,
    currency: currencyField.optional(),
    storeName: storeNameField,
    photoUrl: photoUrlField, // Mandatory per Validation Session 1
    expiryDate: expiryField.optional(), // Optional per Validation Session 1
    note: noteField,
  });
  ```
- Add `dealStoreFacetSchema` defining popular store suggestions `{ name: string, count: number }`.

### Non-Functional Requirements
- Strictly validate all fields with Zod; prevent prototype pollution and SQL injection via parameterized inputs.
- Ensure 100% type compatibility across `@expyrico/shared`, `apps/api`, `apps/mobile`, and `apps/admin`.

## Architecture
```
packages/shared/src/schemas/deal.ts
  ├── dealSortSchema (score, new, price_asc, price_desc, expiry_asc)
  ├── dealListQuerySchema (q, store, minPrice, maxPrice, country, expiryStatus, productId, sort, cursor, limit)
  ├── dealStoreFacetSchema
  └── dealCreateSchema (Mandatory photoUrl, optional expiryDate)
         │
         ├── Build via `pnpm build` in packages/shared
         └── Sync dist to apps/mobile/local-packages/@expyrico/shared/dist
```

## Related Code Files
- Modify: `packages/shared/src/schemas/deal.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/mobile/local-packages/@expyrico/shared/dist/schemas/deal.d.ts`
- Modify: `apps/mobile/local-packages/@expyrico/shared/dist/schemas/deal.js`
- Test: `packages/shared/src/schemas/deal.test.ts` (create/update)

## Implementation Steps
1. **Update `packages/shared/src/schemas/deal.ts`:**
   - Define `dealSortSchema = z.enum(['score', 'new', 'price_asc', 'price_desc', 'expiry_asc']).default('score')`.
   - Define `dealExpiryStatusSchema = z.enum(['all', 'unexpired', 'expiring_soon']).default('all')`.
   - Update `dealListQuerySchema` with `q`, `store`, `minPrice`, `maxPrice`, `country`, `expiryStatus`, `productId`, `sort`, `cursor`, `limit`.
   - Update `dealCreateSchema` to require `photoUrl: photoUrlField` (mandatory photo proof).
   - Define `dealStoreFacetSchema` and export types `DealSort`, `DealExpiryStatus`, `DealListQuery`, `DealStoreFacet`.
2. **Add Unit Tests in `packages/shared/src/schemas/deal.test.ts`:**
   - Test default values, sort parsing, query string coercion for numbers (`minPrice`, `maxPrice`, `limit`), mandatory `photoUrl` enforcement, and invalid input rejections.
3. **Build & Propagate:**
   - Run `pnpm --filter @expyrico/shared build`.
   - Copy or build output to `apps/mobile/local-packages/@expyrico/shared/dist`.

## Success Criteria
- [ ] `dealSortSchema` validates all 5 sort options: `score`, `new`, `price_asc`, `price_desc`, `expiry_asc`.
- [ ] `dealListQuerySchema` parses `q`, `store`, `minPrice`, `maxPrice`, `country`, `expiryStatus`, and coerces numbers correctly.
- [ ] `dealCreateSchema` requires `photoUrl` and rejects deals without proof photo.
- [ ] Shared package builds without errors and local package is synchronized.
- [ ] Unit tests in `packages/shared/src/schemas/deal.test.ts` pass 100%.

## Risk Assessment
- **Risk:** Type mismatch between Fastify query parser string types and Zod number expectations.
- **Mitigation:** Use `z.coerce.number()` on `minPrice`, `maxPrice`, and `limit` in `dealListQuerySchema`.
