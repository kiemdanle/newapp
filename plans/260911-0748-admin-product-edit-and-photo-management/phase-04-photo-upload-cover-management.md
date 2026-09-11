---
phase: 4
title: "Photo Upload & Cover Management"
status: pending
priority: P1
effort: "4h"
dependencies: [2]
---

# Phase 4: Photo Upload & Cover Management

<!-- Updated: Validation Session 1 - Sequential upload queue with progress indicator ('Uploading photo X of Y...') -->

## Overview
Upgrade `ProductPhotoManager` in `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx` into a full photo management station: drag-and-drop / file-picker photo uploads, sequential upload queue with live item progress indicator, instant 1-click "Set as Cover" action, and preserved reordering and removal.

## Requirements
- Functional:
  - **Upload Area / Dropzone**:
    - Drag-and-drop zone allowing administrators to drop one or more image files.
    - "Select Photos" browse button triggering native hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple />`.
    - Client-side pre-validation: check file size ($\le$ 5MB per file) and MIME type (`image/jpeg`, `image/png`, `image/webp`). Display friendly error if invalid file is dropped.
    - Maximum photos limit: enforce client-side limit based on remaining quota (max 10 photos total per product).
  - **Sequential Upload Execution & Progress**:
    - Upload files strictly one-by-one via `uploadProductPhotoAction(productId, formData)`.
    - Display explicit progress indicator: `Uploading photo 1 of 3 (33%)…` with visual spinner.
    - Deterministic order: photos retain their selection order as they are attached to the product.
    - Refresh gallery list immediately upon completion of the entire batch.
  - **"Set as Cover" 1-Click Action**:
    - Add a "Set as Cover" button on every photo card currently at `position > 0`.
    - Clicking moves that photo directly to position 0 and shifts other photos accordingly.
    - Triggers `reorderProductPhotosAction(productId, newOrderIds)`.
    - Displays a prominent "Cover Photo" badge in Expyrico Fresh Sage (`#4BAE8A`) on position 0.
  - **Reorder & Removal**:
    - Retain Move Up (earlier) and Move Down (later) buttons.
    - Retain Delete button with confirmation modal/dialog and destructive Alert Red styling (`#E0442A`).
- Non-functional:
  - Zero flickers or layout jumps.
  - Keyboard accessible and WCAG compliant.
  - Clear empty state when product has 0 photos with an inviting dropzone.

## Architecture & Wireframe

```
┌────────────────────────────────────────────────────────────────────────┐
│ Photo Gallery Manager (3 / 10)         Position 0 serves as cover      │
├────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ ☁️ Drag and drop product photos here, or [Browse Files]             │ │
│ │ Supports WebP, JPEG, PNG up to 5MB each.                           │ │
│ │ [Progress indicator during upload: "Uploading photo 2 of 3..."]    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│ │ [ COVER PHOTO ] │  │ [ Position 1  ] │  │ [ Position 2  ] │          │
│ │                 │  │                 │  │                 │          │
│ │     [Image]     │  │     [Image]     │  │     [Image]     │          │
│ │                 │  │                 │  │                 │          │
│ ├─────────────────┤  ├─────────────────┤  ├─────────────────┤          │
│ │ [↑] [↓]     [🗑️]│  │ [↑] [↓]     [🗑️]│  │ [↑] [↓]     [🗑️]│          │
│ │ (Active Cover)  │  │ [★ Set as Cover]│  │ [★ Set as Cover]│          │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└────────────────────────────────────────────────────────────────────────┘
```

## Related Code Files
- Modify: `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Modify: `apps/admin/tests/unit/product-photo-manager.test.tsx`

## Implementation Steps
1. In `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx`:
   - Import `uploadProductPhotoAction`, `reorderProductPhotosAction`, `removeProductPhotoAction`.
   - Add state:
     ```ts
     const [uploading, setUploading] = useState(false);
     const [uploadProgress, setUploadProgress] = useState<string | null>(null);
     const [dragOver, setDragOver] = useState(false);
     const fileInputRef = useRef<HTMLInputElement>(null);
     ```
   - Implement `handleFileSelect(files: FileList | File[])`:
     - Validate file size ($\le$ 5MB) and type.
     - Check current count + new files $\le$ 10.
     - Execute sequential loop:
       ```ts
       setUploading(true);
       for (let i = 0; i < validFiles.length; i++) {
         setUploadProgress(`Uploading photo ${i + 1} of ${validFiles.length}…`);
         const fd = new FormData();
         fd.append('file', validFiles[i]!);
         const res = await uploadProductPhotoAction(productId, fd);
         if (!res.ok) {
           setErr(actionErrorMessage(res));
           break;
         }
       }
       setUploading(false);
       setUploadProgress(null);
       router.refresh();
       ```
   - Implement `setAsCover(photoId: string)`:
     - Find photo by `photoId`.
     - Construct `newOrder = [targetPhoto, ...allOtherPhotos]`.
     - Call `persistOrder(newOrder)`.
   - Render Dropzone:
     - Outer container with `onDragOver`, `onDragLeave`, `onDrop`.
     - Expyrico styling: `border-dashed border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors`.
     - Hidden file input `<input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" />`.
     - Show spinner and `uploadProgress` text when `uploading === true`.
   - Render Photo Cards:
     - Add `Set as Cover` button for any photo where `index > 0`:
       ```tsx
       <Button
         variant="outline"
         size="sm"
         disabled={pending || uploading}
         onClick={() => setAsCover(photo.id)}
         className="text-xs gap-1 w-full rounded-lg border-primary/40 text-primary hover:bg-primary/10"
       >
         <Star size={12} />
         <span>Set as Cover</span>
       </Button>
       ```
     - Add prominent badge on `index === 0`: `bg-primary text-white font-bold`.
2. In `apps/admin/tests/unit/product-photo-manager.test.tsx`:
   - Add unit tests verifying:
     - Dropzone renders and handles file drop / selection.
     - Sequential upload queue reports progress and calls upload action for each file.
     - "Set as Cover" reorders the list so target photo becomes index 0.
     - Deletion triggers confirmation and executes remove action.

## Success Criteria
- [ ] Admin can upload multiple photos via file picker or drag-and-drop.
- [ ] Uploads run sequentially with clear item-by-item progress.
- [ ] Client validation prevents uploading files larger than 5MB or invalid MIME types.
- [ ] Uploading attaches photos, Sharp processes them to WebP, and gallery updates seamlessly.
- [ ] Admin can click "Set as Cover" to promote any photo to position 0.
- [ ] Existing photo deletion and reorder work reliably.
- [ ] Design matches Expyrico color requirements.

## Risk Assessment
- **Risk:** Admin navigates away while multi-file upload is in flight.
  - **Observable signal:** Interrupted upload queue.
  - **Pre-decided response:** Warn with standard `beforeunload` handler if `uploading === true`.
