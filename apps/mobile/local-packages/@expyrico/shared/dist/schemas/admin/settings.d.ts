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
    mode: "off" | "internal" | "all";
    requireApproval: boolean;
}, {
    mode: "off" | "internal" | "all";
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
    key: string;
    title: string;
    body: string;
    enabled: boolean;
    updatedAt: string;
}, {
    id: string;
    key: string;
    title: string;
    body: string;
    enabled: boolean;
    updatedAt: string;
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
    email: string;
    firstName: string;
    lastName: string;
    totpEnabledAt: string | null;
    createdAt: string;
}, {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    totpEnabledAt: string | null;
    createdAt: string;
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
export declare const USER_PANTRY_TIERS: readonly ["free", "pro", "supporter"];
export type UserPantryTier = (typeof USER_PANTRY_TIERS)[number];
export declare const pantryLimitsSettingsSchema: z.ZodObject<{
    defaultUserPantryLimit: z.ZodDefault<z.ZodNumber>;
    tierLimits: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
}, "strip", z.ZodTypeAny, {
    defaultUserPantryLimit: number;
    tierLimits: Record<string, number>;
}, {
    defaultUserPantryLimit?: number | undefined;
    tierLimits?: Record<string, number> | undefined;
}>;
export type PantryLimitsSettings = z.infer<typeof pantryLimitsSettingsSchema>;
export declare const pantryLimitsPatchSchema: z.ZodEffects<z.ZodObject<{
    defaultUserPantryLimit: z.ZodOptional<z.ZodNumber>;
    tierLimits: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    defaultUserPantryLimit?: number | undefined;
    tierLimits?: Record<string, number> | undefined;
}, {
    defaultUserPantryLimit?: number | undefined;
    tierLimits?: Record<string, number> | undefined;
}>, {
    defaultUserPantryLimit?: number | undefined;
    tierLimits?: Record<string, number> | undefined;
}, {
    defaultUserPantryLimit?: number | undefined;
    tierLimits?: Record<string, number> | undefined;
}>;
export type PantryLimitsPatch = z.infer<typeof pantryLimitsPatchSchema>;
export declare const DEFAULT_PANTRY_LIMITS: PantryLimitsSettings;
//# sourceMappingURL=settings.d.ts.map