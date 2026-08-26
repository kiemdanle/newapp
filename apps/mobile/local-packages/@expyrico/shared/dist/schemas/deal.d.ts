import { z } from 'zod';
export declare const dealStatusSchema: z.ZodEnum<["visible", "hidden", "deleted"]>;
export type DealStatus = z.infer<typeof dealStatusSchema>;
export declare const dealSortSchema: z.ZodDefault<z.ZodEnum<["score", "new", "price_asc", "price_desc", "expiry_asc"]>>;
export type DealSort = z.infer<typeof dealSortSchema>;
export declare const dealExpiryStatusSchema: z.ZodDefault<z.ZodEnum<["all", "unexpired", "expiring_soon"]>>;
export type DealExpiryStatus = z.infer<typeof dealExpiryStatusSchema>;
export declare const dealStoreFacetSchema: z.ZodObject<{
    name: z.ZodString;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    count: number;
}, {
    name: string;
    count: number;
}>;
export type DealStoreFacet = z.infer<typeof dealStoreFacetSchema>;
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
        name: string;
        id: string;
        brand: string | null;
        imageUrl: string | null;
    }, {
        name: string;
        id: string;
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
    score: number;
    status: "visible" | "hidden" | "deleted";
    id: string;
    userId: string;
    productId: string;
    price: number;
    currency: string;
    storeName: string;
    photoUrl: string | null;
    expiryDate: string | null;
    note: string | null;
    country: string | null;
    upvoteCount: number;
    downvoteCount: number;
    createdAt: string;
    updatedAt: string;
    myVote?: 1 | -1 | null | undefined;
    product?: {
        name: string;
        id: string;
        brand: string | null;
        imageUrl: string | null;
    } | undefined;
    author?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}, {
    score: number;
    status: "visible" | "hidden" | "deleted";
    id: string;
    userId: string;
    productId: string;
    price: number;
    currency: string;
    storeName: string;
    photoUrl: string | null;
    expiryDate: string | null;
    note: string | null;
    country: string | null;
    upvoteCount: number;
    downvoteCount: number;
    createdAt: string;
    updatedAt: string;
    myVote?: 1 | -1 | null | undefined;
    product?: {
        name: string;
        id: string;
        brand: string | null;
        imageUrl: string | null;
    } | undefined;
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
    currency?: string | undefined;
    photoUrl?: string | undefined;
    expiryDate?: string | undefined;
    note?: string | undefined;
}, {
    productId: string;
    price: number;
    storeName: string;
    currency?: string | undefined;
    photoUrl?: string | undefined;
    expiryDate?: string | undefined;
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
    price?: number | undefined;
    storeName?: string | undefined;
    photoUrl?: string | null | undefined;
    expiryDate?: string | null | undefined;
    note?: string | null | undefined;
}, {
    price?: number | undefined;
    storeName?: string | undefined;
    photoUrl?: string | null | undefined;
    expiryDate?: string | null | undefined;
    note?: string | null | undefined;
}>, {
    price?: number | undefined;
    storeName?: string | undefined;
    photoUrl?: string | null | undefined;
    expiryDate?: string | null | undefined;
    note?: string | null | undefined;
}, {
    price?: number | undefined;
    storeName?: string | undefined;
    photoUrl?: string | null | undefined;
    expiryDate?: string | null | undefined;
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
    sort: z.ZodDefault<z.ZodEnum<["score", "new", "price_asc", "price_desc", "expiry_asc"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    q: z.ZodOptional<z.ZodString>;
    store: z.ZodOptional<z.ZodString>;
    minPrice: z.ZodOptional<z.ZodNumber>;
    maxPrice: z.ZodOptional<z.ZodNumber>;
    country: z.ZodOptional<z.ZodString>;
    expiryStatus: z.ZodOptional<z.ZodDefault<z.ZodEnum<["all", "unexpired", "expiring_soon"]>>>;
    productId: z.ZodOptional<z.ZodString>;
    timezoneOffset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "score" | "new" | "price_asc" | "price_desc" | "expiry_asc";
    limit: number;
    productId?: string | undefined;
    country?: string | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
    store?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    expiryStatus?: "all" | "unexpired" | "expiring_soon" | undefined;
    timezoneOffset?: number | undefined;
}, {
    sort?: "score" | "new" | "price_asc" | "price_desc" | "expiry_asc" | undefined;
    productId?: string | undefined;
    country?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    q?: string | undefined;
    store?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    expiryStatus?: "all" | "unexpired" | "expiring_soon" | undefined;
    timezoneOffset?: number | undefined;
}>;
export type DealListQuery = z.infer<typeof dealListQuerySchema>;
//# sourceMappingURL=deal.d.ts.map