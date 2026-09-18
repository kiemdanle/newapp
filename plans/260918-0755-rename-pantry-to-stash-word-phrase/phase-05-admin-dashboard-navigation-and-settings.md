---
phase: 5
title: "Admin Dashboard Navigation & Settings"
status: pending
priority: P1
effort: "1.5h"
dependencies: [4]
---

# Phase 5: Admin Dashboard Navigation & Settings

## Overview

Update the admin dashboard sidebar navigation, overview and analytics KPI cards, stash limits/units configuration forms, product catalogue deletion/merge protection alerts, and item explorer screens from "Pantry" to "Stash", while strictly preserving admin location presets.

## Requirements

### Functional Requirements
- **Sidebar & Global Navigation (`apps/admin/src/lib/nav.ts`)**:
  - Settings submenu items updated:
    - `{ label: 'Stash units', href: '/settings/pantry-units', icon: 'Scale' }`
    - `{ label: 'Stash limits', href: '/settings/pantry-limits', icon: 'Layers' }`
  - Item management section updated:
    - `{ title: 'Stash', items: [{ label: 'Stash Items', href: '/pantry-items', icon: 'Archive' }] }`
- **Dashboard & Analytics KPIs**:
  - `apps/admin/src/app/(admin)/page.tsx`:
    - KPI label: `'Stash Records'`, sublabel: `'Tracked stash items'`.
  - `apps/admin/src/app/(admin)/analytics/overview/page.tsx`:
    - KPI card sublabel: `'User & household stash items'`.
  - `apps/admin/src/app/(admin)/giveaways/page.tsx`:
    - Header: `'Stash Giveaways'`.
  - `apps/admin/src/app/(admin)/households/page.tsx`:
    - Header: `'Stash Households'`, sublabel: `'Shared stash management groups and household memberships.'`.
- **Stash Limits Settings (`/settings/pantry-limits/`)**:
  - `page.tsx`:
    - Header: `'Stash Item Limits'`.
    - Description: `"Configure the maximum number of active stash items each user can hold in their personal and shared stashes."`
  - `pantry-limits-form.tsx`:
    - Card title: `'Maximum Active Stash Items'`.
    - Toast feedback: `"Stash item limit set to {N} items successfully."`
    - Decrease confirmation modal: `"Are you sure you want to reduce the default stash limit from {initial} to {limit} items?"`
    - Aria labels: `'Decrease stash limit by 5'`, `'Increase stash limit by 5'`.
- **Stash Units Settings (`/settings/pantry-units/`)**:
  - `page.tsx`: Header badge `'Stash Configuration'`.
  - `pantry-units-form.tsx`: Toast feedback `'Stash units setting saved successfully.'`.
- **Product Catalogue Deletion & Merge Guard (`/products/`)**:
  - Table column header: `'Stash Items'`.
  - `delete-product-modal.tsx`:
    - In-use error: `"This product is in use by stash items and cannot be deleted."`
    - Warning banner: `"This product is currently used by {N} stash item(s). Deleting it directly would break or orphan user stash records."`
    - Recommended action: `"Use the Merge tool to consolidate this product into another canonical product. All stash items, reviews, and deals will be safely moved."`
    - Zero in-use copy: `"No stash items are currently using this product..."`
  - `api/src/routes/admin/products/delete.ts`:
    - Update deletion block detail error from `used by ${recordCount} pantry items` to `used by ${recordCount} stash items` so backend error responses align with UI terminology.
  - `product-actions.tsx`:
    - Prompt: `'Hide this product from search? Existing stash references will stay intact.'`
  - `merge/page.tsx` & `merge-tool.tsx`:
    - Header/subtitles: `"Consolidate this product's {N} stash item(s), reviews, and deals into another active canonical target..."`
    - Confirmation alert: `"Merge \"{winner}\" into \"{target}\"? All {N} stash records and associated data will move to \"{target}\"..."`
- **Stash Items Explorer (`/pantry-items/`)**:
  - `page.tsx`: Header `'Stash Items'`, description `"Manage, search, filter, and inspect user stash items across the entire platform."`
  - `pantry-items-table.tsx`: Empty state `"No stash items found."`
  - `[id]/page.tsx`: Breadcrumb `'Back to Stash Items'`.
  - `edit-pantry-item-modal.tsx`: Modal title `'Edit Stash Item'`, toast `"Failed to update stash item."`
  - Action modals: Discard/Delete toasts updated to `"Failed to delete stash item."`
- **Strict Exclusions**:
  - `edit-pantry-item-modal.tsx`: `LOCATION_PRESETS` MUST retain `['Fridge', 'Freezer', 'Pantry', 'Cabinet', 'Counter']`!

### Non-Functional Requirements
- Maintain UK English conventions (`dialogue`, `catalogue`, `programme`).
- Do not modify Next.js route paths (`/settings/pantry-limits`, `/settings/pantry-units`, `/pantry-items`) to prevent breaking bookmarked URLs or API calls.

