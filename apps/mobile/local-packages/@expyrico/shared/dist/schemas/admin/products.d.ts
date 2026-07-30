import { z } from 'zod';
export declare const adminProductStatusSchema: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
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
    status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
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
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    source: "off" | "upcitemdb" | "user";
    status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    source: "off" | "upcitemdb" | "user";
    status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
    createdAt: string;
    updatedAt: string;
}>;
export declare const adminProductsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>>;
    source: z.ZodOptional<z.ZodEnum<["off", "upcitemdb", "user"]>>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    source?: "off" | "upcitemdb" | "user" | undefined;
    status?: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into" | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
}, {
    source?: "off" | "upcitemdb" | "user" | undefined;
    status?: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into" | undefined;
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
        status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
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
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "off" | "upcitemdb" | "user";
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "off" | "upcitemdb" | "user";
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        createdAt: string;
        updatedAt: string;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "off" | "upcitemdb" | "user";
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        createdAt: string;
        updatedAt: string;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        source: "off" | "upcitemdb" | "user";
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        createdAt: string;
        updatedAt: string;
    }[];
    nextCursor: string | null;
}>;
export declare const adminProductPatchSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    status?: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into" | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    status?: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into" | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}>, {
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    status?: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into" | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    status?: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into" | undefined;
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
export declare const productEditStatusSchema: z.ZodEnum<["draft", "pending", "changes_required", "approved", "rejected"]>;
export type ProductEditStatus = z.infer<typeof productEditStatusSchema>;
export declare const adminProductEditRowSchema: z.ZodObject<{
    id: z.ZodString;
    productId: z.ZodString;
    submittedBy: z.ZodString;
    proposed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    status: z.ZodEnum<["draft", "pending", "changes_required", "approved", "rejected"]>;
    version: z.ZodNumber;
    baseProductVersion: z.ZodNumber;
    moderationNotes: z.ZodNullable<z.ZodString>;
    submittedAt: z.ZodNullable<z.ZodString>;
    resolvedBy: z.ZodNullable<z.ZodString>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
    createdAt: string;
    productId: string;
    submittedBy: string;
    proposed: Record<string, unknown>;
    version: number;
    baseProductVersion: number;
    moderationNotes: string | null;
    submittedAt: string | null;
    resolvedBy: string | null;
    resolvedAt: string | null;
}, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
    createdAt: string;
    productId: string;
    submittedBy: string;
    proposed: Record<string, unknown>;
    version: number;
    baseProductVersion: number;
    moderationNotes: string | null;
    submittedAt: string | null;
    resolvedBy: string | null;
    resolvedAt: string | null;
}>;
export declare const adminProductEditsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        productId: z.ZodString;
        submittedBy: z.ZodString;
        proposed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        status: z.ZodEnum<["draft", "pending", "changes_required", "approved", "rejected"]>;
        version: z.ZodNumber;
        baseProductVersion: z.ZodNumber;
        moderationNotes: z.ZodNullable<z.ZodString>;
        submittedAt: z.ZodNullable<z.ZodString>;
        resolvedBy: z.ZodNullable<z.ZodString>;
        resolvedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        version: number;
        baseProductVersion: number;
        moderationNotes: string | null;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        version: number;
        baseProductVersion: number;
        moderationNotes: string | null;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        version: number;
        baseProductVersion: number;
        moderationNotes: string | null;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
        createdAt: string;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        version: number;
        baseProductVersion: number;
        moderationNotes: string | null;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
    }[];
    nextCursor: string | null;
}>;
export declare const adminProductEditResolveSchema: z.ZodEffects<z.ZodObject<{
    decision: z.ZodEnum<["approve", "request_changes"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}, {
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}>, {
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}, {
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}>;
export type AdminProductPatch = z.infer<typeof adminProductPatchSchema>;
export type AdminProductMerge = z.infer<typeof adminProductMergeSchema>;
export type AdminProductEditResolveInput = z.infer<typeof adminProductEditResolveSchema>;
export type AdminProductEditResolveDecision = AdminProductEditResolveInput['decision'];
//# sourceMappingURL=products.d.ts.map