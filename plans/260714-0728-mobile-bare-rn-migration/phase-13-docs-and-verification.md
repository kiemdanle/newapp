---
phase: 13
title: "Docs cleanup and full verification"
status: completed
priority: P1
dependencies: [12]
---

# Phase 13: Docs cleanup and full verification

## Overview

Rewrite active operational docs to the bare RN workflow, add superseded notices to dated Expo specs that look executable, and run the full verification gate: Expo-absence scans, tests (loaded against fresh vendored dist), local Gradle release build + `adb` install, Dex inspection, iOS compile, native-module runtime checks, and push end-to-end (with external Firebase creds).

## Requirements

- Functional: the only Android instructions are local Gradle build + `adb` install/screenshot/test commands; no Expo commands in package scripts or contributor docs; dated specs get superseded notices where they look executable.
- Non-functional: verification preflights the tools actually available on the Mac and does not assume `apkanalyzer`.

## Architecture

**Docs:** rewrite `apps/mobile/docs/*` + contributor docs to bare RN + Gradle + `adb`; strip Expo scripts/commands from `package.json`. Add superseded notices to earlier dated specs that read as executable Expo instructions; the two 2026-07-14 design specs + this plan are the current record. Policy/history docs may still name Expo to explain the prohibition.

**Verification gate (both specs + red-team additions):**
- `pnpm why expo -r` shows no Expo runtime; source/config scans show no Expo import/package/plugin/launcher/EAS command.
- Route, auth, theme, native-adapter, shared-control tests pass; TypeScript + mobile lint + affected API/shared checks pass. **Tests run against freshly-refreshed vendored dist** (shared + theme) with a load assertion (red-team F9).
- Local Gradle release build from `apps/mobile`; `adb install -r` on the emulator.
- Preflight available tools: Android Build Tools `dexdump`, Bundler 2.4.22 / CocoaPods 1.16.2, pinned Maestro 2.4.0. Do NOT assume `apkanalyzer`.
- APK/Dex inspection: no `expo.modules`, dev-launcher, or OTA-update classes; remove Expo Go (`host.exp.exponent`) from the emulator first.
- ADB/UI checks: no Expo launcher; welcome shows Create account + Sign in; auth navigation works; home/pantry/community/account open; camera permission flow reachable; theme follows System unless overridden.
- **Native-module runtime checks (red-team F5):** WatermelonDB read/write after cold start; OCR (ML Kit) recognizes text; both on device/emulator.
- **Auth runtime checks (red-team F8):** Google Sign-In returns on both Android and iOS; passkey register/assert works (or is documented as requiring the external AASA/assetlinks gate).
- **Push (external Firebase creds, outside Git):** permission denial/grant, token refresh, foreground receipt, background delivery, tap launch/resume, invalid-token revocation (id-correlated), logout cleanup + re-registration on next boot. Confirm the hard cutover: after the forward migration revokes legacy tokens, the dev device re-registers a native token on next launch (validation decision — dev-device distribution). <!-- Updated: Validation Session 1 - hard cutover, not dual-accept -->
- `xcodebuild` compiles the iOS host without signing (signed/archive build out of scope).

## Related Code Files

- Modify: `apps/mobile/docs/*`, contributor docs, `apps/mobile/package.json` scripts
- Modify: dated specs under `docs/superpowers/specs/` needing superseded notices
- Reference: `apps/mobile/maestro/*` flows

## Implementation Steps

1. Rewrite active mobile docs to bare RN/Gradle/`adb`; strip Expo scripts.
2. Add superseded notices to dated Expo specs that look executable.
3. Run static scans (`pnpm why expo -r`, import/config grep) → zero live Expo.
4. Refresh both vendored dist copies (shared + theme); run test suites with a load assertion; typecheck; lint; API/shared checks.
5. Preflight Mac tools; local Gradle release APK; `adb install -r`; `dexdump` for forbidden classes; remove Expo Go from emulator.
6. Run ADB/UI + Maestro flows for welcome/auth/home/pantry/community/account in light/dark/System.
7. Native-module runtime checks (WatermelonDB, OCR) + auth runtime checks (Google, passkey) on both platforms as available.
8. With external Firebase creds, run push end-to-end incl. the hard-cutover re-registration on next launch. `xcodebuild` compile iOS unsigned.

## Success Criteria

- [ ] `pnpm why expo -r` + scans show no live Expo; docs describe only the bare RN workflow.
- [ ] All test suites, typecheck, lint, API/shared checks pass against fresh vendored dist.
- [ ] Local Gradle release APK builds + installs via `adb`; Dex has no `expo.modules`/dev-launcher/OTA classes.
- [ ] ADB/UI passes in light/dark/System; WatermelonDB + OCR work at runtime; Google + passkey auth work on both platforms (or external gate documented); iOS host compiles unsigned; push end-to-end + hard-cutover re-registration pass with Firebase creds.

## Risk Assessment

- Assuming absent tools (`apkanalyzer`) → preflight, use `dexdump`.
- Tests passing against stale dist (F9) → refresh both copies + load assertion before the suite.
- Push blocked without creds → external gate; credential-free build still compiles/launches.
- Residual Expo in an unscanned file → full-tree scan, not spot check.
