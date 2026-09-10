import {
  computeContributorProgression,
  contributorLevelsSettingSchema,
  userContributionsResponseSchema,
  type CommunityContributionRow,
  type UserContributionsResponse,
} from '@expyrico/shared';
import { ProductStatus } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { getSetting, SETTING_KEYS } from '../admin/settings.js';
import { toApiProductPhoto } from './serializer.js';

export interface UserContributionsQuery {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: 'all' | 'active' | 'pending' | 'changes_required' | undefined;
  q?: string | undefined;
}

export async function getUserContributions(
  userId: string,
  options?: UserContributionsQuery,
): Promise<UserContributionsResponse> {
  const prisma = getPrisma();
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = Math.max(0, options?.offset ?? 0);
  const statusFilter = options?.status;
  const q = options?.q?.trim();
  // 1. Fetch active contributor levels setting from DB or default
  const setting = await getSetting(
    SETTING_KEYS.CONTRIBUTOR_LEVELS,
    contributorLevelsSettingSchema,
  );

  // 2. Strict XP-Eligible stats query:
  // - activeProductsCount: caller's active, non-dismissed products
  // - photosCount: caller's packaging photos on active products (isolated from creator dismissal)
  const submittedStatusFilter = {
    in: [
      ProductStatus.active,
      ProductStatus.pending,
      ProductStatus.changes_required,
      ProductStatus.report_hidden,
      ProductStatus.merged_into,
    ],
  };

  // 2. Strict XP-Eligible stats query & Public history queries
  const countPromises = Promise.all([
    // XP-eligible count: active catalog products not dismissed from personal templates
    prisma.product.count({
      where: {
        createdByUserId: userId,
        isDismissedFromTemplates: false,
        status: ProductStatus.active,
      },
    }),
    // Public history approved count: all active products ever contributed (independent of template dismissal)
    prisma.product.count({
      where: {
        createdByUserId: userId,
        status: ProductStatus.active,
      },
    }),
    prisma.productPhoto.count({
      where: {
        uploadedByUserId: userId,
        product: { status: ProductStatus.active },
      },
    }),
    prisma.productEdit.count({
      where: {
        submittedBy: userId,
        status: 'approved',
        product: { status: ProductStatus.active },
      },
    }),
    prisma.product.count({
      where: { createdByUserId: userId, status: submittedStatusFilter },
    }),
    prisma.product.count({
      where: { createdByUserId: userId, status: ProductStatus.pending },
    }),
    prisma.product.count({
      where: { createdByUserId: userId, status: ProductStatus.changes_required },
    }),
  ]);

  const itemsStatusFilter =
    statusFilter === 'active'
      ? ProductStatus.active
      : statusFilter === 'pending'
        ? ProductStatus.pending
        : statusFilter === 'changes_required'
          ? ProductStatus.changes_required
          : submittedStatusFilter;

  const searchQueryFilter =
    q && q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { barcode: { contains: q } },
            { brand: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

  const [counts, rawContributedProducts] = await Promise.all([
    countPromises,
    prisma.product.findMany({
      where: {
        createdByUserId: userId,
        status: itemsStatusFilter,
        ...searchQueryFilter,
      },
      include: {
        photos: {
          orderBy: { position: 'asc' },
          take: 1,
        },
        _count: {
          select: {
            photos: true,
            edits: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      skip: offset,
    }),
  ]);

  const hasMore = rawContributedProducts.length > limit;
  const contributedProducts = hasMore
    ? rawContributedProducts.slice(0, -1)
    : rawContributedProducts;
  const nextOffset = hasMore ? offset + limit : null;

  const [
    activeProductsCount,
    historyApprovedCount,
    photosCount,
    approvedEditsCount,
    totalContributed,
    pendingReview,
    changesRequested,
  ] = counts;

  // 3. Compute progression
  const progression = computeContributorProgression(
    {
      activeProductsCount,
      approvedProductsBonusCount: activeProductsCount,
      photosCount,
      approvedEditsCount,
    },
    setting.levels,
  );

  // 4. Map contributed products to response rows
  const items: CommunityContributionRow[] = contributedProducts.map((p) => {
    const firstPhoto = p.photos[0];
    const isPublic = Boolean(firstPhoto?.publicStorageKey);
    const coverImageUrl = isPublic && firstPhoto
      ? toApiProductPhoto(firstPhoto, p.id).thumbnailUrl
      : (p.imageUrl ?? null);
    const coverPhotoId = !isPublic && firstPhoto ? firstPhoto.id : null;

    return {
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      brand: p.brand,
      status: p.status,
      coverImageUrl,
      coverPhotoId,
      packagingPhotosCount: p._count.photos,
      editsCount: p._count.edits,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return userContributionsResponseSchema.parse({
    enabled: setting.enabled,
    levels: setting.levels,
    progression,
    stats: {
      totalContributed,
      activeApproved: historyApprovedCount,
      pendingReview,
      changesRequested,
      editsApproved: approvedEditsCount,
    },
    items,
    hasMore,
    nextOffset,
  });
}
