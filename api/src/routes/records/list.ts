import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordListResponseSchema, recordStatusSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiRecord } from '../../services/records/repository.js';

const querySchema = z.object({
  status: recordStatusSchema.optional(),
  sort: z.enum(['expiry', 'created']).default('expiry'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface Cursor {
  expiryDate: string;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

function decodeCursor(s: string): Cursor | null {
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor;
  } catch {
    return null;
  }
}

export async function listRecordsRoute(app: FastifyInstance) {
  app.get('/', { onRequest: app.requireAuth }, async (req, reply) => {
    const q = querySchema.parse(req.query);
    const userId = req.user!.id;
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;

    const rows = await getPrisma().record.findMany({
      where: {
        userId,
        ...(q.status ? { status: q.status } : {}),
        ...(cursor
          ? {
              OR: [
                { expiryDate: { gt: new Date(cursor.expiryDate) } },
                {
                  expiryDate: new Date(cursor.expiryDate),
                  id: { gt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy:
        q.sort === 'expiry'
          ? [{ expiryDate: 'asc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }],
      take: q.limit + 1,
    });

    const hasMore = rows.length > q.limit;
    const items = hasMore ? rows.slice(0, q.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ expiryDate: last.expiryDate.toISOString(), id: last.id })
        : null;

    return reply.send(
      recordListResponseSchema.parse({
        items: items.map(toApiRecord),
        nextCursor,
      }),
    );
  });
}
