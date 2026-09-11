---
phase: 3
title: "Admin Dashboard Settings UI & In-Browser Auto-Compression"
status: pending
priority: P1
effort: "4.5h"
dependencies: [1, 2]
---

<!-- Updated: Validation Session 1 - WebP with JPEG fallback & 0.70 step-down -->
<!-- Updated: Advisory Fix - Strict [0.82, 0.72, 0.70] schedule, terminal error on floor, fail-closed on canvas error, ALLOWED_MIME_TYPES WebP -->
<!-- Updated: Validation Session 2 - Background compression with slot spinner -->
<!-- Updated: Red Team Review - Relax raw file prefilter in ProductPhotoManager to 25MB for client canvas compression -->

# Phase 3: Admin Dashboard Settings UI & In-Browser Auto-Compression

## Overview

Build the administrative user interface in `apps/admin` allowing platform administrators to view and configure the maximum number of photo uploads allowed for new products and pantry items. Implement client-side in-browser canvas auto-compression in the catalog product photo manager with visual slot spinners, so that heavy photos selected by administrators (up to 25 MB raw) are automatically resized in the background to max 1920x1920, compressed in WebP format (with JPEG fallback) through a strict bounded quality schedule `[0.82, 0.72, 0.70]`, and kept strictly under 1 MB prior to network transmission, failing closed if compression cannot satisfy the byte budget.

## Requirements

### Functional Requirements
- Add a new navigation item **"Photo upload limits"** under the **Settings** section in `apps/admin/src/lib/nav.ts`.
- Expose `serverAdminApi.settings.photoLimits` in `apps/admin/src/lib/admin-api.ts` with `get()` and `patch()`.
- Add Server Action `savePhotoLimitsAction(body: PhotoLimitsSettings)` in `apps/admin/src/lib/actions.ts` with Next.js path revalidation.
- Create `/settings/photo-limits/page.tsx` (Server Component) that loads initial settings and renders the form.
- Create `/settings/photo-limits/photo-limits-form.tsx` (Client Component) providing:
  - Numeric stepper/input controls for:
    - **Max photos per product**: Controls catalog products, draft creations, and revisions.
    - **Max photos per pantry item**: Controls mobile pantry record photo attachments.
  - Quick-select presets:
    - **Standard (5 / 5)**: Balanced default for storage and fidelity.
    - **Lean (3 / 3)**: Low-bandwidth, high-speed mobile experience.
    - **Detailed (10 / 10)**: For comprehensive packaging, nutrition, and condition capture.
  - Informative storage callout explaining that all photo uploads are automatically compressed under 1 MB at max 1920x1920 resolution in WebP format with JPEG fallback.
  - Policy note indicating that reducing a limit acts as a soft ceiling on new uploads without deleting or invalidating existing photos.
  - Client-side validation: Restricts values to integers between 1 and 20.
  - Visual feedback: Loading state (`useTransition`), success alert, and error handling.
- Create in-browser image compression utility (`apps/admin/src/lib/image-compression.ts`):
  - Function `compressImageForUpload(file: File): Promise<File>`:
    - Checks browser WebP canvas support (`canvas.toDataURL('image/webp').startsWith('data:image/webp')`).
    - Decodes image and downscales proportionally so max dimension does not exceed 1920px.
    - Renders to an offscreen HTML5 `<canvas>`.
    - Attempts export as `image/webp` (or `image/jpeg` fallback) across strictly bounded quality ladder `[0.82, 0.72, 0.70]`.
    - Terminal Error: If the compressed blob exceeds 1 MB (`1,048,576` bytes) after the 0.70 attempt, throw `Error('Image is too complex to compress under 1 MB. Please select a clearer photo.')` — never upload oversized files.
    - Fail Closed: If image decoding or canvas context fails, throw a descriptive error rather than returning the raw uncompressed original file.
