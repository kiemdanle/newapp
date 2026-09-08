---
phase: 3
title: "Top-Left Hamburger Button and Screen Header Integration"
status: completed
priority: P1
effort: "2-3h"
dependencies: [1, 2]
---

# Phase 3: Top-Left Hamburger Button and Screen Header Integration

## Overview
Create the accessible `HamburgerButton` component and embed it cleanly into the top-left corner of each main tab screen header (`Home`, `Deals`, `Giveaways`, `Reviews`, `Profile`). Per the confirmed design decision, the button is positioned at the start on the far left, immediately preceding the logo or title. The button provides a consistent, tactile 44x44pt touch target that toggles the sliding drawer menu from any tab while preserving screen-specific controls (like the urgent filter pill, scope selector, search bar, and action buttons) with zero visual overlap.

## Requirements

### Functional
- **`HamburgerButton` Component (`apps/mobile/src/components/HamburgerButton.tsx`)**:
  - Visual: Crisp 3-bar hamburger icon (`Ionicons name="menu-outline"` or SVG lines) size 24.
  - Color: Primary text Almost Black (`#2C2C28`) in light mode; `theme.colors.text`.
  - Press Feedback: Circular or rounded rect touch background using `theme.colors.bgGlass` with `opacity: 0.85` on press.
  - Touch Target: Minimum 44x44pt interactive hit target using `hitSlop={8}` and minWidth/minHeight 40pt.
  - Test Identifier: `testID="top-nav-menu-button"` (with alias support for `hamburger-menu-button`).
  - Accessibility:
    - `accessibilityRole="button"`
    - `accessibilityLabel={isOpen ? "Close navigation menu" : "Open navigation menu"}`
    - `accessibilityState={{ expanded: isOpen }}`
  - Action: Invokes `useDrawerStore.getState().toggleDrawer()`.
- **Screen Header Integration Across 5 Main Tabs (Far-Left Preceding Logo/Title)**:
  1. **Home Screen (`apps/mobile/app/(app)/(tabs)/home.tsx`)**:
     - In `renderHeader()`: Insert `<HamburgerButton />` at the start of `styles.brandRow` before `<Logo size={28} />`:
       ```tsx
       <View style={styles.brandRow}>
         <HamburgerButton testID="top-nav-menu-button" />
         <Logo size={28} />
         <View style={{ flex: 1, minWidth: 0 }}>
           <Text style={styles.greeting}>Your pantry</Text>
           <Text style={styles.headerSubcopy}>Use what's expiring first.</Text>
         </View>
       </View>
       ```
     - **Selection Mode Coordination**: When `isSelectionMode === true` in `useSelectionModeStore`:
       - The hamburger button is hidden from the header.
       - The sliding drawer's edge swipe is disabled.
       - Any open drawer is immediately closed (`useDrawerStore.getState().closeDrawer()`).
  2. **Deals Screen (`apps/mobile/src/features/deals/DealFeed.tsx`)**:
     - In `styles.headerRow`:
       ```tsx
       <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 16) + 8, flexDirection: 'row', alignItems: 'center' }]}>
         <HamburgerButton testID="deals-hamburger-button" style={{ marginRight: 12 }} />
         <View style={{ flex: 1 }}>
           <Text style={[styles.heading, { color: theme.colors.text }]}>Deals</Text>
           ...
         </View>
       </View>
       ```
  3. **Giveaways Screen (`apps/mobile/src/features/giveaways/GiveawayFeed.tsx`)**:
     - In `styles.headerRow`:
       ```tsx
       <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 8) + 4, flexDirection: 'row', alignItems: 'center' }]}>
         <HamburgerButton testID="giveaways-hamburger-button" style={{ marginRight: 12 }} />
         <View style={{ flex: 1 }}>
           <Text style={[styles.heading, { color: theme.colors.text }]}>Giveaways</Text>
           ...
         </View>
       </View>
       ```
  4. **Reviews Screen (`apps/mobile/src/features/reviews/ReviewsHubScreen.tsx`)**:
     <!-- Updated: Red Team Review - Use actual symbol headerTitle ("Reviews & Recommendations") -->
     - In `styles.brandRow`:
       ```tsx
       <View style={styles.brandRow}>
         <HamburgerButton testID="reviews-hamburger-button" style={{ marginRight: 10 }} />
         <Logo size={28} />
         <View style={styles.headerTextGroup}>
           <Text style={styles.headerTitle} numberOfLines={1}>Reviews & Recommendations</Text>
           ...
         </View>
       </View>
       ```
  5. **Profile Screen (`apps/mobile/app/(app)/(tabs)/profile.tsx`)**:
     - In `styles.header`:
       ```tsx
       <View style={styles.header}>
         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
           <HamburgerButton testID="profile-hamburger-button" />
           <Logo size={32} withWordmark />
         </View>
         <Text style={[styles.headerSubcopy, { color: theme.colors.textMuted }]}>
           Account, activity, and preferences.
         </Text>
       </View>
       ```

