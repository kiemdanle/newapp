import { z } from 'zod';
export declare const cursorQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const cursorPageSchema: <T extends z.ZodTypeAny>(item: T) => z.ZodObject<{
    items: z.ZodArray<T, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: T["_output"][];
    nextCursor: string | null;
}, {
    items: T["_input"][];
    nextCursor: string | null;
}>;
export declare const auditDiffSchema: z.ZodObject<{
    before: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    after: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
}, {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
}>;
export type CursorQuery = z.infer<typeof cursorQuerySchema>;
export type AuditDiff = z.infer<typeof auditDiffSchema>;
export declare function encodeCursor(createdAt: Date, id: string): string;
export declare function decodeCursor(cursor: string | undefined | null): {
    t: Date;
    i: string;
} | null;
//# sourceMappingURL=common.d.ts.map