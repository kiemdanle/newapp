import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { adminReviewsQuerySchema, adminReviewsListSchema, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminReviewsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminReviewsQuerySchema.parse(req.query);
    const where: Prisma.ReviewWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.rating) where.rating = q.rating;
    if (q.productId) where.productId = q.productId;
    if (q.userId) where.userId = q.userId;
    const cur = decodeCursor(q.cursor);
    if (cur) where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];
    const rows = await getPrisma().review.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r) => ({
      id: r.id, userId: r.userId, productId: r.productId, rating: r.rating,
      comment: r.body, helpfulCount: r.helpfulCount, notHelpfulCount: r.notHelpfulCount,
      status: r.status, createdAt: r.createdAt.toISOString(),
    }));
    const last = items.at(-1);
    return adminReviewsListSchema.parse({
      items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