- Update `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx`:
  - Update `ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']` to admit WebP files.
  - Relax Raw File Input Prefilter: Replace legacy `const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB` with `const MAX_RAW_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB`. This allows administrators to drag and drop high-resolution camera photos (e.g. 8–15 MB) so that `compressImageForUpload` can process and compress them down to < 1 MB before transmission.
  - Background Compression with Slot Spinner: When files are selected or dropped, immediately mount placeholder slot cards with animated spinners while `compressImageForUpload` executes in the background. Once compressed, swap to the crisp thumbnail preview and size badge before enqueuing for upload.
  - Accept `maxPhotos?: number` prop (defaulting to 5).
  - Enforce soft ceiling: If `photos.length >= maxPhotos`, disable upload dropzone, but allow full reordering and deletion of all existing photos without truncation.
  - Pass the current setting from `apps/admin/src/app/(admin)/products/[id]/page.tsx`.

### Non-functional Requirements
- Design System: 100% compliant with Expyrico design guidelines (`docs/design/expyrico-colour-palette.md`).
- Accessibility: Valid form labels, ARIA live regions for error/success notifications, keyboard-navigable steppers and buttons.
- Responsive UX: Non-blocking background compression maintains a fluid 60 FPS UI without freezing the browser during image encoding.
- Fail-Closed Safety: Raw oversized images are never sent over the network if client compression fails.

## Architecture

```
[ Admin Sidebar ] ──> /settings/photo-limits
                             │
                             ▼
[ SettingsPhotoLimitsPage (Server Component) ]
  └── serverAdminApi.settings.photoLimits.get()
        └── Passes initial: PhotoLimitsSettings
              │
              ▼
[ PhotoLimitsForm (Client Component) ]
  ├── Steppers: Product Max [1..20] & Pantry Item Max [1..20]
  ├── Presets: Standard (5/5), Lean (3/3), Detailed (10/10)
  ├── Policy Note: Soft ceiling for new uploads
  └── Save Button ──> savePhotoLimitsAction(values)

[ ProductPhotoManager (/products/[id]) ]
  ├── ALLOWED_MIME_TYPES: jpeg, png, webp
  ├── Raw prefilter relaxed to 25 MB (admits high-res camera captures)
  ├── Slot Spinner mounted immediately in photo grid
  ├── compressImageForUpload(file) [Background Canvas]
  │     ├── Downscale to 1920x1920
  │     ├── Encode WebP/JPEG at [0.82, 0.72, 0.70]
  │     ├── If still > 1 MB at 0.70 -> throw Error
  │     └── If canvas fails -> throw Error (fail closed)
  ├── Replace Slot Spinner with thumbnail & size badge (~250 KB)
  └── uploadProductPhotoAction(productId, formData)
```

## Related Code Files

- Modify: `apps/admin/src/lib/nav.ts`
- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Create: `apps/admin/src/lib/image-compression.ts`
- Create: `apps/admin/src/app/(admin)/settings/photo-limits/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/photo-limits/photo-limits-form.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx`
- Create: `apps/admin/tests/unit/photo-limits-actions.test.ts`
- Create: `apps/admin/tests/unit/image-compression.test.ts`

## Implementation Steps

1. **Navigation Update (`apps/admin/src/lib/nav.ts`)**:
   - In `NAV` array under `title: 'Settings'`, append:
     ```ts
     { label: 'Photo upload limits', href: '/settings/photo-limits', icon: 'Camera' }
     ```

2. **Admin API Client (`apps/admin/src/lib/admin-api.ts`)**:
   - In `serverAdminApi.settings`, add `photoLimits: { get, patch }`.

3. **Server Action (`apps/admin/src/lib/actions.ts`)**:
   - Export `savePhotoLimitsAction(body: PhotoLimitsSettings)` with revalidation of `/settings/photo-limits`.

