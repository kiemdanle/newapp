# Red-Team Plan Review — Failure Mode Analyst (Flow Tracer)

**Plan:** Mobile bare React Native migration and Expyrico visual consistency
**Reviewer role:** Hostile failure-mode analyst; verification lens = Flow Tracer (cross-phase operation ordering)
**Scope reviewed:** `plan.md`, `phase-01`…`phase-08`, verified against `apps/mobile`, `api`, `packages`, `.gitignore`, and project memory in the worktree.

Every finding below is backed by a grep/read against the actual worktree. No-evidence findings were dropped.

---

## Finding 1: Phase 4 emits a native FCM token into a field the schema still rejects — push registration is broken for the entire window between phase 4 and phase 5

- **Severity:** Critical
- **Location:** Phase 4, "Push (mobile side)" / step 6; Phase 5, "Overview" + step 2
- **Flaw:** Phase 4 converts the mobile client to acquire a native FCM token via `getToken()` and instructs it to "keep the wire field aligned for phase 5's atomic flip" — i.e. send the native token under the existing `expoPushToken` field (phase-04 line 39). But the shared validation regex that gates registration is `/^Expo(nent)?PushToken\[.+\]$/` and is not changed until phase 5 (phase-05 step 2). A native FCM token does not match that regex.
- **Failure scenario:** After phase 4 lands (its own commit, per the strictly-sequential 1→8 graph) and before phase 5, any credentialed build that calls `ensurePushTokenRegistered()` sends an FCM token string, the API validates it against the Expo regex, and rejects it with a validation error. Push registration is 100% broken for the whole inter-phase window. Phase 4's own success criterion only guarantees "no crash" when Firebase is *uninitialized* — it does not cover the initialized-but-rejected path, so the break passes phase-4 verification and surfaces only later.
- **Evidence:** `packages/shared/src/schemas/record.ts:115` (`z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, 'invalid Expo push token')`); `apps/mobile/src/features/push/registerPushToken.ts:22-26` (currently sends `expoPushToken: tokenData.data`); phase-04 line 39; phase-05 step 2.
- **Suggested fix:** Either (a) fold the mobile `getToken()` flip into phase 5's single commit and have phase 4 stop at wiring the FCM permission/token-acquisition plumbing behind a flag that still returns the Expo-format token (or does not register at all), or (b) relax the shared regex in phase 4 *before* the client starts emitting native tokens. State explicitly that phase 4 must not change the *value format* on the wire until the validator accepts it.

---

## Finding 2: The "atomic contract cutover" claim is false across the client/server boundary — manual APK distribution guarantees a push blackout window

- **Severity:** Critical
- **Location:** Phase 5, "Overview" ("single atomic contract cutover"); `plan.md` guiding constraints (line 45: "push-contract … cutovers commit atomically … no one-sided device-token contract in any single commit")
- **Flaw:** A single Git commit can atomically change db + shared + api + mobile *source*, but it cannot atomically change *running systems*. The API/DB migration is applied at deploy time and immediately revokes all legacy tokens (phase-05 step 1). The mobile side only takes effect once a new bare APK is built, and per the plan's own distribution model that APK is installed manually via `adb` ("distribution via local APKs", phase-04 line 33; whole-plan risk "distribution via local APKs"). There is no OTA/auto-update path (Expo Updates is being removed). So the server revokes every device's token the instant the migration runs, but no device sends a valid native token until its human operator rebuilds, `adb install -r`s, launches, and re-registers.
- **Failure scenario:** Migration runs → `revokedAt` set on all `push_tokens` rows → every expiry notification now has zero active tokens (`activeTokensForUser` returns empty, worker early-returns) → total push blackout until each device is manually reflashed. For any device not reflashed (or an old Expo APK still installed), push is silently dead forever with no error surfaced.
- **Evidence:** `api/prisma/schema.prisma:206` (`expoPushToken String @unique`); `api/src/workers/notification-send.ts:29-30` (`if (tokens.length === 0) return;`); phase-05 step 1 ("revokes all legacy tokens"); `plan.md:45`; phase-04 line 33 (manual APK distribution).
- **Suggested fix:** Drop the word "atomic" for the client/server contract; it is achievable only within source, not at runtime. Add an explicit forward-compatibility window: have the API accept *both* the legacy Expo token and the native token during a transition, revoke a legacy token only when the same device re-registers a native one, and document the operational sequence (deploy API that accepts both → reflash devices → later drop legacy acceptance). If a hard cutover is truly intended (single-developer dev device), state that assumption loudly and note that all other installs lose push.

