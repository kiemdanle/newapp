# Expyrico mobile bare React Native migration design

## Goal

Remove Expo completely from the Expyrico mobile application. The app must remain a single React Native codebase for Android and iOS, build Android release APKs with the local Gradle toolchain, and install/test them through `adb`. No Expo package, Expo runtime wrapper, Expo launcher, Expo build command, Expo configuration, or Expo documentation may remain.

This migration preserves the approved Expyrico visual redesign, palette, theme behavior, routes, API contracts, authentication security, offline sync, and feature behavior. It changes the mobile runtime and integration boundaries only.

## Constraints and acceptance criteria

- `apps/mobile/package.json` contains no `expo`, `expo-*`, `@expo/*`, `babel-preset-expo`, or `jest-expo` dependency, script, or entrypoint.
- Android starts with the standard React Native application host and `AppRegistry`; it has no Expo lifecycle dispatcher, React host wrapper, development launcher, or Expo modules dependency.
- iOS configuration has no Expo pods, AppDelegate wrappers, plugins, or build scripts.
- Mobile navigation uses React Navigation, not Expo Router. Deep links, signed-in redirects, signed-out redirects, tabs, parameterized routes, and Android back behavior are preserved.
- Android release build uses only the project’s local Gradle command. Installation and verification use `adb`; no Expo CLI, EAS, Expo Go, development client, or over-the-air update runtime is used.
- All mobile docs and tests describe the bare React Native workflow and use non-Expo mocks/configuration.

## Architecture

### Application entry and platform hosts

Create a conventional React Native entrypoint that registers the root component through `AppRegistry`. Replace the Expo-wrapped Android application host with React Native’s standard `DefaultReactNativeHost`, retaining the current React Native new-architecture and Hermes settings. Remove Expo configuration files, plugin hooks, and generated identifiers only when their React Native equivalents are in place.

The root application provider retains the existing query client, safe-area provider, gesture root, theme provider, session hydration, API wiring, and sync-trigger lifecycle. Splash visibility moves to the native Android/iOS launch screens and a small in-app bootstrap overlay; it must never depend on an Expo splash API.

### Navigation and deep links

Replace the `app/` filesystem router with explicit React Navigation navigators:

- A root stack decides between the authentication and authenticated trees after session hydration.
- The authenticated tree contains the existing bottom tabs plus stack routes for scan, product, record, deal, giveaway, claim, invite, review, household, profile, and settings flows.
- The authentication tree contains welcome, sign-in, sign-up, verification OTP, password recovery, reset, and related identity routes.
- A central linking configuration maps the current supported URLs, including invite/referral links, to equivalent screens and parameters.

Route components keep their feature responsibilities. Only navigation imports, route parameters, and route tests change.

### Native capability replacements

Each Expo module is replaced with a maintained bare React Native solution or platform API:

| Current Expo capability | Bare React Native replacement |
| --- | --- |
| Expo Router | React Navigation stack and bottom tabs |
| Expo secure store | `react-native-keychain` |
| Expo camera barcode scan | Vision Camera plus barcode scanning integration |
| Expo notifications | Firebase Cloud Messaging plus a local notification library |
| Expo linking | React Native `Linking` plus React Navigation linking config |
| Expo splash screen | native launch screen plus in-app bootstrap overlay |
| Expo status bar | React Native `StatusBar` |
| Expo Apple authentication | native Apple authentication package for iOS |
| Expo vector icons | `react-native-vector-icons` or a small locally-owned SVG icon set |
| Expo device/constants/assets | React Native platform APIs and asset bundling |
| Expo updates/dev client | removed; distribution is through locally built APKs |

Package selection must use current official library documentation and support React Native 0.76 before installation. The migration does not change the backend push-notification API contract; it replaces only the device token registration and client delivery implementation.

### Theme and visual system

The existing System/Light/Dark behavior and Expyrico palette remain unchanged. The migration must not restore prior visual variants or alter semantic color assignments. The redesigned shared controls and screen families move intact into the React Navigation screen tree.

### Tooling, tests, and documentation

Replace Expo Babel/Jest setup and mocks with standard React Native equivalents. Rewrite mobile build/run documentation so the only Android instructions are the direct local Gradle build commands and `adb` install/screenshot/test commands. Remove stale Expo commands from package scripts and contributor documents.

## Migration sequence

1. Introduce the bare React Native entrypoint and native hosts while retaining feature code.
2. Migrate navigation and deep linking with route-level tests.
3. Replace secure storage, camera, notifications, Apple sign-in, status bar, splash, icons, and supporting APIs one capability at a time.
4. Remove Expo dependencies, configuration, mocks, scripts, and documentation once no imports remain.
5. Rebuild the Android release APK locally, install it with `adb`, and verify the redesigned welcome/auth/home/pantry/community/account flows in light, dark, and System appearance modes.

## Verification

- Dependency and source scans show no Expo package, import, config, mock, script, or documentation reference in the mobile app.
- Route, auth, theme, native-adapter, and shared-control tests pass after their respective migration batch.
- TypeScript and scoped lint pass; unrelated pre-existing lint errors are reported separately rather than hidden.
- A local Gradle release build succeeds from `apps/mobile` and `adb install -r` installs the APK on the emulator.
- ADB/UI checks prove: no Expo launcher; welcome shows both Create account and Sign in; auth navigation works; home/pantry/community/account open; camera permission flow is reachable; theme follows System unless manually overridden.

## Non-goals

- No Expo compatibility layer, Expo Go fallback, EAS configuration, or over-the-air update service.
- No backend API, database, authorization, or product-flow redesign.
- No changes to the approved Expyrico color palette or the manual appearance override behavior.
