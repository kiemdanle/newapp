---
phase: 1
title: "Foundation cleanup: theme, dead variants, NativeWind decision"
status: pending
priority: P2
dependencies: []
---

# Phase 1: Foundation cleanup — theme, dead variants, NativeWind decision

## Overview

Cheap, low-risk cleanup done first: finish the already-started theme constraint, delete the dead visual-variant code, and make an explicit decision about NativeWind. This is NOT a gate that shrinks the migration (red-team F13 corrected that claim) — it is independent cleanup that removes noise before the risky work. Refresh the vendored `@expyrico/theme` dist so the toolchain sees the changes.

## Requirements

- Functional: only `system`/`expyrico`/`expyricoDark` remain selectable (already enforced at `store.ts:12`); the Appearance UI copy and the dead `material` branch are corrected; the three non-Expyrico theme families and eight variant components are deleted; a documented decision exists for NativeWind.
- Non-functional: palette/semantics unchanged; no new hard-coded hex; both vendored + pnpm-store `@expyrico/theme` dist copies refreshed.

## Architecture

Current state (verified): `VALID_IDS = ['system','expyrico','expyricoDark']` is already set (`store.ts:12`), but lag remains:
- `app/(app)/settings/theme.tsx` copy still says "Pick one of four looks".
- `app/(app)/settings/index.tsx:55` branches on `theme.id === 'material'` → `MD3ListRow` (the only live variant import).
- `packages/theme/src/index.ts:4-12` exports `bento`/`clay`/`material`; `tokens.ts:4` `ThemeId` union includes them; `src/theme/sync.ts:7` `SERVER_THEME_IDS` lists all four.
- 7 of 8 variant components (`BentoTile`, `ClayButton`, `ClayCard`, `GlassCard`, `MD3Chip`, `MD3FAB`, `MD3TextField`) have ZERO live imports; only `MD3ListRow` has one (behind the dead `material` branch).

**NativeWind decision (red-team F4; validation 2026-07-14 → REMOVE):** NativeWind is wired through `babel-preset-expo` (`jsxImportSource: 'nativewind'`), `nativewind/babel`, and `metro.config.js` `withNativeWind`, but there are **0 `className=` usages** in `app/` or `src/`. Decision: **remove** NativeWind/tailwind/react-native-css-interop entirely — delete `global.css`, its `_layout.tsx` import, the `metro.config.js` `withNativeWind` wrapper, the `jest.config.js` nativewind pattern, and the three deps (`nativewind`, `tailwindcss`, `react-native-css-interop`). Nothing consumes it, and removal means phase 11 has no NativeWind JSX transform to re-wire onto the stock preset. <!-- Updated: Validation Session 1 - NativeWind removed (0 className usages) -->

## Related Code Files

- Modify: `app/(app)/settings/theme.tsx` (copy → three options), `app/(app)/settings/index.tsx` (remove `material` branch + `MD3ListRow` import), `packages/theme/src/index.ts`, `packages/theme/src/tokens.ts` (`ThemeId` → `'expyrico'|'expyricoDark'`), `src/theme/sync.ts` (`SERVER_THEME_IDS`)
- Delete: `packages/theme/src/themes/{bento,clay,material}.ts`; `src/components/{BentoTile,ClayButton,ClayCard,GlassCard,MD3Chip,MD3FAB,MD3ListRow,MD3TextField}.tsx`
- Conditional (NativeWind removal): delete `global.css`, remove its import in `app/_layout.tsx`, `metro.config.js` `withNativeWind`, `jest.config.js` nativewind pattern, and deps in `package.json`
- Refresh: `apps/mobile/local-packages/@expyrico/theme/dist/` (committed) AND the pnpm virtual-store copy

## Implementation Steps

1. Fix `settings/theme.tsx` copy and options to exactly three; remove the `theme.id === 'material'` branch + `MD3ListRow` import in `settings/index.tsx`.
2. Remove `bento`/`clay`/`material` from `packages/theme` exports, `ThemeId`, and `SERVER_THEME_IDS`. Delete the three theme files and the eight variant components (all verified import-free except the just-removed `MD3ListRow`).
3. Remove NativeWind (validation decision): delete `global.css` + its `_layout.tsx` import, the `metro.config.js` `withNativeWind` wrapper, the `jest.config.js` nativewind pattern, and the `nativewind`/`tailwindcss`/`react-native-css-interop` deps. Confirm `grep -rn "nativewind\|global.css\|css-interop" apps/mobile` is clean.
4. Rebuild `@expyrico/theme`; refresh BOTH the committed vendored dist and the pnpm-store copy; assert the app/jest load the rebuilt dist (not a stale export).
5. Run theme tests + typecheck + lint.

## Success Criteria

- [ ] Precise-specifier grep (NOT bare `material`, per red-team F9) shows zero live imports: `grep -rn "themes/\(bento\|clay\|material\)\|BentoTile\|ClayButton\|ClayCard\|GlassCard\|MD3Chip\|MD3FAB\|MD3ListRow\|MD3TextField" apps/mobile/src apps/mobile/app packages/theme/src` returns only deletions/docs.
- [ ] Appearance screen offers exactly System/Light/Dark; `ThemeId` and `SERVER_THEME_IDS` contain only `expyrico`/`expyricoDark`.
- [ ] NativeWind decision documented and executed; if removed, `grep -rn "nativewind\|global.css\|css-interop" apps/mobile` is clean.
- [ ] Rebuilt `@expyrico/theme` dist present in BOTH copies; theme tests + typecheck + lint pass.

## Risk Assessment

- Substring grep false positives (`material` in domain/library text, F9) → gate on exact import specifiers and the export list in `index.ts`.
- Stale vendored theme dist (F9) → refresh both copies and assert load before proceeding.
- Removing NativeWind could surprise if a future phase wanted utility classes → documented decision; 0 current usages makes removal safe and simplifies phase 11.
