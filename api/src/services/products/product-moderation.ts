import { randomUUID } from 'node:crypto';
import type { Prisma as PrismaTypes } from '@prisma/client';
import { ERROR_CODES, type Product as ApiProduct } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { writeAuditLog } from '../audit/log.js';
import { enqueueOutbox, sweepOutbox } from '../notifications/outbox.js';
import { toApiProduct } from './serializer.js';
import { PRODUCT_INCLUDE, type ProductActor } from './product-visibility.js';
import { withMediaMutationLease } from './product-media-coordinator.js';
import { completeMediaOperation, enqueueMediaCleanup, prepareMediaOperation } from './product-media-outbox.js';
import {
  reconcileMediaCapacityReservation,
  releaseMediaCapacityReservation,
  reserveMediaCapacity,
} from './product-media-capacity.js';
import { publishProductPhoto } from './product-photos.js';
import { publicMediaUrl, publicProductPhotoPrefix, removeKeyPrefix } from './product-media-storage.js';

export interface RequestMeta {
  requestId?: string | undefined;
  ip?: string | undefined;
}

export interface ModerateProductInput {
  productId: string;
  decision: 'approve' | 'request_changes';
  version: number;
  notes?: string | undefined;
}

function notFound(): never {
  throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
}

function versionConflict(currentVersion: number): never {
  throw new AppError({
    status: 409,
    code: ERROR_CODES.VERSION_CONFLICT,
    title: 'This product was changed since you last loaded it',
    currentVersion,
  });
}

async function loadProductWithPhotos(tx: PrismaTypes.TransactionClient, productId: string) {
  return tx.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_INCLUDE });
}

/** Must run against the *same* transaction client as the caller's aborting
 * write, never the pooled `getPrisma()` client — reading through a second pool
 * connection while the first is held open by an in-progress `$transaction` risks
 * self-deadlocking the conflict path under pool saturation instead of cleanly
 * returning a 409. The transaction is rolling back regardless, so a `tx` read is
 * both correct and consistent. */
async function currentVersionOf(tx: PrismaTypes.TransactionClient, productId: string): Promise<number> {
  const row = await tx.product.findUnique({ where: { id: productId }, select: { version: true } });
  // The row disappearing entirely between the version-conflict and this re-read is not
  // a real-world path (products are never hard-deleted), but return 0 rather than
  // throw here — the conflict path already has a definite answer to give without a
  // second, avoidable failure mode.
  return row?.version ?? 0;
}

/**
 * Resolves a request_changes decision: no photo work, no live-catalog visibility
 * change (the product stays out of the active catalog). Transactionally bumps
 * status/reason/actor/time/version and inserts the mandatory audit row together.
 */
async function requestChanges(
  actor: ProductActor,
  requestMeta: RequestMeta,
  productId: string,
  version: number,
  notes: string | undefined,
): Promise<ApiProduct> {
  const prisma = getPrisma();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.product.updateMany({
      where: { id: productId, status: 'pending', version },
      data: {
        status: 'changes_required',
        moderationNotes: notes ?? null,
        moderatedByUserId: actor.id,
        moderatedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count === 0) versionConflict(await currentVersionOf(tx, productId));
    await writeAuditLog(
      {
        adminId: actor.id,
        action: 'product.moderate',
        targetType: 'product',
        targetId: productId,
        diff: { before: { status: 'pending' }, after: { decision: 'request_changes', notes: notes ?? null } },
        requestId: requestMeta.requestId,
        ip: requestMeta.ip,
      },
      tx,
    );
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (product?.createdByUserId) {
      await enqueueOutbox(tx, {
        userId: product.createdByUserId,
        templateKey: 'product_changes_required',
        payload: { productId, notes: notes ?? null },
      });
    }
    return loadProductWithPhotos(tx, productId);
  });
  sweepOutbox().catch(() => {});
  return toApiProduct(updated, { kind: 'privileged' });
}

/**
 * Resolves an approve decision. Every currently-pending `ProductPhoto` on the
 * product is published to a fresh public UUID path before any DB reference is
 * written: capacity for the complete set is reserved up front, a `publish_public`
 * outbox intent is committed under a held media lease, then every photo's bytes
 * are copied to their public key. Only once every copy has succeeded does the
 * single reference transaction run: product active, each photo's public key/
 * moderation status, cover `imageUrl` (the position-0 photo's public display
 * URL, for legacy clients that don't yet read `photos[]`), audit row, intent
 * completion, and old private-key cleanup — all together or none of it. A failure
 * after copying but before that transaction compensates the copied keys
 * immediately; if the process dies first, the uncompleted prepared intent is the
 * durable backstop for expired-intent recovery.
 */
