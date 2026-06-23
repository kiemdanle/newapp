import { z } from 'zod';
export const reportTargetTypeSchema = z.enum(['review', 'user', 'product', 'deal', 'giveaway']);
export const reportReasonSchema = z.enum(['spam', 'abuse', 'incorrect', 'other']);
export const reportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
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
export const reportCreateSchema = z.object({
    targetType: reportTargetTypeSchema,
    targetId: z.string().uuid(),
    reason: reportReasonSchema,
    body: z.string().trim().max(1000).optional(),
});
//# sourceMappingURL=report.js.map