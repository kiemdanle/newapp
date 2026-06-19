import type { FastifyInstance } from 'fastify';
import { recordListQuerySchema, recordListResponseSchema, recordStatusSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiRecord } from '../../services/records/repository.js';
import { myHouseholdIds } from '../../services/households/permissions.js';

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
    const q = recordListQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;

    // Resolve the caller's household membership for scope filtering.
    const householdIds = await myHouseholdIds(userId);

    // Build the where clause from scope + optional householdId filter.
    const where: Record<string, unknown> = {};

    if (q.scope === 'personal') {
      where.userId = userId;
      where.householdId = null;
    } else if (q.scope === 'household') {
      const hhIds = q.householdId && householdIds.includes(q.householdId)
        ? [q.householdId]
        : householdIds;
      if (hhIds.length === 0) {
        // User has no household memberships — return empty.
        return reply.send(recordListResponseSchema.parse({ items: [], nextCursor: null }));
      }
      where.householdId = { in: hhIds };
    } else {
      // scope === 'all' — personal records + all household records the caller can see.
      where.OR = [
        { userId, householdId: null },
        ...(householdIds.length > 0 ? [{ householdId: { in: householdIds } }] : []),
      ];
    }

    // Add status filter if provided (doesn't conflict with scope).
    // Also apply cursor pagination using the same expiry/id cursor scheme as M1.
    if (cursor) {
      where.OR = (where.OR as Array<Record<string, unknown>> | undefined)
        ? (where.OR as Array<Record<string, unknown>>).map((clause) => ({
            ...clause,
            OR: [
              { expiryDate: { gt: new Date(cursor.expiryDate) } },
              { expiryDate: new Date(cursor.expiryDate), id: { gt: cursor.id } },
            ],
          }))
        : [
            { expiryDate: { gt: new Date(cursor.expiryDate) } },
            { expiryDate: new Date(cursor.expiryDate), id: { gt: cursor.id } },
          ];
    }

    const rows = await getPrisma().record.findMany({
      where: where as any,
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
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
