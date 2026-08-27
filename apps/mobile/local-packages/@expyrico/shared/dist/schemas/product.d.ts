import { z } from 'zod';
export declare const productSourceSchema: z.ZodEnum<["off", "upcitemdb", "user"]>;
export type ProductSource = z.infer<typeof productSourceSchema>;
export declare const productStatusSchema: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export declare const productDescriptionValueSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, string | null>, string | null, string | null>, string | null, string | null>;
export type ProductDescription = z.infer<typeof productDescriptionValueSchema>;
export declare const productPhotoSchema: z.ZodObject<{
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
}>;
export type ProductPhoto = z.infer<typeof productPhotoSchema>;
export declare const productSchema: z.ZodObject<{
    id: z.ZodString;
    barcode: z.ZodNullable<z.ZodString>;
    qrPayload: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    brand: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    imageUrl: z.ZodNullable<z.ZodString>;
    defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
    source: z.ZodEnum<["off", "upcitemdb", "user"]>;
    sourceId: z.ZodNullable<z.ZodString>;
    isCommunityEligible: z.ZodBoolean;
    buyAgainCount: z.ZodNumber;
    buyAgainOnSaleCount: z.ZodNumber;
    wontBuyCount: z.ZodNumber;
    ratingCount: z.ZodNumber;
    reviewCount: z.ZodNumber;
    status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
    version: z.ZodNumber;
    photos: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    defaultShelfLifeDays: number | null;
    source: "off" | "upcitemdb" | "user";
    sourceId: string | null;
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }[];
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    defaultShelfLifeDays: number | null;
    source: "off" | "upcitemdb" | "user";
    sourceId: string | null;
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }[];
    createdAt: string;
    updatedAt: string;
}>;
export type Product = z.infer<typeof productSchema>;
export declare const productWithReviewsSchema: z.ZodObject<{
    id: z.ZodString;
    barcode: z.ZodNullable<z.ZodString>;
    qrPayload: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    brand: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    imageUrl: z.ZodNullable<z.ZodString>;
    defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
    source: z.ZodEnum<["off", "upcitemdb", "user"]>;
    sourceId: z.ZodNullable<z.ZodString>;
    isCommunityEligible: z.ZodBoolean;
    buyAgainCount: z.ZodNumber;
    buyAgainOnSaleCount: z.ZodNumber;
    wontBuyCount: z.ZodNumber;
    ratingCount: z.ZodNumber;
    reviewCount: z.ZodNumber;
    status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
    version: z.ZodNumber;
    photos: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    topReviews: z.ZodArray<z.ZodUnknown, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    defaultShelfLifeDays: number | null;
    source: "off" | "upcitemdb" | "user";
    sourceId: string | null;
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }[];
    createdAt: string;
    updatedAt: string;
    topReviews: unknown[];
}, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
    barcode: string | null;
    qrPayload: string | null;
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    defaultShelfLifeDays: number | null;
    source: "off" | "upcitemdb" | "user";
    sourceId: string | null;
    isCommunityEligible: boolean;
    buyAgainCount: number;
    buyAgainOnSaleCount: number;
    wontBuyCount: number;
    ratingCount: number;
    reviewCount: number;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
    }[];
    createdAt: string;
    updatedAt: string;
    topReviews: unknown[];
}>;
export type ProductWithReviews = z.infer<typeof productWithReviewsSchema>;
export declare const productLookupRequestSchema: z.ZodEffects<z.ZodObject<{
    barcode: z.ZodOptional<z.ZodString>;
    qr: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    barcode?: string | undefined;
    qr?: string | undefined;
}, {
    barcode?: string | undefined;
    qr?: string | undefined;
}>, {
    barcode?: string | undefined;
    qr?: string | undefined;
}, {
    barcode?: string | undefined;
    qr?: string | undefined;
}>;
export type ProductLookupRequest = z.infer<typeof productLookupRequestSchema>;
export declare const productLookupResponseSchema: z.ZodObject<{
    product: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        sourceId: z.ZodNullable<z.ZodString>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
        version: z.ZodNumber;
        photos: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    product: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    } | null;
}, {
    product: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    } | null;
}>;
export type ProductLookupResponse = z.infer<typeof productLookupResponseSchema>;
export declare const productSearchResultSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        sourceId: z.ZodNullable<z.ZodString>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        status: z.ZodEnum<["draft", "pending", "changes_required", "active", "report_hidden", "merged_into"]>;
        version: z.ZodNumber;
        photos: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }[];
}, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }[];
}>;
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;
export declare const productCreateRequestSchema: z.ZodObject<{
    barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    qrPayload: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    barcode?: string | null | undefined;
    qrPayload?: string | null | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    name: string;
    barcode?: string | null | undefined;
    qrPayload?: string | null | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}>;
