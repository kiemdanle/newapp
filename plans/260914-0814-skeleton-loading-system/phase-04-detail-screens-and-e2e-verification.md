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
  - **Hero & Gallery Image Settlement Contract & Aggregate Tracker**:
    - In `apps/mobile/src/cache/useImageSettlementTracker.ts`, export:
      ```tsx
      export function useImageSettlementTracker(uris: string[], options?: { timeoutMs?: number }): {
        allSettled: boolean;
        markSettled: (uri: string) => void;
      };
      ```
    - Synchronous L1 cache hits mark URIs settled immediately on mount; unhydrated or remote URIs settle upon `markSettled(uri)` callback (`onLoadEnd`/`onError`).
    - Includes a 3,000ms fail-safe timeout so slow image networks never trap the screen indefinitely in a skeleton.
    - Both `record/[id].tsx` and `product/[id].tsx` gate full screen skeleton unmasking strictly on:
      `isDetailReady = dataReady && allVisibleImagesSettled`
    - In `ItemImageGallery.tsx`, accept `onImageSettled?: (uri: string) => void` and forward to `GalleryImageItem` so every rendered carousel and thumbnail image reports settlement up to the screen's aggregate gate.
    - In addition, individual `<GalleryImageItem>` elements retain per-image `SkeletonBone` overlays with smooth cross-fade (`fadeDuration={150}`) upon settlement.
  - `PantryHistoryView.tsx` Skeleton Integration & State Discrimination:
    - In `apps/mobile/src/api/records.ts`, export `usePantryHistoryRecordsWithStatus(filter)`: `{ records, isLoading, isResolved }`.
    - In `PantryHistoryView.tsx`, compute:
      ```tsx
      const showHistorySkeleton = !isHistoryResolved || (!initialSyncCompleted && displayRecords.length === 0);
      ```
    - While `showHistorySkeleton` is true, render `<PantryHistorySkeleton />` (2 KPI card bones + 3 history row bones).
    - Eliminates the fresh-install startup gap before `runSync()` sets `isSyncing = true`. Once `initialSyncCompleted` settles, genuine empty history renders `renderEmpty()` immediately without delays or spurious skeleton timeouts.
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
|                        record/[id].tsx                          |
|  - useRecordWithStatus(id) -> { record, isLoading, isResolved } |
|  - useProduct(productId)   -> { product, isLoading, isError }  |
|  - isProductPending = productId && !customName && isProdLoading |
|  +-----------------------------------------------------------+  |
|  |  isLoading && !isResolved  -> <RecordDetailSkeleton />    |  |
|  |  isResolved && !record     -> <ItemNotFoundView />        |  |
|  |  isProductPending          -> <RecordDetailSkeleton />    |  |
|  |  dataReady                 -> Check Image Settlement      |  |
|  +-----------------------------------------------------------+  |
|                                |                                |
|                                v                                |
|  +-----------------------------------------------------------+  |
|  |  useImageSettlementTracker(photoUris)                     |  |
|  |  - !allVisibleImagesSettled -> <RecordDetailSkeleton />   |  |
|  |  - allVisibleImagesSettled  -> Render Record Content      |  |
|  +-----------------------------------------------------------+  |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                        product/[id].tsx                         |
|  - useProduct(id) -> { data, isLoading, isError }               |
|  - useImageSettlementTracker(photoUris)                         |
|  +-----------------------------------------------------------+  |
|  |  isLoading || !allSettled   -> <ProductDetailSkeleton />  |  |
|  |  dataReady && allSettled    -> Render Product Screen      |  |
|  |  ItemImageGallery           -> Shared Gallery Skeletons   |  |
|  +-----------------------------------------------------------+  |
+-----------------------------------------------------------------+
```

## Related Code Files
- Create:
  - `apps/mobile/src/cache/useImageSettlementTracker.ts`
  - `apps/mobile/src/components/skeleton/RecordDetailSkeleton.tsx`
  - `apps/mobile/src/components/skeleton/ProductDetailSkeleton.tsx`
  - `apps/mobile/src/features/records/PantryHistorySkeleton.tsx`
  - `apps/mobile/tests/unit/record-detail-skeleton.test.tsx`
  - `apps/mobile/tests/unit/image-settlement-tracker.test.ts`
- Modify:
  - `apps/mobile/src/api/records.ts` (export `useRecordWithStatus` and `usePantryHistoryRecordsWithStatus`)
  - `apps/mobile/src/components/ItemImageGallery.tsx` (add `onImageSettled` callback & settlement overlay in `GalleryImageItem`)
  - `apps/mobile/app/(app)/record/[id].tsx`
  - `apps/mobile/app/(app)/product/[id].tsx`
  - `apps/mobile/src/features/records/PantryHistoryView.tsx`

## Implementation Steps
1. Create `apps/mobile/src/cache/useImageSettlementTracker.ts`:
   - Check warm memory hits via `imageDiskCache.getSync()`.
   - Track settlement set (`useState<Set<string>>`) and provide `markSettled(uri: string)`.
   - Add 3,000ms timeout fallback that sets `allSettled = true`.
2. Update `apps/mobile/src/api/records.ts`:
   - Implement and export `useRecordWithStatus(id)` and `usePantryHistoryRecordsWithStatus(filter)`.
3. Create `RecordDetailSkeleton.tsx`, `ProductDetailSkeleton.tsx`, and `PantryHistorySkeleton.tsx`:
   - Structure containers matching `record/[id].tsx`, `product/[id].tsx`, and `PantryHistoryView.tsx` KPI cards/history rows.
   - Wrap in `SkeletonShimmer`.
4. Update `apps/mobile/src/components/ItemImageGallery.tsx`:
   - Add `onImageSettled?: (uri: string) => void` to `ItemImageGalleryProps` and `GalleryImageItem`.
   - In `GalleryImageItem`, consume `useCachedImage(url)`, derive `renderUri = uri || url`.
   - Key settlement on `settledUri === renderUri`.
   - When `onLoadEnd` or `onError` fires, call `setSettledUri(renderUri)` and `onImageSettled?.(url)`.
   - Retain `SkeletonBone` overlay with `SkeletonShimmer` while `!isSettled`.
5. Update `apps/mobile/app/(app)/record/[id].tsx`:
   - Consume `useRecordWithStatus(id)`.
   - Consume `useImageSettlementTracker(displayedPhotos.slice(0, 3))` and pass `markSettled` to `ItemImageGallery`.
   - Gate:
     ```tsx
     const dataReady = isRecordResolved && record && !isProductPending;
     if (!dataReady || !allVisibleImagesSettled) return <RecordDetailSkeleton />;
     if (isRecordResolved && !record) return <ItemNotFoundView />;
     ```
6. Update `apps/mobile/app/(app)/product/[id].tsx`:
   - Consume `useImageSettlementTracker(uniquePhotos.slice(0, 3))` and pass `markSettled` to `ItemImageGallery`.
   - Gate: `if (isLoading || !data || !allVisibleImagesSettled) return <ProductDetailSkeleton />;`.
7. Update `apps/mobile/src/features/records/PantryHistoryView.tsx`:
   - Consume `usePantryHistoryRecordsWithStatus(activeFilter)`.
   - Compute: `const showHistorySkeleton = !isHistoryResolved || (!initialSyncCompleted && displayRecords.length === 0);`.
   - Render `<PantryHistorySkeleton />` while `showHistorySkeleton` is true.
   - Render `renderEmpty()` immediately when `isHistoryResolved && initialSyncCompleted && displayRecords.length === 0`.
8. Create `tests/unit/record-detail-skeleton.test.tsx` and `tests/unit/image-settlement-tracker.test.ts`:
   - Test `useImageSettlementTracker` with warm hits, slow network loads, and 3s timeout fallback.
   - Test that `RecordDetail` and `ProductDetail` hold the full structural skeleton until BOTH metadata and visible images settle.
   - **Mock Slow Image Scenario**: Simulate instant metadata resolution with hero photo delayed by 500ms; verify skeleton stays active until image settles.
   - Test `usePantryHistoryRecordsWithStatus` and `PantryHistoryView` state discrimination.
9. Verification:
   - Run `npm run typecheck` in `apps/mobile`.
   - Run all 5 unit test suites:
     ```bash
     npm test -- tests/unit/skeleton-primitives.test.tsx tests/unit/thumbnail-and-card-loading.test.tsx tests/unit/pantry-list-skeleton.test.tsx tests/unit/record-detail-skeleton.test.tsx tests/unit/image-settlement-tracker.test.ts
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
- [ ] ItemImageGallery renders skeleton bones over hero carousel and thumbnail strip until active images emit onLoadEnd or onError.
- [ ] History tab renders shimmering KPI bones during cold load, and immediately displays renderEmpty() when history is genuinely empty.
- [ ] All unit tests pass with zero failures across the test suites.
- [ ] TypeScript check reports 0 errors across `@expyrico/mobile`.
- [ ] Android APK builds successfully via local Gradle and installs cleanly to phone `121b0a46`.

## Risk Assessment
- **Risk**: Full-screen skeleton layout differs slightly from final loaded record detail, causing a slight pop when data arrives.
  - *Observable Signal*: Elements shift vertically when text replaces bones.
  - *Pre-decided Response*: Reuse identical `marginHorizontal`, `padding`, and `gap` values from `record/[id].tsx` and `product/[id].tsx` style definitions inside `RecordDetailSkeleton.tsx` and `ProductDetailSkeleton.tsx`.
