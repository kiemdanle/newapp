---
phase: 5
title: "Build & Install"
status: blocked-on-deploy
priority: P2
dependencies: [2, 3, 4]
---

# Phase 5: Build & Install

## Overview

After implementation and tests pass, rebuild the Android release APK locally (Gradle, no Expo/EAS) and install it on the connected phone over adb, then launch it for a manual smoke test of the new OTP reset flow.

## Requirements

- Functional: a fresh `app-release.apk` reflecting the Phase 1–3 mobile changes is installed and launchable on the device.
- Non-functional: build strictly through the local Android toolchain per project policy (AGENTS.md "Android Build And Install Policy") — no Expo CLI, EAS, or Expo Go.

## Architecture

Build path (from `README.md` + root `package.json`): `pnpm mobile:apk` → `pnpm --filter @expyrico/mobile android:release` → Gradle `:app:assembleRelease` with `JAVA_HOME` pinned to Android Studio's JBR. Output APK at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (`applicationId com.expyrico.app`, release type signed with the debug keystore — fine for sideload).

Install path: this device is a Xiaomi MI 9 (cepheus) running MIUI, which rejects plain `adb install -r` with `INSTALL_FAILED_USER_RESTRICTED`. The working method (confirmed this session) is to push the APK to `/data/local/tmp` and install it locally with `pm install -r`. Requires **Install via USB** enabled in MIUI Developer options and an authorized adb device.

## Related Code Files

- None (build/deploy step only — no source changes).

## Implementation Steps

1. Confirm mobile changes are built and the vendored shared `dist` is current (Phase 1), then rebuild the APK from the repo root:
   ```sh
   pnpm mobile:apk
   ```
2. Confirm the device is connected and authorized:
   ```sh
   adb devices -l
   ```
   Expect the MI 9 (`96d9c774`, model `MI_9`, device `cepheus`) as `device`, not `unauthorized`. If unauthorized, approve the USB-debugging prompt on the phone.
3. Install via the MIUI-safe path (plain `adb install -r` fails with `INSTALL_FAILED_USER_RESTRICTED`):
   ```sh
   adb -s 96d9c774 push apps/mobile/android/app/build/outputs/apk/release/app-release.apk /data/local/tmp/app-release.apk
   adb -s 96d9c774 shell pm install -r /data/local/tmp/app-release.apk
   adb -s 96d9c774 shell rm /data/local/tmp/app-release.apk
   ```
4. Launch for a manual smoke test:
   ```sh
   adb -s 96d9c774 shell monkey -p com.expyrico.app -c android.intent.category.LAUNCHER 1
   ```
5. Manually verify the reset flow on-device: forgot-password → 6-digit code screen → new-password screen → sign in with the new password.

## Success Criteria

- [ ] `pnpm mobile:apk` produces a fresh `app-release.apk`.
- [ ] `pm install -r` reports `Success` on the device.
- [ ] App launches (`Events injected: 1`).
- [ ] Manual on-device pass of the three-screen OTP reset flow.

## Risk Assessment

- **MIUI install gate**: if `pm install` still fails, verify **Install via USB** is on in Developer options (may require a Mi account + internet to toggle). Do not fall back to `adb install -r` — it is the path that fails here.
- **Backend reachability**: the app targets `https://api.linhkienkts.com` (`Constants.expoConfig.extra.apiBaseUrl`). The on-device smoke test exercises the deployed backend, so the Phase 2 backend changes must be deployed first — otherwise verify against a local/staging build config instead. Note this dependency before running step 5.
