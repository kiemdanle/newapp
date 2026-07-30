import type { Product as PrismaProduct, ProductPhoto as PrismaProductPhoto } from '@prisma/client';
import type { Product as ApiProduct, ProductPhoto as ApiProductPhoto } from '@expyrico/shared';

type ProductWithPhotos = PrismaProduct & { photos?: PrismaProductPhoto[] };

// Public photo projection: id, ordered position, and authorized route URLs only.
// Storage keys, uploader, and moderation state/note never leave this function — Phase 3
// owns the real route/derivation behind `thumbnailUrl`/`displayUrl`.
export function toApiProductPhoto(photo: PrismaProductPhoto): ApiProductPhoto {
  return {
    id: photo.id,
    position: photo.position,
    thumbnailUrl: `/v1/products/photos/${photo.id}/thumbnail`,
    displayUrl: `/v1/products/photos/${photo.id}/display`,
  };
}

export function toApiProduct(p: ProductWithPhotos): ApiProduct {
  return {
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
    sourceId: p.sourceId,
    isCommunityEligible: p.isCommunityEligible,
    buyAgainCount: p.buyAgainCount,
    buyAgainOnSaleCount: p.buyAgainOnSaleCount,
    wontBuyCount: p.wontBuyCount,
    ratingCount: p.ratingCount,
    reviewCount: p.reviewCount,
    status: p.status,
    version: p.version,
    // Deliberately omitted: `moderationFeedback` is not part of the public product
    // DTO (see productSchema). Never map `p.moderationNotes` here.
    photos: [...(p.photos ?? [])].sort((a, b) => a.position - b.position).map(toApiProductPhoto),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
