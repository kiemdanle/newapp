import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const adminProductStatusSchema = z.enum(['active', 'pending', 'merged_into']);
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

export const adminProductEditRowSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  submittedBy: z.string().uuid(),
  proposed: z.record(z.unknown()),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string().datetime(),
});

export const adminProductEditsListSchema = cursorPageSchema(adminProductEditRowSchema);

export const adminProductEditResolveSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

export type AdminProductPatch = z.infer<typeof adminProductPatchSchema>;
export type AdminProductMerge = z.infer<typeof adminProductMergeSchema>;
