# Phase 5 native verification checklist (user-runnable)

This container has no JDK/Android SDK/Xcode (confirmed: `java`, `javac`,
`gradle`, `adb`, `sdkmanager` all absent; it's also the production server, so
installing a toolchain here is off the table — ruled by team-lead). Everything
compile/device-dependent in Phase 5 must run on a machine with the real
toolchain (mirrors how the 2026-07-22 android-scan-passkey plan's device
checks ran on a separate macOS host with a physical Mi 9). This file is the
exact, ordered list of what to run there and what each outcome means.

Run these from the repo root unless noted.

## Before anything: sync

```sh
git pull   # or however you get this branch's latest commits
pnpm install
```

## Step 1 — Task 1 proof: does the picker compile under New Architecture?

```sh
pnpm --dir apps/mobile android:build
```

- **PASS** (`BUILD SUCCESSFUL`, APK at
  `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`): confirms
  `react-native-image-crop-picker@0.51.1`'s TurboModule codegen
  (`RNCImageCropPickerSpec`) autolinks and compiles against RN 0.76.9 New
  Architecture. Proceed to Step 2.
- **FAIL** (compile error referencing `image-crop-picker`,
  `RNCImageCropPickerSpec`, codegen, or Fabric): this is the exact failure
  mode plan.md's risk table names ("native picker breaks bare RN hosts").
  **Stop and report back — do not let me/another agent silently downgrade or
  mock past it.** I'll re-scope with a verified alternative (candidates to
  investigate first: pin an even newer image-crop-picker patch if one exists
  by then, or evaluate `expo-image-picker` in bare-RN mode, or a custom
  minimal native module — none pre-selected, deliberately, since the plan
  requires presenting *verified* alternatives, not guessing now).
- **FAIL for an unrelated reason** (missing SDK component, wrong
  `compileSdkVersion`/`buildToolsVersion` on your machine, etc.): not a
  library-compat verdict — fix your local Android SDK setup
  (`apps/mobile/android/build.gradle` currently pins `compileSdkVersion 36`,
  `buildToolsVersion 36.0.0`) and retry.

```sh
cd apps/mobile/ios && pod install
```

- Watch specifically for whether `@google-cloud/recaptcha-enterprise-react-native`'s
  pod resolves. Its own README states a requirement of
  `use_frameworks! :linkage => :static` in the Podfile — this repo's Podfile
  only enables `use_frameworks!` when the `USE_FRAMEWORKS` env var is set, so
  run: `USE_FRAMEWORKS=static pod install` first. The Podfile has no Flipper
  reference at all (RN 0.76 bare template here doesn't wire it up), so the
  README's "disable Flipper" caveat is likely moot — confirm there's no
  Flipper-related pod conflict during this install; if there is, that's new
  information to report back, not something to work around silently.
- **PASS** (`pod install` completes, `Podfile.lock` updates): proceed to
  `xcodebuild -workspace apps/mobile/ios/Expyrico.xcworkspace -scheme
  Expyrico -sdk iphonesimulator -configuration Debug build`.
- **FAIL**: report the exact error. A CocoaPods/Xcode/signing environment
  problem (missing Xcode, no signing identity) is a reported external
  limitation per plan.md's existing iOS precedent, not a library-compat
  verdict — distinguish clearly which kind of failure it is.

## Step 2 — Confirm the reCAPTCHA Enterprise SDK versions that actually resolve

```sh
pnpm --dir apps/mobile why @google-cloud/recaptcha-enterprise-react-native
```

Record the resolved version here in this file (I pinned `18.9.2`, the latest
published as of this writing — team-lead confirmed dev-3 verified 18.9.x as
current for both Android/iOS against Google's docs). If Step 1's builds pass
with this version, that's the accepted pin; no further action.

## Step 3 — real site keys (separate from compile proof)

`RECAPTCHA_SITE_KEY_ANDROID` / `RECAPTCHA_SITE_KEY_IOS` in
`apps/mobile/.env` are placeholders (empty in `.env.example` deliberately —
see its comment). Each key is registered in the Google Cloud console against
this app's exact package name (`com.expyrico.app`) / iOS bundle ID, so only
whoever owns that console project can provision them — this is a Phase 8
rollout dependency, not something to fill in for Step 1's compile proof
(the build compiles fine with an empty key; `executeProductSubmitAssessment`
only throws at *call* time, not at build time — see
`apps/mobile/src/security/product-creation-assessment.ts`).

## Step 4 — Task 9 gate: full regression once all of Phase 5 lands

Run in order, stop at the first failure and report which step:

```sh
pnpm --dir apps/mobile test
pnpm --dir apps/mobile lint
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile android:build
rm -rf /tmp/expyrico-mobile-bundle && mkdir -p /tmp/expyrico-mobile-bundle
pnpm --dir apps/mobile exec react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/expyrico-mobile-bundle/index.android.bundle --assets-dest /tmp/expyrico-mobile-bundle/assets
```

Everything through `typecheck` I can and do run on this container as each
task lands (see individual task reports for pass/fail at each point).
`android:build`, the bundle smoke build, and any on-device verification are
what this checklist hands off.

## Step 5 — device smoke (once site keys exist, Phase 8 territory)

Install the debug APK on a real device, exercise: barcode scan → conclusive
miss → create private draft → add/crop/rotate/reorder/remove photos (incl. an
iOS HEIC photo, to confirm the forced-JPEG transcode actually produces an
uploadable file server-side) → submit (real token, real server assessment) →
lands in `AddRecordForm` with the household picker hidden → active-product
**Suggest an edit** end to end. Not attempted from this container.

## Open items this checklist depends on

- [ ] Step 1 Android result (pass/fail + exact error if fail)
- [ ] Step 1 iOS pod-install/build result
- [ ] Step 2 resolved reCAPTCHA SDK version recorded
- [ ] Step 3 real site keys provisioned (Phase 8)
- [ ] Step 4 full gate result once Phase 5 code is complete
- [ ] Step 5 device smoke (Phase 8)
