---
phase: 11
title: "Expo removal and Babel/Jest/Metro preset swap"
status: pending
priority: P1
dependencies: [10]
---

# Phase 11: Expo removal and Babel/Jest/Metro preset swap

## Overview

Remove every Expo package, config, and generated identifier now that phases 3–10 have eliminated the last imports and both hosts are standard RN. Replace the load-bearing Babel/Jest/Metro Expo presets with hand-authored RN equivalents that preserve reanimated ordering, WatermelonDB decorators, and pnpm-aware Jest resolution (red-team F4/F6). NativeWind was removed in phase 1 (validation decision, 0 `className=` usages), so there is no NativeWind JSX transform to re-wire here.

## Requirements

- Functional: no `expo`/`expo-*`/`@expo/*`/`babel-preset-expo`/`jest-expo` in `apps/mobile/package.json`; `app.config.ts`, `eas.json`, and Expo config deleted; the mobile Jest suite loads and passes; reanimated + WatermelonDB decorators still transform.
- Non-functional: `pnpm why expo -r` shows no Expo runtime.

## Architecture

**Preset swap (red-team F6 — this was one hand-waved bullet in the original plan):**
- `babel.config.js`: replace `babel-preset-expo` with `@react-native/babel-preset`. Preserve `['@babel/plugin-proposal-decorators', { legacy: true }]` (WatermelonDB models, `babel.config.js:14`) and the `react-native-reanimated/plugin` (must remain LAST in the plugins list). Drop the `jsxImportSource: 'nativewind'` option and `nativewind/babel` entry (NativeWind removed in phase 1).
- `jest.config.js`: replace `preset: 'jest-expo'` with RN's jest preset. Hand-author the pnpm-aware `transformIgnorePatterns` (pnpm's non-flat `node_modules/.pnpm/...` layout) and any `moduleNameMapper`/tsconfig-path resolution that jest-expo previously folded in.
- `metro.config.js`: `withNativeWind` was already removed in phase 1; confirm the bare-RN metro config has no NativeWind wrapper remaining.

**Removal:** delete `app.config.ts`, `eas.json`, Expo splash config, and every Expo dependency from `package.json`. Remove Expo-only `stubs/`/`local-packages` entries. `main` already points at the AppRegistry entry (phase 9).

Gate every deletion on a zero-import grep + a successful build/test run — remove only after the last consumer is gone.

## Related Code Files

- Modify: `apps/mobile/babel.config.js`, `apps/mobile/jest.config.js`, `apps/mobile/metro.config.js`, `apps/mobile/package.json`
- Delete: `app.config.ts`, `eas.json`, Expo splash config, Expo-only stubs

## Implementation Steps

1. Swap `babel-preset-expo` → `@react-native/babel-preset`, preserving legacy decorators + reanimated-plugin-last; re-wire or drop NativeWind per the phase-1 decision.
2. Swap `jest-expo` → RN jest preset; hand-author pnpm-aware `transformIgnorePatterns` + module mapping; run the FULL mobile Jest suite and confirm it loads + passes.
3. Adjust `metro.config.js` for bare RN (drop/keep NativeWind wrapper per decision).
4. Delete `app.config.ts`, `eas.json`, Expo splash config, and all Expo deps; run `pnpm why expo -r` → none.
5. Rebuild Android + iOS to confirm nothing regressed.

## Success Criteria

- [ ] No `expo`/`@expo`/`babel-preset-expo`/`jest-expo` in `apps/mobile/package.json`; `pnpm why expo -r` shows no Expo runtime; `app.config.ts` + `eas.json` deleted.
- [ ] Full mobile Jest suite loads and passes under the RN preset (pnpm resolution works); reanimated + WatermelonDB decorators transform.
- [ ] If NativeWind kept, a styled screen renders; if dropped, no `nativewind` reference remains. Both hosts still build.

## Risk Assessment

- Dropping NativeWind JSX transform or reanimated ordering silently (F6) → explicit sub-steps + a styled-screen render check (or removal verification).
- Losing jest-expo's pnpm resolver → hand-author `transformIgnorePatterns`; gate on the full suite loading, not a spot test.
- Removing an Expo dep still imported → zero-import grep + build/test gate before each deletion.
