import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { adminProductsQuerySchema, adminProductsListSchema, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { PRODUCT_INCLUDE, type ProductWithPhotos } from '../../../services/products/product-visibility.js';
import { toApiProductPhoto } from '../../../services/products/serializer.js';

function toRow(p: ProductWithPhotos) {
  return {
    id: p.id, barcode: p.barcode, qrPayload: p.qrPayload, name: p.name, description: p.description,
    brand: p.brand, category: p.category, imageUrl: p.imageUrl, defaultShelfLifeDays: p.defaultShelfLifeDays, source: p.source as 'off' | 'upcitemdb' | 'user',
    status: p.status as 'active' | 'pending' | 'merged_into', version: p.version,
    mergedIntoProductId: p.mergedIntoProductId, isCommunityEligible: p.isCommunityEligible,
    buyAgainCount: p.buyAgainCount, buyAgainOnSaleCount: p.buyAgainOnSaleCount,
    wontBuyCount: p.wontBuyCount, ratingCount: p.ratingCount, reviewCount: p.reviewCount,
    // Ordered review media, admin-only — never included in the public product DTO.
    photos: [...p.photos].sort((a, b) => a.position - b.position).map((photo) => toApiProductPhoto(photo, p.id)),
    moderationNotes: p.moderationNotes,
    moderatedAt: p.moderatedAt ? p.moderatedAt.toISOString() : null,
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
    const rows = await getPrisma().product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map(toRow);
    const last = items.at(-1);
    return adminProductsListSchema.parse({ items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null });
  });
}