async function approve(
  actor: ProductActor,
  requestMeta: RequestMeta,
  product: { id: string; version: number; createdByUserId?: string | null; photos: { id: string; position: number; moderationStatus: string; privateStorageKey: string | null; displayByteSize: number; thumbnailByteSize: number }[] },
  version: number,
): Promise<ApiProduct> {
  const prisma = getPrisma();
  const pendingPhotos = product.photos.filter((p) => p.moderationStatus === 'pending' && p.privateStorageKey);

  if (pendingPhotos.length === 0) {
    const res = await prisma.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id: product.id, status: 'pending', version },
        data: { status: 'active', moderationNotes: null, moderatedByUserId: actor.id, moderatedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count === 0) versionConflict(await currentVersionOf(tx, product.id));
      await writeAuditLog(
        {
          adminId: actor.id,
          action: 'product.moderate',
          targetType: 'product',
          targetId: product.id,
          diff: { before: { status: 'pending' }, after: { decision: 'approve', publishedPhotos: 0 } },
          requestId: requestMeta.requestId,
          ip: requestMeta.ip,
        },
        tx,
      );
      if (product.createdByUserId) {
        await enqueueOutbox(tx, {
          userId: product.createdByUserId,
          templateKey: 'product_approved',
          payload: { productId: product.id },
        });
      }
      return toApiProduct(await loadProductWithPhotos(tx, product.id), { kind: 'privileged' });
    });
    sweepOutbox().catch(() => {});
    return res;
  }

  const totalBytes = pendingPhotos.reduce((sum, p) => sum + p.displayByteSize + p.thumbnailByteSize, 0);
  const root = getConfig().media.root;
  const reservation = await reserveMediaCapacity({ bytes: totalBytes });
  try {
    const result = await withMediaMutationLease('publish_public', async () => {
      const publicationIds = pendingPhotos.map(() => randomUUID());
      const targetKeys = pendingPhotos.map((p, i) => publicProductPhotoPrefix(product.id, publicationIds[i]!));
      const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'publish_public', keys: targetKeys }));

      const publishResults = await Promise.all(
        pendingPhotos.map((p, i) =>
          publishProductPhoto(p.id, publicationIds[i]!, {
            intentId: intent.id,
            leaseOwner: intent.leaseOwner,
            capacityReservationId: reservation.id,
          }),
        ),
      );

      try {
        const res: ApiProduct = await prisma.$transaction(async (tx) => {
          const updateResult = await tx.product.updateMany({
            where: { id: product.id, status: 'pending', version },
            data: { status: 'active', moderationNotes: null, moderatedByUserId: actor.id, moderatedAt: new Date(), version: { increment: 1 } },
          });
          if (updateResult.count === 0) versionConflict(await currentVersionOf(tx, product.id));
          for (let i = 0; i < pendingPhotos.length; i++) {
            await tx.productPhoto.update({
              where: { id: pendingPhotos[i]!.id },
              data: { moderationStatus: 'approved', publicStorageKey: publishResults[i]!.publicKey, privateStorageKey: null },
            });
          }

          // Cover imageUrl for legacy clients — the position-0 photo's fresh
          // public display URL. Every photo here just got a public key (new
          // products only ever approve once, from `pending` to `active`, so there
          // is never a pre-existing mix of already-approved photos to consider).
          const coverIndex = pendingPhotos.findIndex((p) => p.position === 0);
          if (coverIndex !== -1) {
            const coverUrl = publicMediaUrl(getConfig().media.publicBaseUrl, publishResults[coverIndex]!.publicKey, 'display');
            await tx.product.update({ where: { id: product.id }, data: { imageUrl: coverUrl } });
          }

          await writeAuditLog(
            {
              adminId: actor.id,
              action: 'product.moderate',
              targetType: 'product',
              targetId: product.id,
              diff: { before: { status: 'pending' }, after: { decision: 'approve', publishedPhotos: pendingPhotos.length } },
              requestId: requestMeta.requestId,
              ip: requestMeta.ip,
            },
            tx,
          );
          if (product.createdByUserId) {
            await enqueueOutbox(tx, {
              userId: product.createdByUserId,
              templateKey: 'product_approved',
              payload: { productId: product.id },
            });
          }
          await completeMediaOperation(tx, intent.id, intent.leaseOwner);
          await enqueueMediaCleanup(tx, {
            operation: 'delete_private',
            keys: pendingPhotos.map((p) => p.privateStorageKey!),
          });

          return toApiProduct(await loadProductWithPhotos(tx, product.id), { kind: 'privileged' });
        });
        sweepOutbox().catch(() => {});
        return res;
      } catch (err) {
        // The reference transaction never committed: nothing refers to the freshly
        // copied public bytes yet. Compensate immediately; if this itself fails, the
        // prepared intent (never completed) is the durable backstop for expired-intent
        // recovery to remove them later.
        await Promise.all(targetKeys.map((key) => removeKeyPrefix(root, key).catch(() => {})));
        throw err;
      }
    });
    await reconcileMediaCapacityReservation(reservation.id, totalBytes);
    return result;
  } finally {
    await releaseMediaCapacityReservation(reservation.id);
  }
}

/**
 * Moderates a brand-new creator submission (`Product.status === 'pending'`, no
 * `ProductEdit` involved — active-product revisions go through `resolveProductEdit`
 * instead). Approve publishes every pending photo and activates the product;
 * request_changes returns it to the creator with a reason, retaining private media.
 * Never writes `rejected` — that is Phase 4's explicit stale-revision `supersede`
 * action on a `ProductEdit`, not a new-product moderation outcome.
 */
export async function moderateProduct(
  actor: ProductActor,
  requestMeta: RequestMeta,
  input: ModerateProductInput,
): Promise<ApiProduct> {
  const product = await getPrisma().product.findUnique({ where: { id: input.productId }, include: PRODUCT_INCLUDE });
  if (!product) notFound();
  if (product.status !== 'pending') {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: 'This product is not awaiting review',
    });
  }
  if (product.version !== input.version) versionConflict(product.version);

  if (input.decision === 'request_changes') {
    return requestChanges(actor, requestMeta, product.id, input.version, input.notes);
  }
  return approve(actor, requestMeta, product, input.version);
}
