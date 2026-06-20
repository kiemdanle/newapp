import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';
export const adminReviewStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export const adminReviewRatingSchema = z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy']);
export const adminReviewRowSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    productId: z.string().uuid(),
    rating: adminReviewRatingSchema,
    comment: z.string().nullable(),
    helpfulCount: z.number().int(),
    notHelpfulCount: z.number().int(),
    status: adminReviewStatusSchema,
    createdAt: z.string().datetime(),
});
export const adminReviewsQuerySchema = cursorQuerySchema.extend({
    status: adminReviewStatusSchema.optional(),
    rating: adminReviewRatingSchema.optional(),
    productId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
});
export const adminReviewsListSchema = cursorPageSchema(adminReviewRowSchema);
export const adminReviewStatusPatchSchema = z.object({
    status: adminReviewStatusSchema,
});
//# sourceMappingURL=reviews.js.map