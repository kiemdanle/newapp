---
phase: 3
title: Admin Console UI and Workflows
status: completed
priority: P1
dependencies:
  - '1'
  - '2'
---

# Phase 3: Admin Console UI and Workflows

## Overview
Integrate 2FA reset actions into the Admin Dashboard across the User Detail page (`/users/[id]`) and Admin Team Settings (`/settings/admins`), featuring clear confirmation modals, typed Server Actions with `ActionResult<T>`, loading transitions, feedback banners, and seamless handoff to the re-enrollment login flow.

## Requirements

### Functional
- **Admin API Client & Server Actions**:
  - In `apps/admin/src/lib/admin-api.ts`, add `serverAdminApi.users.reset2fa(id: string, body?: AdminUserReset2faRequest)`.
  - In `apps/admin/src/lib/actions.ts`, implement `resetUser2faAction(id: string, body?: AdminUserReset2faRequest): Promise<ActionResult<AdminUserReset2faResponse>>` using `runAction` to guarantee typed error codes (e.g. `cannot_reset_unenrolled_2fa`) survive across the Server Action boundary.
  - Revalidate `/users`, `/users/${id}`, and `/settings/admins` on success.
- **User Detail Page Touchpoint (`/users/[id]`)**:
  - Update `UserActions` in `apps/admin/src/app/(admin)/users/[id]/user-actions.tsx`:
    - Add a "Reset 2FA" button (visible when 2FA is active or user is an admin).
    - Provide a security confirmation modal/dialog explaining the consequences:
      - All active sessions and 60-day trusted devices will be revoked immediately.
      - Existing recovery codes and authenticator secrets will be deleted.
      - The user will be required to scan a new QR code on their next sign-in.
      - **Self-Reset Special Warning**: If the logged-in admin is resetting their own 2FA, prominently warn: *"You are resetting your own 2FA. This will log you out immediately and require you to scan a new QR code upon signing in."*
- **Admin Team Settings Touchpoint (`/settings/admins`)**:
  - Create `ResetAdmin2faButton` in `apps/admin/src/app/(admin)/settings/admins/reset-admin-2fa-button.tsx`.
  - In `apps/admin/src/app/(admin)/settings/admins/page.tsx`, render the Reset 2FA action alongside Revoke for admins with "2FA Active".
- **Visual Design Compliance**:
  - Adhere strictly to the Expyrico color palette (`Fresh Sage #4BAE8A`, `Deep Sage #3A8F6F`, `Warm White #FAFAF8`, `Stone #F0F0ED`, `Alert Red #E0442A` for destructive confirm).

## Architecture

```
Admin Dashboard User Detail (/users/[id])     Admin Settings (/settings/admins)
                   │                                          │
                   └─────────────────┬────────────────────────┘
                                     │
                             User clicks "Reset 2FA"
                                     │
                                     ▼
                    Confirmation Dialog / Warning Modal
                    (Self-reset: displays immediate logout warning)
                                     │
                                     ▼
                       Server Action: resetUser2faAction(id)
                               (via runAction -> ActionResult<T>)
                                     │
                                     ▼
                    apiServerFetch -> POST /v1/admin/users/:id/reset-2fa
                                     │
                                     ▼
                     revalidatePath('/users/[id]'), ('/settings/admins')
                                     │
                                     ▼
                     Toast Banner: "2FA Reset Successfully"
```

## Related Code Files
- Create: `apps/admin/src/app/(admin)/settings/admins/reset-admin-2fa-button.tsx`
- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `apps/admin/src/app/(admin)/users/[id]/user-actions.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/admins/page.tsx`

## Implementation Steps
1. In `apps/admin/src/lib/admin-api.ts`:
   - Add `reset2fa: (id: string, body?: AdminUserReset2faRequest) => apiServerFetch<AdminUserReset2faResponse>(`/admin/users/${id}/reset-2fa`, { method: 'POST', body })` to the `users` API client definition.
2. In `apps/admin/src/lib/actions.ts`:
   - Export `resetUser2faAction(id: string, body?: AdminUserReset2faRequest): Promise<ActionResult<AdminUserReset2faResponse>>`:
     - Wrap in `runAction(() => serverAdminApi.users.reset2fa(id, body))`.
     - On `result.ok`, call `revalidatePath('/users')`, `revalidatePath('/users/' + id)`, and `revalidatePath('/settings/admins')`.
     - Return `result`.
3. In `apps/admin/src/app/(admin)/users/[id]/user-actions.tsx`:
   - Pass 2FA status (`totpEnabledAt: string | null`) into `UserActions`.
   - If `totpEnabledAt` is non-null, display "Reset 2FA" button with a `KeyRound` / `ShieldAlert` icon.
   - On click, prompt with detailed warning (with specific self-reset notice if resetting self) and trigger `resetUser2faAction(id)`.
4. In `apps/admin/src/app/(admin)/settings/admins/reset-admin-2fa-button.tsx`:
   - Implement client component with loading state (`useTransition`), warning modal, and error display using `actionErrorMessage(result)`.
5. In `apps/admin/src/app/(admin)/settings/admins/page.tsx`:
   - Render `ResetAdmin2faButton` in the Action column for admins who have `totpEnabledAt !== null`.

## Success Criteria
- [ ] Reset 2FA button is visible and accessible on both the User Detail page and the Admin Team settings list.
- [ ] Clicking Reset 2FA triggers the confirmation flow and successfully calls the backend API with typed `ActionResult` handling.
- [ ] Success and error messages are clearly presented to the administrator.
- [ ] Table and detail pages immediately reflect the updated 2FA status ("Enrollment pending") after reset.

## Risk Assessment
- **Risk**: Accidental click resetting 2FA without understanding that all sessions and trusted devices are revoked.
- **Mitigation**: Require explicit confirmation in the modal dialog before executing the action.
