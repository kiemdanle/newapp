import { z } from 'zod';
export const cursorQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const cursorPageSchema = (item) => z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
});
export const auditDiffSchema = z.object({
    before: z.record(z.unknown()).nullable(),
    after: z.record(z.unknown()).nullable(),
});
export function encodeCursor(createdAt, id) {
    return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64url');
}
export function decodeCursor(cursor) {
    if (!cursor)
        return null;
    try {
        const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        return { t: new Date(raw.t), i: String(raw.i) };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=common.js.map