---
phase: 1
title: Shared Contracts and Schemas
status: completed
priority: P1
dependencies: []
---

# Phase 1: Shared Contracts and Schemas

## Overview
Define Zod schemas, TypeScript types, and standardized error codes in `@expyrico/shared` for resetting two-factor authentication on admin/user accounts.

## Requirements

### Functional
- Define `adminUserReset2faResponseSchema` describing the response payload when 2FA is reset (`{ ok: true, userId: string, message: string }`).
- Define optional `adminUserReset2faRequestSchema` (allowing optional operator notes or confirmation tokens).
- Add typed error codes to `ERROR_CODES` constant in `@expyrico/shared`:
  - `CANNOT_RESET_UNENROLLED_2FA`: Returned when attempting to reset 2FA on an account that does not have 2FA configured (`totpEnabledAt === null`).
  - `SELF_2FA_RESET_CONFIRMATION_REQUIRED`: Returned if an admin attempts self-reset without explicit confirmation flag.
- Export all schemas and inferred types from `@expyrico/shared`.

### Non-Functional
- Strict runtime validation using Zod.
- Zero breaking changes to existing `adminUserRowSchema`, `adminRowSchema`, or `totpEnrollSchema`.
- Full ESM/CJS build compatibility for consumption across API, Admin Dashboard, and Mobile apps.

## Architecture
The shared schemas act as the single source of truth contract between the Fastify API and the Next.js Admin Dashboard:

```
@expyrico/shared
 ├── schemas/admin/users.ts      --> adminUserReset2faResponseSchema
 ├── constants/errors.ts         --> ERROR_CODES.CANNOT_RESET_UNENROLLED_2FA
 └── index.ts                    --> Re-exports for API & Admin
```

## Related Code Files
- Modify: `packages/shared/src/schemas/admin/users.ts`
- Modify: `packages/shared/src/constants/errors.ts`
- Modify: `packages/shared/src/index.ts`

## Implementation Steps
1. In `packages/shared/src/constants/errors.ts`:
   - Add `CANNOT_RESET_UNENROLLED_2FA: 'cannot_reset_unenrolled_2fa'`
   - Add `SELF_2FA_RESET_CONFIRMATION_REQUIRED: 'self_2fa_reset_confirmation_required'`
2. In `packages/shared/src/schemas/admin/users.ts`:
   - Define `adminUserReset2faRequestSchema = z.object({ notes: z.string().trim().max(500).optional(), confirmSelfReset: z.boolean().optional() })`
   - Define `adminUserReset2faResponseSchema = z.object({ ok: z.literal(true), userId: z.string().uuid(), message: z.string() })`
   - Export inferred types `AdminUserReset2faRequest` and `AdminUserReset2faResponse`.
3. In `packages/shared/src/index.ts`:
   - Ensure all new schemas and types are re-exported.
4. Run `pnpm --filter @expyrico/shared build` to generate updated `.d.ts` and `.js` distribution bundles.

## Success Criteria
- [ ] `adminUserReset2faRequestSchema` and `adminUserReset2faResponseSchema` compile and validate correctly with Zod.
- [ ] Error codes are cleanly integrated in `ERROR_CODES`.
- [ ] `@expyrico/shared` builds cleanly with zero TypeScript errors.

## Risk Assessment
- **Risk**: Build or type drift between packages if build step is omitted.
- **Mitigation**: Run workspace build immediately and verify type exports in `@expyrico/shared/dist`.
