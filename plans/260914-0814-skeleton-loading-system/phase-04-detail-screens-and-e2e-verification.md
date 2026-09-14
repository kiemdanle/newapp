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
    - **Native Decode & Display Settlement**: Warm L1 cache hits seed the local file URI to `<Image>` immediately, but visual settlement strictly requires that source's native `<Image onLoadEnd>` (or `onError`) callback before marking settled. Warm hits do not bypass decode/display confirmation, ensuring cached images never unmask before pixels are actually visible on screen.
    - **Dynamic URI Set Transition & Settlement Reset Contract**:
      - Key internal settlement state to `urisKey = uris.join('|')`.
      - When `uris` transitions from `[]` (during initial metadata loading) to a populated photo list, the tracker MUST reset its `settledUris` set, recompute `allSettled = false`, and start a fresh 3,000ms timer.
      - Prevents an initial `allSettled = true` from an empty input from bypassing the aggregate skeleton when real photos subsequently resolve.
    - **Per-Image 3,000ms Safety Timeout**:
      - In `GalleryImageItem`, if neither `onLoadEnd` nor `onError` fires within 3,000ms, force settlement (`setSettledUri(renderUri)` and `onImageSettled?.(url)`).
      - Unmasks the skeleton bone and displays the fallback placeholder (`placeholderIcon = 'image-outline'`) with an offline/retry indicator, guaranteeing that neither the aggregate screen nor individual gallery items can be locked indefinitely by a stalled network.
    - Both `record/[id].tsx` and `product/[id].tsx` gate full screen skeleton unmasking strictly on:
      `isDetailReady = dataReady && allVisibleImagesSettled`
    - In `ItemImageGallery.tsx`, accept `onImageSettled?: (uri: string) => void` and forward to `GalleryImageItem` so every rendered carousel and thumbnail image reports settlement up to the screen's aggregate gate.
    - In addition, individual `<GalleryImageItem>` elements retain per-image `SkeletonBone` overlays with smooth cross-fade (`fadeDuration={150}`) upon settlement.
  - `PantryHistoryView.tsx` Skeleton Integration & State Discrimination:
    - In `apps/mobile/src/api/records.ts`, export `usePantryHistoryRecordsWithStatus(filter)`: `{ records, isLoading, isResolved }`.
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
|  - useImageSettlementTracker(displayedPhotos)                   |
|  +-----------------------------------------------------------+  |
|  |  1. isRecordLoading && !isResolved -> <RecordSkeleton />  |  |
|  |  2. isRecordResolved && !record    -> <ItemNotFoundView /> |  |
|  |  3. isProductPending || !allSettled -> <RecordSkeleton /> |  |
|  |  4. dataReady && allSettled        -> Render Record Screen|  |
|  +-----------------------------------------------------------+  |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                        product/[id].tsx                         |
|  - useProduct(id) -> { data, isLoading, isError }               |
|  - useImageSettlementTracker(uniquePhotos)                      |
|  +-----------------------------------------------------------+  |
|  |  1. isLoading && !data && !isError -> <ProductSkeleton /> |  |
|  |  2. isError || (!isLoading && !data) -> <NotFoundView />  |  |
|  |  3. !allVisibleImagesSettled       -> <ProductSkeleton /> |  |
|  |  4. dataReady && allSettled        -> Render Product Screen|  |
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

1. Create `apps/mobile/src/cache/useImageSettlementTracker.ts`:
   - Accept candidate URIs to track in the active viewport.
   - Key state on `urisKey = uris.join('|')`; reset `settledUris` and restart timer on every URI set change.
   - If `uris.length === 0`: `allSettled = true`. If `uris.length > 0`: `allSettled = false` until all URIs fire `markSettled`.
   - Seed availability immediately from warm L1 cache if present, but track visual settlement exclusively via `markSettled(uri)` triggered by native `<Image onLoadEnd>` or `<Image onError>`.
   - Add 3,000ms timeout fallback that sets `allSettled = true` to guarantee resilient recovery if network or decode stalls.
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
   - Add 3,000ms safety timeout that forces `setSettledUri(renderUri)` and `onImageSettled?.(url)` if neither event fires.
   - Retain `SkeletonBone` overlay with `SkeletonShimmer` while `!isSettled`.
