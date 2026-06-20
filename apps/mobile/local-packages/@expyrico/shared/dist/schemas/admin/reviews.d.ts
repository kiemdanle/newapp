import { z } from 'zod';
export declare const adminReviewStatusSchema: z.ZodEnum<["visible", "hidden", "deleted"]>;
export declare const adminReviewRatingSchema: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
export declare const adminReviewRowSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    productId: z.ZodString;
    rating: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
    comment: z.ZodNullable<z.ZodString>;
    helpfulCount: z.ZodNumber;
    notHelpfulCount: z.ZodNumber;
    status: z.ZodEnum<["visible", "hidden", "deleted"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "deleted" | "visible" | "hidden";
    createdAt: string;
    userId: string;
    productId: string;
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    helpfulCount: number;
    notHelpfulCount: number;
    comment: string | null;
}, {
    id: string;
    status: "deleted" | "visible" | "hidden";
    createdAt: string;
    userId: string;
    productId: string;
    rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
    helpfulCount: number;
    notHelpfulCount: number;
    comment: string | null;
}>;
export declare const adminReviewsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["visible", "hidden", "deleted"]>>;
    rating: z.ZodOptional<z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>>;
    productId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "deleted" | "visible" | "hidden" | undefined;
    userId?: string | undefined;
    productId?: string | undefined;
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    cursor?: string | undefined;
}, {
    status?: "deleted" | "visible" | "hidden" | undefined;
    userId?: string | undefined;
    productId?: string | undefined;
    rating?: "buy_again" | "buy_again_on_sale" | "wont_buy" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const adminReviewsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        productId: z.ZodString;
        rating: z.ZodEnum<["buy_again", "buy_again_on_sale", "wont_buy"]>;
        comment: z.ZodNullable<z.ZodString>;
        helpfulCount: z.ZodNumber;
        notHelpfulCount: z.ZodNumber;
        status: z.ZodEnum<["visible", "hidden", "deleted"]>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "deleted" | "visible" | "hidden";
        createdAt: string;
        userId: string;
        productId: string;
        rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
        helpfulCount: number;
        notHelpfulCount: number;
        comment: string | null;
    }, {
        id: string;
        status: "deleted" | "visible" | "hidden";
        createdAt: string;
        userId: string;
        productId: string;
        rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
        helpfulCount: number;
        notHelpfulCount: number;
        comment: string | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "deleted" | "visible" | "hidden";
        createdAt: string;
        userId: string;
        productId: string;
        rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
        helpfulCount: number;
        notHelpfulCount: number;
        comment: string | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "deleted" | "visible" | "hidden";
        createdAt: string;
        userId: string;
        productId: string;
        rating: "buy_again" | "buy_again_on_sale" | "wont_buy";
        helpfulCount: number;
        notHelpfulCount: number;
        comment: string | null;
    }[];
    nextCursor: string | null;
}>;
export declare const adminReviewStatusPatchSchema: z.ZodObject<{
    status: z.ZodEnum<["visible", "hidden", "deleted"]>;
}, "strip", z.ZodTypeAny, {
    status: "deleted" | "visible" | "hidden";
}, {
    status: "deleted" | "visible" | "hidden";
}>;
//# sourceMappingURL=reviews.d.ts.map