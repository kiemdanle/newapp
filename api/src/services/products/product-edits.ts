import { randomUUID } from 'node:crypto';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import type { Prisma as PrismaTypes, ProductEditPhoto as PrismaProductEditPhoto } from '@prisma/client';
import {
  ERROR_CODES,
  productEditRowSchema,
  type Product as ApiProduct,
  type ProductEditMetadataPatchRequest,
  type ProductEditRecoverRequest,
  type ProductEditRow,
} from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { writeAuditLog } from '../audit/log.js';
import type { RequestMeta } from './product-moderation.js';
import { getVisibleProduct, type ProductActor } from './product-visibility.js';
import { toApiProduct } from './serializer.js';
import { withMediaMutationLease } from './product-media-coordinator.js';
import {
  completeMediaOperation,
  enqueueMediaCleanup,
  prepareMediaOperation,
  MediaOperationFencedError,
} from './product-media-outbox.js';
import {
  reconcileMediaCapacityReservation,
  releaseMediaCapacityReservation,
  reserveMediaCapacity,
} from './product-media-capacity.js';
import { publishProductEditPhoto } from './product-photos.js';
import {
  privateProductEditPhotoRoute,
  privateProductPhotoRoute,
  publicMediaUrl,
  publicProductPhotoPrefix,
  removeKeyPrefix,
} from './product-media-storage.js';

const EDIT_INCLUDE = { photos: { include: { sourceProductPhoto: true }, orderBy: { position: 'asc' as const } } };
type EditWithPhotos = PrismaTypes.ProductEditGetPayload<{ include: typeof EDIT_INCLUDE }>;
type ProposedMetadata = { name?: string; description?: string | null; brand?: string | null; category?: string | null };

function notFound(): never {
  throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Revision not found' });
}

// Route placement (`adminOnlyPlugin`) is the only thing enforcing this today, but
// these functions are exported and the admin-only branches (approve/
// request_changes/rebase/supersede) are the moderation authority — a same-module
// check makes the invariant local rather than positional (M7).
function assertAdmin(actor: ProductActor): void {
  if (actor.role !== 'admin') {
    throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Admin role required' });
  }
}

function editVersionConflict(currentVersion: number): never {
  throw new AppError({
    status: 409,
    code: ERROR_CODES.VERSION_CONFLICT,
    title: 'This revision was changed since you last loaded it',
    currentVersion,
  });
}

function staleBaseConflict(currentProductVersion: number): never {
  throw new AppError({
    status: 409,
    code: 'edit_base_stale',
    title: 'The product changed since this revision was based on it; an admin must rebase or supersede it',
    currentVersion: currentProductVersion,
  });
}

function toApiEditPhoto(photo: PrismaProductEditPhoto & { sourceProductPhoto: { productId: string; publicStorageKey: string | null } | null }, editId: string) {
  if (photo.sourceProductPhotoId && photo.sourceProductPhoto) {
    const src = photo.sourceProductPhoto;
    if (src.publicStorageKey) {
      const base = getConfig().media.publicBaseUrl;
      return {
        id: photo.id,
        position: photo.position,
        retained: true,
        thumbnailUrl: publicMediaUrl(base, src.publicStorageKey, 'thumb'),
        displayUrl: publicMediaUrl(base, src.publicStorageKey, 'display'),
      };
    }
    // Defensive only: a retained entry's source is always an active (published)
    // product's photo by construction, so this branch should never execute.
    return {
      id: photo.id,
      position: photo.position,
      retained: true,
      thumbnailUrl: privateProductPhotoRoute(src.productId, photo.sourceProductPhotoId, 'thumb'),
      displayUrl: privateProductPhotoRoute(src.productId, photo.sourceProductPhotoId, 'display'),
    };
  }
  return {
    id: photo.id,
    position: photo.position,
    retained: false,
    thumbnailUrl: privateProductEditPhotoRoute(editId, photo.id, 'thumb'),
    displayUrl: privateProductEditPhotoRoute(editId, photo.id, 'display'),
  };
}

/** Exported for the edit-scoped photo mutation routes, whose underlying functions
 * live in `product-photos.ts` (shared position/deferred-constraint reindex logic
 * with the live-product photo functions) but return the raw Prisma row — this is
 * the one place that owns turning that row into the public `ProductEditRow` DTO. */
