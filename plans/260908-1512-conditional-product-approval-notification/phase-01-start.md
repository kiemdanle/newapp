---
phase: 1
title: "Backend Notification Suppression on Auto-Approval"
status: pending
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Backend Notification Suppression on Auto-Approval

## Overview
Removes the automatic generation of `product_approved` outbox notifications in `autoApproveProduct`. When platform policy disables moderation requirement, products are published directly into the catalog without masquerading as an approval event.

## Requirements
- **Functional**:
  - In `api/src/services/products/auto-approval.ts`, remove `enqueueOutbox(tx, { userId: product.createdByUserId, templateKey: 'product_approved', payload: { productId: product.id } })` from Branch A (zero photos, lines 111-117) and Branch B (with photos, lines 199-205).
  - Remove redundant `sweepOutbox().catch(() => {})` calls in `auto-approval.ts` if no other outbox items are enqueued during auto-approval.
  - In `api/src/services/products/product-moderation.ts`, retain `enqueueOutbox` for manual admin approval, ensuring creators are notified when their product is reviewed and approved by human moderation.
- **Non-Functional**:
  - Keep auto-approval transaction atomic and fast (<50ms for DB commit).
  - Ensure zero database outbox bloat on high-volume auto-approved catalog additions.

## Architecture
In the Expyrico backend, notifications are queued via an outbox pattern (`api/src/services/notifications/outbox.ts`). The table `OutboxNotification` stores pending notifications until swept by `sweepOutbox` and processed by the notification worker (`api/src/workers/notification-send.ts`).

By removing the outbox enqueue inside `autoApproveProduct`:
1. When `needsApproval: false` in `submitDraft`, `autoApproveProduct` executes.
2. The product is atomically updated to `status: 'active'`, photos approved, and cover image set.
3. No entry is created in `OutboxNotification`.
4. The worker never sends an FCM message for this product.
5. Consequently, the user's mobile device receives no push notification and displays no in-app notification banner toast.

Conversely, when `needsApproval: true`:
1. `submitDraft` transitions the product to `status: 'pending'`.
2. Admin reviews the draft in `apps/admin` and triggers `POST /v1/admin/products/:id/moderate` with `{ decision: 'approve' }`.
3. `api/src/services/products/product-moderation.ts` activates the product AND enqueues `templateKey: 'product_approved'`.
4. Worker sweeps and sends FCM push notification.
5. Mobile device displays "Product Approved" toast banner.

## Related Code Files
- Modify: `api/src/services/products/auto-approval.ts`
- Preserve: `api/src/services/products/product-moderation.ts`
- Verify: `api/src/services/products/product-drafts.ts`

## Implementation Steps
1. Open `api/src/services/products/auto-approval.ts`:
   - Inspect lines 111-117 (Branch A - zero photos). Delete the `enqueueOutbox` block.
   - Inspect lines 199-205 (Branch B - with photos). Delete the `enqueueOutbox` block.
   - Remove unused imports `enqueueOutbox` and `sweepOutbox` from `../notifications/outbox.js` if no longer needed in `auto-approval.ts`.
   - Update docstring in lines 64-67 to reflect that creator notification is omitted on policy auto-approval.
2. Verify `api/src/services/products/product-moderation.ts` retains both outbox enqueues on manual admin approval.

## Success Criteria
- [ ] `autoApproveProduct` in `api/src/services/products/auto-approval.ts` no longer references `product_approved` template key or `enqueueOutbox`.
- [ ] Submitting a product under `requireApproval: false` creates zero records in `outbox_notifications`.
- [ ] TypeScript compilation (`npm --prefix api run typecheck`) passes with 0 errors.

## Risk Assessment
- **Risk**: A downstream test might explicitly assert that `enqueueOutbox` is called during `autoApproveProduct`.
- **Observable Signal**: Test failure in `api/tests/integration` or `api/tests/unit`.
- **Mitigation**: Grep showed no test in `api/tests` currently checks for `product_approved` during auto-approval. We will add a dedicated assertion in integration tests in Phase 3.
