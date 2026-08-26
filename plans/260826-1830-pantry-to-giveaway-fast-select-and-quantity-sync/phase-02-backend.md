---
phase: 2
title: "Backend Data Model & Claim-Time Deduction Lifecycle"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Backend Data Model & Claim-Time Deduction Lifecycle

## Overview
Add database support for giveaway quantity, enforce record ownership on creation, and atomically deduct or remove linked pantry items inside PostgreSQL transactions when a giveaway is claimed or completed.
### Functional Requirements
- **Database Schema**: Add `quantity DOUBLE PRECISION NOT NULL DEFAULT 1` and `unit VARCHAR(16) NOT NULL DEFAULT 'pcs'` to PostgreSQL `giveaways` table and Prisma schema (`quantity Float @default(1)`).
- **Creation Guard & Scope (`create.ts`)**:
  - When `input.recordId` is present:
    - Call `await assertCanWriteRecord(record, req.user.id)` from `services/households/permissions.js` to ensure the caller has verified access (personal owner or active household member), throwing 404/403 properly without leaking existence.
    - Validate that `input.quantity <= record.quantity` (cannot give away more than available in pantry).
    - If `input.productId` is not explicitly provided, auto-link `productId = record.productId`.
    - If `input.expiryDate` is not explicitly provided, auto-populate `expiryDate = record.expiryDate`.
- **Claim-Time Atomic Deduction (`select.ts`)**:
  - Inside `prisma.$transaction`:
    - When giver selects a claimer (`status = 'claimed'`), if `giveaway.recordId` is set:
      - Acquire row lock on `Record` with `findUnique`.
      - If record exists and is `active`:
        - Calculate `newQuantity = record.quantity - giveaway.quantity`.
        - If `newQuantity > 0`: Update `record.quantity = newQuantity`.
        - If `newQuantity <= 0`: Set `record.quantity = 0`, `record.status = 'consumed'`, and `record.consumedAt = new Date()`.
      - If record is already `consumed` or deleted: proceed gracefully without failing the claim transaction (logs warning).
- **Cancellation Quantity Restoration (`cancel.ts`)**:
  - If a claimed giveaway is cancelled before completion, inside `prisma.$transaction`:
    - Check if `giveaway.recordId` is linked and was previously deducted during claim selection (`status === 'claimed'`).
    - If record is found:
      - If record is `consumed` with `quantity === 0`: restore `quantity = giveaway.quantity`, `status = 'active'`, and `consumedAt = null`.
      - If record is `active`: restore `quantity = record.quantity + giveaway.quantity`.
    - If record was deleted: skip quantity restoration without failing the cancellation.
- **Repository Output (`repository.ts`)**:
  - `toApiGiveaway` outputs `quantity` and `unit` on all giveaway endpoints.
## Implementation Details

### 1. Prisma & Migration
```sql
-- api/prisma/migrations/20260826190000_add_giveaway_quantity/migration.sql
ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS quantity DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS unit VARCHAR(16) NOT NULL DEFAULT 'pcs';
```

### 2. Transactional Claim Deduction (`select.ts`)
```typescript
// Inside selectClaimRoute $transaction:
if (giveaway.recordId) {
  const linkedRecord = await tx.record.findUnique({
    where: { id: giveaway.recordId },
  });

  if (linkedRecord && linkedRecord.status === 'active') {
    const deductQty = giveaway.quantity || 1;
    const remaining = linkedRecord.quantity - deductQty;

    if (remaining > 0) {
      await tx.record.update({
        where: { id: linkedRecord.id },
        data: { quantity: remaining },
      });
    } else {
      await tx.record.update({
        where: { id: linkedRecord.id },
        data: {
          quantity: 0,
          status: 'consumed',
          consumedAt: new Date(),
        },
      });
    }
  }
}
```

---

## Related Code Files
- Create: `api/prisma/migrations/20260826190000_add_giveaway_quantity/migration.sql`
- Modify: `api/prisma/schema.prisma`
- Modify: `api/src/services/giveaways/repository.ts`
- Modify: `api/src/routes/giveaways/create.ts`
- Modify: `api/src/routes/giveaways/select.ts`
- Modify: `api/tests/helpers/factories.ts`
- Modify: `api/tests/integration/giveaways.test.ts`

---

## Implementation Steps
1. Create SQL migration adding `quantity` and `unit` to `giveaways`.
2. Update `model Giveaway` in `schema.prisma` and execute `prisma generate`.
3. Update `create.ts` to validate `recordId` ownership and quantity bounds.
4. Update `select.ts` to atomically deduct record quantity or transition to `consumed` when remaining `<= 0`.
5. Update `toApiGiveaway` to serialize `quantity` and `unit`.
6. Add unit and integration tests verifying claim selection deduction and record removal.

---

## Success Criteria
- [ ] Database migration applies cleanly.
- [ ] `POST /v1/giveaways` rejects giveaway creation if `recordId` belongs to a different user.
- [ ] `POST /v1/giveaways/:id/select` decreases linked record quantity in PostgreSQL.
- [ ] When quantity reaches `0`, record status becomes `consumed`.
- [ ] All integration tests pass in `api/tests/integration/giveaways.test.ts`.
