---
phase: 2
title: "Baseline dependencies, native config, module inventory"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Baseline dependencies, native config, module inventory

## Overview

Add the bare-compatible dependency and configuration baseline while the Expo runtime still provides a testable reference, resolve the CLI version mismatch, and produce a full native-module inventory (including the non-Expo natives the original plan missed). Nothing Expo is removed yet.

## Requirements

- Functional: React Navigation, native capability libraries, React Native Config (`ENVFILE`), and Community CLI 15.x are installed and resolvable. A committed non-secret `.env.example` exists with a reserved `.invalid` host. A native-module inventory lists every module needing autolinking/pods.
- Non-functional: compatibility is validated by a real Android debug build per newly-added native module on the new architecture — NOT by npm peer ranges (red-team F14: the pinned packages declare `react-native: '*'`, so peer checks are vacuous).

## Architecture

Install from the spec's compatibility table, validating each with an actual build:

| Purpose | Package | Spec pin |
| --- | --- | --- |
| Root/mobile CLI | `@react-native-community/cli` (+ platform-android) | 15.0.0 |
| Navigation | `@react-navigation/native` | 7.3.8 |
| Native stack | `@react-navigation/native-stack` | 7.17.10 |
| Bottom tabs | `@react-navigation/bottom-tabs` | 7.18.2 |
| Credentials | `react-native-keychain` | 9.2.3 |
| Non-secrets | `@react-native-async-storage/async-storage` | 3.1.1 |
| Camera/scan | `react-native-vision-camera` (+ barcode) | 4.7.2 |
| Push | `@react-native-firebase/app` + `/messaging` | latest tested against RN 0.76 new-arch (validation decision — NOT the spec's stale 21.12.0) |
| Apple sign-in (iOS) | `@invertase/react-native-apple-authentication` | 2.5.1 |
| Icons | `react-native-vector-icons` | 10.3.0 |
| Env config | `react-native-config` | 1.6.0 |
| API push | `firebase-admin` (api) | 13.5.0 |

All pins verified to exist on npm (red-team confirmed, incl. async-storage 3.1.1). **CLI mismatch:** `package.json` currently pins `@react-native-community/cli@13.6.9` (+ `-platform-android`); align root + mobile to 15.x for RN 0.76 and confirm Gradle uses it.

**Native-module inventory (red-team F5 — modules the original plan missed):**
- `@nozbe/watermelondb` (+ `@nozbe/with-observables`) — native SQLite/JSI adapter, 7 files, needs Podfile/Gradle wiring + legacy-decorators Babel plugin retained.
- `@react-native-ml-kit/text-recognition` — OCR native module (used by `OcrCamera.tsx`), must autolink on both hosts.
- `react-native-reanimated` — native + Babel plugin (ordering matters at preset swap).
- `react-native-passkey`, `@react-native-google-signin/google-signin` — native auth modules (see phases 9/10).
Record each module's native-linking requirement so phases 9/10 verify them.

Use Context7 for current RN 0.76 / React Navigation 7 / RN Firebase setup docs.

## Related Code Files

- Modify: `apps/mobile/package.json` (add bare deps; keep Expo for now), root `package.json` (CLI 15.x), `.gitignore` (native-secret patterns — see step 0)
- Create: `apps/mobile/.env.example` (non-secret, `.invalid` host), react-native-config `ENVFILE` wiring, `apps/mobile/docs/native-module-inventory.md`
- Verify: `pnpm-lock.yaml` reflects RN-0.76.9-compatible resolutions

## Implementation Steps

0. **Secret-ignore gate FIRST (red-team-2 F1, CRITICAL — do this before generating any native config):** add `.gitignore` patterns for every native secret artifact this migration introduces — `*.keystore`, `*.jks`, `*.p8`, `*.p12`, `**/google-services.json`, `**/GoogleService-Info.plist`, `**/serviceAccount*.json`. The current root `.gitignore` covers only dotenv + `*.pem`; nothing else stops a commit. Commit a `.example`/README placeholder for each. Verify with `git check-ignore`.
1. Align `@react-native-community/cli*` to 15.x at root + mobile; confirm Gradle selection (no 13.6.9).
2. Add React Navigation + keychain + async-storage + vision-camera + RN Firebase + apple-auth + vector-icons + react-native-config to mobile; `firebase-admin` to api. Pin per table.
3. For EACH newly-added native module, run a clean Android debug build on the new architecture (`newArchEnabled=true`) and confirm it links + boots — this is the real compatibility gate.
4. Write `native-module-inventory.md` covering WatermelonDB, ML Kit, reanimated, passkey, google-signin native requirements.
5. Wire `react-native-config`/`ENVFILE`; commit `.env.example` (no secrets). **Public/secret boundary (red-team-2 F6):** document that `react-native-config` values are compiled into the distributable APK/bundle and are therefore PUBLIC by definition — secrets (Firebase Admin keys, signing material) never go in the `ENVFILE`, only in the phase-0 git-ignored native files. Replace the current `?? ''` / `?? 'localhost'` silent-default pattern (`app.config.ts:65-67`) with a preflight that fails loudly when a required public key (e.g. `googleWebClientId`, `googleIosClientId`) resolves empty.
6. Commit the lockfile only after the per-module build checks pass.

## Success Criteria

- [ ] `@react-native-community/cli` resolves to 15.x at root + mobile; Gradle uses it.
- [ ] Each newly-added native module links and the app boots in a debug build on new arch (documented per module) — no reliance on peer-range output.
- [ ] `.env.example` committed, non-secret, `.invalid` host; no credentials tracked.
- [ ] **Secret-ignore gate (red-team-2 F1):** `git check-ignore` confirms `*.keystore`/`*.jks`/`*.p8`/`*.p12`/`google-services.json`/`GoogleService-Info.plist`/`serviceAccount*.json` are all ignored; a `.example`/README placeholder exists for each.
- [ ] `native-module-inventory.md` lists WatermelonDB, ML Kit, reanimated, passkey, google-signin and their linking needs.
- [ ] Existing Expo runtime still builds/runs (reference baseline intact).

## Risk Assessment

- Vacuous peer gate (F14) → replaced by real per-module new-arch build checks.
- RN Firebase: validation decision is to install the latest version documented to support RN 0.76 new-arch up front (NOT the spec's stale 21.12.0). Confirm the chosen version against RN 0.76.9 + `newArchEnabled=true` in the per-module build check; record the exact version in the lockfile and `native-module-inventory.md`. <!-- Updated: Validation Session 1 - bump RN Firebase to latest RN-0.76-tested version -->`
- CLI 15 upgrade shifting Gradle behavior → verify a debug build before phase 3.
