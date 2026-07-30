import type { Product, Prisma as PrismaTypes } from '@prisma/client';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { z } from 'zod';
import {
  ERROR_CODES,
  encodeCursor,
  decodeCursor,
  productDraftsPageSchema,
  type Product as ApiProduct,
  type ProductDraftCreateRequest,
  type ProductDraftPatchRequest,
  type ProductDraftsQuery,
  type ProductDraftsPage,
  type ProductDraftRow,
  type ProductLookupV2Response,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { lookupProductV2 } from './lookup.js';
import { toApiProduct } from './serializer.js';
import { PRODUCT_INCLUDE, type ProductWithPhotos } from './product-visibility.js';
import { privateProductPhotoRoute } from './product-media-storage.js';
import { assertProductCreationEligible } from './product-creation-eligibility.js';
import { assertWithinActiveDraftQuota } from './product-creation-quotas.js';

function draftIdentifierInput(input: ProductDraftCreateRequest): { barcode?: string; qr?: string } {
  return input.barcode !== undefined ? { barcode: input.barcode } : { qr: input.qrPayload! };
}

// Every non-"not_found" / non-"editable_private" outcome means the identifier
// already resolves to something a fresh draft cannot claim: an active canonical
// product, the caller's own already-submitted (pending) product, someone else's
// private reservation, or a provider outage. `canonicalProduct` is only ever
// attached when the outcome already authorized that product for this caller.
function throwForNonCreatableOutcome(outcome: ProductLookupV2Response): never {
  if (outcome.outcome === 'found') {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: 'A product already exists for this identifier',
      canonicalProduct: outcome.product,
    });
  }
  if (outcome.outcome === 'creator_pending') {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: 'You already submitted a product for this identifier; it is awaiting review',
      canonicalProduct: outcome.product,
    });
  }
  if (outcome.outcome === 'temporarily_unavailable') {
    throw new AppError({
      status: 503,
      code: ERROR_CODES.TEMPORARILY_UNAVAILABLE,
      title: 'Product lookup is temporarily unavailable; try again shortly',
    });
  }
  // 'under_review' — non-enumerating: no product, no distinction from a
  // report-hidden catalog row or another user's private reservation.
  throw new AppError({
    status: 409,
    code: ERROR_CODES.CONFLICT,
    title: 'This identifier is currently under review',
  });
}

/**
 * Creates a new creator-private draft, or resumes the caller's own existing
 * draft/changes_required product for the same identifier. Always repeats the
 * conclusive lookup server-side first — a client-signed "not found" proof is
 * never trusted, and a reservation created between scan and create is translated
 * through the same visibility classification lookup-v2 uses.
 */
export async function createOrResumeDraft(
  actorId: string,
  input: ProductDraftCreateRequest,
): Promise<{ product: ApiProduct; resumed: boolean }> {
  const identifierInput = draftIdentifierInput(input);
  const outcome = await lookupProductV2(identifierInput, { id: actorId, role: 'user' });

  if (outcome.outcome === 'editable_private') {
    return { product: outcome.product, resumed: true };
  }
  if (outcome.outcome !== 'not_found') {
    throwForNonCreatableOutcome(outcome);
  }

  // Only the actual new-row-creation path is mode-gated — resuming an existing
  // draft above returns already-owned state and never writes, so it stays
  // available regardless of mode (existing drafts remain readable/exportable).
  await assertProductCreationEligible({ id: actorId, role: 'user' }, 'create');
  await assertWithinActiveDraftQuota(actorId);

  const prisma = getPrisma();
  try {
    const created = await prisma.product.create({
      data: {
        ...(input.barcode !== undefined ? { barcode: input.barcode } : { qrPayload: input.qrPayload! }),
        // Name is required by the DB but not part of the create request — the
        // creator fills it in via PATCH before submit is possible.
        name: '',
        source: 'user',
        createdByUserId: actorId,
        status: 'draft',
      },
      include: PRODUCT_INCLUDE,
    });
    return { product: toApiProduct(created), resumed: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost a create race for the same identifier — resolve through the same
      // classification the winner would have produced, never a raw DB retry.
      const raced = await lookupProductV2(identifierInput, { id: actorId, role: 'user' });
      if (raced.outcome === 'editable_private') return { product: raced.product, resumed: true };
      throwForNonCreatableOutcome(raced);
    }
    throw err;
  }
}

function assertOwnDraftLike(product: Product, actorId: string): void {
  if (product.createdByUserId !== actorId) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
  }
  if (product.status !== 'draft' && product.status !== 'changes_required') {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: 'This product can no longer be edited as a draft',
    });
  }
}

