import type { Product } from '@prisma/client';
import type { Product as ApiProduct } from '@pantry/shared';

export function toApiProduct(p: Product): ApiProduct {
  return {
    id: p.id,
    barcode: p.barcode,
    qrPayload: p.qrPayload,
    name: p.name,
    brand: p.brand,
    category: p.category,
    imageUrl: p.imageUrl,
    defaultShelfLifeDays: p.defaultShelfLifeDays,
    source: p.source,
    sourceId: p.sourceId,
    isCommunityEligible: p.isCommunityEligible,
    buyAgainCount: p.buyAgainCount,
    buyAgainOnSaleCount: p.buyAgainOnSaleCount,
    wontBuyCount: p.wontBuyCount,
    ratingCount: p.ratingCount,
    reviewCount: p.reviewCount,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
