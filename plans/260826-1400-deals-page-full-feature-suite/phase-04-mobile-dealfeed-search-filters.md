---
phase: 4
title: "Mobile DealFeed Search & Filters"
status: completed
priority: P1
dependencies: ["phase-03-mobile-api-client-hooks"]
---

# Phase 4: Mobile DealFeed Search & Filters

<!-- Updated: Validation Session 1 - Hybrid store chips, local-first feed with global toggle -->

## Overview
Rebuild the mobile Deals tab (`apps/mobile/app/(app)/(tabs)/deals.tsx`), `DealFeed`, `DealCard`, and introduce `DealFilterModal` and `DealSearchBar`. Implement search debouncing, active filter pills with count badge, sort pill selectors, pull-to-refresh, Floating Action Button (FAB) for "+ Post Deal", and differentiated empty states. Strictly adhere to the Expyrico color palette.

## Requirements

### Functional Requirements
- **Header & Search Bar (`DealSearchBar`)**:
  - Search input with placeholder `"Search deals, stores, products…"`.
  - Magnifying glass icon in Pebble (`#8C8C85`), clear button (X) when text is entered.
  - Debounce search input (300ms) before triggering API query.
  - Filter button with active filter count badge (e.g. `[ Filter (2) ]`).
- **Floating Action Button & Header Action**:
  - "+ Post Deal" button in header and Floating Action Button (FAB) at bottom-right in Fresh Sage (`#4BAE8A`) with Honey (`#F5A623`) / White accents.
- **Sorting System**:
  - Segmented pills / horizontal scroll bar for quick sort toggling:
    - 🔥 **Top** (`score`)
    - ⏱️ **Newest** (`new`)
    - 🏷️ **Lowest Price** (`price_asc`)
    - ⏳ **Expiring Soon** (`expiry_asc`)
