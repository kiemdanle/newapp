import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const p = await getPrisma().product.findUnique({ where: { id } });
    if (!p) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    return adminProductRowSchema.parse({
      id: p.id, barcode: p.barcode, qrPayload: p.qrPayload, name: p.name, brand: p.brand,
      category: p.category, imageUrl: p.imageUrl, source: p.source, status: p.status,
      isCommunityEligible: p.isCommunityEligible, buyAgainCount: p.buyAgainCount,
      buyAgainOnSaleCount: p.buyAgainOnSaleCount, wontBuyCount: p.wontBuyCount,
      ratingCount: p.ratingCount, reviewCount: p.reviewCount,
      createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    });
  });
}
