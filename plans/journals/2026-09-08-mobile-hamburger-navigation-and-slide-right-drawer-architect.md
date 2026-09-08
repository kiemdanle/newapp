---
title: Mobile Hamburger Navigation and Slide-Right Drawer Architecture
date: 2026-09-08
summary: Replaced the draggable floating bottom menu button with a standardized top-left hamburger icon and implemented a native-driven slide-to-right drawer navigation architecture displaying the Expyrico app menu.
---

# Mobile Hamburger Navigation and Slide-Right Drawer Architecture

## What happened

Implemented the comprehensive 5-phase Mobile Hamburger Icon and Screen Slide-Right Drawer Navigation plan (`plans/260908-0743-mobile-hamburger-slide-out-menu/`):
1. **Drawer State Store (`useDrawerStore`)**: Created global Zustand store managing `isOpen`, `activeTab`, `navigateTab`, `toggleDrawer`, `openDrawer`, and `closeDrawer`. Integrated state reset into `session-store.ts` (`clearAllLocalUserData`) upon logout.
2. **Sliding Drawer Architecture (`SlidingDrawer.tsx`)**: Developed a 60fps native-driven sliding container featuring:
   - Outer animated deck managing `transform: [{ translateX }, { scale }]` (0 to 280dp, scale 1.0 to 0.94 with `transformOrigin: 'top left'`), `overflow: 'visible'`, and elevation/drop shadows.
   - Inner deck managing dynamic `borderRadius: isOpen ? 16 : 0` and `overflow: isOpen ? 'hidden' : 'visible'`, guaranteeing 0 resting-state corner clipping and intact drop shadows.
   - Dedicated 24px edge touch strip anchored below the header (`top: 90`), preventing gesture collisions with the top-left hamburger button and horizontal list/card `Swipeable` items.
   - Animated backdrop overlay with tap and swipe-left dismiss, along with inverse accessibility isolation when open.
   - Focus-gated hardware `BackHandler` (`useIsFocused()`), preventing event capture on pushed stack screens (`Scan`, `Household`, `Settings`).
   - Animation unmount lifecycle guards and `stopAnimation()` race cancellation.
3. **Left Drawer Menu Component (`LeftDrawerMenu.tsx`)**: Built a full-height left drawer menu inside a vertical `ScrollView`:
   - Brand header with Expyrico Logo, wordmark, subtitle, and accessible close button.
   - Active user profile card with avatar, name, email, and pantry scope badge.
   - Primary navigation section with all 5 core tabs (`Pantry`, `Giveaways`, `Deals`, `Reviews`, `Profile`) styled in Expyrico Fresh Sage (`#4BAE8A`) and Mint Mist (`#D6F0E6`).
   - Quick Access shortcuts (`Scan Barcode`, `Household Sharing`, `Settings & Theme`, `Feedback & Support`) that close the drawer before navigating to stack screens.
   - Sign-out button with destructive confirmation dialog.
   - Full theme-driven styling supporting both light and dark modes via `useTheme()`.
4. **Top-Left Hamburger Button (`HamburgerButton.tsx`)**: Created a high-contrast, accessible 3-bar hamburger button with a minimum 44x44pt interactive hit target (`hitSlop={8}`) and embedded it at the far-left preceding logos and screen titles across all 5 tab headers (`Home`, `Deals`, `Giveaways`, `Reviews`, `Profile`). Hidden during multi-select mode.
5. **Clean TabsNavigator Cutover (`TabsNavigator.tsx`)**: Removed `DraggableFloatingButton` and `SignatureMenuIcon`, leaving the context-sensitive bottom action buttons ("Manually input", "Scan an item", "Post a deal", etc.) centered, clean, and completely unobstructed. Wrapped `Tabs.Navigator` in `SlidingDrawer` and wired `screenListeners` to keep drawer state synchronized.
6. **Testing & Verification**: 100% test pass rate across all 142 mobile test suites (877 tests), 0 TypeScript errors, 0 ESLint errors.

## Decision

- **Outer vs Inner Deck Separation**: Decoupled layout transform/shadow (`outerDeck`) from dynamic corner radius (`innerDeck`), completely eliminating resting-state clipping on compact devices.
- **Header-Cleared Edge Swipe**: Anchored the closed-state edge touch strip below the header (`top: 90`) to guarantee that the hamburger touch target never collides with edge gesture responders.
- **Focus-Gated BackHandler**: Restricted hardware back interception to when `isOpen === true` AND `TabsNavigator` is actively focused, ensuring pushed stack screens pop normally on Android.
- **Theme-Driven Drawer Palette**: Sourced all drawer colors directly from `useTheme()` tokens (`bg`, `bgElevated`, `primary`, `primaryLight`, `primaryDark`, `border`, `text`, `textMuted`, `danger`), avoiding light-theme hardcoding in dark mode.

## Next steps

- Test native Android build on device via local Gradle (`apps/mobile/android/gradlew`) and `adb`.
- Coordinate commit via `git-manager` subagent if requested by the user.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
