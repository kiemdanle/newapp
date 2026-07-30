# Phase 5 Task 1: native dependency compatibility evidence

**Update — real Android proof build completed on this container.** The
user later approved keeping an Android toolchain here (JDK 17 + Android SDK
platform 36/build-tools 36.0.0, provisioned and gone through review — see
the team thread), so the sections below that originally said "documented-
compatible pending compile proof" are now backed by an actual `gradlew
assembleDebug` run, not just research. Results, in short:

- **react-native-image-crop-picker@0.51.1: PROVEN.** Compiles clean —
  codegen, resource compilation, Java compilation, and jar bundling all
  succeeded with zero errors across every attempt. The New Architecture
  compatibility claimed below is now directly confirmed, not just inferred.
- **@google-cloud/recaptcha-enterprise-react-native@18.9.2: BLOCKED**, with
  the exact root cause fully diagnosed (three layered issues, one already
  fixed and kept, two real and unresolved — see "Android proof build
  results" below). Per team-lead's standing instruction, I'm stopping and
  reporting rather than working around this myself, since the real fix
  requires a project-wide Kotlin version decision outside this adapter's
  blast radius.

iOS remains untested (Linux container, genuinely impossible here) — still
the plan's known external constraint, tracked in the checklist.

Original research (still accurate background) follows.

## react-native-image-crop-picker — pinned 0.51.1

- Latest published version on npm as of this write-up (queried
  `registry.npmjs.org` directly): `0.51.1`, published 2024-10-21.
- The published `package.json` for the `v0.51.1` git tag (fetched from
  `raw.githubusercontent.com`) contains a `codegenConfig` block:
  `{"name": "RNCImageCropPickerSpec", "type": "modules", "jsSrcsDir": "src",
  "android": {"javaPackageName": "com.reactnative.ivpusic.imagepicker"}}`.
  This is the RN codegen declaration TurboModules/autolinking under the New
  Architecture require — its *presence* is direct, checkable evidence of
  New-Architecture support, not just a changelog claim.
- The library's own README states plainly: "If you are using react native
  new architecture, you have to use react-native-image-crop-picker version
  >= 0.50.0." The `v0.50.0` release notes (2024-05-29) list "New Architecture
  support" as the headline change — `0.51.1` is a patch line on top of that,
  not a separate rewrite.
- `peerDependencies` are unpinned (`"react": "*"`, `"react-native": "*"`),
  so there's no declared floor conflicting with RN 0.76.9.
- Known caveat, explicitly NOT applicable to this pin: an iOS crash reported
  against `v0.41.6` (pre-New-Arch, Dec 2024) combined with RN 0.76.2 — that
  version predates the New-Architecture codegen work entirely, which is
  exactly why the pin here is `0.51.1`, not `0.41.x`.
- Gap: no changelog entry explicitly says "tested against RN 0.76.9" (last
  release was Oct 2024, before/around RN 0.76's stabilization window) — the
  codegen-config evidence is structural, not a maintainer's direct claim.
  This is the actual unknown Step 1 of the checklist resolves.

## @google-cloud/recaptcha-enterprise-react-native — pinned 18.9.2

- This is Google's own first-party bridge (`GoogleCloudPlatform/recaptcha-
  enterprise-react-native` on GitHub, published as
  `@google-cloud/recaptcha-enterprise-react-native` on npm) — not a
  community wrapper. Confirms team-lead/dev-3's 18.9.x baseline: latest
  published version queried directly from the npm registry is `18.9.2`.
- `peerDependencies` are unpinned (`"react": "*"`, `"react-native": "*"`).
  Its own internal `devDependencies` pin `react-native` to a nightly
  `0.87.0-nightly-*` build for the library's own example/test harness — by
  the time RN reached that nightly range, RN's legacy (non-Fabric) bridge
  had already been dropped entirely, so a library whose own CI runs against
  that nightly cannot be relying on legacy-bridge-only APIs. That's indirect
  but real evidence of New-Architecture compatibility, even though (unlike
  image-crop-picker) its `package.json` has no explicit `codegenConfig`
  block — it may use a different native-module registration path that
  doesn't need codegen, or a manual/interop-layer bridge; this document
  doesn't resolve which, only that it isn't relying on removed legacy-only
  bridge behavior.
- Install/init API confirmed directly from the README (`raw.githubusercontent.com`,
  not a search-engine summary): `const client = await
  Recaptcha.fetchClient(SITE_KEY)` once per app lifetime, then `const token =
  await client.execute(RecaptchaAction.custom('submit_product'))`. This is
  exactly what `apps/mobile/src/security/product-creation-assessment.ts`
  implements (singleton client cache + `RecaptchaAction.custom`).
- Podfile requirement stated in the README: `use_frameworks! :linkage =>
  :static`, plus a Flipper-disable note. This repo's `apps/mobile/ios/Podfile`
  already gates `use_frameworks!` behind a `USE_FRAMEWORKS` env var and has
  no Flipper wiring at all — the verification checklist's Step 1 tells the
  user to run `USE_FRAMEWORKS=static pod install` and flag if any Flipper-
  shaped conflict shows up (it shouldn't, since there's nothing to disable,
  but that's exactly the kind of assumption the actual pod install should
  confirm rather than this document asserting untested).

## Adapter isolation (both libraries)

Per team-lead's mitigation instruction, all usage is confined to two files so
a failed proof build's blast radius is one file per library, not the editor:

- `apps/mobile/src/features/products/photo-picker-adapter.ts` —
  `takePhoto`/`choosePhotos`/`cleanupTemp`, the only file importing
  `react-native-image-crop-picker`. 12 Jest cases (cancellation-is-silent,
  10 MiB advisory rejection, no-enlargement, scoped-not-global cleanup, exact
  compression/JPEG-forcing options asserted) — all passing on this container.
- `apps/mobile/src/security/product-creation-assessment.ts` —
  `executeProductSubmitAssessment`, the only file importing
  `@google-cloud/recaptcha-enterprise-react-native`. 4 Jest cases
  (platform-correct site key selection, single-init-across-calls, missing-
  key fail-fast) — all passing.

Both files, their tests, `apps/mobile/package.json`, `pnpm-lock.yaml`,
`apps/mobile/.env.example`, and `apps/mobile/tests/mocks/react-native-config.ts`
are the full Task 1 diff. `pnpm --dir apps/mobile typecheck` and a scoped
`eslint` run on exactly these two source+test file pairs are both clean; the
repo-wide `pnpm --dir apps/mobile lint` has 12 pre-existing errors in
unrelated files (deal/giveaway forms, a11y descriptors, unused vars) not
touched by this change.

## Android proof build results (real compile, not research)

Ran `gradlew -p android :app:assembleDebug` repeatedly against JDK 17 +
Android SDK platform 36 / build-tools 36.0.0 (compileSdk/buildToolsVersion
this project already pins), with `--no-daemon --max-workers=1` and a
reduced heap to fit this box's ~7.8 GB shared with five other concurrent
agent processes — a resource constraint of this specific machine, not a
build-correctness issue; every failure below reproduced identically once
memory pressure was controlled for.

**react-native-image-crop-picker@0.51.1** — every one of its own Gradle
module tasks succeeded with zero errors, every attempt:
`generateCodegenSchemaFromJavaScript`, `generateCodegenArtifactsFromSchema`,
`writeDebugAarMetadata`, `compileDebugLibraryResources`,
`parseDebugLocalResources`, `generateDebugRFile`, `generateDebugBuildConfig`,
`javaPreCompileDebug`, `compileDebugJavaWithJavac`,
`bundleLibCompileToJarDebug`. New Architecture support is now a proven fact
for this project's exact toolchain, not an inference from `codegenConfig`.

**@google-cloud/recaptcha-enterprise-react-native@18.9.2** — three distinct,
layered problems surfaced in sequence as each was resolved:

1. **Missing core library desugaring** (fixed, kept in
   `apps/mobile/android/app/build.gradle`): the library's AAR metadata
   requires `coreLibraryDesugaringEnabled true` on the consuming app module.
   Added `compileOptions { coreLibraryDesugaringEnabled true;
   sourceCompatibility/targetCompatibility JavaVersion.VERSION_1_8 }` and
   `coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'` (latest
   published, confirmed via `dl.google.com/android/maven2` metadata). This is
   a normal, standard Android config addition — not a compatibility problem,
   just a missing wiring step, and it's staying in the code.

