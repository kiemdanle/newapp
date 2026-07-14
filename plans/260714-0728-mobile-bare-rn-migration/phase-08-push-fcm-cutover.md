---
phase: 8
title: "Push contract to FCM (hard cutover, dev-device distribution)"
status: pending
priority: P1
dependencies: [7]
---

# Phase 8: Push contract to FCM (hard cutover)

## Overview

Migrate the push contract from Expo Push to native Firebase Cloud Messaging. Validation decision (2026-07-14): distribution is **dev/test device(s) only** — no fleet of installed APKs to protect — so this is a simple hard cutover (rename field, revoke legacy tokens, re-register on next launch), NOT the dual-accept transition the original red-team draft required. The red-team F2/F3 blackout concern assumed real end-users; the user confirmed there are none, so the simpler path is correct. The other push fixes (F1 rejected-format window, F9 dist drift, F10 sticky flag, F15 revocation correlation) still apply and are kept.

## Requirements

- Functional: `expoPushToken` is renamed to `deviceToken`; a forward migration renames the column and revokes legacy tokens; clients register a fresh native FCM token; the worker sends via Firebase Admin, writes one result per device correlated to its token, and revokes tokens FCM rejects. The mobile push-registered flag is cleared on sign-out/revocation so the dev device actually re-registers.
- Non-functional: no API key/service-account JSON/signing material committed — Firebase Admin via untracked platform config + Application Default Credentials. Both `@expyrico/shared` vendored dist copies refreshed and load-asserted.

## Architecture

Current Expo surface (verified): `schema.prisma:206` `expoPushToken String @unique`; `shared/schemas/record.ts:115` regex `/^Expo(nent)?PushToken\[.+\]$/` + `:123` output; `routes/me/push-token.ts`; `services/push/repository.ts`; `services/push/expo-push.ts` (`Expo`, `Expo.isExpoPushToken`); `workers/notification-send.ts` (`ExpoPushMessage`); `api/package.json` `expo-server-sdk`; mobile `registerPushToken.ts`.

**Hard cutover (source-atomic single commit):**
1. Prisma: rename `expoPushToken` → `deviceToken` (keep `@unique`); forward migration renames the column and revokes all legacy tokens (dev device re-registers on next launch — acceptable because there is no user fleet).
2. Shared validation: replace the Expo regex with native FCM token validation; update input/output field names.
3. Mobile emission (from phase-7 plumbing) is enabled in THIS commit, so the native token reaches the wire only once the validator accepts it — closes red-team F1's rejected-format window (source-atomic; the dev-device runtime window is just "reflash and relaunch once").
4. Provider-message log field renamed alongside the token field.

**Token↔response correlation (red-team F15):** the current worker maps messages from `tokens` but `expo-push.ts:23` pre-filters via `Expo.isExpoPushToken`, and the success loop writes `ticket.id` with NO back-reference to the token row. Replace with Firebase Admin `sendEachForMulticast` over the UNFILTERED token array, mapping `responses[i] → tokens[i].id` and revoking by token id (not index into a filtered subset).

**Re-registration flag (red-team F10):** `registerPushToken.ts` early-returns if `pantry.pushRegisteredV1` is set, but `secure-store.ts` `clearAll()` (sign-out) deletes only access/refresh/theme. After the hard revoke this flag would block the dev device from ever re-registering. Clear the push flag on sign-out and on server-signalled revocation, or replace the flag short-circuit with a current-token comparison.

**Vendored dist (red-team F9):** after editing `record.ts`, refresh BOTH the committed `apps/mobile/local-packages/@expyrico/shared/dist/` AND the pnpm virtual-store copy jest resolves; run `pnpm install` first if root `node_modules` is absent; assert jest loads the new schema (a native-token assertion that fails under the old Expo regex).

**Firebase Admin credential lifecycle (red-team-2 F2):** `api/src/config.ts` fails fast at boot on missing env (existing pattern, e.g. `WEBAUTHN_RP_ID` at `config.ts:37`), but the plan's "ADC + untracked config" adds no config entry — so a misconfigured prod deploy throws per-send at runtime instead of at boot. Add the chosen credential mechanism to the `config.ts` zod schema and validate it at startup: either require `GOOGLE_APPLICATION_CREDENTIALS` to point at an existing file, or declare workload-identity-only and assert `FIREBASE_PROJECT_ID`. State the prod mechanism explicitly.

