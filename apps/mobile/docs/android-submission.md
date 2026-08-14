# Google Play Store submission runbook

Bare React Native Android release path for Expyrico.

## Play Console setup

1. Sign in at https://play.google.com/console
2. Create app: **Expyrico**, English, Free
3. Complete Data safety / content rating / target audience forms

## Signing

- Local/debug: Android debug keystore (dev only)
- Production: use a gitignored upload keystore (see `docs/native-secrets.md`)
- Prefer Play App Signing so Google holds the app-signing key
- Configure these gitignored Gradle properties locally in `~/.gradle/gradle.properties`,
  or inject them from CI secrets: `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`,
  `RELEASE_KEY_ALIAS`, and `RELEASE_KEY_PASSWORD`. Any Gradle task resolving a
  release variant fails if any is absent.

Example signed release build:

```bash
cd apps/mobile
pnpm android:release
apksigner verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Target API

`android/build.gradle` currently targets API 36. Keep Play Console target requirements in sync when Google raises the floor.

## Package id

`com.expyrico.app`

## Firebase

Place the real `google-services.json` at `android/app/google-services.json` (gitignored).  
Use `android/app/google-services.json.example` as the non-secret shape.

## Store listing assets

See `assets-checklist.md`. Capture screenshots from a release or debug install via `adb`.
