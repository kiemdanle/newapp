---
phase: 5
title: "Integration Verification & Testing"
status: pending
priority: P1
effort: "2h"
dependencies: [3, 4]
---

# Phase 5: Integration Verification & Testing

## Overview
Perform end-to-end verification, typechecking, and automated test execution across all affected monorepo packages (`@expyrico/shared`, `api`, `apps/admin`). Validate that product edits and photo uploads work end-to-end with zero regressions, correct audit logging, and strict Expyrico palette compliance.

## Requirements
- Functional:
  - Run full monorepo typecheck: `pnpm turbo run typecheck` $\rightarrow$ 6/6 successful, 0 errors.
  - Run shared package test suite: `pnpm --filter @expyrico/shared test`.
  - Run API integration tests: `pnpm --filter @expyrico/api test tests/integration/admin-product-moderation.test.ts`.
  - Run admin unit and component tests: `pnpm --filter @expyrico/admin test`.
  - Verify audit logging: ensure every product patch and photo upload/reorder/delete writes an entry in `AdminAuditLog`.
- Non-functional:
  - Zero TypeScript `any` leaks.
  - Zero console warnings or deprecation notices.
  - Code passes lint and formatting rules.

## Verification Matrix

| Area | Test Target | Verification Command | Acceptance Criteria |
|------|-------------|----------------------|---------------------|
| **Schema** | `packages/shared/src/schemas/admin/products.test.ts` | `pnpm --filter @expyrico/shared test` | All patch schema tests pass including description, barcode, shelf life |
| **API** | `api/tests/integration/admin-product-moderation.test.ts` | `pnpm --filter @expyrico/api test` | Product patch updates description/barcode, logs audit, and detects duplicate barcode |
| **Admin Client** | `apps/admin/tests/unit/api-formdata.test.ts` | `pnpm --filter @expyrico/admin test` | `apiServerFetch` correctly streams `FormData` |
| **Admin UI** | `apps/admin/tests/unit/product-actions.test.ts` | `pnpm --filter @expyrico/admin test` | Full edit form submits payload and handles conflict errors |
| **Admin Photos** | `apps/admin/tests/unit/product-photo-manager.test.tsx` | `pnpm --filter @expyrico/admin test` | Dropzone, upload queue, set-as-cover, and delete work smoothly |
| **Monorepo** | All packages | `pnpm turbo run typecheck` | 6/6 packages clean |

## Related Code Files
- Verify: `packages/shared/src/schemas/admin/products.ts`
- Verify: `api/src/routes/admin/products/patch.ts`
- Verify: `apps/admin/src/lib/api.ts`
- Verify: `apps/admin/src/lib/admin-api.ts`
- Verify: `apps/admin/src/lib/actions.ts`
- Verify: `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx`
- Verify: `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx`

## Implementation Steps
1. Execute monorepo typecheck:
   ```bash
   pnpm turbo run typecheck
   ```
2. Execute shared package test suite:
   ```bash
   pnpm --filter @expyrico/shared test
   ```
3. Execute API tests covering product patch and photo mutations:
   ```bash
   pnpm --filter @expyrico/api test tests/integration/admin-product-moderation.test.ts
   ```
4. Execute Admin test suite:
   ```bash
   pnpm --filter @expyrico/admin test
   ```
5. Inspect `git diff` to verify only requested files are modified, no orphaned code exists, and Expyrico design rules are honored.

## Success Criteria
- [ ] All automated test suites pass without failures or unhandled rejections.
- [ ] TypeScript compiler passes across `@expyrico/shared`, `api`, `apps/admin`.
- [ ] Admin audit logging is fully verified for all product updates and photo actions.
- [ ] Working tree is clean and ready for review.

## Risk Assessment
- **Risk:** Type mismatch between Next.js Server Actions serialization and fastify responses.
  - **Observable signal:** Runtime error on deserializing `ActionResult` payload.
  - **Pre-decided response:** Ensure all server actions return plain serializable objects parsed by `@expyrico/shared` Zod schemas.
