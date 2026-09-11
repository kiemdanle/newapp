---
phase: 2
title: "Admin API Client & Upload Foundation"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Admin API Client & Upload Foundation

<!-- Updated: Validation Session 1 - Auto-approve & publish admin-uploaded photos on active products -->

## Overview
Enhance the server-side API fetch client in `apps/admin` (`apiServerFetch`) to transparently handle `FormData` multipart payloads, wire the photo upload method into `serverAdminApi.products.photos`, expose the Next.js server action `uploadProductPhotoAction`, and ensure the API auto-approves and publishes admin-uploaded photos on active products immediately to public storage.

## Requirements
- Functional:
  - `apiServerFetch` in `apps/admin/src/lib/api.ts` checks if `opts.body instanceof FormData`.
  - When `FormData` is passed, `headers['content-type']` is omitted so the fetch runtime automatically generates the boundary header (`multipart/form-data; boundary=...`).
  - `init.body = opts.body` directly without `JSON.stringify`.
  - `serverAdminApi.products.photos.upload(productId: string, formData: FormData)` calls `POST /v1/products/:productId/photos` with the admin access token.
  - Server action `uploadProductPhotoAction(productId: string, formData: FormData)` executes the mutation, revalidates `/products/${productId}`, and returns a typed `ActionResult<Product>`.
  - **Photo Publication Policy**:
    - In `api/src/services/products/product-photos.ts`: when `actor.role === 'admin'` and the target product has `status === 'active'`, newly uploaded photos are automatically promoted to public CDN storage (`publicStorageKey` populated) and marked with `moderationStatus: 'approved'`.
    - This ensures admin photo additions to active catalog products are immediately visible to all end users without requiring a secondary moderation approval step.
- Non-functional:
  - Preserves error parsing: non-2xx multipart responses are parsed as problem+json into `ApiError` with status and code.

## Architecture
```
Next.js Server Action: uploadProductPhotoAction(productId, formData)
       │
       ▼
serverAdminApi.products.photos.upload(productId, formData)
       │
       ▼
apiServerFetch('/v1/products/:id/photos', { method: 'POST', body: formData })
       │
       ├── Detects opts.body instanceof FormData
       ├── Removes 'content-type': 'application/json'
       ├── Attaches Authorization: Bearer <admin_token>
       └── native fetch() to Fastify with streaming multipart/form-data
             │
             ▼
Fastify: photoUploadRoute -> addProductPhoto
       │
       ├── Check: actor.role === 'admin' && product.status === 'active'
       ├── If active: promote to publicStorageKey & moderationStatus = 'approved'
       ├── If draft/pending: privateStorageKey & moderationStatus = 'pending'
       └── Return updated ApiProduct
```

## Related Code Files
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Modify: `api/src/services/products/product-photos.ts`
- Create / Modify: `apps/admin/tests/unit/api-formdata.test.ts`

## Implementation Steps
1. In `apps/admin/src/lib/api.ts`:
   - Inspect `opts.body`:
     ```ts
     const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
     const headers: Record<string, string> = {
       accept: 'application/json',
       ...(isFormData ? {} : { 'content-type': 'application/json' }),
       ...(opts.headers ?? {}),
     };
     if (isFormData) {
       delete headers['content-type'];
     }
     ```
   - In `init`:
     ```ts
     if (opts.body !== undefined) {
       init.body = isFormData ? (opts.body as FormData) : JSON.stringify(opts.body);
     }
     ```
2. In `apps/admin/src/lib/admin-api.ts`:
   - Under `products.photos`:
     ```ts
     upload: (productId: string, formData: FormData) =>
       apiServerFetch(`/v1/products/${productId}/photos`, {
         method: 'POST',
         body: formData,
       }).then((r) => productSchema.parse(r)),
     ```
3. In `apps/admin/src/lib/actions.ts`:
   - Export `uploadProductPhotoAction`:
     ```ts
     export async function uploadProductPhotoAction(
       productId: string,
       formData: FormData,
     ): Promise<ActionResult<Product>> {
       const result = await runAction(() => serverAdminApi.products.photos.upload(productId, formData));
       if (result.ok) revalidatePath(`/products/${productId}`);
       return result;
     }
     ```
4. In `api/src/services/products/product-photos.ts`:
   - In `addProductPhoto`, if `actor.role === 'admin' && product.status === 'active'`:
     - Copy variants to `publicProductPhotoPrefix(input.productId, publicationId)`.
     - Write row with `moderationStatus: 'approved'` and `publicStorageKey: publicPrefix`.
5. Add unit test in `apps/admin/tests/unit/` testing `apiServerFetch` with `FormData` to ensure `content-type` is unset and `FormData` is passed through untouched.

## Success Criteria
- [ ] `apiServerFetch` sends `FormData` with native boundary to Fastify without `JSON.stringify` or conflicting headers.
- [ ] `uploadProductPhotoAction` successfully uploads a test image and returns a valid `Product` schema result.
- [ ] Photos uploaded by admin on active products have `moderationStatus === 'approved'` and public CDN URLs.
- [ ] Next.js path cache for `/products/[id]` is revalidated upon upload.
- [ ] Unit tests pass in `apps/admin`.

## Risk Assessment
- **Risk:** Fastify rejects upload if Next.js node-fetch wraps `FormData` in an incompatible format or sets extra headers.
  - **Observable signal:** `400 Expected a multipart/form-data upload` or `400 A photo file is required`.
  - **Pre-decided response:** Test with native Node 20+ `FormData` (`Blob`/`File`) and verify Fastify `@fastify/multipart` extracts the `file` field cleanly.