5. Update `apps/mobile/app/(app)/record/[id].tsx`:
   - Consume `const { record, isLoading: isRecordLoading, isResolved: isRecordResolved } = useRecordWithStatus(id);`.
   - **React Rules of Hooks Invariant**: Compute `displayedPhotos` via `useMemo` and invoke `useImageSettlementTracker(displayedPhotos)` unconditionally at the component top before ANY early return statements (returns `[]` safely when `!record`):
     ```tsx
     const displayedPhotos: string[] = useMemo(() => {
       if (!record) return [];
       if (record.localPhotos && record.localPhotos.length > 0) return record.localPhotos;
       const fallbackList = [
         record.photoUrl,
         product?.imageUrl,
         ...(product?.photos?.map((p: any) => p.displayUrl || p.thumbnailUrl || p.photoUrl) || []),
       ].filter(Boolean) as string[];
       return Array.from(new Set(fallbackList));
     }, [record, product]);

     const { allSettled: allVisibleImagesSettled, markSettled } = useImageSettlementTracker(displayedPhotos);
     ```
   - Evaluate terminal not-found and readiness gates in strict sequential order:
     ```tsx
     // 1. In-flight local SQLite read: show skeleton
     if (isRecordLoading && !isRecordResolved) return <RecordDetailSkeleton />;

     // 2. Terminal Not-Found Branch (checked FIRST before metadata/image readiness):
     if (isRecordResolved && !record) return <ItemNotFoundView />;

     // 3. At this point, record is guaranteed non-null:
     const isProductPending = Boolean(record.productId && !record.customName && isProductLoading && !isProductError);
     const isDetailReady = !isProductPending && allVisibleImagesSettled;

     // 4. If product metadata or images are pending, hold skeleton until ready:
     if (!isDetailReady) return <RecordDetailSkeleton />;
     ```
   - Pass `onImageSettled={markSettled}` to `ItemImageGallery`.
6. Update `apps/mobile/app/(app)/product/[id].tsx`:
   - Destructure `const { data, isLoading, isError } = useProduct(id);`.
   - Compute `uniquePhotos` via `useMemo` and invoke `useImageSettlementTracker(uniquePhotos)` unconditionally before any early returns:
     ```tsx
     const uniquePhotos: string[] = useMemo(() => {
       if (!data) return [];
       const photoList = [
         data.imageUrl,
         ...(data.photos?.map((p: any) => p.displayUrl || p.photoUrl || p.thumbnailUrl) || []),
       ].filter(Boolean) as string[];
       return Array.from(new Set(photoList));
     }, [data]);

     const { allSettled: allVisibleImagesSettled, markSettled } = useImageSettlementTracker(uniquePhotos);
     ```
   - Evaluate terminal error and readiness gates in strict sequential order:
     ```tsx
     // 1. In-flight catalog query: show skeleton
     if (isLoading && !data && !isError) return <ProductDetailSkeleton />;

     // 2. Terminal Error / Not-Found Branch (404 or network failure):
     if (isError || (!isLoading && !data)) {
       return (
         <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
           <Ionicons name="cube-outline" size={36} color={theme.colors.textMuted} />
           <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Product not found</Text>
           <Text style={[styles.errorSubtitle, { color: theme.colors.textMuted }]}>
             This product could not be loaded or may have been removed.
           </Text>
           <Button label="Back" onPress={() => navigation.goBack()} />
         </View>
       );
     }

     // 3. At this point, data is guaranteed non-null:
     if (!allVisibleImagesSettled) return <ProductDetailSkeleton />;
     ```
   - Pass `onImageSettled={markSettled}` to `ItemImageGallery`.
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
