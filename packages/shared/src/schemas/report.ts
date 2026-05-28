import { z } from 'zod';

export const reportTargetTypeSchema = z.enum(['review', 'user', 'product']);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export const reportReasonSchema = z.enum(['spam', 'abuse', 'incorrect', 'other']);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export const reportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  body: z.string().nullable(),
  status: reportStatusSchema,
  createdAt: z.string().datetime(),
});
export type Report = z.infer<typeof reportSchema>;

export const reportCreateSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  body: z.string().trim().max(1000).optional(),
});
export type ReportCreate = z.infer<typeof reportCreateSchema>;
