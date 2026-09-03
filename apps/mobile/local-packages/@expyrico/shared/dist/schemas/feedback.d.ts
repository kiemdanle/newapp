import { z } from 'zod';
export declare const feedbackTypeSchema: z.ZodEnum<["bug", "suggestion", "feedback"]>;
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;
export declare const feedbackStatusSchema: z.ZodEnum<["open", "in_progress", "replied", "resolved", "closed"]>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export declare const feedbackSenderTypeSchema: z.ZodEnum<["user", "admin"]>;
export type FeedbackSenderType = z.infer<typeof feedbackSenderTypeSchema>;
export declare const feedbackDeviceInfoSchema: z.ZodObject<{
    platform: z.ZodEnum<["ios", "android", "web"]>;
    osVersion: z.ZodString;
    appVersion: z.ZodString;
    deviceModel: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    platform: "ios" | "android" | "web";
    osVersion: string;
    appVersion: string;
    deviceModel?: string | undefined;
}, {
    platform: "ios" | "android" | "web";
    osVersion: string;
    appVersion: string;
    deviceModel?: string | undefined;
}>;
export type FeedbackDeviceInfo = z.infer<typeof feedbackDeviceInfoSchema>;
export declare const feedbackAttachmentSchema: z.ZodObject<{
    id: z.ZodString;
    ticketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    uploaderId: z.ZodString;
    fileName: z.ZodString;
    mimeType: z.ZodString;
    fileSizeBytes: z.ZodNumber;
    storageKey: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    uploaderId: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey: string;
    ticketId?: string | null | undefined;
    url?: string | undefined;
}, {
    id: string;
    createdAt: string;
    uploaderId: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey: string;
    ticketId?: string | null | undefined;
    url?: string | undefined;
}>;
export type FeedbackAttachment = z.infer<typeof feedbackAttachmentSchema>;
export declare const feedbackMessageSchema: z.ZodObject<{
    id: z.ZodString;
    ticketId: z.ZodString;
    senderType: z.ZodEnum<["user", "admin"]>;
    senderUserId: z.ZodString;
    message: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    id: string;
    createdAt: string;
    ticketId: string;
    senderType: "user" | "admin";
    senderUserId: string;
}, {
    message: string;
    id: string;
    createdAt: string;
    ticketId: string;
    senderType: "user" | "admin";
    senderUserId: string;
}>;
export type FeedbackMessage = z.infer<typeof feedbackMessageSchema>;
export declare const feedbackTicketSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<["bug", "suggestion", "feedback"]>;
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodEnum<["open", "in_progress", "replied", "resolved", "closed"]>;
    deviceInfo: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        platform: z.ZodEnum<["ios", "android", "web"]>;
        osVersion: z.ZodString;
        appVersion: z.ZodString;
        deviceModel: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    }, {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    }>>>;
    resolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    resolvedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    resolutionNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    attachmentsCount: z.ZodOptional<z.ZodNumber>;
    messagesCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "in_progress" | "replied" | "resolved" | "closed";
    type: "bug" | "suggestion" | "feedback";
    title: string;
    id: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    deviceInfo?: {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | null | undefined;
    resolvedAt?: string | null | undefined;
    resolvedBy?: string | null | undefined;
    resolutionNotes?: string | null | undefined;
    attachmentsCount?: number | undefined;
    messagesCount?: number | undefined;
}, {
    status: "open" | "in_progress" | "replied" | "resolved" | "closed";
    type: "bug" | "suggestion" | "feedback";
    title: string;
    id: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    deviceInfo?: {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | null | undefined;
    resolvedAt?: string | null | undefined;
    resolvedBy?: string | null | undefined;
    resolutionNotes?: string | null | undefined;
    attachmentsCount?: number | undefined;
    messagesCount?: number | undefined;
}>;
export type FeedbackTicket = z.infer<typeof feedbackTicketSchema>;
export declare const feedbackTicketDetailSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<["bug", "suggestion", "feedback"]>;
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodEnum<["open", "in_progress", "replied", "resolved", "closed"]>;
    deviceInfo: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        platform: z.ZodEnum<["ios", "android", "web"]>;
        osVersion: z.ZodString;
        appVersion: z.ZodString;
        deviceModel: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    }, {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    }>>>;
    resolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    resolvedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    resolutionNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    attachmentsCount: z.ZodOptional<z.ZodNumber>;
    messagesCount: z.ZodOptional<z.ZodNumber>;
} & {
    attachments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ticketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        uploaderId: z.ZodString;
        fileName: z.ZodString;
        mimeType: z.ZodString;
        fileSizeBytes: z.ZodNumber;
        storageKey: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        uploaderId: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        ticketId?: string | null | undefined;
        url?: string | undefined;
    }, {
        id: string;
        createdAt: string;
        uploaderId: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        ticketId?: string | null | undefined;
        url?: string | undefined;
    }>, "many">;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ticketId: z.ZodString;
        senderType: z.ZodEnum<["user", "admin"]>;
        senderUserId: z.ZodString;
        message: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        id: string;
        createdAt: string;
        ticketId: string;
        senderType: "user" | "admin";
        senderUserId: string;
    }, {
        message: string;
        id: string;
        createdAt: string;
        ticketId: string;
        senderType: "user" | "admin";
        senderUserId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "open" | "in_progress" | "replied" | "resolved" | "closed";
    type: "bug" | "suggestion" | "feedback";
    title: string;
    id: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    attachments: {
        id: string;
        createdAt: string;
        uploaderId: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        ticketId?: string | null | undefined;
        url?: string | undefined;
    }[];
    messages: {
        message: string;
        id: string;
        createdAt: string;
        ticketId: string;
        senderType: "user" | "admin";
        senderUserId: string;
    }[];
    deviceInfo?: {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | null | undefined;
    resolvedAt?: string | null | undefined;
    resolvedBy?: string | null | undefined;
    resolutionNotes?: string | null | undefined;
    attachmentsCount?: number | undefined;
    messagesCount?: number | undefined;
}, {
    status: "open" | "in_progress" | "replied" | "resolved" | "closed";
    type: "bug" | "suggestion" | "feedback";
    title: string;
    id: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    attachments: {
        id: string;
        createdAt: string;
        uploaderId: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        ticketId?: string | null | undefined;
        url?: string | undefined;
    }[];
    messages: {
        message: string;
        id: string;
        createdAt: string;
        ticketId: string;
        senderType: "user" | "admin";
        senderUserId: string;
    }[];
    deviceInfo?: {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | null | undefined;
    resolvedAt?: string | null | undefined;
    resolvedBy?: string | null | undefined;
    resolutionNotes?: string | null | undefined;
    attachmentsCount?: number | undefined;
    messagesCount?: number | undefined;
}>;
export type FeedbackTicketDetail = z.infer<typeof feedbackTicketDetailSchema>;
export declare const createFeedbackTicketSchema: z.ZodObject<{
    type: z.ZodEnum<["bug", "suggestion", "feedback"]>;
    title: z.ZodString;
    description: z.ZodString;
    attachmentIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    deviceInfo: z.ZodOptional<z.ZodObject<{
        platform: z.ZodEnum<["ios", "android", "web"]>;
        osVersion: z.ZodString;
        appVersion: z.ZodString;
        deviceModel: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    }, {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "bug" | "suggestion" | "feedback";
    title: string;
    description: string;
    attachmentIds: string[];
    deviceInfo?: {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | undefined;
}, {
    type: "bug" | "suggestion" | "feedback";
    title: string;
    description: string;
    deviceInfo?: {
        platform: "ios" | "android" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | undefined;
    attachmentIds?: string[] | undefined;
}>;
export type CreateFeedbackTicketInput = z.infer<typeof createFeedbackTicketSchema>;
export declare const feedbackReplySchema: z.ZodObject<{
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message: string;
}>;
export type FeedbackReplyInput = z.infer<typeof feedbackReplySchema>;
export declare const updateFeedbackStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["open", "in_progress", "replied", "resolved", "closed"]>;
    resolutionNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "in_progress" | "replied" | "resolved" | "closed";
    resolutionNotes?: string | undefined;
}, {
    status: "open" | "in_progress" | "replied" | "resolved" | "closed";
    resolutionNotes?: string | undefined;
}>;
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>;
export declare const feedbackListQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["open", "in_progress", "replied", "resolved", "closed"]>>;
    type: z.ZodOptional<z.ZodEnum<["bug", "suggestion", "feedback"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "open" | "in_progress" | "replied" | "resolved" | "closed" | undefined;
    type?: "bug" | "suggestion" | "feedback" | undefined;
    cursor?: string | undefined;
}, {
    status?: "open" | "in_progress" | "replied" | "resolved" | "closed" | undefined;
    type?: "bug" | "suggestion" | "feedback" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type FeedbackListQuery = z.infer<typeof feedbackListQuerySchema>;
export declare const feedbackListPageSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        type: z.ZodEnum<["bug", "suggestion", "feedback"]>;
        title: z.ZodString;
        description: z.ZodString;
        status: z.ZodEnum<["open", "in_progress", "replied", "resolved", "closed"]>;
        deviceInfo: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            platform: z.ZodEnum<["ios", "android", "web"]>;
            osVersion: z.ZodString;
            appVersion: z.ZodString;
            deviceModel: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            platform: "ios" | "android" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        }, {
            platform: "ios" | "android" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        }>>>;
        resolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        resolvedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        resolutionNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        attachmentsCount: z.ZodOptional<z.ZodNumber>;
        messagesCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "in_progress" | "replied" | "resolved" | "closed";
        type: "bug" | "suggestion" | "feedback";
        title: string;
        id: string;
        description: string;
        createdAt: string;
        updatedAt: string;
        userId: string;
        deviceInfo?: {
            platform: "ios" | "android" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedAt?: string | null | undefined;
        resolvedBy?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
    }, {
        status: "open" | "in_progress" | "replied" | "resolved" | "closed";
        type: "bug" | "suggestion" | "feedback";
        title: string;
        id: string;
        description: string;
        createdAt: string;
        updatedAt: string;
        userId: string;
        deviceInfo?: {
            platform: "ios" | "android" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedAt?: string | null | undefined;
        resolvedBy?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "open" | "in_progress" | "replied" | "resolved" | "closed";
        type: "bug" | "suggestion" | "feedback";
        title: string;
        id: string;
        description: string;
        createdAt: string;
        updatedAt: string;
        userId: string;
        deviceInfo?: {
            platform: "ios" | "android" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedAt?: string | null | undefined;
        resolvedBy?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
    }[];
    nextCursor: string | null;
}, {
    items: {
        status: "open" | "in_progress" | "replied" | "resolved" | "closed";
        type: "bug" | "suggestion" | "feedback";
        title: string;
        id: string;
        description: string;
        createdAt: string;
        updatedAt: string;
        userId: string;
        deviceInfo?: {
            platform: "ios" | "android" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedAt?: string | null | undefined;
        resolvedBy?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
    }[];
    nextCursor: string | null;
}>;
export type FeedbackListPage = z.infer<typeof feedbackListPageSchema>;
//# sourceMappingURL=feedback.d.ts.map