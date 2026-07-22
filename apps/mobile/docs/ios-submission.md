# iOS App Store submission runbook

Bare React Native iOS release path for Expyrico.

## App Store Connect

1. Create app with bundle id `com.expyrico.app`
2. Name: **Expyrico**
3. Privacy policy + support URLs must match legal docs under `/docs/legal`

## Local host

```bash
cd apps/mobile/ios
pod install
open Expyrico.xcworkspace
```

Unsigned compile check:

```bash
xcodebuild \
  -workspace Expyrico.xcworkspace \
  -scheme Expyrico \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Capabilities to verify before archive

- Associated Domains for passkeys (`Expyrico.entitlements`)
- Sign in with Apple (if shipping Apple auth)
- Push Notifications + Background Modes (remote notifications) when FCM is enabled
- Camera usage description present in `Info.plist`

## Firebase

Place the real `GoogleService-Info.plist` under `ios/` (gitignored).  
Template: `ios/GoogleService-Info.plist.example`.

## Screenshots

Capture from Simulator or device after `pnpm ios` / Xcode Run. Required sizes are listed in App Store Connect for the current iPhone lineup.
