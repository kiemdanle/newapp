---
phase: 2
title: "Backend"
status: done
priority: P1
dependencies: [1]
---

# Phase 2: Backend

## Overview

Convert the Fastify password-reset flow from a magic-link token to a 6-digit OTP with a verify-then-set-password exchange, backed by a reworked `PasswordReset` model. The per-code attempt cap is the linchpin of the brute-force defense, so its lookup and increment semantics are specified precisely below (see RT-1, RT-2).

## Requirements

- Functional: `forgot-password` emails a 6-digit code; new `verify-reset-code` validates the code and returns a single-use reset ticket; `reset-password` consumes the ticket and sets the password.
- Non-functional (security): code 10-min expiry, single-use, max 5 attempts **enforced race-safely**, per-account throttle independent of IP, no user enumeration (status/body/timing), revoke sessions on reset.

## Architecture

**`PasswordReset` model lifecycle** (exactly one active row per user — see RT-9):

1. `forgot-password` **hard-deletes any prior reset rows for the user**, then creates `{ userId, codeHash, expiresAt: +10min, attempts: 0 }` in one transaction. Deleting (rather than flagging) prior rows guarantees a single active row, removes the "verified-but-unconsumed stale ticket" case, and avoids any retained-row unique collision. Reset rows are ephemeral (≤10 min) so deletion loses nothing.
2. `verify-reset-code` looks the active row up **by `userId` + active-state only** (`consumedAt IS NULL`, `verifiedAt IS NULL`, `expiresAt > now`), then compares `codeHash` **in application code**. The attempt cap is enforced with a single conditional atomic UPDATE (RT-2), not a read-then-check. On success it sets `verifiedAt`, generates a ticket, stores `ticketHash` + `ticketExpiresAt: +10min`, and returns the raw ticket.
3. `reset-password` finds the row by `ticketHash`, checks `ticketExpiresAt > now`, `consumedAt == null`, `verifiedAt != null`. Sets password, `consumedAt`, revokes all sessions.

`codeHash = hashToken(`${userId}:${code}`)` (existing `random.ts` helper). The ticket is `randomToken(32)`, stored as `hashToken(ticket)`.

### RT-1 (Critical): attempt cap requires lookup by userId, NOT by code hash

Do **not** copy the `verify-email.ts` `findFirst({ where: { userId, tokenHash } })` shortcut. If the row is found by hashing the submitted code, a *wrong* code matches no row, nothing increments, and the 5-attempt cap never fires — leaving brute force bounded only by a per-IP limiter that IP rotation defeats. Lookup MUST be by `userId` + active-state; the submitted code is then compared against the stored `codeHash` in application code so a wrong guess still resolves to a real row and is counted.

### RT-2 (High): enforce the cap with one conditional atomic UPDATE (closes TOCTOU)

A `SELECT attempts` then `if (attempts < 5)` then `UPDATE` is racy under READ COMMITTED — concurrent requests all read `< 5` before any commit. Instead, make the check part of the write:

```sql
UPDATE password_resets
   SET attempts = attempts + 1
 WHERE user_id = $1
   AND consumed_at IS NULL
   AND verified_at IS NULL
   AND expires_at > now()
   AND attempts < 5
RETURNING id, code_hash, attempts;
```

Postgres takes a row lock for the UPDATE, so concurrent requests serialize and at most 5 ever pass. Zero rows returned ⇒ treat as dead/invalid code ⇒ generic error. If a row is returned, compare `code_hash` to `hashToken(userId:submittedCode)` in app code; mismatch ⇒ generic error (attempt already counted), match ⇒ issue ticket. Use `prisma.$executeRaw`/`$queryRaw` for this conditional update; a plain `increment` does not gate on `attempts < 5`.

### RT-3 / RT-6 (High): per-account throttle independent of IP

The `/v1/auth/*` limiter keys purely on `ip:` (`api/src/routes/auth/index.ts:24-30`), so IP rotation defeats it. Add Redis per-account throttles keyed on user id (via `getRedis()`):

