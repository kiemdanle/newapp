---
phase: 10
title: "iOS host generation and iOS auth wiring"
status: pending
priority: P1
dependencies: [9]
---

# Phase 10: iOS host generation and iOS auth wiring

## Overview

Generate a standard React Native 0.76.9 iOS host (none exists today — `apps/mobile/ios/` is absent) and hand-port the iOS Google callback + passkey wiring that `app.config.ts` deletion drops (red-team F8). Verify native modules (WatermelonDB, ML Kit, Apple auth) link via CocoaPods.

## Requirements

- Functional: `apps/mobile/ios/` is a standard RN 0.76.9 host (bundle id `com.expyrico.app`, no Expo pods/AppDelegate wrappers/plugins/build scripts); Google Sign-In callback + passkeys work on iOS; Apple sign-in adapter (from phase 6/7 dependency chain) is exercised; WatermelonDB + ML Kit link via pods.
- Non-functional: `xcodebuild` compiles without signing; new-arch + Hermes retained.

## Architecture

Generate the iOS project from the RN 0.76.9 template (bundle id `com.expyrico.app`). Wire through external build configuration (no secrets committed):
- **Google callback:** register the reversed-client-id URL scheme in `Info.plist` `CFBundleURLSchemes` (previously injected by the google-signin Expo config plugin, `app.config.ts:56-58`).
- **App-owned scheme:** register the pinned `Expyrico` scheme (from phase 5, capitalized per validation) in `CFBundleURLSchemes`.
- **Passkeys (red-team-2 F4):** Associated Domains entitlement uses the production WebAuthn RP domain. The mobile RP id currently resolves with a hard `'localhost'` fallback (`app.config.ts:67` `passkeyRpId ?? 'localhost'`) while the API independently enforces `expectedRPID = cfg.webauthn.rpId` (`api/src/services/auth/passkey.ts:61,105`); a mismatch silently kills passkey auth with no build-time signal. Remove the `'localhost'` production fallback (require an explicit value) and add a preflight gate that fails the build when the resolved mobile RP id is empty/`localhost` OR when the four values disagree: mobile `passkeyRpId` == API `WEBAUTHN_RP_ID` == iOS Associated Domain host == published AASA `webcredentials.apps` host. Document that signed-device passkey verification requires that domain's AASA to list `<APPLE_TEAM_ID>.com.expyrico.app` (external, not committed).
- **Native modules:** confirm WatermelonDB, ML Kit text-recognition, Vision Camera, RN Firebase, and `@invertase/react-native-apple-authentication` install via the Podfile (Bundler 2.4.22 / CocoaPods 1.16.2 per the verification toolchain).

## Related Code Files

- Create: `apps/mobile/ios/**` (generated RN 0.76.9 host, Podfile, `Info.plist`, entitlements, `AppDelegate`)
- Reference: `src/auth/google.ts`, `src/auth/passkey.ts` (active consumers), phase-2 native-module inventory

## Implementation Steps

1. Generate the RN 0.76.9 iOS host; set bundle id; retain Hermes + new arch; no Expo pods.
2. Register the Google reversed-client URL scheme + the pinned `Expyrico` scheme in `Info.plist`.
3. Add the Associated Domains entitlement (production RP domain); document the AASA `webcredentials.apps` requirement.
4. `pod install`; confirm WatermelonDB, ML Kit, Vision Camera, RN Firebase, Apple auth link.
5. `xcodebuild` compile without signing.

## Success Criteria

- [ ] `apps/mobile/ios/` exists as a standard RN 0.76.9 host with no Expo pods; `xcodebuild` compiles without signing.
- [ ] Google callback scheme + app `Expyrico` scheme registered in `Info.plist`; Associated Domains entitlement set; AASA requirement documented.
- [ ] **(red-team-2 F4)** the `'localhost'` production RP-id fallback is removed; a preflight fails the build when the resolved mobile RP id is empty/`localhost` or disagrees with API `WEBAUTHN_RP_ID` / iOS Associated Domain / published AASA host.
- [ ] All inventoried native modules link via CocoaPods.

## Risk Assessment

- iOS template drift from RN 0.76.9 → use the exact RN 0.76.9 template / Context7 docs; keep bundle id + entitlements exact.
- Dropped iOS google/passkey wiring (F8) → hand-ported here before `app.config.ts` deletion in phase 11.
- Pod link failures for native modules → verified here; signed/archive build is explicitly out of scope (Android is the delivery gate).
