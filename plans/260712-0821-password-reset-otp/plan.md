---
title: "Password reset via 6-digit OTP"
description: "Convert the forgot/reset-password flow from a magic link to a 6-digit email OTP with a verify-then-set-password exchange."
status: pending
priority: P2
branch: "main"
tags: [auth, security, mobile, api]
blockedBy: []
blocks: []
created: "2026-07-12T08:22:06.087Z"
createdBy: "ck:plan"
source: skill
---

# Password reset via 6-digit OTP

## Overview

Registration email verification **already** uses a 6-digit OTP (backend `register.ts` + `verify-email.ts`, mobile `(auth)/verify-email.tsx`). The only flow still using a magic link is **password reset**: `forgot-password.ts` emails a `randomToken(32)` deep link (`…reset-password?token=…`), and `reset-password.ts` looks the user up by that token.

This plan converts password reset to a 6-digit OTP with a two-step exchange (design chosen by the user):

1. **forgot-password** — user enters email → server emails a 6-digit code (10-min expiry).
2. **verify-reset-code** — user enters the code → server validates it and returns a short-lived, single-use **reset ticket** (opaque high-entropy token). The raw code is never replayed with the new password.
3. **reset-password** — user submits the reset ticket + new password → server sets the password and revokes all sessions.

The magic-link deep-link path (`pantry://reset-password?token=`) becomes obsolete and is retired as cleanup.

## Design decisions (confirmed with user)

- **Scope: password reset only.** Registration OTP is left untouched.
- **Two-step: verify code → issue reset ticket → set password.** Safer than submitting code + password together: bad codes are rejected before the user types a password, and the OTP is never transmitted alongside the new password.

## Security requirements

- 6 digits = 1,000,000 combinations. Password reset is account-takeover-sensitive, so unlike email verification the OTP path must add:
  - **Short expiry**: 10 min for the code (down from the current 1 h token), 10 min for the reset ticket.
  - **Single-use**: code consumed on successful verify; ticket consumed on password set.
  - **Race-safe per-code attempt cap**: max 5 failed attempts, enforced by a **conditional atomic UPDATE keyed on `userId`** (not a read-then-check, and not a lookup-by-code-hash — see Phase 2 RT-1/RT-2). The `/v1/auth/*` limiter is per-IP and is **not** the brute-force control here; IP rotation defeats it.
  - **Per-account throttle** independent of IP: forgot-password max 3 emails/account/hour (Phase 2 RT-3/RT-7).
  - **No user enumeration** across status, body, **and timing**: `forgot-password` always returns 204 (even on SMTP failure and for suspended accounts); `verify-reset-code` returns one generic error for every failure mode; the not-found path is kept constant-time (Phase 2 RT-4/RT-7).
  - **Full session + access-token revocation** on successful reset: revoke refresh sessions AND increment `User.tokenVersion`, which `requireAuth` checks against the JWT `tv` claim so existing access tokens are immediately rejected (Phase 2 RT-11, validated).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Contracts](./phase-01-contracts.md) | Done |
| 2 | [Backend](./phase-02-backend.md) | Done |
| 3 | [Mobile](./phase-03-mobile.md) | Done |
| 4 | [Tests](./phase-04-tests.md) | Done |
| 5 | [Build & Install](./phase-05-build-install.md) | APK built + installed; on-device smoke test blocked on backend deploy |

## Dependencies

- Phase 2 (backend) and Phase 3 (mobile) both depend on Phase 1 (shared zod contracts).
- Phase 1 must also **rebuild `@expyrico/shared` and re-vendor its `dist` into `apps/mobile/local-packages/`** — the mobile app consumes the built copy, not source (known drift point).
- Phase 4 (tests) depends on Phase 2 and Phase 3.
- Phase 5 (build & install) runs last — depends on Phases 2, 3, and 4 passing. It rebuilds the release APK locally (Gradle, no Expo) and installs it on the MI 9 over adb. The on-device smoke test also depends on the Phase 2 backend being deployed to `api.linhkienkts.com`.

## Acceptance criteria

- [ ] Forgot-password emails a 6-digit code, not a link; no `PasswordReset` link/token remains.
- [ ] Verify-reset-code returns a reset ticket only for a valid, unexpired, unused code within the attempt budget.
- [ ] Reset-password accepts only a valid single-use ticket and revokes all sessions.
- [ ] Mobile flow: forgot-password → code entry screen → new-password screen → sign in, with no deep-link dependency.
- [ ] All failure modes surface a single generic error (no enumeration).
- [ ] Backend integration tests and mobile route tests pass; `pnpm -r typecheck` clean.
- [ ] Release APK rebuilt locally (`pnpm mobile:apk`), installed on the MI 9 via the MIUI-safe `pm install` path, and the OTP reset flow passes a manual on-device smoke test.

## Red Team Review

3 hostile reviewers (security adversary, assumption destroyer, failure-mode analyst) reviewed the plan against the live auth code. 15 findings, all with `file:line` evidence; all accepted and applied. Tags (RT-N) are cross-referenced in the phase files.

### Critical

