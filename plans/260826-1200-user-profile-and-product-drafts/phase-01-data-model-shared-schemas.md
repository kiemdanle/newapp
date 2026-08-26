---
phase: 1
title: "Data Model & Shared Schemas"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Data Model & Shared Schemas
<!-- Updated: Red Team Review - Zero heavy dependencies & dual token response schema -->

## Overview
This phase establishes the foundational data layer and shared type contracts for user profile enhancements, including address storage, password mutation schemas, avatar response payloads, and lightweight, zero-dependency country metadata contracts across the API and mobile app.

## Requirements

### Functional Requirements
- Add `address` nullable string field to the `User` model in `api/prisma/schema.prisma`.
- Update `userSchema` in `packages/shared/src/schemas/user.ts` to include `address: z.string().nullable()` and `hasPassword: z.boolean()`.
- Update `updateProfileSchema` in `packages/shared/src/schemas/user.ts` to support optional/nullable `address`, optional `firstName`, `lastName`, `country`, `avatarUrl`, and `themePreference`.
- Create `changePasswordSchema` and `setPasswordSchema` in `packages/shared/src/schemas/auth.ts` for authenticated password updates.
- Create `passwordMutationResponseSchema` returning `{ tokens: tokensSchema, user: userSchema }` ensuring seamless token synchronization.
- Create `countryInfoSchema` and a zero-dependency static `RECORD_COUNTRIES` dictionary in `packages/shared/src/schemas/locale.ts` with ISO 3166-1 alpha-2 metadata (code, name, flag, default locale, currency code, currency symbol, date format convention).
- Rebuild `@expyrico/shared` and sync to local package links.

### Non-functional Requirements
- Database migrations must be forward-compatible and zero-downtime safe.
- Schema validation must enforce character limits (e.g. `address` max 255 chars, `firstName`/`lastName` max 80 chars).
- Password validation must require minimum 8 characters and reject empty strings.
- Zero heavy third-party internationalization packages (e.g. no `moment-timezone`, `i18n-iso-countries`) to prevent bundle bloat.

## Architecture & Data Contracts

```typescript
// packages/shared/src/schemas/user.ts
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  address: z.string().nullable(),
  country: z.string().length(2).nullable(),
  avatarUrl: z.string().url().nullable(),
  hasPassword: z.boolean(),
  role: userRoleSchema,
  status: userStatusSchema,
  themePreference: themePreferenceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  address: z.string().trim().max(255).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  themePreference: themePreferenceSchema.optional(),
});

// packages/shared/src/schemas/auth.ts
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
  confirmPassword: z.string().min(8).max(128).optional(),
}).refine((d) => !d.confirmPassword || d.newPassword === d.confirmPassword, {
  message: 'New passwords do not match',
  path: ['confirmPassword'],
});

export const passwordMutationResponseSchema = z.object({
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
  }),
  user: userSchema,
});

export const avatarUploadResponseSchema = z.object({
  avatarUrl: z.string().url(),
  user: userSchema,
});
```

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260826120000_add_user_address/migration.sql`
- Modify: `packages/shared/src/schemas/user.ts`
- Modify: `packages/shared/src/schemas/auth.ts`
- Create: `packages/shared/src/schemas/locale.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `api/src/services/users/repository.ts`

## Implementation Steps
1. Edit `api/prisma/schema.prisma` to add `address String?` to `model User`.
2. Generate migration SQL `20260826120000_add_user_address` adding `ALTER TABLE "users" ADD COLUMN "address" TEXT;`.
3. Update `packages/shared/src/schemas/user.ts` with `address` in `userSchema` and `updateProfileSchema`, plus `hasPassword: z.boolean()` in `userSchema`.
4. Add `changePasswordSchema` and `passwordMutationResponseSchema` in `packages/shared/src/schemas/auth.ts`.
5. Create `packages/shared/src/schemas/locale.ts` defining compact ISO-3166 country metadata mappings without heavy npm packages.
6. Export new schemas and types in `packages/shared/src/index.ts`.
7. Update `toApiUser(user)` in `api/src/services/users/repository.ts` to map `address: u.address ?? null` and `hasPassword: u.passwordHash !== null`.
8. Compile `packages/shared` via `pnpm build` and update mobile/api consumers.

## Success Criteria
- [ ] Prisma schema contains `address String?` on `User` model.
- [ ] Database migration applies cleanly without data loss.
- [ ] `toApiUser` produces `address` and `hasPassword` flags correctly.
- [ ] `@expyrico/shared` passes TypeScript compilation and type exports are available.
- [ ] Unit tests for `updateProfileSchema`, `changePasswordSchema`, and `passwordMutationResponseSchema` pass with valid and invalid payloads.

## Risk Assessment
- **Risk**: Prisma client code generation desync if schema changes without running `prisma generate`.
  - **Mitigation**: Run `pnpm --filter @expyrico/api prisma generate` and verify build before route implementation.
- **Risk**: `toApiUser` missing `hasPassword` causing mobile auth checks to fail.
  - **Mitigation**: Add automated repository unit tests checking `toApiUser` with both password-hashed and passwordless users.
