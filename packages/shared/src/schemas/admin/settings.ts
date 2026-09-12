import { z } from 'zod';

export const featureFlagsSchema = z.object({
  reviewsEnabled: z.boolean(),
  passkeysEnabled: z.boolean(),
  ocrEnabled: z.boolean(),
  maintenanceBanner: z.string().nullable(),
});

export const moderationSettingsSchema = z.object({
  autoHideReportThreshold: z.number().int().min(1).max(100),
  profanitySensitivity: z.enum(['low', 'medium', 'high']),
});

// Setting key `product_creation`. `internal` means existing admin users plus an
// environment-managed user-ID allowlist. The expand migration inserts `{ mode: 'off' }`
// idempotently before any reader starts.
export const productCreationSettingsSchema = z.object({
  mode: z.enum(['off', 'internal', 'all']),
  requireApproval: z.boolean().default(false),
});
export type ProductCreationSettings = z.infer<typeof productCreationSettingsSchema>;

export const notificationTemplateSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  title: z.string(),
  body: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const notificationTemplatePatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(500).optional(),
  enabled: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'no fields' });

export const adminRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  totpEnabledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AdminRow = z.infer<typeof adminRowSchema>;
export const adminInviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const unitStringSchema = z
  .string()
  .trim()
  .min(1, 'Unit cannot be empty')
  .max(16, 'Unit cannot exceed 16 characters')
  .regex(/^[a-zA-Z0-9\s/°\-_.]+$/, 'Unit contains invalid characters');

export const pantryUnitsSettingsSchema = z.object({
  topUnits: z
    .array(unitStringSchema)
    .length(4, 'Exactly 4 top units must be specified')
    .refine(
      (units) => new Set(units.map((u) => u.toLowerCase())).size === 4,
      'Top units must all be distinct',
    )
    .default(['pcs', 'pack', 'can', 'bottle']),
});
export type PantryUnitsSettings = z.infer<typeof pantryUnitsSettingsSchema>;

export const photoLimitsSettingsSchema = z.object({
  maxProductPhotos: z
    .number()
    .int('Maximum product photos must be an integer')
    .min(1, 'At least 1 product photo must be allowed')
    .max(20, 'Maximum allowed product photos is 20')
    .default(5),
  maxPantryItemPhotos: z
    .number()
    .int('Maximum pantry item photos must be an integer')
    .min(1, 'At least 1 pantry item photo must be allowed')
    .max(20, 'Maximum allowed pantry item photos is 20')
    .default(5),
});
export type PhotoLimitsSettings = z.infer<typeof photoLimitsSettingsSchema>;

export const DEFAULT_PHOTO_LIMITS: PhotoLimitsSettings = {
  maxProductPhotos: 5,
  maxPantryItemPhotos: 5,
};

export const PHOTO_COMPRESSION_CONFIG = {
  maxDimensionPx: 1920,
  qualitySteps: [0.82, 0.72, 0.70] as const,
  qualityFloor: 0.70,
  maxFileBytes: 1 * 1024 * 1024, // 1,048,576 bytes (1 MB)
} as const;

export const USER_PANTRY_TIERS = ['free', 'pro', 'supporter'] as const;
export type UserPantryTier = (typeof USER_PANTRY_TIERS)[number];

export const pantryLimitsSettingsSchema = z.object({
  defaultUserPantryLimit: z
    .number()
    .int('Pantry limit must be an integer')
    .min(1, 'At least 1 pantry item must be allowed')
    .max(10000, 'Maximum allowed pantry items is 10,000')
    .default(50),
  tierLimits: z
    .record(z.string(), z.number().int().min(1).max(10000))
    .optional()
    .default({
      free: 50,
      pro: 500,
    }),
});
export type PantryLimitsSettings = z.infer<typeof pantryLimitsSettingsSchema>;

export const pantryLimitsPatchSchema = z
  .object({
    defaultUserPantryLimit: z.number().int().min(1).max(10000).optional(),
    tierLimits: z.record(z.string(), z.number().int().min(1).max(10000)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type PantryLimitsPatch = z.infer<typeof pantryLimitsPatchSchema>;

export const DEFAULT_PANTRY_LIMITS: PantryLimitsSettings = {
  defaultUserPantryLimit: 50,
  tierLimits: {
    free: 50,
    pro: 500,
  },
};
