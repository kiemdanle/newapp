import { z } from 'zod';
export declare const adminReportTargetSchema: z.ZodEnum<["review", "user", "product"]>;
export declare const adminReportStatusSchema: z.ZodEnum<["open", "resolved", "dismissed"]>;
export declare const adminReportReasonSchema: z.ZodEnum<["spam", "abuse", "incorrect", "other"]>;
export declare const adminReportRowSchema: z.ZodObject<{
    id: z.ZodString;
    reporterId: z.ZodString;
    targetType: z.ZodEnum<["review", "user", "product"]>;
    targetId: z.ZodString;
    reason: z.ZodEnum<["spam", "abuse", "incorrect", "other"]>;
    body: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["open", "resolved", "dismissed"]>;
    createdAt: z.ZodString;
    targetPreview: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "open" | "resolved" | "dismissed";
    createdAt: string;
    body: string | null;
    reporterId: string;
    targetType: "user" | "product" | "review";
    targetId: string;
    reason: "spam" | "abuse" | "incorrect" | "other";
    targetPreview: Record<string, unknown> | null;
}, {
    id: string;
    status: "open" | "resolved" | "dismissed";
    createdAt: string;
    body: string | null;
    reporterId: string;
    targetType: "user" | "product" | "review";
    targetId: string;
    reason: "spam" | "abuse" | "incorrect" | "other";
    targetPreview: Record<string, unknown> | null;
}>;
export declare const adminReportsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["open", "resolved", "dismissed"]>>;
    targetType: z.ZodOptional<z.ZodEnum<["review", "user", "product"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "open" | "resolved" | "dismissed" | undefined;
    cursor?: string | undefined;
    targetType?: "user" | "product" | "review" | undefined;
}, {
    status?: "open" | "resolved" | "dismissed" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    targetType?: "user" | "product" | "review" | undefined;
}>;
export declare const adminReportsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reporterId: z.ZodString;
        targetType: z.ZodEnum<["review", "user", "product"]>;
        targetId: z.ZodString;
        reason: z.ZodEnum<["spam", "abuse", "incorrect", "other"]>;
        body: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["open", "resolved", "dismissed"]>;
        createdAt: z.ZodString;
        targetPreview: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "open" | "resolved" | "dismissed";
        createdAt: string;
        body: string | null;
        reporterId: string;
        targetType: "user" | "product" | "review";
        targetId: string;
        reason: "spam" | "abuse" | "incorrect" | "other";
        targetPreview: Record<string, unknown> | null;
    }, {
        id: string;
        status: "open" | "resolved" | "dismissed";
        createdAt: string;
        body: string | null;
        reporterId: string;
        targetType: "user" | "product" | "review";
        targetId: string;
        reason: "spam" | "abuse" | "incorrect" | "other";
        targetPreview: Record<string, unknown> | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "open" | "resolved" | "dismissed";
        createdAt: string;
        body: string | null;
        reporterId: string;
        targetType: "user" | "product" | "review";
        targetId: string;
        reason: "spam" | "abuse" | "incorrect" | "other";
        targetPreview: Record<string, unknown> | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "open" | "resolved" | "dismissed";
        createdAt: string;
        body: string | null;
        reporterId: string;
        targetType: "user" | "product" | "review";
        targetId: string;
        reason: "spam" | "abuse" | "incorrect" | "other";
        targetPreview: Record<string, unknown> | null;
    }[];
    nextCursor: string | null;
}>;
export declare const adminReportResolveSchema: z.ZodObject<{
    action: z.ZodEnum<["hide", "delete", "dismiss", "ban"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "hide" | "delete" | "dismiss" | "ban";
    notes?: string | undefined;
}, {
    action: "hide" | "delete" | "dismiss" | "ban";
    notes?: string | undefined;
}>;
//# sourceMappingURL=reports.d.ts.map