**Token-ownership takeover — pre-existing defect, do NOT migrate forward unchanged (red-team-2 F3):** `repository.ts:11-26` `upsertPushToken` keys the upsert on the token value (`where: { expoPushToken }`) and, on conflict, overwrites `userId` with the caller and nulls `revokedAt`. Any authenticated user who submits a token string already in the table silently steals that row — the victim's notifications reroute to the attacker (data exposure) and a revoked token can be resurrected. The field rename must NOT preserve this semantics: on conflict where the existing row's `userId` differs from the caller, revoke/detach the prior binding before rebinding, or reject. Add a cross-user resubmission regression test. (This is a genuine pre-existing security bug the migration touches — fixing it here is in-scope because phase 8 already rewrites this file.)

## Related Code Files

- Modify: `api/prisma/schema.prisma` (+ forward migration under `api/prisma/migrations/`), `packages/shared/src/schemas/record.ts`, `api/src/routes/me/push-token.ts`, `api/src/services/push/repository.ts`, `api/src/workers/notification-send.ts`, `api/package.json`, `api/src/config.ts` (Firebase credential env schema — red-team-2 F2)
- Replace: `api/src/services/push/expo-push.ts` → `fcm-push.ts` (Firebase Admin, `sendEachForMulticast`, id-correlated revocation)
- Modify: `apps/mobile/src/features/push/registerPushToken.ts` (enable native emission), `apps/mobile/src/api/push.ts`, `src/auth/secure-store.ts` (`clearAll` clears push flag)
- Modify: `api/tests/integration/push-routes.test.ts`, `api/tests/unit/workers-notification-send.test.ts`
- Refresh: both `@expyrico/shared` dist copies

## Implementation Steps

1. Forward Prisma migration: rename `expoPushToken` → `deviceToken` (keep `@unique`), revoke legacy tokens. **Pin the SQL as an explicit `RENAME COLUMN` and assert it is not a generator-produced `DROP`/`ADD` (red-team-2 F5 — a drop/recreate destroys the token data instead of renaming).** Apply on a disposable local DB (use `pantry_app` test role per memory).
2. Replace shared validation with native FCM token shape; update field names; refresh both dist copies; assert jest loads the new build.
3. Add the Firebase credential mechanism to `api/src/config.ts` (fail-fast at boot, red-team-2 F2). Rewrite the sender over Firebase Admin `sendEachForMulticast` with id-correlated per-device results + revoke-by-id. Update repository + route, and fix the upsert so a token owned by another user is not silently reassigned (red-team-2 F3).
4. Update the worker to the new sender; preserve circuit-breaker.
5. Enable mobile native-token emission (phase-7 plumbing) in the same commit; clear the push flag on sign-out/revocation.
6. Replace test fixtures/mocks with native-token + Firebase Admin mocks covering id-correlated revocation, re-registration after sign-out, and cross-user token-resubmission rejection (F3). Remove `expo-server-sdk` from `api/package.json`.

## Success Criteria

- [ ] No `expoPushToken`, `expo-server-sdk`, or `ExponentPushToken` reference remains in `api`, `packages/shared`, or `apps/mobile`.
- [ ] Forward migration renames the column, keeps `@unique`, revokes legacy tokens; `prisma migrate` applies cleanly on a disposable DB.
- [ ] Worker sends via Firebase Admin, correlates each response to its token id, revokes only the rejected token; circuit-breaker preserved.
- [ ] Mobile emits a native token accepted by the validator (source-atomic, no rejected-format code path); push flag cleared on sign-out/revocation and a second-boot re-registers.
- [ ] Both `@expyrico/shared` dist copies refreshed; jest asserts the new schema; push route + worker tests pass; API typecheck passes.
- [ ] **(red-team-2 F2)** `api/src/config.ts` validates the Firebase credential mechanism at boot; the API fails fast when it is absent rather than throwing per-send.
- [ ] **(red-team-2 F3)** submitting a `deviceToken` already owned by another user does NOT silently reassign it; a cross-user resubmission regression test passes.
- [ ] **(red-team-2 F5)** the migration is a pinned `RENAME COLUMN` (verified, not a generator `DROP`/`ADD`); token rows survive the rename.

## Risk Assessment

- Hard revoke is safe ONLY because distribution is dev-device-only (validation decision). If the app later ships to real users, revisit: reintroduce a dual-accept window before mass-revoking (the original red-team F2/F3 concern).
- Rejected-format registration window (F1) → mobile emission enabled in the same source-atomic commit as the validator flip; dev device reflashed once.
- Index-based revocation revoking the wrong token (F15) → id-correlated `sendEachForMulticast`, no pre-filter.
- Stale shared schema in jest (F9) → refresh both copies + load assertion; `pnpm install` first if needed.
- Sticky re-registration flag (F10) → cleared on sign-out/revocation (critical after a hard revoke).
