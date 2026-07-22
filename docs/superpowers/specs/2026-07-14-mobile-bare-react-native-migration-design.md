# Expyrico mobile bare React Native migration design

> **Superseded for execution (2026-07-21).** This design remains historical context only. The executable record is `plans/260714-0728-mobile-bare-rn-migration/` (collapsed direct cutover after Expo removal). Do not treat commands or sequencing in this file as current runbook.

## Goal

Remove Expo completely from the Expyrico runtime. The app must remain a single React Native codebase for Android and iOS, build Android release APKs with the local Gradle toolchain, and install/test them through `adb`. The API push sender must also move off the Expo Push service so native device tokens remain deliverable. No Expo package, runtime wrapper, launcher, build command, active configuration, or current operational instruction may remain.

This migration preserves the approved Expyrico visual redesign, palette, theme behavior, routes, authentication security, offline sync, feature behavior, and every API contract except the push-token fields that must change for native FCM delivery.

## Constraints and acceptance criteria

- `apps/mobile/package.json` contains no `expo`, `expo-*`, `@expo/*`, `babel-preset-expo`, or `jest-expo` dependency, script, or entrypoint, and `api/package.json` contains no Expo push SDK.
- Android starts with the standard React Native application host and `AppRegistry`; it has no Expo lifecycle dispatcher, React host wrapper, development launcher, or Expo modules dependency.
- Because no `apps/mobile/ios/` project exists today, create a standard React Native 0.76.9 iOS host. It has no Expo pods, AppDelegate wrappers, plugins, or build scripts.
- Mobile navigation uses React Navigation, not Expo Router. Deep links, signed-in redirects, signed-out redirects, tabs, parameterized routes, and Android back behavior are preserved.
- Android release build uses only the project’s local Gradle command. Installation and verification use `adb`; no Expo CLI, EAS, Expo Go, development client, or over-the-air update runtime is used.
- The shared push-token contract, Prisma schema, API sender, worker, and tests use native FCM registration tokens and Firebase Admin rather than the Expo Push service.
- All current operational docs and tests describe the bare React Native workflow and use non-Expo mocks/configuration. Dated specs/plans remain historical records but receive a superseded notice where they otherwise look executable.
- Root and mobile tooling use Community CLI 15.x consistently, the supported CLI line for React Native 0.76; no older root CLI may be selected by Gradle or package scripts.
- Native builds select React Native Config through `ENVFILE`. Credential-free checks use a committed non-secret `.env.example` whose API host is a reserved, non-routable `.invalid` domain; real Firebase/Google/passkey configuration uses ignored local files or external credentials.
- Authentication and data-mutating acceptance tests run only against disposable local services or an explicitly approved non-production environment. The `.env.example` release is limited to compile and launch/runtime smoke, so following this design cannot write test accounts or reset requests to a live-looking API.
- Navigation and push-contract cutovers are committed atomically: no branch commit may ship converted route components under the filesystem router or expose only one side of the native device-token contract.

## Architecture

### Application entry and platform hosts

Create a conventional React Native entrypoint that registers the root component through `AppRegistry`. Replace the Expo-wrapped Android application host with React Native’s standard `DefaultReactNativeHost`, retaining the current React Native new-architecture and Hermes settings. Remove Expo configuration files, plugin hooks, and generated identifiers only when their React Native equivalents are in place.

The root application provider retains the existing query client, safe-area provider, gesture root, theme provider, session hydration, API wiring, and sync-trigger lifecycle. Splash visibility moves to the native Android/iOS launch screens and a small in-app bootstrap overlay; it must never depend on an Expo splash API.

### Navigation and deep links

Replace the `app/` filesystem router with explicit React Navigation navigators:

