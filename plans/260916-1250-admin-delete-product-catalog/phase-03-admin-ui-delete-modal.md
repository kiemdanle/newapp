---
phase: 3
title: "Admin UI Delete Modal & Merge Prompt UX"
status: complete
priority: P1
effort: "1.5h"
dependencies: [1, 2]
---

# Phase 3: Admin UI Delete Modal & Merge Prompt UX

## Overview
Adds administrative API client functions, Server Actions, and a dedicated `DeleteProductModal` component. When an admin clicks delete, the modal inspects `pantryItemCount`: if 0, it allows direct deletion; if > 0, it blocks deletion, displays an in-use warning, and prompts the admin to merge the product (with direct link to `/products/:id/merge`) or hide it from search.

<!-- Updated: Validation Session 1 - UI trigger placement & In-use modal UX confirmed -->
## Requirements
- Functional:
  - Add `serverAdminApi.products.delete(id: string, version: number)` to `apps/admin/src/lib/admin-api.ts`.
  - Add Server Action `deleteProductAction(id: string, version: number)` to `apps/admin/src/lib/actions.ts`:
    - Wraps `serverAdminApi.products.delete(id, version)` in `runAction`.
    - On success: revalidates `/products`, `/products/${id}`, and returns `{ ok: true }`.
    - On error: surfaces API conflict code (including `version_conflict`) and message (`ApiError.detail`).
<!-- Updated: Red Team Review - Required version token for optimistic concurrency and added barcode compatibility preview in merge tool -->
  - Create `DeleteProductModal` in `apps/admin/src/app/(admin)/products/[id]/delete-product-modal.tsx`:
    - Receives `product: { id: string; name: string; pantryItemCount: number; status: string; barcode?: string | null; version: number }`.
    - **In-Use State (`pantryItemCount > 0`)**:
      - Amber/Red header with `AlertTriangle` icon.
      - Heading: "Cannot Delete Product in Use".
      - Explanation: "This product is currently used by {pantryItemCount} pantry item(s). Deleting it directly would break or orphan user pantry records."
      - Primary Recommendation: "To clean up this product, please use the Merge tool to consolidate it with another canonical product. All pantry items will be moved safely."
      - Immediate Containment Shortcut: "If this product should not be used for new items, use 'Hide from search' while arranging the merge."
      - Buttons:
        - "Close" (dismiss modal).
        - Primary CTA: "Merge into another product" (navigates to `/products/${id}/merge?direction=into`).
    - **Unused State (`pantryItemCount === 0`)**:
      - Red header with `Trash2` icon.
      - Heading: "Delete Catalog Product".
      - Explanation: "Are you sure you want to delete **{product.name}**? No pantry items are currently using this product. Deleting it will permanently remove it from the catalog and release its barcode/identifiers. This action cannot be undone."
      - Buttons:
        - "Cancel" (dismiss modal).
        - "Delete Product" (destructive red button `bg-[#E0442A] text-white hover:bg-[#E0442A]/90`, disabled while pending, shows spinner).
  - Add "Delete product" button on product detail page:
    - In hero card action shortcuts (`apps/admin/src/app/(admin)/products/[id]/page.tsx`): next to "Merge product", render a "Delete product" button with `Trash2` icon.
    - In `ProductActions` (`product-actions.tsx`): provide a "Delete product" button in direct actions.
  - Add pantry item indicator on products table:
    - Add a quick Delete button/link in row actions that opens `DeleteProductModal` directly from the list page.
  - **Source-Aware Merge Tool Extension (`apps/admin/src/app/(admin)/products/[id]/merge/page.tsx` & `merge-tool.tsx`)**:
    - In `page.tsx`: read `searchParams.direction`. When `direction === 'into'`, set mode to source-aware (`isSourceMode = true`). Header displays: "Merge {source.name} into another product", explaining that pantry records ({source.pantryItemCount}) will move into the selected target.
    - In `merge-tool.tsx`:
      - **Query-State Preservation:** Update `submitSearch` to preserve `direction`:
        ```ts
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (direction) params.set('direction', direction);
        const qs = params.toString();
        router.push(`/products/${productId}/merge${qs ? `?${qs}` : ''}`);
        ```
        This prevents searching for candidate targets from dropping `direction=into` and reverting to winner mode.
      - When `direction === 'into'`, treat product `:id` as the **source** being retired, and treat searched candidates as potential **canonical targets**.
      - **Barcode Compatibility Preview:** If source product has a barcode and candidate target has a different non-null barcode, display an inline warning badge (*"Different barcode — target barcode will be retained"* or conflict flag), guiding the admin before submitting.
      - Candidate rows render a "Merge into this product" button. When confirmed, invokes `mergeProductsAction(selectedTarget.id, [sourceId], selectedTarget.version)`, ensuring the blocked product is passed as `sourceIds: [id]` and NOT `targetId`. On success, redirects to `/products/${selectedTarget.id}`.
