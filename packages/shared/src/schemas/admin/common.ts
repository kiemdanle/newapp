import { z } from 'zod';

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const cursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export const auditDiffSchema = z.object({
  before: z.record(z.unknown()).nullable(),
  after: z.record(z.unknown()).nullable(),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;
export type AuditDiff = z.infer<typeof auditDiffSchema>;

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64url');
}

export function decodeCursor(cursor: string | undefined | null): { t: Date; i: string } | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return { t: new Date(raw.t), i: String(raw.i) };
  } catch {
    return null;
  }
}
