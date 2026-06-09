import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { pushLogsQuerySchema, pushLogsListSchema, encodeCursor, decodeCursor } from '@pantry/shared';
import { getPrisma } from '../../../db.js';

export async function adminSystemPushLogsRoute(app: FastifyInstance) {
  app.get('/push-logs', async (req) => {
    const q = pushLogsQuerySchema.parse(req.query);
    const where: Prisma.PushLogWhereInput = {};
    if (q.userId) where.userId = q.userId;
    if (q.status) where.status = q.status;
    const cur = decodeCursor(q.cursor);
    if (cur) where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];
    const rows = await getPrisma().pushLog.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r) => ({
      id: r.id, userId: r.userId, templateKey: r.templateKey,
      status: r.status, errorMessage: r.errorMessage, createdAt: r.createdAt.toISOString(),
    }));
    const last = items.at(-1);
    return pushLogsListSchema.parse({
      items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
