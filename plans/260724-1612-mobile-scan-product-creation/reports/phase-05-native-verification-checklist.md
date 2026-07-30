# Phase 5 native verification checklist (user-runnable)

**Update:** an Android toolchain (JDK 17, Android SDK platform 36 /
build-tools 36.0.0) is now provisioned and staying on this container — user-
approved after a mid-flight correction (I'd installed it once already before
a "don't install on this box" ruling landed; the user then explicitly
authorized keeping it and running real proof builds here going forward).
Step 1's Android half is DONE for real, below — not research, not deferred.
iOS remains genuinely impossible here (Linux container) and is still the
plan's known external constraint; that half of Step 1 stays user-runnable.

Run these from the repo root unless noted.

## Step 1 — Task 1 proof: does each native dependency compile?

### Android — completed on this container, results below

`react-native-image-crop-picker@0.51.1`: **PASS.** Compiled clean —
codegen, resources, Java compilation, jar bundling, zero errors, every
attempt. New Architecture compatibility is proven, not inferred.

`@google-cloud/recaptcha-enterprise-react-native@18.9.2`: **BLOCKED**, fully
root-caused. Three layered issues:

1. Missing core library desugaring — **fixed and kept** in
   `apps/mobile/android/app/build.gradle` (`coreLibraryDesugaringEnabled
   true` + `desugar_jdk_libs:2.1.5`). Harmless, standard, needed regardless.
2. The library's own `android/build.gradle` never applies the Kotlin Android
   Gradle plugin (upstream packaging gap tied to an unrelated Nitro-modules
   workaround, `react-native-builder-bob#774`) — its `.kt` module source
   never compiles, so RN's autolinked `PackageList.java` can't find the
   class. Two app-side-only fix attempts (a `subprojects{}` block, then the
   same wrapped in `afterEvaluate`) both failed on Kotlin 2.0's plugin-
   lifecycle timing rules.
3. Root cause underneath #2: the real native
   `com.google.android.recaptcha:recaptcha:18.9.2` AAR was compiled with
   **Kotlin metadata version 2.3.0**; this project pins Kotlin **2.0.21**
   (`apps/mobile/android/build.gradle`), which can only read up to metadata
   2.1.0. Confirmed by temporarily patching the library's own build.gradle
   directly in `node_modules` to see what surfaces next (diagnostic only,
   reverted, never committed).

Full root-cause writeup: `phase-05-task-01-native-dependency-evidence.md`.
**This is not something I'm fixing unilaterally** — the real fix is bumping
the project's Kotlin Gradle plugin version, which affects every other native
module (reanimated, vision-camera, screens, svg, etc.), not one adapter
file. Team-lead has this; decision pending on how to proceed (bump Kotlin
project-wide and re-verify against every native module, pin an older
`com.google.android.recaptcha` SDK version if the bridge library allows an
override, or re-scope the reCAPTCHA integration).

Resource note for whoever runs this next on a similarly modest box: this
container has 7.8 GB RAM shared across up to 6 concurrent agent processes
with no swap — the default Gradle daemon (`-Xmx4096m`) got OOM-killed twice
before I found stable settings: `--no-daemon --max-workers=1
-Dorg.gradle.jvmargs="-Xmx1536m -XX:MaxMetaspaceSize=384m"
-Dkotlin.compiler.execution.strategy=in-process`. Not needed on a dedicated
dev machine with more headroom, but worth knowing if the box is shared.

**Fresh-machine note:** `gradlew` for this project lives inside
`node_modules/@react-native/gradle-plugin` (no `android/gradlew` checked in).
On a machine running this repo's ClaudeKit `scout-block` hook, executing it
requires a *local, untracked* `.claude/.ckignore` entry — `.claude/` is
gitignored repo-wide, so this does not travel with the repo and every fresh
checkout/agent needs the same local addition (or must run outside the hook
entirely, e.g. a plain developer machine with no ClaudeKit tooling). The
working pattern (a single `!node_modules/@react-native/gradle-plugin/**` line
is NOT sufficient — the base `node_modules` block-pattern also excludes the
bare directory name, and per real gitignore-spec semantics nothing below an
excluded directory can be re-included unless that directory-name match is
undone too):

