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
  - `useRecordWithStatus(id)` State Discrimination (`apps/mobile/src/api/records.ts`):
    - Export `useRecordWithStatus(id: string | undefined): { record: LocalRecord | null; isLoading: boolean; isResolved: boolean }`.
    - In `record/[id].tsx`, cleanly discriminate:
      - `if (isRecordLoading && !isRecordResolved) return <RecordDetailSkeleton />;`
      - `if (isRecordResolved && !record) return <ItemNotFoundView />;`
      - `if (isProductPending) return <RecordDetailSkeleton />;`
    - Prevents masking a missing record forever or flashing "Item not found" before WatermelonDB emits.
  - Dedicated Skeleton Components:
    - `RecordDetailSkeleton.tsx`: Tailored to pantry items (220px hero image bone, title bone, sentiment strip bone, expiry date pills, location, store, notes, and action button bones).
    - `ProductDetailSkeleton.tsx`: Tailored to catalog products (220px hero image bone, title bone, barcode chip, categories, brand, default shelf-life, and community review breakdown bones).
  - **Hero & Gallery Image Settlement Contract**:
    - In both `record/[id].tsx` and `product/[id].tsx`, readiness satisfies `dataReady && allVisibleImagesSettled`.
    - While the active hero photo has not fired `onLoadEnd` or `onError`, display an absolute `SkeletonBone` overlay (220px height) over the hero container.
    - On `onLoadEnd`, smoothly fade in the image (`fadeDuration={150}`).
    - For the thumbnail gallery strip, render individual thumbnail skeleton bones until each respective candidate emits `onLoadEnd` or `onError`.
    - On error, display the fallback image placeholder with an error retry indicator.
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
  - `apps/mobile/src/components/skeleton/ProductDetailSkeleton.tsx`
  - `apps/mobile/tests/unit/record-detail-skeleton.test.tsx`
- Modify:
  - `apps/mobile/src/api/records.ts` (export `useRecordWithStatus`)
  - `apps/mobile/app/(app)/record/[id].tsx`
  - `apps/mobile/app/(app)/product/[id].tsx`
  - `apps/mobile/src/features/records/PantryHistoryView.tsx`
## Implementation Steps
1. Update `apps/mobile/src/api/records.ts`:
   - Implement and export `useRecordWithStatus(id)`.
2. Create `RecordDetailSkeleton.tsx` and `ProductDetailSkeleton.tsx`:
   - Structure containers matching `record/[id].tsx` and `product/[id].tsx`:
     - Large hero image container (220px).
     - Title bar, sentiment row bone, date chip bones, metadata rows.
   - Wrap in `SkeletonShimmer`.
3. Update `apps/mobile/app/(app)/record/[id].tsx`:
   - Consume `useRecordWithStatus(id)`.
   - Gate:
     ```tsx
     if (isRecordLoading && !isRecordResolved) return <RecordDetailSkeleton />;
     if (isRecordResolved && !record) return <ItemNotFoundView />;
     if (isProductPending) return <RecordDetailSkeleton />;
     ```
   - Add hero photo settlement tracking (`const [heroSettled, setHeroSettled] = useState(false)`) and render `SkeletonBone` overlay on the 220px hero image until `onLoadEnd` or `onError` fires.
   - Add gallery thumbnail settlement tracking for the multi-photo strip.
4. Update `apps/mobile/app/(app)/product/[id].tsx`:
   - Render `<ProductDetailSkeleton />` while `isLoading && !product`.
   - Add hero image settlement overlay until `onLoadEnd` fires.
5. Create `tests/unit/record-detail-skeleton.test.tsx`:
   - Test `useRecordWithStatus` transitions (`isLoading -> isResolved`).
   - Test that `RecordDetail` renders `RecordDetailSkeleton` while `isProductPending === true`.
   - **Mock Slow Image Scenario**: Simulate instant record and product resolution with hero image delayed by 500ms; verify hero skeleton overlay remains visible until `onLoadEnd`.
6. Verification:
   - Run `npm run typecheck` in `apps/mobile`.
   - Run all 4 new unit test suites:
     ```bash
     npm test -- tests/unit/skeleton-primitives.test.tsx tests/unit/thumbnail-and-card-loading.test.tsx tests/unit/pantry-list-skeleton.test.tsx tests/unit/record-detail-skeleton.test.tsx
     ```
   - Build Android APK via local Gradle toolchain:
     ```bash
     cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
     ```
   - Install APK to connected phone `121b0a46`:
     ```bash
     adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
     ```
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
