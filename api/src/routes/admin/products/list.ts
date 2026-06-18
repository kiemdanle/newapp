import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { adminProductsQuerySchema, adminProductsListSchema, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

function toRow(p: { id: string; barcode: string | null; qrPayload: string | null; name: string; brand: string | null; category: string | null; imageUrl: string | null; source: string; status: string; isCommunityEligible: boolean; buyAgainCount: number; buyAgainOnSaleCount: number; wontBuyCount: number; ratingCount: number; reviewCount: number; createdAt: Date; updatedAt: Date }) {
  return {
    id: p.id, barcode: p.barcode, qrPayload: p.qrPayload, name: p.name, brand: p.brand,
    category: p.category, imageUrl: p.imageUrl, source: p.source as 'off' | 'upcitemdb' | 'user',
    status: p.status as 'active' | 'pending' | 'merged_into', isCommunityEligible: p.isCommunityEligible,
    buyAgainCount: p.buyAgainCount, buyAgainOnSaleCount: p.buyAgainOnSaleCount,
    wontBuyCount: p.wontBuyCount, ratingCount: p.ratingCount, reviewCount: p.reviewCount,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

export async function adminProductsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminProductsQuerySchema.parse(req.query);
    const where: Prisma.ProductWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.source) where.source = q.source;
    if (q.q) where.OR = [
      { name: { contains: q.q, mode: 'insensitive' } },
      { brand: { contains: q.q, mode: 'insensitive' } },
      { barcode: { equals: q.q } },
    ];
    const cur = decodeCursor(q.cursor);
    if (cur) where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];
    const rows = await getPrisma().product.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map(toRow);
    const last = items.at(-1);
    return adminProductsListSchema.parse({ items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null });
  });
}
