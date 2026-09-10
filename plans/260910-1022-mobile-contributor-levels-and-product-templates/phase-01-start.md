---
phase: 1
title: "Shared Contributor Levels & Seeding"
status: complete
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Shared Contributor Levels & Seeding

<!-- Updated: Validation Session 1 - Strict Dynamic Recalculation & Product Templates -->
<!-- Updated: Red Team Review Session 1 - Expyrico Palette Tokens & Monotonicity Refinement -->

## Overview

Define the seeded 10-tier community contributor leveling system, badges, points math, and Zod schemas in `@expyrico/shared` so both the backend Fastify API, the Admin Dashboard, and the React Native mobile app share single-source-of-truth gamification logic. Points and level are strictly recalculated dynamically based on active, non-dismissed contributions.
## Requirements
- Define `DEFAULT_CONTRIBUTOR_LEVELS`: 10 seeded default tiers:
  - Lv 1: Novice Scout (1 prod, 10 pts, Seedling, `fresh_sage`)
  - Lv 2: Junior Contributor (3 prods, 30 pts, Bronze Star, `honey`)
  - Lv 3: Active Contributor (7 prods, 70 pts, Bronze Star+, `honey`)
  - Lv 4: Pantry Scout (15 prods, 150 pts, Silver Star, `pebble`)
  - Lv 5: Catalog Explorer (30 prods, 300 pts, Silver Star+, `pebble`)
  - Lv 6: Senior Contributor (60 prods, 600 pts, Gold Star, `honey`)
  - Lv 7: Catalog Pioneer (120 prods, 1200 pts, Gold Star+, `fresh_sage`)
  - Lv 8: Master Contributor (250 prods, 2500 pts, Emerald Gem, `deep_sage`)
  - Lv 9: Catalog Legend (500 prods, 5000 pts, Sapphire Crown, `almost_black`)
  - Lv 10: Expyrico Champion (1000 prods, 10000 pts, Diamond Starburst, `deep_sage`)
- Define `expyricoBadgeColorTokenSchema`: `z.enum(['fresh_sage', 'deep_sage', 'mint_mist', 'honey', 'soft_butter', 'pebble', 'almost_black'])`.
- Define `contributorLevelsSettingSchema`:
  - `enabled: z.boolean().default(true)`
  - `levels: z.array(contributorLevelTierSchema).min(1).superRefine(...)`:
    - Refinement enforces strictly ascending `minPoints` (e.g. tier[i+1].minPoints > tier[i].minPoints).
    - Refinement enforces ascending `productsReq` and unique level numbers (1..N).
    - Refinement enforces badge colors belong strictly to `expyricoBadgeColorTokenSchema`.
- Implement `computeContributorProgression(stats, customLevels?)`:
  - Unranked support: if `totalPoints < levels[0].minPoints`, returns `currentLevel: 0`, `title: "New Explorer"`, `badgeKey: "seedling"`, `nextLevel: 1`, and `progressPercent: Math.round((totalPoints / levels[0].minPoints) * 100)`.
- Colors strictly mapped to Expyrico palette tokens:
  - `fresh_sage`: `#4BAE8A`
  - `deep_sage`: `#3A8F6F`
  - `mint_mist`: `#D6F0E6`
  - `honey`: `#F5A623`
  - `soft_butter`: `#FEEFC3`
  - `pebble`: `#8C8C85`
  - `almost_black`: `#2C2C28`
  - *(Off-palette arbitrary hex colors are rejected by schema validation)*
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
