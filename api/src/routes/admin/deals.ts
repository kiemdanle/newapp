import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminDealsQuerySchema,
  adminDealsListSchema,
  adminDealStatusPatchSchema,
  ERROR_CODES,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminDealsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminDealsQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    const cur = decodeCursor(q.cursor);

    const rows = await getPrisma().deal.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(cur
        ? {
            cursor: { id: cur.i },
            skip: 1,
          }
        : {}),
      include: {
        product: { select: { name: true, brand: true } },
        user: { select: { firstName: true, email: true } },
      },
    });

    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r) => ({
      id: r.id,
      userId: r.userId,
      productId: r.productId,
      price: Number(r.price),
      currency: r.currency,
      storeName: r.storeName,
      photoUrl: r.photoUrl,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString().slice(0, 10) : null,
      note: r.note,
      country: r.country,
      upvoteCount: r.upvoteCount,
      downvoteCount: r.downvoteCount,
      score: Number(r.score),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      productName: r.product.name,
      productBrand: r.product.brand,
      authorFirstName: r.user.firstName,
      authorEmail: r.user.email,
    }));
    const last = items.at(-1);
    return adminDealsListSchema.parse({
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}

export async function adminDealsStatusRoute(app: FastifyInstance) {
  app.patch('/:id/status', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const { status } = adminDealStatusPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.deal.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
    await prisma.deal.update({ where: { id }, data: { status } });
    await req.auditLog('deal.status', { type: 'deal', id }, {
      before: { status: before.status },
      after: { status },
    });
    return { ok: true };
  });
}