export type ProductCreateRequest = z.infer<typeof productCreateRequestSchema>;
export declare const productPatchRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}, {
    name?: string | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    imageUrl?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
}>;
export type ProductPatchRequest = z.infer<typeof productPatchRequestSchema>;
export declare const productLookupV2ResponseSchema: z.ZodDiscriminatedUnion<"outcome", [z.ZodObject<{
    outcome: z.ZodLiteral<"found">;
    product: z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        sourceId: z.ZodNullable<z.ZodString>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        version: z.ZodNumber;
        photos: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    } & {
        status: z.ZodLiteral<"active">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "active";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        status: "active";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
}, "strict", z.ZodTypeAny, {
    product: {
        id: string;
        status: "active";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    };
    outcome: "found";
}, {
    product: {
        id: string;
        status: "active";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    };
    outcome: "found";
}>, z.ZodObject<{
    outcome: z.ZodLiteral<"editable_private">;
    product: z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        sourceId: z.ZodNullable<z.ZodString>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        version: z.ZodNumber;
        photos: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    } & {
        status: z.ZodEnum<["draft", "changes_required"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "draft" | "changes_required";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        status: "draft" | "changes_required";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
}, "strict", z.ZodTypeAny, {
    product: {
        id: string;
        status: "draft" | "changes_required";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    };
    outcome: "editable_private";
}, {
    product: {
        id: string;
        status: "draft" | "changes_required";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    };
    outcome: "editable_private";
}>, z.ZodObject<{
    outcome: z.ZodLiteral<"creator_pending">;
    product: z.ZodObject<{
        id: z.ZodString;
        barcode: z.ZodNullable<z.ZodString>;
        qrPayload: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        brand: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        defaultShelfLifeDays: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["off", "upcitemdb", "user"]>;
        sourceId: z.ZodNullable<z.ZodString>;
        isCommunityEligible: z.ZodBoolean;
        buyAgainCount: z.ZodNumber;
        buyAgainOnSaleCount: z.ZodNumber;
        wontBuyCount: z.ZodNumber;
        ratingCount: z.ZodNumber;
        reviewCount: z.ZodNumber;
        version: z.ZodNumber;
        photos: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    } & {
        status: z.ZodEnum<["draft", "pending", "changes_required", "report_hidden"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "report_hidden";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required" | "report_hidden";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
}, "strict", z.ZodTypeAny, {
    product: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "report_hidden";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    };
    outcome: "creator_pending";
}, {
    product: {
        id: string;
        status: "draft" | "pending" | "changes_required" | "report_hidden";
        barcode: string | null;
        qrPayload: string | null;
        name: string;
        description: string | null;
        brand: string | null;
        category: string | null;
        imageUrl: string | null;
        defaultShelfLifeDays: number | null;
        source: "off" | "upcitemdb" | "user";
        sourceId: string | null;
        isCommunityEligible: boolean;
        buyAgainCount: number;
        buyAgainOnSaleCount: number;
        wontBuyCount: number;
        ratingCount: number;
        reviewCount: number;
        version: number;
        photos: {
            id: string;
            position: number;
            thumbnailUrl: string;
            displayUrl: string;
        }[];
        createdAt: string;
        updatedAt: string;
    };
    outcome: "creator_pending";
}>, z.ZodObject<{
    outcome: z.ZodLiteral<"under_review">;
}, "strict", z.ZodTypeAny, {
    outcome: "under_review";
}, {
    outcome: "under_review";
}>, z.ZodObject<{
    outcome: z.ZodLiteral<"not_found">;
    canCreate: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    outcome: "not_found";
    canCreate: boolean;
}, {
    outcome: "not_found";
    canCreate: boolean;
}>, z.ZodObject<{
    outcome: z.ZodLiteral<"temporarily_unavailable">;
    retryAfterSeconds: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    outcome: "temporarily_unavailable";
    retryAfterSeconds?: number | undefined;
}, {
    outcome: "temporarily_unavailable";
    retryAfterSeconds?: number | undefined;
}>]>;
export type ProductLookupV2Response = z.infer<typeof productLookupV2ResponseSchema>;
declare const productDraftStatusSchema: z.ZodEnum<["draft", "pending", "changes_required"]>;
export type ProductDraftStatus = z.infer<typeof productDraftStatusSchema>;
export declare const productDraftsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "changes_required"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "draft" | "pending" | "changes_required" | undefined;
    cursor?: string | undefined;
}, {
    status?: "draft" | "pending" | "changes_required" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type ProductDraftsQuery = z.infer<typeof productDraftsQuerySchema>;
declare const productDraftIdentifierSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"barcode">;
    value: z.ZodString;
}, "strict", z.ZodTypeAny, {
    value: string;
    kind: "barcode";
}, {
    value: string;
    kind: "barcode";
}>, z.ZodObject<{
    kind: z.ZodLiteral<"qr">;
    value: z.ZodString;
}, "strict", z.ZodTypeAny, {
    value: string;
    kind: "qr";
}, {
    value: string;
    kind: "qr";
}>]>;
export type ProductDraftIdentifier = z.infer<typeof productDraftIdentifierSchema>;
export declare const productDraftRowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    identifier: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"barcode">;
        value: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        value: string;
        kind: "barcode";
    }, {
        value: string;
        kind: "barcode";
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"qr">;
        value: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        value: string;
        kind: "qr";
    }, {
        value: string;
        kind: "qr";
    }>]>;
    status: z.ZodEnum<["draft", "pending", "changes_required"]>;
    version: z.ZodNumber;
    moderationFeedback: z.ZodNullable<z.ZodString>;
    cover: z.ZodNullable<z.ZodObject<{
        photoId: z.ZodString;
        thumbnailUrl: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        thumbnailUrl: string;
        photoId: string;
    }, {
        thumbnailUrl: string;
        photoId: string;
    }>>;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    status: "draft" | "pending" | "changes_required";
    name: string;
    version: number;
    updatedAt: string;
    identifier: {
        value: string;
        kind: "barcode";
    } | {
        value: string;
        kind: "qr";
    };
    moderationFeedback: string | null;
    cover: {
        thumbnailUrl: string;
        photoId: string;
    } | null;
}, {
    id: string;
    status: "draft" | "pending" | "changes_required";
    name: string;
    version: number;
    updatedAt: string;
    identifier: {
        value: string;
        kind: "barcode";
    } | {
        value: string;
        kind: "qr";
    };
    moderationFeedback: string | null;
    cover: {
        thumbnailUrl: string;
        photoId: string;
    } | null;
}>;
export type ProductDraftRow = z.infer<typeof productDraftRowSchema>;
export declare const productDraftsPageSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        identifier: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"barcode">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            value: string;
            kind: "barcode";
        }, {
            value: string;
            kind: "barcode";
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"qr">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            value: string;
            kind: "qr";
        }, {
            value: string;
            kind: "qr";
        }>]>;
        status: z.ZodEnum<["draft", "pending", "changes_required"]>;
        version: z.ZodNumber;
        moderationFeedback: z.ZodNullable<z.ZodString>;
        cover: z.ZodNullable<z.ZodObject<{
            photoId: z.ZodString;
            thumbnailUrl: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            thumbnailUrl: string;
            photoId: string;
        }, {
            thumbnailUrl: string;
            photoId: string;
        }>>;
        updatedAt: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        id: string;
        status: "draft" | "pending" | "changes_required";
        name: string;
        version: number;
        updatedAt: string;
        identifier: {
            value: string;
            kind: "barcode";
        } | {
            value: string;
            kind: "qr";
        };
        moderationFeedback: string | null;
        cover: {
            thumbnailUrl: string;
            photoId: string;
        } | null;
    }, {
        id: string;
        status: "draft" | "pending" | "changes_required";
        name: string;
        version: number;
        updatedAt: string;
        identifier: {
            value: string;
            kind: "barcode";
        } | {
            value: string;
            kind: "qr";
        };
        moderationFeedback: string | null;
        cover: {
            thumbnailUrl: string;
            photoId: string;
        } | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required";
        name: string;
        version: number;
        updatedAt: string;
        identifier: {
            value: string;
            kind: "barcode";
        } | {
            value: string;
            kind: "qr";
        };
        moderationFeedback: string | null;
        cover: {
            thumbnailUrl: string;
            photoId: string;
        } | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "draft" | "pending" | "changes_required";
        name: string;
        version: number;
        updatedAt: string;
        identifier: {
            value: string;
            kind: "barcode";
        } | {
            value: string;
            kind: "qr";
        };
        moderationFeedback: string | null;
        cover: {
            thumbnailUrl: string;
            photoId: string;
        } | null;
    }[];
    nextCursor: string | null;
}>;
export type ProductDraftsPage = z.infer<typeof productDraftsPageSchema>;
export declare const productDraftCreateRequestSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    qrPayload: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    barcode?: string | null | undefined;
    qrPayload?: string | null | undefined;
}, {
    barcode?: string | null | undefined;
    qrPayload?: string | null | undefined;
}>, {
    barcode: string | undefined;
    qrPayload: string | undefined;
}, {
    barcode?: string | null | undefined;
    qrPayload?: string | null | undefined;
}>, {
    barcode: string | undefined;
    qrPayload: string | undefined;
}, {
    barcode?: string | null | undefined;
    qrPayload?: string | null | undefined;
}>;
export type ProductDraftCreateRequest = z.infer<typeof productDraftCreateRequestSchema>;
export declare const productDraftPatchRequestSchema: z.ZodObject<{
    version: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, string | null>, string | null, string | null>, string | null, string | null>>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    version: number;
    name?: string | undefined;
    description?: string | null | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
}, {
    version: number;
    name?: string | undefined;
    description?: string | null | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
}>;
export type ProductDraftPatchRequest = z.infer<typeof productDraftPatchRequestSchema>;
export declare const productDraftReorderRequestSchema: z.ZodEffects<z.ZodObject<{
    photoIds: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    photoIds: string[];
}, {
    photoIds: string[];
}>, {
    photoIds: string[];
}, {
    photoIds: string[];
}>;
export type ProductDraftReorderRequest = z.infer<typeof productDraftReorderRequestSchema>;
export declare const productDraftSubmitRequestSchema: z.ZodObject<{
    version: z.ZodNumber;
    abuseToken: z.ZodString;
    platform: z.ZodEnum<["android", "ios"]>;
}, "strict", z.ZodTypeAny, {
    version: number;
    abuseToken: string;
    platform: "android" | "ios";
}, {
    version: number;
    abuseToken: string;
    platform: "android" | "ios";
}>;
export type ProductDraftSubmitRequest = z.infer<typeof productDraftSubmitRequestSchema>;
export {};
//# sourceMappingURL=product.d.ts.map