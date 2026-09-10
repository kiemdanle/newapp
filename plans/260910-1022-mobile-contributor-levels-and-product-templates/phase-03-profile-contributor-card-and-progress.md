---
phase: 3
title: "Backend Contributions API & Template Dismissal"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1, 2]
# Phase 3: Backend Contributions API & Template Dismissal

<!-- Updated: Validation Session 1 - Dynamic Recalculation on Template Dismissal -->

## Overview

Implement `GET /v1/me/contributions` which computes the caller's contributor level against active admin settings, aggregates contribution stats, and lists all contributed catalog items. Add `isDismissedFromTemplates` to allow deleting personal templates without deleting public community catalog items.

## Requirements

### Functional
1. **Contributions Endpoint (`GET /v1/me/contributions`)**:
   - Authenticated route (`onRequest: app.requireAuth`).
   - Fetches active contributor levels setting from `getSetting(SETTING_KEYS.CONTRIBUTOR_LEVELS, ...)`.
   - If `enabled === false`: returns `{ enabled: false, items: [...] }` so clients hide gamification while preserving contribution history.
   - Queries user's catalog contributions:
     - `product` rows where `createdByUserId = req.user.id` (including `active`, `pending`, `changes_required`, `report_hidden`, `merged_into`).
     - Photos count: `productPhoto` count where `uploadedByUserId = req.user.id`.
     - Edits count: `productEdit` count where `submittedBy = req.user.id && status = 'approved'`.
   - Computes progression via `computeContributorProgression(stats, setting.levels)`.
   - Returns:
     - `enabled`: boolean
     - `progression`: ContributorProgression (level, badge, points, progressPercent, nextLevel, productsToNextLevel).
     - `stats`: `{ totalContributed, activeApproved, pendingReview, changesRequested, editsApproved }`.
     - `items`: Paginated array of contributed product cards with thumbnail, barcode, status, and creation date.

2. **Template Dismissal Flag & Discard Logic**:
   - Add `isDismissedFromTemplates Boolean @default(false) @map("is_dismissed_from_templates")` to `Product` model in Prisma schema.
   - Run Prisma migration: `add_product_dismissed_from_templates`.
   - In `listDrafts` (the template query): add `isDismissedFromTemplates: false` to the `where` clause.
   - In `discardDraft(actor, productId)`:
     - Verify ownership: `product.createdByUserId === actor.id`.
     - **If `status in ['draft', 'changes_required']`**: Hard-delete private unsubmitted draft and child records.
     - **If `status in ['active', 'pending']`**: Set `isDismissedFromTemplates = true`.
       - *Result*: Immediately removes the product from the user's template list.
       - *Safety*: Preserves the public catalog item in the database for other users and existing pantry records!
       - Return `{ success: true, id: productId, dismissed: true }`.

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260910110000_add_product_dismissed_from_templates/migration.sql`
- Create: `api/src/services/products/contributions.ts`
- Create: `api/src/routes/products/contributions.ts`
- Modify: `api/src/services/products/product-drafts.ts`
- Modify: `api/src/routes/products/index.ts`
- Create: `api/tests/integration/user-contributions-and-dismissal.test.ts`

## Implementation Steps
1. Add `isDismissedFromTemplates` to `Product` in `schema.prisma` and create migration.
2. Update `listDrafts` in `product-drafts.ts` to filter out dismissed templates.
3. Update `discardDraft` to allow dismissing `active` and `pending` products instead of rejecting with 409 Conflict.
4. Implement `getContributions(userId, query)` service querying user's products and computing level progression against the configured levels setting.
5. Register route `GET /me/contributions` in Fastify.
6. Write integration tests covering:
   - Contributor points and level calculation for user with products and photos.
   - Respecting admin `enabled: false` flag.
   - Discarding an unsubmitted draft (hard delete).
   - Discarding an active product (sets `isDismissedFromTemplates: true`, product still exists in catalog).

## Success Criteria
- [ ] `GET /v1/me/contributions` returns computed level, badge, and contributed product list.
- [ ] Deleting an active product template sets `isDismissedFromTemplates: true` and succeeds without 409 Conflict.
- [ ] Active products marked dismissed no longer appear in `listDrafts`, but remain accessible in public lookup and pantry records.
- [ ] All API integration tests pass cleanly.
