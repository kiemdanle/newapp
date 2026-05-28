import { z } from 'zod';

export const userRoleSchema = z.enum(['user', 'admin']);
export const userStatusSchema = z.enum(['active', 'suspended', 'deleted']);
export const themePreferenceSchema = z.enum(['aurora', 'bento', 'clay', 'material']);

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  country: z.string().length(2).nullable(),
  avatarUrl: z.string().url().nullable(),
  role: userRoleSchema,
  status: userStatusSchema,
  themePreference: themePreferenceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  country: z.string().length(2).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  themePreference: themePreferenceSchema.optional(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