export function toProductEditRow(edit: EditWithPhotos): ProductEditRow {
  const proposed = edit.proposed as ProposedMetadata;
  return productEditRowSchema.parse({
    id: edit.id,
    productId: edit.productId,
    status: edit.status,
    version: edit.version,
    baseProductVersion: edit.baseProductVersion,
    name: proposed.name ?? '',
    description: proposed.description ?? null,
    brand: proposed.brand ?? null,
    category: proposed.category ?? null,
    photos: [...edit.photos].sort((a, b) => a.position - b.position).map((p) => toApiEditPhoto(p, edit.id)),
    moderationFeedback: edit.moderationNotes,
    submittedAt: edit.submittedAt ? edit.submittedAt.toISOString() : null,
    updatedAt: edit.updatedAt.toISOString(),
  });
}

/**
 * Creates a new open revision for an active product, or resumes the caller's own
 * existing draft/changes_required revision for it. The desired photo set is
 * initialized from the product's current live photos (all `retained`) only on
 * create — resuming never re-seeds it, so in-progress staging/removal survives a
 * repeated resume call. A `pending` revision (already submitted, under review) is
 * not resumable — the creator must wait for it to resolve.
 */
export async function createOrResumeProductEdit(
  actor: ProductActor,
  productId: string,
): Promise<{ edit: ProductEditRow; resumed: boolean }> {
  const product = await getVisibleProduct(actor, productId);
  if (!product || product.status !== 'active') notFound();
  const prisma = getPrisma();

  const existing = await prisma.productEdit.findFirst({
    where: { productId: product.id, submittedBy: actor.id, isLegacy: false, status: { in: ['draft', 'pending', 'changes_required'] } },
    include: EDIT_INCLUDE,
  });
  if (existing) {
    if (existing.status === 'pending') {
      throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'A revision is already open for this product' });
    }
    return { edit: toProductEditRow(existing), resumed: true };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const edit = await tx.productEdit.create({
        data: {
          productId: product.id,
          submittedBy: actor.id,
          proposed: {
            name: product.name,
            description: product.description,
            brand: product.brand,
            category: product.category,
          },
          status: 'draft',
          isLegacy: false,
          baseProductVersion: product.version,
        },
      });
      const livePhotos = await tx.productPhoto.findMany({ where: { productId: product.id }, orderBy: { position: 'asc' } });
      for (const p of livePhotos) {
        await tx.productEditPhoto.create({ data: { productEditId: edit.id, position: p.position, sourceProductPhotoId: p.id } });
      }
      return tx.productEdit.findUniqueOrThrow({ where: { id: edit.id }, include: EDIT_INCLUDE });
    });
    return { edit: toProductEditRow(created), resumed: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await prisma.productEdit.findFirst({
        where: { productId: product.id, submittedBy: actor.id, isLegacy: false, status: { in: ['draft', 'pending', 'changes_required'] } },
        include: EDIT_INCLUDE,
      });
      if (raced) {
        if (raced.status === 'pending') {
          throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'A revision is already open for this product' });
        }
        return { edit: toProductEditRow(raced), resumed: true };
      }
    }
    throw err;
  }
}

async function loadOwnOpenEdit(actor: ProductActor, editId: string): Promise<EditWithPhotos> {
  const edit = await getPrisma().productEdit.findUnique({ where: { id: editId }, include: EDIT_INCLUDE });
  if (!edit || edit.submittedBy !== actor.id || edit.isLegacy) notFound();
  if (edit.status !== 'draft' && edit.status !== 'changes_required') {
    throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'This revision can no longer be changed directly' });
  }
  return edit;
}

/** Metadata-only patch to an open revision's proposed state. Always updates the
 * complete `proposed` snapshot in place (never a partial merge at read time) so the
 * row is always safe to render directly — see `createOrResumeProductEdit`'s seeding
 * comment. */
