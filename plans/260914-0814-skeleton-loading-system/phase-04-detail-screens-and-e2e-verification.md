---
phase: 4
title: "Detail Screens, History View & E2E Native Verification"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-skeleton-primitives", "phase-02-thumbnail-and-card-loading", "phase-03-initial-sync-and-pantry-skeleton"]
---

# Phase 4: Detail Screens, History View & E2E Native Verification

## Overview
Complete skeleton loading coverage for deep product/record detail screens (`record/[id].tsx` and `product/[id].tsx`) and the pantry history tab (`PantryHistoryView.tsx`). Run full test suites, typechecks, assemble the Android debug APK directly via the local Gradle toolchain, and verify smooth native skeleton shimmer on physical device `121b0a46`.

## Requirements
- **Functional**:
  - `RecordDetailSkeleton.tsx`:
    - Full-screen detail view skeleton rendered while `record` or linked `product` is loading:
      - 220px hero image bone.
      - Title bone (20px height) + inline sentiment strip bone.
      - Expiry and purchase date pills bones.
      - Quantity, unit, location, and store row bones.
      - Action buttons bone at screen bottom.
  - `PantryHistoryView.tsx` Skeleton Integration:
    - Render 2 KPI card bones (Consumed & Discarded) and 3 history item bones while history data is loading.
  - Verification & Build:
    - All Jest unit test suites passing.
    - Zero TypeScript errors across `@expyrico/mobile`.
    - Local Gradle debug APK compilation without Expo CLI or EAS.
    - Physical device verification via `adb install -r`.
- **Non-functional**:
  - Android build policy strictly enforced (no Expo CLI/EAS; direct Gradle and `adb`).
  - Expyrico color palette compliance across all skeleton states.

## Architecture

```
+-----------------------------------------------------------------+
|                   Deep Screen Navigation Flow                   |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                   record/[id].tsx / product/[id].tsx            |
|  - useRecord(id) / useProduct(id)                               |
|  +-----------------------------------------------------------+  |
|  |  isLoading && !cachedData -> <RecordDetailSkeleton />     |  |
|  +-----------------------------------------------------------+  |
|  +-----------------------------------------------------------+  |
|  |  dataResolved             -> Render actual Detail Screen  |  |
|  +-----------------------------------------------------------+  |
+-----------------------------------------------------------------+
```

## Related Code Files
- Create:
  - `apps/mobile/src/components/skeleton/RecordDetailSkeleton.tsx`
  - `apps/mobile/tests/unit/record-detail-skeleton.test.tsx`
- Modify:
  - `apps/mobile/app/(app)/record/[id].tsx`
  - `apps/mobile/app/(app)/product/[id].tsx`
  - `apps/mobile/src/features/records/PantryHistoryView.tsx`

## Implementation Steps
1. Create `RecordDetailSkeleton.tsx`:
   - Structure container matching `record/[id].tsx`:
     - Large hero image container (220px).
     - Title bar, sentiment row bone, date chip bones, metadata rows.
   - Wrap in `SkeletonShimmer`.
2. Update `apps/mobile/app/(app)/record/[id].tsx`:
   - Replace generic `<ActivityIndicator />` with `<RecordDetailSkeleton />` while `!record`.
3. Update `apps/mobile/app/(app)/product/[id].tsx`:
   - Replace generic activity spinner with `<RecordDetailSkeleton />` while `isLoading`.
4. Update `apps/mobile/src/features/records/PantryHistoryView.tsx`:
   - Integrate skeleton bones for KPI cards and history rows while sync or initial load is in progress.
5. Verification:
   - Run `npm run typecheck` in `apps/mobile`.
   - Run `npm test -- tests/unit/skeleton-*.test.tsx`.
   - Build Android APK via local Gradle toolchain:
     ```bash
     cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
     ```
   - Install APK to connected phone `121b0a46` via `adb install -r`.
   - Perform live visual inspection: launch app with cold cache, verify shimmer animation, observe smooth transition as data arrives.

## Success Criteria
- [ ] Navigating to record/product detail screen displays polished skeleton hero and metadata rows instead of blank or spinner.
- [ ] History tab renders shimmering KPI bones during cold load.
- [ ] All unit tests pass with zero failures.
- [ ] TypeScript check reports 0 errors.
- [ ] Android APK builds successfully via local Gradle and installs cleanly to phone `121b0a46`.

## Risk Assessment
- **Risk**: Full-screen skeleton layout differs slightly from final loaded record detail, causing a slight pop when data arrives.
  - *Observable Signal*: Elements shift vertically when text replaces bones.
  - *Pre-decided Response*: Reuse identical `marginHorizontal`, `padding`, and `gap` values from `record/[id].tsx` style definitions inside `RecordDetailSkeleton.tsx`.
