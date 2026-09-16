---
phase: 1
title: "Contracts & Shared Schemas"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Contracts & Shared Schemas

## Overview
Define end-to-end type-safe Zod contracts in `@expyrico/shared` for the admin pantry items management suite. This includes query parameters (search, filter, sort, page, limit), paginated list responses, detailed item representations, mutation payloads for editing, and filter option aggregates.

---

## Requirements

### Functional Requirements
- Define `adminPantryItemsQuerySchema`:
  - `q`: optional string for cross-field keyword search (customName, product name, brand, category, notes, user email, barcode).
  - `location`: optional string for storage location filtering (e.g., "Fridge", "Freezer", "Pantry", "Cabinet").
  - `category`: optional string for category filtering.
  - `brand`: optional string for brand filtering.
  - `productId`: optional UUID string for filtering items tied to a specific catalog product.
  - `productType`: optional enum `'all' | 'catalog' | 'custom'` for filtering between items linked to catalog products vs custom manual additions.
  - `userId`: optional UUID string for filtering by owner account.
  - `status`: optional enum `'all' | 'active' | 'consumed' | 'discarded' | 'expired'` (defaulting to all if omitted).
  - `sortBy`: enum `'createdAt' | 'expiryDate' | 'updatedAt' | 'quantity' | 'name'` (default `'expiryDate'`).
  - `sortOrder`: enum `'asc' | 'desc'` (default `'asc'`).
  - `page`: integer coerced, minimum 1, default 1.
  - `limit`: integer coerced, minimum 1, maximum 100, default 25.
- Define `adminPantryItemRowSchema` for the list table representation:
  - `id`: string (UUID).
  - `userId`: string (UUID).
  - `userName`: string (e.g. "Jane Doe" or "—").
  - `userEmail`: string.
  - `productId`: string | null.
  - `productName`: string | null.
  - `productBarcode`: string | null.
  - `customName`: string | null.
  - `displayName`: string (computed fallback: customName || productName || 'Untitled item').
  - `brand`: string | null.
  - `category`: string | null.
  - `expiryDate`: string (ISO date YYYY-MM-DD).
  - `purchaseDate`: string | null (ISO date YYYY-MM-DD).
  - `quantity`: number.
  - `unit`: string.
  - `price`: number | null.
  - `store`: string | null.
  - `location`: string | null.
  - `status`: `'active' | 'consumed' | 'discarded' | 'expired'`.
  - `photoUrl`: string | null.
  - `photoCount`: number.
  - `householdId`: string | null.
  - `householdName`: string | null.
  - `createdAt`: string (ISO datetime).
  - `updatedAt`: string (ISO datetime).
- Define `adminPantryItemsListSchema`:
  - `items`: array of `adminPantryItemRowSchema`.
  - `total`: number (total items matching filters).
  - `page`: number.
  - `limit`: number.
  - `totalPages`: number (ceil(total / limit)).
- Define `adminPantryItemDetailSchema`:
  - All row fields plus `notes`, `photoUrls` (string[]), `notifyAt` (string[]), `consumedAt` (string | null), `discardedAt` (string | null), `discardReason` (string | null), `user` object (id, email, firstName, lastName, country), `product` object (id, name, brand, category, barcode, imageUrl, version), `household` object (id, name), `pushLogsCount`: number, `giveawaysCount`: number.
- Define `adminPantryItemPatchSchema`:
  - Optional editable fields constrained to match canonical record validation: `customName` (string max 120 | null), `brand` (string max 120 | null), `category` (string max 60 | null), `location` (string max 50 | null), `quantity` (number >= 0, max 100000), `unit` (string max 16), `expiryDate` (ISO date string YYYY-MM-DD), `purchaseDate` (ISO date string YYYY-MM-DD | null), `price` (number >= 0 | null), `store` (string max 120 | null), `notes` (string max 2000 | null), `status` (`'active' | 'consumed' | 'discarded' | 'expired'`), `discardReason` (string max 50 | null).
- Define `adminPantryFilterOptionsSchema`:
  - `locations`: string[] (sorted distinct locations).
  - `categories`: string[] (sorted distinct categories).
  - `brands`: string[] (top brands).

### Non-functional Requirements
- Pure schema definition with zero external runtime dependencies outside Zod.
- Full parity with TypeScript type export declarations in `@expyrico/shared`.

---

## Architecture
Schemas live in `packages/shared/src/schemas/admin/pantry-items.ts` and are re-exported directly through `packages/shared/src/index.ts`. Both Fastify API route handlers and Next.js admin server components will import and validate against these shared schemas.

```
                  ┌─────────────────────────────────────────┐
                  │ packages/shared/src/schemas/admin/     │
                  │              pantry-items.ts            │
                  └────────────────────┬────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
  api/src/routes/admin/pantry-items/*           apps/admin/src/lib/admin-api.ts
  (Incoming query & body validation,            (Outbound API requests &
   Outgoing response serialization)              response parsing)
```

---

## Related Code Files
- Create: `packages/shared/src/schemas/admin/pantry-items.ts`
- Create: `packages/shared/src/schemas/admin/pantry-items.test.ts`
- Modify: `packages/shared/src/index.ts`

---

## Implementation Steps
1. Create `packages/shared/src/schemas/admin/pantry-items.ts`.
2. Implement `adminPantryItemsQuerySchema` with coercion and default values for `page: 1` and `limit: 25`.
3. Implement `adminPantryItemRowSchema`, `adminPantryItemsListSchema`, `adminPantryItemDetailSchema`, `adminPantryItemPatchSchema`, and `adminPantryFilterOptionsSchema`.
4. Export corresponding TypeScript types:
   - `AdminPantryItemsQuery`
   - `AdminPantryItemRow`
   - `AdminPantryItemsList`
   - `AdminPantryItemDetail`
   - `AdminPantryItemPatch`
   - `AdminPantryFilterOptions`
5. Export schemas directly from `packages/shared/src/index.ts` via `export * from './schemas/admin/pantry-items.js';`.
6. Write comprehensive unit tests in `packages/shared/src/schemas/admin/pantry-items.test.ts` verifying:
   - Query parser defaults (`page=1`, `limit=25`, `sortBy='expiryDate'`, `sortOrder='asc'`).
   - Query parser edge cases (`limit` clamping, invalid dates, invalid sort fields).
   - Patch validation (quantity bounds, status enum validation, date formats).
7. Build shared package and verify types compile cleanly with `npm run build` or `npm test`.

---

## Success Criteria
- [x] `adminPantryItemsQuerySchema` correctly parses and validates query strings with numeric coercions and sensible defaults.
- [x] `adminPantryItemRowSchema` accurately models the data shape required for the table view.
- [x] `adminPantryItemDetailSchema` accurately captures relational data (user, product, household, photos).
- [x] `adminPantryItemPatchSchema` rejects invalid statuses, negative quantities, or malformed dates.
- [x] Unit tests pass with 100% assertion success in `packages/shared`.

---

## Risk Assessment
- **Risk:** Type drift between shared schema and Prisma `Record` model (e.g. `Decimal` vs `number`).
  - *Mitigation:* Ensure API serializers explicitly map Prisma `Decimal` fields (`quantity`, `price`) to JavaScript numbers using `Number(r.quantity)` before schema parsing.
  - *Breakage Signal:* Zod validation throws `expected number, received object (Decimal)`.
  - *Response:* Add explicit numeric transformer in serializer and unit test coverage.

<!-- Updated: Validation Session 1 - Direct export from packages/shared/src/index.ts and default sort expiryDate asc -->

<!-- Updated: Red Team Review - Added expired status and bounded patch field constraints matching mobile recordSchema -->
