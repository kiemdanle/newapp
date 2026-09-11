---
phase: 1
title: "Shared Schema, Photo Limits & Capacity Contracts"
status: pending
priority: P1
effort: "2.5h"
dependencies: []
---

<!-- Updated: Validation Session 1 - Strict bounded compression schedule [0.82, 0.72, 0.70] and terminal ceiling -->
<!-- Updated: Advisory Fix - Expand position and reorder schemas to accommodate up to 20 photos -->
<!-- Updated: Red Team Review - Widen productEditPhotoSchema, adminProductEditPhotoSchema to position 19 and desiredPhotoOrder to 20 -->

# Phase 1: Shared Schema, Photo Limits & Capacity Contracts

## Overview

Define the canonical Zod schema, TypeScript interfaces, default values, and standard media compression constraints for platform photo uploads in `@expyrico/shared`. Update legacy hardcoded limits in `product.ts`, `product-edits.ts`, and `admin/products.ts` (which capped photo positions at 4 and reorder/recovery arrays at 5) so that both product drafts and product revisions natively support the full administrative configuration range of up to 20 photos per item without causing runtime Zod serialization crashes.

## Requirements

### Functional Requirements
- Define `photoLimitsSettingsSchema` supporting:
  - `maxProductPhotos`: Integer between 1 and 20 (inclusive), defaulting to 5.
  - `maxPantryItemPhotos`: Integer between 1 and 20 (inclusive), defaulting to 5.
- Provide clear, user-friendly validation error messages for out-of-range or non-integer inputs.
- Export TypeScript type `PhotoLimitsSettings = z.infer<typeof photoLimitsSettingsSchema>`.
- Export `DEFAULT_PHOTO_LIMITS` constant with standard baseline values (`{ maxProductPhotos: 5, maxPantryItemPhotos: 5 }`).
- Export standard photo auto-compression configuration:
  - `MAX_PHOTO_DIMENSION_PX = 1920`: Maximum allowed width or height.
  - `PHOTO_COMPRESSION_QUALITY_STEPS = [0.82, 0.72, 0.70] as const`: Strict bounded 3-attempt quality ladder.
  - `PHOTO_COMPRESSION_QUALITY_FLOOR = 0.70`: Inviolable quality floor.
  - `MAX_PHOTO_FILE_BYTES = 1 * 1024 * 1024`: 1 MB (`1,048,576` bytes) hard ceiling for compressed photo uploads.
- Remove hardcoded 5-photo ceilings from existing schemas across `packages/shared`:
  - `productPhotoSchema.position` (`schemas/product.ts:76`): Update from `.min(0).max(4)` to `.min(0).max(19)` (allowing index 0 through 19 for up to 20 photos).
  - `productDraftReorderRequestSchema.photoIds` (`schemas/product.ts:285`): Update from `.min(1).max(5)` to `.min(1).max(20)`.
  - `productEditPhotoSchema.position` (`schemas/product-edits.ts:14`): Update from `.min(0).max(4)` to `.min(0).max(19)` to prevent 500 Zod serialization crashes on revisions.
  - `productEditPhotoReorderRequestSchema.photoIds` (`schemas/product-edits.ts:65`): Update from `.min(1).max(5)` to `.min(1).max(20)`.
  - `adminProductEditPhotoSchema.position` (`schemas/admin/products.ts:136`): Update from `.min(0).max(4)` to `.min(0).max(19)`.
  - `desiredPhotoOrder` in `productEditRecoverRequestSchema` (`schemas/admin/products.ts:219`): Update from `.max(5)` to `.max(20)`.
- Re-export the new schema, type, and constants from the package root `packages/shared/src/index.ts`.

### Non-functional Requirements
- Adhere to strict type safety without `any` or loose type assertions.
- Zero runtime dependencies beyond existing `zod` in `@expyrico/shared`.
- Comprehensive Vitest unit tests verifying boundary values (0, 1, 20, 21, floats, negative numbers, missing fields, 6-photo and 20-photo reorder/recovery arrays).

## Architecture

```
[packages/shared]
  ├── src/schemas/admin/settings.ts
  │     ├── photoLimitsSettingsSchema (Zod Object: [1..20], default 5)
  │     ├── PhotoLimitsSettings (TypeScript Interface)
  │     ├── DEFAULT_PHOTO_LIMITS (Constant: 5 / 5)
  │     └── PHOTO_COMPRESSION_CONFIG
  │           ├── maxDimensionPx: 1920
  │           ├── qualitySteps: [0.82, 0.72, 0.70]
  │           ├── qualityFloor: 0.70
  │           └── maxFileBytes: 1048576 (1 MB)
  │
  ├── src/schemas/product.ts
  │     ├── productPhotoSchema: position min(0).max(19)
  │     └── productDraftReorderRequestSchema: photoIds max(20)
  │
  ├── src/schemas/product-edits.ts
  │     ├── productEditPhotoSchema: position min(0).max(19)
  │     └── productEditPhotoReorderRequestSchema: photoIds max(20)
  │
  ├── src/schemas/admin/products.ts
  │     ├── adminProductEditPhotoSchema: position min(0).max(19)
  │     └── desiredPhotoOrder: max(20)
  │
  ├── src/index.ts (Package export point)
  └── src/schemas/ (Unit tests: settings.test.ts, product.test.ts, product-edits.test.ts)
```

## Related Code Files

- Modify: `packages/shared/src/schemas/admin/settings.ts`
- Modify: `packages/shared/src/schemas/product.ts`
- Modify: `packages/shared/src/schemas/product-edits.ts`
- Modify: `packages/shared/src/schemas/admin/products.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/schemas/admin/settings.test.ts`
- Modify: `packages/shared/src/schemas/product.test.ts`
- Modify: `packages/shared/src/schemas/product-edits.test.ts`

