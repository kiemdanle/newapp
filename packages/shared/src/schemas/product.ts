import { z } from 'zod';

export const productSourceSchema = z.enum(['off', 'upcitemdb', 'user']);
export type ProductSource = z.infer<typeof productSourceSchema>;

export const productStatusSchema = z.enum(['active', 'pending', 'merged_into']);

const barcodeField = z
  .string()
  .trim()
  .min(6)
  .max(64)
  .regex(/^[A-Za-z0-9\-_.:]+$/, 'barcode must be alphanumeric');

const qrField = z.string().trim().min(1).max(2048);

export const productSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string().nullable(),
  qrPayload: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  defaultShelfLifeDays: z.number().int().positive().nullable(),
  source: productSourceSchema,
  sourceId: z.string().nullable(),
  isCommunityEligible: z.boolean(),
  buyAgainCount: z.number().int().min(0),
  buyAgainOnSaleCount: z.number().int().min(0),
  wontBuyCount: z.number().int().min(0),
  ratingCount: z.number().int().min(0),
  reviewCount: z.number().int().min(0),
  status: productStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Product = z.infer<typeof productSchema>;

export const productWithReviewsSchema = productSchema.extend({
  topReviews: z.array(z.unknown()),
});
export type ProductWithReviews = z.infer<typeof productWithReviewsSchema>;

export const productLookupRequestSchema = z
  .object({
    barcode: barcodeField.optional(),
    qr: qrField.optional(),
  })
  .refine((v) => Boolean(v.barcode) !== Boolean(v.qr), {
    message: 'exactly one of barcode | qr is required',
  });
export type ProductLookupRequest = z.infer<typeof productLookupRequestSchema>;

export const productLookupResponseSchema = z.object({
  product: productSchema.nullable(),
});
export type ProductLookupResponse = z.infer<typeof productLookupResponseSchema>;

export const productSearchResultSchema = z.object({
  items: z.array(productSchema),
});
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;

export const productCreateRequestSchema = z.object({
  barcode: barcodeField.nullable().optional(),
  qrPayload: qrField.nullable().optional(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  defaultShelfLifeDays: z.number().int().positive().max(3650).nullable().optional(),
});
export type ProductCreateRequest = z.infer<typeof productCreateRequestSchema>;

export const productPatchRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  defaultShelfLifeDays: z.number().int().positive().max(3650).nullable().optional(),
});
export type ProductPatchRequest = z.infer<typeof productPatchRequestSchema>;
