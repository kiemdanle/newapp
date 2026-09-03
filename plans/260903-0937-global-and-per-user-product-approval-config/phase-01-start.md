---
phase: 1
title: "Shared Schemas, Database Model & Migration"
status: pending
priority: P1
effort: "4h"
dependencies: []
---
<!-- Updated: Red Team Review - Finding 5 (User List Schema & DB Query Alignment) -->

# Phase 1: Shared Schemas, Database Model & Migration

## Overview
Add the database column `require_product_approval` to the `User` model in Prisma, generate and apply the PostgreSQL migration, and update shared Zod validation schemas across `@expyrico/shared` for both global product creation settings and admin user profiles.

## Requirements
- Functional:
  - Add `requireProductApproval` boolean field on `User` model defaulting to `false` (allowing new products to be auto-approved without manual review by default).
  - Add `requireApproval` boolean field on `productCreationSettingsSchema` defaulting to `false`.
  - Expose `requireProductApproval` in `adminUserRowSchema`, `adminUserDetailSchema`, and `adminUserPatchSchema`.
- Non-functional:
  - Zero-downtime additive database migration using PostgreSQL `DEFAULT false`.
  - Full TypeScript type safety across monorepo packages.

## Architecture
- **Prisma Schema**: Update `model User` in `api/prisma/schema.prisma` with `@map("require_product_approval")`.
- **Shared Schemas**:
  - `packages/shared/src/schemas/admin/settings.ts`:
    ```typescript
    export const productCreationSettingsSchema = z.object({
      mode: z.enum(['off', 'internal', 'all']),
      requireApproval: z.boolean().default(false),
    });
    ```
  - `packages/shared/src/schemas/admin/users.ts`:
    ```typescript
    export const adminUserRowSchema = z.object({
      // ... existing fields
      requireProductApproval: z.boolean().default(false),
    });

    export const adminUserPatchSchema = z.object({
      // ... existing fields
      requireProductApproval: z.boolean().optional(),
    });
    ```

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/<timestamp>_user_require_product_approval/migration.sql`
- Modify: `packages/shared/src/schemas/admin/settings.ts`
  - `packages/shared/src/schemas/admin/users.ts`:
    Update `adminUserRowSchema`, `adminUserDetailSchema`, and `adminUserPatchSchema`.
  - `api/src/routes/admin/users/list.ts`:
    Ensure Prisma query select explicitly includes `requireProductApproval: true` so the user directory list does not omit the field.
- Modify: `api/src/routes/admin/users/list.ts`
- Modify: `packages/shared/src/schemas/admin/settings.test.ts`

## Implementation Steps
1. Edit `api/prisma/schema.prisma`:
   - Add `requireProductApproval Boolean @default(false) @map("require_product_approval")` to `model User`.
2. Generate migration:
   - Run `pnpm --filter @expyrico/api exec prisma migrate dev --name user_require_product_approval --create-only`.
   - Inspect the generated SQL migration to ensure it only adds column `require_product_approval BOOLEAN NOT NULL DEFAULT false`.
3. Apply migration to local database:
   - Run `pnpm --filter @expyrico/api exec prisma migrate deploy`.
   - Run `pnpm --filter @expyrico/api exec prisma generate`.
4. Update `packages/shared/src/schemas/admin/settings.ts`:
   - Extend `productCreationSettingsSchema` with `requireApproval: z.boolean().default(false)`.
5. Update `packages/shared/src/schemas/admin/users.ts`:
   - Add `requireProductApproval: z.boolean().default(false)` to `adminUserRowSchema` and `adminUserDetailSchema`.
   - Add `requireProductApproval: z.boolean().optional()` to `adminUserPatchSchema`.
6. Rebuild shared package and sync types:
   - Run `pnpm --filter @expyrico/shared build`.
   - Run `pnpm --filter @expyrico/shared test`.

## Success Criteria
- [x] `model User` in `schema.prisma` contains `requireProductApproval Boolean @default(false)`.
- [x] Prisma migration applies cleanly to PostgreSQL without locking or errors.
- [x] `packages/shared` compiles and exports updated `productCreationSettingsSchema` and `adminUserPatchSchema`.
- [x] All unit tests in `packages/shared` pass.

## Risk Assessment
- Risk: Missing migration deployment in CI or production causing runtime Prisma errors when querying `requireProductApproval`.
  - Signal: Querying User fails with column `require_product_approval` does not exist.
  - Mitigation: `deploy-remote.sh` and GitHub Actions both execute `prisma migrate deploy` before service start.
