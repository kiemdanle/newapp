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

`@google-cloud/recaptcha-enterprise-react-native@18.9.2`: **PASS**, after a
pnpm patch (this repo's pnpm-native equivalent of patch-package) plus a
native-SDK version pin — full root cause and fix documented in
`phase-05-task-01-native-dependency-evidence.md`. In short: the library's
own `android/build.gradle` never applies the Kotlin Android plugin (upstream
gap, `react-native-builder-bob#774`), and its native
`com.google.android.recaptcha:recaptcha` dependency was pinned to `18.9.2`,
whose Kotlin metadata (2.3.0) exceeds what this project's Kotlin 2.0.21 can
read. The patch
(`patches/@google-cloud__recaptcha-enterprise-react-native@18.9.2.patch`,
registered in root `package.json`) adds the missing plugin application and
repins the native SDK to `18.8.0` (metadata 2.1.0, confirmed via `javap`,
also plan.md's own originally-documented baseline). **Full
`:app:assembleDebug` now succeeds** — real 82 MB debug APK produced,
`-PreactNativeArchitectures=arm64-v8a` to fit this box's memory (a resource
accommodation, not a correctness scope-down; the flag only limits which
device ABIs get a native binary, all Java/Kotlin/JS code paths are
unaffected). Drop condition for the patch/pin is documented in the evidence
file.

**Both native dependencies are now proven, not inferred. Phase 5's Android
native-dependency question is closed** — the only remaining native unknown
in this checklist is iOS, still this container's genuine (Linux) blind spot.

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

## Step 4 — Task 9 gate: full regression once all of Phase 5 lands — DONE

Ran in order on this container with all nine tasks landed (commits through
`c40e887`). `android:build` above's package.json script hardcodes macOS
paths (`JAVA_HOME`/`ANDROID_HOME`); on this container the real invocation is
gradlew directly with this box's JDK 17 / SDK paths and the memory-tuned
flags from Step 1 — everything else ran exactly as documented:

```sh
pnpm --dir apps/mobile test -- --runInBand
pnpm --dir apps/mobile exec eslint <every Phase 5 file>   # see note below
pnpm --dir apps/mobile typecheck
cd apps/mobile/android && ./../../../node_modules/@react-native/gradle-plugin/gradlew \
  -p . :app:assembleDebug --no-daemon --max-workers=1 \
  -Dorg.gradle.jvmargs="-Xmx1536m -XX:MaxMetaspaceSize=384m" \
  -Dkotlin.compiler.execution.strategy=in-process -PreactNativeArchitectures=arm64-v8a
rm -rf /tmp/expyrico-mobile-bundle && mkdir -p /tmp/expyrico-mobile-bundle
pnpm --dir apps/mobile exec react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/expyrico-mobile-bundle/index.android.bundle --assets-dest /tmp/expyrico-mobile-bundle/assets
```

Results:

- **Jest**: 289/295 passed. 6 failing, all in 3 pre-existing snapshot files
  (`tests/snapshots/sign-in.test.tsx`, `home.test.tsx`, `welcome.test.tsx`,
  2 each) unrelated to Phase 5 — confirmed via `git stash` re-run against
  HEAD before any Phase 5 commit, still fails identically; tracked
  separately, not a Phase 5 regression.
- **Lint**: every Phase 5 file, scoped, is 0 errors (run per-task throughout
  the phase, re-confirmed at the gate). The *full-repo* `pnpm --dir
  apps/mobile lint` is NOT clean: 12 pre-existing errors across 9 files, none
  under Phase 5's ownership (`deal/new.tsx`, `giveaway/new.tsx`,
  `expo-env.d.ts`, `useOptimisticDealVote.ts`,
  `TransactionRatingForm.tsx`, `AddMemberForm.tsx`, `MemberRow.tsx`,
  `ScopeToggle.tsx`, `UseNextHero.tsx`) — confirmed pre-existing via `git
  log -1` on each, last touched 2026-07-22 (the bare-RN-migration commit,
  well before Phase 5 started) and unmodified in the working tree. Not
  fixed here (outside this phase's file ownership); flagged for a separate
  task.
- **Typecheck**: clean.
- **`android:build`**: **BUILD SUCCESSFUL**, real signed debug APK at
  `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (82 MB).
  521 tasks, 15 executed / 506 up-to-date — expected, since none of Tasks
  4-9's changes touched a Gradle input (they're all TS/TSX; Task 1 already
  proved the native module graph compiles and nothing since then changed
  it).
- **Metro bundle smoke**: succeeded — real `index.android.bundle` (3.1 MB,
  1979 lines minified) plus 38 copied asset files at
  `/tmp/expyrico-mobile-bundle/`, covering every current source file
  including all of Phase 5.

Android half of the gate is fully proven, not inferred. iOS remains this
container's one genuine blind spot (see Step 1 below) and is the only
item left for whoever has a macOS/Xcode environment.

## Step 5 — device smoke (once site keys exist, Phase 8 territory)

Install the debug APK on a real device, exercise: barcode scan → conclusive
miss → create private draft → add/crop/rotate/reorder/remove photos (incl. an
iOS HEIC photo, to confirm the forced-JPEG transcode actually produces an
uploadable file server-side) → submit (real token, real server assessment) →
lands in `AddRecordForm` with the household picker hidden → active-product
**Suggest an edit** end to end. Not attempted from this container.

## Open items this checklist depends on

- [x] Step 1 Android result for react-native-image-crop-picker: PASS
- [x] Step 1 Android result for the reCAPTCHA bridge: PASS (patched +
      pinned to native SDK 18.8.0; full `:app:assembleDebug` succeeded)
- [ ] Step 1 iOS pod-install/build result
- [x] Step 2 resolved reCAPTCHA SDK version recorded: bridge `18.9.2` (npm),
      native `com.google.android.recaptcha:recaptcha` pinned `18.8.0` (patch)
- [ ] Step 3 real site keys provisioned (Phase 8)
- [x] Step 4 full gate result: DONE. Jest 289/295 (6 pre-existing snapshot
      failures, tracked separately), scoped lint clean, typecheck clean,
      `android:build` BUILD SUCCESSFUL with a real APK, Metro bundle smoke
      succeeded. Everything remaining below is iOS-only or Phase 8.
- [ ] Step 5 device smoke (Phase 8)

## What's left — iOS only

Every remaining open item in this checklist is either genuinely impossible
from this Linux container (iOS Steps 1/pod-install/xcodebuild) or explicitly
scoped to Phase 8 (real site keys, device smoke). Android is fully closed
for Phase 5.
