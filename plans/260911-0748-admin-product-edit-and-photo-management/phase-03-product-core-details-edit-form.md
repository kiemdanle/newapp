---
phase: 3
title: "Product Core Details Edit Form"
status: pending
priority: P1
effort: "3h"
dependencies: [1, 2]
---

# Phase 3: Product Core Details Edit Form

<!-- Updated: Validation Session 1 - Enforce barcode policy in UI: barcode cannot be cleared once set -->

## Overview
Redesign and expand the product editing interface in `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx` into a modern, comprehensive catalog editing suite that handles Name, Brand, Category, Description (multi-line textarea), Barcode, and Default Shelf Life, backed by optimistic concurrency version protection.

## Requirements
- Functional:
  - Form inputs for all core fields:
    - **Product Name** (required, string, min 1 char)
    - **Brand** (optional, string)
    - **Category** (optional, string)
    - **Barcode** (optional if product has none; once set, can be edited to a new barcode but cannot be cleared)
    - **Default Shelf Life** (optional, integer days, range 1 - 3650)
    - **Description** (optional, multi-line textarea with character counter / guidance)
  - **Barcode UX Validation**:
    - If the product already has an existing barcode, do not permit clearing it. If the input is emptied, show helper error text: "Existing barcodes cannot be removed once set."
    - If the product currently has no barcode, assigning one is optional.
  - Form validation: client-side checks before submission (e.g. shelf life must be positive integer if provided).
  - Dirty form detection: highlight when unsaved edits are present, and disable submit when unchanged.
  - "Save Changes" triggers `patchProductAction(id, version, payload)` with sanitized fields (trimmed, empty strings converted to `null` for optional fields, except barcode).
  - Stale version handling: if another admin updated the record (`version_conflict`), display a conflict alert with a "Refresh Latest Data" button.
  - Success toast / banner: clear feedback upon successful save.
  - Pass all product fields (`description`, `barcode`, `defaultShelfLifeDays`) from `ProductDetailPage` (`page.tsx`) into `ProductActions`.
- Non-functional:
  - Strict adherence to Expyrico Design System:
    - Primary Sage `#4BAE8A`, Deep Sage `#3A8F6F`
    - Warm White `#FAFAF8`, Card background `#FFFFFF`
    - Border `#E5E5E0`, Neutral Dark `#2C2C28`, Neutral Mid `#8C8C85`
    - Alert Red `#E0442A` for destructive actions
    - No unauthorized gradients or synthetic colors.

## Architecture & Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ Direct Catalog Edits                                    [Unsaved edits] │
│ Update official catalog metadata for this product entry.                │
├────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────┐  ┌─────────────────────────────┐ │
│ │ PRODUCT NAME *                    │  │ BRAND                       │ │
│ │ [Khẩu trang kenko 5D             ]│  │ [Kenko                     ]│ │
│ └───────────────────────────────────┘  └─────────────────────────────┘ │
│ ┌───────────────────────────────────┐  ┌─────────────────────────────┐ │
│ │ CATEGORY                          │  │ BARCODE                     │ │
│ │ [Personal Care                   ]│  │ [8936012345678             ]│ │
│ └───────────────────────────────────┘  └─────────────────────────────┘ │
│                                         (Cannot be cleared once set)   │
│ ┌───────────────────────────────────┐                                  │
│ │ DEFAULT SHELF LIFE (DAYS)         │                                  │
│ │ [730                             ]│  365 days / 2 years              │
│ └───────────────────────────────────┘                                  │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ DESCRIPTION                                                        │ │
│ │ [High quality 5D protective mask with breathable bacterial filter  │ │
│ │  and soft elastic ear loops...                                    ]│ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ [Save Changes]  [Reset]               [Hide from search]  Saved. ✓     │
└────────────────────────────────────────────────────────────────────────┘
```

## Related Code Files
- Modify: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx`
- Modify: `apps/admin/tests/unit/product-actions.test.ts`

## Implementation Steps
1. In `apps/admin/src/app/(admin)/products/[id]/page.tsx`:
   - Update `ProductActions` invocation:
     ```tsx
     <ProductActions
       id={p.id}
       version={p.version}
       name={p.name}
       brand={p.brand}
       category={p.category}
       description={p.description}
       barcode={p.barcode}
       defaultShelfLifeDays={p.defaultShelfLifeDays}
       status={p.status}
       priorFeedback={p.moderationNotes}
     />
     ```
2. In `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx`:
   - Extend `ProductActionsProps` interface with `description: string | null`, `barcode: string | null`, `defaultShelfLifeDays: number | null`.
   - Initialize state `form` with all fields:
     ```ts
     const [form, setForm] = useState({
       name,
       brand: brand ?? '',
       category: category ?? '',
       description: description ?? '',
       barcode: barcode ?? '',
       defaultShelfLifeDays: defaultShelfLifeDays !== null ? String(defaultShelfLifeDays) : '',
     });
     ```
   - Add dirty state comparison (`isDirty` flag).
   - Render multi-line `textarea` for `description` with comfortable height (`rows={4}`) and clear styling matching `Input`.
   - Render `barcode` input with font-mono styling and helper text; if `barcode` was non-null originally, validate that `form.barcode.trim().length > 0` before allowing submit.
   - Render `defaultShelfLifeDays` with positive integer validation.
   - In `handleSave`:
     - Sanitize inputs (empty strings $\rightarrow$ `null` for brand/category/description, parse `defaultShelfLifeDays` to integer or `null`).
     - Call `patchProductAction(id, version, payload)`.
     - Update local baseline upon success.
     - On error, display clear banner (especially if barcode conflict occurs).
3. In `apps/admin/tests/unit/product-actions.test.ts`:
   - Add unit tests verifying form renders all fields, blocks clearing an existing barcode, triggers `patchProductAction` with complete payload, and handles validation errors.

## Success Criteria
- [ ] Admin can view and edit Name, Brand, Category, Barcode, Shelf Life, and Description in the form.
- [ ] Saving updates the database record and revalidates the admin page.
- [ ] Existing barcodes cannot be cleared to empty/null.
- [ ] Leaving optional fields empty stores `null` in the database.
- [ ] Concurrent edits trigger version conflict notice with reload button.
- [ ] UI is fully styled in Expyrico palette with responsive layout.

## Risk Assessment
- **Risk:** Admin accidentally clears required `name` field or existing barcode.
  - **Observable signal:** Submit button pressed with invalid input.
  - **Pre-decided response:** Client-side validation blocks submission and displays specific field errors.