2. **The library's own `android/build.gradle` never applies the Kotlin
   Android Gradle plugin.** It ships a Kotlin module
   (`RecaptchaEnterpriseReactNativePackage.kt`,
   `RecaptchaEnterpriseReactNativeModule.kt`) and depends on
   `kotlin-stdlib`, but only declares Kotlin in its `buildscript{}`
   classpath — there's no `apply plugin: "org.jetbrains.kotlin.android"`
   line. The file itself explains why: a commented-out
   `apply plugin: "com.facebook.react"` block with the note "Remove per:
   https://github.com/callstack/react-native-builder-bob/issues/774" — an
   unrelated Nitro-modules duplicate-class workaround that left this
   non-Nitro, standard-autolinking case with an uncompiled `.kt` source.
   RN's autolinked `PackageList.java` correctly references
   `com.google.recaptchaenterprisereactnative.RecaptchaEnterpriseReactNativePackage`
   by its real name (confirmed the source file exists at that exact path) —
   the class just was never built, so `:app:compileDebugJavaWithJavac` fails
   with "cannot find symbol".

   Tried to fix this from `apps/mobile/android/build.gradle` (app-side only,
   no node_modules patch) two ways — a plain `subprojects { … apply plugin:
   … }` block, and the same wrapped in `afterEvaluate` for correct plugin-
   application ordering. Both failed: the first because the Android plugin's
   extension wasn't registered yet at that point in project evaluation, the
   second because Kotlin 2.0's newer `KotlinPluginLifecycle` model rejects
   applying the plugin once the project has moved past the configuration
   phase (`cannot be started in ProjectState 'EXECUTING'`). No further
   app-side-only fix attempted after that — see item 3, which makes this
   moot anyway.

