---
title: "Mobile bare React Native migration and Expyrico visual consistency"
description: "Remove Expo from apps/mobile and the API push path, move to bare React Native 0.76.9 with React Navigation and Firebase Cloud Messaging, and finish the single Expyrico visual system across every mobile route. Restructured after red-team review into 13 reviewable phases; push uses a hard cutover (dev-device distribution, validated) with full native-module coverage."
status: pending
priority: P1
branch: "codex/mobile-no-expo-plan"
tags: [mobile, react-native, expo-removal, fcm, theme, expyrico]
blockedBy: []
blocks: []
created: "2026-07-14T07:28:55.016Z"
createdBy: "ck:plan"
source: skill
---

# Mobile bare React Native migration and Expyrico visual consistency

## Overview

This plan unifies two design specs into one executable sequence because they edit the same route/screen files and the migration spec assumes the visual redesign already exists:

- `docs/superpowers/specs/2026-07-14-mobile-bare-react-native-migration-design.md`
- `docs/superpowers/specs/2026-07-14-mobile-expyrico-consistency-design.md`

Goal: remove Expo completely from the Expyrico runtime (`apps/mobile`) and from the API push path, keeping a single React Native 0.76.9 codebase that builds Android release APKs with local Gradle, installs/tests through `adb`, delivers push through Firebase Cloud Messaging, and presents one responsive Expyrico visual system (System/Light/Dark only). Every API contract is preserved except the push-token fields, which change for native FCM delivery.

**Sequencing decision (user-approved): direct cutover.** After Phase 2 began, the user confirmed they do not use Expo and directed a full Expo removal now. The remaining phases are collapsed into a single cutover: baseline deps + Android/iOS host de-Expo + Expo removal + React Navigation + capability swaps + visual system + verification.

**This plan was restructured after a 4-reviewer red-team.** The original 8-phase draft was over-structured at the cheap end (theme cleanup gated everything) and dangerously under-decomposed at the expensive end (one 35-file atomic navigation commit, 8 capability swaps in one phase, 53 files restyled under one gate) — and it missed live build/native dependencies (NativeWind, WatermelonDB, ML Kit OCR), the deeper Android Gradle de-Expo, Android/iOS native auth wiring, and a runtime-atomicity fallacy in the push cutover. The 13-phase structure below was the corrected version; after the Expo pivot, it is being executed as a collapsed sequence. See `## Red Team Review`.

### Validation findings (verified against the worktree)

| Spec claim | Ground truth in code | Action |
|---|---|---|
| Expo is pervasive | `apps/mobile/package.json` `main: "expo-router/entry"`, `expo ~52.0.49` + 15 `expo-*` packages; 44 source files import `expo*` | Phases 3–11 |
| Push uses Expo Push | `api/prisma/schema.prisma:206` `expoPushToken @unique`; `expo-server-sdk`; `expo-push.ts`, `notification-send.ts`, `shared/schemas/record.ts:115` regex, `registerPushToken.ts` | Phase 8 |
| No iOS host | `apps/mobile/ios/` absent | Generate in phase 10 |
| Android host Expo-wrapped | `MainActivity.kt` + `MainApplication.kt`; `settings.gradle:16-17` `useExpoModules()`; `build.gradle:12` `entryFile = expo-router/entry.js` | Phase 9 |
| Filesystem router | 31 route components + 4 layouts under `app/` | Phases 3–5 |
| 4 theme families exist | `packages/theme/src/themes/`: bento, clay, expyrico, material; `tokens.ts:4` `ThemeId`; `sync.ts:7` `SERVER_THEME_IDS` | Phase 1 |
| Root CLI is 15.x (spec) | **`package.json` pins `@react-native-community/cli@13.6.9`** — mismatch | Phase 2 |
| Theme already constrained | `src/theme/store.ts:12` `VALID_IDS=['system','expyrico','expyricoDark']` already set; `settings/theme.tsx` copy + `settings/index.tsx:55` `material` branch lag | Phase 1 (cleanup, not a gate) |
| Two "missing" settings screens | `settings/index.tsx` links `/(app)/settings/notifications` + `.../account`; only `index`, `theme`, `add-passkey` exist | Phase 3 |
| **NativeWind is live** | `babel.config.js:10` `jsxImportSource: 'nativewind'` + `nativewind/babel`; `metro.config.js:2` `withNativeWind`; **0 `className=` usages** | Phase 1 decides keep+rewire vs drop |
| **WatermelonDB native module** | `@nozbe/watermelondb` in 7 files; `babel.config.js:14` legacy decorators | Phases 2, 9, 10 |
| **OCR second camera** | `src/features/expiry/OcrCamera.tsx` uses `expo-camera` `CameraView` + `@react-native-ml-kit/text-recognition` | Phase 7 |
| **Google/passkey native wiring** | `app.config.ts:56-58` google-signin plugin `iosUrlScheme`; `:67` `passkeyRpId`; `src/auth/google.ts`, `src/auth/passkey.ts` active | Phases 9, 10 |

