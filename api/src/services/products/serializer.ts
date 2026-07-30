import type { Product as PrismaProduct, ProductPhoto as PrismaProductPhoto } from '@prisma/client';
import type { Product as ApiProduct, ProductPhoto as ApiProductPhoto } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { privateProductPhotoRoute, publicMediaUrl } from './product-media-storage.js';

type ProductWithPhotos = PrismaProduct & { photos?: PrismaProductPhoto[] };

// Public photo projection: id, ordered position, and authorized route/CDN URLs
// only. Storage keys, uploader, and moderation state/note never leave this
// function. An approved photo (`publicStorageKey` set) gets an absolute public CDN
// URL; everything else gets the parent-bound authenticated private delivery route
// (Phase 3's real route/derivation, replacing the earlier non-parent-bound
// placeholder this comment used to describe).
export function toApiProductPhoto(photo: PrismaProductPhoto, productId: string): ApiProductPhoto {
  if (photo.publicStorageKey) {
    const base = getConfig().media.publicBaseUrl;
    return {
      id: photo.id,
      position: photo.position,
      thumbnailUrl: publicMediaUrl(base, photo.publicStorageKey, 'thumb'),
      displayUrl: publicMediaUrl(base, photo.publicStorageKey, 'display'),
    };
  }
  return {
    id: photo.id,
    position: photo.position,
    thumbnailUrl: privateProductPhotoRoute(productId, photo.id, 'thumb'),
    displayUrl: privateProductPhotoRoute(productId, photo.id, 'display'),
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
    photos: [...(p.photos ?? [])].sort((a, b) => a.position - b.position).map((photo) => toApiProductPhoto(photo, p.id)),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