export async function patchProductEditMetadata(
  actor: ProductActor,
  editId: string,
  input: ProductEditMetadataPatchRequest,
): Promise<ProductEditRow> {
  const edit = await loadOwnOpenEdit(actor, editId);
  const proposed: ProposedMetadata = { ...(edit.proposed as ProposedMetadata) };
  if (input.name !== undefined) proposed.name = input.name;
  if (input.description !== undefined) proposed.description = input.description;
  if (input.brand !== undefined) proposed.brand = input.brand;
  if (input.category !== undefined) proposed.category = input.category;

  const prisma = getPrisma();
  const result = await prisma.productEdit.updateMany({
    where: { id: editId, submittedBy: actor.id, status: { in: ['draft', 'changes_required'] }, version: input.version },
    data: { proposed, version: { increment: 1 } },
  });
  if (result.count === 0) {
    const current = await prisma.productEdit.findUnique({ where: { id: editId } });
    if (!current || current.submittedBy !== actor.id) notFound();
    editVersionConflict(current.version);
  }
  const updated = await prisma.productEdit.findUniqueOrThrow({ where: { id: editId }, include: EDIT_INCLUDE });
  return toProductEditRow(updated);
}

export interface ResolveProductEditInput {
  editId: string;
  action: 'submit' | 'approve' | 'request_changes';
  version: number;
  notes?: string | undefined;
}

async function submitProductEdit(actor: ProductActor, editId: string, version: number): Promise<ProductEditRow> {
  const prisma = getPrisma();
  const result = await prisma.productEdit.updateMany({
    where: { id: editId, submittedBy: actor.id, isLegacy: false, status: { in: ['draft', 'changes_required'] }, version },
    data: { status: 'pending', submittedAt: new Date(), moderationNotes: null, resolvedBy: null, resolvedAt: null, version: { increment: 1 } },
  });
  if (result.count === 0) {
    const current = await prisma.productEdit.findUnique({ where: { id: editId } });
    if (!current || current.submittedBy !== actor.id) notFound();
    editVersionConflict(current.version);
  }
  const updated = await prisma.productEdit.findUniqueOrThrow({ where: { id: editId }, include: EDIT_INCLUDE });
  return toProductEditRow(updated);
}

async function requestChangesOnEdit(
  actor: ProductActor,
  requestMeta: RequestMeta,
  editId: string,
  version: number,
  notes: string | undefined,
): Promise<ProductEditRow> {
  assertAdmin(actor);
  const prisma = getPrisma();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.productEdit.updateMany({
      where: { id: editId, status: 'pending', version },
      data: { status: 'changes_required', moderationNotes: notes ?? null, resolvedBy: actor.id, resolvedAt: new Date(), version: { increment: 1 } },
    });
    if (result.count === 0) {
      const current = await tx.productEdit.findUnique({ where: { id: editId } });
      if (!current) notFound();
      editVersionConflict(current.version);
    }
    await writeAuditLog(
      {
        adminId: actor.id,
        action: 'product_edit.resolve',
        targetType: 'product_edit',
        targetId: editId,
        diff: { before: { status: 'pending' }, after: { decision: 'request_changes', notes: notes ?? null } },
        requestId: requestMeta.requestId,
        ip: requestMeta.ip,
      },
      tx,
    );
    return tx.productEdit.findUniqueOrThrow({ where: { id: editId }, include: EDIT_INCLUDE });
  });
  return toProductEditRow(updated);
}

interface DesiredEntry {
  id: string;
  position: number;
  sourceProductPhotoId: string | null;
  privateStorageKey: string | null;
  uploadedByUserId: string | null;
  mimeType: string | null;
  displayByteSize: number | null;
  displayWidth: number | null;
  displayHeight: number | null;
  thumbnailByteSize: number | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
}

/**
 * Approves a pending revision: validates the edit is still based on the product's
 * current version (otherwise the stale-base path applies — admin `rebase`/
 * `supersede`, never auto-approval), publishes every staged desired entry to a
 * fresh public key, then atomically applies the complete metadata + photo order to
 * the live product. Live photos dropped from the desired set are removed — first
 * verifying no *other open* revision still retains them (an admin must rebase or
 * supersede those first; this function never does it silently); a *resolved*
 * (approved/rejected) edit's historical retained-photo row is removed instead of
 * blocking, since `onDelete: Restrict` would otherwise make the photo permanently
 * undeletable. Legacy compatibility `imageUrl` is only recalculated when the
 * relation-backed photo set actually changed (add/remove/reorder) — a pure
 * metadata edit leaves it untouched.
 */
