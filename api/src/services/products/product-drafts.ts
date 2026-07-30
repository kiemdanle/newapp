import type { Product, ProductPhoto, Prisma as PrismaTypes } from '@prisma/client';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
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
      code: 'temporarily_unavailable',
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

  const data: PrismaTypes.ProductUpdateInput = { version: { increment: 1 } };
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.brand !== undefined) data.brand = input.brand;
  if (input.category !== undefined) data.category = input.category;

  const updated = await prisma.product.update({ where: { id: productId }, data });
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
    code: 'feature_disabled',
    title: 'Product submission is not yet available',
  });
}

function toDraftRow(product: Product & { photos: ProductPhoto[] }): ProductDraftRow {
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
    cover: cover ? { photoId: cover.id, thumbnailUrl: `/v1/products/photos/${cover.id}/thumbnail` } : null,
    updatedAt: product.updatedAt.toISOString(),
  };
}

/** Cursor-paginated list of the caller's own private drafts only — never
 * another user's rows, and never the admin/global moderation queue. */
export async function listDrafts(actorId: string, query: ProductDraftsQuery): Promise<ProductDraftsPage> {
  const prisma = getPrisma();
  const cursor = decodeCursor(query.cursor);
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
