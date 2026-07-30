import type { Product as PrismaProduct, ProductPhoto as PrismaProductPhoto } from '@prisma/client';
import type { Product as ApiProduct, ProductPhoto as ApiProductPhoto } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { privateProductPhotoRoute, publicMediaUrl } from './product-media-storage.js';

type ProductWithPhotos = PrismaProduct & { photos?: PrismaProductPhoto[] };

/** A real, identified reader — every reader-facing route (product
 * get/lookup/search) constructs one from the authenticated actor. */
export interface SerializerViewer {
  id: string;
  role: 'user' | 'admin';
}

/** Explicit marker for a call site that is already privileged by construction
 * (the caller's own direct photo-management response, an admin-only
 * moderation action, or a creator's own draft view already scoped to their
 * own product) — every photo is shown regardless of moderation status. */
export interface PrivilegedSerializerViewer {
  kind: 'privileged';
}

/** `toApiProduct`'s `viewer` argument is required (reviewer-p3 R3) — the
 * previous optional param failed *open* (showed every photo) when a call site
 * simply forgot to pass one, resting C2's whole projection-layer guarantee on
 * a doc comment instead of the type system. Every call site must now say
 * explicitly which one it is. */
export type ProductSerializerViewer = SerializerViewer | PrivilegedSerializerViewer;

function isPrivileged(viewer: ProductSerializerViewer): viewer is PrivilegedSerializerViewer {
  return 'kind' in viewer && viewer.kind === 'privileged';
}

/**
 * A photo is visible to `viewer` when: it's approved (safe for anyone who can
 * already see the product at all — public by design), the viewer is
 * privileged, the viewer is an admin, or the viewer is the product's own
 * creator and the photo is merely `pending` (their own not-yet-reviewed
 * upload). A `rejected` photo is visible to no one but an admin/privileged
 * viewer, even its own creator — reviewer-p3 C2's explicit ruling.
 */
function isPhotoVisibleTo(photo: PrismaProductPhoto, product: PrismaProduct, viewer: ProductSerializerViewer): boolean {
  if (photo.moderationStatus === 'approved') return true;
  if (isPrivileged(viewer)) return true;
  if (viewer.role === 'admin') return true;
  return photo.moderationStatus === 'pending' && product.createdByUserId === viewer.id;
}

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

export function toApiProduct(p: ProductWithPhotos, viewer: ProductSerializerViewer): ApiProduct {
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
    photos: [...(p.photos ?? [])]
      .filter((photo) => isPhotoVisibleTo(photo, p, viewer))
      .sort((a, b) => a.position - b.position)
      .map((photo) => toApiProductPhoto(photo, p.id)),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
