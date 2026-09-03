---
phase: 3
title: "Admin Global Approval Settings UI"
status: pending
priority: P1
effort: "4h"
dependencies: [1, 2]
---

# Phase 3: Admin Global Approval Settings UI

## Overview
Update the Admin settings interface (`apps/admin/src/app/(admin)/settings/feature-flags/`) to expose a global control for Product Approval Policy under Community Product Creation Mode. Admins will be able to toggle whether newly created products require manual moderation or are immediately approved and published.

## Requirements
- Functional:
  - Add "New Product Approval Policy" toggle/radio section in `FlagsForm`.
  - Provide two distinct options:
    1. **Auto-Approve Community Products (Disabled Approval - Default)**:
       "Products submitted by community members become active immediately in the catalog without waiting in moderation."
    2. **Require Administrative Approval (Enabled Approval)**:
       "All newly submitted community products are held in the moderation queue until approved by an administrator."
  - Persist setting changes via `saveProductCreationAction` server action.
  - Display success message or error toast on save.
- Non-functional:
  - Accessible form controls with proper labeling and description.
  - Follow Expyrico color palette and design tokens.

## Architecture
- **Admin Server Actions**:
  Update `apps/admin/src/lib/actions.ts`:
  ```typescript
  export async function saveProductCreationAction(input: {
    mode: 'off' | 'internal' | 'all';
    requireApproval: boolean;
  }) {
    return serverAdminApi.settings.productCreation.put(input);
  }
  ```
- **Form Component**:
  Update `apps/admin/src/app/(admin)/settings/feature-flags/flags-form.tsx` to include `requireApproval` state initialized from server props.

## Related Code Files
- Modify: `apps/admin/src/app/(admin)/settings/feature-flags/page.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/feature-flags/flags-form.tsx`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/lib/admin-api.ts`
- Create: `apps/admin/tests/unit/flags-form.test.ts`

## Implementation Steps
1. Update `apps/admin/src/lib/admin-api.ts`:
   - Extend `productCreation.put` parameter type to `{ mode: 'off' | 'internal' | 'all'; requireApproval?: boolean }`.
2. Update `apps/admin/src/lib/actions.ts`:
   - Update `saveProductCreationAction` to accept and pass `requireApproval`.
3. Update `apps/admin/src/app/(admin)/settings/feature-flags/flags-form.tsx`:
   - Add state: `const [requireApproval, setRequireApproval] = useState<boolean>(initialProductCreation?.requireApproval ?? false);`.
   - Add a dedicated section under Product Creation:
     ```tsx
     <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
       <div>
         <h3 className="text-sm font-semibold text-neutral-dark font-display">
           New Product Approval Policy
         </h3>
         <p className="text-xs text-neutral-mid mt-0.5">
           Control whether newly created community products require administrative review before becoming active in the catalog.
         </p>
       </div>
       <div className="space-y-2 pt-1">
         <label className="flex items-start gap-3 text-sm cursor-pointer">
           <input
             type="radio"
             name="require_approval"
             checked={!requireApproval}
             onChange={() => setRequireApproval(false)}
             className="h-4 w-4 mt-0.5 text-primary"
           />
           <div>
             <span className="font-medium text-neutral-dark">Auto-Approve (Approval Disabled - Default)</span>
             <p className="text-xs text-neutral-mid">Newly created products are active and immediately visible to the community.</p>
           </div>
         </label>
         <label className="flex items-start gap-3 text-sm cursor-pointer">
           <input
             type="radio"
             name="require_approval"
             checked={requireApproval}
             onChange={() => setRequireApproval(true)}
             className="h-4 w-4 mt-0.5 text-primary"
           />
           <div>
             <span className="font-medium text-neutral-dark">Require Approval (Approval Enabled)</span>
             <p className="text-xs text-neutral-mid">All new products are held in the moderation queue until an admin reviews them.</p>
           </div>
         </label>
       </div>
     </div>
     ```
   - Pass `requireApproval` into `saveProductCreationAction({ mode, requireApproval })` inside `save()`.
4. Run `pnpm --filter admin lint` and `pnpm --filter admin typecheck`.

## Success Criteria
- [x] Admin can navigate to `/settings/feature-flags` and see the Product Approval Policy toggle.
- [x] Saving the form sends `{ mode, requireApproval }` to the API and shows a success confirmation.
- [x] Refreshing the page preserves the chosen setting.

## Risk Assessment
- Risk: Setting desynchronization if API fails to save while client state updates.
  - Signal: Error toast displayed, state resets on page refresh.
  - Mitigation: Use server action transitions (`useTransition`) and display server error messages.
