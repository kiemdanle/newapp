---
phase: 3
title: "Mobile"
status: done
priority: P1
dependencies: [1]
---

# Phase 3: Mobile

## Overview

Rework the mobile forgot/reset-password screens into a three-screen OTP flow: email → 6-digit code → new password. Delete the now-dead reset deep-link handling entirely, and close the UX dead-ends the red team flagged.

## Requirements

- Functional: forgot-password submits email → navigates to code entry → on valid code navigates to new-password → on success returns to sign-in.
- Non-functional: reuse the OTP entry pattern from `(auth)/verify-email.tsx` (auto-submit at 6 digits, `oneTimeCode`/`sms-otp` autofill), and always give the user a forward path when a code is dead or a ticket is missing.

## Architecture

Flow and param passing:

- `forgot-password.tsx` → `router.push('/(auth)/verify-reset-code?email=...')`.
- `verify-reset-code.tsx` (new) calls `authEndpoints.verifyResetCode(email, code)`, receives `{ resetTicket }`, then `router.push('/(auth)/reset-password?ticket=...')`.
- `reset-password.tsx` reads `ticket` from params (not `token`), submits `authEndpoints.resetPassword(ticket, password)`.

### RT-4 (Critical): the reset deep-link is the ENTIRE `parseAuthDeepLink`, not a branch

`apps/mobile/src/lib/linking.ts:10` — `parseAuthDeepLink` handles *only* `reset-password`; there is no other branch. Its `linking.test.ts` asserts only reset parsing. So the cleanup is a **deletion**, not an edit:

- Delete `apps/mobile/src/lib/linking.ts` and its `AuthDeepLink` type.
- Remove its import + usage in `apps/mobile/app/_layout.tsx:25` and the reset-handling block (`_layout.tsx:109-114`).
- Delete `apps/mobile/src/lib/linking.test.ts` (handled in Phase 4).
- **Referral capture stays untouched** — it is a *separate* `Linking.parse` block in `_layout.tsx:118-124`, not part of `parseAuthDeepLink`. Do not remove it.

### RT-12 (Medium): close the mobile UX dead-ends

Bundle of UX fixes so the generic-error security model doesn't produce stuck screens:

- **Resend races the in-flight code**: resend on the code screen calls `forgotPassword`, which deletes the prior code (Phase 2 RT-9). A user who taps resend then types the *first* email's code gets a generic failure with no explanation. Message that resending replaces the previous code, and/or gate resend behind a short cooldown.
- **Lost ticket = dead-end**: `reset-password.tsx:58-59,74` currently shows recovery text + disables submit when the credential is missing. Keep a recovery CTA ("Your reset session expired — start over") that routes back to `forgot-password` when `ticket` is absent. Cleanup removes only the deep-link path, not this guidance.
- **No terminal state after 5 fails**: the code screen auto-submits every 6-digit entry (`verify-email.tsx:68-72` pattern) and, once the code is dead, keeps returning the same generic error even for the correct code. After a failed verify, surface a prominent "request a new code" affordance (reuse the resend button). Server error stays generic — this is UI-only.
- **Stale copy**: `forgot-password.tsx:46,70` still say "reset link" / "Send reset link". Change to code language.

## Related Code Files

- Modify: `apps/mobile/src/api/endpoints.ts`
  - `forgotPassword(email)` — unchanged.
  - Add `verifyResetCode(email, code)` → `POST /auth/verify-reset-code`, returns `{ resetTicket }`.
  - Change `resetPassword(ticket, password)` — body `{ resetTicket: ticket, password }`.
- Modify: `apps/mobile/app/(auth)/forgot-password.tsx` — code copy; on success `router.push` to the code screen with `email`.
- Create: `apps/mobile/app/(auth)/verify-reset-code.tsx` — model on `verify-email.tsx` (6-digit input, auto-submit, resend via `forgotPassword` with the cooldown/messaging above). On success push to `reset-password` with the ticket.
- Modify: `apps/mobile/app/(auth)/reset-password.tsx` — read `ticket` param, keep the missing-credential recovery CTA (RT-12), submit with ticket.
- Delete: `apps/mobile/src/lib/linking.ts` (RT-4).
- Modify: `apps/mobile/app/_layout.tsx` — remove the `parseAuthDeepLink` import (`:25`) and reset block (`:109-114`); leave referral capture (`:118-124`).

## Implementation Steps

1. Update `endpoints.ts` with `verifyResetCode` and the new `resetPassword` body.
2. Update `forgot-password.tsx` copy + navigation.
3. Create `verify-reset-code.tsx` from the `verify-email.tsx` pattern, with the terminal-state + resend-cooldown UX (RT-12).
4. Update `reset-password.tsx` to consume `ticket`, keeping the missing-ticket recovery CTA.
5. Delete `linking.ts`; remove its usage in `_layout.tsx` (reset block only, referral stays).
6. `pnpm --filter @expyrico/mobile typecheck`.

## Success Criteria

- [ ] Forgot-password uses code copy and navigates to the code screen.
- [ ] Code screen validates via `verify-reset-code`, forwards the ticket, and after a failure offers a clear "request a new code" path.
- [ ] Reset screen sets the password using the ticket, and shows a start-over CTA when the ticket is missing.
- [ ] `linking.ts` deleted; `_layout.tsx` has no `parseAuthDeepLink` reference; referral capture still works.
- [ ] No mobile code references a reset-password deep link or `token` param.

## Risk Assessment

- **Ticket in navigation params**: single-use + short-lived server-side; rides an in-app route param, not an external URL — acceptable. The missing-ticket CTA (RT-12) covers the lost-state case.
- **Stale vendored schema**: if Phase 1 re-vendor was skipped, `resetPassword`'s new body won't typecheck — caught at step 6.
