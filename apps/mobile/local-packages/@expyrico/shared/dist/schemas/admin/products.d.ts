import { z } from 'zod';
export declare const adminProductStatusSchema: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
export declare const adminProductSourceSchema: z.ZodEnum<["off", "upcitemdb", "user"]>;
export declare const adminProductRowSchema: z.ZodObject<{
    id: z.ZodString;
    barcode: z.ZodNullable<z.ZodString>;
    qrPayload: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    brand: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    imageUrl: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<["off", "upcitemdb", "user"]>;
    status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
    version: z.ZodNumber;
    mergedIntoProductId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isCommunityEligible: z.ZodBoolean;
    buyAgainCount: z.ZodNumber;
    buyAgainOnSaleCount: z.ZodNumber;
    wontBuyCount: z.ZodNumber;
    ratingCount: z.ZodNumber;
    reviewCount: z.ZodNumber;
    photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        position: z.ZodNumber;
        thumbnailUrl: z.ZodString;
        displayUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }, {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }>, "many">>;
    moderationNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    moderatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into";
    createdAt: string;
    updatedAt: string;
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    description: string | null;
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
    version: number;
    photos?: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }[] | undefined;
    mergedIntoProductId?: string | null | undefined;
    moderationNotes?: string | null | undefined;
    moderatedAt?: string | null | undefined;
}, {
    id: string;
    status: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into";
    createdAt: string;
    updatedAt: string;
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    description: string | null;
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
    version: number;
    photos?: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }[] | undefined;
    mergedIntoProductId?: string | null | undefined;
    moderationNotes?: string | null | undefined;
    moderatedAt?: string | null | undefined;
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
    status?: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into" | undefined;
    source?: "user" | "off" | "upcitemdb" | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
}, {
    status?: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into" | undefined;
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
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
        version: z.ZodNumber;
        mergedIntoProductId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            position: z.ZodNumber;
            thumbnailUrl: z.ZodString;
            displayUrl: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }>, "many">>;
        moderationNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        moderatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
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
        version: number;
        photos?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[] | undefined;
        mergedIntoProductId?: string | null | undefined;
        moderationNotes?: string | null | undefined;
        moderatedAt?: string | null | undefined;
    }, {
        id: string;
        status: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
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
        version: number;
        photos?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[] | undefined;
        mergedIntoProductId?: string | null | undefined;
        moderationNotes?: string | null | undefined;
        moderatedAt?: string | null | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
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
        version: number;
        photos?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[] | undefined;
        mergedIntoProductId?: string | null | undefined;
        moderationNotes?: string | null | undefined;
        moderatedAt?: string | null | undefined;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into";
        createdAt: string;
        updatedAt: string;
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
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
        version: number;
        photos?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[] | undefined;
        mergedIntoProductId?: string | null | undefined;
        moderationNotes?: string | null | undefined;
        moderatedAt?: string | null | undefined;
    }[];
    nextCursor: string | null;
}>;
export declare const adminProductDirectStatusSchema: z.ZodEnum<["active", "report_hidden"]>;
export declare const adminProductPatchSchema: z.ZodEffects<z.ZodObject<{
    version: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<["active", "report_hidden"]>>;
}, "strip", z.ZodTypeAny, {
    version: number;
    status?: "active" | "report_hidden" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    version: number;
    status?: "active" | "report_hidden" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}>, {
    version: number;
    status?: "active" | "report_hidden" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    version: number;
    status?: "active" | "report_hidden" | undefined;
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}>;
export declare const adminProductMergeSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    targetId: z.ZodString;
    sourceIds: z.ZodArray<z.ZodString, "many">;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    version: number;
    targetId: string;
    sourceIds: string[];
}, {
    version: number;
    targetId: string;
    sourceIds: string[];
}>, {
    version: number;
    targetId: string;
    sourceIds: string[];
}, {
    version: number;
    targetId: string;
    sourceIds: string[];
}>, {
    version: number;
    targetId: string;
    sourceIds: string[];
}, {
    version: number;
    targetId: string;
    sourceIds: string[];
}>;
export declare const adminProductMergeResponseSchema: z.ZodObject<{
    targetId: z.ZodString;
    movedRecords: z.ZodNumber;
    movedReviews: z.ZodNumber;
    newReviewCount: z.ZodNumber;
    newRatingCount: z.ZodNumber;
    newBuyAgainCount: z.ZodNumber;
    newBuyAgainOnSaleCount: z.ZodNumber;
    newWontBuyCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    targetId: string;
    movedRecords: number;
    movedReviews: number;
    newReviewCount: number;
    newRatingCount: number;
    newBuyAgainCount: number;
    newBuyAgainOnSaleCount: number;
    newWontBuyCount: number;
}, {
    targetId: string;
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
    name: z.ZodOptional<z.ZodString>;
    coverPhoto: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        position: z.ZodNumber;
        retained: z.ZodBoolean;
        thumbnailUrl: z.ZodString;
        displayUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
    }, {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
    }>>>;
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
    version: number;
    moderationNotes: string | null;
    productId: string;
    submittedBy: string;
    proposed: Record<string, unknown>;
    baseProductVersion: number;
    submittedAt: string | null;
    resolvedBy: string | null;
    resolvedAt: string | null;
    name?: string | undefined;
    coverPhoto?: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
    } | null | undefined;
}, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
    createdAt: string;
    version: number;
    moderationNotes: string | null;
    productId: string;
    submittedBy: string;
    proposed: Record<string, unknown>;
    baseProductVersion: number;
    submittedAt: string | null;
    resolvedBy: string | null;
    resolvedAt: string | null;
    name?: string | undefined;
    coverPhoto?: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
    } | null | undefined;
}>;
export declare const adminProductEditsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        productId: z.ZodString;
        submittedBy: z.ZodString;
        proposed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        name: z.ZodOptional<z.ZodString>;
        coverPhoto: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            position: z.ZodNumber;
            retained: z.ZodBoolean;
            thumbnailUrl: z.ZodString;
            displayUrl: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
            retained: boolean;
        }, {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
            retained: boolean;
        }>>>;
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
        version: number;
        moderationNotes: string | null;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        baseProductVersion: number;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
        name?: string | undefined;
        coverPhoto?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
            retained: boolean;
        } | null | undefined;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
        createdAt: string;
        version: number;
        moderationNotes: string | null;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        baseProductVersion: number;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
        name?: string | undefined;
        coverPhoto?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
            retained: boolean;
        } | null | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
        createdAt: string;
        version: number;
        moderationNotes: string | null;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        baseProductVersion: number;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
        name?: string | undefined;
        coverPhoto?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
            retained: boolean;
        } | null | undefined;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
        createdAt: string;
        version: number;
        moderationNotes: string | null;
        productId: string;
        submittedBy: string;
        proposed: Record<string, unknown>;
        baseProductVersion: number;
        submittedAt: string | null;
        resolvedBy: string | null;
        resolvedAt: string | null;
        name?: string | undefined;
        coverPhoto?: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
            retained: boolean;
        } | null | undefined;
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
export declare const adminProductModerateRequestSchema: z.ZodEffects<z.ZodObject<{
    decision: z.ZodEnum<["approve", "request_changes"]>;
    version: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: number;
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}, {
    version: number;
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}>, {
    version: number;
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}, {
    version: number;
    decision: "approve" | "request_changes";
    notes?: string | undefined;
}>;
export type AdminProductModerateRequest = z.infer<typeof adminProductModerateRequestSchema>;
export type AdminProductModerateDecision = AdminProductModerateRequest['decision'];
export declare const productEditRecoverRequestSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"action", [z.ZodObject<{
    action: z.ZodLiteral<"rebase">;
    editVersion: z.ZodNumber;
    productVersion: z.ZodNumber;
    desiredPhotoOrder: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"retained">;
        sourceProductPhotoId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        type: "retained";
        sourceProductPhotoId: string;
    }, {
        type: "retained";
        sourceProductPhotoId: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"staged">;
        editPhotoId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        type: "staged";
        editPhotoId: string;
    }, {
        type: "staged";
        editPhotoId: string;
    }>]>, "many">;
    notes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    action: "rebase";
    editVersion: number;
    productVersion: number;
    desiredPhotoOrder: ({
        type: "retained";
        sourceProductPhotoId: string;
    } | {
        type: "staged";
        editPhotoId: string;
    })[];
    notes?: string | undefined;
}, {
    action: "rebase";
    editVersion: number;
    productVersion: number;
    desiredPhotoOrder: ({
        type: "retained";
        sourceProductPhotoId: string;
    } | {
        type: "staged";
        editPhotoId: string;
    })[];
    notes?: string | undefined;
}>, z.ZodObject<{
    action: z.ZodLiteral<"supersede">;
    editVersion: z.ZodNumber;
    productVersion: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    action: "supersede";
    editVersion: number;
    productVersion: number;
    notes?: string | undefined;
}, {
    action: "supersede";
    editVersion: number;
    productVersion: number;
    notes?: string | undefined;
}>]>, {
    action: "rebase";
    editVersion: number;
    productVersion: number;
    desiredPhotoOrder: ({
        type: "retained";
        sourceProductPhotoId: string;
    } | {
        type: "staged";
        editPhotoId: string;
    })[];
    notes?: string | undefined;
} | {
    action: "supersede";
    editVersion: number;
    productVersion: number;
    notes?: string | undefined;
}, {
    action: "rebase";
    editVersion: number;
    productVersion: number;
    desiredPhotoOrder: ({
        type: "retained";
        sourceProductPhotoId: string;
    } | {
        type: "staged";
        editPhotoId: string;
    })[];
    notes?: string | undefined;
} | {
    action: "supersede";
    editVersion: number;
    productVersion: number;
    notes?: string | undefined;
}>;
export type ProductEditRecoverRequest = z.infer<typeof productEditRecoverRequestSchema>;
export type AdminProductPatch = z.infer<typeof adminProductPatchSchema>;
export type AdminProductMerge = z.infer<typeof adminProductMergeSchema>;
export type AdminProductEditResolveInput = z.infer<typeof adminProductEditResolveSchema>;
export type AdminProductEditResolveDecision = AdminProductEditResolveInput['decision'];
//# sourceMappingURL=products.d.ts.map