async function approveEdit(actor: ProductActor, requestMeta: RequestMeta, editId: string, version: number): Promise<ApiProduct> {
  assertAdmin(actor);
  const prisma = getPrisma();
  const editRow = await prisma.productEdit.findUnique({ where: { id: editId }, include: EDIT_INCLUDE });
  if (!editRow) notFound();
  // Re-bound with an explicitly non-nullable type: TS control-flow narrowing from
  // the `notFound()` (`never`-returning) check above does not persist into the
  // nested `applyReference` closure below without this.
  const edit: NonNullable<typeof editRow> = editRow;
  if (edit.status !== 'pending') {
    throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'This revision is not awaiting review' });
  }
  if (edit.version !== version) editVersionConflict(edit.version);

  const productRow = await prisma.product.findUnique({ where: { id: edit.productId } });
  if (!productRow || productRow.status !== 'active') {
    throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'The underlying product is no longer active' });
  }
  const product: NonNullable<typeof productRow> = productRow;
  if (product.version !== edit.baseProductVersion) staleBaseConflict(product.version);

  const desired: DesiredEntry[] = [...edit.photos].sort((a, b) => a.position - b.position);
  const staged = desired.filter((p) => !p.sourceProductPhotoId && p.privateStorageKey);
  const retainedSourceIds = new Set(desired.filter((p) => p.sourceProductPhotoId).map((p) => p.sourceProductPhotoId!));

  const liveProductPhotos = await prisma.productPhoto.findMany({ where: { productId: product.id } });
  const liveProductPhotosById = new Map(liveProductPhotos.map((p) => [p.id, p]));
  const removedLivePhotos = liveProductPhotos.filter((p) => !retainedSourceIds.has(p.id));
  const originalPositionBySourceId = new Map(liveProductPhotos.map((p) => [p.id, p.position]));
  const photoSetChanged =
    staged.length > 0 ||
    removedLivePhotos.length > 0 ||
    desired.some((e) => e.sourceProductPhotoId !== null && originalPositionBySourceId.get(e.sourceProductPhotoId) !== e.position);

  // "Admin photo correction must first rebase or supersede every open edit
  // referencing the photo" — a dropped live photo still retained by some *other
  // open* revision blocks this approval outright rather than silently invalidating
  // that other revision's desired set. This pre-check avoids wasted publish work
  // for the common case; the transaction below re-verifies it under lock (a new
  // open edit could theoretically appear in the window between this check and the
  // commit) before actually deleting anything.
  async function assertNoOpenEditBlocksRemoval(db: PrismaTypes.TransactionClient | ReturnType<typeof getPrisma>): Promise<void> {
    for (const removed of removedLivePhotos) {
      const blocker = await db.productEditPhoto.findFirst({
        where: { sourceProductPhotoId: removed.id, productEditId: { not: editId }, productEdit: { status: { in: ['draft', 'pending', 'changes_required'] }, isLegacy: false } },
      });
      if (blocker) {
        throw new AppError({
          status: 409,
          code: 'photo_referenced_by_open_edit',
          title: 'A photo in this revision is still referenced by another open revision; rebase or supersede it first',
        });
      }
    }
  }
  await assertNoOpenEditBlocksRemoval(prisma);

  const root = getConfig().media.root;
  const totalBytes = staged.reduce((sum, p) => sum + (p.displayByteSize ?? 0) + (p.thumbnailByteSize ?? 0), 0);
  const reservation = staged.length > 0 ? await reserveMediaCapacity({ bytes: totalBytes }) : null;

  async function applyReference(publishResults: Map<string, { publicKey: string; display: { bytes: number; width: number; height: number }; thumb: { bytes: number; width: number; height: number } }>, intent: { id: string; leaseOwner: string } | null) {
    return prisma.$transaction(async (tx) => {
      // `proposed` is a partial diff, not a full snapshot: both `createOrResumeProductEdit`
      // (which seeds every field) and the legacy one-shot `PATCH /v1/products/:id` route
      // (which only ever includes fields the caller actually supplied) write into this
      // same column, so a key's *absence* must mean "leave unchanged," never "clear to
      // null" — otherwise approving an old-style name-only edit would wipe out the
      // product's existing description/brand/category.
      const proposed = edit.proposed as ProposedMetadata;

      // Cover `imageUrl` is only recomputed when the photo set genuinely changed
      // (I4) — a pure metadata edit must never touch it (legacy compatibility).
      let coverImageUrl: string | null | undefined;
      if (photoSetChanged) {
        const coverEntry = desired.find((e) => e.position === 0);
        let coverPublicKey: string | null = null;
        if (coverEntry?.sourceProductPhotoId) {
          coverPublicKey = liveProductPhotosById.get(coverEntry.sourceProductPhotoId)?.publicStorageKey ?? null;
        } else if (coverEntry) {
          coverPublicKey = publishResults.get(coverEntry.id)?.publicKey ?? null;
        }
        coverImageUrl = coverPublicKey ? publicMediaUrl(getConfig().media.publicBaseUrl, coverPublicKey, 'display') : null;
      }

      const productUpdate = await tx.product.updateMany({
        where: { id: product.id, status: 'active', version: edit.baseProductVersion },
        data: {
          name: 'name' in proposed ? proposed.name : product.name,
          description: 'description' in proposed ? (proposed.description ?? null) : product.description,
          brand: 'brand' in proposed ? (proposed.brand ?? null) : product.brand,
          category: 'category' in proposed ? (proposed.category ?? null) : product.category,
          ...(coverImageUrl !== undefined ? { imageUrl: coverImageUrl } : {}),
          version: { increment: 1 },
        },
      });
      if (productUpdate.count === 0) {
        const current = await tx.product.findUnique({ where: { id: product.id } });
        staleBaseConflict(current?.version ?? product.version);
      }

      // Re-verify under lock: a new open edit could have started retaining a
      // to-be-removed photo since the pre-check above.
      await assertNoOpenEditBlocksRemoval(tx);

      await tx.$executeRawUnsafe('SET CONSTRAINTS "product_photos_product_id_position_key" DEFERRED');
      for (const entry of desired) {
        if (entry.sourceProductPhotoId) {
          await tx.productPhoto.update({ where: { id: entry.sourceProductPhotoId }, data: { position: entry.position } });
        } else {
          const published = publishResults.get(entry.id);
          if (!published) throw new Error('missing publish result for staged edit photo');
          await tx.productPhoto.create({
            data: {
              productId: product.id,
              position: entry.position,
              uploadedByUserId: entry.uploadedByUserId ?? actor.id,
              moderationStatus: 'approved',
              mimeType: entry.mimeType ?? 'image/webp',
              displayByteSize: published.display.bytes,
              displayWidth: published.display.width,
              displayHeight: published.display.height,
              thumbnailByteSize: published.thumb.bytes,
              thumbnailWidth: published.thumb.width,
              thumbnailHeight: published.thumb.height,
              publicStorageKey: published.publicKey,
            },
          });
        }
      }

      for (const removed of removedLivePhotos) {
        // A *resolved* (approved/rejected) historical edit's retained-photo row
        // still points at this photo via `onDelete: Restrict` — an open edit
        // already blocked the delete above, but resolved history never should
        // (I1). Nulling the FK alone is not an option: `ProductEditPhoto`'s
        // representation check constraint is a strict XOR between "retained"
        // (source id set, every staged field null) and "staged" (source id null,
        // every staged field set) — a row with neither violates the constraint.
        // Since there are no staged bytes to fill in for a historical retained
        // row, the row itself is removed instead; the parent `ProductEdit`'s own
        // row (status/`proposed` snapshot/audit trail) remains full history, only
        // this one now-meaningless photo-slot entry is gone.
        await tx.productEditPhoto.deleteMany({ where: { sourceProductPhotoId: removed.id } });
        await tx.productPhoto.delete({ where: { id: removed.id } });
        if (removed.publicStorageKey) {
          await enqueueMediaCleanup(tx, { operation: 'delete_public', keys: [removed.publicStorageKey] });
        }
      }

      for (const entry of staged) {
        if (entry.privateStorageKey) {
          await enqueueMediaCleanup(tx, { operation: 'delete_private', keys: [entry.privateStorageKey] });
        }
      }

      // Guarded like every other Phase 4 terminal write (I3): a concurrent
      // supersede/request_changes/resubmit that already moved this edit off
      // `pending` (or bumped its version) must make this approval lose cleanly,
      // never silently overwrite whatever that action just committed.
      const editUpdateResult = await tx.productEdit.updateMany({
        where: { id: edit.id, status: 'pending', version: edit.version },
        data: { status: 'approved', resolvedBy: actor.id, resolvedAt: new Date(), version: { increment: 1 } },
      });
      if (editUpdateResult.count === 0) {
        const current = await tx.productEdit.findUnique({ where: { id: edit.id }, select: { version: true } });
        editVersionConflict(current?.version ?? edit.version);
      }

      await writeAuditLog(
        {
          adminId: actor.id,
          action: 'product_edit.resolve',
          targetType: 'product_edit',
          targetId: edit.id,
          diff: { before: { status: 'pending' }, after: { decision: 'approve', publishedPhotos: staged.length, removedPhotos: removedLivePhotos.length } },
          requestId: requestMeta.requestId,
          ip: requestMeta.ip,
        },
        tx,
      );
      if (intent) await completeMediaOperation(tx, intent.id, intent.leaseOwner);

      return toApiProduct(await tx.product.findUniqueOrThrow({ where: { id: product.id }, include: { photos: { orderBy: { position: 'asc' } } } }), { kind: 'privileged' });
    });
  }

  if (staged.length === 0) {
    return applyReference(new Map(), null);
  }

  try {
    const result = await withMediaMutationLease('publish_public', async () => {
      const publicationIds = staged.map(() => randomUUID());
      const targetKeys = staged.map((p, i) => publicProductPhotoPrefix(product.id, publicationIds[i]!));
      const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'publish_public', keys: targetKeys }));

      const publishResults = new Map<string, { publicKey: string; display: { bytes: number; width: number; height: number }; thumb: { bytes: number; width: number; height: number } }>();
      for (let i = 0; i < staged.length; i++) {
        const published = await publishProductEditPhoto(staged[i]!.id, publicationIds[i]!, product.id, {
          intentId: intent.id,
          leaseOwner: intent.leaseOwner,
          capacityReservationId: reservation!.id,
        });
        publishResults.set(staged[i]!.id, published);
      }

      try {
        return await applyReference(publishResults, intent);
      } catch (err) {
        await Promise.all(targetKeys.map((key) => removeKeyPrefix(root, key).catch(() => {})));
        if (err instanceof MediaOperationFencedError) {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.CONFLICT,
            title: 'This approval lost a race with cleanup recovery; please retry',
          });
        }
        throw err;
      }
    });
    await reconcileMediaCapacityReservation(reservation!.id, totalBytes);
    return result;
  } finally {
    if (reservation) await releaseMediaCapacityReservation(reservation.id);
  }
}

