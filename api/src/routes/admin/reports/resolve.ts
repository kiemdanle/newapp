import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminReportResolveSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import {
  lockProductForReviewMutation,
  recomputeAndSyncProductTallies,
} from '../../../services/reviews/product-tallies.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminReportsResolveRoute(app: FastifyInstance) {
  app.patch('/:id/resolve', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminReportResolveSchema.parse(req.body);
    const prisma = getPrisma();
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Report not found' });
    if (report.status !== 'open') throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already resolved' });
    await prisma.$transaction(async (tx) => {
      if (input.action === 'hide' && report.targetType === 'review') {
        const r = await tx.review.findUnique({ where: { id: report.targetId } });
        if (r) {
          await lockProductForReviewMutation(tx, r.productId);
          await tx.review.update({ where: { id: report.targetId }, data: { status: 'hidden' } });
          await recomputeAndSyncProductTallies(tx, r.productId);
        }
      } else if (input.action === 'delete' && report.targetType === 'review') {
        const r = await tx.review.findUnique({ where: { id: report.targetId } });
        if (r) {
          await lockProductForReviewMutation(tx, r.productId);
          await tx.review.update({ where: { id: report.targetId }, data: { status: 'deleted' } });
          await recomputeAndSyncProductTallies(tx, r.productId);
        }
      } else if (input.action === 'ban') {
        let offenderId: string | null = null;
        if (report.targetType === 'user') offenderId = report.targetId;
        if (report.targetType === 'review') {
          const r = await tx.review.findUnique({ where: { id: report.targetId } });
          offenderId = r?.userId ?? null;
        }
        if (report.targetType === 'product') {
          const p = await tx.product.findUnique({ where: { id: report.targetId } });
          offenderId = p?.createdByUserId ?? null;
        }
        if (offenderId) await tx.user.update({ where: { id: offenderId }, data: { status: 'suspended' } });
      }
      await tx.report.update({
        where: { id },
        data: {
          status: input.action === 'dismiss' ? 'dismissed' : 'resolved',
          resolvedByAdminId: req.user!.id,
          resolvedAt: new Date(),
        },
      });
    });
    await req.auditLog('report.resolve', { type: 'report', id }, {
      before: { status: 'open' }, after: { action: input.action, notes: input.notes ?? null },
    });
    return { ok: true };
  });
}
