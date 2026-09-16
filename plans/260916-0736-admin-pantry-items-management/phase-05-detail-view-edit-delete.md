---
phase: 5
title: "Detail View, Edit Form & Delete Modal"
status: pending
priority: P1
effort: "5h"
dependencies: ["phase-03-admin-client-and-actions", "phase-04-list-view-table-pagination"]
---

# Phase 5: Detail View, Edit Form & Delete Modal

## Overview
Implement the detailed view, editing modal, and safe deletion confirmation flows for user pantry items in the admin dashboard. The detail view at `/pantry-items/[id]` aggregates item attributes, photo galleries, expiry timelines, and relational cards for the owner, catalog product, and household. The edit form allows modifying item properties with automatic notification recalculation, while the delete modal safely purges records and background jobs.

---

## Requirements

### Functional Requirements
- **Pantry Item Detail View (`apps/admin/src/app/(admin)/pantry-items/[id]/page.tsx`)**:
  - Fetches item via `serverAdminApi.pantryItems.get(id)`. Calls Next.js `notFound()` if record does not exist.
  - **Header Section**:
    - Back button navigation to `/pantry-items` preserving prior query parameters if provided.
    - Display title: item name (`customName || product.name || 'Untitled item'`).
    - Status chip: Active (`#4BAE8A`), Consumed (`#8C8C85`), Discarded (`#E0442A`), Expired (`#F5A623`).
    - Location pill: storage location badge.
    - Quick Action Buttons: "Edit Item", "Mark as Discarded" (soft discard), and "Permanently Delete" (hard cascade delete).
  - **Main Column (Left 2/3)**:
    - *Photo Gallery Card*: Large preview and thumbnail strip for attached `photoUrls`. If empty, renders clean placeholder.
    - *Item Metadata Card*: Custom Name, Brand, Category, Barcode, Quantity & Unit, Estimated Price, Store Name, Location, Notes.
    - *Dates & Expiry Card*: Expiry Date with countdown / days remaining badge, Purchase Date, Created At, Last Updated At, Consumed At, Discarded At, Discard Reason.
    - *Notifications Timeline Card*: List of scheduled push notification dates (`notifyAt`) and associated push logs.
  - **Contextual Column (Right 1/3)**:
    - *Owner Card*: User initials badge, Name, Email, Country, Account Status, and deep link button to `/users/[userId]`.
    - *Catalog Product Card*: Rendered when linked to a catalog product (`productId != null`). Displays Product Name, Brand, Barcode, Catalog Status, and deep link button to `/products/[productId]`.
    - *Household Sharing Card*: Rendered when item belongs to a household. Displays Household Name, Member count, and link to `/households/[householdId]`.
    - *Giveaways Card*: Indicates whether this item was ever listed in giveaways, linking to `/giveaways` if applicable.
- **Edit Pantry Item Modal / Form (`apps/admin/src/app/(admin)/pantry-items/[id]/edit-pantry-item-modal.tsx`)**:
  - Accessible from both list row actions and the detail view.
  - Form fields:
    - `customName`: text input.
    - `brand`: text input with auto-fill suggestion.
    - `category`: text input / select.
    - `location`: text input with preset pills ("Fridge", "Freezer", "Pantry", "Cabinet").
    - `quantity`: numeric input (step 0.001, min >= 0, max 100000).
    - `unit`: text input / unit selector.
    - `expiryDate`: date picker (YYYY-MM-DD).
    - `purchaseDate`: date picker (YYYY-MM-DD, optional).
    - `price`: numeric input (step 0.01, min 0, optional).
    - `store`: text input.
    - `notes`: multi-line textarea.
    - `status`: select dropdown (`active`, `consumed`, `discarded`, `expired`).
    - `discardReason`: visible conditionally when `status === 'discarded'`.
  - Execution:
    - Dispatched through Server Action `patchPantryItemAction(id, data)` wrapped in `useTransition()`.
    - Loading indicator on submit button.
    - Displays validation error banner if server returns `{ ok: false, code: '...' }`.
    - Closes modal and reflects updated data upon success.
- **Discard Pantry Item Modal (`apps/admin/src/app/(admin)/pantry-items/discard-pantry-item-modal.tsx`)**:
  - Modal prompting the administrator for an optional discard reason.
  - Dispatched via Server Action `discardPantryItemAction(id, reason)`.
  - Updates item status to `discarded` and sets `discardedAt`, cancelling notifications while preserving the record for user mobile undo/archive.
