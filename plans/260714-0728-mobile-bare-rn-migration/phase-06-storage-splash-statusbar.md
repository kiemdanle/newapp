---
phase: 6
title: "Storage, splash, status bar capabilities"
status: pending
priority: P1
dependencies: [5]
---

# Phase 6: Storage, splash, status bar capabilities

## Overview

First half of the capability replacements (red-team F11 split the original 8-in-one phase): the lower-risk, no-camera group — secure storage, splash/bootstrap lifecycle, status bar, linking, icons, device/constants/assets. Owns auth/storage/splash files. May run in parallel with phase 7 (disjoint file ownership) but both depend on the phase-5 flip.

## Requirements

- Functional: credentials in named Keychain services; non-secrets in Async Storage; splash via native launch screen + in-app bootstrap overlay; StatusBar/icons/linking/device via RN/platform APIs.
- Non-functional: the splash rewrite preserves the exact lifecycle invariants hardened in recent commits (red-team F8); credential-free build launches without crashing.

## Architecture

**Secure storage transition:** re-implement `src/auth/secure-store.ts` over `react-native-keychain` (credentials) + Async Storage (non-secrets: theme preference, referral code, sync cursor, registration flags), preserving the public API and `ThemePreference` type consumed by `src/theme/store.ts`. Old encrypted Expo storage is NOT reimplemented — first bare build requires one sign-in and defaults appearance to System.

**Splash (red-team F8 — do not regress recent fixes):** the current `app/_layout.tsx` splash handling was deliberately hardened (commits `e8b17e4` dismiss-after-hydration, `f74c945` handle-lifecycle-failures). The bare replacement MUST preserve these invariants: dismiss only after BOTH `themeHydrated` AND `sessionHydrated`; swallow splash-API rejections (`.catch`); route boot failures into `setBootError` instead of hanging. Replace `expo-splash-screen` with a native launch screen + in-app bootstrap overlay wired to the same hydration gate.

**Others:** `expo-status-bar` → RN `StatusBar`; `@expo/vector-icons` → `react-native-vector-icons` or a small local SVG set; `expo-linking` residual (non-invite) → RN `Linking`; `expo-device`/`expo-constants`/`expo-asset` → RN platform APIs + asset bundling.

## Related Code Files

- Modify: `src/auth/secure-store.ts` (+ `.test.ts`), `src/auth/session-store.ts` (+ `.test.ts`)
- Modify: `app/_layout.tsx`/root provider splash + bootstrap overlay; StatusBar usage; icon adapter; residual Linking; device/constants/assets usages
- Create: native launch screen assets; in-app bootstrap overlay component

## Implementation Steps

1. Re-implement `secure-store` over keychain + async-storage, preserving public API + `ThemePreference`; migrate session-store; update tests/mocks.
2. Replace splash: native launch screen + bootstrap overlay; wire dismissal to `themeHydrated && sessionHydrated`; preserve `.catch` guards and `setBootError` routing. Add a test for the hydration-rejection path.
3. Replace status bar, icons, residual linking, device/constants/assets with RN/platform equivalents.
4. Typecheck + lint + run storage/splash tests.

## Success Criteria

- [ ] No `expo-secure-store`, `expo-splash-screen`, `expo-status-bar`, `@expo/vector-icons`, `expo-device`, `expo-constants`, `expo-asset`, or residual `expo-linking` import remains in the files this phase owns.
- [ ] Splash dismisses only after both hydrations; splash-API rejections swallowed; boot errors surfaced (hydration-rejection test passes).
- [ ] Credential-free build launches without crashing; storage/splash tests + typecheck + lint pass.

## Risk Assessment

- Splash regression re-introducing the exact race the recent commits fixed (F8) → enumerate + test the three invariants.
- Keychain re-implementation breaking hydration → preserve public API + `ThemePreference`; run session/secure-store tests first.
- One-time storage transition forces re-sign-in → documented; verify clean first-launch.
