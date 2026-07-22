# Remaining plan tasks completion report

Date: 2026-07-21  
Plan: `plans/260714-0728-mobile-bare-rn-migration`

## Status summary

| Collapsed phase | Outcome |
|---|---|
| 1 Foundation cleanup | Completed earlier |
| 2 Bare baseline + Android de-Expo + Expo removal | Completed earlier |
| 3 iOS host generation | Host generated + pods installed; **unsigned xcodebuild still blocked by Xcode 26.5 + RN 0.76 ReactCommon/module toolchain issues after fmt consteval patch** |
| 4 React Navigation | Completed earlier |
| 5 Capability swaps + FCM hard cutover | Completed earlier (remediated) |
| 6 Visual system | Completed — screens already on shared primitives; remaining hard-coded neutrals/shadows/textInverse fixed |
| 7 Docs + verification | Completed for static/docs/Android release gates; adb install blocked (no device); iOS compile blocked as above |

## Visual system (phase 12)

- Auth/home/community/account already use `Screen`, `Button`, `Card`, `useTheme`.
- Fixed residual hard-coded colors:
  - `profile.tsx`, `Card.tsx`, `DealCard.tsx`, `GiveawayCard.tsx` → `theme.colors.neutralDark` for shadows
  - `HouseholdSettings.tsx`, `MemberRow.tsx` → `theme.colors.textInverse`
- Logo/Google brand hex retained intentionally.
- Boot splash hex in `App.tsx` retained with comment (ThemeProvider may not be hydrated).

## Docs (phase 13)

Rewrote bare-RN runbooks:

- `apps/mobile/docs/build-and-release.md`
- `apps/mobile/docs/android-submission.md`
- `apps/mobile/docs/ios-submission.md`
- `apps/mobile/docs/assets-checklist.md`

Stripped Expo clean script residue from `apps/mobile/package.json`.

Added superseded notices to:

- `docs/superpowers/specs/2026-07-14-mobile-bare-react-native-migration-design.md`
- `docs/superpowers/specs/2026-07-14-mobile-expyrico-consistency-design.md`

## Verification

### Pass

- Mobile typecheck: pass
- Mobile tests: **44 suites / 161 tests**
- API tests (disposable `pantry_test`): **80 files / 396 tests** (from FCM cutover verification)
- `apps/mobile` package.json / `api` package.json: **no expo deps**
- Source scan for Expo imports/presets/router/server-sdk: **clean**
- `pnpm why expo -r`: empty of runtime Expo packages
- Android **release** APK: **BUILD SUCCESSFUL**  
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (~121 MB)
- Metro monorepo fix: resolve `react` from workspace root (fixes release SHA-1 failure)
- Dexdump scan of release APK: **0 Expo class hits**

### Blocked / external

1. **adb install**: no devices/emulators attached.
2. **iOS unsigned xcodebuild**: after fixing Ionicons duplicate copy + fmt consteval, build still fails under Xcode 26.5 with React-RCTAppDelegate / ReactCommon modulemap and Foundation module build failures. Host, Podfile, entitlements, schemes, and pods install are in place; compile needs RN/Xcode compatibility follow-up (likely RN upgrade or Xcode-side modulemap workaround).
3. **Live FCM / Google / passkey device smoke**: requires real Firebase + OAuth credentials and a device; not exercised in this session.
4. **WatermelonDB / OCR on-device runtime**: not exercised without a running app install.

## Plan file status updates to apply

- phase-12 → completed  
- phase-13 → completed with external gates noted  
- phase-10 → remains blocked on xcodebuild toolchain (host work done)

## Recommended follow-ups (outside this completion)

1. Attach emulator/device → `adb install -r app-release.apk` and smoke welcome/auth/home.
2. Resolve iOS compile on Xcode 26.5 (RN 0.76 modulemap / fmt already patched; remaining ReactCommon redefinition).
3. With Firebase creds: FCM end-to-end + hard-cutover re-register after migration.
4. Production passkey RP domain + AASA (replace `expyrico.invalid`).
