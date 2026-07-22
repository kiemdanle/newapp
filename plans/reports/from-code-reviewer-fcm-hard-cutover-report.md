# Code Review: Phase 8 FCM hard cutover

**Status:** DONE_WITH_CONCERNS  
**Reviewer:** code-reviewer  
**Date:** 2026-07-20  
**Plan:** `plans/260714-0728-mobile-bare-rn-migration/phase-08-push-fcm-cutover.md`  
**Scope:** push contract rename, Prisma hard-revoke migration, Firebase Admin sender/worker, ownership fix, mobile FCM registration + sign-out flag clear

---

## Code Review Summary

### Scope
- Files (primary):
  - `packages/shared/src/schemas/record.ts`
  - `api/prisma/schema.prisma`
  - `api/prisma/migrations/20260720090000_fcm_push_tokens/migration.sql`
  - `api/src/services/push/fcm-push.ts` (new; replaces `expo-push.ts`)
  - `api/src/services/push/repository.ts`
  - `api/src/workers/notification-send.ts`
  - `api/src/routes/me/push-token.ts`
  - `api/src/config.ts`, `api/.env.example`, `api/.env.test.example`, `api/package.json`
  - `apps/mobile/src/features/push/registerPushToken.ts`
  - `apps/mobile/src/auth/secure-store.ts`, `apps/mobile/src/App.tsx`
  - tests: `push-routes`, `workers-notification-send`, `config`, `secure-store`
  - vendored shared dist (`apps/mobile/local-packages/...`, `packages/shared/dist`)
- LOC (phase-relevant diff, approx): ~290 insertions / ~160 deletions across core files + new FCM module + migration
- Focus: public-contract consistency, migration safety, token ownership, response↔token correlation, credential fail-fast, sign-out/re-register, test gaps
- Scout findings: sticky re-register flag only cleared on `clearAll`; no `onTokenRefresh`; circuit-breaker fallback returns `[]` without throw; ownership check is non-atomic; residual Expo push refs absent in live `api/src`, `apps/mobile/src`, `packages/shared/src`

### Overall Assessment
Core hard-cutover shape is largely correct: field rename is source-atomic across shared/API/mobile, migration uses pinned `RENAME COLUMN` + hard revoke, worker correlates FCM responses by unfiltered token order and revokes by token id, cross-user token reassignment is rejected with 409, and Expo SDK is removed. Two production-relevant defects remain unfixed relative to the phase success criteria: (1) the sticky `pantry.pushRegisteredV1` flag still blocks re-registration after the migration hard-revoke when the session stays signed in, and (2) the FCM circuit-breaker fallback turns outages into silent per-token failures with no BullMQ retry. Credential fail-fast is only half-implemented for `workload_identity`. Tests cover happy path + ownership + partial invalid-token revoke, but miss several cutover failure modes.

### Critical Issues

#### C1. Sticky push flag blocks re-registration after hard revoke (plan F10 / success criteria miss)
**Evidence**
- Migration hard-revokes all active rows:
  - `api/prisma/migrations/20260720090000_fcm_push_tokens/migration.sql:5`
  - `UPDATE "push_tokens" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "revokedAt" IS NULL;`
- Mobile still short-circuits on the sticky flag:
  - `apps/mobile/src/features/push/registerPushToken.ts:12`
  - `if (await getItem(PUSH_REGISTERED_FLAG_KEY)) return;`
- Flag is cleared only in `secureStore.clearAll()` (`apps/mobile/src/auth/secure-store.ts`), which runs on `signOut` / failed refresh — not on second boot while still authenticated.
- Plan required: clear on sign-out **and** on server-signalled revocation / re-register after hard revoke; success criteria: “second-boot re-registers”.

**Impact**
Dev device that remains signed in after deploying the cutover never POSTs a new FCM `deviceToken`. All server tokens stay revoked → permanent push blackout until explicit sign-out/sign-in (or storage wipe). This is exactly the F10 failure mode the phase was supposed to close.

