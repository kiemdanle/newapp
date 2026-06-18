import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductPatchSchema, adminProductRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsPatchRoute(app: FastifyInstance) {
  app.patch('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    const after = await prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.defaultShelfLifeDays !== undefined ? { defaultShelfLifeDays: input.defaultShelfLifeDays } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    const beforeDiff: Record<string, unknown> = {};
    const afterDiff: Record<string, unknown> = {};
    for (const k of Object.keys(input) as (keyof typeof input)[]) {
      beforeDiff[k] = (before as Record<string, unknown>)[k];
      afterDiff[k] = (after as Record<string, unknown>)[k];
    }
    await req.auditLog('product.update', { type: 'product', id }, { before: beforeDiff, after: afterDiff });
    return adminProductRowSchema.parse({
      id: after.id, barcode: after.barcode, qrPayload: after.qrPayload, name: after.name,
      brand: after.brand, category: after.category, imageUrl: after.imageUrl, source: after.source,
      status: after.status, isCommunityEligible: after.isCommunityEligible,
      buyAgainCount: after.buyAgainCount, buyAgainOnSaleCount: after.buyAgainOnSaleCount,
      wontBuyCount: after.wontBuyCount, ratingCount: after.ratingCount, reviewCount: after.reviewCount,
      createdAt: after.createdAt.toISOString(), updatedAt: after.updatedAt.toISOString(),
    });
  });
}