### Guiding constraints (from both specs, corrected by red-team)

- No `expo`, `expo-*`, `@expo/*`, `babel-preset-expo`, or `jest-expo` in `apps/mobile/package.json`; no Expo push SDK in `api/package.json`.
- **Navigation cutover** commits atomically only as a *small final flip* (phase 5) after additive scaffolding (phase 3) and batched ports (phase 4).
- **Push cutover is a hard cutover** (validation decision 2026-07-14: distribution is dev/test device(s) only — no installed-user fleet to protect). The forward migration renames the token field and revokes legacy tokens; the dev device re-registers a native token on next launch. The dual-accept transition the red-team required (F2/F3) is unnecessary here because there is no fleet to blackout; if the app later ships to real users, reintroduce a dual-accept window before mass-revoking.
- App-owned external content deep link is only `Expyrico://invite?code=...` (canonical capitalized scheme, validation decision). The Google OAuth callback scheme and the iOS/Android passkey associated-domain are additional OS-routed handlers that MUST be preserved — they are not "extra deep links" to advertise but must not be dropped.
- Native builds select config through `ENVFILE`; `.env.example` is non-secret with a reserved `.invalid` host. No credentials committed. Data-mutating acceptance tests run only against disposable/approved-non-prod services.
- Palette and semantic assignments unchanged (Fresh Sage=Good, Honey=Expiring + single primary action, Alert Red=Expired/destructive only). `packages/theme/src/palette.ts` is source of truth.
- **Vendored-dist discipline:** `@expyrico/shared` AND `@expyrico/theme` are vendored into the mobile app. After editing either package, refresh BOTH the committed vendored `dist/` and the pnpm virtual-store copy that jest resolves (see memory `shared-pkg-pnpm-store-drift`), and assert the toolchain loads the new build.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Foundation cleanup: theme, dead variants, NativeWind decision](./phase-01-foundation-cleanup.md) | Completed |
| 2 | [Bare baseline + Android host de-Expo + Expo removal (direct cutover)](./phase-02-baseline-deps-and-native-config.md) | Completed |
| 3 | [iOS host generation and iOS auth wiring](./phase-10-ios-host-and-auth.md) | Blocked — Xcode 26.5 + RN 0.76 modulemap/Foundation compile |
| 4 | [React Navigation scaffold and route ports](./phase-03-navigation-scaffolding.md) | Completed |
| 5 | [Capability swaps: storage, splash, status bar, camera, OCR, push, auth, linking, icons](./phase-06-storage-splash-statusbar.md) | Completed — FCM hard cutover landed |
| 6 | [Apply Expyrico visual system (batched)](./phase-12-apply-visual-system.md) | Completed |
| 7 | [Docs cleanup and full verification](./phase-13-docs-and-verification.md) | Completed — adb device + iOS compile external |

