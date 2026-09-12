import { z } from 'zod';

export const reviewStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const reviewRatingSchema = z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy']);
export type ReviewRating = z.infer<typeof reviewRatingSchema>;

export const reviewStarsSchema = z.number().int().min(1).max(5);
export type ReviewStars = z.infer<typeof reviewStarsSchema>;
export const reviewSortSchema = z.enum(['score', 'new']).default('score');
export type ReviewSort = z.infer<typeof reviewSortSchema>;

export const reviewAuthorSchema = z.object({
  firstName: z.string(),
  avatarUrl: z.string().url().nullable(),
});
export type ReviewAuthor = z.infer<typeof reviewAuthorSchema>;

export const reviewProductSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});
export type ReviewProductSummary = z.infer<typeof reviewProductSummarySchema>;

export const reviewSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  stars: reviewStarsSchema.default(5),
  rating: reviewRatingSchema.optional(),
  body: z.string().nullable(),
  helpfulCount: z.number().int().nonnegative(),
  notHelpfulCount: z.number().int().nonnegative(),
  score: z.number().min(0).max(1),
  status: reviewStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Present on lists when the caller is authenticated; null if no vote cast. */
  myVote: z.enum(['helpful', 'not_helpful']).nullable().optional(),
  /** True if the authenticated viewer is the author of this review. */
  isOwnReview: z.boolean().default(false),
  /** Light author projection — first name + avatar only, never user UUID or email. */
  author: reviewAuthorSchema.optional(),
  /** Lightweight product projection (present on personal reviews and community feeds). */
  product: reviewProductSummarySchema.optional(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewCreateSchema = z
  .object({
    stars: reviewStarsSchema.optional(),
    rating: reviewRatingSchema.optional(),
    body: z
      .string()
      .trim()
      .max(2000)
      .nullish()
      .transform((v) => (!v ? null : v)),
  })
  .refine((v) => v.stars !== undefined || v.rating !== undefined, {
    message: 'stars or rating is required',
  })
  .transform((v) => {
    const stars = v.stars ?? (v.rating === 'buy_again' ? 5 : v.rating === 'buy_again_on_sale' ? 3 : 1);
    const rating = v.rating ?? (stars >= 4 ? 'buy_again' : stars === 3 ? 'buy_again_on_sale' : 'wont_buy');
    return {
      ...v,
      stars,
      rating,
    };
  });
export type ReviewCreate = z.input<typeof reviewCreateSchema>;

export const reviewPatchSchema = z
  .object({
    stars: reviewStarsSchema.optional(),
    rating: reviewRatingSchema.optional(),
    body: z
      .union([z.string().trim().max(2000), z.null()])
      .optional()
      .transform((v) => (v === undefined ? undefined : !v ? null : v)),
  })
  .refine(
    (v) => v.stars !== undefined || v.rating !== undefined || v.body !== undefined,
    { message: 'at least one field required' },
  )
  .transform((v) => {
    let stars = v.stars;
    let rating = v.rating;
    if (stars !== undefined && rating === undefined) {
      rating = stars >= 4 ? 'buy_again' : stars === 3 ? 'buy_again_on_sale' : 'wont_buy';
    } else if (rating !== undefined && stars === undefined) {
      stars = rating === 'buy_again' ? 5 : rating === 'buy_again_on_sale' ? 3 : 1;
    }
    return {
      ...v,
      stars,
      rating,
    };
  });
export type ReviewPatch = z.input<typeof reviewPatchSchema>;

export const reviewVoteSchema = z.object({
  value: z.enum(['helpful', 'not_helpful']),
});
export type ReviewVote = z.infer<typeof reviewVoteSchema>;

export const reviewHelpfulSchema = z.object({
  helpful: z.literal(true).optional().default(true),
});
export type ReviewHelpful = z.infer<typeof reviewHelpfulSchema>;

export const voteSchema = reviewVoteSchema;
export type Vote = ReviewVote;

export const reviewListQuerySchema = z.object({
  sort: reviewSortSchema,
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
