---
name: code-reviewer-expo-cutover-remediation
metadata:
  type: reference
---

# Expo-Removal Cutover Remediation — Follow-up Code Review

**Scope:** Remediation of findings in `from-code-reviewer-collapsed-expo-removal-cutover-report.md`.
**Review mode:** Read-only follow-up.

## Status
DONE_WITH_CONCERNS

## Summary

The remediation resolves the previously blocking iOS-host and Expo-residue defects:

- `apps/mobile/ios/` is no longer hidden by `.gitignore`; host sources and the Firebase plist example are trackable, while only Pods/build/local credential artifacts are ignored.
- The Associated Domains capability is now a syntactically valid `Expyrico.entitlements` file, referenced by `CODE_SIGN_ENTITLEMENTS` in both app Debug and Release configurations.
- iOS camera and icon requirements are present: `NSCameraUsageDescription`, `UIAppFonts`, and `Ionicons.ttf` resource membership.
- iOS deployment target is consistently 16.0 in both `Podfile` and `project.pbxproj`.
- `app.config.ts` and `expo-env.d.ts` are deleted; the source/config scan is clean of the removed Expo packages/plugins/EAS URL.
- The introduced lint failures are gone. Lint reports exactly the documented 11 unrelated pre-existing failures.
- The invalid `react-native-boot-splash` dependency and references are gone; the app uses the local JS hydration splash overlay.

No new critical defect was found in the remediation. The remaining concerns are the already-deferred FCM API cutover, an iOS project hygiene error, and the fact that native iOS compilation remains unverified in this environment.

## Verification Commands Run and Results

| Command / inspection | Result |
|---|---|
| `git check-ignore` for `ios/Podfile`, `ios/Expyrico/Info.plist`, and `ios/GoogleService-Info.plist.example` | **PASS:** all trackable. Real `ios/GoogleService-Info.plist` remains ignored. |
| `git status --short --untracked-files=all apps/mobile/ios` | **PASS with landing action:** iOS sources are visible as untracked rather than silently ignored. They must be included in the landing change. |
| `plutil -lint ios/GoogleService-Info.plist.example ios/Expyrico/Info.plist ios/Expyrico/Expyrico.entitlements` | **PASS:** all plists parse. |
| Xcode project scan | **PASS:** `CODE_SIGN_ENTITLEMENTS = Expyrico/Expyrico.entitlements` exists for Debug and Release; app project deployment target is 16.0; `Ionicons.ttf` is a resource. |
| Expo residue scan across source/config | **PASS:** `app.config.ts` and `expo-env.d.ts` absent; no `expo/config`, Expo Router/plugin, `expo/types`, or EAS update URL references in active mobile source/config. |
| Android host wrapper scan | **PASS:** no Expo host wrappers/autolinking residue. |
| `pnpm -F @expyrico/mobile typecheck` | **PASS:** exit 0. |
| `pnpm exec jest --runInBand` in `apps/mobile` | **PASS:** 43 suites, 157 tests, 16 snapshots. Jest still reports it did not exit one second after completion. |
| `pnpm -F @expyrico/mobile lint` | **Expected pre-existing failure:** exactly 11 errors, all in the known unrelated files from the prior baseline; no remediation-introduced errors. |
| `pnpm -F @expyrico/mobile android:build` | Controller-reported **PASS:** `BUILD SUCCESSFUL`; not re-run in this follow-up because remediation does not change Android build inputs. |
| `pod install` | Controller-reported **PASS:** 110 pods; static Podfile/project inspection is consistent. |
| `xcodebuild` | **Environment-blocked:** local Xcode lacks the required iOS 26.5 SDK/platform. Not a source failure. |

## Remaining Findings

| Severity | Finding | Evidence / impact | Recommended action |
|---|---|---|---|
| Medium | FCM client/API cutover remains incomplete, so native push registration is non-functional until phase 8. | `registerPushToken.ts` obtains an FCM token but sends `expoPushToken`; shared schema still requires `Expo(nent)PushToken[...]`, Prisma/API worker still use the Expo token/SDK path. The new native app’s registration request is rejected before it can persist its registration flag. | Complete the intentionally deferred push phase as a source-atomic change: shared contract, Prisma migration, API route/repository/worker, Firebase Admin configuration, logout/reset behavior, and regression tests. Remove `expo-server-sdk` then. |
| Low | `Expyrico.entitlements` is incorrectly listed in the app’s **Copy Bundle Resources** phase in addition to `CODE_SIGN_ENTITLEMENTS`. | `project.pbxproj` lists `Expyrico.entitlements in Resources`. Entitlements are consumed by codesigning through `CODE_SIGN_ENTITLEMENTS`; copying the file into the bundle is unnecessary and can trigger Xcode project warnings. It does not negate the valid entitlement setting. | Remove only the entitlements build-file entry from `PBXResourcesBuildPhase`; retain the file reference and both `CODE_SIGN_ENTITLEMENTS` settings. |
| Low | Jest leaves an open handle after all tests pass. | Jest reports: “did not exit one second after the test run has completed.” | Run `pnpm exec jest --runInBand --detectOpenHandles` before final verification and fix the owning test/mock/timer if it is migration-related. |
| Info | iOS sources are now correctly visible but currently untracked. | `git status` shows the Podfile, Xcode project, host files, fonts, entitlement, examples, and workspace as untracked. | Ensure the intended host sources/resources and `GoogleService-Info.plist.example` are staged; do not stage ignored real credentials, Pods, build output, or `.xcode.env.local`. |
| Info | The iOS app cannot be compiled in the current local Xcode installation. | `xcodebuild` is blocked by the unavailable iOS 26.5 SDK/platform. | Run unsigned `xcodebuild` and a physical-device smoke test (camera, icons, passkey associated domain) on a machine with the required Xcode platform before release. |

## Acceptance-Criteria Reassessment

| Criterion | Follow-up verdict |
|---|---|
| No Expo imports in `src`/`app` | PASS |
| Mobile typecheck | PASS |
| Jest (43 / 157) | PASS |
| Android build | PASS (controller verification; previously independently observed successful) |
| `pod install` | PASS (controller verification) |
| iOS bundle ID / URL schemes | PASS for static configuration; compile/runtime smoke remains environment-blocked |
| Android no Expo host wrappers | PASS |
| No new lint/type/build errors | PASS relative to documented baseline: typecheck/build clean; exactly 11 pre-existing lint errors remain |
| Public/secret boundary | PASS: real credential files ignored, examples trackable, and `react-native-config` public-value policy remains documented |

## Recommended Actions for Remaining Phases

1. Before landing, remove the entitlements file from Copy Bundle Resources and stage the now-trackable iOS host sources.
2. In the docs/verification phase, run `xcodebuild` and physical iOS smoke tests once a compatible Xcode SDK is available; specifically test camera permission/access, Ionicons rendering, and signed Associated Domains/passkey behavior against the real RP domain/AASA.
3. In the push/FCM phase, complete the server-side FCM contract migration before presenting push as available in the bare client.
4. Keep the visual-system phase scoped to screen styling; it should not mask the remaining push or native-host verification work.

## Unresolved Questions

1. Which exact iOS host files should be committed versus regenerated by `pod install` (notably `Expyrico.xcworkspace`)? The current ignore policy makes all non-ignored files visible; confirm the repository’s intended ownership before staging.
2. What is the production WebAuthn RP domain/AASA deployment date? `expyrico.invalid` is correctly a non-secret placeholder but cannot prove signed-device passkey delivery.