/**
 * Resolves a revision: `submit` (creator, draft/changes_required -> pending),
 * `approve` (admin, publishes and applies to the live product), or
 * `request_changes` (admin, returns it to the creator with a reason). Never
 * writes `rejected` — that is `recoverProductEdit`'s explicit `supersede` action.
 */
export async function resolveProductEdit(
  actor: ProductActor,
  requestMeta: RequestMeta,
  input: ResolveProductEditInput,
): Promise<ApiProduct | ProductEditRow> {
  if (input.action === 'submit') return submitProductEdit(actor, input.editId, input.version);
  if (input.action === 'request_changes') return requestChangesOnEdit(actor, requestMeta, input.editId, input.version, input.notes);
  return approveEdit(actor, requestMeta, input.editId, input.version);
}

const SUPERSEDED_STALE_BASE_REASON = 'superseded:stale_base_version';

/**
 * Recovers a stale open revision (`product.version !== edit.baseProductVersion`
 * — recovery is not applicable to a healthy edit, and both actions require this
 * explicitly, not just the caller's version-guard tokens matching). `rebase`
 * requires the admin's own reviewed desired-photo mapping (never auto-computed
 * from a diff), is restricted to an already-submitted revision
 * (`pending`/`changes_required` — a never-submitted `draft` cannot be pushed into
 * the moderation queue this way), and returns the edit to `pending` for
 * re-review. `supersede` closes it as terminal historical `rejected` (may
 * legitimately apply to a stale `draft` too, since it never re-enters review),
 * using `ProductEdit.notes` (never `moderationNotes`, which stays admin-free-text
 * -only) to record a fixed, machine-safe reason distinguishable from any admin
 * decision text — and frees the one-open-edit slot so the creator can start
 * again. Neither action clears unread creator feedback when the admin doesn't
 * supply new notes.
 */
