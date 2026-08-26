---
phase: 2
title: "Backend API Search & Filters"
status: completed
priority: P1
dependencies: ["phase-01-shared-schemas-contracts"]
---

# Phase 2: Backend API Search & Filters

<!-- Updated: Validation Session 1 - Hybrid store facets, local-first with global fallback, mandatory photo on create -->

## Overview
Implement advanced search, store filtering, price range filtering, expiration filtering, and enhanced sorting in Fastify backend deal routes (`GET /v1/deals`). Implement hybrid store facets (`GET /v1/deals/stores`) merging curated major supermarket chains with dynamic database store counts. Implement local-first location scoping with seamless fallback to global deals when local listings are sparse.

## Requirements

### Functional Requirements
- **Search Query (`q`)**: Case-insensitive substring matching across `product.name`, `product.brand`, `storeName`, and `note`.
- **Store Filter (`store`)**: Case-insensitive exact or prefix match on `storeName`.
- **Price Range (`minPrice`, `maxPrice`)**: Filter by `price >= minPrice` and/or `price <= maxPrice`.
- **Expiry Status Filter (`expiryStatus`)**:
  - `'unexpired'`: `expiryDate >= today` OR `expiryDate IS NULL`.
  - `'expiring_soon'`: `expiryDate >= today` AND `expiryDate <= today + 7 days`.
  - `'all'`: No expiry restriction.
- **Location Scoping (Local-First with Global Fallback)**:
  - If `query.country` is explicitly supplied, scope to that country (or global if `'ALL'`).
  - If `query.country` is omitted and viewer has a registered country: query deals in viewer's country. If total found is < 5, execute fallback query including global deals (`country IS NULL` or all countries) to ensure users always see active deals.
- **Sorting Orders (`sort`)**:
  - `'score'`: `[{ score: 'desc' }, { createdAt: 'desc' }]`
  - `'new'`: `[{ createdAt: 'desc' }]`
  - `'price_asc'`: `[{ price: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }]`
  - `'price_desc'`: `[{ price: 'desc' }, { score: 'desc' }, { createdAt: 'desc' }]`
  - `'expiry_asc'`: `[{ expiryDate: 'asc' }, { score: 'desc' }]` (nulls last)
- **Hybrid Store Facets (`GET /v1/deals/stores`)**:
  - Seed with curated list: `["Trader Joe's", "ALDI", "Walmart", "Costco", "Target", "Whole Foods", "Kroger", "Safeway", "Lidl"]`.
  - Merge with top dynamic store names from `prisma.deal.groupBy({ by: ['storeName'], where: { status: 'visible' } })`.
  - Return unique list sorted by popularity.
- **Mandatory Photo on Creation (`POST /v1/deals`)**:
  - Enforce `input.photoUrl` is present and hosted on `DEAL_PHOTO_CDN_HOST`.

### Non-Functional Requirements
- Response time under 50ms for paginated deal queries.
- Safe Prisma query construction preventing injection or unindexed table scans.
- Rate limiting: 60 req/min for feed, 10 req/min for mutations.

## Architecture
```
GET /v1/deals (Query: q, store, minPrice, maxPrice, expiryStatus, country, sort, cursor, limit)
      │
      ├── Fastify Route Handler (api/src/routes/deals/list-feed.ts)
      │      │
      │      ├── Zod Validation (dealListQuerySchema)
      │      ├── Viewer Country Resolution & Fallback Logic (<5 items -> expand scope)
      │      ├── Prisma Filter Builder (api/src/services/deals/repository.ts)
      │      └── Prisma findMany with relations (product, user, dealVotes)
      │
GET /v1/deals/stores
      │
      └── Fastify Route Handler (api/src/routes/deals/stores.ts)
             └── Curated Stores + Prisma groupBy on storeName
```

## Related Code Files
- Modify: `api/src/routes/deals/list-feed.ts`
- Create: `api/src/routes/deals/stores.ts`
- Modify: `api/src/routes/deals/create.ts`
- Modify: `api/src/routes/deals/index.ts`
- Modify: `api/src/services/deals/repository.ts`
- Test: `api/tests/integration/deals-feed.test.ts`
- Test: `api/tests/integration/deals-stores.test.ts` (new)

## Implementation Steps
1. **Implement Enhanced Feed Query Builder (`api/src/routes/deals/list-feed.ts`):**
   - Parse `dealListQuerySchema`.
   - Build `where` clause with text search, store match, price range, and expiry status.
   - Implement local-first with global fallback logic.
   - Build dynamic `orderBy` array according to `query.sort`.
2. **Implement Store Facets Route (`api/src/routes/deals/stores.ts`):**
   - Route `GET /deals/stores`.
   - Merge curated supermarket list with dynamic database stores.
   - Register route in `api/src/routes/deals/index.ts`.
3. **Verify Creation Route Photo Validation (`api/src/routes/deals/create.ts`):**
   - Ensure `dealCreateSchema` parses and enforces mandatory `photoUrl` hosted on `DEAL_PHOTO_CDN_HOST`.
4. **Add Comprehensive Integration Tests (`api/tests/integration/deals-feed.test.ts`):**
   - Test search query matching product name and store name.
   - Test price filters (`minPrice`, `maxPrice`).
   - Test expiry status filters (`unexpired`, `expiring_soon`).
   - Test sorts (`price_asc`, `price_desc`, `expiry_asc`).
   - Test local-first scoping with global fallback.
   - Test `GET /v1/deals/stores` returns hybrid store facets.

## Success Criteria
- [ ] `GET /v1/deals` returns filtered results matching `q`, `store`, `minPrice`, `maxPrice`, `expiryStatus`.
- [ ] `GET /v1/deals?sort=price_asc` and `sort=price_desc` sort deals accurately by price.
- [ ] `GET /v1/deals?sort=expiry_asc` sorts deals by closest expiry date.
- [ ] `GET /v1/deals/stores` returns hybrid curated + dynamic store list.
- [ ] `POST /v1/deals` rejects requests missing `photoUrl`.
- [ ] All integration tests in `deals-feed.test.ts` pass with 100% assertions.

## Risk Assessment
- **Risk:** Case-insensitive search on unindexed fields causing high latency on large datasets.
- **Mitigation:** Use indexed foreign key relations and composite indexes; constrain max limit to 50 items per page.
