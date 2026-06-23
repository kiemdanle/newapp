import { z } from 'zod';
export declare const adminProductStatusSchema: z.ZodEnum<["active", "pending", "merged_into"]>;
export declare const adminProductSourceSchema: z.ZodEnum<["off", "upcitemdb", "user"]>;
export declare const adminProductRowSchema: z.ZodObject<{
    id: z.ZodString;
    barcode: z.ZodNullable<z.ZodString>;
    qrPayload: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    brand: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    imageUrl: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<["off", "upcitemdb", "user"]>;
    status: z.ZodEnum<["active", "pending", "merged_into"]>;
    isCommunityEligible: z.ZodBoolean;
    buyAgainCount: z.ZodNumber;
    buyAgainOnSaleCount: z.ZodNumber;
    wontBuyCount: z.ZodNumber;
    ratingCount: z.ZodNumber;
    reviewCount: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "active" | "pending" | "merged_into";
    createdAt: string;
    updatedAt: string;
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    source: "user" | "off" | "upcitemdb";
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
}, {
    id: string;
    status: "active" | "pending" | "merged_into";
    createdAt: string;
    updatedAt: string;
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    source: "user" | "off" | "upcitemdb";
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
}>;
export declare const adminProductsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["active", "pending", "merged_into"]>>;
    source: z.ZodOptional<z.ZodEnum<["off", "upcitemdb", "user"]>>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "active" | "pending" | "merged_into" | undefined;
    source?: "user" | "off" | "upcitemdb" | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
}, {
    status?: "active" | "pending" | "merged_into" | undefined;
    source?: "user" | "off" | "upcitemdb" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    q?: string | undefined;
}>;
export declare const adminProductsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        status: z.ZodEnum<["active", "pending", "merged_into"]>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "active" | "pending" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "user" | "off" | "upcitemdb";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
    }, {
        id: string;
        status: "active" | "pending" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "user" | "off" | "upcitemdb";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "active" | "pending" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "user" | "off" | "upcitemdb";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "active" | "pending" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "user" | "off" | "upcitemdb";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
    }[];
    nextCursor: string | null;
}>;
export declare const adminProductPatchSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<["active", "pending", "merged_into"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "pending" | "merged_into" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    status?: "active" | "pending" | "merged_into" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}>, {
    status?: "active" | "pending" | "merged_into" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    status?: "active" | "pending" | "merged_into" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}>;
export declare const adminProductMergeSchema: z.ZodEffects<z.ZodObject<{
    winnerId: z.ZodString;
    loserIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    winnerId: string;
    loserIds: string[];
}, {
    winnerId: string;
    loserIds: string[];
}>, {
    winnerId: string;
    loserIds: string[];
}, {
    winnerId: string;
    loserIds: string[];
}>;
export declare const adminProductMergeResponseSchema: z.ZodObject<{
    winnerId: z.ZodString;
    movedRecords: z.ZodNumber;
    movedReviews: z.ZodNumber;
    newReviewCount: z.ZodNumber;
    newRatingCount: z.ZodNumber;
    newBuyAgainCount: z.ZodNumber;
    newBuyAgainOnSaleCount: z.ZodNumber;
    newWontBuyCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    winnerId: string;
    movedRecords: number;
    movedReviews: number;
    newReviewCount: number;
    newRatingCount: number;
    newBuyAgainCount: number;
    newBuyAgainOnSaleCount: number;
    newWontBuyCount: number;
}, {
    winnerId: string;
    movedRecords: number;
    movedReviews: number;
    newReviewCount: number;
    newRatingCount: number;
    newBuyAgainCount: number;
    newBuyAgainOnSaleCount: number;
    newWontBuyCount: number;
}>;
export declare const adminProductEditRowSchema: z.ZodObject<{
    id: z.ZodString;
    productId: z.ZodString;
    submittedBy: z.ZodString;
    proposed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    status: z.ZodEnum<["pending", "approved", "rejected"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    productId: string;
    submittedBy: string;
    proposed: Record<string, unknown>;
}, {
    id: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    productId: string;
    submittedBy: string;
    proposed: Record<string, unknown>;
}>;
export declare const adminProductEditsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        productId: z.ZodString;
        submittedBy: z.ZodString;
        proposed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        status: z.ZodEnum<["pending", "approved", "rejected"]>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "pending" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
    }, {
        id: string;
        status: "pending" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "pending" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "pending" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
    }[];
    nextCursor: string | null;
}>;
export declare const adminProductEditResolveSchema: z.ZodObject<{
    decision: z.ZodEnum<["approve", "reject"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "approve" | "reject";
    notes?: string | undefined;
}, {
    decision: "approve" | "reject";
    notes?: string | undefined;
}>;
export type AdminProductPatch = z.infer<typeof adminProductPatchSchema>;
export type AdminProductMerge = z.infer<typeof adminProductMergeSchema>;
//# sourceMappingURL=products.d.ts.map