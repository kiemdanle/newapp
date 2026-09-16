---
phase: 3
title: "Admin Client & Server Actions"
status: pending
priority: P1
effort: "3h"
dependencies: ["phase-01-contracts-and-schemas", "phase-02-backend-api"]
---

# Phase 3: Admin Client & Server Actions

## Overview
Connect the Next.js admin dashboard application to the new Fastify backend endpoints by extending `serverAdminApi` in `apps/admin/src/lib/admin-api.ts`, creating type-safe Server Actions in `apps/admin/src/lib/actions.ts` for form mutations, and adding a first-class navigation entry in the admin sidebar.

---

## Requirements

### Functional Requirements
- **`serverAdminApi.pantryItems`** typed client:
  - `list(q: Q)`: Fetches `/v1/admin/pantry-items?{queryString}` and parses through `adminPantryItemsListSchema`.
  - `get(id: string)`: Fetches `/v1/admin/pantry-items/${id}` and parses through `adminPantryItemDetailSchema`.
  - `patch(id: string, body: object)`: Sends `PATCH /v1/admin/pantry-items/${id}` and parses returned updated detail.
  - `delete(id: string)`: Sends `DELETE /v1/admin/pantry-items/${id}` expecting 204 No Content.
  - `filterOptions()`: Fetches `/v1/admin/pantry-items/filter-options` and parses through `adminPantryFilterOptionsSchema`.
- **Server Actions (`apps/admin/src/lib/actions.ts`)**:
  - `patchPantryItemAction(id: string, body: AdminPantryItemPatch)`:
    - Wrapped in `runAction()` for safe serialization across server-client boundaries.
    - Calls `serverAdminApi.pantryItems.patch(id, body)`.
    - Triggers Next.js cache revalidation: `revalidatePath('/pantry-items')` and `revalidatePath('/pantry-items/' + id)`.
    - Returns `ActionResult<AdminPantryItemDetail>`.
  - `discardPantryItemAction(id: string, discardReason?: string)`:
    - Wrapped in `runAction()`.
    - Calls `serverAdminApi.pantryItems.patch(id, { status: 'discarded', discardReason })`.
    - Triggers cache revalidation: `revalidatePath('/pantry-items')` and `revalidatePath('/pantry-items/' + id)`.
    - Returns `ActionResult<AdminPantryItemDetail>`.
  - `deletePantryItemAction(id: string)`:
    - Wrapped in `runAction()`.
    - Calls `serverAdminApi.pantryItems.delete(id)`.
    - Triggers cache revalidation: `revalidatePath('/pantry-items')`.
    - Returns `ActionResult<void>`.
  - **Navigation & Sidebar Integration**:
    - Add a dedicated `Pantry` section in `NAV` (`apps/admin/src/lib/nav.ts`) containing `{ label: 'Pantry Items', href: '/pantry-items', icon: 'Archive' }`.
    - Ensure `Archive` is registered in `ICON_MAP` within `apps/admin/src/components/sidebar.tsx`.

### Non-functional Requirements
- Maintain strict server-only execution for `serverAdminApi` and server actions (`'use server'`).
- Preserve optimistic concurrency error handling and serializable error codes via `ActionResult`.

---

## Architecture

```
  Next.js Server Components                   Next.js Client Components
  (/pantry-items/page.tsx,                   (EditModal, DeleteModal)
   /pantry-items/[id]/page.tsx)                          │
               │                                         │
               │ Direct read                             │ Form submission / onClick
               ▼                                         ▼
  ┌─────────────────────────┐               ┌─────────────────────────┐
  │     serverAdminApi      │               │     Server Actions      │
  │     .pantryItems        │               │  - patchPantryItemAction│
  │     - list()            │               │  - deletePantryItemAction│
  │     - get()             │               └────────────┬────────────┘
  │     - filterOptions()   │                            │
  └────────────┬────────────┘                            │
               │                                         │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │        apiServerFetch         │
                    │ (Cookie Bearer auth + fetch)  │
                    └───────────────┬───────────────┘
                                    │ HTTP
                                    ▼
                    Fastify API (/v1/admin/pantry-items)
```

---

## Related Code Files
- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/lib/nav.ts`
- Modify: `apps/admin/src/components/sidebar.tsx`

---

## Implementation Steps
1. Update `apps/admin/src/lib/admin-api.ts`:
   - Import `adminPantryItemsListSchema`, `adminPantryItemDetailSchema`, `adminPantryFilterOptionsSchema`, `AdminPantryItemPatch`, etc., from `@expyrico/shared`.
   - Add `pantryItems` object to `serverAdminApi` with `list`, `get`, `patch`, `delete`, and `filterOptions` methods.
2. Update `apps/admin/src/lib/actions.ts`:
   - Implement `patchPantryItemAction(id: string, body: Record<string, unknown>)`.
   - Implement `deletePantryItemAction(id: string)`.
   - Ensure both methods call `revalidatePath('/pantry-items')` and return structured `ActionResult`.
3. Update `apps/admin/src/lib/nav.ts`:
   - Add `{ label: 'Pantry Items', href: '/pantry-items', icon: 'Archive' }` into `NAV` under the `Catalog` section or a dedicated `Pantry` section.
4. Update `apps/admin/src/components/sidebar.tsx`:
   - Import `Archive` from `lucide-react` and add it to `ICON_MAP`.

---

## Success Criteria
- [x] `serverAdminApi.pantryItems` methods successfully invoke backend endpoints and type-check against shared schemas.
- [x] Server actions gracefully handle API errors, returning `{ ok: false, code: '...' }` without unhandled server crashes.
- [x] Successful actions invalidate Next.js route caches using `revalidatePath`.
- [x] Admin sidebar renders the "Pantry Items" link with the correct icon and highlights active state on `/pantry-items*`.

---

## Risk Assessment
- **Risk:** Fastify API returning Decimal objects for quantity/price causing client-side deserialization or JSON serialization failures in Server Actions.
  - *Mitigation:* API routes in Phase 2 convert all Prisma Decimals to JavaScript `number` via `Number(r.quantity)` before returning JSON.
  - *Breakage Signal:* React serialization warning or Zod parse error on `quantity`.
  - *Response:* Enforce numeric transformation in the Fastify serializer.

<!-- Updated: Validation Session 1 - Added discardPantryItemAction for dual deletion and dedicated Pantry navigation group -->
