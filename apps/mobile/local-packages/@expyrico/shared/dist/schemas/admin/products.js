import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';
import { productStatusSchema, productPhotoSchema } from '../product.js';
// Reuses the public product lifecycle so admin tooling can never drift from the states
// products actually go through.
export const adminProductStatusSchema = productStatusSchema;
export const adminProductSourceSchema = z.enum(['off', 'upcitemdb', 'user']);
export const adminProductRowSchema = z.object({
    id: z.string().uuid(),
    barcode: z.string().nullable(),
    qrPayload: z.string().nullable(),
    name: z.string(),
    brand: z.string().nullable(),
    category: z.string().nullable(),
    imageUrl: z.string().nullable(),
    source: adminProductSourceSchema,
    status: adminProductStatusSchema,
    isCommunityEligible: z.boolean(),
    buyAgainCount: z.number().int(),
    buyAgainOnSaleCount: z.number().int(),
    wontBuyCount: z.number().int(),
    ratingCount: z.number().int(),
    reviewCount: z.number().int(),
    // Ordered review media (private route for unpublished bytes, public CDN URL for
    // already-published ones) and moderation history — admin-only detail, never sent
    // through the public `productSchema`.
    photos: z.array(productPhotoSchema).optional(),
    moderationNotes: z.string().nullable().optional(),
    moderatedAt: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const adminProductsQuerySchema = cursorQuerySchema.extend({
    status: adminProductStatusSchema.optional(),
    source: adminProductSourceSchema.optional(),
    q: z.string().trim().min(1).optional(),
});
export const adminProductsListSchema = cursorPageSchema(adminProductRowSchema);
// `version` is the admin's last-known product version — required so a direct
// correction is optimistic-concurrency-guarded like every other Phase 4 write,
// not applied blind. Excluded from the "at least one field" count below since
// it's a concurrency token, not itself an editable field.
export const adminProductPatchSchema = z.object({
    version: z.number().int().min(1),
    name: z.string().min(1).optional(),
    brand: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    defaultShelfLifeDays: z.number().int().min(0).nullable().optional(),
    status: adminProductStatusSchema.optional(),
}).refine((d) => Object.keys(d).filter((k) => k !== 'version').length > 0, { message: 'no fields to update' });
// `version` is the target's last-known version — merge is optimistic-concurrency
// guarded like every other Phase 4 write, and it locks `[targetId, ...sourceIds]` in
// deterministic sorted order (never `winnerId`/`loserIds`'s implicit request order).
export const adminProductMergeSchema = z.object({
    targetId: z.string().uuid(),
    sourceIds: z.array(z.string().uuid()).min(1),
    version: z.number().int().min(1),
}).refine((d) => !d.sourceIds.includes(d.targetId), { message: 'target cannot also be a source' })
    .refine((d) => new Set(d.sourceIds).size === d.sourceIds.length, { message: 'sourceIds must be unique' });
export const adminProductMergeResponseSchema = z.object({
    targetId: z.string().uuid(),
    movedRecords: z.number().int(),
    movedReviews: z.number().int(),
    newReviewCount: z.number().int(),
    newRatingCount: z.number().int(),
    newBuyAgainCount: z.number().int(),
    newBuyAgainOnSaleCount: z.number().int(),
    newWontBuyCount: z.number().int(),
});
// `rejected` is preserved as a terminal historical state; ordinary moderation only ever
// reaches `draft|pending|changes_required|approved`. The only new write to `rejected` is
// an explicit stale-revision `supersede` (Phase 4), which is not part of this resolve
// contract.
export const productEditStatusSchema = z.enum(['draft', 'pending', 'changes_required', 'approved', 'rejected']);
export const adminProductEditRowSchema = z.object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    submittedBy: z.string().uuid(),
    proposed: z.record(z.unknown()),
    status: productEditStatusSchema,
    version: z.number().int().min(1),
    baseProductVersion: z.number().int().min(1),
    moderationNotes: z.string().nullable(),
    submittedAt: z.string().datetime().nullable(),
    resolvedBy: z.string().uuid().nullable(),
    resolvedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
});
export const adminProductEditsListSchema = cursorPageSchema(adminProductEditRowSchema);
// Admin action is named `request_changes` (resulting state `changes_required`), not
// `reject` — ordinary moderation never writes the terminal `rejected` state.
export const adminProductEditResolveSchema = z
    .object({
    decision: z.enum(['approve', 'request_changes']),
    notes: z.string().trim().min(1).max(2000).optional(),
})
    .refine((d) => d.decision !== 'request_changes' || Boolean(d.notes), {
    message: 'notes required when requesting changes',
});
// Admin action on a brand-new creator submission (`Product.status === 'pending'`, no
// `ProductEdit` involved — that queue is for revisions to already-active products, see
// `adminProductEditResolveSchema`). `version` is the caller's last-known product
// version; a stale write loses with a typed `version_conflict` rather than silently
// overwriting a row a concurrent admin already moderated.
export const adminProductModerateRequestSchema = z
    .object({
    decision: z.enum(['approve', 'request_changes']),
    version: z.number().int().min(1),
    notes: z.string().trim().min(1).max(2000).optional(),
})
    .refine((d) => d.decision !== 'request_changes' || Boolean(d.notes), {
    message: 'notes required when requesting changes',
});
// A stale open revision (`product.version !== edit.baseProductVersion`) is only
// recoverable through one of these two explicit admin actions — never an automatic
// approval or rebase. `rebase` requires the admin's own reviewed mapping of the
// desired photo set (never auto-computed from a diff): each entry either keeps an
// already-live photo (`retained`) or an already-uploaded staged one (`staged`,
// referencing a `ProductEditPhoto` row the creator uploaded before the edit went
// stale). `supersede` closes the edit as historical `rejected` and frees the
// one-open-edit slot for the creator to start again.
const productEditRecoverDesiredEntrySchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('retained'), sourceProductPhotoId: z.string().uuid() }).strict(),
    z.object({ type: z.literal('staged'), editPhotoId: z.string().uuid() }).strict(),
]);
// `z.discriminatedUnion` requires every member to be a plain `ZodObject` — it cannot
// introspect a `ZodEffects` (a `.refine()`-wrapped member) for the discriminator key.
// The desired-photo-set uniqueness check is therefore applied once, after the union is
// built, rather than on the `rebase` branch alone.
const productEditRecoverRequestUnionSchema = z.discriminatedUnion('action', [
    z
        .object({
        action: z.literal('rebase'),
        editVersion: z.number().int().min(1),
        productVersion: z.number().int().min(1),
        desiredPhotoOrder: z.array(productEditRecoverDesiredEntrySchema).max(5),
        notes: z.string().trim().min(1).max(2000).optional(),
    })
        .strict(),
    z
        .object({
        action: z.literal('supersede'),
        editVersion: z.number().int().min(1),
        productVersion: z.number().int().min(1),
        notes: z.string().trim().min(1).max(2000).optional(),
    })
        .strict(),
]);
export const productEditRecoverRequestSchema = productEditRecoverRequestUnionSchema.refine((d) => d.action !== 'rebase' ||
    new Set(d.desiredPhotoOrder.map((e) => (e.type === 'retained' ? e.sourceProductPhotoId : e.editPhotoId))).size ===
        d.desiredPhotoOrder.length, { message: 'desiredPhotoOrder entries must be unique' });
//# sourceMappingURL=products.js.map