### Non-Functional
- **Consistent Top-Left Alignment**: On every screen, the hamburger button aligns to the far-left margin with uniform vertical centering immediately preceding logos and screen titles.
- **Visual Stability & Compact Screens**: Header text containers use `flex: 1, minWidth: 0` with `numberOfLines={1}` so iPhone SE / narrow Android devices (< 360dp) do not wrap titles or push action buttons off-screen.

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│               Any Main Tab Screen Header               │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │ [ ☰ ]      [ Logo ]  Your pantry      [Filter] │   │
│   │ Hamburger    Logo    Title & Subcopy   Action  │   │
│   │ (Far-Left)   (Next)                            │   │
│   └────────────────────────────────────────────────┘   │
└───────────────────────────┬────────────────────────────┘
                            │ tap
                            ▼
               useDrawerStore.toggleDrawer()
                            │
                            ▼
          SlidingDrawer animates screen to right
```

## Related Code Files

### Create
- `apps/mobile/src/components/HamburgerButton.tsx` — Reusable top-left hamburger menu trigger button.
- `apps/mobile/tests/unit/hamburger-button.test.tsx` — Unit tests for rendering, touch target, and drawer toggle dispatch.

### Modify
- `apps/mobile/app/(app)/(tabs)/home.tsx` — Add `HamburgerButton` to `brandRow` (preceding Logo).
- `apps/mobile/src/features/deals/DealFeed.tsx` — Add `HamburgerButton` to `headerRow`.
- `apps/mobile/src/features/giveaways/GiveawayFeed.tsx` — Add `HamburgerButton` to `headerRow`.
- `apps/mobile/src/features/reviews/ReviewsHubScreen.tsx` — Add `HamburgerButton` to `brandRow` with `headerTitle`.
- `apps/mobile/app/(app)/(tabs)/profile.tsx` — Add `HamburgerButton` to `header`.

## Implementation Steps

1. **Create `HamburgerButton` Component (`apps/mobile/src/components/HamburgerButton.tsx`)**:
   - Implement `Pressable` with `Ionicons name="menu-outline" size={24}`.
   - Connect to `useDrawerStore((s) => s.isOpen)` and `useDrawerStore((s) => s.toggleDrawer)`.
   - Add hitSlop and accessible labels.
2. **Integrate into `HomeTab` (`home.tsx`)**:
   - Import `HamburgerButton`.
   - Place in `brandRow` at the start, preceding `<Logo size={28} />`.
   - Condition visibility on `!isSelectionMode`.
   - When `isSelectionMode` triggers, close drawer if open.
3. **Integrate into `DealFeed.tsx`, `GiveawayFeed.tsx`, `ReviewsHubScreen.tsx`, `profile.tsx`**:
   - Place at the far-left of each respective header row preceding headings and logos.
4. **Unit Tests (`apps/mobile/tests/unit/hamburger-button.test.tsx`)**:
   - Verify button renders with accessibility role and label.
   - Verify pressing button triggers `toggleDrawer()`.

## Success Criteria

- [x] `HamburgerButton` renders with a crisp 3-bar icon and min 44pt touch target.
- [x] Tapping `HamburgerButton` toggles the drawer state in `useDrawerStore`.
- [x] The button appears at the far left preceding logos and titles across all 5 tab screens.
- [x] Entering multi-select mode on the Pantry screen cleanly hides the hamburger button and forces drawer close.
- [x] 100% unit test coverage.

## Risk Assessment

- **Risk**: Heading text overflow on narrow devices (e.g. 320dp width).
  - **Mitigation**: Wrap title container in `flex: 1, minWidth: 0` and verify on compact screen widths (< 360dp) via layout tests.
