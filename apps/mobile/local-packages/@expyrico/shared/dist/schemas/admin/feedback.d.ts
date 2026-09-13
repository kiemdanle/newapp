import { z } from 'zod';
export declare const adminFeedbackQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["open", "in_progress", "replied", "resolved", "closed"]>>;
    type: z.ZodOptional<z.ZodEnum<["bug", "suggestion", "feedback"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "open" | "resolved" | "closed" | "in_progress" | "replied" | undefined;
    type?: "bug" | "suggestion" | "feedback" | undefined;
    cursor?: string | undefined;
    search?: string | undefined;
}, {
    status?: "open" | "resolved" | "closed" | "in_progress" | "replied" | undefined;
    type?: "bug" | "suggestion" | "feedback" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    search?: string | undefined;
}>;
export type AdminFeedbackQuery = z.infer<typeof adminFeedbackQuerySchema>;
export declare const adminFeedbackRowSchema: z.ZodObject<{
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
        platform: "android" | "ios" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    }, {
        platform: "android" | "ios" | "web";
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
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodString;
        avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null | undefined;
    }, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null | undefined;
    }>;
    resolver: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    }, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    }>>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        url?: string | undefined;
        ticketId?: string | null | undefined;
    }, {
        id: string;
        createdAt: string;
        uploaderId: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        url?: string | undefined;
        ticketId?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null | undefined;
    };
    id: string;
    status: "open" | "resolved" | "closed" | "in_progress" | "replied";
    createdAt: string;
    updatedAt: string;
    type: "bug" | "suggestion" | "feedback";
    description: string;
    title: string;
    userId: string;
    deviceInfo?: {
        platform: "android" | "ios" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | null | undefined;
    resolvedBy?: string | null | undefined;
    resolvedAt?: string | null | undefined;
    resolutionNotes?: string | null | undefined;
    attachmentsCount?: number | undefined;
    messagesCount?: number | undefined;
    attachments?: {
        id: string;
        createdAt: string;
        uploaderId: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        url?: string | undefined;
        ticketId?: string | null | undefined;
    }[] | undefined;
    resolver?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null | undefined;
}, {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null | undefined;
    };
    id: string;
    status: "open" | "resolved" | "closed" | "in_progress" | "replied";
    createdAt: string;
    updatedAt: string;
    type: "bug" | "suggestion" | "feedback";
    description: string;
    title: string;
    userId: string;
    deviceInfo?: {
        platform: "android" | "ios" | "web";
        osVersion: string;
        appVersion: string;
        deviceModel?: string | undefined;
    } | null | undefined;
    resolvedBy?: string | null | undefined;
    resolvedAt?: string | null | undefined;
    resolutionNotes?: string | null | undefined;
    attachmentsCount?: number | undefined;
    messagesCount?: number | undefined;
    attachments?: {
        id: string;
        createdAt: string;
        uploaderId: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        url?: string | undefined;
        ticketId?: string | null | undefined;
    }[] | undefined;
    resolver?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null | undefined;
}>;
export type AdminFeedbackRow = z.infer<typeof adminFeedbackRowSchema>;
export declare const adminFeedbackListPageSchema: z.ZodObject<{
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
            platform: "android" | "ios" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        }, {
            platform: "android" | "ios" | "web";
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
        user: z.ZodObject<{
            id: z.ZodString;
            email: z.ZodString;
            firstName: z.ZodString;
            lastName: z.ZodString;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl?: string | null | undefined;
        }, {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl?: string | null | undefined;
        }>;
        resolver: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            email: z.ZodString;
            firstName: z.ZodString;
            lastName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        }, {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        }>>>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
            url?: string | undefined;
            ticketId?: string | null | undefined;
        }, {
            id: string;
            createdAt: string;
            uploaderId: string;
            fileName: string;
            mimeType: string;
            fileSizeBytes: number;
            storageKey: string;
            url?: string | undefined;
            ticketId?: string | null | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl?: string | null | undefined;
        };
        id: string;
        status: "open" | "resolved" | "closed" | "in_progress" | "replied";
        createdAt: string;
        updatedAt: string;
        type: "bug" | "suggestion" | "feedback";
        description: string;
        title: string;
        userId: string;
        deviceInfo?: {
            platform: "android" | "ios" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedBy?: string | null | undefined;
        resolvedAt?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
        attachments?: {
            id: string;
            createdAt: string;
            uploaderId: string;
            fileName: string;
            mimeType: string;
            fileSizeBytes: number;
            storageKey: string;
            url?: string | undefined;
            ticketId?: string | null | undefined;
        }[] | undefined;
        resolver?: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        } | null | undefined;
    }, {
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl?: string | null | undefined;
        };
        id: string;
        status: "open" | "resolved" | "closed" | "in_progress" | "replied";
        createdAt: string;
        updatedAt: string;
        type: "bug" | "suggestion" | "feedback";
        description: string;
        title: string;
        userId: string;
        deviceInfo?: {
            platform: "android" | "ios" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedBy?: string | null | undefined;
        resolvedAt?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
        attachments?: {
            id: string;
            createdAt: string;
            uploaderId: string;
            fileName: string;
            mimeType: string;
            fileSizeBytes: number;
            storageKey: string;
            url?: string | undefined;
            ticketId?: string | null | undefined;
        }[] | undefined;
        resolver?: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        } | null | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl?: string | null | undefined;
        };
        id: string;
        status: "open" | "resolved" | "closed" | "in_progress" | "replied";
        createdAt: string;
        updatedAt: string;
        type: "bug" | "suggestion" | "feedback";
        description: string;
        title: string;
        userId: string;
        deviceInfo?: {
            platform: "android" | "ios" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedBy?: string | null | undefined;
        resolvedAt?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
        attachments?: {
            id: string;
            createdAt: string;
            uploaderId: string;
            fileName: string;
            mimeType: string;
            fileSizeBytes: number;
            storageKey: string;
            url?: string | undefined;
            ticketId?: string | null | undefined;
        }[] | undefined;
        resolver?: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        } | null | undefined;
    }[];
    nextCursor: string | null;
}, {
    items: {
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl?: string | null | undefined;
        };
        id: string;
        status: "open" | "resolved" | "closed" | "in_progress" | "replied";
        createdAt: string;
        updatedAt: string;
        type: "bug" | "suggestion" | "feedback";
        description: string;
        title: string;
        userId: string;
        deviceInfo?: {
            platform: "android" | "ios" | "web";
            osVersion: string;
            appVersion: string;
            deviceModel?: string | undefined;
        } | null | undefined;
        resolvedBy?: string | null | undefined;
        resolvedAt?: string | null | undefined;
        resolutionNotes?: string | null | undefined;
        attachmentsCount?: number | undefined;
        messagesCount?: number | undefined;
        attachments?: {
            id: string;
            createdAt: string;
            uploaderId: string;
            fileName: string;
            mimeType: string;
            fileSizeBytes: number;
            storageKey: string;
            url?: string | undefined;
            ticketId?: string | null | undefined;
        }[] | undefined;
        resolver?: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        } | null | undefined;
    }[];
    nextCursor: string | null;
}>;
export type AdminFeedbackListPage = z.infer<typeof adminFeedbackListPageSchema>;
export declare const adminFeedbackCountsSchema: z.ZodObject<{
    total: z.ZodNumber;
    open: z.ZodNumber;
    inProgress: z.ZodNumber;
    replied: z.ZodNumber;
    resolved: z.ZodNumber;
    closed: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    open: number;
    resolved: number;
    total: number;
    closed: number;
    replied: number;
    inProgress: number;
}, {
    open: number;
    resolved: number;
    total: number;
    closed: number;
    replied: number;
    inProgress: number;
}>;
export type AdminFeedbackCounts = z.infer<typeof adminFeedbackCountsSchema>;
//# sourceMappingURL=feedback.d.ts.map