import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { PRODUCT_INCLUDE } from '../../../services/products/product-visibility.js';
import { toApiProductPhoto } from '../../../services/products/serializer.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const p = await getPrisma().product.findUnique({
      where: { id },
      include: {
        ...PRODUCT_INCLUDE,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!p) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    return adminProductRowSchema.parse({
      id: p.id,
      barcode: p.barcode,
      qrPayload: p.qrPayload,
      name: p.name,
      description: p.description,
      brand: p.brand,
      category: p.category,
      imageUrl: p.imageUrl,
      defaultShelfLifeDays: p.defaultShelfLifeDays,
      source: p.source,
      status: p.status,
      version: p.version,
      mergedIntoProductId: p.mergedIntoProductId,
      isCommunityEligible: p.isCommunityEligible,
      buyAgainCount: p.buyAgainCount,
      buyAgainOnSaleCount: p.buyAgainOnSaleCount,
      wontBuyCount: p.wontBuyCount,
      ratingCount: p.ratingCount,
      reviewCount: p.reviewCount,
      photos: [...p.photos].sort((a, b) => a.position - b.position).map((photo) => toApiProductPhoto(photo, p.id)),
      moderationNotes: p.moderationNotes,
      moderatedAt: p.moderatedAt ? p.moderatedAt.toISOString() : null,
      creator: p.createdBy
        ? {
            id: p.createdBy.id,
            email: p.createdBy.email,
            firstName: p.createdBy.firstName,
            lastName: p.createdBy.lastName,
          }
        : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    });
  });
}
