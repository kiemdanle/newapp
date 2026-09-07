---
title: Fix Giveaways Search Region Near Me Local filter
date: 2026-09-04
summary: Fix Giveaways Search Region Near Me Local filter not sending country and falling back to worldwide
---

# Fix Giveaways Search Region Near Me Local filter

Fix Giveaways Search Region Near Me Local filter not sending country and falling back to worldwide


## Problem
In the mobile app, navigating to `Giveaways` > `Filter` > `Search Region` and selecting `📍 Near Me (Local)` failed to filter the feed to local giveaways:
1. `GiveawayFilterModal.tsx` set `country: countryScope === 'global' ? 'ALL' : undefined`. Selecting `📍 Near Me (Local)` set `country` to `undefined`, passing no country parameter to the API query.
2. On the backend (`api/src/routes/giveaways/list-feed.ts`), an undefined `query.country` triggered a fallback (`if (items.length === 0 && !query.country && !query.location && !query.q && query.status === 'open' && !cursor)`) that broadened results to all open community giveaways worldwide when local items were 0 or `viewerCountry` was null.
3. In `GiveawayFeed.tsx`, `activeFilterCount` and active filter chips only checked `filters.country === 'ALL'`, ignoring local region filters and rendering no active filter chips.

## Solution
1. **Backend (`api/src/routes/giveaways/list-feed.ts`)**:
   - Added support for `query.country = 'LOCAL'` to scope strictly to `viewerCountry`.
   - Added IP country detection fallback via `detectCountryFromIp(req.ip)` when `viewerCountry` is null in the database.
   - Guaranteed that explicit country requests (e.g. `'LOCAL'`, `'US'`, `'VN'`) do not trigger the broad worldwide fallback.
2. **Mobile Client (`GiveawayFilterModal.tsx`)**:
   - Connected `useSessionStore` to retrieve `user.country` and `user.address`.
   - When `📍 Near Me (Local)` is selected, resolves `country` to `userCountry || 'LOCAL'`.
   - Added "📍 Use profile location" auto-fill button for the "Location / Neighborhood" input.
3. **Mobile Client (`GiveawayFeed.tsx`)**:
   - Updated `activeFilterCount` and `isFiltered` to recognize `filters.country` for any scope.
   - Rendered active filter chip `📍 Near Me (Local)` / `📍 Near Me ({country}) ✕` allowing users to see and clear the filter.
4. **Verification**:
   - Added unit and integration tests across both mobile and API packages.
   - 100% test pass rate (119 test suites, 671 tests in mobile; 25 integration tests in API).
   - Built debug APK and installed onto connected Android device via `adb`.
> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
