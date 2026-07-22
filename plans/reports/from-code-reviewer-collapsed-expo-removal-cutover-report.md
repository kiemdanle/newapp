---
name: code-reviewer-collapsed-expo-removal-cutover
metadata:
  type: reference
---

# Collapsed Expo-Removal Cutover — Code Review

**Scope:** `apps/mobile` Expo→bare RN 0.76.9 cutover + related API/root config
**Date:** 2026-07-20
**Reviewer:** code-reviewer (read-only)

## Status
DONE_WITH_CONCERNS

## Summary

The JavaScript/TypeScript cutover is solid and verifiably clean: no `expo`/`@expo` imports remain in `src/` or `app/`, the Android host is fully de-Expo'd, typecheck passes (exit 0), the full jest suite passes (43 suites / 157 tests / 16 snapshots), and the Android debug build succeeds (`BUILD SUCCESSFUL`, Kotlin 2.0.21, RN 0.76.9, all native modules link). The secrets/public boundary is well designed — placeholders use `.invalid` hosts, real secret files are git-ignored, `react-native-config` values are documented as compiled-in/public, and `client.ts` fails loud on a missing `API_BASE_URL`.

However, the review found one **critical** version-control gap and a cluster of **iOS-host wiring defects** (passkey entitlement misplaced, camera usage-description missing, vector-icon fonts not wired, deployment-target mismatch) plus **leftover Expo artifacts** (`app.config.ts`, `expo-env.d.ts`) that the plan's acceptance criteria explicitly require to be removed. The lint gate regressed from the claimed 11 pre-existing errors to 16, with several errors introduced by this migration. None of these block the JS cutover or the Android build, but the iOS host is not production-correct and the migration's own definition of "Expo removed" is not yet met.

## Concerns / Blockers

1. **CRITICAL — the entire iOS host is git-ignored; 0 files tracked.** Root `.gitignore:57` has `apps/mobile/ios/`, so the generated RN 0.76.9 host (Podfile, `project.pbxproj`, `AppDelegate.mm`, `Info.plist`) is completely outside version control. `git ls-files apps/mobile/ios/` returns 0. The iOS host is a primary deliverable of this migration and currently cannot be committed, diffed, or reproduced on another machine. The ignore should be narrowed to ignore only build artifacts (`Pods/`, `build/`, `*.xcworkspace/xcuserdata`, `.xcode.env.local`, real `GoogleService-Info.plist`) while tracking the hand-maintained host sources.

2. **HIGH — passkey Associated-Domain entitlement is in the wrong place.** `com.apple.developer.associated-domains` (`webcredentials:expyrico.invalid`) was added to `Info.plist:74-77`. Apple requires this in a `.entitlements` file referenced by the `CODE_SIGN_ENTITLEMENTS` build setting. No `.entitlements` file exists and `CODE_SIGN_ENTITLEMENTS` is absent from `project.pbxproj`. As written, iOS passkeys will be silently non-functional. Phase-10 step 3 explicitly requires "Add the Associated Domains **entitlement**" and lists `entitlements` among files to create — this was not done.

3. **HIGH — `NSCameraUsageDescription` missing from iOS `Info.plist`.** `ScanCamera.tsx` and `OcrCamera.tsx` both use `react-native-vision-camera`. On iOS the app crashes immediately on camera access without this key. Android's manifest correctly declares CAMERA/POST_NOTIFICATIONS; iOS has only a leftover empty `NSLocationWhenInUseUsageDescription`.

4. **HIGH — `react-native-vector-icons` fonts not wired on iOS.** No `UIAppFonts` entry in `Info.plist` and zero font references in `project.pbxproj`. The `FloatingTabBar` and all icon usages will render as blank boxes on iOS.

5. **HIGH — leftover Expo config files that the plan says must be deleted.**
   - `apps/mobile/app.config.ts` still exists, imports `expo/config`, lists `expo-router`/`expo-secure-store`/`expo-apple-authentication`/`expo-build-properties` plugins, and embeds an EAS `updates.url` + `eas.projectId`. The whole-plan acceptance criteria reference behavior "after `app.config.ts` deletion." It is still in `tsconfig.json:34` `include`.
   - `apps/mobile/expo-env.d.ts` still exists with `/// <reference types="expo/types" />` and triggers an ESLint parser error (it is outside tsconfig `include`). Both files are dead Expo surface and should be removed.

6. **MEDIUM — lint gate regressed: 16 errors, not the claimed 11.** New errors introduced by this migration (not in the phase-1 baseline): `app/(app)/invite.tsx` unused `useNavigation` + unused `AppNavigationProp`; `src/auth/secure-store.ts` unused `Platform` import; `tests/setup.ts` `no-var-requires`; and the `expo-env.d.ts` parser error. This violates acceptance criterion 8 ("no new lint errors; 11 pre-existing remain").

