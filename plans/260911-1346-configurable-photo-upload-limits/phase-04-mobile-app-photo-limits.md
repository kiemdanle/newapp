---
phase: 4
title: "Mobile App Photo Limits & Client Auto-Compression"
status: pending
priority: P1
effort: "4.5h"
dependencies: [1, 2]
---

<!-- Updated: Validation Session 1 - Soft ceiling & picker 1920 compression -->
<!-- Updated: Advisory Fix - Fix record-photo-storage.ts truncation, update record/[id].tsx handlers, bounded [0.82, 0.72, 0.70] picker retries -->
<!-- Updated: Validation Session 2 - Background compression with slot spinner & instant offline defaults -->
<!-- Updated: Red Team Review - Clamp pantry-to-draft uploads, prevent selection array truncation, and compress VisionCamera captures -->

# Phase 4: Mobile App Photo Limits & Client Auto-Compression

## Overview

Integrate dynamic photo upload limits and client-side photo auto-compression into the React Native mobile application (`apps/mobile`). Replace hardcoded limits with a robust React Query hook backed by local AsyncStorage caching. Configure the native image picker adapter to downscale all photos to a maximum of 1920x1920 with background compression and slot spinners, route VisionCamera captures through native compression, eliminate hidden 5-photo truncations in `record-photo-storage.ts` and `record/[id].tsx`, clamp custom pantry item product draft uploads so they never trigger 409 conflict errors, and prevent selection array truncation during mid-form downward limit hydrations.

## Requirements

### Functional Requirements
- Create `apps/mobile/src/utils/photo-limits.ts`:
  - Hook `usePhotoLimits()` returning `{ maxProductPhotos: number, maxPantryItemPhotos: number }`.
  - Fetches from `GET /settings/photo-limits` using `apiClient`.
  - Caches fresh responses in `AsyncStorage` under key `'pantry.photoLimits.v1'`.
  - Falls back to AsyncStorage cache on network error.
  - **Instant Offline Startup**: On first launch without internet access or cached data, immediately returns `DEFAULT_PHOTO_LIMITS` (`{ maxProductPhotos: 5, maxPantryItemPhotos: 5 }`) without error banners or blocking creation screens. Hydrates from server when connectivity resumes.
  - Configures a 5-minute `staleTime` to avoid redundant network polling during active app usage.
- Fix Pantry Local Storage Truncation (`apps/mobile/src/features/records/record-photo-storage.ts`):
  - In `saveRecordLocalPhotos` (line 65): Remove hardcoded `paths.slice(0, 5)`. Store all paths passed to the function (bounded only by platform maximum 20), allowing pantry items with up to 20 photos to persist and hydrate without truncation.
- Update `AddRecordForm.tsx` (New Pantry Item Creation):
  - Consume both `maxPantryItemPhotos` and `maxProductPhotos` from `usePhotoLimits()`.
  - **Pantry-to-Draft Upload Clamping**: When creating a custom item (lines 155-163), upload only `Math.min(photos.length, maxProductPhotos)` photos to the product draft so catalog limits are strictly respected even if `maxPantryItemPhotos > maxProductPhotos`, while the local pantry item retains all attached photos up to `maxPantryItemPhotos`.
  - **Selection Non-Truncation**: In `onCameraCapture` (line 221) and `onChoosePhotos` (line 235), do not slice the combined array. Instead, compute incremental available slots:
    ```ts
    const availableSlots = Math.max(0, maxPantryItemPhotos - prev.length);
    if (availableSlots <= 0) return prev;
    return [...prev, ...pickedList.slice(0, availableSlots)];
    ```
    This guarantees that previously selected photos are never discarded if limits hydrate downward mid-form.
  - Slot Spinner: Render immediate placeholder card with animated activity spinner while local photo compression settles in the background before showing the final thumbnail.
  - Update header counter to `{photos.length}/{maxPantryItemPhotos} photos`.
  - Show "Take photo" / "Choose photo" buttons only while `photos.length < maxPantryItemPhotos`.
  - Pass dynamic `maxPhotos` to `MultiPhotoCameraModal`.
- Update `MultiPhotoCameraModal.tsx` (Direct VisionCamera Capture Compression):
  - In `handleCapture` (lines 127-143): Rather than using raw captured files with fabricated `size: 500_000`, run the captured file path through native downscaling (`compressImageMaxWidth: 1920`, `compressImageQuality: 0.82`) to guarantee true JPEG files under 1 MB.
- Update `apps/mobile/app/(app)/record/[id].tsx` (Pantry Item Details & Photo Management):
  - Consume `maxPantryItemPhotos` from `usePhotoLimits()`.
  - In `savePhotosToRecord` (line 220): Update `availableSlots = Math.max(0, maxPantryItemPhotos - displayedPhotos.length)`.
  - In `handleAddPhoto` (line 263): Update check to `if (displayedPhotos.length >= maxPantryItemPhotos) { setShowLimitModal(true); return; }`.
  - In `handleSetCover` (lines 254-260) and `handleDeletePhoto` (line 276): Ensure reordering and deletion operations never truncate the photos array, so items with existing photos exceeding a reduced limit (e.g. 6 photos under a 3-photo ceiling) preserve all remaining photos.
  - Pass `maxPhotos={maxPantryItemPhotos}` to `<ItemImageGallery />`.
  - Pass `maxPhotos={Math.max(1, maxPantryItemPhotos - displayedPhotos.length)}` to `<MultiPhotoCameraModal />`.
  - Pass `maxPhotos={maxPantryItemPhotos}` to `<PhotoLimitModal />`.
