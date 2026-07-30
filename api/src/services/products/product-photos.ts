import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import type { Prisma as PrismaTypes, Product, ProductEdit, ProductEditPhoto, ProductPhoto } from '@prisma/client';
import { ERROR_CODES, type Product as ApiProduct } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { writeAuditLog } from '../audit/log.js';
import { logger } from '../../logger.js';
import type { ProductActor } from './product-visibility.js';
import { toApiProduct } from './serializer.js';
import { withMediaMutationLease } from './product-media-coordinator.js';
import {
  completeMediaOperation,
  enqueueMediaCleanup,
  MediaOperationFencedError,
  prepareMediaOperation,
  renewMediaOperationLease,
} from './product-media-outbox.js';
import { assertMediaCapacityReservationLive, releaseMediaCapacityReservation } from './product-media-capacity.js';
import type { ProcessedVariants } from './product-image-processor.js';
import {
  copyKeyPrefix,
  mediaKeyToPath,
  privateProductEditPhotoDir,
  privateProductEditPhotoPrefix,
  privateProductPhotoDir,
  privateProductPhotoPrefix,
  promoteKeyPrefix,
  publicProductPhotoPrefix,
  removeKeyPrefix,
  variantFileKey,
} from './product-media-storage.js';

export const MAX_PHOTOS_PER_PRODUCT = 5;

function notFound(): never {
  throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
}

function forbidden(title: string): never {
  throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title });
}

/**
 * Photo-mutation authorization: admins may add/remove/reorder photos on any
 * product (the direct-edit privilege Global Constraints grants admins on active
 * products, extended here to every state since moderation tooling needs it).
 * Creators may only do so while their own product is still in an editable private
 * state (`draft`/`changes_required`) — not `pending` (locked during review, so a
 * creator can't sneak in unreviewed photos while an admin is looking at it), and
 * never `active` (live-catalog photo changes go through the moderated `ProductEdit`
 * flow, not this direct path). Any other caller/state is a non-enumerating 404.
 */
interface LockedProductRow {
  id: string;
  status: Product['status'];
  createdByUserId: string | null;
}

/** Pure policy check shared by the transactional (locked) path and the route-level
 * pre-check that runs before the multipart body is even read. Throws; never
 * returns a boolean, so every call site fails closed by construction. */
function checkPhotoMutablePolicy(actor: ProductActor, row: LockedProductRow): void {
  if (actor.role === 'admin') return;
  if (row.createdByUserId !== actor.id) notFound();
  if (row.status === 'draft' || row.status === 'changes_required') return;
  if (row.status === 'pending') forbidden('This product is awaiting review and cannot be edited right now');
  forbidden('This product cannot be edited directly');
}

