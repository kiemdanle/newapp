---
phase: 4
title: "Verification, Testing & Physical Device Validation"
status: pending
priority: P1
effort: "0.5h"
dependencies: ["phase-01-start", "phase-02-primary-feed-integration", "phase-03-secondary-lists-integration"]
---

# Phase 4: Verification, Testing & Physical Device Validation

## Overview

Validate the full end-to-end implementation through TypeScript typecheck, automated Jest unit tests, Android Gradle debug build, and physical Android device verification over ADB.

## Requirements

### Automated Verification
1. **TypeScript Typecheck**:
   - Command: `pnpm --filter @expyrico/mobile typecheck`
   - Must pass with 0 errors under strict TypeScript settings (`noUncheckedIndexedAccess`, etc.).
2. **Jest Unit Tests**:
   - Command: `pnpm --filter @expyrico/mobile test BackToTopButton.test.tsx`
   - Must verify:
     - Component render and initial hidden state (`opacity: 0`).
     - Animated entrance upon passing scroll threshold.
     - Animated exit upon returning below threshold.
     - Correct `scrollTo` / `scrollToOffset` invocation on tap.
     - Accurate `bottom` offset calculation when `hasTabBar` is true vs false.
     - Accessibility properties (`accessibilityRole="button"`, `accessibilityLabel="Scroll back to top"`).

### Physical Android Device Verification (via local Gradle & ADB)
- **Local Gradle Debug Build Command**:
  `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
- **ADB Install Command**:
  `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- **Interactive Verification Checklist**:
  1. Open Pantry Inventory: Scroll down past 3 items. Verify small round Fresh Sage button slides in smoothly at bottom right. Tap it: verify smooth return to top.
  2. Open Giveaways Feed: Scroll down. Verify button floats above the "Add Giveaway" button without overlap. Tap: returns to top.
  3. Open Deals Feed: Scroll down. Verify button floats above the "Add Deal" button without overlap. Tap: returns to top.
  4. Open Contributed Products: Scroll down. Verify button floats comfortably above the safe area bottom. Tap: returns to top.
  5. Open Product Drafts/Templates: Scroll down. Verify button floats above safe area bottom and smoothly scrolls back to top.
  6. Inactivity Auto-Fade: Pause scrolling for 2.5 seconds on any long screen. Verify button gracefully fades out. Resume scrolling: verify button instantly reappears if scrollY >= 280px.
  7. Verify light and dark theme styling: both use solid Fresh Sage `#4BAE8A` with Warm White `#FAFAF8` icon; light theme uses soft diffuse shadow (elevation 5) + Deep Sage hairline (`borderWidth: StyleSheet.hairlineWidth`, `rgba(58, 143, 111, 0.20)`); dark theme uses luminous Mint Mist rim (`borderWidth: 1`, `rgba(214, 240, 230, 0.35)`) + deep shadow (elevation 6) (zero dark-card fallback).

## Success Criteria
- [x] TypeScript typecheck passes with 0 errors.
- [x] Unit tests pass cleanly.
- [x] Debug APK builds and installs via `adb`.
- [x] Physical device confirms smooth scrolling and zero overlap with bottom UI elements.

## Risk Assessment
- *Risk*: Android safe area insets may report 0 if running in non-edge-to-edge mode.
  - *Mitigation*: The positioning calculation uses fallback values: `Math.max(insets.bottom, 16) + 16` for non-tab screens and `insets.bottom > 0 ? insets.bottom + 68 : 76` for tab screens, guaranteeing safe clearance even if `insets.bottom === 0`.

<!-- Updated: Validation Session 1 - Filled Fresh Sage styling and 2.5s auto-fade on inactivity confirmed -->
