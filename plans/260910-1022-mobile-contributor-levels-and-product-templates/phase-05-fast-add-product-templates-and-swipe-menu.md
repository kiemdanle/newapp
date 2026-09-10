---
phase: 5
title: "Community Contributions Screen"
status: complete
priority: P1
effort: "1.5h"
dependencies: [3, 4]
---

# Phase 5: Community Contributions Screen

<!-- Updated: Validation Session 1 - Product Templates Naming & Universal Swipe Actions -->
<!-- Updated: Red Team Review Session 1 - Full Contributor Activity Coverage -->

## Overview

Build the dedicated **"Community Contributions"** screen (`apps/mobile/app/(app)/profile/contributions.tsx`), displaying all products the user has contributed to the community catalog, with level badges, approval statuses, timestamps, and community impact indicators.

## Requirements

### Functional
1. **Screen Layout**:
   - Header with back button, screen title **"Community Contributions"**, and subtitle *"Products, packaging photos, and edits you've contributed to the public catalog."*
   - Summary Bento Banner:
     - Top level chip: e.g. `🥈 Level 4 Contributor`.
     - 3 key stats: `Total: 15` | `Approved: 12` | `Pending: 3`.
   - Filter segmented chips:
     - `All` (default)
     - `Active` (catalog approved)
     - `In review` (pending moderation)
     - `Changes requested` (needs update)
   - Search bar: filter contributions by name or barcode.
2. **Contributed Product Card**:
   - Packaging cover thumbnail (with fallback placeholder).
   - Product name and barcode/identifier.
   - Status badge matching Expyrico colors:
     - `Catalog Active`: Fresh Sage `#4BAE8A`
     - `Awaiting Review`: Honey `#F5A623`
     - `Changes Requested`: Alert Red `#E0442A`
     - `Report Hidden` / `Merged`: Pebble `#8C8C85`
   - Contribution date: formatted medium date.
   - Tapping card opens product details or review status sheet.
3. **Empty State**:
   - Friendly empty illustration: *"No contributions yet"*, with button to scan or add the first product to earn Level 1 badge!

## Related Code Files
- Create: `apps/mobile/app/(app)/profile/contributions.tsx`
- Create: `apps/mobile/src/features/gamification/ContributedProductCard.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Create: `apps/mobile/__tests__/routes/community-contributions.test.tsx`

## Implementation Steps
1. Register `CommunityContributions` route in `AppNavigator.tsx`.
2. Build `ContributedProductCard.tsx` displaying status badge, packaging thumbnail, barcode, and creation date.
3. Build `contributions.tsx` using `useUserContributions()` query with status filters and search.
4. Add empty state with direct action to scan or add a new product.
5. Write route tests covering rendering, filtering by status, search query, and empty state.

## Success Criteria
- [ ] Screen renders complete history of user's contributed catalog products.
- [ ] Filter chips correctly filter between All, Active, and In Review items.
- [ ] Status badges conform to Expyrico palette tokens.
- [ ] Route tests pass with 100% assertions green.
