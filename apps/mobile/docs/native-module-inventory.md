# Native module inventory — Expyrico mobile

This document records every native module that requires autolinking / native
build configuration for the bare React Native 0.76.9 migration. It is the source
of truth for phases 9 (Android host) and 10 (iOS host).

## Dependency baseline

These packages were added in Phase 2 and validated with real Android debug
builds on `newArchEnabled=true`:

| Purpose | Package | Version | Native build notes |
|---|---|---|---|
| Navigation | `@react-navigation/native` | 7.3.11 | Autolinks; requires `react-native-screens` + `react-native-safe-area-context` |
| Native stack | `@react-navigation/native-stack` | 7.17.10 | Uses `react-native-screens` native stack |
| Bottom tabs | `@react-navigation/bottom-tabs` | 7.18.2 | JS-only; depends on `@react-navigation/native` |
| Secure storage / credentials | `react-native-keychain` | 9.2.3 | Autolinks; keychain/Keystore access |
| Local storage | `@react-native-async-storage/async-storage` | 2.2.0 | Autolinks; compatible with Kotlin 2.0.21/RN 0.76.9 |
| Camera / barcode scan | `react-native-vision-camera` | 4.7.2 | Requires minSdk 24; camera permission in `AndroidManifest.xml`; includes built-in `CodeScanner` for barcodes/QR |
| Push | `@react-native-firebase/app` | ^21.0.0 | Requires `google-services.json` + Firebase Gradle plugin (Phase 9) |
| Push | `@react-native-firebase/messaging` | ^21.0.0 | FCM messaging; foreground/background handlers |
| Apple sign-in (iOS) | `@invertase/react-native-apple-authentication` | 2.5.1 | iOS only; Capabilities + Sign In with Apple entitlement (Phase 10) |
| Icons | `react-native-vector-icons` | 10.3.0 | Autolinks; iOS fonts must be copied in `Info.plist` (Phase 10) |
| Environment | `react-native-config` | 1.6.0 | Reads `ENVFILE` at build time; values compiled into binary |

## Modules already present before Phase 2

| Package | Purpose | Linking notes |
|---|---|---|
| `@nozbe/watermelondb` (+ `@nozbe/with-observables`) | Local SQLite/JSI database | Native SQLite + JSI adapter; legacy Babel decorators retained; `android/src/main` + Podfile wiring in Phase 9/10 |
| `@react-native-ml-kit/text-recognition` | OCR text recognition | Autolinks via ML Kit Vision; Play Services + camera dependency |
| `react-native-reanimated` | Animations | Native module + Babel plugin ordering (preserve at preset swap in Phase 11) |
| `react-native-passkey` | Passkey / WebAuthn | Android: Play Services / FIDO; iOS: ASAuthorization + AASA |
| `@react-native-google-signin/google-signin` | Google Sign-In | Requires `google-services.json` + Google Play Services; iOS URL scheme / `GoogleService-Info.plist` |
| `react-native-gesture-handler` | Gestures | Autolinks; Android `MainActivity` extends `ReactActivity` already covers gesture dispatch |
| `react-native-svg` | SVG icons | Autolinks |
| `react-native-safe-area-context` | Safe area insets | Required by React Navigation; autolinks |
| `react-native-screens` | Screen optimization | Required by React Navigation native stack; autolinks |

## Phase-9 Android checklist

- [ ] Remove `useExpoModules()` and Expo autolinking from `settings.gradle`
- [ ] Update `MainActivity.kt` / `MainApplication.kt` to plain RN hosts
- [ ] Apply Google Services Gradle plugin + add `google-services.json` (git-ignored) to `android/app/`
- [ ] Add FCM Gradle plugin wiring for `@react-native-firebase/app`
- [ ] Add WatermelonDB native dependency / JSI CMake flags
- [ ] Confirm Vision Camera + ML Kit autolink
- [ ] Confirm `react-native-config` env vars available at runtime via `ENVFILE`
- [ ] Verify vector-icons font assets in `android/app/src/main/assets/fonts/`

## Phase-10 iOS checklist

- [ ] Generate bare RN iOS host from `react-native` template
- [ ] Add `GoogleService-Info.plist` (git-ignored)
- [ ] Add `RNScreens` / `RNGestureHandler` root view setup in `AppDelegate.swift`
- [ ] Add `react-native-vector-icons` fonts to `Info.plist` + copy bundle resources
- [ ] Add Apple Sign-In capability + AASA for `passkeyRpId`
- [ ] Add Google Sign-In `CFBundleURLSchemes` + reversed client ID
- [ ] Add `Expyrico` custom URL scheme for invite deep link
- [ ] WatermelonDB Podfile JSI / SQLite flags
- [ ] Vision Camera / ML Kit iOS pods

## Security notes

- `react-native-config` values are **compiled into the APK/bundle**. Only public
  build-time constants (API host, client IDs, package name) belong in `ENVFILE`.
  Secrets must stay in the git-ignored files documented in `docs/native-secrets.md`.
- Real `google-services.json`, `GoogleService-Info.plist`, and `serviceAccount.json`
  are injected by CI or local secrets managers, never committed.
