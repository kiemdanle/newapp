---
phase: 1
title: "Shared Gamification & Contributor Levels"
status: pending
priority: P1
effort: "30m"
dependencies: []
---

# Phase 1: Shared Gamification & Contributor Levels

## Overview

Update the Level 4 contributor tier in the shared progression package from **"Pantry Scout"** to **"Stash Scout"** across definitions, type definitions, and test suites.

## Requirements

### Functional Requirements
- Change the canonical title of Level 4 in `DEFAULT_CONTRIBUTOR_LEVELS` from `'Pantry Scout'` to `'Stash Scout'`.
- Keep points requirement (150 pts), products requirement (15 products), badge key (`silver_star`), and color token (`pebble`) identical.
- Build and bundle `@expyrico/shared` and sync the vendored copy to `apps/mobile/local-packages/@expyrico/shared/dist/` (`apps/mobile/package.json:22`), refreshing the pnpm workspace virtual store.
- Inspect and update any database-persisted `contributor_levels` setting row in `settings` table to prevent stale overrides.

### Non-Functional Requirements
- Zero schema or type signature regressions in `computeContributorProgression`.
- All shared unit tests and mobile consumer tests must pass cleanly.

## Architecture

```
packages/shared/src/gamification/contributor-levels.ts
  └─ Level 4 title: 'Pantry Scout' ──> 'Stash Scout'
        │
        ├──> packages/shared/src/gamification/contributor-levels.test.ts
        └──> apps/mobile/src/features/gamification/__tests__/ContributorHeroCard.test.tsx
```

## Related Code Files
<!-- Updated: Red Team Review Session - F1 vendored dist sync, F4 db contributor_levels guard -->

### Modify
- `packages/shared/src/gamification/contributor-levels.ts`
- `packages/shared/src/gamification/contributor-levels.test.ts`
- `apps/mobile/src/features/gamification/__tests__/ContributorHeroCard.test.tsx`
- `apps/mobile/local-packages/@expyrico/shared/dist/**` (vendored distribution)
## Implementation Steps

1. Edit `packages/shared/src/gamification/contributor-levels.ts`:
   - Locate Level 4 definition in `DEFAULT_CONTRIBUTOR_LEVELS`.
   - Update `title: 'Pantry Scout'` to `title: 'Stash Scout'`.
2. Edit `packages/shared/src/gamification/contributor-levels.test.ts`:
   - Update assertion in `computes Level 4 (Pantry Scout) at 180 points` to check for `'Stash Scout'`.
3. Edit `apps/mobile/src/features/gamification/__tests__/ContributorHeroCard.test.tsx`:
   - Update mock level data and assertions from `'Pantry Scout'` to `'Stash Scout'`.
4. Rebuild the shared package:
   - Run `pnpm --filter @expyrico/shared build`.
5. Sync vendored distribution to mobile (`docs/build-and-release.md:21-23`):
   ```bash
   rm -rf apps/mobile/local-packages/@expyrico/shared/dist
   cp -R packages/shared/dist apps/mobile/local-packages/@expyrico/shared/dist
   pnpm install
   ```
6. Verify mobile-resolved Level 4 title:
   - Execute a quick Node check asserting `@expyrico/shared` resolved from `apps/mobile` returns `title === 'Stash Scout'`.
7. Guard database-persisted settings:
   - Check if `contributor_levels` exists in `settings` table. If present, update any stored `'Pantry Scout'` entry to `'Stash Scout'`.
8. Run test verification:
   - Run `pnpm --filter @expyrico/shared test`.
   - Run `pnpm --filter @expyrico/mobile test -- ContributorHeroCard`.
## Success Criteria

- [ ] `DEFAULT_CONTRIBUTOR_LEVELS` defines Level 4 with `title: 'Stash Scout'`.
- [ ] Shared gamification test suite passes with 100% success.
- [ ] Mobile contributor hero card test suite passes with 100% success.
- [ ] `pnpm --filter @expyrico/shared build` outputs updated bundles into `dist/`.
- [ ] Vendored distribution `apps/mobile/local-packages/@expyrico/shared/dist` is updated and committed.
- [ ] Mobile-resolved `@expyrico/shared` confirms Level 4 is `"Stash Scout"`.
- [ ] Database `settings` table does not contain stale `'Pantry Scout'` overrides.
## Risk Assessment

- **Risk**: Mobile app resolves stale `@expyrico/shared` from committed `local-packages/@expyrico/shared/dist/` (F1).
- **Mitigation**: Execute the documented repository sync command (`rm -rf apps/mobile/local-packages/@expyrico/shared/dist && cp -R packages/shared/dist apps/mobile/local-packages/@expyrico/shared/dist && pnpm install`) and verify resolution before completing Phase 1.
