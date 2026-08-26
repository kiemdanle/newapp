---
phase: 4
title: "Testing, Verification & Monorepo Validation"
status: pending
priority: P1
dependencies: [1, 2, 3]
---

# Phase 4: Testing, Verification & Monorepo Validation

## Overview
Comprehensive test suites covering schema validation, backend claim deduction lifecycle, mobile auto-fill interactions, and monorepo-wide typecheck/linting.

---

## Test Plan & Verification Matrix

### 1. Shared Schemas (`packages/shared`)
- Validate `giveawayCreateSchema` with `quantity: 2`, `unit: 'cans'`, and `recordId`.
- Validate quantity minimum (`quantity >= 1`) and non-integer rejection.
- Validate `giveawayPatchSchema` updating quantity and unit.

### 2. Backend Integration Tests (`api/tests/integration/giveaways.test.ts`)
- **Creation Guard**: `POST /v1/giveaways` with `recordId` from another user throws 403 Forbidden.
- **Quantity Overflow Guard**: `POST /v1/giveaways` with `quantity > record.quantity` throws 400 Validation Error.
- **Partial Deduction**: When a giveaway with `quantity: 1` linked to a record with `quantity: 3` is claimed (`POST /giveaways/:id/select`), the linked record's quantity becomes `2` with `status: 'active'`.
- **Full Deduction & Consumption**: When a giveaway with `quantity: 2` linked to a record with `quantity: 2` is claimed, the linked record's quantity becomes `0`, status transitions to `consumed`, and `consumedAt` is set.
- **Lifecycle Confirmation**: `POST /giveaways/:id/confirm-received` completes successfully.

### 3. Mobile UI Tests (`apps/mobile/__tests__`)
- **`PantrySelectModal.test.tsx`**:
  - Renders user's active pantry items.
  - Search filter updates items in real-time.
  - Tapping an item invokes `onSelectRecord` with record and product data.
- **`NewGiveawayScreen.test.tsx`**:
  - Tapping "Select from Pantry" opens the modal.
  - Selecting an item auto-fills title, description, photos, expiration date, `recordId`, and quantity.
  - Quantity stepper caps at max available quantity.
  - Submitting posts the giveaway with `recordId`, `quantity`, and `unit`.
- **`GiveawayCard.test.tsx`**:
  - Displays quantity + unit badge (e.g. `2 cans`).

---

## Verification Commands

```bash
# 1. Shared Schema Tests
pnpm --filter @expyrico/shared test

# 2. Backend Integration Tests
pnpm --filter @expyrico/api test tests/integration/giveaways.test.ts

# 3. Mobile Unit Tests
pnpm --filter @expyrico/mobile test apps/mobile/__tests__/PantrySelectModal.test.tsx apps/mobile/__tests__/NewGiveawayScreen.test.tsx apps/mobile/__tests__/GiveawayCard.test.tsx apps/mobile/__tests__/GiveawayDetailScreen.test.tsx

# 4. Monorepo Typecheck
pnpm --filter @expyrico/shared build
pnpm --filter @expyrico/api build
cd apps/mobile && npx tsc --noEmit

# 5. Monorepo Linting
pnpm run lint
```

---

## Success Criteria
- [ ] All shared schema tests passing (100%).
- [ ] All backend integration tests passing (100%).
- [ ] All mobile unit tests passing (100%).
- [ ] Monorepo builds and typechecks with zero errors.
- [ ] ESLint passes with zero errors and zero warnings.
