# Red-Team Review: Mobile Bare RN Migration Plan (Assumption Destroyer / Scope Auditor)

Reviewer role: hostile skeptic. Every finding is grep/glob-verified against the worktree at
`/Users/lekiemdan/newapp/newapp/.worktrees/mobile-no-expo-plan`. Findings target unstated
dependencies, false "will work" claims, and scope/version assumptions asserted as fact.

Pre-cleared claims (verified TRUE, not findings): `VALID_IDS` is already
`['system','expyrico','expyricoDark']` (`apps/mobile/src/theme/store.ts:12`);
`settings/index.tsx:55` still branches on `theme.id === 'material'` importing `MD3ListRow`
(`:6`); `schema.prisma:206` is `expoPushToken String @unique`; `record.ts:115` regex is
`/^Expo(nent)?PushToken\[.+\]$/`. All migration-table version pins **do exist on npm** —
including the one the tasking flagged as suspicious: `@react-native-async-storage/async-storage@3.1.1`
is real and is the current latest. `react-native-vector-icons@10.3.0`, `react-native-keychain@9.2.3`,
`@invertase/react-native-apple-authentication@2.5.1`, `@react-navigation/native@7.3.8`,
`native-stack@7.17.10`, `react-native-vision-camera@4.7.2`, `react-native-config@1.6.0`,
`@react-native-firebase/app@21.12.0` all resolve. So the "invented version" hypothesis is
disproven. The real version problem is different (Finding 6).

---

## Finding 1: NativeWind/Tailwind is wired into the build and is never mentioned anywhere in the plan

- **Severity:** Critical
- **Location:** Phase 6, section "Expo removal (only after last imports gone)" — "Replace Babel/Jest/Metro Expo presets with standard RN equivalents"
- **Flaw:** The plan treats `babel-preset-expo` as a pure Expo artifact to be swapped for a stock RN preset. It is not. NativeWind is threaded *through* the Expo build config and appears in zero plan files across all 8 phases. Removing `babel-preset-expo` silently removes NativeWind's JSX transform, and nothing in the plan re-wires it or decides to drop it.
- **Failure scenario:** Phase 6 replaces `babel-preset-expo` with `@react-native/babel-preset`. The `jsxImportSource: 'nativewind'` option and the `nativewind/babel` preset entry are lost. Metro's `withNativeWind(...)` wrapper and the `global.css` import in `app/_layout.tsx` now reference a transform that no longer runs. Best case the CSS is inert; worst case Metro/Babel throws on the dangling `nativewind/metro` + `global.css` pipeline, or the app renders unstyled. This is discovered at build time in phase 6, after phases 2–5 are already committed against the assumption that the build baseline is understood.
- **Evidence:**
  - `apps/mobile/babel.config.js:10` — `['babel-preset-expo', { jsxImportSource: 'nativewind', reanimated: !isTest }]`
  - `apps/mobile/babel.config.js:11` — `'nativewind/babel'`
  - `apps/mobile/metro.config.js:2` — `const { withNativeWind } = require('nativewind/metro');`
  - `apps/mobile/jest.config.js:32` — `nativewind` in `transformIgnorePatterns`
  - `apps/mobile/app/_layout.tsx` imports `global.css`; `apps/mobile/global.css` = `@tailwind base/components/utilities`
  - `apps/mobile/package.json:44-46` — `nativewind@^4.0.36`, `react-native-css-interop@0.2.5`, `tailwindcss@^3.4.0`
  - Plan grep: `grep -rin "nativewind\|tailwind\|global.css\|css-interop" plans/...` → **0 hits**
- **Suggested fix:** Add an explicit decision to phase 1 or 6: either (a) keep NativeWind and re-wire it onto the stock RN babel preset + metro config (NativeWind v4 supports non-Expo RN), migrating `jsxImportSource` and the `global.css` import deliberately; or (b) remove NativeWind/tailwind/css-interop wholesale, delete `global.css`, its `_layout.tsx` import, the metro wrapper, the jest pattern, and the three deps. Note: `className=` usage is currently **0** across `app/` and `src/`, so option (b) is likely low-risk — but the plan must say so instead of leaving a live build dependency undocumented.

---

