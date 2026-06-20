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
    title: string;
    body: string;
    key: string;
    enabled: boolean;
}, {
    id: string;
    updatedAt: string;
    title: string;
    body: string;
    key: string;
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
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    totpEnabledAt: string | null;
}, {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    totpEnabledAt: string | null;
}>;
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
//# sourceMappingURL=settings.d.ts.map