---

## Finding 3: Phase 5's own mitigation for the shared-dist hazard is worded wrong — "two vendored dist copies" does not match reality and will re-trigger the stale-jest-schema failure

- **Severity:** High
- **Location:** Phase 5, "Related Code Files" note + Risk Assessment ("refresh both vendored dist copies")
- **Flaw:** The plan tells the executor to "refresh the two vendored dist copies per project memory." But the project memory (`shared-pkg-pnpm-store-drift`) says the two copies are **not both vendored**: copy (1) is the committed vendored copy at `apps/mobile/local-packages/@expyrico/shared/dist/`, and copy (2) is the pnpm virtual-store copy at `node_modules/.pnpm/@expyrico+shared@file+.../dist/` — the one jest actually resolves at runtime. On disk there is exactly **one** dist under `local-packages`. An executor who reads "two vendored dist copies" will look under `local-packages`, find one, assume they're done, and never touch the pnpm store copy.
- **Failure scenario:** Executor edits `record.ts` (Expo→native token), runs the shared build, copies into the single vendored dir, commits. Jest still resolves the *old* schema from the pnpm store, so `push-routes.test.ts` validates native tokens against the stale Expo regex. Tests go green against the wrong schema (or fail "mysteriously," exactly as the memory warns), and the contract cutover ships validated against nothing.
- **Evidence:** Only one dist exists: `find` returns solely `apps/mobile/local-packages/@expyrico/shared/dist/schemas/record.js`; no `.pnpm/@expyrico+shared*` copy present (root `node_modules` absent right now — "NO root node_modules"). Memory `shared-pkg-pnpm-store-drift` explicitly: copy (1) vendored/committed, copy (2) pnpm virtual store "that jest actually resolves." Plan wording: phase-05 line 42 + Risk Assessment.
- **Suggested fix:** Reword to name the two distinct locations from memory (committed vendored copy **and** the pnpm virtual-store copy), and add a concrete verification step: after refresh, assert jest loads the new schema (e.g. a token-shape assertion that would fail under the old regex). Also note root `node_modules` is currently absent, so a `pnpm install` must precede any jest run — sequence that before the dist refresh so the install doesn't clobber the store copy afterward.

---

## Finding 4: Phase 1 deletes theme families from `packages/theme` but never refreshes the vendored theme dist — the identical drift hazard, left uncovered

- **Severity:** High
- **Location:** Phase 1, "Related Code Files" (delete `packages/theme/src/themes/{bento,clay,material}.ts`, drop exports) + Success Criteria
- **Flaw:** `@expyrico/theme` is vendored into the mobile app exactly like `@expyrico/shared` (`.gitignore` negates `apps/mobile/local-packages/@expyrico/theme/dist/`). The same two-copy drift hazard from memory applies: after editing/rebuilding `packages/theme`, the committed vendored copy *and* the pnpm-store copy must both be refreshed. Phase 1 modifies `packages/theme/src/index.ts`/`tokens.ts` and deletes three theme files, but says nothing about re-vendoring the theme dist or refreshing the store copy. Its success-criteria grep scans *source*, not the vendored `dist`.
- **Failure scenario:** Phase 1 deletes `material.ts` from source and rebuilds, but the stale vendored `dist` (consumed by the APK) still exports `material`, or the pnpm-store `dist` (consumed by jest) still resolves the deleted export. Either the APK ships dead theme code the plan claims is gone, or downstream phases import a symbol that exists in source-of-truth but not in the copy the toolchain actually loads, producing confusing resolution failures three phases later.
- **Evidence:** `.gitignore:12-15` negates both `@expyrico/theme/dist/` and `@expyrico/shared/dist/**` (both packages are vendored); memory `shared-pkg-pnpm-store-drift` describes the mechanism generically ("the built dist must reach the mobile app through two copies"). Phase-01 "Related Code Files" and Success Criteria mention only source greps.
- **Suggested fix:** Add an explicit step to Phase 1: after editing `packages/theme`, rebuild and refresh **both** theme dist copies (vendored + pnpm store), and extend the success-criteria grep to include the vendored `dist` directories, not just `src`.