- A root stack decides between the authentication and authenticated trees after session hydration.
- The authenticated tree contains the existing bottom tabs plus stack routes for scan, product, record, deal, giveaway, invite, review, household, and settings flows. Giveaway claims remain actions within the existing giveaway screens rather than becoming an invented route.
- The authentication tree contains welcome, sign-in, sign-up, verification OTP, password recovery, reset, and related identity routes.
- A central linking configuration maps the current supported URLs, including invite/referral links, to equivalent screens and parameters.

Route components keep their feature responsibilities. Only navigation imports, route parameters, and route tests change.

### Native capability replacements

Each Expo module is replaced with a maintained bare React Native solution or platform API:

| Current Expo capability | Bare React Native replacement |
| --- | --- |
| Expo Router | React Navigation stack and bottom tabs |
| Expo secure store | `react-native-keychain` for credentials plus Async Storage for non-secrets |
| Expo camera barcode scan | Vision Camera plus barcode scanning integration |
| Expo notifications | React Native Firebase Cloud Messaging |
| Expo linking | React Native `Linking` plus a validated referral URL handler |
| Expo splash screen | native launch screen plus in-app bootstrap overlay |
| Expo status bar | React Native `StatusBar` |
| Expo Apple authentication | native Apple authentication package for iOS |
| Expo vector icons | `react-native-vector-icons` or a small locally-owned SVG icon set |
| Expo device/constants/assets | React Native platform APIs and asset bundling |
| Expo updates/dev client | removed; distribution is through locally built APKs |

The selected compatibility baseline is Community CLI 15.0.0, React Navigation Native 7.3.8, Native Stack 7.17.10, Bottom Tabs 7.18.2, `react-native-keychain` 9.2.3, Async Storage 3.1.1, Vision Camera 4.7.2, React Native Firebase 21.12.0, React Native Apple Authentication 2.5.1, React Native Vector Icons 10.3.0, React Native Config 1.6.0, and Firebase Admin 13.5.0. Community CLI 15 is the supported line for React Native 0.76. Exact package installation must still be checked against React Native 0.76.9 peer requirements before the lockfile is committed. A separate local-notification library is not added because the current product only registers remote push tokens; FCM notification payloads preserve that behavior without another runtime dependency.

### Route contract

The authentication stack contains Welcome, Sign in, Sign up, Verify email, Forgot password, Verify reset code, and Reset password. The authenticated tab navigator preserves the existing six tabs: Home, Giveaways, Deals, Browse, Reviews, and Profile. The authenticated stack contains Scan; product detail, review, and create; record detail; deal detail and editor; giveaway detail, manage, rate, mine, and create; household; invite; report; settings; appearance; passkey; notification settings; and account settings.

All route parameters are typed. Entity IDs are required strings; product creation accepts optional `barcode` and `qr`; deal editor accepts optional `editId`; report requires a validated target type and ID; email/reset routes accept only the values produced by the preceding auth step. Existing path strings are replaced with route names rather than parsed by a compatibility shim.

Only `expyrico://invite?code=...` is a supported external link in this migration. Both cold-start and running-app URLs validate and capture the referral code. Other route links are not advertised until their authentication and parameter contracts are designed separately. Android Back pops the active stack and exits normally at its root; tab state remains mounted.

The two settings destinations currently linked but missing from the filesystem router are completed as part of this migration: Notification settings exposes permission state and the native system-settings action; Account settings exposes the existing identity details, passkey entry, and sign-out action. This closes existing broken links without adding new backend behavior.

The generated iOS target preserves Google callback and passkey requirements. Its Google URL scheme comes from external build configuration, and its Associated Domains entitlement uses the production WebAuthn relying-party domain. Signed-device passkey verification additionally requires that domain’s Apple App Site Association file to list `<APPLE_TEAM_ID>.com.expyrico.app` under `webcredentials.apps`.

### Push delivery contract

