---
phase: 7
title: "Comprehensive Testing, Build & Device Verification"
status: in_progress
priority: P1
effort: "1h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Comprehensive Testing, Build & Device Verification

<!-- Updated: Validation Session 1 - Testing, Build & Device Verification -->
<!-- Updated: Red Team Review Session 1 - Security & Concurrency Verification -->

## Overview

Execute comprehensive unit, integration, and UI tests across `@expyrico/shared`, `api`, `apps/admin`, and `apps/mobile`. Build the Android debug APK using the local Gradle toolchain, stream-install to the attached Xiaomi device `96d9c774`, and visually verify the new Contributor Level card, Community Contributions screen, and swipe-to-delete actions on templates.

## Test Plan

1. **Shared Gamification Tests (`packages/shared`)**:
   - Verify `computeContributorProgression` across all 10 level boundaries against default tiers.
   - Verify Level 0 (Unranked) calculation for 0-point users (`0/10 pts` to Level 1).
   - Verify Zod schema rejects non-monotonic point thresholds and non-Expyrico badge color tokens.
   - Verify calculation against custom admin tiers.
2. **Admin Dashboard Tests (`apps/admin` & `api`)**:
   - `GET /v1/admin/settings/contributor-levels`: Returns default or persisted levels.
   - `PATCH /v1/admin/settings/contributor-levels`: Updates tiers, verifies schema validation, and writes audit log.
   - Admin UI test for `levels-editor-form.tsx`: toggling master switch, editing tier values, reset button.

3. **User Contributions & Template Tests (`api` & `apps/mobile`)**:
   - `GET /v1/me/contributions`: Returns caller's level, badge, and contributed product list (honors admin enable toggle).
   - `DELETE /v1/products/drafts/:id`:
     - Discarding an unsubmitted draft hard-deletes the row.
     - Discarding an active product marks `isDismissedFromTemplates = true` without deleting catalog product.
     - Cross-user XP isolation: User A dismissing a product does NOT revoke User B's photo/edit points.
   - Universal Add offline sync: Adding an unsubmitted draft template to pantry records creates a named custom record (`customName = item.name`, `productId = null`) that synchronizes cleanly without 403 `assertProductUse` rejection.
   - Mobile `ContributorHeroCard.test.tsx`: Tests level pill, medal icon, progress bar percentage, and roadmap modal trigger.
   - Mobile `community-contributions.test.tsx`: Tests catalog contributions list, review status badges, and search.
   - Mobile `product-drafts.test.tsx`: Tests that Edit, Add, and Delete are available on all templates, that deletion hides template with Undo toast, and invalidates `['me', 'contributions']`.
4. **Android Build & On-Device Verification**:
   - Compile APK with local Gradle:
     `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
   - Install to connected device `96d9c774`:
     `adb -s 96d9c774 install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
   - Launch app:
     `adb -s 96d9c774 shell am start -n com.expyrico.app/.MainActivity`
   - Capture device screenshots via `adb exec-out screencap` to verify:
     - Profile screen renders Contributor Level Hero Card with progress bar.
     - Community Contributions screen displays contributed catalog items.
     - Product Templates screen displays slide-left Edit, Add, and **Delete** actions on items.

## Success Criteria

- [ ] All tests pass across `packages/shared`, `api`, `apps/admin`, and `apps/mobile` (scoped feature suites pass 100%; mobile has 4 pre-existing non-scoped failures).
- [x] No regression in existing pantry, barcode scan, or review routes.
- [x] Workspace typecheck passes cleanly across all packages (`turbo run typecheck`).
- [x] Android debug APK builds and installs cleanly on device `96d9c774`.
- [ ] Visual screenshots verify the contributor level card, contributions list, and template slide-left menu on device (template swipe menu verified on device 96d9c774; contributor card pending remote API deployment).