async function assertPhotoMutable(actor: ProductActor, productId: string, tx: PrismaTypes.TransactionClient): Promise<LockedProductRow> {
  // Prisma's typed API has no row-locking clause, so this is raw SQL — the `AS
  // "camelCase"` aliases are load-bearing: `$queryRaw` never remaps snake_case DB
  // columns to Prisma's camelCase field names the way the typed API does, so
  // reading `row.createdByUserId` against an unaliased `SELECT *` would silently
  // read `undefined` (the DB column is `created_by_user_id`) and fail every
  // non-admin caller's ownership check.
  const rows = await tx.$queryRaw<LockedProductRow[]>`
    SELECT "id", "status", "created_by_user_id" AS "createdByUserId"
    FROM "products"
    WHERE "id" = ${productId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) notFound();
  checkPhotoMutablePolicy(actor, row);
  return row;
}

/**
 * Unlocked pre-check for the upload route to run *before* accepting the multipart
 * body — so an unauthorized or wrongly-timed request never causes the server to
 * stream/decode a file at all. Not a substitute for `assertPhotoMutable`'s locked,
 * transactional check, which still runs before the DB write; this only avoids
 * wasted work on requests that are obviously going to fail. Includes a
 * non-authoritative count against `MAX_PHOTOS_PER_PRODUCT` so the common abuse
 * case (repeatedly hitting an already-full product) doesn't pay for a full
 * stream + decode + WebP encode + temp write + rename before being rejected
 * (reviewer-p3 M8) — the locked, transactional count inside `addProductPhoto` is
 * still what's actually enforced; a race that slips past this cheap check is
 * caught there.
 */
export async function assertPhotoMutablePreCheck(actor: ProductActor, productId: string): Promise<void> {
  const product = await getPrisma().product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, createdByUserId: true, _count: { select: { photos: true } } },
  });
  if (!product) notFound();
  checkPhotoMutablePolicy(actor, product);
  if (product._count.photos >= MAX_PHOTOS_PER_PRODUCT) {
    throw new AppError({
      status: 409,
      code: 'photo_limit_reached',
      title: `A product may have at most ${MAX_PHOTOS_PER_PRODUCT} photos`,
    });
  }
}

async function loadProductWithPhotos(tx: PrismaTypes.TransactionClient, productId: string) {
  return tx.product.findUniqueOrThrow({
    where: { id: productId },
    include: { photos: { orderBy: { position: 'asc' } } },
  });
}

export interface AddProductPhotoInput {
  productId: string;
  processed: ProcessedVariants;
  capacityReservationId: string;
  requestMeta?: { requestId?: string | undefined; ip?: string | undefined };
}

/** Admin direct photo mutations get the same atomic-audit invariant as every other
 * Phase 4 admin write; a creator's own photo changes on their own draft/
 * changes_required product are routine self-service, not an admin action, and are
 * never audited. */
async function auditIfAdmin(
  tx: PrismaTypes.TransactionClient,
  actor: ProductActor,
  action: string,
  productId: string,
  diff: unknown,
  requestMeta: { requestId?: string | undefined; ip?: string | undefined } = {},
): Promise<void> {
  if (actor.role !== 'admin') return;
  await writeAuditLog(
    { adminId: actor.id, action, targetType: 'product', targetId: productId, diff, requestId: requestMeta.requestId, ip: requestMeta.ip },
    tx,
  );
}

/**
 * Attaches a newly processed photo to a product: commits a prepared outbox intent,
 * physically promotes the generated variant files into their final private key,
 * then atomically inserts the photo row (position = current count, quota-checked
 * under the product row lock) and completes the intent in the same transaction. If
 * the reference transaction fails after promotion, the now-unreferenced bytes are
 * cleaned up immediately on a best-effort basis and, durably, by outbox recovery
 * regardless (the prepared intent was never completed, so its lease will expire).
 */
export async function addProductPhoto(actor: ProductActor, input: AddProductPhotoInput): Promise<ApiProduct> {
  const prisma = getPrisma();
  const root = getConfig().media.root;
  const photoId = randomUUID();
  const variantId = randomUUID();
  const prefix = privateProductPhotoPrefix(input.productId, photoId, variantId);

  return withMediaMutationLease('promote_private', async () => {
    const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: [prefix] }));

    // Write the already-generated variant buffers to a temp location, then promote
    // (rename) the whole pair into its final key as one atomic filesystem operation.
    const tempKey = `quarantine/${randomUUID()}-generated`;
    await ensureAndWriteVariantFiles(root, tempKey, input.processed);

    try {
      await promoteKeyPrefix(root, tempKey, prefix);
    } catch (err) {
      await removeKeyPrefix(root, tempKey).catch(() => {});
      throw err;
    }

    // Renew the lease right before the reference transaction — bytes are already on
    // disk, so this is the window `completeMediaOperation`'s fencing protects: if the
    // transaction below is slow (e.g. `FOR UPDATE` contention) and the lease expires
    // first, a recovery sweep could claim and delete these bytes before the reference
    // commits. Cheap insurance for a normally-fast path (reviewer-p3 I1).
    await renewMediaOperationLease(intent.id, intent.leaseOwner);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const product = await assertPhotoMutable(actor, input.productId, tx);
        const currentCount = await tx.productPhoto.count({ where: { productId: input.productId } });
        if (currentCount >= MAX_PHOTOS_PER_PRODUCT) {
          throw new AppError({
            status: 409,
            code: 'photo_limit_reached',
            title: `A product may have at most ${MAX_PHOTOS_PER_PRODUCT} photos`,
          });
        }
        await tx.productPhoto.create({
          data: {
            id: photoId,
            productId: input.productId,
            position: currentCount,
            uploadedByUserId: actor.id,
            moderationStatus: 'pending',
            mimeType: 'image/webp',
            displayByteSize: input.processed.display.bytes,
            displayWidth: input.processed.display.width,
            displayHeight: input.processed.display.height,
            thumbnailByteSize: input.processed.thumb.bytes,
            thumbnailWidth: input.processed.thumb.width,
            thumbnailHeight: input.processed.thumb.height,
            privateStorageKey: prefix,
          },
        });
        await tx.product.update({ where: { id: product.id }, data: { version: { increment: 1 } } });
        await completeMediaOperation(tx, intent.id, intent.leaseOwner);
        await auditIfAdmin(tx, actor, 'product.photo.add', input.productId, { after: { photoId } }, input.requestMeta);
        return loadProductWithPhotos(tx, input.productId);
      });
      return toApiProduct(updated, actor);
    } catch (err) {
      // Compensate promptly; outbox recovery is the durable backstop if this itself
      // fails (the intent was never completed, so its lease will expire and a later
      // sweep will find and remove the unreferenced key). Removes the whole photoId
      // directory (not just the variant-uuid leaf) since this photoId was freshly
      // generated for this attempt alone — never leaves an empty parent behind.
      await removeKeyPrefix(root, privateProductPhotoDir(input.productId, photoId)).catch(() => {});
      if (err instanceof MediaOperationFencedError) {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.CONFLICT,
          title: 'This upload lost a race with cleanup recovery; please retry',
        });
      }
      throw err;
    }
  }).finally(() => releaseMediaCapacityReservation(input.capacityReservationId));
}

async function ensureAndWriteVariantFiles(root: string, tempKey: string, processed: ProcessedVariants): Promise<void> {
  const dir = mediaKeyToPath(root, tempKey);
  await mkdir(dir, { recursive: true });
  await writeFile(mediaKeyToPath(root, variantFileKey(tempKey, 'display')), processed.display.buffer);
  await writeFile(mediaKeyToPath(root, variantFileKey(tempKey, 'thumb')), processed.thumb.buffer);
}

export interface RemoveProductPhotoInput {
  productId: string;
  photoId: string;
  requestMeta?: { requestId?: string | undefined; ip?: string | undefined };
}

/** Removes a photo and closes the position gap so the remaining photos stay a
 * contiguous 0..N-1 sequence (position 0 = cover is contractual). Reindexing uses
 * `SET CONSTRAINTS DEFERRED` + explicit per-row updates, never upsert/ON CONFLICT —
 * the position unique constraints are DEFERRABLE and Postgres refuses them as an
 * `ON CONFLICT` arbiter. The old key's cleanup is enqueued durably in the same
 * transaction as the row delete/reindex/version bump. */
export async function removeProductPhoto(actor: ProductActor, input: RemoveProductPhotoInput): Promise<ApiProduct> {
  const prisma = getPrisma();
  return withMediaMutationLease('delete_private', async () => {
    const updated = await prisma.$transaction(async (tx) => {
      const product = await assertPhotoMutable(actor, input.productId, tx);
      const photo = await tx.productPhoto.findFirst({ where: { id: input.photoId, productId: input.productId } });
      if (!photo) {
        throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Photo not found' });
      }

      await tx.$executeRawUnsafe('SET CONSTRAINTS "product_photos_product_id_position_key" DEFERRED');
      try {
        await tx.productPhoto.delete({ where: { id: photo.id } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.CONFLICT,
            title: 'This photo is retained by an in-progress edit and cannot be removed yet',
          });
        }
        throw err;
      }

      const remaining = await tx.productPhoto.findMany({
        where: { productId: input.productId },
        orderBy: { position: 'asc' },
      });
      for (let i = 0; i < remaining.length; i++) {
        const row = remaining[i]!;
        if (row.position !== i) {
          await tx.productPhoto.update({ where: { id: row.id }, data: { position: i } });
        }
      }

      await tx.product.update({ where: { id: product.id }, data: { version: { increment: 1 } } });

      const key = photo.privateStorageKey ?? photo.publicStorageKey;
      if (key) {
        await enqueueMediaCleanup(tx, {
          operation: photo.privateStorageKey ? 'delete_private' : 'delete_public',
          keys: [key],
        });
      }

      await auditIfAdmin(tx, actor, 'product.photo.remove', input.productId, { before: { photoId: photo.id } }, input.requestMeta);
      return loadProductWithPhotos(tx, input.productId);
    });
    return toApiProduct(updated, actor);
  });
}

export interface ReorderProductPhotosInput {
  productId: string;
  photoIds: string[];
  requestMeta?: { requestId?: string | undefined; ip?: string | undefined };
}

/** Applies an exact target order. `photoIds` must be exactly the product's current
 * photo ID set (no missing/extra/duplicate entries) — anything else is a 400, never
 * a partial/best-effort reorder. Position writes go through `SET CONSTRAINTS
 * DEFERRED` + explicit per-row updates so the whole target order can be written in
 * one transaction without hitting an illegal intermediate collision; never
 * upsert/ON CONFLICT against the deferrable `(product_id, position)` constraint. */
export async function reorderProductPhotos(actor: ProductActor, input: ReorderProductPhotosInput): Promise<ApiProduct> {
  const prisma = getPrisma();
  const updated = await prisma.$transaction(async (tx) => {
    const product = await assertPhotoMutable(actor, input.productId, tx);
    const current = await tx.productPhoto.findMany({ where: { productId: input.productId } });
    const currentIds = new Set(current.map((p: ProductPhoto) => p.id));
    const requestedIds = new Set(input.photoIds);
    const isExactSet =
      input.photoIds.length === current.length &&
      requestedIds.size === input.photoIds.length &&
      [...requestedIds].every((id) => currentIds.has(id));
    if (!isExactSet) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: 'photoIds must contain exactly the product\'s current photo set',
      });
    }

    await tx.$executeRawUnsafe('SET CONSTRAINTS "product_photos_product_id_position_key" DEFERRED');
    for (let position = 0; position < input.photoIds.length; position++) {
      const id = input.photoIds[position]!;
      await tx.productPhoto.update({ where: { id }, data: { position } });
    }
    await tx.product.update({ where: { id: product.id }, data: { version: { increment: 1 } } });
    await auditIfAdmin(tx, actor, 'product.photo.reorder', input.productId, { after: { photoIds: input.photoIds } }, input.requestMeta);
    return loadProductWithPhotos(tx, input.productId);
  });
  return toApiProduct(updated, actor);
}

export interface PublicPhotoVariant {
  bytes: number;
  width: number;
  height: number;
}

export interface PublicVariants {
  publicKey: string;
  display: PublicPhotoVariant;
  thumb: PublicPhotoVariant;
}

export interface PublishIntentContext {
  /** The prepared `MediaOperationOutbox` row id the caller already committed via
   * `prepareMediaOperation` before calling this. */
  intentId: string;
  /** That same intent's lease token — renewed here (heartbeated) before the copy,
   * since a full publication set spans multiple photos under one intent and this
   * function is typically called once per photo in a loop. */
  leaseOwner: string;
  /** A live `reserveMediaCapacity` reservation covering this photo's (or the whole
   * set's) worst-case bytes. Required, not optional: asserted live immediately
   * before the first byte is copied, so "no final/public key is created without a
   * live reservation" is enforced here, not merely documented (reviewer-p3 I2). */
  capacityReservationId: string;
}

/**
 * Copies (never moves) a photo's private variants to a fresh, immutable public
 * key. Requires a `prepared` intent the caller already committed via
 * `prepareMediaOperation`. Does **not** touch the DB: the caller (Phase 4's
 * moderation transaction) writes the returned `publicKey` onto the photo row,
 * completes the intent, and enqueues cleanup of the now-superseded private key —
 * all in the same transaction, so bytes are copied here but only ever
 * referenced/cleaned up atomically with that commit.
 */
export async function publishProductPhoto(photoId: string, publicationId: string, intent: PublishIntentContext): Promise<PublicVariants> {
  const prisma = getPrisma();
  const root = getConfig().media.root;
  const photo = await prisma.productPhoto.findUniqueOrThrow({ where: { id: photoId } });
  if (!photo.privateStorageKey) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: 'This photo has no private bytes to publish',
    });
  }
  const publicPrefix = publicProductPhotoPrefix(photo.productId, publicationId);

  return withMediaMutationLease('publish_public', async () => {
    await renewMediaOperationLease(intent.intentId, intent.leaseOwner);
    await assertMediaCapacityReservationLive(intent.capacityReservationId);
    await copyKeyPrefix(root, photo.privateStorageKey!, publicPrefix);
    logger.info({ photoId, publicationId, intentId: intent.intentId }, 'copied product photo variants to public storage');
    return {
      publicKey: publicPrefix,
      display: { bytes: photo.displayByteSize, width: photo.displayWidth, height: photo.displayHeight },
      thumb: { bytes: photo.thumbnailByteSize, width: photo.thumbnailWidth, height: photo.thumbnailHeight },
    };
  });
}

/**
 * Same publication primitive as `publishProductPhoto`, but reads a staged
 * `ProductEditPhoto` row instead of a live `ProductPhoto` — used only for a
 * revision's newly-uploaded entries during edit approval; retained entries
 * already have a public key on their source `ProductPhoto` and need no work
 * here. Never touches the DB — the caller's reference transaction writes the
 * returned `publicKey` onto a fresh `ProductPhoto` row.
 */
export async function publishProductEditPhoto(editPhotoId: string, publicationId: string, intent: PublishIntentContext): Promise<PublicVariants> {
  const prisma = getPrisma();
  const root = getConfig().media.root;
  const photo = await prisma.productEditPhoto.findUniqueOrThrow({ where: { id: editPhotoId } });
  if (!photo.privateStorageKey) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: 'This staged photo has no private bytes to publish',
    });
  }
  const publicPrefix = publicProductPhotoPrefix(photo.productEditId, publicationId);

  return withMediaMutationLease('publish_public', async () => {
    await renewMediaOperationLease(intent.intentId, intent.leaseOwner);
    await assertMediaCapacityReservationLive(intent.capacityReservationId);
    await copyKeyPrefix(root, photo.privateStorageKey!, publicPrefix);
    logger.info({ editPhotoId, publicationId, intentId: intent.intentId }, 'copied staged edit photo variants to public storage');
    return {
      publicKey: publicPrefix,
      display: { bytes: photo.displayByteSize!, width: photo.displayWidth!, height: photo.displayHeight! },
      thumb: { bytes: photo.thumbnailByteSize!, width: photo.thumbnailWidth!, height: photo.thumbnailHeight! },
    };
  });
}

// --- Edit-scoped photo staging (creator revision desired-photo-set editing) -------
//
// A `ProductEdit`'s desired photo set mixes `retained` entries (bytes belong to the
// live `ProductPhoto` they reference, immutable here) and `staged` entries (bytes
// belong to this edit alone, served through the edit-scoped private media route
// until approval publishes them). Position/quota/deferred-constraint handling below
// mirrors the live-product functions above exactly, targeting `ProductEditPhoto`
// instead of `ProductPhoto`.

interface EditPhotoMutableRow {
  id: string;
  status: ProductEdit['status'];
  submittedBy: string;
}

function editForbidden(): never {
  throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'This edit cannot be changed right now' });
}

/** Edit-scoped photo staging is creator-only (never admin — admin's photo work is
 * either the direct live-product path above, or `recoverProductEdit`'s reviewed
 * `rebase` mapping, which writes the desired set itself rather than going through
 * these per-photo mutation endpoints). Locked to `draft`/`changes_required`, same as
 * metadata patching — never while `pending` (under review) or any resolved state. */
function checkEditPhotoMutablePolicy(actor: ProductActor, row: EditPhotoMutableRow): void {
  if (row.submittedBy !== actor.id) notFound();
  if (row.status === 'draft' || row.status === 'changes_required') return;
  editForbidden();
}

async function assertEditPhotoMutable(actor: ProductActor, editId: string, tx: PrismaTypes.TransactionClient): Promise<EditPhotoMutableRow> {
  const rows = await tx.$queryRaw<EditPhotoMutableRow[]>`
    SELECT "id", "status", "submitted_by" AS "submittedBy"
    FROM "product_edits"
    WHERE "id" = ${editId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) notFound();
  checkEditPhotoMutablePolicy(actor, row);
  return row;
}