**Fix**
One of:
1. Bump flag key (`pantry.pushRegisteredV2`) so old flags are ignored after cutover, or
2. Replace flag short-circuit with stored-token comparison against `messaging().getToken()`, or
3. Clear the flag whenever registration must be re-proved (app version / migration epoch / server 404 on delete / explicit re-register path), and still clear on sign-out.

Also wire `messaging().onTokenRefresh` to re-POST (currently absent).

---

### High Priority

#### H1. Circuit-breaker fallback swallows FCM outages; worker does not retry
**Evidence**
- `api/src/services/push/fcm-push.ts:54-58`
  - `fcmPushBreaker.fallback(() => [] as FcmPushResult[]);`
  - `sendFcmPush` returns breaker `fire()` result (empty array on open/timeout/fallback) instead of throwing.
- Worker only retries when `sendFcmPush` throws (`notification-send.ts:39-52`). On empty results it maps each token to synthetic `messaging/no-response` and logs `failed` without rethrow (`:55-77`).

**Impact**
Open circuit / timeout → every token for that job is permanently logged failed, job succeeds from BullMQ’s POV, no retry. Pre-existing Expo pattern, but now more dangerous because missing responses are explicit failed rows and operators may trust FCM logs. Transient FCM blips become lost expiry pushes.

**Fix**
- Do not use empty-array fallback for a queue worker, or
- Have `sendFcmPush` throw when breaker opens / fallback used, or
- In the worker, if `results.length !== tokens.length` (or all synthetic no-response after a non-partial provider error), rethrow after logging so BullMQ retries.

#### H2. Ownership check is non-atomic (TOCTOU) → unique violation / unclear 500
**Evidence**
- `repository.ts:17-42`: `findUnique` → branch → `create`/`update` without transaction or conflict handling.
- Concurrent dual-user submit of the same `deviceToken`: loser hits Prisma unique constraint rather than `PushTokenOwnershipError` → likely 500, not 409.
- Same-user concurrent first create can also race.

**Impact**
Cross-user silent takeover is fixed for sequential requests (good; covered by integration test). Concurrent path still fails closed poorly and is untested. Not the old data-exposure bug, but production flakiness / error-contract mismatch.

**Fix**
Use a transaction with `SELECT … FOR UPDATE` on the unique key, or catch Prisma `P2002` and re-check owner → 409 vs return existing row.

#### H3. `messaging/invalid-argument` treated as invalid token → possible mass revoke
**Evidence**
- `fcm-push.ts:61-65` revokes on:
  - `messaging/registration-token-not-registered`
  - `messaging/invalid-registration-token`
  - `messaging/invalid-argument`
- Worker unit mock intentionally omits `invalid-argument` (`workers-notification-send.test.ts:10-12`), so prod and test disagree.

**Impact**
`invalid-argument` is often a request/payload problem (not a dead device token). A bad multicast payload would revoke every token in the batch. Current payload values are strings today, so latent rather than immediate — still unsafe classification.

**Fix**
Revoke only on token-not-registered / invalid-registration-token. Treat `invalid-argument` as job/payload failure (log + throw/retry), and align the unit mock with production.

#### H4. Firebase credential fail-fast is incomplete for `workload_identity` (plan red-team-2 F2 partial)
**Evidence**
- `config.ts` requires `FIREBASE_PROJECT_ID`; validates file existence only when `FIREBASE_CREDENTIAL_MODE=service_account_file`.
- `fcm-push.ts` always uses `applicationDefault()` and never consumes `config.firebase.credentialsPath` / mode beyond projectId.
- Config unit tests only add env defaults; no negative cases for missing project id or missing SA file.

**Impact**
Misconfigured workload-identity / ADC still boots cleanly and fails on first send. Plan asked for boot fail-fast of the chosen credential mechanism. `service_account_file` path is validated but not actually used to initialize Admin SDK (ADC still required via env side effect).

