import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { adminReportsQuerySchema, adminReportsListSchema, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

async function buildPreview(targetType: string, targetId: string): Promise<Record<string, unknown> | null> {
  const prisma = getPrisma();
  if (targetType === 'review') {
    const r = await prisma.review.findUnique({ where: { id: targetId }, select: { body: true, rating: true, status: true } });
    return r ? { kind: 'review', body: r.body, rating: r.rating, status: r.status } : null;
  }
  if (targetType === 'user') {
    const u = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true, status: true } });
    return u ? { kind: 'user', email: u.email, status: u.status } : null;
  }
  if (targetType === 'product') {
    const p = await prisma.product.findUnique({ where: { id: targetId }, select: { name: true, brand: true, status: true } });
    return p ? { kind: 'product', name: p.name, brand: p.brand, status: p.status } : null;
  }
  return null;
}

export async function adminReportsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminReportsQuerySchema.parse(req.query);
    const where: Prisma.ReportWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.targetType) where.targetType = q.targetType;
    const cur = decodeCursor(q.cursor);
    if (cur) where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];
    const rows = await getPrisma().report.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const sliced = hasMore ? rows.slice(0, -1) : rows;
    const items = await Promise.all(sliced.map(async (r) => ({
      id: r.id, reporterId: r.reporterId, targetType: r.targetType,
      targetId: r.targetId, reason: r.reason, body: r.body,
      status: r.status, createdAt: r.createdAt.toISOString(),
      targetPreview: await buildPreview(r.targetType, r.targetId),
    })));
    const last = items.at(-1);
    return adminReportsListSchema.parse({
      items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
