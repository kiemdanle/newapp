import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { writeAuditLog } from '../audit/log.js';
import { resolveCanonicalProduct, PRODUCT_INCLUDE, type ProductActor } from '../products/product-visibility.js';

export interface MergeRequestMeta {
  requestId?: string | undefined;
  ip?: string | undefined;
}

export interface MergeResult {
  targetId: string;
  movedRecords: number;
  movedReviews: number;
  newReviewCount: number;
  newRatingCount: number;
  newBuyAgainCount: number;
  newBuyAgainOnSaleCount: number;
  newWontBuyCount: number;
}

function notFound(): never {
  throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
}

function conflict(title: string): never {
  throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title });
}

function versionConflict(currentVersion: number): never {
  throw new AppError({
    status: 409,
    code: ERROR_CODES.VERSION_CONFLICT,
    title: 'This product was changed since you last loaded it',
    currentVersion,
  });
}

function identifierConflict(slot: 'barcode' | 'qr', sourceValue: string, targetValue: string): never {
  throw new AppError({
    status: 409,
    code: 'identifier_conflict',
    title: `The target and a source product have conflicting ${slot} values; an admin must choose which to keep`,
    identifierConflict: { slot, sourceValue, targetValue },
  });
}

interface IdentifierTransferPlan {
  newTargetValue: string | null;
  clearSourceIds: string[];
}

/**
 * Decides how one identifier slot (`barcode` or `qr`) resolves across a merge.
 * Equal values (target-vs-source, or source-vs-source) are never a conflict — the
 * redundant duplicate is silently cleared from the row being merged away. Only a
 * genuinely differing non-null value is a conflict, and it aborts the whole merge
 * (no partial success) until an admin resolves it explicitly.
 */
function planIdentifierTransfer(
  slot: 'barcode' | 'qr',
  targetValue: string | null,
  sources: Array<{ id: string; value: string | null }>,
): IdentifierTransferPlan {
  const withValues = sources.filter((s): s is { id: string; value: string } => s.value !== null);
  if (targetValue !== null) {
    for (const s of withValues) {
      if (s.value !== targetValue) identifierConflict(slot, s.value, targetValue);
    }
    return { newTargetValue: targetValue, clearSourceIds: withValues.map((s) => s.id) };
  }
  const distinctValues = [...new Set(withValues.map((s) => s.value))];
  if (distinctValues.length === 0) return { newTargetValue: null, clearSourceIds: [] };
  if (distinctValues.length > 1) {
    identifierConflict(slot, distinctValues[1]!, distinctValues[0]!);
  }
  return { newTargetValue: distinctValues[0]!, clearSourceIds: withValues.map((s) => s.id) };
}

/**
 * Merges `sourceIds` into `targetId`. Locks every involved product row in
 * deterministic sorted-ID order (never request order) to make opposite-direction
 * concurrent merge attempts resolve without deadlock. One transaction: relation
 * repoints (records, reviews with same-user dedupe, deals, giveaways), rating tally
 * recalculation, atomic barcode/QR identifier transfer, source rows marked
 * `merged_into` (never deleted — history/media cleanup is a later, separate
 * concern), target version bump, and audit. Rejects self-merge, duplicate source
 * ids, a non-active target/source, and any source or target with an open
 * `draft|pending|changes_required` revision (that revision must be resolved first).
 */