- Update `ProductPhotoEditor.tsx` (Product Draft Creation & Product Revisions):
  - Accept optional `maxPhotos?: number` prop, defaulting to `usePhotoLimits().maxProductPhotos`.
  - Replace static `const MAX_PHOTOS = 5` with dynamic `effectiveMaxPhotos`.
  - Soft Ceiling Policy: Adding photos is disabled when `totalCount >= effectiveMaxPhotos`.
  - Reordering and deleting existing photos is always permitted without truncation.
  - Slot Spinner: Show subtle spinner on newly enqueued local photo item while background compression runs.
  - Update remaining slots: `Math.max(0, effectiveMaxPhotos - totalCount)`.
  - Update count text: `{totalCount}/{effectiveMaxPhotos} photos{remaining === 0 ? ' — limit reached' : ''}`.
  - Pass remaining slots to `<MultiPhotoCameraModal maxPhotos={remaining} />`.
  - Pass remaining slots to `choosePhotos(remaining)`.
- Update `photo-picker-adapter.ts` for Native Auto-Resize & Bounded Compression:
  - Max dimension: `1920`.
  - Target quality schedule: `[0.82, 0.72, 0.70]`.
  - Target byte bound: `1 * 1024 * 1024` (1 MB).
  - Multi-pass compression retry: If initial pick at quality 0.82 produces a file > 1 MB, re-compress at 0.72, then 0.70 floor.
  - If still > 1 MB after quality 0.70, clean up temp file and throw `PhotoTooLargeError`.

### Non-functional Requirements
- Offline-First: App functions completely offline on fresh launch using default limits without crashing, blocking screens, or showing network errors.
- Data Consistency: Pantry custom item uploads never fail with 409 errors even when user pantry limits exceed product catalog limits.
- Storage Integrity: Eliminates silent truncation bugs in local storage, preserving user data fidelity up to the configured limit.
- Perceptual Performance: Slot spinner indicates responsive activity immediately after selection while compression runs asynchronously in the background.

## Architecture

```
[ Backend: GET /v1/settings/photo-limits ]
                    │
                    ▼
[ Mobile App: usePhotoLimits() ]
  ├── React Query (queryKey: ['settings', 'photo-limits'])
  │     ├── Success ──> Write to AsyncStorage ('pantry.photoLimits.v1')
  │     └── Error   ──> Read from AsyncStorage ('pantry.photoLimits.v1')
  │                      └── Fresh Install Fallback: { maxProductPhotos: 5, maxPantryItemPhotos: 5 }
  │
  ├── photo-picker-adapter.ts
  │     ├── Native resize: Max 1920x1920 px
  │     ├── Quality ladder: [0.82, 0.72, 0.70]
  │     └── Fail-closed PhotoTooLargeError if > 1 MB at Q:0.70
  │
  ├── MultiPhotoCameraModal.tsx
  │     └── VisionCamera captures routed through native 1920x1920 compression
  │
  ├── record-photo-storage.ts
  │     └── Removed hardcoded paths.slice(0, 5) -> persists up to 20
  │
  ├── AddRecordForm (New Pantry Item)
  │     ├── Incremental slot calculation prevents prior selection truncation
  │     ├── Clamps product draft upload: Math.min(photos.length, maxProductPhotos)
  │     └── maxPantryItemPhotos enforces local item slots
  │
  ├── record/[id].tsx (Pantry Item Details)
  │     └── Soft ceiling: existing items with >limit photos remain visible
  │
  └── ProductPhotoEditor (New Product Draft / Edit)
        ├── Slot spinner while background compression runs
        └── maxProductPhotos enforces slots on camera/picker
```

## Related Code Files

- Create: `apps/mobile/src/utils/photo-limits.ts`
- Modify: `apps/mobile/src/features/records/record-photo-storage.ts`
- Modify: `apps/mobile/src/features/products/photo-picker-adapter.ts`
- Modify: `apps/mobile/src/components/MultiPhotoCameraModal.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/app/(app)/record/[id].tsx`
- Modify: `apps/mobile/src/features/products/ProductPhotoEditor.tsx`
- Modify: `apps/mobile/src/features/products/photo-picker-adapter.test.ts`
- Modify: `apps/mobile/src/tests/AddRecordForm.test.tsx`
- Modify: `apps/mobile/src/features/products/ProductPhotoEditor.test.tsx`
- Create: `apps/mobile/tests/unit/record-photo-storage-multi.test.ts`

## Implementation Steps

1. **Create `apps/mobile/src/utils/photo-limits.ts`**:
   - Implement `usePhotoLimits` hook with React Query and AsyncStorage caching, returning defaults immediately if cache is empty.

