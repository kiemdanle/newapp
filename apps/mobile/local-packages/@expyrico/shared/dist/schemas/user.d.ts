import { z } from 'zod';
export declare const userRoleSchema: z.ZodEnum<["user", "admin"]>;
export declare const userStatusSchema: z.ZodEnum<["active", "suspended", "deleted"]>;
export declare const themePreferenceSchema: z.ZodEnum<["expyrico", "bento", "clay", "material"]>;
export declare const userSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    emailVerified: z.ZodBoolean;
    firstName: z.ZodString;
    lastName: z.ZodString;
    country: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<["user", "admin"]>;
    status: z.ZodEnum<["active", "suspended", "deleted"]>;
    themePreference: z.ZodEnum<["expyrico", "bento", "clay", "material"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    emailVerified: boolean;
    firstName: string;
    lastName: string;
    country: string | null;
    avatarUrl: string | null;
    role: "user" | "admin";
    status: "active" | "suspended" | "deleted";
    themePreference: "expyrico" | "bento" | "clay" | "material";
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    email: string;
    emailVerified: boolean;
    firstName: string;
    lastName: string;
    country: string | null;
    avatarUrl: string | null;
    role: "user" | "admin";
    status: "active" | "suspended" | "deleted";
    themePreference: "expyrico" | "bento" | "clay" | "material";
    createdAt: string;
    updatedAt: string;
}>;
export type User = z.infer<typeof userSchema>;
export declare const updateProfileSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    themePreference: z.ZodOptional<z.ZodEnum<["expyrico", "bento", "clay", "material"]>>;
}, "strip", z.ZodTypeAny, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    country?: string | undefined;
    avatarUrl?: string | null | undefined;
    themePreference?: "expyrico" | "bento" | "clay" | "material" | undefined;
}, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    country?: string | undefined;
    avatarUrl?: string | null | undefined;
    themePreference?: "expyrico" | "bento" | "clay" | "material" | undefined;
}>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export declare const meUsageResponseSchema: z.ZodObject<{
    itemCount: z.ZodNumber;
    itemLimit: z.ZodNumber;
    readOnly: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    itemCount: number;
    itemLimit: number;
    readOnly: boolean;
}, {
    itemCount: number;
    itemLimit: number;
    readOnly: boolean;
}>;
export type MeUsageResponse = z.infer<typeof meUsageResponseSchema>;
export declare const countrySuggestionSchema: z.ZodObject<{
    country: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    country: string | null;
}, {
    country: string | null;
}>;
export type CountrySuggestion = z.infer<typeof countrySuggestionSchema>;
//# sourceMappingURL=user.d.ts.map