- **Filter Modal (`DealFilterModal`)**:
  - Bottom sheet or modal with:
    - **Store Name Selection**: Horizontal wrap of hybrid store chips from `useDealStores()` (Trader Joe's, ALDI, Walmart, Costco, Target, Whole Foods, etc.) + text input for custom store search.
    - **Price Range**: Preset chips (Under $5, $5–$15, $15–$30, $30+) + Min and Max numeric text inputs.
    - **Expiry Filter**: Radio chips for All, Expiring within 7 days, Unexpired only.
    - **Country Scope**: Toggle between "Local / My Country" and "Worldwide".
    - **Footer Actions**: "Reset All" (secondary) and "Apply Filters (N)" in Fresh Sage (`#4BAE8A`).
- **Active Filter Chips**:
  - When filters are active, render dismissible chips below the search bar (e.g. `[ Store: Trader Joe's ✕ ]`, `[ Under $10 ✕ ]`).
  - "Clear all" button to reset in one tap.
- **Enhanced `DealCard` Component**:
  - Product thumbnail or high-contrast fallback icon.
  - Product name in Almost Black (`#2C2C28`, font weight 700).
  - Price in Deep Sage (`#3A8F6F`, large font weight 800) with formatted currency.
  - Store name in Stone pill badge (`#F0F0ED`).
  - Expiry status pill:
    - Expiring soon (≤3 days): Soft Butter (`#FEEFC3`) background, Honey (`#F5A623`) text.
    - Fresh / Good: Mint Mist (`#D6F0E6`) background, Deep Sage (`#3A8F6F`) text.
    - Expired: Alert Red (`#E0442A`) text.
  - Author name, avatar thumbnail, and timestamp relative time (e.g. "3h ago").
  - Upvote / Downvote buttons with active tinted states.
- **Pull-to-Refresh & Infinite Scroll**:
  - `RefreshControl` with Fresh Sage indicator.
  - Smooth footer `ActivityIndicator` on infinite scroll pagination.
- **Differentiated Empty States**:
  - **No deals match search/filters**: Icon `search-outline`, title `"No matching deals"`, body `"Try adjusting your filters or search keywords"`, button `"Clear filters"`.
  - **No deals in area yet**: Icon `pricetag-outline`, title `"No deals posted yet"`, body `"Be the first to share a grocery price drop in your area and help neighbors save!"`, button `"+ Post the first deal"`.

### Non-Functional Requirements
- 60fps smooth scrolling performance on low-end Android & iOS devices.
- Fully accessible with `accessibilityRole="button"`, `accessibilityLabel`, and `minHeight: 48` touch targets.
- Strict Expyrico palette styling.

## Architecture
```
DealsTabScreen (apps/mobile/app/(app)/(tabs)/deals.tsx)
  └── DealFeed (apps/mobile/src/features/deals/DealFeed.tsx)
        ├── DealSearchBar (Search input + Filter Button with Badge)
        ├── SortBar (Top, Newest, Lowest Price, Expiring Soon pills)
        ├── ActiveFilterChips (Dismissible pills + Clear All)
        ├── FlatList
        │     ├── DealCard (Thumbnail, Price, Store, Expiry, Votes, Author)
        │     ├── EmptyState (Context-aware CTA)
        │     └── RefreshControl
        ├── DealFilterModal (Store chips, Price inputs, Expiry toggles, Country switch)
        └── FloatingActionButton (+ Post Deal)
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/(tabs)/deals.tsx`
- Modify: `apps/mobile/src/features/deals/DealFeed.tsx`
- Modify: `apps/mobile/src/features/deals/DealCard.tsx`
- Create: `apps/mobile/src/features/deals/DealFilterModal.tsx`
- Create: `apps/mobile/src/features/deals/DealSearchBar.tsx`
- Test: `apps/mobile/__tests__/DealFeed.test.tsx`
- Test: `apps/mobile/__tests__/DealCard.test.tsx`
- Test: `apps/mobile/__tests__/DealFilterModal.test.tsx` (new)

## Implementation Steps
1. **Create `DealSearchBar.tsx` (`apps/mobile/src/features/deals/DealSearchBar.tsx`):**
   - Implement debounced text input, Pebble icons, active filter indicator badge.
2. **Create `DealFilterModal.tsx` (`apps/mobile/src/features/deals/DealFilterModal.tsx`):**
   - Modal bottom sheet with hybrid store chips, min/max price fields, expiry radio chips, and Apply / Reset buttons.
3. **Refactor `DealCard.tsx` (`apps/mobile/src/features/deals/DealCard.tsx`):**
   - Add product thumbnail image support, expiry badge with Expyrico color states, store pill, and relative time.
4. **Update `DealFeed.tsx` (`apps/mobile/src/features/deals/DealFeed.tsx`):**
   - Integrate `DealSearchBar`, horizontal sort selector, active filter chips bar, `DealFilterModal`, and Floating Action Button.
   - Wire `useDealFeed(filters)` with pull-to-refresh `RefreshControl`.
5. **Update `DealsTabScreen` (`apps/mobile/app/(app)/(tabs)/deals.tsx`):**
   - Wire `onNew={() => navigation.push('DealNew')}` to allow creating deals.
6. **Add Unit & Component Tests:**
   - Test search debouncing, filter application, sort switching, and empty state rendering.

## Success Criteria
- [ ] Deals tab displays search bar, sort options, and filter button with active count.
- [ ] Users can filter by store, price, and expiration date via `DealFilterModal`.
- [ ] DealCard renders with Expyrico color badges, product thumbnail, store pill, and price.
- [ ] Floating Action Button and Header button open `DealNew` screen.
- [ ] Pull-to-refresh re-fetches deal feed.
- [ ] All tests in `DealFeed.test.tsx`, `DealCard.test.tsx`, and `DealFilterModal.test.tsx` pass.

## Risk Assessment
- **Risk:** Filter modal state desynchronizing from active query filters when user closes modal without clicking Apply.
- **Mitigation:** Use local draft state inside `DealFilterModal` that only commits to feed filter state on "Apply Filters" press.
