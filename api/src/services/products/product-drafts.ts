import type { Product, Prisma as PrismaTypes } from '@prisma/client';
import prismaPkg, { ProductStatus } from '@prisma/client';
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
  type ProductDraftStatus,
  type ProductLookupV2Response,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { logger } from '../../logger.js';
import { hasLocalMatch, lookupProductV2 } from './lookup.js';
import { toApiProduct, toApiProductPhoto } from './serializer.js';
import { PRODUCT_INCLUDE, type ProductWithPhotos } from './product-visibility.js';
import { privateProductPhotoRoute } from './product-media-storage.js';
import { assertProductCreationEligible } from './product-creation-eligibility.js';
import { assertWithinActiveDraftQuota } from './product-creation-quotas.js';
import { assessProductCreationSubmission } from '../abuse/product-creation-assessment.js';
import { recordModerationNotificationEvent } from '../notifications/moderation-notification-events.js';

import { getSetting, SETTING_KEYS, productCreationSettingsSchema } from '../admin/settings.js';
import { autoApproveProduct, hasExceededDailyAutoApprovalQuota } from './auto-approval.js';
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
 * actor's actual role, never a hardcoded stand-in (`internal`
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
  // caller drive two full external lookups before being rejected.
  if (!(await hasLocalMatch(identifierInput))) {
    await assertProductCreationEligible(actor, 'create');
    // The active-draft-quota count itself is re-checked below, inside the
    // same transaction and advisory lock as the create — a standalone check
    // here would still let two concurrent requests race past the same count.
    // This early call stays eligibility-only: a cheap local check before the
    // external lookup, not the quota itself.
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
    if (input.name && !outcome.product.name.trim()) {
      const updated = await getPrisma().product.update({
        where: { id: outcome.product.id },
        data: { name: input.name.trim(), version: { increment: 1 } },
        include: PRODUCT_INCLUDE,
      });
      return { product: toApiProduct(updated, { kind: 'privileged' }), resumed: true };
    }
    return { product: outcome.product, resumed: true };
  }
  if (outcome.outcome !== 'not_found') {
    throwForNonCreatableOutcome(outcome);
  }

  const prisma = getPrisma();
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Serializes concurrent create attempts by this same actor — a
      // Postgres advisory lock scoped to their own id, so unrelated actors
      // never contend with each other or wait on this at all. Without it, a
      // plain count-then-create under READ COMMITTED lets two concurrent
      // requests from the same actor both read a count one under the cap
      // and both create, overshooting it by one.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.id})::bigint)`;
      await assertWithinActiveDraftQuota(actor.id, tx);
      return tx.product.create({
        data: {
          ...(input.barcode !== undefined ? { barcode: input.barcode } : { qrPayload: input.qrPayload! }),
          name: input.name?.trim() || '',
          source: 'user',
          createdByUserId: actor.id,
          status: 'draft',
        },
        include: PRODUCT_INCLUDE,
      });
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function discardDraft(
  actor: DraftActor,
  productId: string,
): Promise<{ success: boolean; id: string }> {
  if (!UUID_REGEX.test(productId)) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
  }

  const prisma = getPrisma();

  return await prisma.$transaction(async (tx) => {
    // 1. Acquire row lock first. Serializes against concurrent submitDraft,
    // autoApproveProduct, or moderation mutations on this product.
    await tx.$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;

    // 2. Fetch fresh, locked product state inside the transaction.
    const existing = await tx.product.findUnique({
      where: { id: productId },
      include: { photos: true },
    });
    if (!existing || existing.createdByUserId !== actor.id) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Draft not found' });
    }

    // 3. For active or pending catalog products, dismissing removes them from the user's
    // personal quick-add template list without deleting the public community asset.
    if (existing.status !== 'draft' && existing.status !== 'changes_required') {
      await tx.product.update({
        where: { id: existing.id },
        data: { isDismissedFromTemplates: true },
      });
      return { success: true, id: productId };
    }

    // 4. For private unsubmitted drafts / changes_required:
    // Delete child records (photos and edits) within the transaction.
    if (existing.photos.length > 0) {
      await tx.productPhoto.deleteMany({ where: { productId: existing.id } });
    }
    await tx.productEdit.deleteMany({ where: { productId: existing.id } });

    // 5. Atomic status- and ownership-guarded product deletion.
    const deleteResult = await tx.product.deleteMany({
      where: {
        id: existing.id,
        createdByUserId: actor.id,
        status: { in: ['draft', 'changes_required'] },
      },
    });

    if (deleteResult.count === 0) {
      await tx.product.update({
        where: { id: existing.id },
        data: { isDismissedFromTemplates: true },
      });
    }

    return { success: true, id: productId };
  });
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
  // Phase 6's moderation queue. PATCH already enforces the
  // trim/length bounds when a name *is* provided, so only presence needs
  // checking here.
  if (existing.name.trim().length === 0) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: 'This draft needs a name before it can be submitted',
    });
  }

  // Cheap version pre-check before the billed external assessment call below
  // — a client retrying a stale-version submit (or looping one) would
  // otherwise pay for a real CreateAssessment on every attempt before ever
  // reaching the authoritative version-guarded write further down
  //. This is advisory only: the version can still move
  // between here and the conditional `updateMany`, which remains the actual
  // guard against a genuine concurrent double-submit.
  if (existing.version !== input.version) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.VERSION_CONFLICT,
      title: 'This draft was changed since you last loaded it',
      currentVersion: existing.version,
    });
  }

  // Client-reported success is never trusted: this is the real, server-side
  // verification. Throws a retryable 503 on provider timeout/error (nothing
  // written yet, safe to retry) or a typed 403 on a conservative reject
  // (invalid token, wrong action, low score) — never a silent accept.
  const assessment = await assessProductCreationSubmission({ token: input.abuseToken, platform: input.platform });
  // Links the assessment that admitted this submission to the product it
  // admitted — previously the score/reasons/assessment name were discarded
  // entirely once the assessment call returned, leaving no audit trail
  //. A structured log line (never the token itself) rather
  // than a new DB column/migration, since persisting this on the product
  // would be a schema change outside this phase's file ownership.
  logger.info(
    { productId, actorId: actor.id, score: assessment.score, reasons: assessment.reasons, assessmentName: assessment.assessmentName },
    'product-creation: submission assessment recorded',
  );

  // Approval policy evaluation:
  // 1. If creator has requireProductApproval == true -> ALWAYS require moderation (anti-spam override)
  // 2. If user exceeded daily auto-approval velocity cap -> require moderation
  // 3. Otherwise, follow global requireApproval setting (if false, auto-approve!)
  // Fail-safe: if creator record is missing, fail closed (require moderation)
  const creator = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { requireProductApproval: true },
  });

  const { requireApproval: globalRequireApproval } = await getSetting(
    SETTING_KEYS.PRODUCT_CREATION,
    productCreationSettingsSchema,
  );

  const exceededDailyCap = await hasExceededDailyAutoApprovalQuota(actor.id);

  const needsApproval = Boolean(
    (creator ? creator.requireProductApproval : true) ||
    globalRequireApproval ||
    exceededDailyCap,
  );

  if (!needsApproval) {
    return autoApproveProduct(productId, input.version, actor.id);
  }
  const submittedAt = new Date();
  await prisma.$transaction(async (tx) => {

    const result = await tx.product.updateMany({
      where: {
        id: productId,
        createdByUserId: actor.id,
        status: { in: ['draft', 'changes_required'] },
        version: input.version,
      },
      data: { status: 'pending', submittedAt, version: { increment: 1 } },
    });

    if (result.count === 0) {
      const current = await tx.product.findUnique({ where: { id: productId } });
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

    // The notification event shares this transaction: the guarded transition is
    // the only path to `pending`, so keying the event on the post-transition
    // version makes a resubmission a new occurrence while a lost-guard replay
    // above records nothing.
    await recordModerationNotificationEvent(tx, {
      kind: 'new_product',
      sourceId: productId,
      submissionVersion: input.version + 1,
      submittedAt,
    });
  });

  const updated = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_INCLUDE });
  return toApiProduct(updated, { kind: 'privileged' });
}

function toDraftRow(product: ProductWithPhotos): ProductDraftRow {
  const identifier =
    product.barcode !== null
      ? ({ kind: 'barcode', value: product.barcode } as const)
      : ({ kind: 'qr', value: product.qrPayload as string } as const);
  const cover = product.photos[0];
  const photoDto = cover ? toApiProductPhoto(cover, product.id) : null;
  return {
    id: product.id,
    name: product.name,
    identifier,
    status: product.status as ProductDraftStatus,
    version: product.version,
    moderationFeedback: product.moderationNotes,
    cover: photoDto ? { photoId: photoDto.id, thumbnailUrl: photoDto.thumbnailUrl } : null,
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
  const statusFilter: PrismaTypes.EnumProductStatusFilter | ProductStatus =
    !query.status || query.status === 'all'
      ? { in: [ProductStatus.draft, ProductStatus.pending, ProductStatus.changes_required, ProductStatus.active] }
      : query.status === 'draft'
        ? { in: [ProductStatus.draft, ProductStatus.changes_required] }
        : (query.status as ProductStatus);
  const rows = await prisma.product.findMany({
    where: {
      createdByUserId: actorId,
      status: statusFilter,
      isDismissedFromTemplates: false,
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
