---
phase: 1
title: "Shared Schema & API Support"
status: pending
priority: P1
effort: "45m"
dependencies: []
---

# Phase 1: Shared Schema & API Support

## Overview
Extend the shared TypeScript/Zod schemas and Fastify/Prisma backend records service so that `brand` is a first-class, typed, validated, and persisted attribute of a pantry `Record`.

## Requirements
- Functional:
  - Add optional `brand` (string up to 120 chars, nullable) to `recordSchema`, `recordCreateBaseSchema`, and `recordPatchSchema`.
  - Add `brand String?` column to the `Record` table in Prisma schema (`api/prisma/schema.prisma`).
  - Map `brand` across `POST /v1/records` (create), `PATCH /v1/records/:id` (patch), `POST /v1/records/:id/duplicate` (duplicate), and sync upserts (`/v1/records/sync`).
  - Include `brand` in API record serialization (`toApiRecord`).
- Non-functional:
  - Backward-compatible: existing records without a brand resolve to `null`.
  - Input sanitization: string trimmed, max 120 characters, matching product catalog brand specifications.

## Architecture & Data Flow
```
Client Request (POST/PATCH /v1/records)
   │
   ▼
recordPatchSchema.parse() / recordCreateSchema.parse()
   │ validates brand: z.string().trim().max(120).nullable().optional()
   ▼
Prisma Record Model (PostgreSQL record.brand)
   │
   ▼
toApiRecord() ──► Serialized response with `brand: string | null`
```

## Related Code Files
- Modify: `packages/shared/src/schemas/record.ts`
- Modify: `packages/shared/src/schemas/record.test.ts`
- Modify: `api/prisma/schema.prisma`
- Modify: `api/src/services/records/repository.ts`
- Modify: `api/src/routes/records/create.ts`
- Modify: `api/src/routes/records/patch.ts`
- Modify: `api/src/routes/records/duplicate.ts`
- Modify: `api/src/services/records/sync.ts`
- Modify: `api/tests/integration/records-routes.test.ts`

## Implementation Steps
1. **Shared Zod Schemas**:
   - In `packages/shared/src/schemas/record.ts`:
     - Add `brand: z.string().max(120).nullable().optional()` to `recordSchema`.
     - Add `brand: z.string().trim().max(120).nullable().optional()` to `recordCreateBaseSchema`.
     - Add `brand: z.string().trim().max(120).nullable().optional()` to `recordPatchSchema`.
   - Update `packages/shared/src/schemas/record.test.ts` to assert that valid brand strings, `null`, and omission parse correctly.
2. **Prisma Schema & Generation**:
   - In `api/prisma/schema.prisma`, add `brand String?` to `model Record`.
   - Run `npx prisma generate` in `api/` to regenerate Prisma Client types.
3. **Backend Route & Service Wiring**:
   - In `api/src/services/records/repository.ts`: Add `brand: r.brand ?? null` to `toApiRecord`.
   - In `api/src/routes/records/create.ts`: Include `brand: input.brand ?? null` in `prisma.record.create`.
   - In `api/src/routes/records/patch.ts`: Add `...(input.brand !== undefined ? { brand: input.brand } : {})` to `prisma.record.update`.
   - In `api/src/routes/records/duplicate.ts`: Include `brand: source.brand` in duplicated record creation.
   - In `api/src/services/records/sync.ts`: Add `brand: u.brand ?? null` in upsert records mapping.
4. **Integration Verification**:
   - Add integration tests in `api/tests/integration/records-routes.test.ts` testing `POST /records` with `brand`, and `PATCH /records/:id` updating `brand`.

## Success Criteria
- [ ] `packages/shared` typecheck and vitest pass (`pnpm --filter @expyrico/shared test`).
- [ ] `api/prisma/schema.prisma` includes `brand String?` and Prisma Client compiles cleanly.
- [ ] `toApiRecord` outputs `brand` in record responses.
- [ ] `api` integration tests pass (`npm --prefix api run test:integration -- records-routes.test.ts`).

## Risk Assessment
- **Risk**: Prisma schema change without migration deployment could cause dev database desync.
  - **Mitigation**: Use `npx prisma db push` or migration for local dev, and `brand` is nullable so existing rows require no backfill.
  - **Observable Signal**: Prisma query errors with `column "brand" of relation "Record" does not exist`.
  - **Response**: Run `npx prisma db push` against the test/dev Postgres instance.
