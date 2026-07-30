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
  type ProductDraftSubmitRequest,
  type ProductDraftsQuery,
  type ProductDraftsPage,
  type ProductDraftRow,
  type ProductLookupV2Response,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { hasLocalMatch, lookupProductV2 } from './lookup.js';
import { toApiProduct } from './serializer.js';
import { PRODUCT_INCLUDE, type ProductWithPhotos } from './product-visibility.js';
import { privateProductPhotoRoute } from './product-media-storage.js';
import { assertProductCreationEligible } from './product-creation-eligibility.js';
import { assertWithinActiveDraftQuota } from './product-creation-quotas.js';
import { assessProductCreationSubmission } from '../abuse/product-creation-assessment.js';

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

/** The real, authenticated actor performing a draft mutation — threaded
 * through every call site so the mode-gate/eligibility check evaluates the
 * actor's actual role, never a hardcoded stand-in (reviewer-p7 I6: `internal`
 * mode's admin grant was silently defeated because create/patch/submit each
 * hardcoded `{ role: 'user' }` regardless of who was actually calling). */
export interface DraftActor {
  id: string;
  role: 'user' | 'admin';
}

/**
 * Creates a new creator-private draft, or resumes the caller's own existing
 * draft/changes_required product for the same identifier. Always repeats the
 * conclusive lookup server-side first — a client-signed "not found" proof is
 * never trusted, and a reservation created between scan and create is translated
 * through the same visibility classification lookup-v2 uses.
 */
export async function createOrResumeDraft(
  actor: DraftActor,
  input: ProductDraftCreateRequest,
): Promise<{ product: ApiProduct; resumed: boolean }> {
  const identifierInput = draftIdentifierInput(input);

  // Only the actual new-row-creation path is mode-gated — resuming an existing
  // draft below returns already-owned state and never writes, so it stays
  // available regardless of mode (existing drafts remain readable/exportable).
  // A resumed outcome is always resolved from a pure local DB match (never an
  // external provider call), so checking that first lets an ineligible actor
  // be rejected *before* paying for lookupProductV2's off/upcitemdb round
  // trip on a genuine "not_found" — previously `off` mode still let every
  // caller drive two full external lookups before being rejected (reviewer-p7
  // I5).
  if (!(await hasLocalMatch(identifierInput))) {
    await assertProductCreationEligible(actor, 'create');
    await assertWithinActiveDraftQuota(actor.id);
  }

  // Always classified as a plain creator here, never the actor's real role —
  // lookupProductV2's admin branch returns a read-only moderation view
  // (`creator_pending`) for *any* non-active local row, which would make an
  // admin using the feature under their `internal`-mode grant unable to ever
  // resume their own draft. The eligibility check above is what enforces the
  // real role; classification here must stay creator-shaped, matching every
  // other actor.
  const outcome = await lookupProductV2(identifierInput, { id: actor.id, role: 'user' });

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
        createdByUserId: actor.id,
        status: 'draft',
      },
      include: PRODUCT_INCLUDE,
    });
    return { product: toApiProduct(created, { kind: 'privileged' }), resumed: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost a create race for the same identifier — resolve through the same
      // classification the winner would have produced, never a raw DB retry.
      const raced = await lookupProductV2(identifierInput, { id: actor.id, role: 'user' });
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
  actor: DraftActor,
  productId: string,
  input: ProductDraftPatchRequest,
): Promise<ApiProduct> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
  }
  assertOwnDraftLike(existing, actor.id);
  await assertProductCreationEligible(actor, 'metadata');

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
      createdByUserId: actor.id,
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
    assertOwnDraftLike(current, actor.id);
    throw new AppError({
      status: 409,
      code: ERROR_CODES.VERSION_CONFLICT,
      title: 'This draft was changed since you last loaded it',
      currentVersion: current.version,
    });
  }

  const updated = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_INCLUDE });
  return toApiProduct(updated, { kind: 'privileged' });
}

/**
 * Transitions a draft/changes_required product to `pending`. Order matters:
 * eligibility, then the real server-verified abuse assessment, both strictly
 * *before* any write — a provider-down retry (the route runs under the
 * idempotency plugin, `config: { idempotent: 'required' }`) must never have
 * already mutated the draft, so there is nothing to double-submit. The actual
 * transition is a version-guarded conditional `updateMany`, the same
 * optimistic-concurrency shape `patchDraft` uses: only one concurrent caller
 * can ever win it, so a genuine concurrent double-submit (two valid requests
 * racing, as opposed to a client retry) is also impossible, independent of
 * the idempotency layer.
 */
export async function submitDraft(
  actor: DraftActor,
  productId: string,
  input: ProductDraftSubmitRequest,
): Promise<ApiProduct> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
  }
  assertOwnDraftLike(existing, actor.id);
  await assertProductCreationEligible(actor, 'submit');

  // Completeness, checked before the billed external assessment call below —
  // `createOrResumeDraft` deliberately writes `name: ''`, and PATCH never
  // requires setting one, so nothing before this point guarantees a
  // reviewable row. Violates the plan's global "Name required: trimmed
  // 1–200 characters" constraint otherwise, pushing an empty-name draft into
  // Phase 6's moderation queue (reviewer-p7 I8). PATCH already enforces the
  // trim/length bounds when a name *is* provided, so only presence needs
  // checking here.
  if (existing.name.trim().length === 0) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: 'This draft needs a name before it can be submitted',
    });
  }

  // Client-reported success is never trusted: this is the real, server-side
  // verification. Throws a retryable 503 on provider timeout/error (nothing
  // written yet, safe to retry) or a typed 403 on a conservative reject
  // (invalid token, wrong action, low score) — never a silent accept.
  await assessProductCreationSubmission({ token: input.abuseToken, platform: input.platform });

  const result = await prisma.product.updateMany({
    where: {
      id: productId,
      createdByUserId: actor.id,
      status: { in: ['draft', 'changes_required'] },
      version: input.version,
    },
    data: { status: 'pending', submittedAt: new Date(), version: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await prisma.product.findUnique({ where: { id: productId } });
    if (!current) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
    }
    assertOwnDraftLike(current, actor.id);
    throw new AppError({
      status: 409,
      code: ERROR_CODES.VERSION_CONFLICT,
      title: 'This draft was changed since you last loaded it',
      currentVersion: current.version,
    });
  }

  const updated = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_INCLUDE });
  return toApiProduct(updated, { kind: 'privileged' });
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