- **Delete Confirmation Modal (`apps/admin/src/app/(admin)/pantry-items/delete-pantry-item-modal.tsx`)**:
  - Destructive confirmation dialog styled with Expyrico Alert Red (`#E0442A`).
  - Warning explanation: "This will permanently delete this pantry item for user `<email>`. All pending push notifications will be cancelled, linked giveaways detached, and this action cannot be undone."
  - "Cancel" button and "Permanently Delete" confirmation button.
  - Dispatched through Server Action `deletePantryItemAction(id)`.
  - On successful deletion, redirects back to `/pantry-items` with a confirmation toast.

### Non-functional Requirements
- Accessibility: Dialogs comply with Radix / Headless UI modal keyboard trap and `Escape` key dismissal.
- Expyrico Design System: Consistent typography, rounded corners (`rounded-2xl`), border colors (`border-border`), and micro-interactions.

---

## Architecture

```
  /pantry-items/[id]/page.tsx (Server Component)
            │
            ├───────────────────────────────────────────────────────┐
            ▼                                                       ▼
  ┌─────────────────────────────────┐                     ┌───────────────────┐
  │ Detail View Layout              │                     │ EditPantryItemModal│
  │ - Left: Gallery, Meta, Expiry   │                     │ (Client Component)│
  │ - Right: Owner, Product, House  │                     │ - Form inputs     │
  └────────────────┬────────────────┘                     │ - useTransition   │
                   │                                      │ - patchAction     │
                   ▼                                      └───────────────────┘
  ┌─────────────────────────────────┐                               │
  │ DeletePantryItemModal           │                               │ Server Action
  │ (Destructive Alert Dialog)      │                               ▼
  │ - deleteAction                  │                     apiServerFetch(PATCH)
  └────────────────┬────────────────┘                               │
                   │ Server Action                                  ▼
                   ▼                                      Fastify /v1/admin/
          apiServerFetch(DELETE)                          pantry-items/:id
                   │                                                │
                   ▼                                                ▼
          Redirect to /pantry-items                       revalidatePath
```

---

## Related Code Files
- Create: `apps/admin/src/app/(admin)/pantry-items/[id]/page.tsx`
- Create: `apps/admin/src/app/(admin)/pantry-items/[id]/edit-pantry-item-modal.tsx`
- Create: `apps/admin/src/app/(admin)/pantry-items/delete-pantry-item-modal.tsx`
- Create: `apps/admin/src/app/(admin)/pantry-items/[id]/pantry-item-gallery.tsx`

---

## Implementation Steps
1. Create `apps/admin/src/app/(admin)/pantry-items/[id]/pantry-item-gallery.tsx`:
   - Handles photo display with main view, thumbnail selector, and full-screen image expansion.
2. Create `apps/admin/src/app/(admin)/pantry-items/[id]/edit-pantry-item-modal.tsx`:
   - Controlled form state initialized from `AdminPantryItemDetail`.
   - Handles form submission via `patchPantryItemAction`.
   - Conditional display of `discardReason` when status is set to `discarded`.
3. Create `apps/admin/src/app/(admin)/pantry-items/delete-pantry-item-modal.tsx`:
   - Controlled open/close state.
   - Handles deletion via `deletePantryItemAction` and redirects via `useRouter().push('/pantry-items')`.
4. Create `apps/admin/src/app/(admin)/pantry-items/[id]/page.tsx`:
   - Await `params` for `id`.
   - Call `serverAdminApi.pantryItems.get(id)`.
   - Render multi-card layout with Owner card, Product card, Household card, and gallery.
   - Mount Edit and Delete modals.
5. Add component tests in `apps/admin/src/app/(admin)/pantry-items/__tests__/detail-actions.test.tsx`:
   - Verify edit form submits expected patch payload.
   - Verify delete modal triggers delete action on confirm.

---

## Success Criteria
- [x] Navigating to `/pantry-items/[id]` displays all metadata for the item and its relational links.
- [x] Clicking on the Owner card navigates to `/users/[userId]`.
- [x] Clicking on the Product card navigates to `/products/[productId]`.
- [x] Editing an item via the modal successfully updates the record and re-renders fresh data.
- [x] Changing status to `discarded` prompts for and saves a discard reason.
- [x] Deleting an item removes the record, cancels notifications, and redirects back to `/pantry-items`.

---

## Risk Assessment
- **Risk:** User modifies `expiryDate` in the past while status is `active`.
  - *Mitigation:* Allow the edit since historical/actual expiry dates may need recording, but calculate remaining days as negative (expired status badge) and omit future notification scheduling.
  - *Breakage Signal:* Notification service attempting to schedule push notifications with negative timestamps.
  - *Response:* `computeNotifyAt` guards against dates in the past and yields an empty notification array.

<!-- Updated: Validation Session 1 - Dual discard/delete action modals and buttons in detail view -->

<!-- Updated: Red Team Review - Updated edit form with canonical status transitions and field bounds -->
