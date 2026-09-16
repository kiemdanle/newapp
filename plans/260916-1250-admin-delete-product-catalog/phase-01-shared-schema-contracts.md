---
phase: 1
title: "Shared Schema & Error Contracts"
status: complete
priority: P1
effort: "45m"
dependencies: []
---

# Phase 1: Shared Schema & Error Contracts

## Overview
Extends the shared contracts in `@expyrico/shared` so that admin product projections report how many pantry items are using each product, and defines standardized error codes and payload contracts for blocked product deletion attempts.

## Requirements
- Functional:
  - Add `pantryItemCount` to `adminProductRowSchema` (`z.number().int().nonnegative().default(0)`), representing the total number of pantry items (`Record` rows) referencing the product.
  - Add `adminProductDeleteQuerySchema = z.object({ version: z.coerce.number().int().min(1) })` in `packages/shared/src/schemas/admin/products.ts` for optimistic concurrency protection against deleting stale or concurrently modified products.
  - Define standard error codes `PRODUCT_HAS_PANTRY_ITEMS: 'product_has_pantry_items'` and `PRODUCT_NOT_FOUND: 'product_not_found'` in `packages/shared/src/schemas/error.ts` so clients can unambiguously differentiate a missing product from a missing pantry record.
  - Build `@expyrico/shared` package and verify schema type export parity.
- Non-functional:
  - Backward-compatible default (`default(0)`) so existing consumers do not break.
  - Zero breaking changes to public product contracts (`productSchema`).

## Architecture
The admin console needs to know whether a product can be deleted or must be merged. By adding `pantryItemCount` to `adminProductRowSchema`, both the admin products table and the product detail view have immediate access to usage metrics without extra API round trips.
When an in-use product deletion is attempted, the backend replies with 409 Conflict using `ERROR_CODES.PRODUCT_HAS_PANTRY_ITEMS` and structured detail (including the exact `pantryItemCount`), allowing both programmatic and user-facing error handling.

<!-- Updated: Validation Session 1 - error.ts path confirmed & any pantry record scope -->
<!-- Updated: Red Team Review - Added adminProductDeleteQuerySchema with version token -->
## Related Code Files
- Modify: `packages/shared/src/schemas/admin/products.ts`
- Modify: `packages/shared/src/schemas/error.ts`

## Implementation Steps
1. In `packages/shared/src/schemas/admin/products.ts`:
   - Add `pantryItemCount: z.number().int().nonnegative().default(0)` to `adminProductRowSchema`.
   - Add and export `adminProductDeleteQuerySchema = z.object({ version: z.coerce.number().int().min(1) })`.
2. In `packages/shared/src/schemas/error.ts`:
   - Add `PRODUCT_HAS_PANTRY_ITEMS: 'product_has_pantry_items'` and `PRODUCT_NOT_FOUND: 'product_not_found'` to `ERROR_CODES`.
3. Rebuild `@expyrico/shared` (`npm run build --workspace=@expyrico/shared`).
4. Validate schema export and typing via `npm run typecheck --workspace=@expyrico/shared`.
## Success Criteria
- [x] `adminProductRowSchema` parses objects with or without `pantryItemCount` defaulting to 0.
- [x] `AdminProductRow` TypeScript type includes `pantryItemCount: number`.
- [x] `adminProductDeleteQuerySchema` parses valid version integers and rejects missing/non-positive versions.
- [x] `ERROR_CODES.PRODUCT_HAS_PANTRY_ITEMS` is available across workspaces.
- [x] `ERROR_CODES.PRODUCT_NOT_FOUND` is available across workspaces.
- [x] `@expyrico/shared` builds cleanly without TypeScript or bundling errors.

## Risk Assessment
- Risk: Divergence between `@expyrico/shared` build output and workspace consuming apps.
  - Mitigation: Run `npm run build --workspace=@expyrico/shared` and check downstream workspaces before Phase 2.