## Architecture

```
Admin Dashboard Navigation
  ├── Sidebar: Stash limits · Stash units · Stash Items
  ├── KPI Cards: Stash Records (Tracked stash items)
  ├── Settings Forms: Maximum Active Stash Items · Stash Configuration
  ├── Product Guard: "This product is in use by stash items"
  └── Item Explorer: "Stash Items" · "No stash items found"
```

## Related Code Files
<!-- Updated: Red Team Review Session - F3 API delete error string, F5 admin test updates -->

### Modify
- `api/src/routes/admin/products/delete.ts`
- `apps/admin/tests/unit/products-delete.test.ts`
- `apps/admin/src/lib/nav.ts`
- `apps/admin/src/app/(admin)/page.tsx`
- `apps/admin/src/app/(admin)/analytics/overview/page.tsx`
- `apps/admin/src/app/(admin)/giveaways/page.tsx`
- `apps/admin/src/app/(admin)/households/page.tsx`
- `apps/admin/src/app/(admin)/settings/pantry-limits/page.tsx`
- `apps/admin/src/app/(admin)/settings/pantry-limits/pantry-limits-form.tsx`
- `apps/admin/src/app/(admin)/settings/pantry-units/page.tsx`
- `apps/admin/src/app/(admin)/settings/pantry-units/pantry-units-form.tsx`
- `apps/admin/src/app/(admin)/products/page.tsx`
- `apps/admin/src/app/(admin)/products/[id]/delete-product-modal.tsx`
- `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx`
- `apps/admin/src/app/(admin)/products/[id]/merge/page.tsx`
- `apps/admin/src/app/(admin)/products/[id]/merge/merge-tool.tsx`
- `apps/admin/src/app/(admin)/pantry-items/page.tsx`
- `apps/admin/src/app/(admin)/pantry-items/pantry-items-table.tsx`
- `apps/admin/src/app/(admin)/pantry-items/[id]/page.tsx`
- `apps/admin/src/app/(admin)/pantry-items/[id]/edit-pantry-item-modal.tsx`
- `apps/admin/src/app/(admin)/pantry-items/discard-pantry-item-modal.tsx`
- `apps/admin/src/app/(admin)/pantry-items/delete-pantry-item-modal.tsx`

## Implementation Steps

1. Edit `apps/admin/src/lib/nav.ts`:
   - Update nav labels to `'Stash units'` and `'Stash limits'`.
   - Update preserved section title to `'Stash'` and item to `'Stash Items'`.
2. Edit `apps/admin/src/app/(admin)/page.tsx` and `analytics/overview/page.tsx`:
   - Update KPI card titles and sublabels to reference `stash`.
3. Edit `apps/admin/src/app/(admin)/settings/pantry-limits/`:
   - Update page title, description, form card header, toast message, and decrease confirmation text.
4. Edit `apps/admin/src/app/(admin)/settings/pantry-units/`:
   - Update page badge to `'Stash Configuration'` and save toast to `'Stash units setting saved successfully.'`.
5. Edit `apps/admin/src/app/(admin)/products/`:
   - Update table header to `'Stash Items'`.
   - Update deletion guard and merge tool prompt copy.
   - Update `api/src/routes/admin/products/delete.ts` error detail to reference `stash items`.
   - Update `apps/admin/tests/unit/products-delete.test.ts` assertion to expect `'used by 3 stash items'`.
   - Update explorer title, breadcrumb, empty state, and modal headers.
   - Verify `LOCATION_PRESETS` in `edit-pantry-item-modal.tsx` retains `'Pantry'`.
7. Typecheck and lint:
   - Run `pnpm --filter @expyrico/admin typecheck`.

## Success Criteria

- [x] Sidebar displays "Stash limits" and "Stash units".
- [x] Overview dashboard displays "Stash Records" KPI.
- [x] Stash limits settings page displays "Maximum Active Stash Items".
- [x] Stash units settings page displays "Stash Configuration" badge.
- [x] Product catalogue table displays "Stash Items" column.
- [x] Product deletion modal displays "This product is in use by stash items and cannot be deleted."
- [x] Backend delete endpoint returns "used by N stash items" in conflict detail.
- [x] Admin product delete unit test passes with updated stash assertion.
- [x] Stash items explorer displays "Stash Items" and "No stash items found."
- [x] Admin location presets retain `['Fridge', 'Freezer', 'Pantry', 'Cabinet', 'Counter']`.
- [x] `pnpm --filter @expyrico/admin typecheck` passes with 0 errors.

## Risk Assessment

- **Risk**: Changing the server action names or schema keys might break API communications.
- **Mitigation**: Do not change underlying action names or payload keys (`defaultUserPantryLimit`, `savePantryLimitsAction`). Only update visual text labels, descriptions, and user prompts.
