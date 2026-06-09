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

export const notificationTemplateSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  title: z.string(),
  body: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const notificationTemplatePatchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
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

export const adminInviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
