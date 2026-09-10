---
phase: 4
title: "Profile Contributor Card & Next-Level Progress"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1, 2, 3]
---

# Phase 4: Profile Contributor Card & Next-Level Progress

<!-- Updated: Validation Session 1 - Gamification Flag Hiding & Screen Persistence -->
<!-- Updated: Red Team Review Session 1 - Live Ladder & Cache Invalidation -->

## Overview

Design and implement the gamified Contributor Level Card in `profile.tsx`, displaying the user's current contributor level, medal icon, points, and an animated progress bar to the next level. Support admin toggle (gracefully hides when disabled) and add the 10-level Roadmap modal detailing all tiers, point requirements, and community perks.

## Requirements

### UI/UX & Visual Design (Expyrico Palette)
1. **Contributor Hero Card (`ContributorHeroCard.tsx`)**:
   - Condition: Only rendered if `contributionsData.enabled !== false`.
   - Prominent container with soft background (`theme.colors.bgElevated`), border (`theme.colors.border`), and subtle rounded elevation.
   - **Left**: Level Badge Medal:
     - Circular medal with level color ring and icon (`ContributorBadgeIcon.tsx`).
   - **Right**:
     - Top row: `Level <N>` pill + Level Title in bold (e.g. `Level 4 • Pantry Scout`).
     - Points counter: `180 / 300 pts` in mono/semi-bold.
     - **Progress Bar**:
       - Track background: `theme.colors.bgGlass` or `#E5E7EB`.
       - Fill bar: Fresh Sage `#4BAE8A` transitioning to Honey `#F5A623`.
       - Animated width interpolation based on `progressPercent`.
     - Motivational subtitle:
       - If Level 0 (Unranked): `"0 / 10 pts • Add your first product to reach Level 1!"`
       - If Level 1..9: `"12 more products to Level 5 Catalog Explorer!"`
       - If at Level 10: `"🏆 Maximum Level Reached • Expyrico Champion"`.
   - **Live Ladder Integration**: Renders the exact `levels` array delivered dynamically by `useUserContributions()` (no hardcoded tier values in modal).
   - **Cache Invalidation**: Hook invalidates `['me', 'contributions']` on screen focus and whenever a template is added or dismissed.
   - **Tap Affordance**: Tapping the card opens `ContributorLevelRoadmapModal`.

2. **Roadmap Modal (`ContributorLevelRoadmapModal.tsx`)**:
   - Modal header: `"Community Contributor Levels"`, subtitle *"Earn points by adding products, packaging photos, and verified details."*
   - Scrollable list of all levels (dynamically populated from API/shared tiers):
     - Level number, badge medal, title, required products/points.
     - Active level highlighted with glowing Fresh Sage border and `"CURRENT LEVEL"` pill.
     - Locked levels marked with grey/padlock indicator showing remaining points.
     - Unlocked perks listed with checkmark icon.

3. **Profile Section Segmentation in `profile.tsx`**:
   - Under `COMMUNITY & CONTRIBUTIONS`:
     1. `ContributorHeroCard` (interactive level & progress, conditional on admin setting).
     2. `ActionRow`: **"Community Contributions"** (`icon="globe-outline"`):
        - Subtitle: *"Products you've contributed to the catalog"*.
        - Badge: `Level <N> Contributor`.
        - Navigates to `CommunityContributionsScreen`.
     3. `ActionRow`: **"Product Templates"** (`icon="bookmark-outline"`):
        - Subtitle: *"Fast-add templates for frequently bought items"*.
        - Badge: `<count> items`.
        - Navigates to `ProductDraftsScreen`.

## Related Code Files
- Create: `apps/mobile/src/features/gamification/ContributorHeroCard.tsx`
- Create: `apps/mobile/src/features/gamification/ContributorLevelRoadmapModal.tsx`
- Create: `apps/mobile/src/features/gamification/ContributorBadgeIcon.tsx`
- Create: `apps/mobile/src/api/contributions.ts`
- Modify: `apps/mobile/app/(app)/(tabs)/profile.tsx`
- Create: `apps/mobile/src/features/gamification/__tests__/ContributorHeroCard.test.tsx`

## Implementation Steps
1. Create API hook `useUserContributions()` in `apps/mobile/src/api/contributions.ts` calling `GET /me/contributions`.
2. Implement `ContributorBadgeIcon.tsx` rendering medals across all badge keys (`seedling`, `bronze_star`, `silver_star`, `gold_star`, `emerald_gem`, `sapphire_crown`, `diamond_starburst`).
3. Build `ContributorHeroCard.tsx` with animated progress bar and motivational next-level text.
4. Build `ContributorLevelRoadmapModal.tsx` displaying the complete progression ladder.
5. Integrate the card and updated action rows into `profile.tsx`.
6. Add unit tests for `ContributorHeroCard` verifying progress bar calculations, next level text formatting, admin toggle hiding, and modal opening.

## Success Criteria
- [ ] Profile screen displays the user's contributor level badge, title, points, and progress bar.
- [ ] Card is hidden when `enabled === false`.
- [ ] Progress bar accurately scales from 0% to 100% between level thresholds.
- [ ] Tapping the contributor card opens the roadmap modal.
- [ ] Profile displays distinct rows for "Community Contributions" and "Product Templates".
- [ ] Unit tests pass cleanly.
