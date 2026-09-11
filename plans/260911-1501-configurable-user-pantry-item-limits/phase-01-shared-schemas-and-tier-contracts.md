---
phase: 1
title: "Shared Schemas & Tier Contracts"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Shared Schemas & Tier Contracts

## Overview
Define the core Zod validation schemas, constants, error codes, future-compatible tier entitlement models, and **deterministic cursor-based sync schemas** in `@expyrico/shared`. Update sync batch and response schemas with `cursor`, `nextCursor`, and `hasMore` to eliminate timestamp-boundary data loss, add partial patch schemas for admin settings, allow optional status on record creation for consumption splits, add unit tests, build the shared package, and synchronize vendored distribution files into `apps/mobile/local-packages/@expyrico/shared`.

<!-- Updated: Advisory Review Session 1 - Findings F01, F05, F11, F16 -->

---

## Requirements

### Functional
1. **Admin Settings Schema (`pantryLimitsSettingsSchema` & `pantryLimitsPatchSchema`)**:
   - `defaultUserPantryLimit`: integer, minimum 1, maximum 10,000, default 50.
   - `tierLimits`: optional record of string to integer (`{ free: 50, pro: 500 }`), providing the forward-compatible schema bridge for future tiers.
   - `pantryLimitsPatchSchema`: explicit partial update schema allowing `defaultUserPantryLimit` and/or `tierLimits` to be updated independently without wiping unmentioned fields on update (Red Team Finding 9).
2. **Default Constant (`DEFAULT_PANTRY_LIMITS`)**:
   - Export `{ defaultUserPantryLimit: 50, tierLimits: { free: 50, pro: 500 } }`.
3. **Record Creation Schema (`recordCreateSchema`)**:
   - Allow optional `status: recordStatusSchema.optional()` and terminal timestamps (`consumedAt: z.string().datetime().nullable().optional()`, `discardedAt: z.string().datetime().nullable().optional()`, `discardReason: z.string().max(100).nullable().optional()`) so that local partial-consumption split history records can be created as `consumed` or `discarded` rather than defaulting to `active` on the server and prematurely consuming quota (Advisory Finding F05).
4. **Deterministic Cursor Sync Schemas (`recordSyncBatchSchema` & `recordSyncResponseSchema`)**:
   - Update `recordSyncBatchSchema` to accept an optional composite seek cursor:
     ```typescript
     cursor: z.object({
       updatedAt: z.string().datetime(),
       id: z.string().uuid(),
     }).nullable().optional(),
     ```
   - Update `recordSyncResponseSchema` to emit cursor pagination metadata:
     ```typescript
     nextCursor: z.object({
       updatedAt: z.string().datetime(),
       id: z.string().uuid(),
     }).nullable().optional(),
     hasMore: z.boolean().default(false),
     ```
   - This provides deterministic pagination over equal-timestamp row boundaries up to the 10,000 limit (Red Team Finding 11).
5. **Record Sync Conflict Schema**:
   - Add `'item_limit_reached'` to `recordSyncConflictSchema.reason` enum (`z.enum(['scope_changed', 'product_unavailable', 'item_limit_reached'])`).
6. **Usage Response Schema**:
   - Confirm `meUsageResponseSchema` (`itemCount: z.number().int().min(0)`, `itemLimit: z.number().int().positive()`, `readOnly: z.boolean()`) drives `readOnly = itemCount >= itemLimit` dynamically.

### Non-Functional
- Backwards compatibility: Existing `ERROR_CODES.ITEM_LIMIT_REACHED` (`'item_limit_reached'`) and `ITEM_LIMIT` constant remain exported to prevent breaking legacy consumers.
- Build & sync: `@expyrico/shared` passes all tests and is compiled and vendored cleanly.

---

## Architecture

```
packages/shared/src/
├── schemas/
│   ├── admin/
│   │   ├── settings.ts        <-- Add pantryLimitsSettingsSchema, pantryLimitsPatchSchema, DEFAULT_PANTRY_LIMITS
│   │   └── settings.test.ts   <-- Test validation, boundaries (1-10,000), defaults, partial patch
│   ├── record.ts              <-- Add cursor/nextCursor/hasMore, optional status, 'item_limit_reached'
│   └── user.ts                <-- Verify meUsageResponseSchema
```