## Finding 2: "Only expyrico://invite is a supported deep link" is false — the Google OAuth reversed-client URL scheme is a required second scheme

- **Severity:** High
- **Location:** plan.md:46 "Guiding constraints" ("Only `expyrico://invite?code=...` is a supported external deep link in this migration"); Phase 3 "Requirements"; Phase 6 "iOS host"
- **Flaw:** The plan asserts a single deep link as a categorical constraint, then phase 6 quietly contradicts it ("Preserve Google callback… Google URL scheme from external build config"). Google Sign-In registers a custom URL scheme (the reversed iOS client ID) that the OS routes back into the app during the OAuth callback. That is a deep link the app must handle. The React Navigation `linking` config and the iOS `CFBundleURLSchemes` / Android intent filters must account for it. Treating invite as the "sole" link risks a linking config that drops the Google callback.
- **Failure scenario:** Phase 3 builds a React Navigation linking config with `prefixes: ['expyrico://']` only. On iOS the Google reversed-client-id callback scheme is not registered (it was previously injected by the `@react-native-google-signin/google-signin` Expo config plugin, which phase 6 deletes with `app.config.ts`). Google Sign-In silently fails to return, or the OS has no handler. Auth regression shipped.
- **Evidence:**
  - `apps/mobile/app.config.ts:57-58` — config plugin `'@react-native-google-signin/google-signin'` with `{ iosUrlScheme: 'com.googleusercontent.apps.PLACEHOLDER' }`
  - `apps/mobile/src/auth/google.ts:2,12-13` — `GoogleSignin.configure({ webClientId, iosClientId })` in active use
  - Deleting `app.config.ts` is an explicit phase-6 step (phase-06:34, :42) — this removes the plugin that generates the iOS URL scheme and Android google-services wiring
- **Suggested fix:** Rewrite the guiding constraint to "the only *app-owned* external content deep link is `expyrico://invite`; the Google OAuth callback scheme and (iOS) passkey associated-domain are additional OS-routed handlers that must be preserved." Add explicit phase-6 steps to register the Google reversed-client URL scheme in the generated iOS Info.plist and Android manifest placeholders, and to port the Android `google-services.json` wiring the config plugin previously handled.

---

## Finding 3: OCR camera (`OcrCamera.tsx`) and `@react-native-ml-kit/text-recognition` are a second camera surface the plan doesn't touch

- **Severity:** High
- **Location:** Phase 4, "Related Code Files" (lists only `src/features/scan/*` for Vision Camera)
- **Flaw:** Phase 4 scopes the camera migration to `src/features/scan/*`. There is a second `expo-camera` consumer, `src/features/expiry/OcrCamera.tsx`, that combines `CameraView` with `@react-native-ml-kit/text-recognition` for expiry-date OCR. Neither the OCR screen nor the ML Kit text-recognition module appears anywhere in the plan. OCR-via-Vision-Camera requires frame processors / photo capture plus an OCR bridge — architecturally different from barcode scanning and not covered by "Vision Camera + barcode scanning."
- **Failure scenario:** Phase 4 migrates `scan/*` to Vision Camera and phase 6 removes `expo-camera`. `OcrCamera.tsx` still imports `CameraView` from `expo-camera` → build break, or the OCR feature is silently dropped. `@react-native-ml-kit/text-recognition` native module remains unaddressed for the regenerated iOS host / rewritten Android autolinking.
- **Evidence:**
  - `apps/mobile/src/features/expiry/OcrCamera.tsx:2` — `import { CameraView } from 'expo-camera'`
  - `apps/mobile/src/features/expiry/OcrCamera.tsx:4` — `import TextRecognition from '@react-native-ml-kit/text-recognition'`
  - `apps/mobile/src/features/expiry/OcrCamera.tsx:14,42` — `useRef<CameraView>`, `<CameraView ...>`
  - `grep -rln "expo-camera"` → `scan/usePermission.ts`, `scan/ScanCamera.tsx`, `expiry/OcrCamera.tsx`, `tests/ScanCamera.test.tsx` (four files; plan names only `scan/*`)
  - Plan grep for `ml-kit`/`text-recognition`/`ocr`/`expiry` → effectively 0 substantive hits