7. **MEDIUM — iOS deployment-target inconsistency.** `project.pbxproj` sets `IPHONEOS_DEPLOYMENT_TARGET = 15.1` (6 targets) while `Podfile` declares `platform :ios, '16.0'`. The task states iOS 16.0; the Xcode project should match.

8. **MEDIUM — push path is half-migrated (expected, but flag the runtime consequence).** `registerPushToken.ts` now sends an FCM token in the field still named `expoPushToken`, but the API side is unchanged: `packages/shared/src/schemas/record.ts:115` still validates `/^Expo(nent)?PushToken\[.+\]$/`, `schema.prisma:206` is still `expoPushToken @unique`, and `api/package.json:37` still has `expo-server-sdk` (now alongside `firebase-admin`). Until phase 8 lands, push registration from the new build will be rejected by the shared zod schema and never succeed. This is consistent with phase 8 being Pending, but the capability swap means **push is currently broken end-to-end** rather than deferred-neutral.

## Verification Commands Run and Results

| # | Command | Result |
|---|---------|--------|
| 1 | `grep -rnE "from ['\"]expo|@expo" apps/mobile/src apps/mobile/app` | No matches — **PASS** (criterion 1) |
| 2 | `pnpm -F @expyrico/mobile typecheck` | exit 0 — **PASS** (criterion 2) |
| 3 | `pnpm exec jest --runInBand` (apps/mobile) | 43 suites / 157 tests / 16 snaps, all pass — **PASS** (criterion 3). Note: "Jest did not exit one second after the test run" (open handle). |
| 4 | `pnpm -F @expyrico/mobile android:build` | `BUILD SUCCESSFUL in 20s`, all native modules link — **PASS** (criterion 4) |
| 5 | `pod install` | **NOT RUN** — environment blocker (iOS 26.5 SDK absent); reviewed Podfile statically instead. |
| 6 | Bundle ID / URL schemes | `PRODUCT_BUNDLE_IDENTIFIER = com.expyrico.app` (4 configs); `CFBundleURLSchemes` = `Expyrico` + google reversed-id placeholder — **PASS**, but see findings 2/3/4 (criterion 6 partial) |
| 7 | `grep -E "ReactActivityDelegateWrapper|ReactNativeHostWrapper|ApplicationLifecycleDispatcher|useExpoModules" android` | No matches — **PASS** (criterion 7) |
| 8 | `pnpm lint` | **16 errors** (5 introduced by this migration) — **FAIL** vs claimed 11 (criterion 8) |
| 9 | `git check-ignore` on real secret files | `google-services.json`, `serviceAccount.json` correctly ignored; placeholders use `.invalid`/dummy keys — **PASS** (criterion 9) |

## Findings with Severity

| Sev | Finding | Evidence |
|---|---|---|
| Critical | iOS host not tracked in git | `.gitignore:57` `apps/mobile/ios/`; `git ls-files apps/mobile/ios/` = 0 |
| High | Passkey entitlement in Info.plist, not a `.entitlements` file | `Info.plist:74-77`; no `*.entitlements`; no `CODE_SIGN_ENTITLEMENTS` in pbxproj |
| High | `NSCameraUsageDescription` missing | absent from `Info.plist`; vision-camera used in Scan/Ocr |
| High | Vector-icon fonts not wired on iOS | no `UIAppFonts`; 0 font refs in pbxproj |
| High | `app.config.ts` not deleted; still references Expo + EAS | `app.config.ts` (expo/config import, plugins, `eas.projectId`); still in `tsconfig.json:34` |
| High | `expo-env.d.ts` not deleted; references `expo/types`, breaks lint | `expo-env.d.ts` exists; ESLint parser error |
| Medium | Lint regressed 11 → 16 (new unused imports + no-var-requires) | `invite.tsx`, `secure-store.ts`, `tests/setup.ts`, `expo-env.d.ts` |
| Medium | iOS deployment target 15.1 ≠ Podfile 16.0 | pbxproj `IPHONEOS_DEPLOYMENT_TARGET = 15.1`; `Podfile:8` `platform :ios, '16.0'` |
| Medium | Push broken end-to-end until phase 8 (FCM token into `expoPushToken` field; shared schema/API/prisma unmigrated) | `registerPushToken.ts:22`; `record.ts:115`; `schema.prisma:206`; `api/package.json:37` |
| Low | `index.js` missing `import 'react-native-gesture-handler'` side-effect at entry | `index.js:1-4` (RNGH-recommended; native-stack swipe uses native gestures, so impact is limited) |
| Low | Jest open handle — suite doesn't exit cleanly | "Jest did not exit one second after the test run" |
| Low | `OcrCamera` passes raw `photo.path` to ML Kit — iOS may need `file://` prefix; verify on device | `OcrCamera.tsx:31` |
| Low | Dead ternary in `ScanCamera.tsx:39` (`BARCODE_TYPES` check unreachable) | `ScanCamera.tsx:39` |
| Info | `docs/native-secrets.md` references `GoogleService-Info.plist.example`, but that file does not exist | `ls` → No such file; would also be git-ignored under `apps/mobile/ios/` |
| Info | `package.json` `clean` script still removes `.expo` | cosmetic |

