# Red-Team Security Adversary Review — Bare RN Migration Plan

**Reviewer role:** Security adversary / fact checker
**Plan:** `plans/260714-0728-mobile-bare-rn-migration/` (plan.md + phase-01..08)
**Verdict:** 7 findings — 1 Critical, 3 High, 3 Medium. All grep-verified against the worktree.

Fact-check of the plan's own claims: schema `expoPushToken @unique` at `api/prisma/schema.prisma:206` ✅; shared regex at `packages/shared/src/schemas/record.ts:115` ✅; root CLI pinned `13.6.9` (`package.json:24-25`) ✅; `expo-server-sdk ^6.1.0` in `api/package.json:37` ✅; `main: "expo-router/entry"` (`apps/mobile/package.json:5`) ✅; no `apps/mobile/ios/` host ✅; Android host files present ✅. The plan's factual base is accurate. The findings below are about what the plan does NOT protect against.

---

## Finding 1: No .gitignore coverage for native signing keys, google-services.json, or Firebase service accounts

- **Severity:** Critical
- **Location:** Phase 2, "Implementation Steps" step 3 ("real Firebase/Google/passkey config uses ignored local files"); Phase 5, "Requirements" non-functional ("credentials via untracked Firebase platform config"); Phase 6, "iOS host" (generates entitlements, Podfile, Google URL scheme).
- **Flaw:** The plan repeatedly leans on "untracked/ignored local files" for all native secrets, but the repo's ignore rules cover only dotenv files. There is no pattern for `google-services.json`, `GoogleService-Info.plist`, `*.keystore`, `*.jks`, `*.p8`, `*.p12`, or a Firebase Admin `serviceAccount*.json`. Nothing mechanically prevents committing them. Phase 2/5/6 introduce every one of these artifact types.
- **Failure scenario:** A developer runs the RN Firebase setup, drops `google-services.json` and `GoogleService-Info.plist` into `apps/mobile/android/app/` and `apps/mobile/ios/`, generates a release `upload.keystore`, and places the Firebase Admin service-account JSON next to the API. `git add -A` stages all of them; none are ignored. FCM server keys, the signing keystore, and a full GCP service-account private key land in git history — a supply-chain compromise (app can be re-signed/impersonated; Admin SDK grants project-wide send + potential IAM reach).
- **Evidence:** `.gitignore:18-22` (only `.env`, `.env.local`, `.env.*.local`, `!.env.example`, `!.env.test.example`); `apps/mobile/.gitignore:5` (only `expo-env.d.ts`); no keystore/`google-services`/`GoogleService-Info`/`.p8`/`.p12`/`serviceAccount` pattern anywhere (grep returned zero matches). Artifacts introduced by Phase 6:32 (`apps/mobile/ios/** … entitlements`) and Phase 2:52 ("real Firebase/Google/passkey config uses ignored local files").
- **Suggested fix:** Make Phase 2 add the ignore patterns FIRST, before any native config is generated: `*.keystore`, `*.jks`, `*.p8`, `*.p12`, `**/google-services.json`, `**/GoogleService-Info.plist`, `**/serviceAccount*.json`, plus a committed `.example`/README for each. Add a success-criteria checkbox: "secret-file ignore patterns exist and `git check-ignore` confirms them" as a Phase 2 gate.

---

## Finding 2: Firebase Admin credentials (ADC) are never modeled in the API's fail-fast config; "untracked platform config" is undefined

- **Severity:** High
- **Location:** Phase 5, "Requirements" non-functional and step 3 ("Rewrite the API sender over Firebase Admin (ADC + untracked platform config)").
- **Flaw:** The API validates all env at startup and fails fast (project security mandate + existing `config.ts` zod schema). The plan adds `firebase-admin` but never adds a config entry for how credentials are supplied. "Application Default Credentials" resolves silently from `GOOGLE_APPLICATION_CREDENTIALS` (a file path to a private key on disk) or a metadata server — the plan picks neither and validates neither. There is no schema entry, no fail-fast check, and no statement of whether prod uses workload identity vs a mounted key file.
- **Failure scenario:** Prod deploys with no ADC configured. `firebase-admin` initialization defers, then every push send throws at runtime instead of at boot — the exact opposite of the codebase's fail-fast contract. Or an operator sets `GOOGLE_APPLICATION_CREDENTIALS=/app/serviceAccount.json` and copies that key into the image layer / repo (see Finding 1, which would not ignore it). The credential lifecycle is completely unspecified for the one component holding project-wide send authority.
- **Evidence:** `api/src/config.ts:37-39` validates `WEBAUTHN_RP_ID/RP_NAME/ORIGIN` (pattern the plan should follow); grep for `firebase|GOOGLE_APPLICATION|serviceAccount|ADC` in `api/src/config.ts` returns nothing — no credential path is modeled. Plan Phase 5:18,48 assert ADC without a config schema change in "Related Code Files" (Phase 5:37-42 lists no `config.ts` edit).
- **Suggested fix:** Add `config.ts` handling to Phase 5: validate the chosen credential mechanism at startup (e.g. require `GOOGLE_APPLICATION_CREDENTIALS` path to exist, or explicitly declare workload-identity-only and assert `FIREBASE_PROJECT_ID`). State the prod mechanism. Add a success criterion: "API fails fast at boot if Firebase credentials are absent, rather than throwing per-send."

