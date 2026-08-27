---
phase: 5
title: "Verification and testing"
status: completed
priority: P1
dependencies: [1, 2, 3, 4]
---

# Phase 5: Verification and testing

<!-- Updated: Validation Session 1 - Verification test cases for submitter notes, shelf life, and full moderation cycle -->
<!-- Updated: Red Team Review - Verification cases for pending read-only load, stale revision rebase, audit log diffs, and numeric boundary tests -->

## Overview
Execute end-to-end testing, unit tests, integration test suites, and monorepo typecheck/build verification across `@expyrico/shared`, `api`, `apps/mobile`, and `apps/admin` to guarantee that product edit suggestions and the admin moderation pipeline operate reliably without regressions.

## Requirements

### Functional
- Verify complete lifecycle:
  1. User discovers incorrect product metadata on the Product Detail screen.
  2. User taps "Suggest an edit" and opens `ProductEditScreen`.
  3. User edits Name, Description, Brand, Category, Default Shelf Life Days, adds Submitter Notes, uploads/reorders photos, and submits.
  4. Suggestion status updates to `pending` and appears in Admin Dashboard `/products/pending`.
  5. User re-opens `ProductEditScreen` while suggestion is pending -> Verify read-only summary renders cleanly without 409 conflict error.
  6. Admin navigates to `/products/pending/[editId]` and reviews side-by-side diffs (metadata, formatted shelf life, submitter reason card, photos).
  7. Admin clicks "Approve" -> Verify `Product` row in DB is atomically updated with all proposed details, staged photos are published to public CDN storage, audit log is written (with shelf life and notes in diff), notification outbox event is recorded, and edit status is marked `approved`.
  8. Mobile user refreshes product -> Verify updated product data is reflected immediately.
  9. Test Stale Base & Rebase: Admin directly updates product metadata -> Verify pending revision becomes stale -> Admin uses rebase/supersede -> Verify shelf life and notes are preserved.
  10. Test Request Changes path: Admin requests changes with note -> Mobile user sees feedback banner -> User corrects fields and resubmits -> Admin re-reviews and approves.

### Non-functional
- Zero TypeScript errors across all workspaces (`pnpm turbo run typecheck`).
- Zero linting or formatting regressions (`pnpm turbo run lint`).
- 100% passing automated test suites in shared, backend, mobile, and admin.

## Architecture
```
End-to-End Test Matrix
┌─────────────────────────┬───────────────────────────────┬────────────────────────────┐
│ Workspace               │ Test Target                   │ Verification Command       │
├─────────────────────────┼───────────────────────────────┼────────────────────────────┤
│ packages/shared         │ Zod schemas & DTO validation  │ pnpm --filter @expyrico/   │
│                         │ (bounds, notes, shelf life)   │ shared test                │
├─────────────────────────┼───────────────────────────────┼────────────────────────────┤
│ api                     │ Fastify routes, product-edits │ pnpm --filter api test     │
│                         │ service, atomic DB approve,   │                            │
│                         │ rebase, audit logs, outbox    │                            │
├─────────────────────────┼───────────────────────────────┼────────────────────────────┤
│ apps/admin              │ RevisionComparison diff table,│ pnpm --filter @expyrico/   │
│                         │ submitter notes card, build   │ admin build                │
├─────────────────────────┼───────────────────────────────┼────────────────────────────┤
│ apps/mobile             │ ProductEditForm, EditEditor,  │ pnpm --filter @expyrico/   │
│                         │ numeric inputs, Jest tests    │ mobile test                │
├─────────────────────────┼───────────────────────────────┼────────────────────────────┤
│ Full Monorepo           │ Typecheck & Build             │ pnpm turbo run typecheck   │
└─────────────────────────┴───────────────────────────────┴────────────────────────────┘
```

## Related Code Files
- Test: `packages/shared/src/schemas/product-edits.test.ts`
- Test: `api/tests/integration/product-edits.test.ts`
- Test: `apps/mobile/__tests__/routes/product-edit.test.tsx`
- Test: `apps/mobile/__tests__/routes/product-detail.test.tsx`
- Run: Monorepo test & typecheck scripts

## Implementation Steps
1. Run shared package test suite and build:
   ```bash
   pnpm --filter @expyrico/shared test
   pnpm --filter @expyrico/shared build
   ```
2. Run backend API unit and integration tests:
   ```bash
   pnpm --filter api test
   ```
3. Run mobile Jest tests:
   ```bash
   pnpm --filter @expyrico/mobile test
   ```
4. Run admin app build and verification:
   ```bash
   pnpm --filter @expyrico/admin build
   ```
5. Run monorepo-wide typechecking:
   ```bash
   pnpm turbo run typecheck
   ```
6. Document verification results and compile final implementation sign-off.

## Success Criteria
- [x] `@expyrico/shared` unit tests pass.
- [x] `api` integration tests for product edits and moderation pass.
- [x] `apps/mobile` route and component tests for product edits pass.
- [x] `apps/admin` builds cleanly without warnings.
- [x] Full monorepo `typecheck` passes with zero errors.

## Risk Assessment
- *Risk*: Database test fixtures drift or unseeded columns in test DB.
- *Mitigation*: Ensure test database migrations and factories are updated to include all product and edit fields.
