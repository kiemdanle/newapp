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
    address: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    country: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodString>;
    hasPassword: z.ZodDefault<z.ZodBoolean>;
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
    address: string | null;
    country: string | null;
    avatarUrl: string | null;
    hasPassword: boolean;
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
    address?: string | null | undefined;
    hasPassword?: boolean | undefined;
}>;
export type User = z.infer<typeof userSchema>;
export declare const updateProfileSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    themePreference: z.ZodOptional<z.ZodEnum<["expyrico", "bento", "clay", "material"]>>;
}, "strip", z.ZodTypeAny, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    address?: string | null | undefined;
    country?: string | null | undefined;
    avatarUrl?: string | null | undefined;
    themePreference?: "expyrico" | "bento" | "clay" | "material" | undefined;
}, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    address?: string | null | undefined;
    country?: string | null | undefined;
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
export declare const menuButtonPositionSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}>;
export type MenuButtonPosition = z.infer<typeof menuButtonPositionSchema>;
export declare const userUiPreferencesSchema: z.ZodObject<{
    defaultPantryScope: z.ZodOptional<z.ZodEnum<["personal", "household"]>>;
    defaultHouseholdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    menuButtonPosition: z.ZodOptional<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>>;
}, "strict", z.ZodTypeAny, {
    defaultPantryScope?: "personal" | "household" | undefined;
    defaultHouseholdId?: string | null | undefined;
    menuButtonPosition?: {
        x: number;
        y: number;
    } | undefined;
}, {
    defaultPantryScope?: "personal" | "household" | undefined;
    defaultHouseholdId?: string | null | undefined;
    menuButtonPosition?: {
        x: number;
        y: number;
    } | undefined;
}>;
export type UserUiPreferences = z.infer<typeof userUiPreferencesSchema>;
export declare const userPreferencesPatchSchema: z.ZodObject<{
    notificationPreferences: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    uiPreferences: z.ZodOptional<z.ZodObject<{
        defaultPantryScope: z.ZodOptional<z.ZodEnum<["personal", "household"]>>;
        defaultHouseholdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        menuButtonPosition: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
    }, "strict", z.ZodTypeAny, {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    }, {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    notificationPreferences?: Record<string, unknown> | undefined;
    uiPreferences?: {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    } | undefined;
}, {
    notificationPreferences?: Record<string, unknown> | undefined;
    uiPreferences?: {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    } | undefined;
}>;
export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>;
export declare const userPreferencesResponseSchema: z.ZodObject<{
    notificationPreferences: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    uiPreferences: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        defaultPantryScope: z.ZodOptional<z.ZodEnum<["personal", "household"]>>;
        defaultHouseholdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        menuButtonPosition: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
    }, "strict", z.ZodTypeAny, {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    }, {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    notificationPreferences: Record<string, unknown> | null;
    uiPreferences: {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    } | null;
}, {
    notificationPreferences?: Record<string, unknown> | null | undefined;
    uiPreferences?: {
        defaultPantryScope?: "personal" | "household" | undefined;
        defaultHouseholdId?: string | null | undefined;
        menuButtonPosition?: {
            x: number;
            y: number;
        } | undefined;
    } | null | undefined;
}>;
export type UserPreferencesResponse = z.infer<typeof userPreferencesResponseSchema>;
//# sourceMappingURL=user.d.ts.map