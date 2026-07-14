---
phase: 9
title: "Android host, Gradle de-Expo, Android auth wiring"
status: pending
priority: P1
dependencies: [8]
---

# Phase 9: Android host, Gradle de-Expo, Android auth wiring

## Overview

Switch Android to the standard React Native host with `AppRegistry`, remove the Expo Gradle coupling the original plan understated (red-team F7), and hand-port the Android Google Sign-In + passkey native wiring that `app.config.ts` deletion will drop (red-team F8). Verify native modules (WatermelonDB, ML Kit) link on Android.

## Requirements

- Functional: Android boots via `DefaultReactNativeHost` + `AppRegistry`; no Expo lifecycle dispatcher/host wrapper/dev launcher; Gradle autolinks via the RN CLI, not `useExpoModules()`; Google Sign-In + passkeys work on Android; WatermelonDB + ML Kit link.
- Non-functional: new-arch + Hermes retained; Gradle uses CLI 15.x.

## Architecture

**Host + entry:** create the AppRegistry entrypoint (`index.js`) and rewrite `android/app/src/main/java/com/expyrico/app/MainActivity.kt` + `MainApplication.kt` to the standard RN host, removing `expo.modules.ReactActivityDelegateWrapper`, `ReactNativeHostWrapper`, and `ApplicationLifecycleDispatcher`.

**Gradle de-Expo (red-team F7 — original plan missed these):**
- `android/settings.gradle:16-17` — remove the `apply from: … expo/package.json … autolinking.gradle` and `useExpoModules()`; switch to RN CLI native-modules autolinking.
- `android/app/build.gradle:12` — `entryFile` from `../../node_modules/expo-router/entry.js` → the new AppRegistry entry; update the `react { }` block.
- Replace `react-native.config.js` (currently pins Expo's autolink path) with standard bare autolinking.

**Android auth wiring (red-team F8 — `app.config.ts` google-signin plugin + passkey wiring is dropped when it's deleted in phase 11):**
- Place `google-services.json` (untracked) and add manifest client-id placeholders for `@react-native-google-signin/google-signin`.
- Document + wire the Android Digital Asset Links (`assetlinks.json` on the RP domain) that `react-native-passkey` needs for the Android credential manager.
- Register the pinned URL scheme (from phase 5) in the Android intent filter.

**Native modules:** confirm WatermelonDB's SQLite adapter and ML Kit text-recognition autolink under the RN CLI Gradle setup (per phase-2 inventory).

## Related Code Files

- Create: `apps/mobile/index.js` (AppRegistry entry)
- Modify: `android/app/src/main/java/com/expyrico/app/MainActivity.kt`, `MainApplication.kt`, `android/settings.gradle`, `android/app/build.gradle`, `react-native.config.js`, `AndroidManifest.xml` (intent filter, client-id placeholders)
- Add (untracked): `google-services.json`; document `assetlinks.json` requirement

## Implementation Steps

1. Create the AppRegistry entrypoint; point `build.gradle` `entryFile` at it.
2. Rewrite `MainActivity`/`MainApplication` to `DefaultReactNativeHost`; retain Hermes + new arch.
3. Remove `useExpoModules()` + Expo autolinking from `settings.gradle`; replace `react-native.config.js` with bare autolinking; confirm a clean Gradle config + debug build BEFORE any Expo dep removal (that's phase 11).
4. Wire Android Google Sign-In (`google-services.json` + manifest placeholders) and register the URL scheme intent filter; document `assetlinks.json` for passkeys.
5. Verify WatermelonDB + ML Kit link on Android.

## Success Criteria

- [ ] Android boots via `DefaultReactNativeHost`/`AppRegistry`; no Expo lifecycle/host-wrapper code; `settings.gradle` has no `useExpoModules()`; `build.gradle` `entryFile` points at the AppRegistry entry.
- [ ] Clean Gradle configuration + debug build with Expo deps still installed (removal deferred to phase 11).
- [ ] Google Sign-In works on Android; `assetlinks.json` requirement documented; WatermelonDB read/write + ML Kit OCR work on Android.

## Risk Assessment

- Autolinking regressions replacing the Expo-pinned `react-native.config.js` (F7) → verify clean debug build before phase 11 removes Expo deps.
- Dropped Android google-services/assetlinks (F8) → hand-ported here, not left to `app.config.ts` deletion.
- Native modules failing to link → verified here, not deferred to device testing.