**Fix**
- For `service_account_file`, initialize with `cert(credentialsPath)` (or set `GOOGLE_APPLICATION_CREDENTIALS` from validated path before init) and assert path at boot (already partially done).
- For `workload_identity`, document that ADC is environment-provided; optionally probe metadata/credentials at boot in production.
- Add config unit tests for both modes’ failure paths.

#### H5. Mobile “skip emulator” guard is wrong / incomplete
**Evidence**
- `registerPushToken.ts:9-11` comment claims emulator/simulator skip; code only returns when `Platform.OS === 'android' && Platform.isTV`.
- Previous Expo path used `Device.isDevice`.

**Impact**
Simulators/emulators still attempt FCM registration (noisy failures). Android TV is skipped for no product reason stated. Not a prod user-fleet bug, but incorrect control flow next to a hard cutover.

**Fix**
Restore a real device check appropriate for bare RN / RNFirebase, or drop the comment and document TV skip if intentional.

---

### Medium Priority

#### M1. No FCM token refresh / server-revocation client path
No `onTokenRefresh`, no DELETE `/me/push-token/:id` client usage after server revoke. Combined with sticky flag (C1), rotated FCM tokens never re-bind while signed in.

#### M2. Weak device-token schema vs “native FCM token validation”
`deviceTokenSchema` is min 20 / max 4096 / non-whitespace (`packages/shared/src/schemas/record.ts`). Accepts arbitrary strings, including old Expo token shapes if someone still sent them. Acceptable for hard cutover + server revoke, but not strong FCM validation. Shared dist copies do match source (`deviceToken` present, `expoPushToken` absent) — contract consistency is good.

#### M3. Test gaps
Missing / weak coverage:
- Worker behavior when breaker returns `[]` / partial length mismatch (H1).
- Concurrent cross-user token upsert (H2).
- Config fail-fast for Firebase modes (H4).
- Direct unit tests for `fcm-push.ts` (`isInvalidFcmTokenError`, init, response mapping).
- Mobile: re-register after sign-out is only proven at secure-store flag level; no `ensurePushTokenRegistered` test for flag short-circuit vs cleared flag / accessToken effect in `AppSyncManager`.
- Worker test relies on insertion order of `activeTokensForUser` without `orderBy` (correlation logic itself is order-safe on the in-memory array; assertion on `[TOKEN_A, TOKEN_B]` can flake).

#### M4. `serviceAccount.json.example` looks like a key file
Placeholder only, and `.gitignore` has `**/serviceAccount*.json` (does **not** match `*.json.example`, so the example can be committed). Safe if clearly fake; keep ensuring real `serviceAccount.json` never lands. No private material found in tracked examples beyond obvious placeholders.

#### M5. Scope hygiene note (informational)
Working tree contains large bare-RN migration churn beyond phase 8. Review limited to the listed push/FCM surface; other dirty files were not treated as phase-8 correctness evidence.

---

### Low Priority

#### L1. `PushTokenOwnershipError` does not set `Object.setPrototypeOf` / `name`
Fine for same-realm `instanceof`; minor consistency nit with some Error subclasses.

#### L2. Admin breaker rename `expo-push` → `fcm-push` is good; registration only happens when worker imports `fcm-push.ts`
Expected for worker process; API-only process still reports closed zeros via try/catch in `snapshotBreakers` — pre-existing pattern.

#### L3. No multicast chunking at 500 tokens
Dev-device distribution makes this YAGNI for now; note before multi-device users.

---

### Edge Cases Found by Scout
1. Signed-in upgrade after migration + sticky flag → never re-register (C1).
2. FCM token rotation while flag set → stale server token until sign-out (M1).
3. Breaker open → empty results → failed logs, no retry (H1).
4. Concurrent cross-user same token → Prisma unique error path (H2).
5. Payload-level `invalid-argument` → revoke-all if classified as token error (H3).
6. `activeTokensForUser` unordered — tests may flake on expected token order.
7. Residual Expo push symbols: none in live `api/src`, `apps/mobile/src`, `packages/shared/src` (historical migrations only).

