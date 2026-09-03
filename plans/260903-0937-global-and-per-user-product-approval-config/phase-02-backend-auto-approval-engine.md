---
phase: 2
title: "Backend Auto-Approval Engine & API Service"
status: pending
priority: P1
effort: "6h"
dependencies: [1]
---
<!-- Updated: Validation Session 1 - Silent auto-approval and distinct post-submit status response -->
<!-- Updated: Red Team Review - Findings 1, 2, 3, 4 (Two-phase photo promotion, zero-photo branch, null-user fail-safe, submission velocity throttling) -->

# Phase 2: Backend Auto-Approval Engine & API Service

## Overview
Implement the product auto-approval pipeline in the backend API. When a user submits a product draft, check both the creator's `requireProductApproval` flag and the global `requireApproval` setting. If approval is not required, immediately transition the product to `active`, promote private product photos to public storage, populate the cover `imageUrl`, and notify the creator. Also update Admin API endpoints for updating user flags and global settings.

## Requirements
- Functional:
  - In `submitDraft` (`api/src/services/products/product-drafts.ts`):
    - Fail-safe user lookup: If creator record is missing or null, fail closed: `needsApproval = true` (never auto-approve orphaned drafts).
    - Velocity throttle guard: Track daily auto-approved submissions in Redis (`product-creation:auto-approved-count:${actorId}:${utcDay}`); if user exceeds cap (default: 10 auto-approved products/day), gracefully route surplus submissions to `pending` moderation queue instead of rejecting or allowing infinite spam cycling.
    - Determine approval status:
      `const needsApproval = Boolean(user.requireProductApproval || globalSettings.requireApproval || exceededDailyAutoApprovalCap);`
    - If `needsApproval === true`:
      - Preserve existing pending review flow (status: `'pending'`, emit moderation notification event).
    - If `needsApproval === false`:
      - Execute auto-approval via two-phase commit:
        - **Branch A (Zero photos)**: If `pendingPhotos.length === 0`, directly update `product.status = 'active'`, `moderatedAt = new Date()` in a single atomic database transaction without acquiring a media lease.
        - **Branch B (Has photos)**: Reserve capacity, acquire `withMediaMutationLease('publish_public')`, run `publishProductPhoto` for all pending photos, and only then atomically commit `product.status = 'active'` and `photos.moderationStatus = 'approved'`. If publication fails, roll back without marking product active.
        - Set position 0 photo URL as product `imageUrl`.
        - Enqueue outbox notification to creator (`product_approved`).
        - Silent auto-approval: Omit admin moderation notification events; write structured audit log (`product.auto_approve`).
        - Return ApiProduct with status `'active'` to caller so mobile app displays distinct success confirmation ("Published to catalog").
  - Anti-spam scope: `requireProductApproval: true` on a user applies to all future submissions; existing active catalog products remain unchanged.
  - In `adminUsersPatchRoute` (`api/src/routes/admin/users/patch.ts`):
    - Accept `requireProductApproval: boolean` in request body.
    - Update `user.requireProductApproval` in database.
    - Record audit log with `before` and `after` values.
  - In `adminSettingsProductCreationRoute` (`api/src/routes/admin/settings/product-creation.ts`):
    - Support retrieving and saving `requireApproval` alongside `mode`.
- Non-functional:
  - Idempotent and concurrency-safe photo promotion with existing media leases.
  - Transactional consistency: draft submission and state transition in single atomic flow.

## Architecture
- **Auto-Approval Flow**:
  Extract or share the photo promotion logic currently in `api/src/services/products/product-moderation.ts` so that both manual admin approval and system auto-approval execute the identical, battle-tested media promotion pipeline (`publish_public`).
- **Audit Trail**:
  Write explicit structured log line and audit log on auto-approval, ensuring administrative oversight can trace which products bypassed manual moderation.

## Related Code Files
- Create: `api/src/services/products/auto-approval.ts`
- Modify: `api/src/services/products/product-drafts.ts`
- Modify: `api/src/services/products/product-moderation.ts`
- Modify: `api/src/routes/admin/users/patch.ts`
- Modify: `api/src/routes/admin/users/get.ts`
- Modify: `api/src/routes/admin/settings/product-creation.ts`
- Create: `api/tests/unit/auto-approval.test.ts`
- Create: `api/tests/integration/product-auto-approval.test.ts`

## Implementation Steps
1. Create `autoApproveProduct` service function in `api/src/services/products/auto-approval.ts`:
   - Reuse existing photo publication logic from `product-moderation.ts`.
   - Update product to `status: 'active'`, `moderatedAt: new Date()`.
   - Promote photos to `moderationStatus: 'approved'` and assign `imageUrl`.
   - Send `product_approved` outbox notification to creator.
2. Update `submitDraft` in `api/src/services/products/product-drafts.ts`:
   - Fetch creator record from database including `requireProductApproval`.
   - Fetch `getSetting(SETTING_KEYS.PRODUCT_CREATION, productCreationSettingsSchema)`.
   - Compute `const needsApproval = Boolean(creator?.requireProductApproval || settings.requireApproval);`.
   - If `needsApproval`: execute existing `status: 'pending'` and notification queue.
   - If `!needsApproval`: invoke `autoApproveProduct`, bypassing moderation queue.
3. Update `api/src/routes/admin/users/patch.ts`:
   - Include `input.requireProductApproval` in `prisma.user.update`.
   - Include in audit log diff.
4. Update `api/src/routes/admin/settings/product-creation.ts`:
   - Verify `GET /product-creation` returns `{ mode, requireApproval }`.
   - Verify `PATCH /product-creation` persists `{ mode, requireApproval }`.
5. Add unit and integration tests verifying auto-approval vs forced moderation.

## Success Criteria
- [x] Regular user submits draft with global approval disabled -> product is immediately active with public photo.
- [x] User flagged with `requireProductApproval: true` submits draft -> product is placed into `pending` status.
- [x] Global approval set to enabled -> all users' submissions enter `pending` status.
- [x] Admin patch endpoint successfully updates `requireProductApproval`.

## Risk Assessment
- Risk: Photo publication race condition if background worker or recheck runs simultaneously.
  - Signal: Version conflict or media operation lease lock.
  - Mitigation: Use existing `withMediaMutationLease('publish_public', ...)` and optimistic concurrency version increments.