---

## Finding 5: The `pushRegisteredV1` flag survives `clearAll()`/sign-out and token revocation — clients silently never re-register

- **Severity:** High
- **Location:** Phase 5 (re-registration after legacy-token revocation) + Phase 8 verification ("logout cleanup")
- **Flaw:** `ensurePushTokenRegistered()` early-returns if `getItem('pantry.pushRegisteredV1')` is set, and sets that flag after a successful register. But `secureStore.clearAll()` (called on sign-out) deletes only `KEY_ACCESS`, `KEY_REFRESH`, and `KEY_THEME` — it does **not** delete the push-registered flag. So the flag is sticky across logout and across the phase-5 server-side token revocation. Nothing in the plan flags this: phase 5 assumes "clients must re-register," and phase 8 lists "logout cleanup" as a push check, but neither addresses the client-side gate that blocks re-registration.
- **Failure scenario:** (a) Phase 5 revokes all tokens server-side; the reflashed client boots, `pushRegisteredV1` is already `'1'` from before → `ensurePushTokenRegistered()` returns immediately → the device never sends its new native token → permanent silent push loss. (b) User A signs out, user B signs in on the same device; the flag persists → B's device is never registered, or A's now-revoked token association is never refreshed. Both pass a happy-path test that only exercises first-install.
- **Evidence:** `apps/mobile/src/features/push/registerPushToken.ts:7,11,27` (FLAG_KEY gate + set); `apps/mobile/src/auth/secure-store.ts:40-43` (`clearAll` deletes only access/refresh/theme, not the push flag); `apps/mobile/src/auth/session-store.ts:32` (`signOut` → `secureStore.clearAll()`).
- **Suggested fix:** Phase 4/5 must clear the push-registered flag on sign-out and on any server-signalled revocation, or drop the flag-based short-circuit in favor of comparing the currently-registered token. Add a phase-8 verification that a second sign-in / post-revocation boot actually re-registers, not just a first-install register.

---

## Finding 6: Ripping out `babel-preset-expo` and `jest-expo` (phase 6) is hand-waved — both carry load-bearing config for nativewind, reanimated, decorators, and pnpm resolution

