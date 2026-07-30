import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';
import { productStatusSchema } from '../product.js';

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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const adminProductsQuerySchema = cursorQuerySchema.extend({
  status: adminProductStatusSchema.optional(),
  source: adminProductSourceSchema.optional(),
  q: z.string().trim().min(1).optional(),
});

export const adminProductsListSchema = cursorPageSchema(adminProductRowSchema);

export const adminProductPatchSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  defaultShelfLifeDays: z.number().int().min(0).nullable().optional(),
  status: adminProductStatusSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'no fields to update' });

export const adminProductMergeSchema = z.object({
  winnerId: z.string().uuid(),
  loserIds: z.array(z.string().uuid()).min(1),
}).refine((d) => !d.loserIds.includes(d.winnerId), { message: 'winner cannot also be a loser' });

export const adminProductMergeResponseSchema = z.object({
  winnerId: z.string().uuid(),
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
export type ProductEditStatus = z.infer<typeof productEditStatusSchema>;

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

export type AdminProductPatch = z.infer<typeof adminProductPatchSchema>;
export type AdminProductMerge = z.infer<typeof adminProductMergeSchema>;
// Admin callers should build their request from this inferred type rather than a
// hand-written string-literal union — a contract rename (e.g. reject -> request_changes)
// then fails typecheck at every call site instead of only failing at runtime.
export type AdminProductEditResolveInput = z.infer<typeof adminProductEditResolveSchema>;
export type AdminProductEditResolveDecision = AdminProductEditResolveInput['decision'];
