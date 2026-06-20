import { z } from 'zod';
export declare const dealStatusSchema: z.ZodEnum<["visible", "hidden", "deleted"]>;
export type DealStatus = z.infer<typeof dealStatusSchema>;
export declare const dealSortSchema: z.ZodDefault<z.ZodEnum<["score", "new"]>>;
export type DealSort = z.infer<typeof dealSortSchema>;
export declare const DEAL_PHOTO_CDN_HOST = "cdn.expyrico.app";
export declare const dealSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    productId: z.ZodString;
    price: z.ZodNumber;
    currency: z.ZodString;
    storeName: z.ZodString;
    photoUrl: z.ZodNullable<z.ZodString>;
    expiryDate: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    country: z.ZodNullable<z.ZodString>;
    upvoteCount: z.ZodNumber;
    downvoteCount: z.ZodNumber;
    score: z.ZodNumber;
    status: z.ZodEnum<["visible", "hidden", "deleted"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    myVote: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>>>;
    product: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        brand: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        brand: string | null;
        imageUrl: string | null;
    }, {
        id: string;
        name: string;
        brand: string | null;
        imageUrl: string | null;
    }>>;
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
    country: string | null;
    status: "deleted" | "visible" | "hidden";
    createdAt: string;
    updatedAt: string;
    userId: string;
    productId: string;
    expiryDate: string | null;
    photoUrl: string | null;
    score: number;
    price: number;
    currency: string;
    storeName: string;
    note: string | null;
    upvoteCount: number;
    downvoteCount: number;
    product?: {
        id: string;
        name: string;
        brand: string | null;
        imageUrl: string | null;
    } | undefined;
    myVote?: 1 | -1 | null | undefined;
    author?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}, {
    id: string;
    country: string | null;
    status: "deleted" | "visible" | "hidden";
    createdAt: string;
    updatedAt: string;
    userId: string;
    productId: string;
    expiryDate: string | null;
    photoUrl: string | null;
    score: number;
    price: number;
    currency: string;
    storeName: string;
    note: string | null;
    upvoteCount: number;
    downvoteCount: number;
    product?: {
        id: string;
        name: string;
        brand: string | null;
        imageUrl: string | null;
    } | undefined;
    myVote?: 1 | -1 | null | undefined;
    author?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}>;
export type Deal = z.infer<typeof dealSchema>;
export declare const dealCreateSchema: z.ZodObject<{
    productId: z.ZodString;
    price: z.ZodNumber;
    currency: z.ZodOptional<z.ZodString>;
    storeName: z.ZodString;
    photoUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    expiryDate: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    price: number;
    storeName: string;
    expiryDate?: string | undefined;
    photoUrl?: string | undefined;
    currency?: string | undefined;
    note?: string | undefined;
}, {
    productId: string;
    price: number;
    storeName: string;
    expiryDate?: string | undefined;
    photoUrl?: string | undefined;
    currency?: string | undefined;
    note?: string | undefined;
}>;
export type DealCreate = z.infer<typeof dealCreateSchema>;
export declare const dealPatchSchema: z.ZodEffects<z.ZodObject<{
    price: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    storeName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    photoUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>>;
    expiryDate: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodNull]>>;
    note: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodNull]>>;
}, "strip", z.ZodTypeAny, {
    expiryDate?: string | null | undefined;
    photoUrl?: string | null | undefined;
    price?: number | undefined;
    storeName?: string | undefined;
    note?: string | null | undefined;
}, {
    expiryDate?: string | null | undefined;
    photoUrl?: string | null | undefined;
    price?: number | undefined;
    storeName?: string | undefined;
    note?: string | null | undefined;
}>, {
    expiryDate?: string | null | undefined;
    photoUrl?: string | null | undefined;
    price?: number | undefined;
    storeName?: string | undefined;
    note?: string | null | undefined;
}, {
    expiryDate?: string | null | undefined;
    photoUrl?: string | null | undefined;
    price?: number | undefined;
    storeName?: string | undefined;
    note?: string | null | undefined;
}>;
export type DealPatch = z.infer<typeof dealPatchSchema>;
export declare const dealVoteSchema: z.ZodObject<{
    value: z.ZodUnion<[z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
}, "strip", z.ZodTypeAny, {
    value: 1 | -1;
}, {
    value: 1 | -1;
}>;
export type DealVote = z.infer<typeof dealVoteSchema>;
export declare const dealListQuerySchema: z.ZodObject<{
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
export type DealListQuery = z.infer<typeof dealListQuerySchema>;
//# sourceMappingURL=deal.d.ts.map