export async function assertEditPhotoMutablePreCheck(actor: ProductActor, editId: string): Promise<void> {
  const edit = await getPrisma().productEdit.findUnique({ where: { id: editId }, select: { id: true, status: true, submittedBy: true } });
  if (!edit) notFound();
  checkEditPhotoMutablePolicy(actor, edit);
}

async function loadEditWithPhotos(tx: PrismaTypes.TransactionClient, editId: string) {
  return tx.productEdit.findUniqueOrThrow({
    where: { id: editId },
    include: { photos: { include: { sourceProductPhoto: true }, orderBy: { position: 'asc' } } },
  });
}

export interface AddProductEditPhotoInput {
  editId: string;
  processed: ProcessedVariants;
  capacityReservationId: string;
}

/** Stages a newly-uploaded photo onto an edit's desired set (always appended at the
 * current end position). Same prepare-intent/promote/complete-in-tx durability
 * pattern as `addProductPhoto`. */
export async function addProductEditPhoto(actor: ProductActor, input: AddProductEditPhotoInput) {
  const prisma = getPrisma();
  const root = getConfig().media.root;
  const photoId = randomUUID();
  const variantId = randomUUID();
  const prefix = privateProductEditPhotoPrefix(input.editId, photoId, variantId);

  return withMediaMutationLease('promote_private', async () => {
    const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: [prefix] }));

    const tempKey = `quarantine/${randomUUID()}-generated`;
    await ensureAndWriteVariantFiles(root, tempKey, input.processed);

    try {
      await promoteKeyPrefix(root, tempKey, prefix);
    } catch (err) {
      await removeKeyPrefix(root, tempKey).catch(() => {});
      throw err;
    }

    // See `addProductPhoto`'s matching comment: renew right before the reference
    // transaction so a slow transaction can't outlive the lease before
    // `completeMediaOperation`'s fencing check runs (reviewer-p3 I1).
    await renewMediaOperationLease(intent.id, intent.leaseOwner);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const edit = await assertEditPhotoMutable(actor, input.editId, tx);
        const currentCount = await tx.productEditPhoto.count({ where: { productEditId: input.editId } });
        if (currentCount >= MAX_PHOTOS_PER_PRODUCT) {
          throw new AppError({
            status: 409,
            code: 'photo_limit_reached',
            title: `A revision may have at most ${MAX_PHOTOS_PER_PRODUCT} photos`,
          });
        }
        await tx.productEditPhoto.create({
          data: {
            id: photoId,
            productEditId: input.editId,
            position: currentCount,
            uploadedByUserId: actor.id,
            mimeType: 'image/webp',
            displayByteSize: input.processed.display.bytes,
            displayWidth: input.processed.display.width,
            displayHeight: input.processed.display.height,
            thumbnailByteSize: input.processed.thumb.bytes,
            thumbnailWidth: input.processed.thumb.width,
            thumbnailHeight: input.processed.thumb.height,
            privateStorageKey: prefix,
          },
        });
        await tx.productEdit.update({ where: { id: edit.id }, data: { version: { increment: 1 } } });
        await completeMediaOperation(tx, intent.id, intent.leaseOwner);
        return loadEditWithPhotos(tx, input.editId);
      });
      return updated;
    } catch (err) {
      await removeKeyPrefix(root, privateProductEditPhotoDir(input.editId, photoId)).catch(() => {});
      throw err;
    }
  }).finally(() => releaseMediaCapacityReservation(input.capacityReservationId));
}