- **Suggested fix:** Add `src/features/expiry/OcrCamera.tsx` to phase 4's file list and add an explicit OCR-migration decision: either drive OCR through Vision Camera photo capture + `@react-native-ml-kit/text-recognition` (confirm the ML Kit module autolinks under bare RN 0.76.9 on both hosts) or capture-then-recognize. Add ML Kit text-recognition to the native-module inventory verified in phase 6.

---

## Finding 4: "Rewrite the Android host without regenerating" understates the Expo wiring — `settings.gradle` and `app/build.gradle` are also Expo-bound

- **Severity:** High
- **Location:** Phase 6, "Android host" ("rewrite `MainActivity.kt` and `MainApplication.kt`… Replace `react-native.config.js`")
- **Flaw:** The plan scopes the Android de-Expo to two Kotlin files + `react-native.config.js`. The Expo coupling is deeper: Gradle autolinking is driven by `useExpoModules()` in `settings.gradle`, the JS entry is hardcoded to `expo-router/entry.js` in `app/build.gradle`, and `MainActivity.kt` wraps the delegate in `ReactActivityDelegateWrapper` from `expo.modules`. None of `settings.gradle` or `app/build.gradle` is listed in phase 6's files. "Can be rewritten without regenerating the project" is asserted, not demonstrated.
- **Failure scenario:** The two `.kt` files are rewritten to `DefaultReactNativeHost`, but `settings.gradle` still calls `useExpoModules()` (now unresolved after Expo deps are removed) and `app/build.gradle` still points `entryFile` at the deleted `expo-router/entry.js`. Gradle configuration fails, or the bundle can't find its entry. The release-APK acceptance criterion fails late, after the atomic host cutover commit.
- **Evidence:**
  - `apps/mobile/android/settings.gradle:16` — `apply from: ... require.resolve('expo/package.json') ... /scripts/autolinking.gradle`
  - `apps/mobile/android/settings.gradle:17` — `useExpoModules()`
  - `apps/mobile/android/app/build.gradle:12` — `entryFile = file("../../node_modules/expo-router/entry.js")`
  - `apps/mobile/android/app/src/main/java/com/expyrico/app/MainActivity.kt:6,10` — `import expo.modules.ReactActivityDelegateWrapper`, `return ReactActivityDelegateWrapper(...)`
  - `MainApplication.kt:14-15,19,38,46,51` — `ReactNativeHostWrapper`, `ApplicationLifecycleDispatcher`
- **Suggested fix:** Add `android/settings.gradle` (remove `useExpoModules()` + the Expo autolinking `apply from`, switch to the RN CLI native-modules autolinking) and `android/app/build.gradle` (`entryFile` → the new AppRegistry entry, and the `react { }` block) to phase 6's explicit file list, and gate the atomic host cutover on a clean Gradle configuration + debug build *before* deleting Expo deps.

---

## Finding 5: WatermelonDB (a native persistence module used in 7 files) is invisible to the plan

- **Severity:** High
- **Location:** Whole plan — phases 2 (deps), 4 (native capabilities), 6 (host regeneration)
- **Flaw:** `@nozbe/watermelondb` is an active native module (JSI/SQLite adapter, requires native linking + a Babel legacy-decorators transform). It is used in 7 mobile source files and appears **0 times** in the plan. Phase 4 enumerates "each Expo module" but WatermelonDB isn't Expo — it's a bare native dependency that still must survive the iOS host regeneration and Android autolinking rewrite. Its Babel decorators plugin lives in `babel.config.js` `plugins` (survives the preset swap), but the native adapter config does not autoconfigure itself.
- **Failure scenario:** Phase 6 regenerates the iOS host from the stock RN 0.76.9 template and rewrites Android autolinking. WatermelonDB's native SQLite adapter isn't wired into the new Podfile / Gradle, so the app builds but crashes at first DB access, or fails to link. Because the plan never inventoried it, the gap surfaces only in device testing (phase 8).
- **Evidence:**
  - `apps/mobile/package.json:30-31` — `@nozbe/watermelondb@^0.28.0`, `@nozbe/with-observables@^1.6.0`
  - `grep -rln "watermelondb\|@nozbe"` in `app/`+`src/` → 7 files
  - `apps/mobile/babel.config.js:14` — `['@babel/plugin-proposal-decorators', { legacy: true }]` with comment "WatermelonDB models use legacy decorators"
  - Plan grep for `watermelon|nozbe` → 0 hits