export async function recoverProductEdit(actor: ProductActor, requestMeta: RequestMeta, input: ProductEditRecoverRequest & { editId: string }): Promise<ProductEditRow> {
  assertAdmin(actor);
  const prisma = getPrisma();
  const edit = await prisma.productEdit.findUnique({ where: { id: input.editId }, include: EDIT_INCLUDE });
  if (!edit) notFound();
  if (edit.version !== input.editVersion) editVersionConflict(edit.version);
  const product = await prisma.product.findUnique({ where: { id: edit.productId } });
  if (!product) notFound();
  if (product.version !== input.productVersion) staleBaseConflict(product.version);
  if (edit.status !== 'pending' && edit.status !== 'draft' && edit.status !== 'changes_required') {
    throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'This revision is already resolved' });
  }
  if (product.version === edit.baseProductVersion) {
    throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'This revision is not stale; recovery is not applicable' });
  }
  if (input.action === 'rebase' && edit.status === 'draft') {
    throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'A never-submitted draft cannot be rebased into the moderation queue' });
  }

  if (input.action === 'supersede') {
    const updated = await prisma.$transaction(async (tx) => {
      // Lock the edit row before re-reading its staged photos (M3): photo staging
      // is permitted while the edit is `draft`, and this same lock is what
      // `assertEditPhotoMutable` takes for a concurrent upload, so re-reading here
      // under the lock (rather than trusting the pre-transaction snapshot) means an
      // upload landing in the window is either fully visible (and enqueued for
      // cleanup) or blocked until this transaction commits — never silently missed.
      await tx.$queryRaw`SELECT id FROM product_edits WHERE id = ${edit.id}::uuid FOR UPDATE`;
      const currentPhotos = await tx.productEditPhoto.findMany({ where: { productEditId: edit.id } });
      const stagedKeys = currentPhotos.filter((p) => !p.sourceProductPhotoId && p.privateStorageKey).map((p) => p.privateStorageKey!);

      const result = await tx.productEdit.updateMany({
        where: { id: edit.id, version: input.editVersion },
        data: {
          status: 'rejected',
          notes: SUPERSEDED_STALE_BASE_REASON,
          // Preserve unread creator feedback (M2) when the admin doesn't supply a
          // new note — never blindly null it out on a state transition.
          moderationNotes: input.notes !== undefined ? input.notes : edit.moderationNotes,
          resolvedBy: actor.id,
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const current = await tx.productEdit.findUnique({ where: { id: edit.id }, select: { version: true } });
        editVersionConflict(current?.version ?? edit.version);
      }
      if (stagedKeys.length > 0) {
        await enqueueMediaCleanup(tx, { operation: 'delete_private', keys: stagedKeys });
      }
      await writeAuditLog(
        {
          adminId: actor.id,
          action: 'product_edit.supersede',
          targetType: 'product_edit',
          targetId: edit.id,
          diff: { before: { status: edit.status }, after: { status: 'rejected', reason: SUPERSEDED_STALE_BASE_REASON } },
          requestId: requestMeta.requestId,
          ip: requestMeta.ip,
        },
        tx,
      );
      return tx.productEdit.findUniqueOrThrow({ where: { id: edit.id }, include: EDIT_INCLUDE });
    });
    return toProductEditRow(updated);
  }

  // rebase: rebuild the desired set exactly as the admin's reviewed mapping specifies.
  const liveIds = new Set((await prisma.productPhoto.findMany({ where: { productId: product.id }, select: { id: true } })).map((p) => p.id));
  const currentStagedById = new Map(edit.photos.filter((p) => !p.sourceProductPhotoId).map((p) => [p.id, p]));
  for (const entry of input.desiredPhotoOrder) {
    if (entry.type === 'retained' && !liveIds.has(entry.sourceProductPhotoId)) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'desiredPhotoOrder references a photo that is not currently live on the product' });
    }
    if (entry.type === 'staged' && !currentStagedById.has(entry.editPhotoId)) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'desiredPhotoOrder references a staged photo that does not belong to this revision' });
    }
  }

  const keptStagedIds = new Set(input.desiredPhotoOrder.filter((e) => e.type === 'staged').map((e) => e.editPhotoId));
  const droppedStagedKeys = [...currentStagedById.values()].filter((p) => !keptStagedIds.has(p.id) && p.privateStorageKey).map((p) => p.privateStorageKey!);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET CONSTRAINTS "product_edit_photos_product_edit_id_position_key" DEFERRED');
    // Clear every existing entry's position out of the way first (deferred), then
    // delete dropped-staged entries and rewrite the kept/retained set to the
    // reviewed order in one pass — never upsert against the deferrable unique
    // constraint.
    await tx.productEditPhoto.deleteMany({ where: { productEditId: edit.id, id: { in: [...currentStagedById.keys()].filter((id) => !keptStagedIds.has(id)) } } });
    const retainedRows = edit.photos.filter((p) => p.sourceProductPhotoId);
    const retainedBySourceId = new Map(retainedRows.map((p) => [p.sourceProductPhotoId!, p]));

    for (let position = 0; position < input.desiredPhotoOrder.length; position++) {
      const desiredEntry = input.desiredPhotoOrder[position]!;
      if (desiredEntry.type === 'retained') {
        const existingRow = retainedBySourceId.get(desiredEntry.sourceProductPhotoId);
        if (existingRow) {
          await tx.productEditPhoto.update({ where: { id: existingRow.id }, data: { position } });
        } else {
          await tx.productEditPhoto.create({ data: { productEditId: edit.id, position, sourceProductPhotoId: desiredEntry.sourceProductPhotoId } });
        }
      } else {
        await tx.productEditPhoto.update({ where: { id: desiredEntry.editPhotoId }, data: { position } });
      }
    }
    // Any retained row not present in the new mapping is dropped from the desired
    // set. Computed as an explicit id list (not a `notIn`/null-exclusion filter) so
    // this never depends on how the query engine handles NULL inside `NOT IN`.
    const keptSourceIds = new Set(input.desiredPhotoOrder.filter((e) => e.type === 'retained').map((e) => e.sourceProductPhotoId));
    const droppedRetainedIds = retainedRows.filter((p) => !keptSourceIds.has(p.sourceProductPhotoId!)).map((p) => p.id);
    if (droppedRetainedIds.length > 0) {
      await tx.productEditPhoto.deleteMany({ where: { productEditId: edit.id, id: { in: droppedRetainedIds } } });
    }

    if (droppedStagedKeys.length > 0) {
      await enqueueMediaCleanup(tx, { operation: 'delete_private', keys: droppedStagedKeys });
    }

    const rebaseResult = await tx.productEdit.updateMany({
      where: { id: edit.id, version: input.editVersion },
      data: {
        status: 'pending',
        baseProductVersion: product.version,
        // Preserve unread creator feedback (M2) when the admin doesn't supply a
        // new note — a rebase with no notes must not silently wipe a previous
        // request_changes reason the creator may not have read yet.
        moderationNotes: input.notes !== undefined ? input.notes : edit.moderationNotes,
        submittedAt: new Date(),
        resolvedBy: null,
        resolvedAt: null,
        version: { increment: 1 },
      },
    });
    if (rebaseResult.count === 0) {
      const current = await tx.productEdit.findUnique({ where: { id: edit.id }, select: { version: true } });
      editVersionConflict(current?.version ?? edit.version);
    }

    await writeAuditLog(
      {
        adminId: actor.id,
        action: 'product_edit.rebase',
        targetType: 'product_edit',
        targetId: edit.id,
        diff: { before: { baseProductVersion: edit.baseProductVersion }, after: { baseProductVersion: product.version } },
        requestId: requestMeta.requestId,
        ip: requestMeta.ip,
      },
      tx,
    );

    return tx.productEdit.findUniqueOrThrow({ where: { id: edit.id }, include: EDIT_INCLUDE });
  });
  return toProductEditRow(updated);
}
