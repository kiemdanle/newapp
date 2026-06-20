import { z } from 'zod';
export const reviewStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export const reviewRatingSchema = z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy']);
export const reviewSortSchema = z.enum(['score', 'new', 'rating']).default('score');
const bodyField = z.string().trim().max(2000).optional();
export const reviewSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    productId: z.string().uuid(),
    rating: reviewRatingSchema,
    body: z.string().nullable(),
    helpfulCount: z.number().int().nonnegative(),
    notHelpfulCount: z.number().int().nonnegative(),
    score: z.number().min(0).max(1),
    status: reviewStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    /** Present on lists when the caller is authenticated; null if no vote cast. */
    myVote: z.enum(['helpful', 'not_helpful']).nullable().optional(),
    /** Light author projection — first name + avatar only, never email. */
    author: z
        .object({
        id: z.string().uuid(),
        firstName: z.string(),
        avatarUrl: z.string().url().nullable(),
    })
        .optional(),
});
export const reviewCreateSchema = z.object({
    rating: reviewRatingSchema,
    body: bodyField,
});
export const reviewPatchSchema = z
    .object({
    rating: reviewRatingSchema.optional(),
    body: bodyField,
})
    .refine((v) => v.rating !== undefined || v.body !== undefined, { message: 'at least one field required' });
export const reviewVoteSchema = z.object({
    value: z.enum(['helpful', 'not_helpful']),
});
export const reviewHelpfulSchema = z.object({
    helpful: z.boolean(),
});
export const voteSchema = reviewVoteSchema;
export const reviewListQuerySchema = z.object({
    sort: reviewSortSchema,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
//# sourceMappingURL=review.js.map