export async function patchDraft(
  actorId: string,
  productId: string,
  input: ProductDraftPatchRequest,
): Promise<ApiProduct> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
  }
  assertOwnDraftLike(existing, actorId);
  await assertProductCreationEligible({ id: actorId, role: 'user' }, 'metadata');

  const data: PrismaTypes.ProductUpdateInput = { version: { increment: 1 } };
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.brand !== undefined) data.brand = input.brand;
  if (input.category !== undefined) data.category = input.category;

  // Conditional write: the WHERE clause carries owner, state, AND the caller's
  // last-known version, so this is the actual optimistic-concurrency guard, not
  // just the informative pre-check above (which can go stale between the read
  // and this write under concurrent patches).
  const result = await prisma.product.updateMany({
    where: {
      id: productId,
      createdByUserId: actorId,
      status: { in: ['draft', 'changes_required'] },
      version: input.version,
    },
    data,
  });

  if (result.count === 0) {
    const current = await prisma.product.findUnique({ where: { id: productId } });
    if (!current) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
    }
    // Re-run the informative checks in case ownership/state changed too (e.g. a
    // concurrent submit) — only fall through to version_conflict when those
    // still pass, so the error message matches the real cause.
    assertOwnDraftLike(current, actorId);
    throw new AppError({
      status: 409,
      code: ERROR_CODES.VERSION_CONFLICT,
      title: 'This draft was changed since you last loaded it',
      currentVersion: current.version,
    });
  }

  const updated = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_INCLUDE });
  return toApiProduct(updated);
}

/**
 * Draft submission is not yet available: it requires Phase 7's server-verified
 * abuse-assessment token and `product_creation` rollout mode, neither of which
 * exist yet. This still enforces ownership/state so the endpoint behaves
 * sensibly, but every valid request ends in a typed disabled response — never a
 * silent accept that would let a draft reach `pending` without abuse
 * verification.
 */
export async function submitDraft(actorId: string, productId: string): Promise<never> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
  }
  assertOwnDraftLike(existing, actorId);
  throw new AppError({
    status: 403,
    code: ERROR_CODES.FEATURE_DISABLED,
    title: 'Product submission is not yet available',
  });
}

function toDraftRow(product: ProductWithPhotos): ProductDraftRow {
  const identifier =
    product.barcode !== null
      ? ({ kind: 'barcode', value: product.barcode } as const)
      : ({ kind: 'qr', value: product.qrPayload as string } as const);
  const cover = product.photos[0];
  return {
    id: product.id,
    name: product.name,
    identifier,
    status: product.status as 'draft' | 'pending' | 'changes_required',
    version: product.version,
    moderationFeedback: product.moderationNotes,
    // A draft/changes_required product's cover is always private (approval only
    // happens on the active transition), so the parent-bound private route applies
    // unconditionally here — no public-URL branch needed, unlike the general
    // product photo serializer.
    cover: cover ? { photoId: cover.id, thumbnailUrl: privateProductPhotoRoute(product.id, cover.id, 'thumb') } : null,
    updatedAt: product.updatedAt.toISOString(),
  };
}

// `decodeCursor` only base64/JSON-decodes and wraps `t` in `new Date(...)` — it
// does not validate the result is a real date or that `i` looks like an ID.
// `z.date()` alone would accept an Invalid Date (still `instanceof Date`), so
// the timestamp is explicitly re-validated here too.
const draftsCursorPositionSchema = z.object({
  t: z.date().refine((d) => !Number.isNaN(d.getTime()), 'invalid cursor timestamp'),
  i: z.string().uuid(),
});

/** Cursor-paginated list of the caller's own private drafts only — never
 * another user's rows, and never the admin/global moderation queue. */
export async function listDrafts(actorId: string, query: ProductDraftsQuery): Promise<ProductDraftsPage> {
  const prisma = getPrisma();
  const decoded = decodeCursor(query.cursor);
  let cursor: { t: Date; i: string } | null = null;
  if (decoded) {
    const parsed = draftsCursorPositionSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'Invalid cursor' });
    }
    cursor = parsed.data;
  }
  const rows = await prisma.product.findMany({
    where: {
      createdByUserId: actorId,
      status: query.status ?? { in: ['draft', 'pending', 'changes_required'] },
      ...(cursor
        ? {
            OR: [
              { updatedAt: { lt: cursor.t } },
              { AND: [{ updatedAt: cursor.t }, { id: { lt: cursor.i } }] },
            ],
          }
        : {}),
    },
    include: { photos: { orderBy: { position: 'asc' }, take: 1 } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = (hasMore ? rows.slice(0, -1) : rows).map(toDraftRow);
  const last = items.at(-1);
  return productDraftsPageSchema.parse({
    items,
    nextCursor: hasMore && last ? encodeCursor(new Date(last.updatedAt), last.id) : null,
  });
}