_Original phases 7–11 are folded into the collapsed sequence above after the Expo pivot._

## Phase dependency graph

```
1 ─▶ 2 ─▶ 3 ─▶ 4 ─▶ 5 ─▶ 6 ─▶ 7 ─▶ 8 ─▶ 9 ─▶ 10 ─▶ 11 ─▶ 12 ─▶ 13
                          └──── 6 & 7 both depend on 5; 8 depends on 7 (mobile FCM) ────┘
```

Mostly sequential. Real edges: 2 needs 1's cleanup settled; 3–5 are the navigation build→port→flip chain; 6 and 7 (capabilities) need the final screen tree from 5; 8 needs the FCM plumbing from 7; 9/10 (hosts) remove Expo host wiring only after 3–8 eliminate the last JS imports; 11 purges Expo packages/presets after 9/10; 12 restyles the final tree; 13 verifies. Phases 6 and 7 are independent of each other and MAY run in parallel if file ownership is kept disjoint (6 = auth/storage/splash; 7 = scan/expiry), but 8 waits for 7.

## Acceptance criteria (whole plan)

- `pnpm why expo -r` shows no installed Expo runtime; source/config scans show no Expo import/package/plugin/launcher/EAS command (policy/dated-history docs may still name Expo).
- Android release APK builds from `apps/mobile` with local Gradle; `adb install -r` installs on the emulator; Dex inspection contains no `expo.modules`/dev-launcher/OTA classes.
- `xcodebuild` compiles the generated RN 0.76.9 iOS host without signing.
- Push works through FCM (permission denial/grant, refresh, foreground receipt, background delivery, tap launch/resume, invalid-token revocation, logout cleanup + re-registration on next boot) with external Firebase creds; the forward migration revokes legacy tokens and the dev device re-registers a native token on next launch.
- Google Sign-In and passkeys work on BOTH Android and iOS after `app.config.ts` deletion (google-services + URL scheme + AASA/assetlinks hand-ported).
- WatermelonDB reads/writes after cold start on both hosts; NativeWind either preserved-and-working or fully removed (0 `className=` today makes removal the low-risk default).
- Only `system`/`expyrico`/`expyricoDark` selectable; no user-facing Bento/Clay/Material/Glass; palette/semantics unchanged.
- TypeScript, mobile lint, affected API/shared checks pass; route/auth/theme/native-adapter/shared-control tests pass, loaded against freshly-refreshed vendored dist.

## Risks (whole plan)

- **Native new-arch build compatibility** (RN Firebase 21.x, Vision Camera 4.x, WatermelonDB against `newArchEnabled=true`) — validated by real debug builds per newly-added module in phase 2, NOT by npm peer ranges (which are `*` and prove nothing).
- **Push cutover** is a hard revoke, safe only because distribution is dev-device-only (validation decision, phase 8). Revisit with a dual-accept window if the app ever ships to a real user fleet.
- **Vendored-dist drift** for shared AND theme — explicit refresh + load-assertion steps in phases 1 and 8.
- **Late-surfacing native gaps** (WatermelonDB pods, ML Kit autolink, google-services, assetlinks) — inventoried in phase 2, verified in phases 9/10.
- **Firebase credentials** — real delivery is an external gate; credential-free builds compile/launch with push explicitly unavailable.
- **One-time keychain transition** — first bare build requires one sign-in; the `pushRegisteredV1` flag must be cleared on sign-out/revocation (phase 8) or devices never re-register.

## Red Team Review

