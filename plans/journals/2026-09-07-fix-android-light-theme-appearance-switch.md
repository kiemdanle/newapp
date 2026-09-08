---
title: Fixed Android Light Theme Appearance Switching and System Display Mode Label
date: 2026-09-07
summary: "Resolved two issues in Appearance settings: 1) Android 10+/MIUI Force Dark Mode overriding in-app Light appearance when system night mode was enabled, and 2) System mode card description mirroring in-app active theme instead of actual device OS colorScheme."
---

# Fixed Android Light Theme Appearance Switching and System Display Mode Label

## Issues Diagnosed
1. **Light Appearance Inversion**: On Android devices with system Night Mode active (Xiaomi MI 9, Android 11, `cmd uimode night yes`), selecting the **Light** theme option in Profile -> Settings -> Appearance rendered dark backgrounds and white text because Android 10+ / MIUI's Force Dark engine intercepted and inverted light surfaces.
2. **System Device Mode Desynchronization**: On the Appearance screen, the subtitle under the **System** card was displaying `"Device light"` when in-app Light theme was active (and `"Device dark"` when in-app Dark theme was active), regardless of whether the device OS was actually set to Night mode or Light mode.

## Root Cause
1. **Missing `forceDarkAllowed="false"`**: `apps/mobile/android/app/src/main/res/values/styles.xml` and version-specific styles lacked `<item name="android:forceDarkAllowed">false</item>`, enabling the OS Force Dark engine to invert `#FAFAF8` into `#1F1F1D`.
2. **System Card Read `active.scheme` Instead of `useColorScheme()`**: In `apps/mobile/app/(app)/settings/theme.tsx`, the System card's description was coded as `Device ${active.scheme === 'dark' ? 'dark' : 'light'}` and `theme={active}` where `active` came from `useTheme()` (the current in-app theme), rather than reading `useColorScheme()` (the system device setting).

## Changes Applied
1. **Disabled Android Force Dark in Native Styles**:
   - `apps/mobile/android/app/src/main/res/values/styles.xml`
   - `apps/mobile/android/app/src/main/res/values-night/styles.xml`
   - `apps/mobile/android/app/src/main/res/values-v31/styles.xml`
   - `apps/mobile/android/app/src/main/res/values-night-v31/styles.xml`
   - Added `<item name="android:forceDarkAllowed" tools:targetApi="q">false</item>`.
2. **Wired System Card to Actual Device `useColorScheme()` (`settings/theme.tsx`)**:
   - Imported `useColorScheme` from `react-native`.
   - Resolved `systemScheme = useColorScheme()` and `systemTheme = systemScheme === 'dark' ? themes.expyricoDark : themes.expyrico`.
   - Updated System card to `description={`Device ${systemScheme === 'dark' ? 'dark' : 'light'}`}` and `theme={systemTheme}`.
3. **Explicit Root Background & Native Stack Theming**:
   - Set `<View style={[styles.root, { backgroundColor: active.colors.bg }]}>` in `settings/theme.tsx`.
   - Passed `headerStyle`, `headerTintColor`, and `contentStyle` driven by `theme.colors` in `AppNavigator.tsx`.
4. **Automated Tests**:
   - Added unit test in `__tests__/routes/theme.test.tsx` asserting that System card displays `"Device dark"` when system is in dark mode (even with in-app Light selected) and `"Device light"` when system is in light mode.

## Verification
- Captured on-device screenshots via ADB under both `cmd uimode night yes` and `cmd uimode night no`.
- When system night mode is `yes`: System card correctly displays `"Device dark"`, and selecting Light displays the true Warm White `#FAFAF8` theme.
- When system night mode is `no`: System card correctly displays `"Device light"`.
- Unit tests, snapshot tests, typecheck, and local Gradle APK assembly verified.
