---
phase: 4
title: "Giveaway Feed Distance Filtering"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-schemas-and-database-migration", "phase-03-admin-distance-settings-and-api-statistics"]
---

# Phase 4: Giveaway Feed Distance Filtering

<!-- Updated: Validation Session 1 - Empty state with Expand Search button -->

## Overview
Implement distance-based query filtering for the giveaway feed in `api/src/routes/giveaways/list-feed.ts` using bounding box pre-filtering and exact Haversine calculation, provide an empty state with a 1-tap "Expand search radius" action when 0 posts exist locally, and update the mobile feed cards to display the distance (e.g. `2.4 km away`) with nearest-first sorting.

## Requirements

### Functional
1. **Feed Coordinate Detection**:
   - For authenticated requests, check if the viewing user has `latitude` and `longitude` populated in their `User` profile.
   - Also support explicit query parameters `?latitude={lat}&longitude={lng}&radiusKm={radius}`.
2. **Bounding Box Pre-Filtering**:
   - Compute bounding box boundaries from viewer position $(\text{lat}_0, \text{lon}_0)$ and active radius $R$ km (from admin setting `defaultRadiusKm` or user override):
     $$\Delta \text{lat} = \frac{R}{111.045}$$
     $$\Delta \text{lon} = \frac{R}{111.045 \times \cos(\text{lat}_0 \times \frac{\pi}{180})}$$
   - Add Prisma where clauses:
     `latitude: { gte: lat0 - dlat, lte: lat0 + dlat }`
     `longitude: { gte: lon0 - dlon, lte: lon0 + dlon }`
   - Leverages composite B-tree index `@@index([latitude, longitude])` for $O(\log N)$ performance.
3. **Haversine Distance Pruning & Metadata Attachment**:
   - For all candidate records from the bounding box, calculate exact spherical distance:
     $$d = 2 R_{\text{earth}} \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
     where $R_{\text{earth}} = 6371\text{ km}$.
   - Prune any corner posts where $d > R$.
   - Attach `distanceKm: Math.round(d * 10) / 10` to each item payload in `Giveaway`.
4. **Distance Sort Support**:
   - Support `sort=distance_asc` (`Nearest first`) in `giveawaySortSchema`.
5. **Fallback Behavior (Validation Decision)**:
   - If the viewer has no saved coordinates, fall back to country-level filtering (preserving current functionality) with `distanceKm: null`.
   - **Empty State with 1-Tap 'Expand Search' Button**:
     - If zero giveaways exist within the configured radius (e.g. 25 km), the mobile feed displays a dedicated empty state:
       *"No giveaways found within {radius} km of your neighbourhood."*
     - Renders a prominent primary action button:
       `[ Expand search to 50 km ]` (or `[ Show country-wide ]`).
     - Tapping the button re-queries the feed with expanded radius without requiring the user to open filter menus.
6. **Mobile UI Card Updates**:
   - In `GiveawayCard.tsx`, render distance tag when present:
     `📍 Downtown · 2.4 km away`
   - In `GiveawayFeed.tsx`, display an actionable banner if user has no address set:
     *"Set your address in Profile to discover giveaways in your neighbourhood."*

## Architecture

```
GET /api/v1/giveaways (with viewer coordinates)
       |
       |-- 1. Load Admin Setting (defaultRadiusKm, e.g. 25 km) or user override
       |-- 2. Compute Bounding Box: [lat0 ± dlat, lon0 ± dlon]
       |-- 3. Prisma Query with bounding box constraints
       |-- 4. Calculate Haversine distance for candidates
       |-- 5. Filter d <= radius
       |-- 6. Attach distanceKm to each Giveaway object
       v
Return { items: Giveaway[], cursor, totalInRange: number }
       v
Mobile Feed:
  - If items.length > 0: Render GiveawayCards with "📍 3.2 km away"
  - If items.length === 0: Render Empty State + "[ Expand search to 50 km ]"
```

## Related Code Files
- Modify: `api/src/routes/giveaways/list-feed.ts`
- Modify: `api/src/services/giveaways/repository.ts`
- Modify: `packages/shared/src/schemas/giveaway.ts`
- Modify: `apps/mobile/src/api/giveaways.ts`
- Modify: `apps/mobile/src/features/giveaways/GiveawayCard.tsx`
- Modify: `apps/mobile/src/features/giveaways/GiveawayFeed.tsx`
- Modify: `apps/mobile/src/features/giveaways/GiveawayFilterModal.tsx`
- Create: `api/tests/unit/distance-filter.test.ts`

## Implementation Steps
1. Add `distance_asc` to `giveawaySortSchema` in `packages/shared/src/schemas/giveaway.ts`.
2. Implement distance computation helper `calculateHaversineDistanceKm(lat1, lon1, lat2, lon2)` in `api/src/services/geo/distance.ts`.
3. Update `api/src/routes/giveaways/list-feed.ts`:
   - Fetch viewer profile coordinates and active distance setting.
   - Apply bounding box query conditions.
   - Filter candidate results and attach `distanceKm`.
   - If `sort === 'distance_asc'`, sort items by `distanceKm` ascending.
4. Update `apps/mobile/src/features/giveaways/GiveawayCard.tsx`:
   - Display `distanceKm` badge alongside `locationText`.
5. Update `apps/mobile/src/features/giveaways/GiveawayFeed.tsx`:
   - Pass user coordinates into query.
   - Implement empty state with "Expand search" action when 0 posts are within current radius.
   - Add prompt banner for users with no profile address.
6. Write unit tests for Haversine calculations, bounding box queries, and expanded radius queries.

## Success Criteria
- [x] Giveaways outside the active radius are excluded from the feed.
- [x] Giveaways inside the radius include `distanceKm` rounded to 1 decimal place.
- [x] Empty state with 1-tap "Expand search" button renders when zero posts are within radius.
- [x] Tapping "Expand search" broadens the radius and re-fetches successfully.
- [x] Mobile card renders distance cleanly (e.g. `📍 2.4 km away`).
- [x] Selecting `Nearest first` sort displays giveaways ordered by ascending distance.

## Risk Assessment
- **Risk**: Edge-case coordinates near the International Date Line (longitude $\pm 180^\circ$) or Equator.
  - **Observable Signal**: Negative delta longitude or longitude wrapping errors.
  - **Mitigation**: Normalise longitude wrapping in bounding box helper (`(lon + 540) % 360 - 180`).