Migrate the end-to-end push contract from `expoPushToken` to a native FCM `deviceToken`. Rename the Prisma token field and provider-message log field through a forward migration, revoke legacy tokens during that migration, and require clients to register a fresh native token. The worker sends through Firebase Admin, writes one result per device, and revokes tokens rejected as unregistered or invalid. Credentials are injected through untracked Firebase platform configuration and Application Default Credentials; no API key, service-account JSON, or signing material is committed.

Credential-free local builds must still compile and launch: when no Firebase native app is initialized, push registration is explicitly unavailable rather than crashing bootstrap. Real delivery becomes an external verification gate once the untracked platform files and server credentials are supplied.

### Persisted-data transition

Authentication tokens move to named Keychain services. Theme preference, referral code, sync cursor, and registration flags move to Async Storage because they are not credentials. The old encrypted Expo storage is not reimplemented: the first bare build requires one sign-in and defaults appearance to System until the user changes it. This one-time transition is safer than duplicating a legacy encryption implementation.

### Theme and visual system

The existing System/Light/Dark behavior and Expyrico palette remain unchanged. The migration must not restore prior visual variants or alter semantic color assignments. The redesigned shared controls and screen families move intact into the React Navigation screen tree.

### Tooling, tests, and documentation

Replace Expo Babel/Jest setup and mocks with standard React Native equivalents. Rewrite mobile build/run documentation so the only Android instructions are the direct local Gradle build commands and `adb` install/screenshot/test commands. Remove stale Expo commands from package scripts and contributor documents.

## Migration sequence

1. Add the bare-compatible dependency and configuration baseline while the existing runtime still provides a testable reference.
2. Migrate navigation and deep linking with route-level tests.
3. Replace secure storage, camera, notifications, Apple sign-in, status bar, splash, icons, and supporting APIs one capability at a time.
4. Migrate the shared push contract, database columns, API sender, worker, and mobile registration to Firebase Cloud Messaging.
5. Switch to the standard Android entry/host, generate the missing React Native 0.76.9 iOS host, and remove the old packages/configuration only after their last imports are gone.
6. Rewrite active operational documentation, rebuild the Android release APK locally, install it with `adb`, and verify the redesigned welcome/auth/home/pantry/community/account flows in light, dark, and System appearance modes.

## Verification

- `pnpm why expo -r` shows no installed Expo runtime; source/config scans show no Expo import, package, plugin, launcher, EAS command, or active operational instruction. Policy and dated migration/history documents may name the removed technology to explain the prohibition or historical decision.
- Route, auth, theme, native-adapter, and shared-control tests pass after their respective migration batch.
- TypeScript, mobile lint, and the affected API/shared checks pass before release verification.
- A local Gradle release build succeeds from `apps/mobile` and `adb install -r` installs the APK on the emulator.
- Verification preflights the tools actually available on the Mac: the Android Build Tools `dexdump`, Bundler 2.4.22/CocoaPods 1.16.2, and pinned Maestro 2.4.0. It does not assume `apkanalyzer` exists.
- APK/Dex inspection contains no `expo.modules`, Expo development launcher, or over-the-air update classes. Expo Go (`host.exp.exponent`) is removed from the verification emulator before testing.
- ADB/UI checks prove: no Expo launcher; welcome shows both Create account and Sign in; auth navigation works; home/pantry/community/account open; camera permission flow is reachable; theme follows System unless manually overridden.
- Push verification covers permission denial/grant, token refresh, foreground receipt, background delivery, notification-tap app launch/resume, invalid-token revocation, and logout cleanup when Firebase test credentials are supplied outside Git. Notification-driven record routing is not introduced by this runtime migration.
- `xcodebuild` compiles the generated iOS host without signing; a signed/archive build is outside this Android delivery gate.

## Non-goals

- No Expo compatibility layer, Expo Go fallback, EAS configuration, or over-the-air update service.
- No backend API, database, authorization, or product-flow redesign outside the push-token and push-delivery contract required to remove the Expo service.
- No changes to the approved Expyrico color palette or the manual appearance override behavior.