export async function mergeProducts(
  actor: ProductActor,
  requestMeta: MergeRequestMeta,
  sourceIds: string[],
  targetId: string,
  version: number,
): Promise<MergeResult> {
  const prisma = getPrisma();
  if (sourceIds.includes(targetId)) conflict('Target cannot also be a source');
  if (new Set(sourceIds).size !== sourceIds.length) conflict('sourceIds must be unique');

  // Resolve the target through any existing merge chain to its canonical row first
  // — a merge just changes which row answers, so re-targeting an already-merged
  // product transparently follows the chain rather than dead-ending.
  let targetRow = await prisma.product.findUnique({ where: { id: targetId }, include: PRODUCT_INCLUDE });
  if (!targetRow) notFound();
  if (targetRow.status === 'merged_into') {
    targetRow = await resolveCanonicalProduct(targetRow, prisma);
  }
  if (targetRow.status !== 'active') conflict('Merge target must be an active product');
  const resolvedTargetId = targetRow.id;
  if (sourceIds.includes(resolvedTargetId)) conflict('Target resolves to one of the requested sources (merge cycle)');

  const sourceRows = await prisma.product.findMany({ where: { id: { in: sourceIds } } });
  if (sourceRows.length !== sourceIds.length) notFound();
  for (const s of sourceRows) {
    if (s.status !== 'active') conflict(`Source product ${s.id} is not active`);
  }

  const lockOrder = [...new Set([resolvedTargetId, ...sourceIds])].sort();

  return prisma.$transaction(async (tx) => {
    for (const id of lockOrder) {
      await tx.$executeRaw`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`;
    }

    const target = await tx.product.findUniqueOrThrow({ where: { id: resolvedTargetId } });
    if (target.status !== 'active') conflict('Merge target must be an active product');
    if (target.version !== version) versionConflict(target.version);

    const sources = await tx.product.findMany({ where: { id: { in: sourceIds } } });
    for (const s of sources) {
      if (s.status !== 'active') conflict(`Source product ${s.id} is no longer active`);
    }

    const openEdit = await tx.productEdit.findFirst({
      where: { productId: { in: [resolvedTargetId, ...sourceIds] }, isLegacy: false, status: { in: ['draft', 'pending', 'changes_required'] } },
    });
    if (openEdit) conflict('An open revision exists on the target or a source product; resolve it before merging');

    const barcodePlan = planIdentifierTransfer('barcode', target.barcode, sources.map((s) => ({ id: s.id, value: s.barcode })));
    const qrPlan = planIdentifierTransfer('qr', target.qrPayload, sources.map((s) => ({ id: s.id, value: s.qrPayload })));

    const movedRec = await tx.record.updateMany({ where: { productId: { in: sourceIds } }, data: { productId: resolvedTargetId } });

    // I2: dedupe across the *whole* merge set, not just target-vs-source — two
    // sources reviewed by the same user collide on `@@unique([userId, productId])`
    // the instant both get repointed to the same target, even if neither matches
    // an existing target review. Deterministic keep-one-per-user policy: the
    // target's own review always wins if present; otherwise the source review
    // with the lowest id survives (stable, reproducible ordering) and every other
    // same-user source review is dropped.
    const targetReviews = await tx.review.findMany({ where: { productId: resolvedTargetId }, select: { userId: true } });
    const targetUserIds = new Set(targetReviews.map((r) => r.userId));
    const sourceReviews = await tx.review.findMany({ where: { productId: { in: sourceIds } }, orderBy: { id: 'asc' } });
    const keptSourceReviewByUser = new Map<string, string>();
    const toDelete: string[] = [];
    for (const r of sourceReviews) {
      if (targetUserIds.has(r.userId)) {
        toDelete.push(r.id);
        continue;
      }
      const kept = keptSourceReviewByUser.get(r.userId);
      if (!kept) {
        keptSourceReviewByUser.set(r.userId, r.id);
      } else {
        toDelete.push(r.id);
      }
    }
    if (toDelete.length > 0) await tx.review.deleteMany({ where: { id: { in: toDelete } } });
    const movedRev = await tx.review.updateMany({
      where: { productId: { in: sourceIds }, ...(toDelete.length > 0 ? { id: { notIn: toDelete } } : {}) },
      data: { productId: resolvedTargetId },
    });

    await tx.deal.updateMany({ where: { productId: { in: sourceIds } }, data: { productId: resolvedTargetId } });
    await tx.giveaway.updateMany({ where: { productId: { in: sourceIds } }, data: { productId: resolvedTargetId } });
    // M8: `Report.targetId` is a polymorphic (targetType, targetId) pair with no
    // real FK to `Product` — repointed explicitly here so reports filed against a
    // merged-away product stay attached to the surviving catalog row instead of
    // silently dropping out of moderation views.
    await tx.report.updateMany({ where: { targetType: 'product', targetId: { in: sourceIds } }, data: { targetId: resolvedTargetId } });

    const byRating = await tx.review.groupBy({
      by: ['rating'],
      where: { productId: resolvedTargetId, status: 'visible' },
      _count: { _all: true },
    });
    const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 } as Record<string, number>;
    for (const row of byRating) tally[row.rating] = row._count._all;
    const newBuyAgainCount = tally.buy_again!;
    const newBuyAgainOnSaleCount = tally.buy_again_on_sale!;
    const newWontBuyCount = tally.wont_buy!;
    const newRatingCount = newBuyAgainCount + newBuyAgainOnSaleCount + newWontBuyCount;
    const newReviewCount = await tx.review.count({ where: { productId: resolvedTargetId, status: 'visible', body: { not: null } } });

    if (barcodePlan.clearSourceIds.length > 0) {
      await tx.product.updateMany({ where: { id: { in: barcodePlan.clearSourceIds } }, data: { barcode: null } });
    }
    if (qrPlan.clearSourceIds.length > 0) {
      await tx.product.updateMany({ where: { id: { in: qrPlan.clearSourceIds } }, data: { qrPayload: null } });
    }

    await tx.product.updateMany({ where: { id: { in: sourceIds } }, data: { status: 'merged_into', mergedIntoProductId: resolvedTargetId } });

    await tx.product.update({
      where: { id: resolvedTargetId },
      data: {
        barcode: barcodePlan.newTargetValue,
        qrPayload: qrPlan.newTargetValue,
        reviewCount: newReviewCount,
        ratingCount: newRatingCount,
        buyAgainCount: newBuyAgainCount,
        buyAgainOnSaleCount: newBuyAgainOnSaleCount,
        wontBuyCount: newWontBuyCount,
        version: { increment: 1 },
      },
    });

    await writeAuditLog(
      {
        adminId: actor.id,
        action: 'product.merge',
        targetType: 'product',
        targetId: resolvedTargetId,
        diff: {
          before: { barcode: target.barcode, qrPayload: target.qrPayload },
          after: {
            sourceIds,
            barcode: barcodePlan.newTargetValue,
            qrPayload: qrPlan.newTargetValue,
            sourceOriginals: sources.map((s) => ({ id: s.id, barcode: s.barcode, qrPayload: s.qrPayload })),
            movedRecords: movedRec.count,
            movedReviews: movedRev.count,
          },
        },
        requestId: requestMeta.requestId,
        ip: requestMeta.ip,
      },
      tx,
    );

    return {
      targetId: resolvedTargetId,
      movedRecords: movedRec.count,
      movedReviews: movedRev.count,
      newReviewCount,
      newRatingCount,
      newBuyAgainCount,
      newBuyAgainOnSaleCount,
      newWontBuyCount,
    };
  });
}

