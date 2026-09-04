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

export type User = z.infer<typeof userSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  address: z.string().trim().max(255).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  themePreference: themePreferenceSchema.optional(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export const meUsageResponseSchema = z.object({
  itemCount: z.number().int().min(0),
  itemLimit: z.number().int().positive(),
  readOnly: z.boolean(),
});
export type MeUsageResponse = z.infer<typeof meUsageResponseSchema>;

export const countrySuggestionSchema = z.object({
  country: z.string().length(2).nullable(),
});
export type CountrySuggestion = z.infer<typeof countrySuggestionSchema>;

export const menuButtonPositionSchema = z
  .object({
    x: z.number().min(0).max(4000),
    y: z.number().min(0).max(4000),
  })
  .strict();
export type MenuButtonPosition = z.infer<typeof menuButtonPositionSchema>;

export const userUiPreferencesSchema = z
  .object({
    defaultPantryScope: z.enum(['personal', 'household']).optional(),
    defaultHouseholdId: z.string().uuid().nullable().optional(),
    menuButtonPosition: menuButtonPositionSchema.optional(),
  })
  .strict();
export type UserUiPreferences = z.infer<typeof userUiPreferencesSchema>;

export const userPreferencesPatchSchema = z
  .object({
    notificationPreferences: z.record(z.unknown()).optional(),
    uiPreferences: userUiPreferencesSchema.optional(),
  })
  .strict();
export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>;

export const userPreferencesResponseSchema = z.object({
  notificationPreferences: z.record(z.unknown()).nullable().default(null),
  uiPreferences: userUiPreferencesSchema.nullable().default(null),
});
export type UserPreferencesResponse = z.infer<typeof userPreferencesResponseSchema>;
