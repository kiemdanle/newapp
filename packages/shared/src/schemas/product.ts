import { z } from 'zod';

export const productSourceSchema = z.enum(['off', 'upcitemdb', 'user']);
export type ProductSource = z.infer<typeof productSourceSchema>;

// `pending` predates creator submissions; during the expand/classify rollout it is
// read by compatibility readers as either a legacy report-hidden row or (once creation
// ships) a creator-submitted draft awaiting review. See phase-01 data model notes.
export const productStatusSchema = z.enum([
  'draft',
  'pending',
  'changes_required',
  'active',
  'report_hidden',
  'merged_into',
]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

const barcodeField = z
  .string()
  .trim()
  .min(6)
  .max(64)
  .regex(/^[A-Za-z0-9\-_.:]+$/, 'barcode must be alphanumeric');

const qrField = z.string().trim().min(1).max(2048);

// Rejects C0 (0x00-0x1F) and C1 (0x7F-0x9F) control characters except tab (0x09) and
// newline (0x0A); everything else, including Unicode and literal markup, is kept as text.
function isDisallowedDescriptionControlCodePoint(codePoint: number): boolean {
  const isC0 = codePoint <= 0x1f && codePoint !== 0x09 && codePoint !== 0x0a;
  const isDelOrC1 = codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f);
  return isC0 || isDelOrC1;
}

function hasDisallowedDescriptionControlCharacter(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined && isDisallowedDescriptionControlCodePoint(codePoint)) return true;
  }
  return false;
}

const DESCRIPTION_MAX_LENGTH = 2000;

export const productDescriptionSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= DESCRIPTION_MAX_LENGTH, {
    message: `description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`,
  })
  .refine((value) => value === null || !hasDisallowedDescriptionControlCharacter(value), {
    message: 'description contains unsupported control characters',
  });
export type ProductDescription = z.infer<typeof productDescriptionSchema>;

// Public photo projection only: never storage keys, uploader, or moderation internals.
// `thumbnailUrl`/`displayUrl` are authorized same-origin API routes (consumed through
// the mobile/admin API client wrappers, which already own the origin), not third-party
// absolute URLs like the legacy `imageUrl` — so they are non-empty route strings rather
// than `.url()`-validated absolute URLs. Phase 3 owns their real derivation.
export const productPhotoSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0).max(4),
  thumbnailUrl: z.string().min(1),
  displayUrl: z.string().min(1),
});
export type ProductPhoto = z.infer<typeof productPhotoSchema>;

export const productSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string().nullable(),
  qrPayload: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
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
  version: z.number().int().min(1),
  moderationFeedback: z.string().nullable(),
  photos: z.array(productPhotoSchema),
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

// --- Lookup v2: explicit, non-disclosing outcomes ---------------------------------

const productLookupV2FoundOutcomeSchema = z
  .object({ outcome: z.literal('found'), product: productSchema })
  .strict();

const productLookupV2EditablePrivateOutcomeSchema = z
  .object({ outcome: z.literal('editable_private'), product: productSchema })
  .strict();

const productLookupV2CreatorPendingOutcomeSchema = z
  .object({ outcome: z.literal('creator_pending'), product: productSchema })
  .strict();

// Strictly no product ID, creator, status, or metadata: reserved-by-another-user and
// report-hidden catalog rows must be indistinguishable to the caller.
const productLookupV2UnderReviewOutcomeSchema = z.object({ outcome: z.literal('under_review') }).strict();

const productLookupV2NotFoundOutcomeSchema = z
  .object({ outcome: z.literal('not_found'), canCreate: z.boolean() })
  .strict();

const productLookupV2TemporarilyUnavailableOutcomeSchema = z
  .object({ outcome: z.literal('temporarily_unavailable'), retryAfterSeconds: z.number().int().positive().optional() })
  .strict();

export const productLookupV2ResponseSchema = z.discriminatedUnion('outcome', [
  productLookupV2FoundOutcomeSchema,
  productLookupV2EditablePrivateOutcomeSchema,
  productLookupV2CreatorPendingOutcomeSchema,
  productLookupV2UnderReviewOutcomeSchema,
  productLookupV2NotFoundOutcomeSchema,
  productLookupV2TemporarilyUnavailableOutcomeSchema,
]);
export type ProductLookupV2Response = z.infer<typeof productLookupV2ResponseSchema>;

// --- Creator-private drafts --------------------------------------------------------

const PRODUCT_DRAFT_STATUSES = ['draft', 'pending', 'changes_required'] as const;
const productDraftStatusSchema = z.enum(PRODUCT_DRAFT_STATUSES);
export type ProductDraftStatus = z.infer<typeof productDraftStatusSchema>;

export const productDraftsQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: productDraftStatusSchema.optional(),
});
export type ProductDraftsQuery = z.infer<typeof productDraftsQuerySchema>;

const productDraftIdentifierSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('barcode'), value: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('qr'), value: z.string().min(1) }).strict(),
]);
export type ProductDraftIdentifier = z.infer<typeof productDraftIdentifierSchema>;

const productDraftCoverSchema = z
  .object({ photoId: z.string().uuid(), thumbnailUrl: z.string().min(1) })
  .strict();

export const productDraftRowSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    identifier: productDraftIdentifierSchema,
    status: productDraftStatusSchema,
    version: z.number().int().min(1),
    moderationFeedback: z.string().nullable(),
    cover: productDraftCoverSchema.nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type ProductDraftRow = z.infer<typeof productDraftRowSchema>;

export const productDraftsPageSchema = z
  .object({
    items: z.array(productDraftRowSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
export type ProductDraftsPage = z.infer<typeof productDraftsPageSchema>;

export const productDraftCreateRequestSchema = z
  .object({
    barcode: barcodeField.optional(),
    qrPayload: qrField.optional(),
  })
  .strict()
  .refine((v) => Boolean(v.barcode) !== Boolean(v.qrPayload), {
    message: 'exactly one of barcode | qrPayload is required',
  });
export type ProductDraftCreateRequest = z.infer<typeof productDraftCreateRequestSchema>;

export const productDraftPatchRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: productDescriptionSchema,
    brand: z.string().trim().max(120).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
  })
  .strict();
export type ProductDraftPatchRequest = z.infer<typeof productDraftPatchRequestSchema>;

export const productDraftReorderRequestSchema = z
  .object({
    photoIds: z.array(z.string().uuid()).min(1).max(5),
  })
  .strict()
  .refine((v) => new Set(v.photoIds).size === v.photoIds.length, {
    message: 'photoIds must be unique',
  });
export type ProductDraftReorderRequest = z.infer<typeof productDraftReorderRequestSchema>;

export const productDraftSubmitRequestSchema = z
  .object({
    version: z.number().int().min(1),
    abuseToken: z.string().trim().min(1),
  })
  .strict();
export type ProductDraftSubmitRequest = z.infer<typeof productDraftSubmitRequestSchema>;