4. **In-Browser Image Compression Utility (`apps/admin/src/lib/image-compression.ts`)**:
   - Implement `compressImageForUpload`:
     ```ts
     const MAX_DIMENSION = 1920;
     const QUALITY_STEPS = [0.82, 0.72, 0.70] as const;
     const MAX_BYTES = 1 * 1024 * 1024; // 1 MB

     function isWebPSupported(): boolean {
       try {
         const c = document.createElement('canvas');
         return c.toDataURL('image/webp').startsWith('data:image/webp');
       } catch {
         return false;
       }
     }

     export async function compressImageForUpload(file: File): Promise<File> {
       const format = isWebPSupported() ? 'image/webp' : 'image/jpeg';
       const extension = format === 'image/webp' ? '.webp' : '.jpg';

       return new Promise((resolve, reject) => {
         const img = new Image();
         const url = URL.createObjectURL(file);
         img.onload = async () => {
           URL.revokeObjectURL(url);
           let { width, height } = img;
           if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
             if (width > height) {
               height = Math.round((height * MAX_DIMENSION) / width);
               width = MAX_DIMENSION;
             } else {
               width = Math.round((width * MAX_DIMENSION) / height);
               height = MAX_DIMENSION;
             }
           }
           const canvas = document.createElement('canvas');
           canvas.width = width;
           canvas.height = height;
           const ctx = canvas.getContext('2d');
           if (!ctx) {
             return reject(new Error('Failed to initialize canvas context for image compression'));
           }
           ctx.drawImage(img, 0, 0, width, height);

           let lastBlob: Blob | null = null;
           for (const q of QUALITY_STEPS) {
             const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, format, q));
             if (blob) {
               lastBlob = blob;
               if (blob.size <= MAX_BYTES) {
                 const newName = file.name.replace(/\.[^/.]+$/, '') + extension;
                 return resolve(new File([blob], newName, { type: format }));
               }
             }
           }

           // Fail closed if still > 1 MB after 0.70 attempt
           reject(
             new Error(
               `Image is too dense to compress under 1 MB (${Math.round((lastBlob?.size ?? 0) / 1024)} KB at quality 0.70). Please select a clearer photo.`,
             ),
           );
         };
         img.onerror = () => {
           URL.revokeObjectURL(url);
           reject(new Error('Failed to decode image file for compression'));
         };
         img.src = url;
       });
     }
     ```

5. **Page & Form Components (`apps/admin/src/app/(admin)/settings/photo-limits/`)**:
   - `page.tsx`: Server Component loading initial limits and rendering `<PhotoLimitsForm />`.
   - `photo-limits-form.tsx`:
     - Provide controls for `maxProductPhotos` and `maxPantryItemPhotos`.
     - Presets: Standard (5/5), Minimal (3/3), Rich (10/10).
     - Stepper buttons (`-` and `+`) with boundary checks.
     - Note on soft ceiling behavior and WebP/JPEG auto-compression.
     - Call `savePhotoLimitsAction` inside `startTransition`.
     - Render success confirmation banner with Expyrico Mint Mist highlight.

6. **Product Detail Page Integration (`apps/admin/src/app/(admin)/products/[id]/`)**:
   - In `product-photo-manager.tsx`:
     - Update `const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];`.
     - Update raw file check: `const MAX_RAW_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB`.
     - Mount animated slot spinner placeholder while `compressImageForUpload` executes in the background.
     - Replace spinner with real thumbnail preview and size chip once compression settles.
     - Accept `maxPhotos?: number` (default 5) and enforce the soft ceiling without truncating reorders.

7. **Unit Tests**:
   - `apps/admin/tests/unit/photo-limits-actions.test.ts`: Verify server action and revalidation.
   - `apps/admin/tests/unit/image-compression.test.ts`: Test bounded step-down `[0.82, 0.72, 0.70]`, terminal rejection when oversized at 0.70, and canvas context error rejection.

## Success Criteria

- [x] "Photo upload limits" link appears in admin sidebar under Settings.
- [x] Navigating to `/settings/photo-limits` displays current limits and storage optimization summary.
- [x] Admins can adjust values using steppers or presets and save successfully.
- [x] Large admin image uploads (up to 25 MB raw) display a slot spinner during background compression and scale to max 1920x1920 under 1 MB.
- [x] In-browser compression fails closed with a clear error if image exceeds 1 MB after quality 0.70.
- [x] `ProductPhotoManager` accepts WebP, enforces `maxProductPhotos` on new uploads, and allows reordering without truncation.
- [x] Tests in `apps/admin/tests/unit/` pass.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Browser lacks WebP canvas export support | Low | Low | Built-in capability probe automatically falls back to standard JPEG encoding |
| Large files freeze the browser UI during compression | Medium | Low | Background asynchronous canvas processing with immediate slot spinners ensures UI stays responsive |
| Highly detailed image exceeds 1 MB after 0.70 floor | Low | Low | UI catches error and surfaces clear alert asking admin for a clearer photo rather than corrupting server budget |