---

### Checklist vs plan success criteria

| Criterion | Result |
| --- | --- |
| No live `expoPushToken` / `expo-server-sdk` / `ExponentPushToken` in api/shared/mobile src | Pass (scan clean) |
| Forward migration RENAME + unique index rename + revoke legacy | Pass (`RENAME COLUMN`, index rename, `revokedAt` stamp; not DROP/ADD) |
| Worker FCM send, id-correlated revoke, circuit-breaker preserved | Partial — correlation/revoke-by-id good; breaker fallback loses retries |
| Mobile native emission + flag clear on sign-out/revocation + second-boot re-register | Partial — emission + sign-out clear yes; revocation/second-boot while signed-in no |
| Shared dist refreshed; jest loads `deviceToken` | Pass (resolved mobile shared schema has `deviceToken`, no `expoPushToken`) |
| Config validates Firebase credential mechanism at boot | Partial — project id + SA file path only; ADC/workload not probed; SA path unused by init |
| Cross-user resubmission rejected + regression test | Pass for sequential path (`push-routes` 409 test) |
| RENAME not DROP/ADD | Pass |

---

### Positive Observations (risk calibration only)
- Hard cutover is source-consistent: shared register/response schemas, route, repository, worker, Prisma, and mobile API all use `deviceToken`.
- Migration is the correct pinned rename + revoke approach for dev-device-only distribution.
- F15-style correlation is fixed: no Expo pre-filter; `responses[i]` maps to `tokens[i]`; revoke uses `token.id`.
- Cross-user ownership takeover is closed for the sequential case with an explicit 409 contract.
- `expo-server-sdk` removed; `firebase-admin@13.5.0` added; admin breaker name updated and integration expectation updated.
- Sign-out clears `pantry.pushRegisteredV1`; dedicated secure-store test exists.
- `AppSyncManager` re-runs registration when `accessToken` becomes available.

---

### Recommended Actions
1. **Block merge of phase-8 push cutover until C1 is fixed** (flag epoch bump, current-token compare, or equivalent) so a still-signed-in device re-registers after hard revoke.
2. Fix H1: empty breaker fallback must not mark the job successful without retry.
3. Narrow invalid-token classification (H3) and align worker mock with production.
4. Make ownership upsert race-safe (H2); catch unique conflicts.
5. Complete credential wiring/tests (H4): either use `credentialsPath` for Admin init or document ADC-only and fail closed more honestly; add negative config tests.
6. Add worker tests for empty/partial results; add mobile registration tests for flag clear → re-register path.
7. Optional before real users: `onTokenRefresh`, multicast chunking, stronger token shape validation, dual-accept window note already in plan risk section.

---

### Metrics
- Type Coverage: not re-run in this review; implementer reports typecheck pass on api/shared/mobile — accepted as claimed, not re-verified here.
- Test Coverage (phase surface): route ownership + basic worker correlation covered; breaker/race/config-negative/mobile re-register gaps remain.
- Linting Issues: not re-run.
- Residual live Expo push refs in src: 0.

---

### Unresolved Questions
1. Is a one-time local sign-out after deploy an accepted manual step for the single dev device, or must second-boot without sign-out re-register? Plan text says second-boot; code requires sign-out.
2. Intended production credential mode: workload identity only, or service-account file on some hosts? `credentialsPath` is validated but unused by `initializeApp`.
3. Should Android TV really skip push, or was that an accidental stand-in for emulator detection?

---

### Review posture notes
- No code edits made.
- Plan TODO completion: implementation is substantially present but **not fully meeting** F2 (boot credential), F10 (re-register after revoke), and retry semantics under breaker fallback.
- Recommended plan status for lead/planner: keep phase 8 **pending / in remediation**, not complete, until C1 + H1 are addressed.

---

### Absolute report path
`/Users/lekiemdan/newapp/newapp/.claude/worktrees/agent-aa3333ba814f063a3/plans/reports/from-code-reviewer-fcm-hard-cutover-report.md`