- `forgot-password`: max 3 code emails per account per hour (prevents inbox bombing and churning the victim's live code). Apply after resolving the user; still always return 204.
- `verify-reset-code`: the row-level conditional UPDATE (RT-2) already caps to 5 per code per account race-safely; no extra Redis counter is required, but document that the per-IP limiter is not the brute-force control here.

### RT-7 (High): SMTP failure must not leak account existence

`sendMail` throws on SMTP trouble; an unguarded call inside `if (user)` returns 500 for real accounts vs 204 for unknown ones — an enumeration oracle. Wrap create+send so the endpoint always returns 204 and log failures server-side.

### RT-4 (Medium): timing enumeration

Status and body are constant, but the *work* differs (real account = DB write + SMTP; unknown = instant 204). Do the user lookup unconditionally, and keep the synchronous path's cost independent of account existence — acceptable options: run a dummy `hashToken` compare on the not-found branch, or dispatch email via an existing queue so the request path is constant-time. Target: response latency must not correlate with account existence/status.

### RT-11 (Medium): kill live JWT access tokens on reset via `tokenVersion` — VALIDATED: full kill

`revokeAllSessions` only revokes refresh `Session` rows (`sessions.ts:81-87`); access tokens are stateless HS256 with a TTL and no revocation list (`tokens.ts:27-34`), so a stolen access token would otherwise survive up to `accessTtlSeconds` (900s) after reset. **User decision (validation): add a per-user `tokenVersion` check for full invalidation.** Implementation:

- `schema.prisma`: add `tokenVersion Int @default(0)` to the `User` model. (Separate migration concern from `PasswordReset` — same migration file is fine.)
- `tokens.ts` (`issueAccessToken`): embed the user's current `tokenVersion` as a claim (e.g. `tv`).
- **Verify path — put the check where a DB lookup already happens.** The base `authPlugin` `onRequest` decodes the JWT without a DB hit (keep it that way — it must stay cheap and run before the rate limiter). The `requireAuth` decorator already re-loads the user to check existence + active status, so add the `tv === user.tokenVersion` comparison there; a stale `tv` ⇒ 401. This adds no new query. (Any route using bare `req.user` without `requireAuth` would not get the check — audit that all password-protected routes use `requireAuth`.)
- `reset-password.ts`: `increment: { tokenVersion: 1 }` on the user inside the same transaction as the password update + `revokeAllSessions`.

Trade-off accepted: access tokens become effectively stateful on protected routes (already true, since `requireAuth` does a DB lookup). This is the price of instant revocation.

### RT-13 (Medium): `APP_DEEP_LINK` becomes orphaned

`cfg.frontend.appDeepLink` is consumed only by the reset link (`email.ts:36`). Once the link is gone it has zero runtime consumers but stays a fail-fast required env var. **Decision:** drop `APP_DEEP_LINK` from `config.ts` schema + `config.test.ts`, unless a future non-reset use is intended (state it if retained).

### RT-15 (Medium): don't log the raw reset code

`email.ts` logs the code/link in the `env === 'test'` branch. Keep tests off the log line (Phase 4 reads from the `vi.mock` capture instead), log only a redacted marker, and add a startup assertion that `env !== 'test'` in production config.

## Related Code Files

- Modify: `api/prisma/schema.prisma` — `PasswordReset` model:
  - rename `tokenHash` → `codeHash`, **drop `@unique`** (RT-9); lookup is by `userId`, so `@@index([userId])` suffices.
  - add `attempts Int @default(0)`, `verifiedAt DateTime?`, `ticketHash String? @unique` (nullable unique is safe — multiple NULLs allowed in Postgres), `ticketExpiresAt DateTime?`, `consumedAt DateTime?`.
  - drop `usedAt` (superseded by `consumedAt`).
- Create: `api/prisma/migrations/<timestamp>_password_reset_otp/migration.sql` — **hand-edit** (RT-10, VALIDATED: RENAME to preserve in-flight rows). `prisma migrate dev` emits a destructive `DROP`+`ADD` for a rename; replace it with `ALTER TABLE password_resets RENAME COLUMN token_hash TO code_hash`, drop the `code_hash` unique index, add the new `PasswordReset` columns as nullable, and `DROP COLUMN used_at`. Same migration also adds `token_version` to `users` (`ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0` — safe, has a default) for RT-11.
- Modify: `api/prisma/schema.prisma` — `User` model: add `tokenVersion Int @default(0)` (RT-11).
- Modify: `api/src/services/auth/tokens.ts` — embed `tokenVersion` as the `tv` claim in `issueAccessToken`.
- Modify: `api/src/plugins/auth.ts` — in the `requireAuth` decorator (which already reloads the user), reject when `tv !== user.tokenVersion` (RT-11). Do not add a DB hit to the base `onRequest` decode.
- Modify: `api/src/services/auth/email.ts` — replace `sendPasswordResetEmail(to, token)` with `sendPasswordResetCodeEmail(to, code)`, mirroring `sendVerificationEmail` (subject "Reset your Expyrico password", show 6-digit code, 10-min expiry, no link). Redacted test-env log only (RT-15).
- Modify: `api/src/routes/auth/forgot-password.ts` — preserve the `user.status === 'active'` gate (RT-14); per-account Redis throttle (RT-3); delete prior rows + create new in a transaction (RT-9); try/catch around create+send, always 204 (RT-7); constant-time not-found branch (RT-4).
- Create: `api/src/routes/auth/verify-reset-code.ts` — `POST /verify-reset-code`, parse `verifyResetCodeSchema`, run the conditional-UPDATE attempt check (RT-1/RT-2), compare hash in app, return `{ resetTicket }` via `verifyResetCodeResponseSchema`. One generic `INVALID_TOKEN` for every failure (no row / expired / wrong / capped).
- Modify: `api/src/routes/auth/reset-password.ts` — look up by `ticketHash = hashToken(input.resetTicket)`, validate ticket window + single-use + `verifiedAt != null`, set password, `consumedAt`, `revokeAllSessions` (RT-11 note).
- Modify: `api/src/routes/auth/index.ts` — register `verifyResetCodeRoute` inside the rate-limited scope.
- Modify: `api/src/config.ts` (+ `api/tests/unit/config.test.ts`) — drop `APP_DEEP_LINK` (RT-13).
- Keep: `api/src/utils/random.ts` (`randomToken`, `randomSixDigitCode`, `hashToken` reused).

## Implementation Steps

1. Update `PasswordReset` in `schema.prisma` (no `@unique` on `codeHash`); generate the migration and hand-edit it to a RENAME (RT-10). Run `prisma migrate dev --name password_reset_otp` and `prisma generate`. Record the exact DDL for Phase 4's test-DB step.
2. Rework `email.ts` reset function to send the code with a redacted test log (RT-15).
3. Rework `forgot-password.ts`: status gate, per-account throttle, delete-prior + create in a tx, try/catch always-204, constant-time not-found branch.
4. Add `verify-reset-code.ts` with the conditional-UPDATE cap and in-app hash compare; register in `index.ts`.
5. Rework `reset-password.ts` to consume the ticket; keep session revocation and add the RT-11 doc note.
6. Drop `APP_DEEP_LINK` from config + config test.
7. `pnpm --filter @expyrico/api typecheck`.

## Success Criteria

- [ ] Migration applies as a RENAME (no data loss surprise); `PasswordReset` has code + ticket + attempts columns and no `@unique` on `codeHash`.
- [ ] `forgot-password` emails a code, always returns 204 (even on SMTP failure and for unknown/suspended accounts), preserves the `status === 'active'` gate, and throttles per account.
- [ ] `verify-reset-code` counts wrong codes (looked up by userId, hash compared in app), caps at 5 race-safely via conditional UPDATE, and returns a generic error for every failure mode.
- [ ] `reset-password` accepts only a valid single-use ticket, revokes refresh sessions, AND increments `User.tokenVersion` so existing access tokens are rejected at `requireAuth` (RT-11 full kill).
- [ ] No remaining reference to `sendPasswordResetEmail`, a reset link, or `APP_DEEP_LINK` in `api/` (including test mocks — see Phase 4).

## Risk Assessment

- **Attempt-cap correctness** is the highest risk; RT-1 + RT-2 are mandatory, not optional. A code review must confirm the lookup is by `userId` and the cap is in the UPDATE `WHERE`.
- **Enumeration** spans status, body, and timing — verify all three, not just the status code.
- **Migration**: confirm on a copy that the RENAME preserves the table and that dependent code (only `forgot-password.ts` + `reset-password.ts` reference these columns — verified) compiles.
