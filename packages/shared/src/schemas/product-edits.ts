import { z } from 'zod';
import { productDescriptionValueSchema } from './product.js';
import { productEditStatusSchema } from './admin/products.js';

// A single entry in a creator's edit-scoped desired photo set: `retained` sources an
// already-live, already-public photo from the product being revised (its bytes never
// move — only the position/inclusion changes); `staged` is freshly uploaded private
// media unique to this edit, served through the edit-scoped private media route until
// approval publishes it. Both render through the same `thumbnailUrl`/`displayUrl`
// projection so the editor UI never needs to branch on which kind a photo is.
export const productEditPhotoSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0).max(4),
  retained: z.boolean(),
  thumbnailUrl: z.string().min(1),
  displayUrl: z.string().min(1),
});
export type ProductEditPhoto = z.infer<typeof productEditPhotoSchema>;

// The creator-facing revision DTO. Metadata fields always reflect the edit's complete
// current desired state (not a partial diff) — `createOrResumeProductEdit` seeds them
// from the live product on create, and each metadata patch updates individual keys in
// place, so this row is always safe to render directly in an editor form.
export const productEditRowSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    status: productEditStatusSchema,
    version: z.number().int().min(1),
    baseProductVersion: z.number().int().min(1),
    name: z.string(),
    description: z.string().nullable(),
    brand: z.string().nullable(),
    category: z.string().nullable(),
    photos: z.array(productEditPhotoSchema),
    // Creator-visible admin feedback (`request_changes` notes). Never the internal
    // machine-safe supersede reason, which is a distinct, admin/history-only field.
    moderationFeedback: z.string().nullable(),
    submittedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type ProductEditRow = z.infer<typeof productEditRowSchema>;

export const productEditMetadataPatchRequestSchema = z
  .object({
    // Optimistic-concurrency token: the caller's last-known *edit* version (not the
    // underlying product's version — those are independent counters).
    version: z.number().int().min(1),
    name: z.string().trim().min(1).max(200).optional(),
    description: productDescriptionValueSchema.optional(),
    brand: z.string().trim().max(120).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
  })
  .strict();
export type ProductEditMetadataPatchRequest = z.infer<typeof productEditMetadataPatchRequestSchema>;

export const productEditPhotoReorderRequestSchema = z
  .object({
    photoIds: z.array(z.string().uuid()).min(1).max(5),
  })
  .strict()
  .refine((v) => new Set(v.photoIds).size === v.photoIds.length, {
    message: 'photoIds must be unique',
  });
export type ProductEditPhotoReorderRequest = z.infer<typeof productEditPhotoReorderRequestSchema>;

export const productEditSubmitRequestSchema = z.object({ version: z.number().int().min(1) }).strict();
export type ProductEditSubmitRequest = z.infer<typeof productEditSubmitRequestSchema>;

// Admin-only single-revision detail: the same creator-facing row (full desired
// metadata + complete photo order) plus the two fields only moderation tooling
// needs — who submitted it, and the live product's current version so the
// console can flag a stale revision (`liveProductVersion !== baseProductVersion`)
// proactively, before the admin even attempts to approve/request-changes and
// hits a 409. Composed from `productEditRowSchema` rather than hand-rolled so
// the two views can never drift on the fields they share.
export const adminProductEditDetailSchema = productEditRowSchema.extend({
  submittedBy: z.string().uuid(),
  liveProductVersion: z.number().int().min(1),
});
export type AdminProductEditDetail = z.infer<typeof adminProductEditDetailSchema>;
