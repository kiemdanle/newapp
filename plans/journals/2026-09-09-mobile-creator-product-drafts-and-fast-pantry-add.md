---
title: Mobile Creator Product Drafts and Fast Pantry Add
date: 2026-09-09
summary: Unified unapproved drafts and approved catalog items with interactive filter tabs and one-tap pantry addition
---

# Mobile Creator Product Drafts and Fast Pantry Add

Unified unapproved drafts and approved catalog items with interactive filter tabs and one-tap pantry addition

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Problem
When a user created and submitted a product draft, upon approval (`active`), the product disappeared from "My product drafts" because `GET /v1/products/drafts` filtered strictly for unapproved items (`draft`, `pending`, `changes_required`). This created user confusion and prevented users from utilizing pre-added items as fast templates for future pantry stocking.

## Changes
1. **Shared Schemas (`@expyrico/shared`)**:
   - Added `'active'` to `PRODUCT_DRAFT_STATUSES`.
   - Expanded `productDraftsQuerySchema` to accept `status: 'all'` or any individual status in `['draft', 'pending', 'changes_required', 'active']`.
   - Verified tests in `packages/shared` pass cleanly.

2. **Fastify API (`api/src/services/products/product-drafts.ts`)**:
   - Updated `toDraftRow` to utilize `toApiProductPhoto(cover, product.id).thumbnailUrl` to correctly resolve public CDN thumbnail URLs for active products.
   - Updated `listDrafts` query to include `active` in the default list when `query.status` is omitted or `'all'`.
   - Mapped `query.status === 'draft'` to `{ in: [ProductStatus.draft, ProductStatus.changes_required] }`.
   - Unconditionally bound `createdByUserId: actorId` to guarantee strict creator-only isolation.

3. **Mobile Screen & UI (`apps/mobile`)**:
   - Added interactive filter tabs: `All`, `Active`, `In review`, `Drafts`.
   - Styled status badges with Expyrico palette: Fresh Sage `#4BAE8A` (Active), Honey `#F5A623` (Awaiting review), Pebble `#8C8C85` (Draft), Alert Red `#E0442A` (Changes requested).
   - Implemented fallback icon placeholder when `cover === null`.
   - Added inline `+ Add` button on `active` and `pending` rows with a 300ms multi-tap debounce guard.
   - Configured ActionSheet on row press (`Add to Pantry`, `View Product Details`, `Cancel`).
   - Created `DraftPantryAddModal.tsx` hosting `AddRecordForm` keyed by `product.id` with `lockedPersonalScope: true` for pending products.
   - Added quick date preset chips (`+3d`, `+1w`, `+1m`, `+3m`) and shelf-life auto-initialization in `AddRecordForm.tsx`.

4. **Verification**:
   - Unit & integration tests pass across `packages/shared`, `api`, and `apps/mobile`.
   - Local Gradle build succeeded (`BUILD SUCCESSFUL in 31s`).
   - Debug APK installed via ADB to Xiaomi MI 9 (`Success`).
