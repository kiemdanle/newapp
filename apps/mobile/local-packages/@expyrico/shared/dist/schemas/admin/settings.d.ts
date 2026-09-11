import { z } from 'zod';
export declare const featureFlagsSchema: z.ZodObject<{
    reviewsEnabled: z.ZodBoolean;
    passkeysEnabled: z.ZodBoolean;
    ocrEnabled: z.ZodBoolean;
    maintenanceBanner: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reviewsEnabled: boolean;
    passkeysEnabled: boolean;
    ocrEnabled: boolean;
    maintenanceBanner: string | null;
}, {
    reviewsEnabled: boolean;
    passkeysEnabled: boolean;
    ocrEnabled: boolean;
    maintenanceBanner: string | null;
}>;
export declare const moderationSettingsSchema: z.ZodObject<{
    autoHideReportThreshold: z.ZodNumber;
    profanitySensitivity: z.ZodEnum<["low", "medium", "high"]>;
}, "strip", z.ZodTypeAny, {
    autoHideReportThreshold: number;
    profanitySensitivity: "low" | "medium" | "high";
}, {
    autoHideReportThreshold: number;
    profanitySensitivity: "low" | "medium" | "high";
}>;
export declare const productCreationSettingsSchema: z.ZodObject<{
    mode: z.ZodEnum<["off", "internal", "all"]>;
    requireApproval: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    mode: "off" | "all" | "internal";
    requireApproval: boolean;
}, {
    mode: "off" | "all" | "internal";
    requireApproval?: boolean | undefined;
}>;
export type ProductCreationSettings = z.infer<typeof productCreationSettingsSchema>;
export declare const notificationTemplateSchema: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    title: z.ZodString;
    body: z.ZodString;
    enabled: z.ZodBoolean;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    updatedAt: string;
    key: string;
    title: string;
    body: string;
    enabled: boolean;
}, {
    id: string;
    updatedAt: string;
    key: string;
    title: string;
    body: string;
    enabled: boolean;
}>;
export declare const notificationTemplatePatchSchema: z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    body?: string | undefined;
    enabled?: boolean | undefined;
}, {
    title?: string | undefined;
    body?: string | undefined;
    enabled?: boolean | undefined;
}>, {
    title?: string | undefined;
    body?: string | undefined;
    enabled?: boolean | undefined;
}, {
    title?: string | undefined;
    body?: string | undefined;
    enabled?: boolean | undefined;
}>;
export declare const adminRowSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    totpEnabledAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    email: string;
    firstName: string;
    lastName: string;
    totpEnabledAt: string | null;
}, {
    id: string;
    createdAt: string;
    email: string;
    firstName: string;
    lastName: string;
    totpEnabledAt: string | null;
}>;
export type AdminRow = z.infer<typeof adminRowSchema>;
export declare const adminInviteSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
}, {
    email: string;
    firstName: string;
    lastName: string;
}>;
export declare const unitStringSchema: z.ZodString;
export declare const pantryUnitsSettingsSchema: z.ZodObject<{
    topUnits: z.ZodDefault<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>>;
}, "strip", z.ZodTypeAny, {
    topUnits: string[];
}, {
    topUnits?: string[] | undefined;
}>;
export type PantryUnitsSettings = z.infer<typeof pantryUnitsSettingsSchema>;
export declare const photoLimitsSettingsSchema: z.ZodObject<{
    maxProductPhotos: z.ZodDefault<z.ZodNumber>;
    maxPantryItemPhotos: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxProductPhotos: number;
    maxPantryItemPhotos: number;
}, {
    maxProductPhotos?: number | undefined;
    maxPantryItemPhotos?: number | undefined;
}>;
export type PhotoLimitsSettings = z.infer<typeof photoLimitsSettingsSchema>;
export declare const DEFAULT_PHOTO_LIMITS: PhotoLimitsSettings;
export declare const PHOTO_COMPRESSION_CONFIG: {
    readonly maxDimensionPx: 1920;
    readonly qualitySteps: readonly [0.82, 0.72, 0.7];
    readonly qualityFloor: 0.7;
    readonly maxFileBytes: number;
};
//# sourceMappingURL=settings.d.ts.map