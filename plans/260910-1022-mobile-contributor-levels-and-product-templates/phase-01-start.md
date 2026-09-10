---
phase: 1
title: "Shared Contributor Levels & Seeding"
status: pending
priority: P1
effort: "1h"
dependencies: []
# Phase 1: Shared Contributor Levels & Seeding

<!-- Updated: Validation Session 1 - Strict Dynamic Recalculation & Product Templates -->

## Overview

Define the seeded 10-tier community contributor leveling system, badges, points math, and Zod schemas in `@expyrico/shared` so both the backend Fastify API, the Admin Dashboard, and the React Native mobile app share single-source-of-truth gamification logic. Points and level are strictly recalculated dynamically based on active, non-dismissed contributions.
## Requirements

### Functional
- Define `DEFAULT_CONTRIBUTOR_LEVELS`: 10 seeded default tiers:
  - Lv 1: Novice Scout (1 prod, 10 pts, Seedling, `#4BAE8A`)
  - Lv 2: Junior Contributor (3 prods, 30 pts, Bronze Star, `#D97706`)
  - Lv 3: Active Contributor (7 prods, 70 pts, Bronze Star+, `#D97706`)
  - Lv 4: Pantry Scout (15 prods, 150 pts, Silver Star, `#64748B`)
  - Lv 5: Catalog Explorer (30 prods, 300 pts, Silver Star+, `#64748B`)
  - Lv 6: Senior Contributor (60 prods, 600 pts, Gold Star, `#F5A623`)
  - Lv 7: Catalog Pioneer (120 prods, 1200 pts, Gold Star+, `#F5A623`)
  - Lv 8: Master Contributor (250 prods, 2500 pts, Emerald Gem, `#3A8F6F`)
  - Lv 9: Catalog Legend (500 prods, 5000 pts, Sapphire Crown, `#2563EB`)
  - Lv 10: Expyrico Champion (1000 prods, 10000 pts, Diamond Starburst, `#7C3AED`)
- Define `contributorLevelsSettingSchema`:
  - `enabled: z.boolean().default(true)`
  - `levels: z.array(contributorLevelTierSchema).min(1)`
- Implement `computeContributorProgression(stats, customLevels?)`:
  - Input: `{ productsCount: number, photosCount?: number, approvedCount?: number, editsCount?: number }`, optional custom levels list from admin settings.
  - Output:
    - `currentLevel`: 1..N
    - `title`: string
    - `badgeKey`: string
    - `totalPoints`: number
    - `nextLevel`: number | null
    - `nextLevelTitle`: string | null
    - `nextLevelPoints`: number | null
    - `pointsToNextLevel`: number
    - `productsToNextLevel`: number
    - `progressPercent`: number (0..100)
- Export Zod schemas:
  - `contributorBadgeKeySchema`: Enum of badge icon identifiers.
  - `contributorLevelTierSchema`: Schema for an individual level tier.
  - `contributorLevelsSettingSchema`: Full admin settings schema.
  - `contributorProgressionSchema`: Full user progress state object.
  - `communityContributionRowSchema`: Item descriptor for contributed catalog products history.

## Related Code Files
- Create: `packages/shared/src/gamification/contributor-levels.ts`
- Create: `packages/shared/src/schemas/admin/contributor-levels.ts`
- Modify: `packages/shared/src/schemas/product.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/gamification/contributor-levels.test.ts`

## Implementation Steps
1. Create `contributor-levels.ts` with seeded `DEFAULT_CONTRIBUTOR_LEVELS` array and progression formula supporting custom level tiers.
2. Add Zod validation schemas for admin settings and user contributions.
3. Export schemas and helpers from `packages/shared/src/index.ts`.
4. Add unit tests in `contributor-levels.test.ts` covering Level 1 to 10 boundaries, default vs custom levels, point calculations, and edge cases.
5. Build `@expyrico/shared` and sync to `apps/mobile/local-packages/@expyrico/shared/dist`.

## Success Criteria
- [ ] `DEFAULT_CONTRIBUTOR_LEVELS` contains 10 progression tiers with seeded defaults.
- [ ] `computeContributorProgression` accurately calculates levels against default and custom admin tiers.
- [ ] Unit tests pass with 100% assertions green.
- [ ] `pnpm --dir packages/shared build && node scripts/check-vendored-shared-dist.mjs` passes cleanly.
