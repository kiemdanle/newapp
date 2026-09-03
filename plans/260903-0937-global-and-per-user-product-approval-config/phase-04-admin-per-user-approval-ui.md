---
phase: 4
title: "Admin Per-User Approval Configuration UI"
status: pending
priority: P1
effort: "4h"
dependencies: [1, 2]
---
<!-- Updated: Validation Session 1 - Standard admin RBAC and future-only anti-spam scope -->
<!-- Updated: Red Team Review - Finding 5 (User List Schema & Table Alignment) -->

# Phase 4: Admin Per-User Approval Configuration UI

## Overview
Implement the per-user product approval configuration on the Admin User Details page (`apps/admin/src/app/(admin)/users/[id]/`). Admins can inspect a user's current approval status and toggle whether that user is flagged for mandatory product moderation. Also add visual indicators on the User Directory table (`/users`).

## Requirements
- Functional:
  - On `/users/[id]`:
    - Display current approval requirement badge in the user summary header:
      - Default: `Approval: Auto (Default)` in soft green/neutral styling (`bg-primary-light/40 text-primary-dark`).
      - Flagged: `Approval: Mandatory Review` in soft amber styling (`bg-amber-50 text-amber-800 border-amber-200`).
    - Add action button in `UserActions`:
      - When `requireProductApproval === false`:
        - Button: `Require Product Approval` (with shield/alert icon).
        - Confirmation prompt: "Require product approval for this user? All future product submissions by this user will be sent to the moderation queue, even if global auto-approval is enabled."
      - When `requireProductApproval === true`:
        - Button: `Remove Approval Requirement` / `Allow Auto-Approval`.
        - Confirmation prompt: "Allow auto-approval for this user? Their submissions will follow the global approval policy."
      - Drives `patchUserAction(id, { requireProductApproval: boolean })`.
      - Authorization: Available to all authenticated admin users (`requireAdmin`).
  - Anti-spam scope: Confirmed future submissions only; past active products remain published unless individually reported or edited.
  - On `/users`:
    - Display an anti-spam badge or icon in the user table if `requireProductApproval === true`.
    - Ensure `api/src/routes/admin/users/list.ts` selects `requireProductApproval` so the column renders without additional queries.
- Non-functional:
  - Accessible dialogs and confirmation states.
  - Seamless optimistic transition using React `useTransition`.

## Architecture
- **Server Action**:
  `patchUserAction(id, { requireProductApproval })` leverages existing `api/src/routes/admin/users/patch.ts`.
- **Component Hierarchy**:
  ```
  UserDetailPage
    ├── Hero Header (Status badges + requireProductApproval badge)
    ├── UserActions
    │     └── Toggle Button ("Require Product Approval" / "Allow Auto-Approval")
    └── User Session Table
  ```

## Related Code Files
- Modify: `apps/admin/src/app/(admin)/users/[id]/page.tsx`
- Modify: `apps/admin/src/app/(admin)/users/[id]/user-actions.tsx`
- Modify: `apps/admin/src/app/(admin)/users/page.tsx`
- Create: `apps/admin/tests/unit/user-actions-approval.test.ts`

## Implementation Steps
1. Update `apps/admin/src/app/(admin)/users/[id]/page.tsx`:
   - Inspect `u.requireProductApproval`.
   - Render badge next to Role and Status:
     ```tsx
     {u.requireProductApproval ? (
       <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
         <ShieldAlert size={11} className="text-amber-600" />
         <span>Approval Required (Anti-Spam)</span>
       </span>
     ) : (
       <span className="inline-flex items-center gap-1 rounded-full bg-primary-light/40 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary-dark">
         <span>Approval: Auto</span>
       </span>
     )}
     ```
   - Pass `requireProductApproval={u.requireProductApproval ?? false}` into `UserActions`.
2. Update `apps/admin/src/app/(admin)/users/[id]/user-actions.tsx`:
   - Accept prop `requireProductApproval: boolean`.
   - Add button inside action button group:
     ```tsx
     {requireProductApproval ? (
       <Button
         variant="outline"
         size="sm"
         disabled={pending}
         onClick={() =>
           run(
             () => patchUserAction(id, { requireProductApproval: false }),
             'Allow auto-approval for this user?\n\nTheir product submissions will follow the global approval policy.',
           )
         }
         className="border-primary/40 text-primary-dark hover:bg-primary-light/30"
       >
         <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-primary" />
         <span>Allow auto-approval</span>
       </Button>
     ) : (
       <Button
         variant="outline"
         size="sm"
         disabled={pending}
         onClick={() =>
           run(
             () => patchUserAction(id, { requireProductApproval: true }),
             'Require product approval for this user?\n\nThis will force all new product submissions by this user into the moderation queue, even when global auto-approval is active.',
           )
         }
         className="border-amber-300 text-amber-900 hover:bg-amber-50"
       >
         <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
         <span>Require approval</span>
       </Button>
     )}
     ```
3. Update `apps/admin/src/app/(admin)/users/page.tsx`:
   - If user has `requireProductApproval: true`, render an alert icon or badge in the user table row.
4. Run `pnpm --filter admin lint` and `pnpm --filter admin typecheck`.

## Success Criteria
- [ ] User details page displays whether the user is subject to mandatory approval.
- [ ] Admin can click "Require approval" to flag a spamming user, and the badge immediately reflects "Approval Required".
- [ ] Admin can click "Allow auto-approval" to remove the flag.
- [ ] User table highlights users with active spam/approval restrictions.

## Risk Assessment
- Risk: Unintended approval toggle due to accidental click.
  - Signal: User receives unexpected moderation requirement.
  - Mitigation: Window confirmation modal with clear explanation before submitting the action.