- **RT-1 — attempt cap unenforceable via lookup-by-hash** (`verify-email.ts:16-23`). Wrong code hashes to no row → `attempts` never increments → cap never fires. Fix: look up by `userId` + active-state, compare hash in app code. → Phase 2.
- **RT-2-fma — test DB migrated by hand, not `prisma migrate dev`** (`tests/helpers/setup.ts:53-56`). New columns never reach `pantry_test`. Fix: explicit DDL step. → Phase 4.
- **RT-3-ad — Phase 4 targeted nonexistent `reset-password.test.ts`**; real breaker is `forgot-reset.test.ts:32,38`. → Phase 4.
- **RT-4-ad — removing reset deep-link kills the entire `parseAuthDeepLink`** (`linking.ts:10`) and breaks `linking.test.ts`; referral capture is separate (`_layout.tsx:118-124`). Fix: delete the file, not a branch. → Phase 3 / 4.

### High

- **RT-2 — TOCTOU race on the attempt check** (`phase-02:63`). Fix: conditional atomic `UPDATE ... WHERE attempts < 5 RETURNING`. → Phase 2.
- **RT-3/RT-7 — no per-account throttle; per-IP limiter defeated by rotation** (`index.ts:24-30`). Fix: Redis per-account quota on forgot-password. → Phase 2.
- **RT-7-fma — SMTP failure leaks account existence** (`forgot-password.ts:21`). Fix: try/catch, always 204. → Phase 2.
- **RT-8-fma — Phase 4 "read code from logs" contradicts the `vi.mock` harness; mocks break on rename** (`verify-email.test.ts:5-8`, `register.test.ts:7`). → Phase 4.
- **RT-9 — global `@unique` on `codeHash` footgun** (`phase-02:33`). Fix: drop `@unique`, single active row via delete-prior. → Phase 2.
- **RT-10-ad — column rename is a destructive drop+add** (`schema.prisma:237,239`). Fix: hand-edit migration to `RENAME COLUMN`. → Phase 2.

### Medium

- **RT-11 — "revoke sessions" doesn't kill stateless JWT access tokens** (`sessions.ts:81-87`, `tokens.ts:27-34`). Documented 900s residual window. → Phase 2.
- **RT-12 — mobile UX dead-ends** (resend invalidates in-flight code; lost-ticket dead-end; no terminal state; stale "reset link" copy). → Phase 3.
- **RT-13-ad — `APP_DEEP_LINK` orphaned but still required** (`email.ts:36`, `config.ts:47`). Decision: drop it. → Phase 2.
- **RT-6-ad — `.gitignore` lacks `@expyrico/shared/dist` negation** (`.gitignore:5,12-13`). Fix: add negation. → Phase 1. (Also folds in preserving the `status === 'active'` gate, RT-14.)
- **RT-15 — raw reset code logged in `env==='test'` branch** (`email.ts:21-23`). Fix: redacted log + prod-env assertion. → Phase 2.

### Confirmed (plan claims that held)

Registration already uses 6-digit OTP; the reset link has no other consumers (admin app has none); the manual vendored-dist copy is the real sync mechanism (no script/alias); the `{ resetTicket }` contract is consistent across phases.

### Whole-Plan Consistency Sweep

Re-read `plan.md` + all four phase files after applying findings. Reconciled:
- Security-requirements block (plan.md) rewritten to match RT-1/2/3/4/7/11 (removed the "defense-in-depth per-IP" framing, the "just increment attempts" cap, and the overstated session revocation).
- `tokenHash`→`codeHash` and `{token}`→`{resetTicket}` renames consistent across Phase 1 (schema), Phase 2 (routes), Phase 3 (mobile endpoints), Phase 4 (tests).
- Test filenames corrected to real paths (`forgot-reset.test.ts`); phantom `reset-password.test.ts` removed everywhere.
- Deep-link cleanup consistently described as full-file deletion (Phase 3 + Phase 4), referral capture explicitly preserved.
- `APP_DEEP_LINK` drop reflected in Phase 2 files + success criteria.
- No unresolved contradictions remain.

## Validation Log

### Session 1 — critical-questions interview

Verification pass skipped: `## Red Team Review` already carries `file:line` evidence and no `[UNVERIFIED]` tags remain (per validate-workflow Step 2.5 guard). 4 questions asked.

| # | Decision | Answer | Propagation |
|---|----------|--------|-------------|
| 1 | Access-token revocation on reset (RT-11) | **Add `tokenVersion` full kill** (changed the plan default, which was to document the 900s window) | Phase 2: `User.tokenVersion` column, `tv` JWT claim, `requireAuth` check, increment on reset |
| 2 | `PasswordReset` column rename migration (RT-10) | **RENAME to preserve in-flight rows** (matched default) | Phase 2: migration hedge removed, RENAME made definitive |
| 3 | Code + ticket expiry | **10 min + 10 min** (matched default) | No change |
| 4 | `APP_DEEP_LINK` env var (RT-13) | **Drop it** (matched default) | No change |

Only decision #1 changed scope; #2–#4 confirmed existing defaults.

### Whole-Plan Consistency Sweep (post-validation)

Re-read `plan.md` + all four phase files after propagating the `tokenVersion` decision. Reconciled:
- plan.md security requirement changed from "documented 900s residual window" to "full session + access-token revocation via `tokenVersion`".
- Phase 2 RT-11 section, related-files list, implementation steps, and success criteria all reflect the `tokenVersion` column / `tv` claim / `requireAuth` check / reset increment.
- Migration section now covers both `password_resets` (RENAME) and `users.token_version` (add-with-default) in one migration; Phase 4's manual `pantry_test` DDL step inherits both.
- No contradictions remain. Verification Results: Failed: 0 — plan eligible for implementation.
