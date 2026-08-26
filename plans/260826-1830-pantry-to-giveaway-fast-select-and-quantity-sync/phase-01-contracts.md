---
phase: 1
title: "Contracts & Shared Schemas"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Contracts & Shared Schemas

## Overview
Expand `@expyrico/shared` to support giveaway item quantity, unit representation, and explicit record linking fields across create, patch, and response schemas.

---

## Requirements

### Functional Requirements
- `giveawaySchema`: Add `quantity: z.number().int().positive().default(1)` and `unit: z.string().max(16).default('pcs')`.
- `giveawayCreateSchema`: Add optional `quantity: z.number().int().positive().default(1)` and optional `unit: z.string().trim().max(16).optional()`.
- `giveawayPatchSchema`: Allow updating `quantity: z.number().int().positive().optional()` and `unit: z.string().trim().max(16).optional()`.
- Ensure backwards compatibility: Existing giveaways without explicit quantity default to `1 pcs`.

### Non-Functional Requirements
- Zero runtime overhead and 100% strict TypeScript types.
- Export all schemas and inferred TypeScript types in `@expyrico/shared`.

---

## Architecture & Schema Changes

```typescript
// packages/shared/src/schemas/giveaway.ts

export const giveawaySchema = z.object({
  id: z.string().uuid(),
  giverUserId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  recordId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  photoUrls: z.array(z.string().url()).optional(),
  locationText: z.string(),
  country: z.string().length(2).nullable(),
  status: giveawayStatusSchema,
  selectedRecipientId: z.string().uuid().nullable(),
  quantity: z.number().int().positive().default(1),
  unit: z.string().max(16).default('pcs'),
  expiryDate: z.string().nullable().optional(),
  claimExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  handedOffAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  claimCount: z.number().int().nonnegative().optional(),
  myClaim: z.object({
    id: z.string().uuid(),
    status: claimStatusSchema,
    pickupNote: z.string().nullable(),
  }).nullable().optional(),
  giver: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    avatarUrl: z.string().url().nullable(),
    giverRatingAvg: z.number().nullable(),
    transactionCount: z.number().int().nonnegative(),
  }).optional(),
});

export const giveawayCreateSchema = z.object({
  title: titleField,
  description: z.string().trim().max(2000).nullable().optional(),
  locationText: locationField,
  photoUrl: z.string().url().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  quantity: z.coerce.number().int().min(1).max(100000).default(1),
  unit: z.string().trim().max(16).default('pcs'),
  claimExpiresAt: z
    .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .nullable()
    .optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiryDate must be YYYY-MM-DD')
    .nullable()
    .optional(),
  productId: z.string().uuid().optional(),
  recordId: z.string().uuid().optional(),
});

export const giveawayPatchSchema = z
  .object({
    title: titleField.optional(),
    description: descField,
    locationText: locationField.optional(),
    photoUrl: z.string().url().nullable().optional(),
    photoUrls: z.array(z.string().url()).optional(),
    quantity: z.coerce.number().int().min(1).max(100000).optional(),
    unit: z.string().trim().max(16).optional(),
    claimExpiresAt: z
      .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
      .nullable()
      .optional(),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiryDate must be YYYY-MM-DD')
      .nullable()
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'at least one field required',
  });
```

---

## Related Code Files
- Modify: `packages/shared/src/schemas/giveaway.ts`
- Modify: `packages/shared/src/schemas/giveaway.test.ts` (or add schema validation unit tests)
- Sync: `apps/mobile/local-packages/@expyrico/shared/dist/`

---

## Implementation Steps
1. Update `giveawaySchema`, `giveawayCreateSchema`, and `giveawayPatchSchema` in `packages/shared/src/schemas/giveaway.ts` with `quantity` and `unit` properties.
2. Add schema unit tests in `packages/shared` validating valid integers, quantity clamping, and defaults.
3. Run `pnpm --filter @expyrico/shared build` and sync build output to mobile packages.

---

## Success Criteria
- [ ] `@expyrico/shared` builds cleanly (`tsc -p tsconfig.build.json`) with zero type errors.
- [ ] Schema unit tests pass with 100% coverage on `quantity` and `unit`.
