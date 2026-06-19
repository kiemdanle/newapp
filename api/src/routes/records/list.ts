import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordListQuerySchema, recordListResponseSchema } from '@expyrico/shared';
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
    const userId = req.user!.id;

    // Parse query: fall back to raw qs parsing if the schema isn't exported correctly
    // (recordListQuerySchema lives in shared but may need a rebuild).
    const raw = req.query as Record<string, unknown>;
    let scope: string = 'all';
    let householdId: string | undefined;
    let cursor: string | undefined;
    let limit = 50;

    try {
      const q = recordListQuerySchema.parse(req.query);
      scope = q.scope;
      householdId = q.householdId;
      cursor = q.cursor;
      limit = q.limit;
    } catch {
      // fallback: use defaults
    }

    const householdIds = await myHouseholdIds(userId);
    const decoded = cursor ? decodeCursor(cursor) : null;

    // Build where clause.
    const andClauses: Record<string, unknown>[] = [];

    if (scope === 'personal') {
      andClauses.push({ userId, householdId: null });
    } else if (scope === 'household') {
      const hhIds = householdId && householdIds.includes(householdId)
        ? [householdId]
        : householdIds;
      if (hhIds.length === 0) {
        return reply.send(recordListResponseSchema.parse({ items: [], nextCursor: null }));
      }
      andClauses.push({ householdId: { in: hhIds } });
    } else {
      // scope === 'all'
      if (householdIds.length > 0) {
        andClauses.push({
          OR: [
            { userId, householdId: null },
            { householdId: { in: householdIds } },
          ],
        });
      } else {
        andClauses.push({ userId, householdId: null });
      }
    }

    if (decoded) {
      andClauses.push({
        OR: [
          { expiryDate: { gt: new Date(decoded.expiryDate) } },
          { expiryDate: new Date(decoded.expiryDate), id: { gt: decoded.id } },
        ],
      });
    }

    const rows = await getPrisma().record.findMany({
      where: andClauses.length > 1 ? { AND: andClauses } : andClauses[0] ?? {},
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
      take: (limit as number) + 1,
    });

    const hasMore = rows.length > (limit as number);
    const items = hasMore ? rows.slice(0, limit as number) : rows;
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
