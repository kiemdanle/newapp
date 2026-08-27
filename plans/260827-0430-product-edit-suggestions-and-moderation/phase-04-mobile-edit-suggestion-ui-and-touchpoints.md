---
phase: 4
title: "Mobile edit suggestion UI and touchpoints"
status: completed
priority: P1
dependencies: [1, 2]
---

# Phase 4: Mobile edit suggestion UI and touchpoints

<!-- Updated: Validation Session 1 - Freeform category text input, submitter reason field, and Product Detail focused entry point -->
<!-- Updated: Red Team Review - Input sanitization for shelf life (NaN/empty string safety), robust pending read-only state handling -->

## Overview
Build a comprehensive and intuitive mobile experience for suggesting product edits in `apps/mobile`. Enhance `ProductEditForm.tsx`, `EditEditor.tsx`, and `ProductEditScreen` with inputs for all product fields (`name`, `description`, `brand`, `category`, `defaultShelfLifeDays`, `notes`, and up to 5 photos), and provide a prominent, accessible "Suggest an edit" button on the Product Detail screen.

## Requirements

### Functional
- **Complete Product Edit Form (`ProductEditForm.tsx`)**:
  - **Product Name** (required, max 200 chars).
  - **Description** (optional multiline, max 2000 chars, character counter).
  - **Brand** (optional, max 120 chars).
  - **Category** (freeform text input, max 120 chars, with live caption).
  - **Default Shelf Life (Days)** (numeric input with integer validation 1–3650 days, sanitized string-to-number conversion handling empty string as `null`, preventing `NaN`).
  - **Reason for Suggestion / Note to Moderators** (optional multiline, max 1000 chars, placeholder: "e.g. The shelf life on the packaging states 14 days, not 30 days").
  - **Live Captions**: Display small "Live: [Current Value]" indicators beneath fields where proposed value differs from the published product.
  - **Photo Management**: Integrated `ProductPhotoEditor` supporting up to 5 photos (camera capture, gallery pick, reorder, cover selection at index 0, and remove).
- **Product Detail Entry Point (`app/(app)/product/[id].tsx`)**:
  - Prominent "Suggest an edit" button styled with Fresh Sage theme tokens and clear pencil icon, displayed when the product is active.
- **Submission & Feedback Flow**:
  - Idempotent submission via `EditSubmitPanel`.
  - Display clear submission confirmation alert/dialog ("Suggestion Submitted: Thank you! Your edits have been sent to our moderators for review.").
  - Support resuming open suggestions (`draft` / `changes_required` / `pending`). When `pending`, display a clean read-only summary with pending status indicator. When `changes_required`, show the admin's moderation feedback banner prominently so the user can easily make corrections.

### Non-functional
- Adhere strictly to Expyrico palette:
  - Fresh Sage `#4BAE8A` for primary buttons, active borders, and highlights.
  - Deep Sage `#3A8F6F` for pressed states and contrast labels.
  - Warm White `#FAFAF8` and Pure White `#FFFFFF` for card backgrounds.
  - Honey `#F5A623` for pending status and attention badges.
  - Alert Red `#E0442A` strictly for destructive actions (discard/delete).
- Optimistic mutation coordination with `createDraftMutationCoordinator` to prevent concurrency race conditions.
- Smooth keyboard avoidance and scroll handling on Android and iOS.

## Architecture
```
Mobile Product Navigation Flow
┌───────────────────────────────┐
│  Product Detail Screen        │
│  (product/[id].tsx)           │
│                               │
│  [✏️ Suggest an edit]         │
└───────────────┬───────────────┘
                │
  navigation.navigate('ProductEdit', { id: productId })
                │
                ▼
┌───────────────────────────────┐
│  ProductEditScreen (edit.tsx) │
│                               │
│  • Status/Feedback Header     │
│  • ProductEditForm:           │
│    - Name (required)          │
│    - Description              │
│    - Brand & Category         │
│    - Default Shelf Life (Days)│
│    - Submitter Reason/Notes   │
│  • ProductPhotoEditor (0-5)   │
│  • EditSubmitPanel            │
└───────────────────────────────┘
```

## Related Code Files
- Modify: `apps/mobile/src/features/products/ProductEditForm.tsx`
- Modify: `apps/mobile/src/features/products/EditEditor.tsx`
- Modify: `apps/mobile/src/api/product-edits.ts`
- Modify: `apps/mobile/app/(app)/product/[id]/edit.tsx`
- Modify: `apps/mobile/app/(app)/product/[id].tsx`
- Create/Modify: `apps/mobile/__tests__/routes/product-edit.test.tsx`

## Implementation Steps
1. In `apps/mobile/src/api/product-edits.ts`:
   - Update `createProductEditCoordinatorAdapter` and metadata mutation types to include `defaultShelfLifeDays` and `notes`.
2. In `apps/mobile/src/features/products/ProductEditForm.tsx`:
   - Extend `Fields` interface to include `defaultShelfLifeDays: string` (for text input) and `notes: string`.
   - Add input for `Default Shelf Life (Days)` with numeric keyboard, bounds check (1 to 3650 days), and `LiveCaption`.
   - Add freeform text input for `Category` with `LiveCaption`.
   - Add multiline text input for `Reason for edit / Note to moderator` (max 1000 characters).
   - In `save()`:
     ```typescript
     const trimmedShelf = fields.defaultShelfLifeDays.trim();
     const parsedShelf = trimmedShelf ? parseInt(trimmedShelf, 10) : null;
     if (trimmedShelf && (isNaN(parsedShelf!) || parsedShelf! < 1 || parsedShelf! > 3650)) {
       setError('Default shelf life must be between 1 and 3650 days');
       return;
     }
     ```
   - Ensure clean Expyrico styling for all input boxes, icons, and focus borders.
3. In `apps/mobile/src/features/products/EditEditor.tsx`:
   - Update `liveProduct` prop type to include `defaultShelfLifeDays?: number | null`.
4. In `apps/mobile/app/(app)/product/[id]/edit.tsx`:
   - Handle post-submission feedback and navigation with clear user alert.
   - Display pending read-only summary when edit status is `pending`.
   - Display changes-requested banner when edit status is `changes_required`.
5. In `apps/mobile/app/(app)/product/[id].tsx`:
   - Ensure "Suggest an edit" button is prominent, with icon, under the product card.
6. Update and run mobile tests in `apps/mobile/__tests__/routes/product-edit.test.tsx`.

## Success Criteria
- [x] Users can edit all product fields (name, description, brand, category, shelf life, notes, photos) in `ProductEditForm`.
- [x] Live captions accurately display current published values when proposed values differ.
- [x] Users can launch "Suggest an edit" from the Product Detail screen.
- [x] Submitting the form successfully calls API, shows confirmation, and updates edit status.
- [x] Mobile tests and typecheck pass with zero errors.

## Risk Assessment
- *Risk*: Users entering non-numeric characters for shelf life days.
- *Mitigation*: Restrict keyboard to `numeric` / `number-pad` and sanitize input with regex and integer bounds (1–3650 days).
