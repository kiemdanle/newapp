import { z } from 'zod';
import { feedbackTypeSchema, feedbackStatusSchema, feedbackTicketSchema, feedbackAttachmentSchema, } from '../feedback.js';
export const adminFeedbackQuerySchema = z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: feedbackStatusSchema.optional(),
    type: feedbackTypeSchema.optional(),
    search: z.string().trim().optional(),
});
export const adminFeedbackRowSchema = feedbackTicketSchema.extend({
    user: z.object({
        id: z.string().uuid(),
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        avatarUrl: z.string().nullable().optional(),
    }),
    resolver: z
        .object({
        id: z.string().uuid(),
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
    })
        .nullable()
        .optional(),
    attachments: z.array(feedbackAttachmentSchema).optional(),
});
export const adminFeedbackListPageSchema = z.object({
    items: z.array(adminFeedbackRowSchema),
    nextCursor: z.string().uuid().nullable(),
});
export const adminFeedbackCountsSchema = z.object({
    total: z.number().int(),
    open: z.number().int(),
    inProgress: z.number().int(),
    replied: z.number().int(),
    resolved: z.number().int(),
    closed: z.number().int(),
});
//# sourceMappingURL=feedback.js.map