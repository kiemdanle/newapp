---
name: code-reviewer-phase-01-foundation-cleanup
metadata:
  type: reference
---

# Phase 1 Foundation Cleanup Review

## Status
DONE_WITH_CONCERNS

## Summary
Phase 1 successfully removes the dead Bento/Clay/Material theme variants and their components, constrains the theme system to expyrico/expyricoDark, documents the NativeWind removal decision, and refreshes the vendored `@expyrico/theme` dist. Theming code, typechecks, and the targeted theme/sync/contrast tests pass. The 11 pre-existing mobile lint errors remain unchanged and are correctly scoped to unrelated app/src files.

## Concerns/Blockers
1. **Pre-existing snapshot regressions outside the phase's stated scope.** `tests/snapshots/settings.test.tsx`, `tests/snapshots/home.test.tsx`, `tests/snapshots/sign-in.test.tsx`, `__tests__/DealForm.test.tsx`, and `tests/unit/touch-target.test.ts` fail. These failures are not introduced by the files changed in this phase; they appear to be stale snapshots and a touch-target regression from earlier commits. They are not required by the phase acceptance criteria, but they mean the full mobile test suite is red.
2. **Independent verification of the pnpm-store copy of `@expyrico/theme` dist was initially blocked.** The size-based privacy hook denies access to `node_modules`. After the review, the controller was able to verify (via the `!dist` / `!node_modules/.pnpm/@expyrico+theme*` exceptions in `.claude/.ckignore`) that the pnpm-store copy was refreshed and matches the committed vendored dist. The `file:` resolution also points to the vendored copy, and targeted theme tests pass.
3. **`.eslintrc.cjs` ignores `__tests__/` and `local-packages/`**, not `tests/`. `__tests__/` is not included in `tsconfig.json`, so linting it produces a parser error; ignoring it avoids that pre-existing misconfiguration. `local-packages/` contains generated vendored dist and should not be linted. `tests/` remains linted.

## Verification Commands Run and Results

1. **Dead theme/component import check**
   Command: `grep -rn "themes/\(bento\|clay\|material\)\|BentoTile\|ClayButton\|ClayCard\|GlassCard\|MD3Chip\|MD3FAB\|MD3ListRow\|MD3TextField" apps/mobile/src apps/mobile/app packages/theme/src`
   Result: no output (pass).

2. **NativeWind removal check**
   Command: `grep -rn "nativewind\|tailwindcss\|css-interop\|global.css" apps/mobile/src apps/mobile/app apps/mobile/package.json apps/mobile/metro.config.js apps/mobile/jest.config.js apps/mobile/babel.config.js`
   Result: no output (pass).
   Broader check across `apps/mobile` also returned nothing.

3. **Appearance screen / ThemeId / SERVER_THEME_IDS**
   - `apps/mobile/app/(app)/settings/theme.tsx` presents exactly System, Light, Dark.
   - `packages/theme/src/tokens.ts` defines `ThemeId = 'expyrico' | 'expyricoDark'`.
   - `apps/mobile/src/theme/sync.ts` defines `SERVER_THEME_IDS = ['expyrico']`.
   - `apps/mobile/src/theme/store.ts` validates `['system', 'expyrico', 'expyricoDark']`.

4. **Theme dist refresh**
   - `apps/mobile/local-packages/@expyrico/theme/dist/index.d.ts` exports only `expyrico` and `expyricoDark`.
   - `apps/mobile/local-packages/@expyrico/theme/dist/tokens.d.ts` defines `ThemeId = 'expyrico' | 'expyricoDark'`.
   - `cd packages/theme && pnpm build` succeeded.
   - `pnpm jest tests/unit/contrast.test.ts tests/snapshots/theme-switcher.test.tsx src/theme/sync.test.ts` passed (7 tests, 2 snapshots).
   - The pnpm-store copy could not be independently inspected due to the `node_modules` privacy hook, but the `file:` resolution and passing tests confirm the committed vendored dist is the source the toolchain uses.

5. **Typechecks**
   - `cd packages/theme && pnpm typecheck` — passed.
   - `cd apps/mobile && pnpm typecheck` — passed.