---

## Finding 3: Push-token upsert reassigns ownership by token value — notification/token takeover carried forward unchanged

- **Severity:** High
- **Location:** Phase 5, step 3 ("Update repository + route field names") — the plan renames fields but preserves the existing upsert semantics.
- **Flaw:** `upsertPushToken` keys the upsert on the token itself (`where: { expoPushToken }`) and, on conflict, overwrites `userId` with the caller's id and clears `revokedAt`. Any authenticated user who submits a token string that already exists in the table silently steals that row: it is reassigned to them and reactivated. Phase 5 renames this to `deviceToken` but does not change the ownership logic, so the flaw migrates verbatim into the FCM contract.
- **Failure scenario:** User A's device token is observed (shared device, log leak, MITM on a misconfigured client, or a revoked token A previously used). User B POSTs it to `/me/push-token`. The row's `userId` flips to B and `revokedAt` is nulled. Now A's expiry notifications route to B's device (data exposure: A's item names/expiry leak to B), and A stops receiving their own. Also self-abuse: a logged-out revoked token can be resurrected by re-POSTing.
- **Evidence:** `api/src/services/push/repository.ts:11-26` — `where: { expoPushToken: input.expoPushToken }`, `update: { userId: input.userId, …, revokedAt: null }`. Route accepts it under `requireAuth` only (`api/src/routes/me/push-token.ts:10-27`) with no check that the token isn't already owned by someone else.
- **Suggested fix:** Add to Phase 5: on upsert conflict where the existing row's `userId` differs from the caller, treat it as a new-owner rotation only after revoking/detaching the prior owner's binding, or reject. Bind tokens to the authenticated user and never silently transfer. Add a regression test for cross-user token resubmission.

---

## Finding 4: Passkey RP domain has a `localhost` default and no mobile↔API consistency check before shipping Associated Domains

- **Severity:** High
- **Location:** Phase 6, "iOS host" ("Associated Domains entitlement uses the production WebAuthn RP domain … AASA must list `<APPLE_TEAM_ID>.com.expyrico.app`").
- **Flaw:** The mobile RP id resolves from env with a hard `'localhost'` fallback, and the API's `WEBAUTHN_RP_ID` is a separate, independently-validated source of truth. The plan asserts the iOS entitlement should use "the production WebAuthn RP domain" and documents AASA as external/not-committed, but adds no step to verify the three values agree (mobile `passkeyRpId` == API `WEBAUTHN_RP_ID` == Associated Domains host == AASA `webcredentials.apps` entry). WebAuthn is unforgiving about RP-id mismatch.
- **Failure scenario:** iOS host ships with the env unset, so `passkeyRpId` falls back to `'localhost'` while the API enforces `expectedRPID = <prod domain>`. Every passkey registration/assertion is rejected by the API (`expectedRPID` mismatch), locking users out of passkey auth on iOS — or, if the entitlement domain is set but AASA isn't published, iOS silently refuses to offer the credential. Either way passkey auth is dead on arrival with no build-time signal.
- **Evidence:** `apps/mobile/app.config.ts:67` `passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? 'localhost'`; `apps/mobile/eas.json:14` (`'localhost'`), `:26,:36` (`FILL_ME_PASSKEY_RP_DOMAIN`); API side `api/src/config.ts:37` `WEBAUTHN_RP_ID` and `api/src/services/auth/passkey.ts:61,105` `expectedRPID: cfg.webauthn.rpId`. Phase 6:26 references the entitlement/AASA requirement but Phase 6 success criteria (Phase 6:47-50) never assert RP-id agreement.
- **Suggested fix:** Add a Phase 6 gate: fail the build (or a preflight script) if the resolved mobile RP id is `localhost`/empty, and document that mobile RP id, API `WEBAUTHN_RP_ID`, iOS Associated Domain, and published AASA must be identical. Remove the `'localhost'` production fallback in favor of an explicit required value.

---

## Finding 5: Destructive migration revokes every legacy token — fleet-wide push outage with no rollout/rollback plan

- **Severity:** Medium
- **Location:** Phase 5, step 1 and Risk Assessment ("forward migration revokes legacy tokens intentionally"); Success Criteria ("revokes legacy tokens").
- **Flaw:** The migration is validated "on a disposable local DB only" but will eventually run against production, where it revokes 100% of existing push tokens in one shot. The plan has no staged rollout, no coexistence window, and no rollback path (Expo-format tokens can no longer be represented once the shared regex flips to FCM validation). Column rename via Prisma also risks a drop/recreate depending on how the migration is authored — the plan says "rename" but does not pin the SQL, and a generated `DROP COLUMN`/`ADD COLUMN` would destroy data rather than rename.
- **Failure scenario:** Migration deploys to prod. Every user's push stops until they next foreground the app and re-register via the new FCM path — but the phase-4 client guard makes registration a no-op when Firebase is uninitialized, so any user on a build without valid Firebase config never re-registers. Expiry notifications (the app's core value) go dark for the installed base with no gradual recovery and no way back.
- **Evidence:** `api/prisma/schema.prisma:206` `expoPushToken String @unique` (the `@unique` the migration must preserve while renaming); Phase 5:46 ("renames the column and revokes all legacy tokens"), Phase 5:56 (`prisma migrate` "on a disposable local DB"), Phase 5:65 ("never a live-looking API"). No production rollout step in Phase 5 or Phase 8.
- **Suggested fix:** Author the migration as an explicit SQL `RENAME COLUMN` (assert, don't trust generator) and confirm no `DROP`. Add a documented prod rollout: deploy client with FCM re-registration first, allow a coexistence window, then revoke. Note the client-side no-op guard interaction so revoked users can actually recover.

---

## Finding 6: react-native-config values are embedded in the APK — plan treats them as "config," losing the public/secret boundary

- **Severity:** Medium
- **Location:** Phase 2, step 3 ("Wire `react-native-config` with `ENVFILE` … Document that real Firebase/Google/passkey config uses ignored local files").
- **Flaw:** `react-native-config` bakes every key into the native binary and JS bundle; anything in the `ENVFILE` is trivially extractable from a shipped APK (`apktool`/`strings`). Today the codebase signals public-ness via the `EXPO_PUBLIC_` prefix. Migrating to `react-native-config` drops that naming convention, so a developer may put a genuine secret (a signing token, an API secret, a Firebase Admin key) into the `ENVFILE` believing it is "just config." The plan says config lives in ignored files (good for git) but never states these values are PUBLIC-in-the-binary and must never hold secrets. Additionally, missing keys resolve to empty strings silently.
- **Failure scenario:** Someone adds a sensitive key to the local `ENVFILE`; it is git-ignored (so it feels safe) but ships inside the release APK and is extracted by anyone with the binary. Separately, an unset `googleWebClientId`/`googleIosClientId` becomes `""` at runtime, breaking Google sign-in with no build error (the current code already defaults these to `''`).
- **Evidence:** `apps/mobile/app.config.ts:65-66` `googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''`, `:67` passkey default `'localhost'` — the `?? ''` / `?? 'localhost'` pattern silently swallows missing config. Phase 2:52 documents ignored files but not the in-binary exposure. Plan constraint (`plan.md:47`) mentions `.invalid` host for `.env.example` but not the general "no secrets in ENVFILE, it ships in the APK" rule.
- **Suggested fix:** Phase 2 should state explicitly: `react-native-config` values are compiled into the distributable and are non-secret by definition; secrets (Admin keys, signing material) never go in the `ENVFILE`. Add a preflight that fails when a required public key resolves empty, rather than defaulting to `''`.

---

## Finding 7: `expyrico://` custom-scheme deep link is spoofable; referral code is untrusted input crossing a trust boundary

- **Severity:** Medium
- **Location:** Phase 3, "Requirements" and step 4 ("validate + capture referral code on cold start and while running; other links not advertised"); Phase 6 handles URL schemes.
- **Flaw:** A custom URI scheme (`expyrico://invite?code=...`) can be invoked by any app or webpage on the device — unlike verified Android App Links / iOS Universal Links, there is no domain-ownership check. The plan says the handler "validates" the URL but scopes validation to URL shape ("validated referral URL handler"), not to the trust status of the code. The `code` is attacker-controllable external input that flows into referral logic.
- **Failure scenario:** A malicious app or ad fires `expyrico://invite?code=<crafted>` at the Expyrico app. If the client auto-applies the code (auto-join a household / auto-attribute a referral) without server-side authorization and idempotency, an attacker can force victims into attacker-controlled referral relationships or households, or spam referral credit. Custom-scheme links also enable this at cold start before the user is even oriented.
- **Evidence:** Referral base URL handling exists at `api/src/services/referrals/repository.ts:7` (`https://expyrico.app`), and the mobile scheme is `Expyrico` (`apps/mobile/app.config.ts:7`); Phase 3:17,54 advertise only `expyrico://invite?code=...` and describe URL-shape validation, with no statement that the referral code is treated as untrusted and authorized/validated server-side before any state change.
- **Suggested fix:** Phase 3 should specify: the deep-link handler only *captures* the code and defers all effect to an authenticated, server-validated, idempotent action (never auto-join on cold start). Prefer verified App Links/Universal Links over (or in addition to) the custom scheme so origin can be trusted. Add a test for a hostile invite payload.

---

## Finding 8: Google Sign-In native OAuth config is Expo-plugin-injected and absent from the entire plan — auth path breaks silently on host regeneration

- **Severity:** High
- **Location:** Phase 2, "Architecture" dependency table (lists Apple sign-in, omits Google); Phase 4, "Architecture" capability table (lists Apple auth, omits Google); Phase 6, "iOS host" (wires "Google URL scheme from external build config" but never accounts for the `@react-native-google-signin/google-signin` package or its Android config).
- **Flaw:** `@react-native-google-signin/google-signin@^13.1.0` is a live auth dependency, but it is not an `expo-*` package, so the plan's expo-scoped audit missed it. Its native configuration — the iOS reversed-client `iosUrlScheme`, and `googleWebClientId`/`googleIosClientId` — is injected today by an Expo config plugin in `app.config.ts`. Phase 6 deletes `app.config.ts` and regenerates both hosts, dropping that plugin. The plan mentions "Google URL scheme from external build config" in one iOS bullet but never lists the Google Sign-In package in any dependency/capability table, never addresses the Android side (`google-services.json` OAuth client), and never adds a config-consistency check. Google OAuth is a full authentication boundary.
- **Failure scenario:** Phase 6 regenerates the iOS host without re-adding the reversed-client URL scheme to `Info.plist`, and the client IDs (which default to `''` in code) are never wired into `react-native-config`. Google Sign-In either throws on invoke or, worse, silently initializes with an empty/placeholder client ID (`com.googleusercontent.apps.PLACEHOLDER` is literally in the config today) — the OAuth callback never returns, or returns a token minted for the wrong client that the API rejects. An entire sign-in method is dead on the regenerated hosts, discovered only at manual QA. This is the same class of gap as the passkey RP-id issue (Finding 4) but for a second auth provider the plan never names.
- **Evidence:** `apps/mobile/package.json:29` `"@react-native-google-signin/google-signin": "^13.1.0"`; `apps/mobile/app.config.ts:57-58` (Expo plugin `'@react-native-google-signin/google-signin'` with `iosUrlScheme: 'com.googleusercontent.apps.PLACEHOLDER'`), `:65-66` (`googleWebClientId`/`googleIosClientId` default to `''`); Phase 2 dep table (phase-02:24-37) and Phase 4 capability table (phase-04:22-33) contain no Google Sign-In row; grep of all phase files for `google-signin`/`google sign` returns zero hits (matches appear only in review reports).
- **Suggested fix:** Add Google Sign-In to Phase 2's dependency table and Phase 4's capability list explicitly. In Phase 6, specify reconstruction of the reversed-client URL scheme (iOS `Info.plist`) and the Android OAuth client from `google-services.json`, wire real `googleWebClientId`/`googleIosClientId` through non-secret `react-native-config`, and add a success criterion that Google sign-in completes on a regenerated host. Remove the `?? ''` client-id fallback so a missing value fails loudly.

---

Status: DONE_WITH_CONCERNS — Plan's factual claims verified accurate, but secret-handling for native/Firebase artifacts is unprotected (Critical: no .gitignore coverage), the Firebase Admin credential lifecycle is unspecified, the existing push-token ownership-reassignment defect is migrated forward unchanged, and two auth boundaries (passkey RP-id, Google Sign-In native config) lack consistency gates across the host regeneration.
