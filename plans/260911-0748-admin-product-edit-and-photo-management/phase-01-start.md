---
phase: 1
title: "Schema and API Contracts for Product Edits"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Schema and API Contracts for Product Edits

<!-- Updated: Validation Session 1 - Barcode policy: Allow editing but prevent clearing once set -->

## Overview
Extend `@expyrico/shared` validation schemas and Fastify `api` product patch route to support editing product `description` and `barcode`, complete with uniqueness conflict handling, barcode clearing protection, and audit log tracking.

## Requirements
- Functional:
  - `adminProductPatchSchema` in `@expyrico/shared` accepts optional `description: z.string().nullable().optional()` and `barcode: z.string().nullable().optional()`.
  - Empty string values for `description`, `brand`, and `category` can be sanitized to `null`.
  - **Barcode Policy**:
    - If a product already has a barcode, setting it to `null` or `""` is rejected by the API with HTTP 400 (`Cannot clear an existing barcode from a product`).
    - Updating a barcode to another non-empty string is permitted, provided the new barcode is unique across products.
    - If a product currently has no barcode (`null`), an admin can assign one.
  - `adminProductsPatchRoute` in `api/src/routes/admin/products/patch.ts` writes `description` and `barcode` in the transaction.
  - If a barcode is provided that is already assigned to another product (`id !== targetId`), the API returns HTTP 409 with code `conflict` and a clear error message.
  - Changes to `description` and `barcode` are diffed and recorded in `AdminAuditLog` (`product.update`).
- Non-functional:
  - Zero regression on existing version conflict checking (`version_conflict`).
  - Strict type inference with TypeScript without `any`.

## Architecture
```
Client Request { version, name, brand, category, description, barcode, defaultShelfLifeDays }
       │
       ▼
adminProductPatchSchema.parse(body)
       │
       ▼
adminProductsPatchRoute
       │
       ├── 1. Fetch current product & version
       ├── 2. Barcode check:
       │       ├── If before.barcode != null && (input.barcode === null || input.barcode === '')
       │       │    └── throw AppError(400, ERROR_CODES.VALIDATION, 'Cannot clear an existing barcode')
       │       └── If input.barcode changed: check unique barcode collision (exclude current product)
       │            └── Collision -> throw AppError(409, ERROR_CODES.CONFLICT, 'Barcode is already assigned to another product')
       ├── 3. tx.product.updateMany({ where: { id, version }, data: { ...fields, version: { increment: 1 } } })
       ├── 4. writeAuditLog({ action: 'product.update', diff: { before, after } }, tx)
       └── 5. Return updated AdminProductRow
```

## Related Code Files
- Modify: `packages/shared/src/schemas/admin/products.ts`
- Modify: `packages/shared/src/schemas/admin/products.test.ts`
- Modify: `api/src/routes/admin/products/patch.ts`
- Modify: `api/tests/integration/admin-product-moderation.test.ts`

## Implementation Steps
1. In `packages/shared/src/schemas/admin/products.ts`:
   - Add `description: z.string().nullable().optional()` to `adminProductPatchSchema`.
   - Add `barcode: z.string().trim().nullable().optional()` to `adminProductPatchSchema`.
   - Update `adminProductPatchSchema.refine(...)` to ensure `description` and `barcode` are recognized as valid editable fields.
2. In `packages/shared/src/schemas/admin/products.test.ts`:
   - Add unit test asserting `adminProductPatchSchema` accepts valid `description` and `barcode`.
3. In `api/src/routes/admin/products/patch.ts`:
   - If `before.barcode !== null && (input.barcode === null || (input.barcode !== undefined && input.barcode.trim() === ''))`:
     - Throw `AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'Cannot clear an existing barcode from a product' })`.
   - If `input.barcode !== undefined && input.barcode !== before.barcode && input.barcode !== null`:
     - Run query: `findFirst({ where: { barcode: input.barcode.trim(), id: { not: id } } })`.
     - If exists, throw `AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Barcode is already in use by another product' })`.
   - Include `description` and `barcode` in `data` object for `tx.product.updateMany`.
   - Ensure `afterDiff` includes `description` and `barcode` for `writeAuditLog`.
4. In `api/tests/integration/admin-product-moderation.test.ts`:
   - Add test case verifying admin PATCH updating `description` and `barcode` succeeds and writes audit log.
   - Add test case verifying duplicate barcode returns 409 conflict.
   - Add test case verifying attempt to clear an existing barcode returns 400 validation error.

## Success Criteria
- [ ] `adminProductPatchSchema.parse({ version: 1, description: 'New description', barcode: '8934567890123' })` passes validation.
- [ ] PATCH `/v1/admin/products/:id` successfully persists `description` and `barcode`.
- [ ] PATCH `/v1/admin/products/:id` attempting to clear existing barcode returns 400 Bad Request.
- [ ] PATCH `/v1/admin/products/:id` with duplicate barcode returns 409 Conflict with descriptive message.
- [ ] `pnpm --filter @expyrico/shared test` passes.
- [ ] `pnpm --filter @expyrico/api test` passes.

## Risk Assessment
- **Risk:** Prisma throws database-level `P2002` if a race condition occurs on barcode uniqueness.
  - **Observable signal:** 500 error instead of 409 on concurrent barcode updates.
  - **Pre-decided response:** Wrap update transaction in try/catch for Prisma `P2002` and map to `AppError(409, ERROR_CODES.CONFLICT, 'Barcode is already in use by another product')`.
