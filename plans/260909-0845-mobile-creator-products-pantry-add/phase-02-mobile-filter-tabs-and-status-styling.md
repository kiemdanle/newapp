---
phase: 2
title: "Mobile Filter Tabs and Status Styling"
status: pending
priority: P1
effort: "1.5h"
dependencies: ["1"]
---

# Phase 2: Mobile Filter Tabs and Status Styling

## Overview
Enhance `ProductDraftsScreen` with an interactive filter tab bar (`All`, `Active`, `In review`, `Drafts`), update the query hook to support tab filtering, and style the status badges according to Expyrico palette standards.

## Requirements
- Functional:
  - Add filter tabs at the top of the list:
    - **All**: Shows all creator products.
    - **Active**: Shows approved products (`status: 'active'`).
    - **In review**: Shows submitted products awaiting review (`status: 'pending'`).
    - **Drafts**: Shows unsubmitted drafts and changes requested (`status: 'draft'`, `'changes_required'`).
  - Switching tabs updates the query parameter and filters items immediately.
  - Active products display a "Catalog Active" badge in Fresh Sage `#4BAE8A`.
  - Pending products display an "Awaiting Review" badge in Honey `#F5A623`.
  - Drafts display a "Draft" badge in Pebble `#8C8C85`.
  - Changes required display a "Changes Requested" badge in Alert Red `#E0442A`.
  - Both public CDN thumbnails and private thumbnail URLs render properly in `DraftRow`.
  <!-- Applied: Red Team Finding 3 - Graceful null cover placeholder -->
  - When an active or draft product has `cover === null`, `DraftRow` renders a consistent fallback icon container (`Ionicons barcode-outline` or `cube-outline` on `bgGlass`) without layout shift or broken image attempts.
  <!-- Updated: Validation Session 1 - Keep 'My product drafts' title, update subtitle to describe both contributed and drafting items -->
  - Retain the screen title "My product drafts" on screen and Profile tab, updating the subtitle to: "Products you've contributed or are drafting for the catalog."
- Non-functional:
  - Follow Expyrico color requirements: Fresh Sage `#4BAE8A`, Honey `#F5A623`, Pebble `#8C8C85`, Alert Red `#E0442A`.
  - Tab switching must be fast with cached pages and zero flickering.

## Architecture
1. **API Hook (`apps/mobile/src/api/products.ts`)**:
   - Update `useProductDrafts(status?: ProductDraftStatus | 'all')` to include the status in the React Query key: `['products', 'drafts', status ?? 'all']`.
   - Pass `status` query param to `GET /products/drafts` when not `'all'`.
2. **UI Components (`apps/mobile/app/(app)/product/drafts.tsx`)**:
   - `FilterTabBar`: Horizontal pill buttons with active indicator.
   - `STATUS_LABEL` & `STATUS_COLOR`:
     - `active`: Label "Catalog Active", Color: Fresh Sage `#4BAE8A`, Bg: Mint Mist `#D6F0E6`.
     - `pending`: Label "Awaiting review", Color: Honey `#F5A623`, Bg: Soft Butter `#FEEFC3`.
     - `draft`: Label "Draft", Color: Pebble `#8C8C85`, Bg: Stone `#F0F0ED`.
     - `changes_required`: Label "Changes requested", Color: Alert Red `#E0442A`, Bg: `#FDE8E8`.
   - `DraftRow`: Supports rendering public image via standard FastImage/Image or `PrivateProductImage` based on URL format.

## Related Code Files
- Modify: `apps/mobile/src/api/products.ts`
- Modify: `apps/mobile/app/(app)/product/drafts.tsx`
- Modify: `apps/mobile/__tests__/routes/product-drafts.test.tsx`

## Implementation Steps
1. In `apps/mobile/src/api/products.ts`:
   - Update `useProductDrafts` to accept `status?: ProductDraftStatus | 'all'`.
   - Ensure cache invalidations in mutations invalidate `['products', 'drafts']` prefix.
2. In `apps/mobile/app/(app)/product/drafts.tsx`:
   - Add `selectedTab` state (`'all' | 'active' | 'pending' | 'draft'`).
   - Render horizontal filter tabs above the FlatList.
   - Update `STATUS_LABEL` and `statusColor` to include `active`.
   - Handle image rendering for active products with public thumbnail URLs.
3. In `apps/mobile/__tests__/routes/product-drafts.test.tsx`:
   - Add unit test verifying tab switching triggers correct query calls and filters rows.

## Success Criteria
- [ ] Tabs `All`, `Active`, `In review`, `Drafts` appear and switch filters seamlessly.
- [ ] Active products display "Catalog Active" in Fresh Sage `#4BAE8A`.
- [ ] Active products display their cover thumbnails properly.
- [ ] Mobile tests pass: `npm test -- apps/mobile/__tests__/routes/product-drafts.test.tsx`.

## Risk Assessment
- **Risk**: Tab switching during refetch could cause state race conditions.
  - **Mitigation**: Use separate query keys for each tab (`['products', 'drafts', tab]`) so TanStack Query caches each tab independently.
