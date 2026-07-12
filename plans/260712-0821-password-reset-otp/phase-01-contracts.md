---
phase: 1
title: "Contracts"
status: done
priority: P1
dependencies: []
---

# Phase 1: Contracts

## Overview

Update the shared zod contracts in `@expyrico/shared` to replace the token-based reset schemas with the two-step OTP schemas, then rebuild and re-vendor the package so the mobile app picks up the change.

## Requirements

- Functional: define the request/response shapes for `forgot-password`, `verify-reset-code`, and `reset-password`.
- Non-functional: single source of truth — API and mobile both import these; mobile consumes the built `dist` copy.

## Architecture

Three contracts drive the new flow:

- `forgotPasswordSchema` — unchanged: `{ email }`.
- `verifyResetCodeSchema` (new) — `{ email, code }` where `code` is `/^\d{6}$/` (mirror `verifyEmailSchema`).
- `verifyResetCodeResponseSchema` (new) — `{ resetTicket: string }` (opaque high-entropy token).
- `resetPasswordSchema` (changed) — from `{ token, password }` to `{ resetTicket, password }`.

## Related Code Files

- Modify: `packages/shared/src/schemas/auth.ts`
  - Add `verifyResetCodeSchema`, `verifyResetCodeResponseSchema`, `VerifyResetCodeInput` type.
  - Change `resetPasswordSchema` to `{ resetTicket: z.string().min(1), password: passwordField }`, update `ResetPasswordInput`.
  - Keep `forgotPasswordSchema` as-is.
- Verify export: `packages/shared/src/index.ts` (schemas/auth is already re-exported; no change expected).
- Regenerate (do not hand-edit): `apps/mobile/local-packages/@expyrico/shared/dist/**`
- Modify: `.gitignore` — add `!apps/mobile/local-packages/@expyrico/shared/dist/` negations (RT-6). `.gitignore:5` ignores `dist/`, and `:12-13` negate only `@expyrico/theme/dist`. The shared `dist` files are tracked today only because they predate the rule, so re-vendored *edits* to existing files commit fine — but any *new* file path the build emits would be silently ignored, shipping a stale schema (the exact "vendored drift" this phase flags as its top risk).

## Implementation Steps

1. Edit `packages/shared/src/schemas/auth.ts` per Architecture above.
2. Build the package: `pnpm --filter @expyrico/shared build`.
3. Re-vendor into the mobile app. Confirm the existing sync mechanism (the `dist` under `apps/mobile/local-packages/@expyrico/shared/` is committed and was regenerated in prior commits). Copy the freshly built `packages/shared/dist/**` over `apps/mobile/local-packages/@expyrico/shared/dist/**`.
4. `pnpm --filter @expyrico/api typecheck` and `pnpm --filter @expyrico/mobile typecheck` to confirm the contract change surfaces at every call site (expected: register/verify-email unaffected; reset-password call sites now flag until Phases 2–3 land).

## Success Criteria

- [ ] `verifyResetCodeSchema`, `verifyResetCodeResponseSchema`, and the updated `resetPasswordSchema` exist and are exported.
- [ ] `@expyrico/shared` builds clean.
- [ ] Mobile `local-packages` `dist` reflects the new schemas.

## Risk Assessment

- **Vendored drift**: the mobile app will silently use a stale schema if step 3 is skipped. Mitigation: typecheck mobile after re-vendoring; the changed `resetPassword` signature will error at the call site if the copy didn't take.