3. **Real, confirmed Kotlin metadata version skew** — diagnosed by
   temporarily patching the library's own `android/build.gradle` directly in
   `node_modules` (diagnostic only, reverted immediately after, never
   committed) to add the missing `apply plugin` line from item 2, purely to
   see what error surfaces next. Result: `compileDebugKotlin` fails with
   "Incompatible classes were found in dependencies" — the actual native
   `com.google.android.recaptcha:recaptcha:18.9.2` AAR (a closed-source
   Google Play Services–style SDK, not something this project controls) was
   compiled with **Kotlin metadata version 2.3.0**. This project pins
   `kotlinVersion = "2.0.21"` in `apps/mobile/android/build.gradle` — a
   2.0.21 compiler can read metadata up to version 2.1.0, not 2.3.0. This is
   a genuine, verified toolchain version-skew incompatibility, not a
   misconfiguration.

   Fixing this for real means bumping the project's Kotlin Gradle plugin
   version to something that can read 2.3.0 metadata — a change that affects
   every other native module in the app (reanimated, vision-camera, screens,
   svg, etc., each with their own tested Kotlin ranges), not something
   scoped to one adapter file. That's exactly the kind of decision this
   report is for, not something to make unilaterally mid-proof-build.

**Net effect:** item 1 stays fixed in the tracked build.gradle (harmless,
correct, needed regardless of how items 2/3 resolve). Items 2 and 3 are
reported, not worked around — the reCAPTCHA Enterprise Mobile SDK bridge is
not currently buildable against this project's pinned Kotlin 2.0.21 on
Android, full stop, independent of anything in my adapter code.
