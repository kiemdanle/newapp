import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const adminReportTargetSchema = z.enum(['review', 'user', 'product']);
export const adminReportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export const adminReportReasonSchema = z.enum(['spam', 'abuse', 'incorrect', 'other']);

export const adminReportRowSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  targetType: adminReportTargetSchema,
  targetId: z.string().uuid(),
  reason: adminReportReasonSchema,
  body: z.string().nullable(),
  status: adminReportStatusSchema,
  createdAt: z.string().datetime(),
  targetPreview: z.record(z.unknown()).nullable(),
});

export const adminReportsQuerySchema = cursorQuerySchema.extend({
  status: adminReportStatusSchema.optional(),
  targetType: adminReportTargetSchema.optional(),
});

export const adminReportsListSchema = cursorPageSchema(adminReportRowSchema);

export const adminReportResolveSchema = z.object({
  action: z.enum(['hide', 'delete', 'dismiss', 'ban']),
  notes: z.string().optional(),
});
