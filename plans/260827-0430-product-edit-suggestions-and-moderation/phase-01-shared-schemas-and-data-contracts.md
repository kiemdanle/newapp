---
phase: 1
title: "Shared schemas and data contracts"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Shared schemas and data contracts

<!-- Updated: Validation Session 1 - Added defaultShelfLifeDays & submitter notes, retained freeform category schema -->
<!-- Updated: Red Team Review - Strict numeric bounds (1-3650), non-empty trimmed notes validation (1-1000 chars) -->

## Overview
Expand shared product edit DTOs, schemas, and types in `@expyrico/shared` to support comprehensive product details—including `defaultShelfLifeDays` and submitter `notes` (reason for suggestion)—and ensure seamless TypeScript synchronization across the monorepo.

## Requirements

### Functional
- Add `defaultShelfLifeDays` (positive integer 1–3650, nullable, optional) to `productEditRowSchema` and `productEditMetadataPatchRequestSchema`.
- Add `notes` (trimmed string min 1, max 1000 characters, nullable, optional) to `productEditRowSchema` and `productEditMetadataPatchRequestSchema` to allow users to provide rationale/evidence to moderators when suggesting edits.
- Ensure category remains a validated string (`z.string().trim().max(120).nullable().optional()`).
- Ensure `adminProductEditDetailSchema` properly inherits all metadata attributes from `productEditRowSchema`.

### Non-functional
- Strict Zod parsing and typing with zero any-leaks.
- Backwards compatibility with existing historical ProductEdit rows.
- Rebuild `@expyrico/shared` and sync to `apps/mobile/local-packages/@expyrico/shared`.

## Architecture
```
packages/shared/src/schemas/
  ├── product-edits.ts   <-- productEditRowSchema, productEditMetadataPatchRequestSchema, adminProductEditDetailSchema
  ├── product.ts         <-- productSchema & productDescriptionValueSchema
  └── admin/products.ts  <-- Admin moderation resolve schemas
```

## Related Code Files
- Modify: `packages/shared/src/schemas/product-edits.ts`
- Modify: `packages/shared/src/schemas/product.ts`
- Modify: `packages/shared/src/schemas/admin/products.ts`
- Create/Modify: `packages/shared/src/schemas/product-edits.test.ts`
- Sync: `apps/mobile/local-packages/@expyrico/shared/**`

## Implementation Steps
1. In `packages/shared/src/schemas/product-edits.ts`:
   - Extend `productEditRowSchema` with `defaultShelfLifeDays: z.number().int().min(1).max(3650).nullable()` and `notes: z.string().nullable()`.
   - Extend `productEditMetadataPatchRequestSchema` with:
     ```typescript
     defaultShelfLifeDays: z.number().int().min(1).max(3650).nullable().optional(),
     notes: z.string().trim().min(1).max(1000).nullable().optional(),
     ```
   - Ensure `adminProductEditDetailSchema` extends `productEditRowSchema` and reflects all newly added fields.
2. Write unit tests in `packages/shared/src/schemas/product-edits.test.ts` validating:
   - Valid edit row parsing with and without `defaultShelfLifeDays` and `notes`.
   - Rejection of invalid shelf life (e.g. negative numbers, 0, decimals, or >3650).
   - Rejection of excessive notes (>1000 chars) or empty string note when provided.
3. Run `pnpm --filter @expyrico/shared build` and copy/sync built outputs to `apps/mobile/local-packages/@expyrico/shared/dist/`.

## Success Criteria
- [x] `packages/shared` builds cleanly with `pnpm --filter @expyrico/shared build`.
- [x] All Zod schema unit tests in `packages/shared` pass without errors.
- [x] Mobile local package `@expyrico/shared` dist files are updated and in sync with `packages/shared`.

## Risk Assessment
- *Risk*: Drift between `packages/shared` and `apps/mobile/local-packages/@expyrico/shared`.
- *Mitigation*: Run automatic post-build synchronization script/step and verify mobile typechecking directly in phase tests.
