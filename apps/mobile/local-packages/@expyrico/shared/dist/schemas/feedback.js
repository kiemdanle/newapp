import { z } from 'zod';
export const feedbackTypeSchema = z.enum(['bug', 'suggestion', 'feedback']);
export const feedbackStatusSchema = z.enum(['open', 'in_progress', 'replied', 'resolved', 'closed']);
export const feedbackSenderTypeSchema = z.enum(['user', 'admin']);
export const feedbackDeviceInfoSchema = z.object({
    platform: z.enum(['ios', 'android', 'web']),
    osVersion: z.string().max(50),
    appVersion: z.string().max(50),
    deviceModel: z.string().max(100).optional(),
});
export const feedbackAttachmentSchema = z.object({
    id: z.string().uuid(),
    ticketId: z.string().uuid().nullable().optional(),
    uploaderId: z.string().uuid(),
    fileName: z.string(),
    mimeType: z.string(),
    fileSizeBytes: z.number().int(),
    storageKey: z.string(),
    url: z.string().optional(),
    createdAt: z.string().datetime(),
});
export const feedbackMessageSchema = z.object({
    id: z.string().uuid(),
    ticketId: z.string().uuid(),
    senderType: feedbackSenderTypeSchema,
    senderUserId: z.string().uuid(),
    message: z.string(),
    createdAt: z.string().datetime(),
});
export const feedbackTicketSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    type: feedbackTypeSchema,
    title: z.string(),
    description: z.string(),
    status: feedbackStatusSchema,
    deviceInfo: feedbackDeviceInfoSchema.nullable().optional(),
    resolvedAt: z.string().datetime().nullable().optional(),
    resolvedBy: z.string().uuid().nullable().optional(),
    resolutionNotes: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    attachmentsCount: z.number().int().optional(),
    messagesCount: z.number().int().optional(),
});
export const feedbackTicketDetailSchema = feedbackTicketSchema.extend({
    attachments: z.array(feedbackAttachmentSchema),
    messages: z.array(feedbackMessageSchema),
});
export const createFeedbackTicketSchema = z.object({
    type: feedbackTypeSchema,
    title: z
        .string()
        .trim()
        .min(3, 'Title must be at least 3 characters')
        .max(120, 'Title cannot exceed 120 characters'),
    description: z
        .string()
        .trim()
        .min(10, 'Description must be at least 10 characters')
        .max(3000, 'Description cannot exceed 3000 characters'),
    attachmentIds: z.array(z.string().uuid()).max(5, 'Maximum 5 attachments allowed').default([]),
    deviceInfo: feedbackDeviceInfoSchema.optional(),
});
export const feedbackReplySchema = z.object({
    message: z
        .string()
        .trim()
        .min(1, 'Message cannot be empty')
        .max(3000, 'Message cannot exceed 3000 characters'),
});
export const updateFeedbackStatusSchema = z.object({
    status: feedbackStatusSchema,
    resolutionNotes: z.string().trim().max(1000).optional(),
});
export const feedbackListQuerySchema = z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: feedbackStatusSchema.optional(),
    type: feedbackTypeSchema.optional(),
});
export const feedbackListPageSchema = z.object({
    items: z.array(feedbackTicketSchema),
    nextCursor: z.string().uuid().nullable(),
});
//# sourceMappingURL=feedback.js.map