- **Suggested fix:** Add WatermelonDB to phase 2's native-module inventory and phase 6's iOS Podfile / Android autolinking verification. Explicitly confirm the JSI adapter and the legacy-decorators Babel plugin are preserved when `babel-preset-expo` is replaced. Add a "DB read/write after cold start" check to phase 8's device acceptance.

---

## Finding 6: The "peer-validated against RN 0.76.9" gate is vacuous — the pinned packages declare `react-native: '*'`

- **Severity:** Medium
- **Location:** Phase 2, "Architecture" table + Success Criteria ("no unmet peer warnings that block build"); plan.md Risks ("Every pinned version… must be re-checked against RN 0.76.9 peer requirements")
- **Flaw:** The plan leans heavily on a phase-2 "peer-check gate" to de-risk versions. But the flagged packages declare wildcard peers, so `pnpm install` will emit **no** peer warnings regardless of actual native compatibility. The gate as written ("no unmet peer warnings") will pass trivially and give false confidence. The real compatibility risk for native modules (RN Firebase 21.12.0 is 4 major versions behind current 25.1.0; Vision Camera 4.7.2 vs RN 0.76 new-arch) lives in *native* build/runtime behavior, which npm peer ranges do not encode.
- **Failure scenario:** Phase 2 "validates peers," sees a clean install, commits the lockfile, and proceeds. In phase 6 the RN Firebase 21.x native pods/Gradle fail against RN 0.76.9's new architecture (`newArchEnabled=true`), or Vision Camera's new-arch codegen mismatches — none of which a `*` peer range would have caught.
- **Evidence:**
  - `npm view @react-native-firebase/app@21.12.0 peerDependencies.react-native` → `*` (latest is 25.1.0)
  - `npm view react-native-vision-camera@4.7.2 peerDependencies.react-native` → `*`
  - `npm view @react-native-async-storage/async-storage@3.1.1 peerDependencies` → `{ react: '*', 'react-native': '*' }`
  - `apps/mobile/android/gradle.properties:6-7` — `newArchEnabled=true`, `hermesEnabled=true` (compatibility must be validated on new-arch specifically)
- **Suggested fix:** Replace the "no unmet peer warnings" success criterion with a criterion that actually exercises native builds on new architecture: a clean Android debug build + app boot for each newly added native module, plus a documented RN-Firebase major-version decision (why 21.12.0 rather than a version tested against RN 0.76 new-arch). Peer ranges are not evidence here.

---

## Finding 7: Deep-link scheme case mismatch — registered scheme is `Expyrico`, plan writes `expyrico://` everywhere

- **Severity:** Medium
- **Location:** plan.md:46; Phase 3 "Requirements" / linking config; Phase 4 referral handler
- **Flaw:** Every plan reference is lowercase `expyrico://invite`. The actual registered scheme is capitalized `Expyrico`. The current handler sidesteps this by using `expo-linking`'s `Linking.parse` and matching only `parsed.path === 'invite'` (scheme-agnostic). When phase 3 moves to a React Navigation `linking` config with explicit `prefixes`, the prefix must match what's registered natively. A lowercase-only prefix plus a native scheme of `Expyrico` risks cold-start links not matching (schemes are case-insensitive per RFC, but React Navigation prefix matching is a string compare and the native manifest/Info.plist value must be chosen deliberately).
- **Failure scenario:** Phase 3 sets `prefixes: ['expyrico://']`; the Android intent filter / iOS `CFBundleURLSchemes` is generated as `Expyrico` (copied from `app.config.ts`), or vice-versa. Cold-start invite capture — an explicit phase-3 acceptance item — silently fails on one platform.
- **Evidence:**
  - `apps/mobile/app.config.ts:3,7` — `name: 'Expyrico'`, `scheme: 'Expyrico'`
  - `apps/mobile/app/_layout.tsx:19,140,145-146` — `import * as Linking from 'expo-linking'`, `Linking.addEventListener('url', …)`, `Linking.parse(url)`, `parsed.path === 'invite' && parsed.queryParams?.code`
