---
phase: 5
title: "Verification, Integration Testing & Runbook"
status: pending
priority: P1
effort: "4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Verification, Integration Testing & Runbook

## Overview
Perform end-to-end verification and integration testing of the global product approval toggle and per-user spam restriction controls. Verify database persistence, photo promotion, catalog visibility, outbox notifications, audit logging, and production deployment runbook.

## Requirements
- Functional:
  - Verify all 4 policy permutations:
    1. Global auto-approve + user auto-approve -> instant `active` catalog listing + public photo.
    2. Global auto-approve + user require-approval -> held in `pending` queue + private photo.
    3. Global require-approval + user auto-approve -> held in `pending` queue + private photo.
    4. Global require-approval + user require-approval -> held in `pending` queue + private photo.
  - Verify admin can toggle global policy on `/settings/feature-flags`.
  - Verify admin can toggle individual user policy on `/users/[id]`.
- Non-functional:
  - Clean test suites without flakiness.
  - Zero TypeScript or lint errors.
  - Production deployment validation.

## Architecture
- **Verification Matrix**:

| Scenario | Global Setting (`requireApproval`) | User Flag (`requireProductApproval`) | Expected Outcome | Photo Storage State | Notification Event |
|---|---|---|---|---|---|
| A (Default) | `false` | `false` | Product `active` | Public CDN key | Creator notified |
| B (Anti-Spam) | `false` | `true` | Product `pending` | Private storage | Mod queue event |
| C (Full Review)| `true` | `false` | Product `pending` | Private storage | Mod queue event |
| D (Both Strict)| `true` | `true` | Product `pending` | Private storage | Mod queue event |

## Related Code Files
- Create: `api/tests/integration/product-approval-policy.test.ts`
- Create: `apps/admin/tests/e2e/product-approval-policy.spec.ts`
- Modify: `docs/deployment-guide.md`

## Implementation Steps
1. Create integration test suite `api/tests/integration/product-approval-policy.test.ts`:
   - Test Scenario A: Submit draft when global is disabled and user is not flagged -> verify `product.status === 'active'`, photos published, `imageUrl` populated.
   - Test Scenario B: Flag user with `requireProductApproval: true`, submit draft -> verify `product.status === 'pending'`, photos remain private.
   - Test Scenario C: Enable global approval, submit draft from unflagged user -> verify `product.status === 'pending'`.
   - Test Scenario D: Toggle user flag via admin PATCH endpoint -> verify audit log written with correct before/after diff.
2. Verify Admin UI components:
   - Run Vitest in `apps/admin`: `pnpm --filter admin test`.
   - Run typecheck in `apps/admin`: `pnpm --filter admin typecheck`.
   - Run Next.js production build: `pnpm --filter admin build`.
3. Verify Shared package:
   - Run `pnpm --filter @expyrico/shared test`.
4. Production Runbook validation:
   - Run database migration on server via `deploy-remote.sh` or manual deploy.
   - Verify zero downtime for existing active products and catalog lookups.

## Success Criteria
- [ ] All 4 policy matrix scenarios pass integration tests.
- [ ] Photo asset promotion functions seamlessly without manual admin intervention during auto-approval.
- [ ] Admin user page accurately shows and updates approval status with audit trail.
- [ ] Monorepo typecheck, lint, and tests pass with zero errors.

## Risk Assessment
- Risk: Legacy products or drafts with missing creator user record.
  - Signal: `createdByUserId` is null.
  - Mitigation: If `createdByUserId` is null (e.g. system created or orphaned), fallback safely to the global setting.
