import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const adminDealStatusSchema = z.enum(['visible', 'hidden', 'deleted']);

export const adminDealRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  price: z.number().nonnegative(),
  currency: z.string(),
  storeName: z.string(),
  photoUrl: z.string().url().nullable(),
  expiryDate: z.string().nullable(),
  note: z.string().nullable(),
  country: z.string().length(2).nullable(),
  upvoteCount: z.number().int(),
  downvoteCount: z.number().int(),
  score: z.number().min(0).max(1),
  status: adminDealStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Light product + author projections for the table
  productName: z.string(),
  productBrand: z.string().nullable(),
  authorFirstName: z.string(),
  authorEmail: z.string(),
});

export const adminDealsQuerySchema = cursorQuerySchema.extend({
  status: adminDealStatusSchema.optional(),
});

export const adminDealsListSchema = cursorPageSchema(adminDealRowSchema);

export const adminDealStatusPatchSchema = z.object({
  status: adminDealStatusSchema,
});