6. **Lint**
   - `pnpm lint` — failed with 11 errors, identical to the pre-existing set noted in the phase constraints:
     - `app/(app)/deal/new.tsx:31`
     - `app/(app)/giveaway/new.tsx:3,50,59,69`
     - `src/features/deals/useOptimisticDealVote.ts:15`
     - `src/features/giveaways/TransactionRatingForm.tsx:63`
     - `src/features/households/AddMemberForm.tsx:47`
     - `src/features/households/MemberRow.tsx:13`
     - `src/features/households/ScopeToggle.tsx:8`
     - `src/features/records/UseNextHero.tsx:12`
   - None of the modified files from this phase appear in the lint error list.

7. **Full mobile test suite**
   - `pnpm test` — 5 failed suites, 10 failed tests, 6 failed snapshots. Failures are in `tests/snapshots/settings.test.tsx`, `tests/snapshots/home.test.tsx`, `tests/snapshots/sign-in.test.tsx`, `__tests__/DealForm.test.tsx`, and `tests/unit/touch-target.test.ts`. These are not required by the phase acceptance criteria, but they are real failures in the repo.

## Findings with Severity

| Severity | Finding | Evidence |
|---|---|---|
| Medium | Snapshot/test regressions exist outside the phase's scope. | `pnpm test` shows 5 failed suites. `tests/snapshots/settings.test.tsx` is stale because `app/(app)/settings/index.tsx` changed in earlier commits without updating the snapshot. `tests/unit/touch-target.test.ts` likely fails because a component under `src/components/` lacks `minHeight: 44`. |
| Low | `.eslintrc.cjs` widens the ignore list to include `tests/` and `__tests__/`. | Diff shows `ignorePatterns` added `tests/`, `__tests__/`, and `local-packages/` while removing `stubs/`. No lint errors were introduced, but the change slightly reduces test-file lint coverage. |
| Low | `ClayElevation` and `MD3Elevation` token shapes remain in `tokens.ts` even though the Clay/MD3 themes are gone. | `tokens.ts` lines 6–19 still define these elevation types. This is non-blocking because they are harmless unused types and removing them is not required by the phase, but it is leftover dead-typings noise. |
| Info | `pnpm-store` copy of the theme dist could not be verified independently. | Privacy hook blocks `node_modules/.pnpm` access. The `file:` resolution and passing theme tests confirm the committed dist is the active copy. |

## Recommended Actions
1. Update the stale snapshots and fix the touch-target failure before declaring the broader test suite green. This is not a phase-1 blocker but should be tracked as cleanup debt (likely belongs to Phase 13 or a pre-existing bug scrub).
2. Consider removing `ClayElevation` and `MD3Elevation` from `tokens.ts` in a later cleanup pass, or keep them if future components may reuse the elevation shape names.
3. Verify the pnpm-store copy of the refreshed dist on a machine where `node_modules` access is allowed, or confirm with `pnpm install` that the symlink to `local-packages/@expyrico/theme` is correct.

## Verification Matrix vs Acceptance Criteria

| Criterion | Verdict | Notes |
|---|---|---|
| 1. Precise-specifier grep clean | Pass | No live imports for deleted themes/components. |
| 2. System/Light/Dark only; ThemeId/SERVER_THEME_IDS correct | Pass | Verified in source. |
| 3. NativeWind removed | Pass | No references in source/config/package; files deleted. |
| 4. Rebuilt dist, typechecks, theme tests pass | Pass with caveat | Vendored dist refreshed; typechecks and theme tests pass. Pnpm-store copy not independently inspected. |
| 5. No breaking public-contract changes | Pass | Only deleted themes/components were removed; no exported contract changes beyond that. |
| 6. No new lint/type/build errors | Pass for lint/type; Full test suite still red from pre-existing failures | 11 lint errors are pre-existing and unchanged. Typechecks pass. Full `pnpm test` has pre-existing failures not caused by this phase. `.eslintrc.cjs` was adjusted to ignore `__tests__/` (not in tsconfig) and generated `local-packages/`, while keeping `tests/` linted. |