## Positive Observations (risk-calibration only)

- The single-flight token-refresh logic in `client.ts` is correct: it clears tokens + triggers sign-out on refresh failure and avoids concurrent refresh stampedes.
- The deep-link scheme is **not** a bug: `new URL('Expyrico://...').protocol` normalizes to lowercase `expyrico:`, so `RootNavigator.tsx`'s check is correct despite the capitalized Info.plist registration.
- Secrets hygiene is genuinely good: all placeholders use `.invalid` hosts / dummy IDs, `git check-ignore` confirms real files are ignored, and the public-in-binary caveat is documented in both `native-module-inventory.md` and `native-secrets.md`.
- Android de-Expo is complete and the build proves the native-module set links under the new architecture.

## Recommended Actions (before remaining phases)

Priority order; items 1–5 should land before the iOS host is considered done.

1. **Fix `.gitignore`** — replace `apps/mobile/ios/` with targeted ignores (`Pods/`, `build/`, `xcuserdata/`, `.xcode.env.local`, `GoogleService-Info.plist`) and commit the host sources.
2. **Create `Expyrico.entitlements`** with `com.apple.developer.associated-domains = [webcredentials:<RP-domain>]`, add it to the project, and set `CODE_SIGN_ENTITLEMENTS`; remove the key from `Info.plist`. (Phase 10 requirement.)
3. **Add `NSCameraUsageDescription`** (and any other usage strings: photo library, microphone if used) to `Info.plist`.
4. **Wire vector-icon fonts on iOS** — add `UIAppFonts` (Ionicons.ttf) to `Info.plist` and ensure the font is copied into the bundle, or run the vector-icons pod/link step.
5. **Delete `app.config.ts` and `expo-env.d.ts`**, and remove `app.config.ts` from `tsconfig.json:34`.
6. **Align iOS deployment target to 16.0** in `project.pbxproj` (or reconcile with the Podfile).
7. **Fix the 5 new lint errors** (drop unused imports in `invite.tsx`/`secure-store.ts`, replace the `require` in `tests/setup.ts`, delete `expo-env.d.ts`) to restore the 11-error pre-existing baseline.
8. **Phase 8 (push FCM cutover)** must land before push works: rename the token field through shared schema → prisma → API repository/worker, drop `expo-server-sdk`, and add the `pushRegisteredV1` reset on sign-out. Until then, push is non-functional end-to-end.
9. Add `import 'react-native-gesture-handler';` as the first line of `index.js` (defensive; cheap).
10. Resolve the Jest open handle (likely sync triggers or a Firebase mock timer) so the suite exits cleanly.

## Notes on the remaining phases (visual system + docs/verification)

- The **visual-system phase** can proceed; it operates on `app/`/`src/` screens that are already navigation-clean. The new lint errors and dead imports (item 7) should be cleaned first so restyle diffs stay attributable.
- The **docs/verification phase** must: (a) correct the false claim that `GoogleService-Info.plist.example` exists; (b) re-run lint and assert the count returns to the 11 pre-existing baseline; (c) run `xcodebuild` on a machine with a current iOS SDK to validate findings 2–4 and the deployment target — these cannot be verified in this environment; (d) verify `OcrCamera` ML Kit path handling on a physical iOS device.
- Do **not** treat "push works" as verifiable until phase 8 ships; current mobile-side FCM emission has no valid server counterpart.

## Unresolved Questions

1. Was `apps/mobile/ios/` intentionally left git-ignored (treating the host as regenerable), or is that an oversight? If intentional, the host-creation steps must be scripted/documented so the host is reproducible; otherwise it must be committed.
2. What is the production WebAuthn RP domain for the Associated-Domain entitlement? `expyrico.invalid` is a placeholder; the real domain is needed to complete finding 2 and the AASA preflight gate (red-team S4).
3. Is dropping `expo-server-sdk` from `api/package.json` in-scope for the collapsed cutover or explicitly deferred to phase 8? Both SDKs are currently present.