### Session — 2026-07-14
**Reviewers:** 4 hostile lenses (Security Adversary, Scope & Complexity Critic, Assumption Destroyer, Failure Mode Analyst) via code-reviewer subagents. The first three produced 26 evidence-backed findings; the Security Adversary hit a transient API error and delivered late (its 8 findings are recorded in the Security addendum below). Deduplicated and capped at 15. Reports in `reports/`.
**Findings:** 15 accepted (0 rejected). **Severity:** 4 Critical, 9 High, 2 Medium. All independently code-verified before acceptance.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Nav was a 35-file single atomic commit (unreviewable) | Critical | Accept | Split into phases 3/4/5 |
| 2 | Phase 4 emitted native token into a field the validator still rejected | Critical | Accept | Phases 7/8 (native emission enabled in phase 8's source-atomic cutover commit) |
| 3 | "Atomic contract cutover" false at runtime → push blackout via manual APK | Critical | Accept (superseded) | Phase 8 — dual-accept was applied, then relaxed to hard cutover by validation (dev-device distribution, no fleet to blackout) |
| 4 | NativeWind + babel-preset-expo/jest-expo removal load-bearing, unaddressed | Critical | Accept | Phases 1, 11 |
| 5 | WatermelonDB native module invisible to plan | High | Accept | Phases 2, 9, 10 |
| 6 | OcrCamera.tsx + ML Kit second camera surface uncovered | High | Accept | Phase 7 |
| 7 | Android de-Expo understated (settings.gradle/build.gradle) | High | Accept | Phase 9 |
| 8 | Google OAuth + passkey native wiring (both platforms) dropped | High | Accept | Phases 9, 10 |
| 9 | Vendored-dist drift for shared AND theme; phase-5 wording wrong | High | Accept | Phases 1, 8 |
| 10 | `pushRegisteredV1` flag sticky across sign-out → no re-register | High | Accept | Phase 8 |
| 11 | 8 capability swaps bundled in one phase | High | Accept | Split into phases 6/7 |
| 12 | 53-file visual restyle under one unbounded gate | High | Accept | Phase 12 batched with per-batch gates |
| 13 | Phase 1 misjustified ("shrinks surface" false) and miscoped | High | Accept | Phase 1 rewritten as cheap cleanup |
| 14 | Peer-check gate vacuous (`react-native: '*'`) | Medium | Accept | Phase 2 real native-build gate |
| 15 | Worker revocation needs token↔response correlation absent today | Medium | Accept | Phase 8 |

Folded mediums (applied inline, not separately tracked): deep-link scheme casing `Expyrico` vs `expyrico://` (phase 5), typed-routes removal (phase 5), splash-lifecycle regression invariants from recent commits (phase 6), `material` grep false-positives → precise import-specifier gates (phase 1), over-serialized graph → documented parallelizable 6/7 (this file).

### Security Adversary addendum — 2026-07-14 (late delivery after API-error recovery)
The Security Adversary reviewer recovered from a transient API error and delivered 8 findings (1 Critical, 4 High, 3 Medium), all code-verified. Report: `reports/from-code-reviewer-to-planner-red-team-security-adversary-plan-review-report.md`. These are labelled `red-team-2` in the phase files to distinguish them from the first 15. F8 duplicated the already-applied Google Sign-In finding (session F8); the rest are new. All accepted.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| S1 | No `.gitignore` coverage for keystores/`google-services.json`/`GoogleService-Info.plist`/`.p8`/`.p12`/`serviceAccount*.json` — nothing stops a secret commit | Critical | Accept | Phase 2 step 0 (secret-ignore gate runs FIRST) + success criterion |
| S2 | Firebase Admin ADC credential lifecycle not modeled in `config.ts` fail-fast schema → throws per-send, not at boot | High | Accept | Phase 8 (config.ts schema + boot validation) |
| S3 | `upsertPushToken` reassigns ownership by token value → cross-user notification/token takeover, migrated forward unchanged | High | Accept | Phase 8 (fix ownership on conflict + regression test) |
| S4 | Passkey RP-id `'localhost'` production fallback + no mobile↔API↔AASA consistency gate | High | Accept | Phase 10 (remove fallback + preflight consistency gate) |
| S5 | Destructive migration revokes 100% tokens; SQL not pinned as RENAME (risk of DROP/ADD data loss) | Medium | Accept | Phase 8 (pin RENAME COLUMN; prod-rollout note deferred — dev-device only per validation) |
| S6 | `react-native-config` values ship in the APK; public/secret boundary lost; missing keys default to `''` | Medium | Accept | Phase 2 (public-in-binary note + fail-loud on empty required key) |
| S7 | `Expyrico://` custom scheme spoofable; referral code is untrusted input crossing a trust boundary | Medium | Accept | Phase 3 (capture-only; server-authorized idempotent action; hostile-payload test) |
| S8 | Google Sign-In native OAuth config Expo-plugin-injected, absent from plan | High | Accept (dup) | Already covered by session F8 (phases 2/9/10) |

### Whole-Plan Consistency Sweep
Performed after restructure. Decision deltas applied across all 13 phase files and this index: (a) navigation is build→port→flip, no phase claims a single atomic route rewrite; (b) NativeWind decision referenced consistently in phases 1 and 11; (c) vendored-dist refresh appears in both phase 1 (theme) and phase 8 (shared); (d) native-module inventory (WatermelonDB, ML Kit, reanimated) referenced in phases 2/9/10. No unresolved contradictions remained after the restructure.

See `## Validation Log` for the four validation decisions (2026-07-14) that further updated the plan, and the post-validation consistency sweep.

## Validation Log

### Session 1 — 2026-07-14 (critical-questions interview)
Verification pass skipped per the validate-workflow guard: `## Red Team Review` already carries code-verified evidence and no `[UNVERIFIED]` tags remained. Four decision points interviewed; all four resolved and propagated across phase files.

| # | Decision point | Answer | Propagated to |
|---|----------------|--------|---------------|
| 1 | Push rollout: real installed-user fleet, or dev device(s) only? | **Dev device(s) only** — no fleet to protect | Phase 8 rewritten from dual-accept transition to a hard cutover (rename + revoke legacy + re-register on next launch); `plan.md` constraints/risks/red-team-row updated; phase 8 filename → `phase-08-push-fcm-cutover.md`; phases 7 & 13 dual-accept wording → cutover. Supersedes red-team F2/F3 (their blackout premise assumed a user fleet). F1/F9/F10/F15 fixes retained. |
| 2 | NativeWind: keep or remove? | **Remove entirely** (0 `className=` usages) | Phase 1 resolves the decision to REMOVE (deps + global.css + metro wrapper + jest pattern); phase 11 preset swap drops the `jsxImportSource`/`nativewind/babel` re-wire it no longer needs. |
| 3 | RN Firebase: honor spec pin 21.12.0, verify-then-decide, or bump? | **Bump to latest now** | Phase 2 table + risk now install the latest RN-Firebase documented for RN 0.76 new-arch (not 21.12.0), version confirmed in the per-module new-arch build check and recorded in the lockfile + inventory. |
| 4 | Deep-link scheme casing: `expyrico` or `Expyrico`? | **Keep `Expyrico`** (existing native registration) | Phase 5 canonical scheme = `Expyrico`; phase 10 iOS `CFBundleURLSchemes` and `plan.md` invite-link constraint updated to `Expyrico://`. |

### Whole-Plan Consistency Sweep (post-validation)
Re-scanned `plan.md` + all 13 phase files. Confirmed: no stale lowercase `expyrico://` scheme, no active `21.12.0` pin, no NativeWind "if kept" hedging, the old dual-accept phase-8 filename is no longer referenced (the file is now the hard-cutover variant), and no phase presents dual-accept as a current requirement (remaining mentions are historical/superseded context in the red-team table, phase-8 rationale, and update markers). Phase count 13; all `plan.md` links resolve. No unresolved contradictions.

## Dependencies

<!-- Cross-plan dependencies -->
No blocking relationship with the two unfinished plans in this worktree (`260619-1116-expyrico-admin-rename` = web/admin; `260712-0821-password-reset-otp` = auth API/flow). This plan preserves the OTP verify routes as screens (phases 3–5) without changing their contract. No `blockedBy`/`blocks` edges added.