---

## Related Code Files

- Modify: `packages/shared/src/schemas/admin/settings.ts`
- Modify: `packages/shared/src/schemas/record.ts`
- Modify: `packages/shared/src/schemas/admin/settings.test.ts`
- Sync: `apps/mobile/local-packages/@expyrico/shared/dist/`
- Verify: `scripts/check-vendored-shared-dist.mjs`

---

## Implementation Steps

1. **Add `pantryLimitsSettingsSchema` and `pantryLimitsPatchSchema` to `packages/shared/src/schemas/admin/settings.ts`**:
   ```typescript
   export const pantryLimitsSettingsSchema = z.object({
     defaultUserPantryLimit: z
       .number()
       .int('Pantry limit must be an integer')
       .min(1, 'At least 1 pantry item must be allowed')
       .max(10000, 'Maximum allowed pantry items is 10,000')
       .default(50),
     tierLimits: z
       .record(z.string(), z.number().int().min(1).max(10000))
       .optional()
       .default({
         free: 50,
         pro: 500,
       }),
   });
   export type PantryLimitsSettings = z.infer<typeof pantryLimitsSettingsSchema>;

   export const pantryLimitsPatchSchema = z.object({
     defaultUserPantryLimit: z.number().int().min(1).max(10000).optional(),
     tierLimits: z.record(z.string(), z.number().int().min(1).max(10000)).optional(),
   }).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
   export type PantryLimitsPatch = z.infer<typeof pantryLimitsPatchSchema>;

   export const DEFAULT_PANTRY_LIMITS: PantryLimitsSettings = {
     defaultUserPantryLimit: 50,
     tierLimits: {
       free: 50,
       pro: 500,
     },
   };
   ```
2. **Update `recordCreateSchema` in `packages/shared/src/schemas/record.ts`**:
   Add optional `status: recordStatusSchema.optional()`, `consumedAt: z.string().datetime().nullable().optional()`, `discardedAt: z.string().datetime().nullable().optional()`, and `discardReason: z.string().max(100).nullable().optional()` so partial-consumption splits and offline terminal entries do not default to active (Advisory Finding F05).
3. **Update Sync Batch and Response Schemas in `packages/shared/src/schemas/record.ts`**:
   - In `recordSyncBatchSchema`, add `cursor: z.object({ updatedAt: z.string().datetime(), id: z.string().uuid() }).nullable().optional()`.
   - In `recordSyncResponseSchema`, add `nextCursor: z.object({ updatedAt: z.string().datetime(), id: z.string().uuid() }).nullable().optional()` and `hasMore: z.boolean().default(false)`.
4. **Update `recordSyncConflictSchema` in `packages/shared/src/schemas/record.ts`**:
   Extend reason enum to include `'item_limit_reached'`.
5. **Write Unit Tests in `packages/shared/src/schemas/admin/settings.test.ts` and `record.test.ts`**:
   - Test default values when empty object parsed.
   - Test validation errors on 0, negative, floating point, or > 10,000.
   - Test partial patch schema validation.
   - Test `recordSyncBatchSchema` and `recordSyncResponseSchema` parsing with and without cursor.
6. **Build and Sync**:
   - Run `pnpm --filter @expyrico/shared build`.
   - Run `pnpm --filter @expyrico/shared test`.
   - Copy `packages/shared/dist/` to `apps/mobile/local-packages/@expyrico/shared/dist/`.
   - Verify with `node scripts/check-vendored-shared-dist.mjs`.

---

## Success Criteria

- [ ] `pantryLimitsSettingsSchema` validates integer ranges [1, 10000] with default 50.
- [ ] `pantryLimitsPatchSchema` allows updating `defaultUserPantryLimit` without overriding `tierLimits`.
- [ ] `recordCreateSchema` supports optional status and terminal timestamps for inactive history entries.
- [ ] `recordSyncBatchSchema` and `recordSyncResponseSchema` support composite `(updatedAt, id)` cursors.
- [ ] `recordSyncConflictSchema` includes `item_limit_reached`.
- [ ] Unit tests pass for `@expyrico/shared`.
- [ ] `node scripts/check-vendored-shared-dist.mjs` passes with zero discrepancies.