- **Suggested fix:** Phase 3 must pin the exact scheme casing once, register it identically in the RN Navigation `linking.prefixes`, the Android intent filter, and iOS `CFBundleURLSchemes`, and add a cold-start test for both the exact-case and, ideally, mixed-case forms. State the chosen canonical scheme string explicitly in the plan.

---

## Finding 8: Removing `app.config.ts` drops the Android Google Sign-In and passkey native wiring, but phase 6 only addresses the iOS side

- **Severity:** Medium
- **Location:** Phase 6, "iOS host" + "Expo removal" (deletes `app.config.ts`)
- **Flaw:** `app.config.ts` currently carries, via Expo config plugins, both the Google Sign-In native config and (through the scheme + associated domains) the passkey RP wiring. Phase 6 documents the iOS Google URL scheme + iOS AASA/`webcredentials` for passkeys, but says nothing about the **Android** equivalents: `google-services.json` placement, manifest client-id placeholders, and the Android Digital Asset Links (`assetlinks.json`) that `react-native-passkey` needs for Android credential manager. Deleting the config plugin without hand-porting these breaks Google auth and passkeys on Android.
- **Failure scenario:** After `app.config.ts` deletion, the Android build has no google-services processing and no assetlinks association. Google Sign-In throws `DEVELOPER_ERROR` and passkey registration/assert fails on Android — both are live auth paths.
- **Evidence:**
  - `apps/mobile/app.config.ts:56-58` — google-signin config plugin
  - `apps/mobile/src/auth/passkey.ts`, `app/(app)/settings/add-passkey.tsx`, `app/(auth)/sign-in.tsx` — active `react-native-passkey` usage
  - `apps/mobile/app.config.ts:67` — `passkeyRpId` extra
  - Phase 6 (phase-06:26) documents only iOS Associated Domains / AASA; no Android assetlinks or google-services step
- **Suggested fix:** Add explicit phase-6 steps for the Android side: place `google-services.json` (untracked), add manifest placeholders / client IDs, and document the Android `assetlinks.json` requirement for passkeys alongside the iOS AASA note. Otherwise the "preserve Google callback + passkey" claim holds only for iOS.

---

## Finding 9: `expo-router` typed-routes experiment and `href`-based navigation are assumed to map cleanly; the linking handler proves otherwise

- **Severity:** Medium
- **Location:** Phase 3, "Route components keep their feature responsibilities — only navigation imports, params, and route tests change"
- **Flaw:** Phase 3 asserts a mechanical import swap. Two current behaviors resist a clean 1:1 map: (a) `experiments: { typedRoutes: true }` generates a typed `Href` surface that many components consume; (b) the root layout does manual `Linking.addEventListener` + `Linking.parse` for invite capture, which must be re-expressed either as React Navigation `linking` subscription or a manual listener — the two have different cold-start vs warm-app timing semantics. "Only imports/params change" undersells the deep-link and typed-route rework, which is where behavior regressions hide.
- **Failure scenario:** The manual `Linking` listener in `_layout.tsx` is dropped in favor of React Navigation `linking.config`, but the referral capture previously fired for the running-app case via the explicit `addEventListener` is now gated behind a matched route — changing when/whether the referral code is captured on warm start.
- **Evidence:**
  - `apps/mobile/app.config.ts:69` — `experiments: { typedRoutes: true }`
  - `apps/mobile/app/_layout.tsx:140-146` — manual `Linking.addEventListener('url', …)` + `Linking.parse`, independent of the router
  - `apps/mobile/src/referral/pendingReferralStore.ts`, `src/api/referrals.ts` — referral capture consumers
- **Suggested fix:** Phase 3 should call out the typed-routes removal as its own migration item and specify whether invite capture uses React Navigation's `linking.subscribe`/`getInitialURL` or a retained manual `Linking` listener — with explicit warm-app and cold-start tests, since the plan already lists both cases as acceptance criteria.

---

Status: DONE_WITH_CONCERNS — the plan's version pins are real and several ground-truth claims check out, but it has undocumented live build/native dependencies (NativeWind, WatermelonDB, ML Kit OCR), a self-contradicting "sole deep link" constraint (Google OAuth + scheme casing), an understated Android host de-Expo (settings.gradle/build.gradle), and a peer-check gate that is vacuous against `*` peers — each capable of failing the atomic cutovers late.
