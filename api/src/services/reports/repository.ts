import type { Report } from '@prisma/client';
import type { Report as ApiReport, ReportTargetType } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import {
  lockProductForReviewMutation,
  recomputeAndSyncProductTallies,
} from '../reviews/product-tallies.js';

/**
 * Spec §2.8: content auto-hides once it accumulates more than this many
 * non-dismissed reports from distinct reporters. Hardcoded here as the spec literal.
 */
const AUTO_HIDE_REPORT_THRESHOLD = 3;

export function toApiReport(r: Report): ApiReport {
  return {
    id: r.id,
    reporterId: r.reporterId,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Spec §2.8: more than 3 distinct reporters across *open or resolved* reports against the
 * same target auto-hides the content pending admin review. "dismissed" reports do not count.
 * - reviews → set `reviews.status = 'hidden'` and recompute product tallies synchronously
 * - products → set `products.status = 'report_hidden'`
 * - deals → set `deals.status = 'hidden'`
 * - giveaways → set `giveaways.status = 'cancelled'`
 * - users → no auto-hide; admin queue picks them up
 *
 * Idempotent: re-running on an already-hidden target is a no-op.
 */
export async function maybeAutoHide(
  targetType: ReportTargetType,
  targetId: string,
): Promise<{ hidden: boolean }> {
  const prisma = getPrisma();
  const distinctReporters = await prisma.report.groupBy({
    by: ['reporterId'],
    where: { targetType, targetId, status: { in: ['open', 'resolved'] } },
  });
  // Auto-hide strictly requires distinct reporters count > AUTO_HIDE_REPORT_THRESHOLD (on the 4th)
  if (distinctReporters.length <= AUTO_HIDE_REPORT_THRESHOLD) return { hidden: false };

  if (targetType === 'review') {
    const r = await prisma.review.findUnique({ where: { id: targetId } });
    if (!r || r.status === 'hidden' || r.status === 'deleted') return { hidden: false };
    await prisma.$transaction(async (tx) => {
      await lockProductForReviewMutation(tx, r.productId);
      await tx.review.update({ where: { id: targetId }, data: { status: 'hidden' } });
      await recomputeAndSyncProductTallies(tx, r.productId);
    });
    return { hidden: true };
  }
  if (targetType === 'product') {
    const p = await prisma.product.findUnique({ where: { id: targetId } });
    if (!p || p.status !== 'active') return { hidden: false };
    await prisma.product.update({ where: { id: targetId }, data: { status: 'report_hidden' } });
    return { hidden: true };
  }
  if (targetType === 'deal') {
    const d = await prisma.deal.findUnique({ where: { id: targetId } });
    if (!d || d.status === 'hidden' || d.status === 'deleted') return { hidden: false };
    await prisma.deal.update({ where: { id: targetId }, data: { status: 'hidden' } });
    return { hidden: true };
  }
  if (targetType === 'giveaway') {
    const g = await prisma.giveaway.findUnique({ where: { id: targetId } });
    if (!g || g.status === 'cancelled') return { hidden: false };
    await prisma.giveaway.update({ where: { id: targetId }, data: { status: 'cancelled' } });
    return { hidden: true };
  }
  return { hidden: false };
}