- **Severity:** High
- **Location:** Phase 6, "Expo removal" step 4 ("Replace Babel/Jest/Metro Expo presets with standard RN equivalents")
- **Flaw:** This is one bullet, but the current config depends on Expo presets for non-trivial behavior. `babel.config.js` uses `babel-preset-expo` specifically for `{ jsxImportSource: 'nativewind' }` (the NativeWind JSX transform) and its reanimated auto-injection dance; the plugins list adds legacy decorators (WatermelonDB `@field`/`@date`) and the reanimated plugin conditionally. `jest.config.js` sets `preset: 'jest-expo'` and its comments state jest-expo "folds tsconfig paths into its resolver" and provides `transformIgnorePatterns` adapted for pnpm's non-flat `node_modules`. The stock `@react-native/babel-preset` provides none of the NativeWind JSX wiring, and dropping jest-expo's resolver/transformIgnorePatterns will break module resolution for the pnpm layout.
- **Failure scenario:** Swapping presets 1:1 silently drops the NativeWind `jsxImportSource` → every `className` style renders unstyled (or throws), and reanimated auto-injection ordering changes. On the test side, losing jest-expo's pnpm-aware `transformIgnorePatterns` makes Jest try to run untransformed ESM from `node_modules/.pnpm/...` → the entire mobile test suite fails to load. Phase 6 verifies "Android boots" and "xcodebuild compiles," which won't catch broken NativeWind styling or a dead Jest resolver.
- **Evidence:** `apps/mobile/babel.config.js:10` (`['babel-preset-expo', { jsxImportSource: 'nativewind', reanimated: !isTest }]`), plugins for `@babel/plugin-proposal-decorators` + `react-native-reanimated/plugin`; `apps/mobile/package.json:49` (`nativewind`), `:56` (`react-native-reanimated`), `:78` (`babel-preset-expo`), `:84` (`jest-expo`); `apps/mobile/jest.config.js:15,27` (preset + pnpm transformIgnorePatterns comments).
- **Suggested fix:** Break step 4 into explicit sub-steps: replace `babel-preset-expo` with `@react-native/babel-preset` **plus** `nativewind/babel` re-wired for the JSX transform and reanimated plugin ordering; replace `jest-expo` with `@react-native/js-preset` (or RN's jest preset) and hand-author the pnpm-aware `transformIgnorePatterns` + moduleNameMapper that jest-expo was providing. Add a success criterion that a NativeWind-styled screen renders and the full mobile Jest suite loads.

---

## Finding 7: Worker result→token alignment does not exist today; phase 5's "revoke unregistered token" requires new correlation logic the plan doesn't specify

- **Severity:** Medium
- **Location:** Phase 5, worker rewrite (step 4) + Success Criteria ("writes per-device results, revokes invalid/unregistered tokens")
- **Flaw:** The current worker builds messages from `tokens`, but `sendPush()` pre-filters to only Expo-valid tokens (`valid = messages.filter(Expo.isExpoPushToken)`), returning tickets for the filtered subset only. The success-path loop then iterates `tickets.length` and writes `pushLog` rows that reference `ticket.id`/`ticket.message` but **never** associate a ticket back to its originating token row. So there is currently no ticket↔token identity at all. Phase 5 wants to *add* per-device revocation ("revoke on unregistered/invalid-argument") but "preserve circuit-breaker behavior" — inheriting a result loop that has no token identity means any index-based revocation will target the wrong token whenever the response set is shorter or reordered relative to the input tokens.
- **Failure scenario:** With Firebase's `sendEachForMulticast`, responses come back positionally per input token — clean *only if* the code does not pre-filter and iterates the full token list in lockstep. If the executor mirrors the existing filter-then-index pattern, a rejected response at index `i` revokes `tokens[i]` where `tokens` was already filtered → the wrong (still-valid) token is revoked, and the actually-dead token lives on. Data-correctness bug in revocation that a mocked happy-path test won't catch.
- **Evidence:** `api/src/services/push/expo-push.ts:23` (`const valid = messages.filter((m) => Expo.isExpoPushToken(...))`); `api/src/workers/notification-send.ts:32-56` (messages mapped from `tokens`, success loop iterates `tickets` and writes `ticket.id`/`ticket.message` with no back-reference to the token row).
- **Suggested fix:** Phase 5 must specify the exact token↔response correlation: send with `sendEachForMulticast` over the *unfiltered* token array and map `responses[i] → tokens[i].id`, revoking by token id (not index into a filtered subset). Call out that the existing no-correlation loop must be replaced, not "preserved."

---

## Finding 8: Phase 4's splash rewrite risks regressing the splash-lifecycle fixes that just landed in the last three commits

- **Severity:** Medium
- **Location:** Phase 4, "Splash" (step 3) — replace `expo-splash-screen` with native launch screen + in-app bootstrap overlay
- **Flaw:** The current `app/_layout.tsx` splash handling was deliberately hardened in the three most recent commits (`e8b17e4` dismiss splash after hydration, `f74c945` handle splash lifecycle failures, `ef7b5ac` merge). That code guards `SplashScreen.preventAutoHideAsync().catch(...)`, gates dismissal on `themeHydrated && sessionHydrated`, dismisses via `SplashScreen.hideAsync().catch(...)`, and routes boot failures into `setBootError`. Phase 4 rewrites all of this ("wire dismissal to hydration completion") but never references the specific failure-handling behavior that was just fixed, so the rewrite is likely to reintroduce the exact race/exception the last commits closed.
- **Failure scenario:** New native-launch-screen + overlay implementation dismisses on a single hydration signal or without the `.catch` guards → if theme or session hydration rejects, the overlay never dismisses (permanent stuck splash) or an unhandled rejection crashes bootstrap — the precise regressions `f74c945`/`e8b17e4` fixed.
- **Evidence:** `apps/mobile/app/_layout.tsx:20` (`import * as SplashScreen from 'expo-splash-screen'`), `:31` (`preventAutoHideAsync().catch`), `:37-38` (`themeHydrated`/`sessionHydrated`), `:44` (`Promise.all([...]).catch(setBootError)`), `:51` (`hideAsync().catch`); git log `e8b17e4`, `f74c945`, `ef7b5ac`.
- **Suggested fix:** Phase 4 should enumerate the invariants the recent fixes established (dismiss only after *both* hydrations, swallow splash API rejections, surface boot errors instead of hanging) and require the bare replacement to preserve each, with a test for the hydration-rejection path.

---

## Finding 9: Phase 1's zero-import success grep for `material` is unreliable in a food/pantry domain and will not gate deletion cleanly

- **Severity:** Medium
- **Location:** Phase 1, Success Criteria (`grep -rn "bento\|clay\|material\|BentoTile\|..." apps/mobile packages/theme`)
- **Flaw:** `material` is a high-frequency substring in both a UI context (Material Design, MD3, `@react-navigation/*` internals) and a food/pantry domain ("raw material," ingredient/material naming). Using it as a live-import gate produces false positives that either mask a real residual import or force the executor to hand-triage noise, defeating the "returns only historical/doc hits" criterion. The gate that authorizes deleting `material.ts` is therefore not trustworthy as written.
- **Failure scenario:** Grep returns dozens of `material` hits from unrelated domain/library text; the executor either (a) declares them "historical" and deletes `material.ts` while a real `themes/material` import still exists elsewhere, breaking the build, or (b) burns time triaging noise and still can't prove zero imports.
- **Evidence:** Success-criteria command in phase-01 line 49 (`grep -rn "bento\|clay\|material\|..."`); the domain is a pantry/expiry app (CLAUDE.md brand + `notification-send.ts` "expiry" content), where "material" collides with domain vocabulary.
- **Suggested fix:** Gate on precise import specifiers, not bare words — e.g. `grep -rn "themes/material\|from '@expyrico/theme'.*material\|MD3\|BentoTile\|ClayButton\|ClayCard\|GlassCard"` and enumerate the exact export identifiers being removed. Verify against the actual export list in `packages/theme/src/index.ts` rather than a substring sweep.

---

## Cross-phase flow summary

The plan's linear 1→8 graph is internally consistent on *source dependencies* but has three real ordering/atomicity breaks a Flow Tracer must flag:

1. **Phase 4 produces a value (native token) that phase 5's validator only later accepts** → broken push-registration window (Finding 1).
2. **"Atomic contract cutover" conflates commit-atomicity with runtime-atomicity** across a manually-distributed client → guaranteed push blackout (Finding 2).
3. **The vendored-dist refresh discipline is both mis-worded (phase 5, Finding 3) and entirely omitted for theme (phase 1, Finding 4)** → the toolchain silently runs against stale copies, so the very tests meant to gate the cutover validate the wrong schema/theme.

Findings 5–9 are correctness/regression hazards that pass happy-path CI but break in production or in the reviewer's own verification gate.

---

Status: DONE_WITH_CONCERNS — 9 evidence-backed findings; 2 Critical (phase 4→5 token-format ordering break; non-atomic client/server cutover causing push blackout), 3 High (mis-worded shared-dist mitigation, omitted theme-dist refresh, sticky push-registration flag), 4 Medium.
