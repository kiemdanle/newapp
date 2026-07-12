---
phase: 4
title: "Tests"
status: done
priority: P2
dependencies: [2, 3]
---

# Phase 4: Tests

## Overview

Cover the new OTP reset flow with backend integration tests and mobile route tests, fix the tests that the rename/rewrite breaks, and apply the schema to the test database (which is migrated by hand, not by Prisma — RT-2-fma).

## Requirements

- Functional: exercise every success and failure path of the three endpoints and the three screens.
- Non-functional: assert the security invariants (single-use, expiry, race-safe attempt cap, per-account throttle, no enumeration, session revocation).

## RT-2-fma (Critical): apply the schema to `pantry_test` — Prisma does not

`api/tests/helpers/setup.ts:53-56` is explicit: migrations are applied **manually** to `pantry_test` (the `pantry` DB user lacks `_prisma_migrations` write access); the harness only truncates before each test. `prisma migrate dev` (Phase 2) touches the dev DB only. Without a manual DDL step the new columns never reach `pantry_test` and every new/edited reset test fails with `column "code_hash" does not exist`.

Step: take the exact DDL recorded in Phase 2 step 1 (or `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script`) and run it against `pantry_test` before the suite. Document the command next to the existing manual-DDL note.

## RT-3-ad (Critical): the real breaking test is `forgot-reset.test.ts`, not `reset-password.test.ts`

`api/tests/integration/reset-password.test.ts` does **not exist**. The actual token-based test is `api/tests/integration/forgot-reset.test.ts` (`:32` writes `tokenHash: hashToken(plain)`, `:38` posts `{ token: plain, password }`). Both lines break after the Phase 1 rename. Rewrite its three cases (happy path, no-leak 204, bogus token) to the code→ticket flow; add a verify-reset-code stage.

## RT-8-fma (High): read the code from the `vi.mock` capture, not from logs; fix stale mocks

The harness mocks the email module — it never reads logs. `api/tests/integration/verify-email.test.ts:5-8` does `vi.mock('../../src/services/auth/email.js', () => ({ ... }))` and pulls the code from `vi.mocked(sendVerificationEmail).mock.calls`. Two required fixes:

- New/rewritten reset tests must read the code from `vi.mocked(sendPasswordResetCodeEmail).mock.calls.at(-1)?.[1]`, not from an info log.
- `api/tests/integration/register.test.ts:7` and `api/tests/integration/verify-email.test.ts:7` both declare `sendPasswordResetEmail` in their mock factory. Phase 2 deletes that export. Update both factories to `sendPasswordResetCodeEmail` so `forgot-password.ts`'s import doesn't resolve to `undefined` and the plan's "no `sendPasswordResetEmail` anywhere" criterion holds.

## RT-4-ad (High): delete `linking.test.ts` with the deep-link removal

`apps/mobile/src/lib/linking.test.ts:5,10-16` asserts reset-password parsing. Phase 3 deletes `linking.ts` entirely (it's the whole function, not a branch), so this test file must be deleted, not modified.

## Related Code Files

- Create: `api/tests/integration/verify-reset-code.test.ts`
- Rewrite: `api/tests/integration/forgot-reset.test.ts` (RT-3-ad) — code + ticket flow.
- Modify (mock factories): `api/tests/integration/register.test.ts`, `api/tests/integration/verify-email.test.ts` (RT-8-fma).
- Create: `apps/mobile/__tests__/routes/verify-reset-code.test.tsx` **plus** route tests for forgot-password and reset-password — none exist today, so this is net-new authoring (RT-8-ad), not modification.
- Delete: `apps/mobile/src/lib/linking.test.ts` (RT-4-ad).

## Implementation Steps

1. Apply the Phase 2 DDL to `pantry_test` (RT-2-fma).
2. **Backend `forgot-password`**: 204 for known/unknown/suspended email; a `PasswordReset` row with `codeHash` created for a real active user; no link emailed; prior rows deleted on a second request; per-account throttle returns 204 after the cap without emailing.
3. **Backend `verify-reset-code`**: valid code → `{ resetTicket }` (+ `verifiedAt`/`ticketHash` set); wrong code → generic `INVALID_TOKEN` and `attempts` incremented (assert the column); 6th attempt rejected even with the correct code; expired code rejected; unknown email → same generic error; **concurrent wrong guesses do not exceed 5** (fire N in parallel, assert `attempts` caps at 5).
4. **Backend `reset-password`**: valid ticket → 204, password changed (login succeeds), refresh sessions revoked (a pre-reset refresh token is rejected); reused ticket → 400; expired ticket → 400; unverified/forged ticket → 400.
5. **Mobile**: forgot-password navigates to the code screen with email; code screen submits and pushes to reset with the ticket; reset screen submits ticket + password and routes to sign-in; missing-ticket recovery CTA routes back to forgot-password.
6. Delete `linking.test.ts`; confirm no dangling import of `parseAuthDeepLink`.
7. Run: `pnpm --filter @expyrico/api test:integration`, then `pnpm --filter @expyrico/mobile test`, then `pnpm -r typecheck`.

## Success Criteria

- [ ] `pantry_test` has the new columns; the reset suite runs (no "column does not exist").
- [ ] `forgot-reset.test.ts` rewritten; `verify-reset-code.test.ts` covers all failure modes incl. the concurrency cap.
- [ ] `register.test.ts` + `verify-email.test.ts` mock factories reference `sendPasswordResetCodeEmail`; no `sendPasswordResetEmail` reference remains.
- [ ] Mobile route tests for all three screens pass; `linking.test.ts` deleted; no dangling `parseAuthDeepLink` import.
- [ ] `pnpm -r typecheck` clean across api, shared, mobile.

## Risk Assessment

- **Concurrency-cap test**: fire the parallel wrong-guess requests against the same row and assert on the `attempts` column and the count of successful validations, not on timing.
- **Session-revocation assertion**: verify by using a pre-reset refresh token and expecting rejection, not by counting rows.
- **Test-DB DDL drift**: if the manual DDL diverges from the dev migration, tests pass locally but prod differs — derive the DDL from the same migration file, don't hand-write it twice.