export interface RemoveProductEditPhotoInput {
  editId: string;
  photoId: string;
}

/** Removes an entry from an edit's desired set and closes the position gap. A
 * `retained` entry's removal never touches the live `ProductPhoto` or enqueues any
 * cleanup — those bytes still belong to the live product regardless of this edit's
 * desired set. A `staged` entry's own private bytes are enqueued for durable
 * cleanup, same as a live product photo removal. */
export async function removeProductEditPhoto(actor: ProductActor, input: RemoveProductEditPhotoInput) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const edit = await assertEditPhotoMutable(actor, input.editId, tx);
    const photo = await tx.productEditPhoto.findFirst({ where: { id: input.photoId, productEditId: input.editId } });
    if (!photo) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Photo not found' });
    }

    await tx.$executeRawUnsafe('SET CONSTRAINTS "product_edit_photos_product_edit_id_position_key" DEFERRED');
    await tx.productEditPhoto.delete({ where: { id: photo.id } });

    const remaining = await tx.productEditPhoto.findMany({
      where: { productEditId: input.editId },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      const row = remaining[i]!;
      if (row.position !== i) {
        await tx.productEditPhoto.update({ where: { id: row.id }, data: { position: i } });
      }
    }

    await tx.productEdit.update({ where: { id: edit.id }, data: { version: { increment: 1 } } });

    if (photo.privateStorageKey) {
      await enqueueMediaCleanup(tx, { operation: 'delete_private', keys: [photo.privateStorageKey] });
    }

    return loadEditWithPhotos(tx, input.editId);
  });
}

export interface ReorderProductEditPhotosInput {
  editId: string;
  photoIds: string[];
}

export async function reorderProductEditPhotos(actor: ProductActor, input: ReorderProductEditPhotosInput) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const edit = await assertEditPhotoMutable(actor, input.editId, tx);
    const current = await tx.productEditPhoto.findMany({ where: { productEditId: input.editId } });
    const currentIds = new Set(current.map((p: ProductEditPhoto) => p.id));
    const requestedIds = new Set(input.photoIds);
    const isExactSet =
      input.photoIds.length === current.length &&
      requestedIds.size === input.photoIds.length &&
      [...requestedIds].every((id) => currentIds.has(id));
    if (!isExactSet) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: 'photoIds must contain exactly the edit\'s current photo set',
      });
    }

    await tx.$executeRawUnsafe('SET CONSTRAINTS "product_edit_photos_product_edit_id_position_key" DEFERRED');
    for (let position = 0; position < input.photoIds.length; position++) {
      const id = input.photoIds[position]!;
      await tx.productEditPhoto.update({ where: { id }, data: { position } });
    }
    await tx.productEdit.update({ where: { id: edit.id }, data: { version: { increment: 1 } } });
    return loadEditWithPhotos(tx, input.editId);
  });
}
