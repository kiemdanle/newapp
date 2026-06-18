import type { FastifyInstance } from 'fastify';
import { cursorQuerySchema, adminProductEditsListSchema, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminProductsPendingListRoute(app: FastifyInstance) {
  app.get('/pending', async (req) => {
    const q = cursorQuerySchema.parse(req.query);
    const cur = decodeCursor(q.cursor);
    const rows = await getPrisma().productEdit.findMany({
      where: {
        status: 'pending',
        ...(cur ? { OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((e) => ({
      id: e.id, productId: e.productId, submittedBy: e.submittedBy,
      proposed: e.proposed as Record<string, unknown>,
      status: e.status as 'pending' | 'approved' | 'rejected',
      createdAt: e.createdAt.toISOString(),
    }));
    const last = items.at(-1);
    return adminProductEditsListSchema.parse({
      items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
