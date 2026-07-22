# Expo Removal Source Port — Implementation Report

**Phase:** Expo removal (JavaScript/TypeScript source and test port)  
**Date:** 2026-07-19  
**Status:** DONE

## Summary

Ported `apps/mobile` from Expo Router + Expo SDK to bare React Native 0.76.9 + React Navigation. All source files under `src/` and `app/` are now free of Expo imports. TypeScript and Jest both pass.

## What Changed

### New entry point and root app shell
- `index.js` — bare RN entry point registered as `Expyrico`.
- `src/App.tsx` — `NavigationContainer`, `ThemeProvider`, `QueryClientProvider`, `SafeAreaProvider`, `GestureHandlerRootView`, `AppSyncManager`, `react-native-boot-splash` integration, deep-link handler for `Expyrico://invite?code=...`.

### Navigation tree (React Navigation, typed)
- `src/navigation/RootNavigator.tsx` — switches Auth/App stacks after session hydration.
- `src/navigation/AuthNavigator.tsx` — Welcome, SignIn, SignUp, ForgotPassword, VerifyResetCode, ResetPassword, VerifyEmail.
- `src/navigation/AppNavigator.tsx` — App stack including settings, household, product, deal, giveaway, record, report, scan screens and the bottom-tabs entry.
- `src/navigation/TabsNavigator.tsx` — Home, Giveaways, Deals, Profile with custom `FloatingTabBar`.

### Screens (`app/` routes kept, no Expo imports)
- Removed `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`.
- Converted all `app/**/*.tsx` screens to React Navigation: replaced `expo-router` hooks (`useRouter`, `useSegments`, `useLocalSearchParams`) with `useNavigation`/`useRoute` and typed screen-name strings.

### Native module replacements
- `expo-secure-store` → `react-native-keychain` in `src/auth/secure-store.ts` and `src/referral/pendingReferralStore.ts`.
- `expo-apple-authentication` → `@invertase/react-native-apple-authentication` in `src/auth/apple.ts`.
- `expo-constants` → `react-native-config` in `src/api/client.ts` and `src/auth/google.ts`.
- `expo-camera` → `react-native-vision-camera` in `src/features/scan/ScanCamera.tsx`, `src/features/scan/usePermission.ts`, and `src/features/expiry/OcrCamera.tsx`.
- `expo-notifications`/`expo-device` → `@react-native-firebase/messaging` in `src/features/push/registerPushToken.ts`.
- `expo-splash-screen` → `react-native-boot-splash`.
- `expo-status-bar` → `StatusBar` from `react-native`.
- `expo-linking` → `Linking` from `react-native`.
- `@expo/vector-icons` → `react-native-vector-icons/Ionicons` across components.
- Removed `expo-asset`, `expo-blur`, `expo-device`, `expo-updates`, `expo-dev-client` from source and config.

### Type declarations
- `src/types/native-modules.d.ts` — declarations for `react-native-vector-icons/Ionicons`, `react-native-boot-splash`, `react-native-config`.

### Build/test config
- `babel.config.js` — now uses `@react-native/babel-preset`.
- `metro.config.js` — now uses `@react-native/metro-config` with monorepo/pnpm hoisting workaround.
- `jest.config.js` — uses `react-native` preset; updated `moduleNameMapper` for new native mocks.
- `tsconfig.json` — removed Expo type refs, added `index.js`.

### Test infrastructure and mocks
- `tests/setup.ts` — removed Expo mocks; added default mocks for `react-native-vision-camera`, `react-native-boot-splash`, `react-native-config`, `@invertase/react-native-apple-authentication`, `@react-native-firebase/messaging`, etc.; React Navigation mock now delegates to `tests/mocks/react-navigation`.
- `tests/mocks/react-native-keychain.ts` — in-memory keychain mock used via `moduleNameMapper`.
- `tests/mocks/react-native-vector-icons.ts`, `react-native-config.ts`, `react-native-boot-splash.ts` — module stubs.
- `tests/mocks/react-navigation.ts` — shared `useNavigation`/`useRoute` mock plus `__setRouteParams` helper.
- `tests/helpers/renderWithTheme.tsx` — wraps in `NavigationContainer`/`ThemeProvider`.
- Fixed broken route imports in `__tests__/routes/*.test.tsx` caused by a bad Expo-path string replacement.
- Updated route test assertions to React Navigation screen-name + params form.
- Updated `__tests__/root-layout-splash.test.tsx` to test `src/App.tsx`.
- Updated `tests/snapshots/product.test.tsx` and `tests/snapshots/sign-in.test.tsx` for the new navigation/theme wrappers.
- `tests/unit/touch-target.test.ts` — excluded test files from glob; `src/components/AuthBackButton.tsx` gained `minHeight: 44` to satisfy the touch-target rule.

## Verification Commands

```bash
# Type check
npm run typecheck
# Result: clean (tsc --noEmit passes)

# Test suite
npm test
# Result: 43 passed, 0 failed; 158 tests, 16 snapshots
```

## Remaining Expo Imports

Grep confirmed no Expo package imports (`expo-*`, `@expo/*`) remain in `src/` or `app/`. Only false positives such as `export` keyword and the theme name `expyrico` remain.

## Concerns / Follow-up

1. **Native iOS linkage** is out of scope for this source phase. The following packages need native iOS pods and Info.plist scheme config in a later phase: `react-native-boot-splash`, `react-native-vision-camera`, `react-native-keychain`, `@invertase/react-native-apple-authentication`, `@react-native-firebase/messaging`, `react-native-config`.
2. **Android already de-Expo'd**; these modules must be verified against the new `MainActivity` / `MainApplication` after the source port lands.
3. **Deep-link scheme** (`Expyrico://`) is handled in `App.tsx`, but the platform manifest/Info.plist scheme registration is not part of this change.
4. **Route directory still under `app/`** for compatibility with the existing build entry; moving to `src/screens/` is a follow-up refactor if desired.

Status: DONE
Concerns: see items 1–4 above.
