---
phase: 3
title: "Admin Dashboard Settings UI & User Inspection Hooks"
status: completed
priority: P2
effort: "4h"
dependencies: [2]
---

# Phase 3: Admin Dashboard Settings UI & User Inspection Hooks

## Overview
Create the dedicated Admin Dashboard interface at `/settings/pantry-limits` for administrators to view and configure maximum user pantry limits. Provide steppers, numeric inputs, one-click presets, live feedback, soft-ceiling explanations, error/retry states that prevent overwriting production limits on transient API failures, and an informational Future Tier Blueprint card.

<!-- Updated: Advisory Review Session 1 - Findings F11, F16 -->

---

## Requirements

### Functional
1. **Sidebar Navigation**:
   - Add `Pantry limits` under the `Settings` section in `apps/admin/src/lib/nav.ts` with icon `Layers`.
   - Update `apps/admin/src/components/sidebar.tsx` to render the Lucide icon.
2. **Admin API & Server Actions**:
   - Add `serverAdminApi.settings.pantryLimits` to `apps/admin/src/lib/admin-api.ts` supporting `get` and `patch`.
   - Update `savePantryLimitsAction(body: PantryLimitsPatch)` in `apps/admin/src/lib/actions.ts` using the narrow partial patch schema with path revalidation (`revalidatePath('/settings/pantry-limits')`) (Red Team Finding 9).
3. **Settings Page & Error Boundary State (`apps/admin/src/app/(admin)/settings/pantry-limits/`)**:
   - `page.tsx`: Async server component fetching authoritative settings.
   - **No Defaulting on Read Failures**: If the API read fails, do NOT fall back to default values (e.g. 50). Render an error/retry banner and disable the form to prevent inadvertently saving a default value over a live 500-item production setting (Red Team Finding 10).
   - `pantry-limits-form.tsx`: Interactive form with:
     - Numeric input and +/- stepper buttons for `defaultUserPantryLimit` (range 1–10,000).
     - Preset buttons: Standard (50), Extended (100), Power (250), Generous (500).
     - Storage & Soft Ceiling notice: Explains that reducing limits blocks new additions on full accounts without deleting or hiding existing items.
     - **Deliberate Decrease Confirmation Modal**: If the admin submits a limit lower than the currently loaded setting (e.g. from 100 to 50), intercept submission with a confirmation modal: *"Are you sure you want to reduce the default pantry limit from {current} to {new}? Existing users with more than {new} items will not lose data, but cannot add new items until space is freed."* (Advisory Finding F16).
     - Future Tier Blueprint section: Read-only visual card explaining upcoming Free Tier (50) vs Pro Tier (500) allocations.
     - Saving, success, and error feedback alerts.
### Non-Functional
- **Design Compliance**: Adheres to Expyrico Design System (`Warm White` `#FAFAF8`, `Mint Mist` `#D6F0E6`, `Fresh Sage` `#4BAE8A`, `Almost Black` `#2C2C28`, `Pebble` `#8C8C85`).
- **Data Safety**: Prevents accidental quota decreases below current active levels without deliberate admin confirmation.

---

## Architecture

```
apps/admin/src/
├── lib/
│   ├── nav.ts                       <-- Add 'Pantry limits' navigation item
│   ├── admin-api.ts                 <-- serverAdminApi.settings.pantryLimits (get, patch)
│   └── actions.ts                   <-- savePantryLimitsAction (PantryLimitsPatch)
├── components/
│   └── sidebar.tsx                  <-- Render navigation icon (Layers)
├── app/(admin)/settings/
│   └── pantry-limits/
│       ├── page.tsx                 <-- Server Component (authoritative fetch or error state)
│       └── pantry-limits-form.tsx   <-- Client Form Component with steppers & presets
└── tests/unit/
    └── pantry-limits-actions.test.ts<-- Test action, validation, error states & revalidation
```

---

## Related Code Files

- Create: `apps/admin/src/app/(admin)/settings/pantry-limits/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/pantry-limits/pantry-limits-form.tsx`
- Create: `apps/admin/tests/unit/pantry-limits-actions.test.ts`
- Modify: `apps/admin/src/lib/nav.ts`
- Modify: `apps/admin/src/components/sidebar.tsx`
- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`

---

## Implementation Steps

1. **Update Nav and Sidebar**:
   - In `apps/admin/src/lib/nav.ts`, add `{ label: 'Pantry limits', href: '/settings/pantry-limits', icon: 'Layers' }`.
   - In `apps/admin/src/components/sidebar.tsx`, import `Layers` from `lucide-react` and map in `iconMap`.
2. **Add API and Server Actions**:
   - In `apps/admin/src/lib/admin-api.ts`:
     ```typescript
     pantryLimits: {
       get: () => apiServerFetch('/v1/admin/settings/pantry-limits').then((r) => pantryLimitsSettingsSchema.parse(r)),
       patch: (body: PantryLimitsPatch) => apiServerFetch('/v1/admin/settings/pantry-limits', { method: 'PATCH', body }).then((r) => pantryLimitsSettingsSchema.parse(r)),
     }
     ```
   - In `apps/admin/src/lib/actions.ts`:
     ```typescript
     export async function savePantryLimitsAction(body: PantryLimitsPatch) {
       const result = await serverAdminApi.settings.pantryLimits.patch(body);
       revalidatePath('/settings/pantry-limits');
       return result;
     }
     ```
3. **Build `page.tsx`**:
   - Fetch settings via `serverAdminApi.settings.pantryLimits.get()`.
   - If fetch rejects with an error: render an alert component with a "Retry" button. Do NOT render an editable form with fallback default 50.
4. **Build `pantry-limits-form.tsx`**:
   - Form state bound to `defaultUserPantryLimit`.
   - Presets buttons (50, 100, 250, 500).
   - Soft-ceiling explanatory banner.
   - Modal confirmation on limit decreases before executing `savePantryLimitsAction`.
   - Future Tier Blueprint card.
   - Verify action calls API PATCH with partial payload.
   - Verify error boundary behavior when API is unreachable.

---

## Success Criteria

- [x] `/settings/pantry-limits` is accessible via Admin sidebar.
- [x] Admins can adjust the limit and save successfully.
- [x] Read failures display an error/retry state and do not render default values that could overwrite production limits.
- [x] Partial patch saves only the changed limit without wiping `tierLimits`.
- [x] Reducing the limit below the active setting prompts a confirmation dialog before saving.
- [x] Unit tests pass in `apps/admin`.
