import { z } from 'zod';
export declare const reviewStatusSchema: z.ZodEnum<["visible", "hidden", "deleted"]>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export declare const reviewRatingSchema: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
export type ReviewRating = z.infer<typeof reviewRatingSchema>;
export declare const reviewSortSchema: z.ZodDefault<z.ZodEnum<["score", "new", "rating"]>>;
export type ReviewSort = z.infer<typeof reviewSortSchema>;
export declare const reviewSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    productId: z.ZodString;
    rating: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
    body: z.ZodNullable<z.ZodString>;
    helpfulCount: z.ZodNumber;
    notHelpfulCount: z.ZodNumber;
    score: z.ZodNumber;
    status: z.ZodEnum<["visible", "hidden", "deleted"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    /** Present on lists when the caller is authenticated; null if no vote cast. */
    myVote: z.ZodOptional<z.ZodNullable<z.ZodEnum<["helpful", "not_helpful"]>>>;
    /** Light author projection — first name + avatar only, never email. */
    author: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        firstName: z.ZodString;
        avatarUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    }, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "deleted" | "visible" | "hidden";
    createdAt: string;
    updatedAt: string;
    userId: string;
    productId: string;
    score: number;
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body: string | null;
    helpfulCount: number;
    notHelpfulCount: number;
    myVote?: "helpful" | "not_helpful" | null | undefined;
    author?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}, {
    id: string;
    status: "deleted" | "visible" | "hidden";
    createdAt: string;
    updatedAt: string;
    userId: string;
    productId: string;
    score: number;
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body: string | null;
    helpfulCount: number;
    notHelpfulCount: number;
    myVote?: "helpful" | "not_helpful" | null | undefined;
    author?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}>;
export type Review = z.infer<typeof reviewSchema>;
export declare const reviewCreateSchema: z.ZodObject<{
    rating: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
    body: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body?: string | undefined;
}, {
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body?: string | undefined;
}>;
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export declare const reviewPatchSchema: z.ZodEffects<z.ZodObject<{
    rating: z.ZodOptional<z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>>;
    body: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | undefined;
}, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | undefined;
}>, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | undefined;
}, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | undefined;
}>;
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;
export declare const reviewVoteSchema: z.ZodObject<{
    value: z.ZodEnum<["helpful", "not_helpful"]>;
}, "strip", z.ZodTypeAny, {
    value: "helpful" | "not_helpful";
}, {
    value: "helpful" | "not_helpful";
}>;
export type ReviewVote = z.infer<typeof reviewVoteSchema>;
export declare const reviewHelpfulSchema: z.ZodObject<{
    helpful: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    helpful: boolean;
}, {
    helpful: boolean;
}>;
export type ReviewHelpful = z.infer<typeof reviewHelpfulSchema>;
export declare const voteSchema: z.ZodObject<{
    value: z.ZodEnum<["helpful", "not_helpful"]>;
}, "strip", z.ZodTypeAny, {
    value: "helpful" | "not_helpful";
}, {
    value: "helpful" | "not_helpful";
}>;
export type Vote = ReviewVote;
export declare const reviewListQuerySchema: z.ZodObject<{
    sort: z.ZodDefault<z.ZodEnum<["score", "new", "rating"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "score" | "new" | "rating";
    limit: number;
    cursor?: string | undefined;
}, {
    sort?: "score" | "new" | "rating" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
//# sourceMappingURL=review.d.ts.map