## Implementation Steps

1. **Settings Schema & Constants (`packages/shared/src/schemas/admin/settings.ts`)**:
   - Add `photoLimitsSettingsSchema` and `PHOTO_COMPRESSION_CONFIG`:
     ```ts
     export const photoLimitsSettingsSchema = z.object({
       maxProductPhotos: z
         .number()
         .int('Maximum product photos must be an integer')
         .min(1, 'At least 1 product photo must be allowed')
         .max(20, 'Maximum allowed product photos is 20')
         .default(5),
       maxPantryItemPhotos: z
         .number()
         .int('Maximum pantry item photos must be an integer')
         .min(1, 'At least 1 pantry item photo must be allowed')
         .max(20, 'Maximum allowed pantry item photos is 20')
         .default(5),
     });

     export type PhotoLimitsSettings = z.infer<typeof photoLimitsSettingsSchema>;

     export const DEFAULT_PHOTO_LIMITS: PhotoLimitsSettings = {
       maxProductPhotos: 5,
       maxPantryItemPhotos: 5,
     };

     export const PHOTO_COMPRESSION_CONFIG = {
       maxDimensionPx: 1920,
       qualitySteps: [0.82, 0.72, 0.70] as const,
       qualityFloor: 0.70,
       maxFileBytes: 1 * 1024 * 1024, // 1,048,576 bytes (1 MB)
     } as const;
     ```

2. **Update Product Schemas (`packages/shared/src/schemas/product.ts`)**:
   - Update `productPhotoSchema`:
     ```ts
     export const productPhotoSchema = z.object({
       id: z.string().uuid(),
       position: z.number().int().min(0).max(19),
       thumbnailUrl: z.string().min(1),
       displayUrl: z.string().min(1),
     });
     ```
   - Update `productDraftReorderRequestSchema`:
     ```ts
     export const productDraftReorderRequestSchema = z
       .object({
         photoIds: z.array(z.string().uuid()).min(1).max(20),
       })
       .strict()
       .refine((v) => new Set(v.photoIds).size === v.photoIds.length, {
         message: 'photoIds must be unique',
       });
     ```

3. **Update Product Edits Schemas (`packages/shared/src/schemas/product-edits.ts`)**:
   - Update `productEditPhotoSchema`:
     ```ts
     export const productEditPhotoSchema = z.object({
       id: z.string().uuid(),
       sourceProductPhotoId: z.string().uuid().nullable().optional(),
       position: z.number().int().min(0).max(19),
       retained: z.boolean().optional(),
       thumbnailUrl: z.string().min(1),
       displayUrl: z.string().min(1),
     });
     ```
   - Update `productEditPhotoReorderRequestSchema`:
     ```ts
     export const productEditPhotoReorderRequestSchema = z
       .object({
         photoIds: z.array(z.string().uuid()).min(1).max(20),
       })
       .strict()
       .refine((v) => new Set(v.photoIds).size === v.photoIds.length, {
         message: 'photoIds must be unique',
       });
     ```

4. **Update Admin Products Schemas (`packages/shared/src/schemas/admin/products.ts`)**:
   - Update `adminProductEditPhotoSchema`:
     ```ts
     export const adminProductEditPhotoSchema = z.object({
       id: z.string().uuid(),
       sourceProductPhotoId: z.string().uuid().nullable(),
       position: z.number().int().min(0).max(19),
       uploadedByUserId: z.string().uuid().nullable(),
       thumbnailUrl: z.string().min(1),
       displayUrl: z.string().min(1),
       moderationStatus: z.string().nullable().optional(),
     });
     ```
   - Update `desiredPhotoOrder` in `productEditRecoverRequestSchema`:
     ```ts
     desiredPhotoOrder: z.array(productEditRecoverDesiredEntrySchema).max(20),
     ```

5. **Package Export (`packages/shared/src/index.ts`)**:
   - Export `photoLimitsSettingsSchema`, `PhotoLimitsSettings`, `DEFAULT_PHOTO_LIMITS`, and `PHOTO_COMPRESSION_CONFIG`.

6. **Unit Tests**:
   - In `settings.test.ts`: Verify validation rules, defaults, and compression config constants.
   - In `product.test.ts`: Verify 6-photo and 20-photo arrays parse in `productDraftReorderRequestSchema`, and reject 21 entries.
   - In `product-edits.test.ts`: Verify `productEditPhotoSchema` accepts positions up to 19, and `productEditPhotoReorderRequestSchema` accepts up to 20 entries.

7. **Build & Typecheck**:
   - Run `pnpm --filter @expyrico/shared build` to update declaration files and distribution bundles.

## Success Criteria

- [x] `photoLimitsSettingsSchema` parses valid configurations and applies defaults.
- [x] `productPhotoSchema`, `productEditPhotoSchema`, and `adminProductEditPhotoSchema` accept positions up to 19 without schema validation errors.
- [x] `productDraftReorderRequestSchema`, `productEditPhotoReorderRequestSchema`, and `desiredPhotoOrder` accept up to 20 photo entries.
- [x] `PHOTO_COMPRESSION_CONFIG` specifies exact bounded ladder `[0.82, 0.72, 0.70]`, floor `0.70`, and byte ceiling `1048576`.
- [x] `pnpm --filter @expyrico/shared test` passes with 100% success.
- [x] TypeScript builds cleanly with `pnpm --filter @expyrico/shared build`.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Out-of-bounds default values break existing mobile UI | High | Low | Default to standard 5 for both limits, preserving exact current behavior until an admin explicitly updates it |
| Reorder and revision schemas reject arrays larger than 5 | High | Low | Explicitly raised schema position caps to 19 and array lengths to 20 across product and revision schemas |
