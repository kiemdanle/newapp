import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductModerateRequestSchema, adminProductRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { moderateProduct } from '../../../services/products/product-moderation.js';
import { PRODUCT_INCLUDE } from '../../../services/products/product-visibility.js';
import { toApiProductPhoto } from '../../../services/products/serializer.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsModerateRoute(app: FastifyInstance) {
  app.post('/:id/moderate', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductModerateRequestSchema.parse(req.body);
    if (!req.user) throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Authentication required' });
    await moderateProduct(
      { id: req.user.id, role: 'admin' },
      { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
      { productId: id, decision: input.decision, version: input.version, notes: input.notes },
    );
    // Re-fetch the admin projection (photos/moderation history) rather than extend the
    // service's public-DTO return type — `moderateProduct` returns the same `Product`
    // shape every other product-facing service returns, deliberately without
    // admin-only fields (see `toApiProduct`'s comment on `moderationFeedback`).
    const p = await getPrisma().product.findUniqueOrThrow({ where: { id }, include: PRODUCT_INCLUDE });
    return adminProductRowSchema.parse({
      id: p.id, barcode: p.barcode, qrPayload: p.qrPayload, name: p.name, brand: p.brand,
      category: p.category, imageUrl: p.imageUrl, source: p.source, status: p.status,
      isCommunityEligible: p.isCommunityEligible, buyAgainCount: p.buyAgainCount,
      buyAgainOnSaleCount: p.buyAgainOnSaleCount, wontBuyCount: p.wontBuyCount,
      ratingCount: p.ratingCount, reviewCount: p.reviewCount,
      photos: [...p.photos].sort((a, b) => a.position - b.position).map((photo) => toApiProductPhoto(photo, p.id)),
      moderationNotes: p.moderationNotes,
      moderatedAt: p.moderatedAt ? p.moderatedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    });
  });
}
