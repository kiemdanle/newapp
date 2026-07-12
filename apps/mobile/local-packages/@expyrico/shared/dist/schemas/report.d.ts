import { z } from 'zod';
export declare const reportTargetTypeSchema: z.ZodEnum<["review", "user", "product", "deal", "giveaway"]>;
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export declare const reportReasonSchema: z.ZodEnum<["spam", "abuse", "incorrect", "other"]>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export declare const reportStatusSchema: z.ZodEnum<["open", "resolved", "dismissed"]>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export declare const reportSchema: z.ZodObject<{
    id: z.ZodString;
    reporterId: z.ZodString;
    targetType: z.ZodEnum<["review", "user", "product", "deal", "giveaway"]>;
    targetId: z.ZodString;
    reason: z.ZodEnum<["spam", "abuse", "incorrect", "other"]>;
    body: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["open", "resolved", "dismissed"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "open" | "resolved" | "dismissed";
    createdAt: string;
    reason: "spam" | "abuse" | "incorrect" | "other";
    body: string | null;
    reporterId: string;
    targetType: "user" | "product" | "review" | "deal" | "giveaway";
    targetId: string;
}, {
    id: string;
    status: "open" | "resolved" | "dismissed";
    createdAt: string;
    reason: "spam" | "abuse" | "incorrect" | "other";
    body: string | null;
    reporterId: string;
    targetType: "user" | "product" | "review" | "deal" | "giveaway";
    targetId: string;
}>;
export type Report = z.infer<typeof reportSchema>;
export declare const reportCreateSchema: z.ZodObject<{
    targetType: z.ZodEnum<["review", "user", "product", "deal", "giveaway"]>;
    targetId: z.ZodString;
    reason: z.ZodEnum<["spam", "abuse", "incorrect", "other"]>;
    body: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: "spam" | "abuse" | "incorrect" | "other";
    targetType: "user" | "product" | "review" | "deal" | "giveaway";
    targetId: string;
    body?: string | undefined;
}, {
    reason: "spam" | "abuse" | "incorrect" | "other";
    targetType: "user" | "product" | "review" | "deal" | "giveaway";
    targetId: string;
    body?: string | undefined;
}>;
export type ReportCreate = z.infer<typeof reportCreateSchema>;
//# sourceMappingURL=report.d.ts.map