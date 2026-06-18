import type { Report } from '@prisma/client';
import type { Report as ApiReport, ReportTargetType } from '@expyrico/shared';
import { getPrisma } from '../../db.js';

/**
 * Spec §2.8: content auto-hides once it accumulates more than this many
 * non-dismissed reports. Hardcoded here as the spec literal. A later milestone
 * may introduce an admin-configurable override that defaults to this same value;
 * no settings dependency is imported now (that module ships later).
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
 * Spec §2.8: more than 3 *open or resolved* reports against the same target
 * auto-hides the content pending admin review. "dismissed" reports do not count.
 * - reviews → set `reviews.status = 'hidden'`
 * - products → set `products.status = 'pending'` (admins can re-approve)
 * - users → no auto-hide; admin queue picks them up
 *
 * Idempotent: re-running on an already-hidden target is a no-op.
 */
export async function maybeAutoHide(
  targetType: ReportTargetType,
  targetId: string,
): Promise<{ hidden: boolean }> {
  const prisma = getPrisma();
  const count = await prisma.report.count({
    where: { targetType, targetId, status: { in: ['open', 'resolved'] } },
  });
  // Spec §2.8 literal: more than 3 non-dismissed reports auto-hides the target.
  if (count <= AUTO_HIDE_REPORT_THRESHOLD) return { hidden: false };

  if (targetType === 'review') {
    const r = await prisma.review.findUnique({ where: { id: targetId } });
    if (!r || r.status === 'hidden' || r.status === 'deleted') return { hidden: false };
    await prisma.review.update({ where: { id: targetId }, data: { status: 'hidden' } });
    return { hidden: true };
  }
  if (targetType === 'product') {
    const p = await prisma.product.findUnique({ where: { id: targetId } });
    if (!p || p.status !== 'active') return { hidden: false };
    await prisma.product.update({ where: { id: targetId }, data: { status: 'pending' } });
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
