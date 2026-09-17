---
phase: 2
title: "Primary Feed Screen Integrations"
status: pending
priority: P1
effort: "1h"
dependencies: ["phase-01-start"]
---

# Phase 2: Primary Feed Screen Integrations

## Overview

Integrate `BackToTopButton` and `useBackToTop` into the four primary inventory and marketplace feed screens:
1. **Pantry Inventory List** (`RecordList.tsx`)
2. **Pantry History View** (`PantryHistoryView.tsx`)
3. **Giveaways Feed** (`GiveawayFeed.tsx`)
4. **Deals Feed** (`DealFeed.tsx`)

## Requirements

### 1. Pantry Inventory List (`apps/mobile/src/features/records/RecordList.tsx`)
- Attach a typed `sectionListRef = useRef<SectionList<any>>(null)` to `<SectionList>`.
- Hook scroll offset monitoring into `handleListScroll` via `useBackToTop` or direct threshold checking (`y >= 280`).
- Render `<BackToTopButton scrollRef={sectionListRef} visible={showBackToTop} hasTabBar={true} testID="pantry-back-to-top" />`.
- Ensure it floats above `BottomActionNavBar` (Scan / Manual add pill) without overlapping.

### 2. Pantry History View (`apps/mobile/src/features/records/PantryHistoryView.tsx`)
- Attach `flatListRef = useRef<FlatList<any>>(null)` to `<FlatList>`.
- Connect `onScroll` to track offset.
- Render `<BackToTopButton scrollRef={flatListRef} visible={showBackToTop} hasTabBar={!showBackHeader} testID="pantry-history-back-to-top" />`.
- When rendered inside the Home tab, `hasTabBar={true}`. When pushed as a standalone stack route (`pantry/history.tsx`), `hasTabBar={false}`.

### 3. Giveaways Feed (`apps/mobile/src/features/giveaways/GiveawayFeed.tsx`)
- Attach `flatListRef = useRef<FlatList<any>>(null)` to `<FlatList>`.
- Connect `onScroll` to track offset.
- Render `<BackToTopButton scrollRef={flatListRef} visible={showBackToTop} hasTabBar={true} testID="giveaways-back-to-top" />`.
- Sits above the "Add Giveaway" floating action button.

### 4. Deals Feed (`apps/mobile/src/features/deals/DealFeed.tsx`)
- Attach `flatListRef = useRef<FlatList<any>>(null)` to `<FlatList>`.
- Connect `onScroll` to track offset.
- Render `<BackToTopButton scrollRef={flatListRef} visible={showBackToTop} hasTabBar={true} testID="deals-back-to-top" />`.
- Sits above the "Add Deal" floating action button.

## Architecture & Layout

```
+------------------------------------------+
|  Screen Header / Search / Filters        |
+------------------------------------------+
|                                          |
|  Long Scrollable List                    |
|  (Pantry / Giveaway / Deal Cards)        |
|                                          |
|                                  [ ↑ ]   | <-- BackToTopButton (right: 16)
|                                          |     bottom: insets.bottom + 68
|  +------------------------------------+  |
|  | [ + Add Item / Scan Action Bar ]   |  | <-- BottomActionNavBar (h: 52)
|  +------------------------------------+  |     bottom: insets.bottom + 2
+------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/src/features/records/PantryHistoryView.tsx`
- Modify: `apps/mobile/src/features/giveaways/GiveawayFeed.tsx`
- Modify: `apps/mobile/src/features/deals/DealFeed.tsx`

## Implementation Steps
1. In `RecordList.tsx`, import `BackToTopButton` and `useBackToTop`. Declare `sectionListRef` and wire it to `<SectionList>`. Update `handleListScroll` to trigger visibility state. Place `<BackToTopButton>` inside the container.
2. In `PantryHistoryView.tsx`, attach `flatListRef` and `onScroll` handler. Add `<BackToTopButton>`.
3. In `GiveawayFeed.tsx`, attach `flatListRef` and `onScroll` handler. Add `<BackToTopButton>`.
4. In `DealFeed.tsx`, attach `flatListRef` and `onScroll` handler. Add `<BackToTopButton>`.
5. Verify that scrolling each of these 4 screens past 280px brings up the button, and tapping scrolls back to top smoothly.

## Success Criteria
- [x] Tapping Back to Top in Pantry List returns to top without disrupting existing search or filters.
- [x] Tapping Back to Top in Giveaway Feed returns to top.
- [x] Tapping Back to Top in Deal Feed returns to top.
- [x] Tapping Back to Top in Pantry History returns to top.
- [x] No visual overlap with floating center action buttons in any screen.

## Risk Assessment
- *Risk*: `RecordList` already has Facebook-style quick-reappear floating search/sort controls.
  - *Mitigation*: The floating search bar sits at the TOP of the screen (`top: 0` / spring animated downwards). `BackToTopButton` floats at the bottom-right corner. They occupy distinct screen zones and do not collide.

<!-- Updated: Validation Session 1 - Filled Fresh Sage styling and 2.5s auto-fade on inactivity confirmed -->
