import { z } from 'zod';
export const userRoleSchema = z.enum(['user', 'admin']);
export const userStatusSchema = z.enum(['active', 'suspended', 'deleted']);
export const themePreferenceSchema = z.enum(['expyrico', 'bento', 'clay', 'material']);
export const userSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    emailVerified: z.boolean(),
    firstName: z.string(),
    lastName: z.string(),
    address: z.string().nullable().default(null),
    country: z.string().length(2).nullable(),
    avatarUrl: z.string().url().nullable(),
    hasPassword: z.boolean().default(false),
    role: userRoleSchema,
    status: userStatusSchema,
    themePreference: themePreferenceSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const updateProfileSchema = z.object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    address: z.string().trim().max(255).nullable().optional(),
    country: z.string().length(2).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    themePreference: themePreferenceSchema.optional(),
});
export const meUsageResponseSchema = z.object({
    itemCount: z.number().int().min(0),
    itemLimit: z.number().int().positive(),
    readOnly: z.boolean(),
});
export const countrySuggestionSchema = z.object({
    country: z.string().length(2).nullable(),
});
export const menuButtonPositionSchema = z
    .object({
    x: z.number().min(0).max(4000),
    y: z.number().min(0).max(4000),
})
    .strict();
export const userUiPreferencesSchema = z
    .object({
    defaultPantryScope: z.enum(['personal', 'household']).optional(),
    defaultHouseholdId: z.string().uuid().nullable().optional(),
    menuButtonPosition: menuButtonPositionSchema.optional(),
})
    .strict();
export const userPreferencesPatchSchema = z
    .object({
    notificationPreferences: z.record(z.unknown()).optional(),
    uiPreferences: userUiPreferencesSchema.optional(),
})
    .strict();
export const userPreferencesResponseSchema = z.object({
    notificationPreferences: z.record(z.unknown()).nullable().default(null),
    uiPreferences: userUiPreferencesSchema.nullable().default(null),
});
//# sourceMappingURL=user.js.map