2. **Fix `record-photo-storage.ts` Storage Truncation**:
   - In `saveRecordLocalPhotos`:
     ```ts
     export async function saveRecordLocalPhotos(clientId: string, paths: string[]): Promise<void> {
       const map = await loadAttachments();
       if (!paths || paths.length === 0) {
         delete map[clientId];
       } else {
         map[clientId] = paths.slice(0, 20); // allow up to platform ceiling 20, never clamp to 5
       }
       memoryCache = { ...map };
       await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
       notifyListeners();
     }
     ```

3. **Update `photo-picker-adapter.ts` with Multi-Pass Compression**:
   - Configure `compressImageMaxWidth: 1920`, `compressImageMaxHeight: 1920`.
   - Implement multi-pass quality ladder `[0.82, 0.72, 0.70]`. If output file size exceeds `1 * 1024 * 1024` bytes, attempt re-compression at lower quality steps before rejecting.
   - If still > 1 MB at quality 0.70, throw `PhotoTooLargeError`.

4. **Update `MultiPhotoCameraModal.tsx`**:
   - After VisionCamera capture, run the image file through native JPEG compression (`1920x1920`, quality 0.82) before storing in state and returning to caller.

5. **Update `AddRecordForm.tsx`**:
   - Consume `{ maxPantryItemPhotos, maxProductPhotos } = usePhotoLimits()`.
   - Fix draft upload clamp (lines 155-163):
     ```ts
     const draftPhotosToUpload = photos.slice(0, maxProductPhotos);
     for (const p of draftPhotosToUpload) {
       uploadProductPhoto({ kind: 'draft', productId: draftRes.product.id }, { path: p.path, mime: p.mime });
     }
     ```
   - Fix selection array truncation (lines 221 & 235):
     ```ts
     setPhotos((prev) => {
       const availableSlots = Math.max(0, maxPantryItemPhotos - prev.length);
       if (availableSlots <= 0) return prev;
       return [...prev, ...pickedList.slice(0, availableSlots)];
     });
     ```
   - Add slot spinner card while background compression executes.

6. **Update `apps/mobile/app/(app)/record/[id].tsx`**:
   - In `savePhotosToRecord`:
     ```ts
     const availableSlots = Math.max(0, maxPantryItemPhotos - displayedPhotos.length);
     if (availableSlots <= 0) return;
     ```
   - In `handleAddPhoto`:
     ```ts
     if (displayedPhotos.length >= maxPantryItemPhotos) {
       setShowLimitModal(true);
       return;
     }
     ```
   - In `handleSetCover` and `handleDeletePhoto`: Verify reordering and deletion preserve all remaining photos without slicing against `maxPantryItemPhotos`.

7. **Update `ProductPhotoEditor.tsx`**:
   - Accept optional `maxPhotos?: number`.
   - Use `effectiveMax = maxPhotos ?? maxProductPhotos`.
   - Mount slot spinner placeholder while local compression processes.
   - Soft ceiling on new additions; allow reordering and deletion of all existing photos without truncation.

8. **Unit Tests**:
   - `record-photo-storage-multi.test.ts`: Verify saving and loading 6, 8, and 12 photos without truncation.
   - `photo-picker-adapter.test.ts`: Verify options specify 1920 dimension, multi-pass retry, and 1 MB max size enforcement.
   - `AddRecordForm.test.tsx`: Test that photo attachments clamp draft uploads to `maxProductPhotos` while keeping all photos locally, and assert selection non-truncation.
   - `ProductPhotoEditor.test.tsx`: Test with explicit `maxPhotos={3}`.
   - Record detail tests: Test that reducing limit from 6 to 3 followed by reorder preserves all 6 photos.

## Success Criteria

- [x] Mobile app fetches photo limits from `/settings/photo-limits` on startup.
- [x] Fresh offline installs open immediately without error banners, using standard 5-photo defaults.
- [x] Custom pantry items with photos > `maxProductPhotos` upload up to `maxProductPhotos` to draft without 409 errors.
- [x] In-progress photo selections in `AddRecordForm` are not truncated if limits hydrate downward.
- [x] VisionCamera captures in `MultiPhotoCameraModal` are compressed to real JPEG files under 1 MB.
- [x] `record-photo-storage.ts` preserves more than 5 photos (up to 20) without silent truncation.
- [x] `record/[id].tsx` lines 220 & 263 use `maxPantryItemPhotos` and never truncate existing photos on reorder or delete.
- [x] `ProductPhotoEditor` caps product photos at `maxProductPhotos`.
- [x] Mobile Jest test suites pass cleanly.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Fresh install offline launch fails or blocks | High | Low | Query hook immediately returns default limits synchronously while asynchronous hydration settles |
| Custom pantry items upload more photos than product draft allows | High | Low | Explicit `photos.slice(0, maxProductPhotos)` guarantees draft creation never triggers a 409 conflict |
| Existing items with >limit photos truncated on reorder | High | Low | Handlers operate strictly on existing array indices and IDs, never applying `.slice(0, limit)` on reorganization |