```
!node_modules
!**/node_modules
!node_modules/@react-native
!**/node_modules/@react-native
node_modules/@react-native/*
!node_modules/@react-native/gradle-plugin
!node_modules/@react-native/gradle-plugin/**
```

### iOS — still not attempted (Linux container)

```sh
cd apps/mobile/ios && USE_FRAMEWORKS=static pod install
```

- Watch specifically for whether `@google-cloud/recaptcha-enterprise-react-native`'s
  pod resolves — its README states a `use_frameworks! :linkage => :static`
  requirement (this repo's Podfile gates `use_frameworks!` behind the
  `USE_FRAMEWORKS` env var, hence the flag above) and a Flipper-disable note;
  this repo's Podfile has no Flipper wiring at all, so that caveat is likely
  moot — confirm rather than assume.
- **PASS**: proceed to `xcodebuild -workspace
  apps/mobile/ios/Expyrico.xcworkspace -scheme Expyrico -sdk iphonesimulator
  -configuration Debug build`.
- **FAIL**: report the exact error, and whether it's a CocoaPods/Xcode/
  signing environment problem (external limitation, same as plan.md's
  existing iOS precedent) or something that also needs the Kotlin-adjacent
  investigation above (Swift/CocoaPods equivalent of a version-skew issue is
  plausible given the Android result — don't assume iOS is clean).

## Step 2 — Confirm the reCAPTCHA Enterprise SDK versions that actually resolve

```sh
pnpm --dir apps/mobile why @google-cloud/recaptcha-enterprise-react-native
```

Resolved version confirmed on this container: `18.9.2` (latest published;
team-lead/dev-3 already confirmed 18.9.x as current for both platforms).

## Step 3 — real site keys (separate from compile proof)

`RECAPTCHA_SITE_KEY_ANDROID` / `RECAPTCHA_SITE_KEY_IOS` in
`apps/mobile/.env` are placeholders (empty in `.env.example` deliberately —
see its comment). Each key is registered in the Google Cloud console against
this app's exact package name (`com.expyrico.app`) / iOS bundle ID, so only
whoever owns that console project can provision them — this is a Phase 8
rollout dependency, not something to fill in for Step 1's compile proof
(`executeProductSubmitAssessment` only throws at *call* time, not at build
time — see `apps/mobile/src/security/product-creation-assessment.ts`). Moot
for Android specifically until the recaptcha blocker above resolves.

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

Test/lint/typecheck run and stay green on this container as each task
lands (see individual task reports). `android:build` now also runs here
(memory settings above), gated on the recaptcha blocker resolving; the
bundle smoke build and any on-device verification remain a handoff.

## Step 5 — device smoke (once site keys exist, Phase 8 territory)

Install the debug APK on a real device, exercise: barcode scan → conclusive
miss → create private draft → add/crop/rotate/reorder/remove photos (incl. an
iOS HEIC photo, to confirm the forced-JPEG transcode actually produces an
uploadable file server-side) → submit (real token, real server assessment) →
lands in `AddRecordForm` with the household picker hidden → active-product
**Suggest an edit** end to end. Not attempted from this container.

## Open items this checklist depends on

- [x] Step 1 Android result for react-native-image-crop-picker: PASS
- [ ] Step 1 Android result for the reCAPTCHA bridge: BLOCKED — decision
      needed (bump project Kotlin version / pin older native SDK / re-scope)
- [ ] Step 1 iOS pod-install/build result
- [x] Step 2 resolved reCAPTCHA SDK version recorded (18.9.2)
- [ ] Step 3 real site keys provisioned (Phase 8)
- [ ] Step 4 full gate result once Phase 5 code is complete and the recaptcha
      blocker resolves
- [ ] Step 5 device smoke (Phase 8)
