import { z } from 'zod';
export declare const productEditPhotoSchema: z.ZodObject<{
    id: z.ZodString;
    sourceProductPhotoId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
    sourceProductPhotoId?: string | null | undefined;
}, {
    id: string;
    position: number;
    thumbnailUrl: string;
    displayUrl: string;
    retained: boolean;
    sourceProductPhotoId?: string | null | undefined;
}>;
export type ProductEditPhoto = z.infer<typeof productEditPhotoSchema>;
export declare const productEditRowSchema: z.ZodObject<{
    id: z.ZodString;
    productId: z.ZodString;
    status: z.ZodEnum<["draft", "pending", "changes_required", "approved", "rejected"]>;
    version: z.ZodNumber;
    baseProductVersion: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    brand: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceProductPhotoId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
        sourceProductPhotoId?: string | null | undefined;
    }, {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
        sourceProductPhotoId?: string | null | undefined;
    }>, "many">;
    moderationFeedback: z.ZodNullable<z.ZodString>;
    submittedAt: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
        sourceProductPhotoId?: string | null | undefined;
    }[];
    updatedAt: string;
    productId: string;
    baseProductVersion: number;
    submittedAt: string | null;
    moderationFeedback: string | null;
    defaultShelfLifeDays?: number | null | undefined;
    notes?: string | null | undefined;
}, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
        sourceProductPhotoId?: string | null | undefined;
    }[];
    updatedAt: string;
    productId: string;
    baseProductVersion: number;
    submittedAt: string | null;
    moderationFeedback: string | null;
    defaultShelfLifeDays?: number | null | undefined;
    notes?: string | null | undefined;
}>;
export type ProductEditRow = z.infer<typeof productEditRowSchema>;
export declare const productEditMetadataPatchRequestSchema: z.ZodObject<{
    version: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodNullable<z.ZodString>, string | null, string | null>, string | null, string | null>, string | null, string | null>>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    version: number;
    name?: string | undefined;
    description?: string | null | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
    notes?: string | null | undefined;
}, {
    version: number;
    name?: string | undefined;
    description?: string | null | undefined;
    brand?: string | null | undefined;
    category?: string | null | undefined;
    defaultShelfLifeDays?: number | null | undefined;
    notes?: string | null | undefined;
}>;
export type ProductEditMetadataPatchRequest = z.infer<typeof productEditMetadataPatchRequestSchema>;
export declare const productEditPhotoReorderRequestSchema: z.ZodEffects<z.ZodObject<{
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
export type ProductEditPhotoReorderRequest = z.infer<typeof productEditPhotoReorderRequestSchema>;
export declare const productEditSubmitRequestSchema: z.ZodObject<{
    version: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    version: number;
}, {
    version: number;
}>;
export type ProductEditSubmitRequest = z.infer<typeof productEditSubmitRequestSchema>;
export declare const adminProductEditDetailSchema: z.ZodObject<{
    id: z.ZodString;
    productId: z.ZodString;
    status: z.ZodEnum<["draft", "pending", "changes_required", "approved", "rejected"]>;
    version: z.ZodNumber;
    baseProductVersion: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    brand: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    defaultShelfLifeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceProductPhotoId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
        sourceProductPhotoId?: string | null | undefined;
    }, {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
        sourceProductPhotoId?: string | null | undefined;
    }>, "many">;
    moderationFeedback: z.ZodNullable<z.ZodString>;
    submittedAt: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodString;
} & {
    submittedBy: z.ZodString;
    liveProductVersion: z.ZodNumber;
    productName: z.ZodOptional<z.ZodString>;
    creator: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    }, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    }>>>;
}, "strict", z.ZodTypeAny, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
        sourceProductPhotoId?: string | null | undefined;
    }[];
    updatedAt: string;
    productId: string;
    submittedBy: string;
    baseProductVersion: number;
    submittedAt: string | null;
    moderationFeedback: string | null;
    liveProductVersion: number;
    defaultShelfLifeDays?: number | null | undefined;
    creator?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null | undefined;
    productName?: string | undefined;
    notes?: string | null | undefined;
}, {
    id: string;
    status: "draft" | "pending" | "changes_required" | "approved" | "rejected";
    name: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    version: number;
    photos: {
        id: string;
        position: number;
        thumbnailUrl: string;
        displayUrl: string;
        retained: boolean;
        sourceProductPhotoId?: string | null | undefined;
    }[];
    updatedAt: string;
    productId: string;
    submittedBy: string;
    baseProductVersion: number;
    submittedAt: string | null;
    moderationFeedback: string | null;
    liveProductVersion: number;
    defaultShelfLifeDays?: number | null | undefined;
    creator?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null | undefined;
    productName?: string | undefined;
    notes?: string | null | undefined;
}>;
export type AdminProductEditDetail = z.infer<typeof adminProductEditDetailSchema>;
//# sourceMappingURL=product-edits.d.ts.map