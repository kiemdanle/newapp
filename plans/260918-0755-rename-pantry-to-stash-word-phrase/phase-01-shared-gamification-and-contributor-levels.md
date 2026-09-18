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
- Build and bundle `@expyrico/shared` so mobile and admin applications consume the updated tier title.

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

### Modify
- `packages/shared/src/gamification/contributor-levels.ts`
- `packages/shared/src/gamification/contributor-levels.test.ts`
- `apps/mobile/src/features/gamification/__tests__/ContributorHeroCard.test.tsx`

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
5. Run test verification:
   - Run `pnpm --filter @expyrico/shared test`.

## Success Criteria

- [ ] `DEFAULT_CONTRIBUTOR_LEVELS` defines Level 4 with `title: 'Stash Scout'`.
- [ ] Shared gamification test suite passes with 100% success.
- [ ] Mobile contributor hero card test suite passes with 100% success.
- [ ] `pnpm --filter @expyrico/shared build` outputs updated bundles into `dist/`.

## Risk Assessment

- **Risk**: Stale bundled artifacts in `local-packages/@expyrico/shared/dist/` in mobile app.
- **Mitigation**: Run `pnpm --filter @expyrico/shared build` to rebuild, or let Metro read from workspace packages directly.
