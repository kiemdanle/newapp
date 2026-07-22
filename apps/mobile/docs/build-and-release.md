# Build and release runbook (bare React Native)

End-to-end local build and device install for the Expyrico mobile app after the Expo removal.

## Prerequisites

- Node 20+, pnpm 9+
- Android Studio / local SDK (`ANDROID_HOME`) and JDK 17 (Android Studio JBR is fine)
- Xcode + CocoaPods for iOS (`pod` via Homebrew Ruby or system Bundler)
- Device/emulator access via `adb` (Android) or Simulator/Xcode (iOS)

## Install

```bash
# repo root
pnpm install
pnpm -F @expyrico/shared build
pnpm -F @expyrico/theme build

# refresh mobile vendored dist copies after shared/theme changes
rm -rf apps/mobile/local-packages/@expyrico/shared/dist apps/mobile/local-packages/@expyrico/theme/dist
cp -R packages/shared/dist apps/mobile/local-packages/@expyrico/shared/dist
cp -R packages/theme/dist apps/mobile/local-packages/@expyrico/theme/dist
```

## Environment

```bash
cd apps/mobile
cp .env.example .env
# fill public build-time values only (API host, Google client IDs, passkey RP id)
# never put secrets in .env — see docs/native-secrets.md
```

Android Firebase: place real `google-services.json` at `android/app/google-services.json` (gitignored).  
iOS Firebase: place real `GoogleService-Info.plist` under `ios/` (gitignored).

## Android

```bash
cd apps/mobile

# Metro
pnpm start

# Debug APK / install
pnpm android:build
pnpm android:install

# Release APK
pnpm android:release
# output: android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Dex sanity (no Expo runtime classes expected):

```bash
# requires Android build-tools on PATH
APK=android/app/build/outputs/apk/release/app-release.apk
unzip -p "$APK" classes.dex > /tmp/expyrico.dex
dexdump /tmp/expyrico.dex | rg -i 'expo\.modules|devlauncher|expo\.updates' || echo 'no expo dex hits'
```

## iOS

```bash
cd apps/mobile/ios
export PATH="/opt/homebrew/opt/ruby/bin:$HOME/.gem/ruby/4.0.0/bin:$PATH"
pod install

# unsigned compile (CI / verification)
xcodebuild \
  -workspace Expyrico.xcworkspace \
  -scheme Expyrico \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build

# device / simulator run from app package
cd ..
pnpm ios
```

Notes:

- Deployment target is iOS 16.0.
- `react-native-vector-icons` ships Ionicons via CocoaPods; `Info.plist` lists `UIAppFonts = Ionicons.ttf`.
- Passkey Associated Domains live in `Expyrico/Expyrico.entitlements` (`webcredentials:<RP-domain>`). Replace the `.invalid` placeholder before production.
- On Xcode 26.x + RN 0.76, `fmt` 11.0.2 may need the consteval disable patch applied by the Podfile post_install (see `ios/Podfile`). If `Pods/fmt/include/fmt/base.h` is recreated read-only, `chmod u+w` and re-run `pod install`.

## Metro / JS entry

- Entry: `index.js` → registers component `Expyrico`
- Start: `pnpm start` (`react-native start`)
- No Expo CLI, no EAS, no OTA channel workflow

## Tests

```bash
cd apps/mobile
pnpm typecheck
pnpm lint
pnpm test
```

API push tests (disposable DB only):

```bash
cd api
TEST_DATABASE_URL='postgresql://pantry:pantry@localhost:5432/pantry_test?schema=public' \
  pnpm test
```

## Release checklist

1. Shared + theme dist rebuilt and vendored into `apps/mobile/local-packages`
2. `pnpm why expo -r` empty of runtime Expo packages
3. Android release APK builds and installs via `adb`
4. iOS host compiles unsigned
5. Auth (Google + passkey) smoke-tested on both platforms when credentials are present
6. FCM: permission, register, foreground/background, tap, invalid-token revoke, logout re-register