- Non-functional:
  - Adheres to Expyrico visual guidelines (`docs/design/expyrico-colour-palette.md`): Alert Red `#E0442A` for destructive actions, Fresh Sage `#4BAE8A` / Deep Sage `#3A8F6F` for primary accents, Honey `#F5A623` / Soft Butter `#FEEFC3` for warning highlights.
  - Keyboard accessible (Esc closes dialog, autofocus on primary action).

## Architecture
```
ProductDetailPage / ProductsPage
        │
        ▼ (clicks "Delete product")
 [DeleteProductModal]
        │
        ├── if pantryItemCount > 0
        │   ├── Display warning & explanation
        │   ├── "Hide from search" button (patches status to report_hidden)
        │   └── "Merge into another product" button (router.push('/products/:id/merge?direction=into'))
        │       └── In-tool: :id is SOURCE, searched candidate is TARGET
        └── if pantryItemCount === 0
            ├── Display permanent deletion warning
            └── "Delete Product" button -> deleteProductAction(id)
                                                │
                                                ▼ (revalidates /products & redirects)
```

## Related Code Files
- Create: `apps/admin/src/app/(admin)/products/[id]/delete-product-modal.tsx`
- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/merge/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/merge/merge-tool.tsx`
- Modify: `apps/admin/src/app/(admin)/products/page.tsx`

## Implementation Steps
1. In `apps/admin/src/lib/admin-api.ts`:
   - Add `delete: (id: string, version: number) => apiServerFetch<void>(/v1/admin/products/${id}?version=${version}, { method: 'DELETE' })` under `products`.
2. In `apps/admin/src/lib/actions.ts`:
   - Implement `deleteProductAction(id: string, version: number): Promise<ActionResult<void>>`.
3. Create `apps/admin/src/app/(admin)/products/[id]/delete-product-modal.tsx`:
   - Implement modal UI with two branch layouts: blocked with merge prompt vs confirmation of direct deletion.
   - Pass `product.version` to `deleteProductAction`.
4. Update `apps/admin/src/app/(admin)/products/[id]/page.tsx` & `product-actions.tsx`:
   - Add "Delete product" trigger button to hero action bar and action footer.
   - Mount `DeleteProductModal` controlled by state.
5. Update `apps/admin/src/app/(admin)/products/page.tsx`:
   - Add "Pantry Items" column to table.
   - Add row-level delete trigger.
6. In `apps/admin/src/app/(admin)/products/[id]/merge/page.tsx` & `merge-tool.tsx`:
   - Add `direction === 'into'` support, inverting target/source assignment so `:id` is the source to be merged away and candidate selected is the target.
   - Update `submitSearch` to retain `direction=into` in URL search params so target searches do not reset to winner mode.
   - Display inline barcode conflict warning if candidate target carries a conflicting barcode.

## Success Criteria
- [x] Clicking "Delete product" on an unused product opens confirmation modal and successfully deletes the product upon confirmation, redirecting to `/products`.
- [x] Clicking "Delete product" on a product used by pantry items displays clear in-use warning, blocks deletion, and renders "Merge into another product" and "Hide from search" buttons.
- [x] Tapping "Merge into another product" navigates to `/products/${id}/merge?direction=into`, and submitting searches preserves `direction=into`.
- [x] Tapping "Hide from search" updates status to `report_hidden` immediately.
- [x] Products table displays pantry item counts accurately.

## Risk Assessment
- Risk: Admin initiates deletion while a user on mobile simultaneously adds a pantry item referencing that product.
  - Mitigation: Even if UI showed `pantryItemCount === 0` at load time, the backend transaction re-verifies under lock. If the count changed, the server returns a 409 Conflict error, which `DeleteProductModal` catches and dynamically switches into the "in-use" merge prompt view.
