import { z } from 'zod';
export declare const reviewStatusSchema: z.ZodEnum<["visible", "hidden", "deleted"]>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export declare const reviewRatingSchema: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
export type ReviewRating = z.infer<typeof reviewRatingSchema>;
export declare const reviewSortSchema: z.ZodDefault<z.ZodEnum<["score", "new"]>>;
export type ReviewSort = z.infer<typeof reviewSortSchema>;
export declare const reviewAuthorSchema: z.ZodObject<{
    firstName: z.ZodString;
    avatarUrl: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    avatarUrl: string | null;
}, {
    firstName: string;
    avatarUrl: string | null;
}>;
export type ReviewAuthor = z.infer<typeof reviewAuthorSchema>;
export declare const reviewProductSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    brand?: string | null | undefined;
    imageUrl?: string | null | undefined;
}, {
    id: string;
    name: string;
    brand?: string | null | undefined;
    imageUrl?: string | null | undefined;
}>;
export type ReviewProductSummary = z.infer<typeof reviewProductSummarySchema>;
export declare const reviewSchema: z.ZodObject<{
    id: z.ZodString;
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
    /** True if the authenticated viewer is the author of this review. */
    isOwnReview: z.ZodDefault<z.ZodBoolean>;
    /** Light author projection — first name + avatar only, never user UUID or email. */
    author: z.ZodOptional<z.ZodObject<{
        firstName: z.ZodString;
        avatarUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        firstName: string;
        avatarUrl: string | null;
    }, {
        firstName: string;
        avatarUrl: string | null;
    }>>;
    /** Lightweight product projection (present on personal reviews and community feeds). */
    product: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        brand?: string | null | undefined;
        imageUrl?: string | null | undefined;
    }, {
        id: string;
        name: string;
        brand?: string | null | undefined;
        imageUrl?: string | null | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    score: number;
    status: "visible" | "hidden" | "deleted";
    id: string;
    productId: string;
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body: string | null;
    helpfulCount: number;
    notHelpfulCount: number;
    createdAt: string;
    updatedAt: string;
    isOwnReview: boolean;
    myVote?: "helpful" | "not_helpful" | null | undefined;
    author?: {
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
    product?: {
        id: string;
        name: string;
        brand?: string | null | undefined;
        imageUrl?: string | null | undefined;
    } | undefined;
}, {
    score: number;
    status: "visible" | "hidden" | "deleted";
    id: string;
    productId: string;
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body: string | null;
    helpfulCount: number;
    notHelpfulCount: number;
    createdAt: string;
    updatedAt: string;
    myVote?: "helpful" | "not_helpful" | null | undefined;
    isOwnReview?: boolean | undefined;
    author?: {
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
    product?: {
        id: string;
        name: string;
        brand?: string | null | undefined;
        imageUrl?: string | null | undefined;
    } | undefined;
}>;
export type Review = z.infer<typeof reviewSchema>;
export declare const reviewCreateSchema: z.ZodObject<{
    rating: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
    body: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>;
}, "strip", z.ZodTypeAny, {
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body: string | null;
}, {
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    body?: string | null | undefined;
}>;
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export declare const reviewPatchSchema: z.ZodEffects<z.ZodObject<{
    rating: z.ZodOptional<z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>>;
    body: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNull]>>, string | null | undefined, string | null | undefined>;
}, "strip", z.ZodTypeAny, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | null | undefined;
}, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | null | undefined;
}>, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | null | undefined;
}, {
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    body?: string | null | undefined;
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
    helpful: z.ZodDefault<z.ZodOptional<z.ZodLiteral<true>>>;
}, "strip", z.ZodTypeAny, {
    helpful: true;
}, {
    helpful?: true | undefined;
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
    sort: z.ZodDefault<z.ZodEnum<["score", "new"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "score" | "new";
    limit: number;
    cursor?: string | undefined;
}, {
    sort?: "score" | "new" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
//# sourceMappingURL=review.d.ts.map