import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { type Product as ApiProduct, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { AppError } from '../../errors.js';
import { logger } from '../../logger.js';
import { enqueueOutbox, sweepOutbox } from '../notifications/outbox.js';
import { toApiProduct } from './serializer.js';
import { publishProductPhoto } from './product-photos.js';
import { publicMediaUrl, publicProductPhotoPrefix, removeKeyPrefix } from './product-media-storage.js';
import {
  reconcileMediaCapacityReservation,
  releaseMediaCapacityReservation,
  reserveMediaCapacity,
} from './product-media-capacity.js';
import { withMediaMutationLease } from './product-media-coordinator.js';
import { prepareMediaOperation } from './product-media-outbox.js';
import { PRODUCT_INCLUDE, type ProductWithPhotos } from './product-visibility.js';

export const DAILY_AUTO_APPROVAL_CAP = 10;


/**
 * Checks whether the actor has exceeded their daily auto-approval quota.
 * If Redis is down, fails open to avoid breaking legitimate submissions.
 */
export async function hasExceededDailyAutoApprovalQuota(actorId: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const day = new Date().toISOString().slice(0, 10);
    const countStr = await redis.get(`product-creation:auto-approved-count:${actorId}:${day}`);
    if (!countStr) return false;
    return parseInt(countStr, 10) >= DAILY_AUTO_APPROVAL_CAP;
  } catch (err) {
    logger.warn({ err, actorId }, 'auto-approval: redis quota check failed, failing open');
    return false;
  }
}

/**
 * Records an auto-approved submission in Redis to bound submission velocity.
 */
export async function recordAutoApprovedSubmission(actorId: string): Promise<void> {
  try {
    const redis = getRedis();
    const day = new Date().toISOString().slice(0, 10);
    const key = `product-creation:auto-approved-count:${actorId}:${day}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 2 * 86400);
    }
  } catch (err) {
    logger.warn({ err, actorId }, 'auto-approval: failed to record daily auto-approved submission count');
  }
}

/**
 * Automatically approves a newly submitted product draft.
 * Executes a two-phase commit:
 * 1. For products with photos: reserves media capacity and publishes all pending photos
 *    under a `publish_public` mutation lease.
 * 2. In a single database transaction, atomically updates product status to 'active',
 *    promotes photos to 'approved', sets position-0 photo as product imageUrl, and enqueues
 *    the 'product_approved' creator notification.
 * 3. For zero-photo products: directly activates product without media lease.
 */
export async function autoApproveProduct(
  productId: string,
  expectedVersion: number,
  actorId: string,
): Promise<ApiProduct> {
  const prisma = getPrisma();
  const product = (await prisma.product.findUnique({
    where: { id: productId },
    include: PRODUCT_INCLUDE,
  })) as ProductWithPhotos | null;

  if (!product) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
  }

  const pendingPhotos = product.photos.filter((p) => p.moderationStatus === 'pending' && p.privateStorageKey);

  // Branch A: Zero photos — direct atomic activation without media lease
  if (pendingPhotos.length === 0) {
    const res = await prisma.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: {
          id: productId,
          status: { in: ['draft', 'changes_required', 'pending'] },
          version: expectedVersion,
        },
        data: {
          status: 'active',
          moderationNotes: 'Auto-approved by platform policy',
          moderatedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.VERSION_CONFLICT,
          title: 'This draft was changed since you last loaded it',
        });
      }

      if (product.createdByUserId) {
        await enqueueOutbox(tx, {
          userId: product.createdByUserId,
          templateKey: 'product_approved',
          payload: { productId: product.id },
        });
      }

      const updated = (await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: PRODUCT_INCLUDE,
      })) as ProductWithPhotos;

      return toApiProduct(updated, { kind: 'privileged' });
    });

    await recordAutoApprovedSubmission(actorId);
    sweepOutbox().catch(() => {});
    logger.info({ productId, actorId, publishedPhotos: 0 }, 'product-creation: auto-approved (zero photos)');
    return res;
  }

  // Branch B: Has photos — two-phase commit: promote media first, then atomically activate product
  const totalBytes = pendingPhotos.reduce((sum, p) => sum + p.displayByteSize + p.thumbnailByteSize, 0);
  const reservation = await reserveMediaCapacity({ bytes: totalBytes });

  try {
    const res = await withMediaMutationLease('publish_public', async () => {
      const publicationIds = pendingPhotos.map(() => randomUUID());
      const targetKeys = pendingPhotos.map((p, i) => publicProductPhotoPrefix(productId, publicationIds[i]!));
      const intent = await prisma.$transaction((tx) =>
        prepareMediaOperation(tx, { operation: 'publish_public', keys: targetKeys }),
      );

      const publishResults = await Promise.all(
        pendingPhotos.map((p, i) =>
          publishProductPhoto(p.id, publicationIds[i]!, {
            intentId: intent.id,
            leaseOwner: intent.leaseOwner,
            capacityReservationId: reservation.id,
          }),
        ),
      );

      return prisma.$transaction(async (tx) => {
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            status: { in: ['draft', 'changes_required', 'pending'] },
            version: expectedVersion,
          },
          data: {
            status: 'active',
            moderationNotes: 'Auto-approved by platform policy',
            moderatedAt: new Date(),
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.VERSION_CONFLICT,
            title: 'This draft was changed since you last loaded it',
          });
        }

        for (let i = 0; i < pendingPhotos.length; i++) {
          await tx.productPhoto.update({
            where: { id: pendingPhotos[i]!.id },
            data: {
              moderationStatus: 'approved',
              publicStorageKey: publishResults[i]!.publicKey,
              privateStorageKey: null,
            },
          });
        }

        const coverIndex = pendingPhotos.findIndex((p) => p.position === 0);
        if (coverIndex !== -1) {
          const coverUrl = publicMediaUrl(
            getConfig().media.publicBaseUrl,
            publishResults[coverIndex]!.publicKey,
            'display',
          );
          await tx.product.update({ where: { id: productId }, data: { imageUrl: coverUrl } });
        }

        if (product.createdByUserId) {
          await enqueueOutbox(tx, {
            userId: product.createdByUserId,
            templateKey: 'product_approved',
            payload: { productId: product.id },
          });
        }

        const updated = (await tx.product.findUniqueOrThrow({
          where: { id: productId },
          include: PRODUCT_INCLUDE,
        })) as ProductWithPhotos;

        return toApiProduct(updated, { kind: 'privileged' });
      });
    });

    await reconcileMediaCapacityReservation(reservation.id, totalBytes);
    await recordAutoApprovedSubmission(actorId);
    sweepOutbox().catch(() => {});
    logger.info({ productId, actorId, publishedPhotos: pendingPhotos.length }, 'product-creation: auto-approved');
    return res;
  } finally {
    await releaseMediaCapacityReservation(reservation.id);
  }
}
