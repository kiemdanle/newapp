import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductEditResolveSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsPendingResolveRoute(app: FastifyInstance) {
  app.patch('/pending/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductEditResolveSchema.parse(req.body);
    const prisma = getPrisma();
    const edit = await prisma.productEdit.findUnique({ where: { id } });
    if (!edit) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Edit not found' });
    if (edit.status !== 'pending') throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already resolved' });
    await prisma.$transaction(async (tx) => {
      if (input.decision === 'approve') {
        await tx.product.update({ where: { id: edit.productId }, data: edit.proposed as Record<string, unknown> });
      }
      await tx.productEdit.update({
        where: { id },
        data: {
          status: input.decision === 'approve' ? 'approved' : 'rejected',
          resolvedBy: req.user!.id,
          resolvedAt: new Date(),
          notes: input.notes ?? null,
        },
      });
    });
    await req.auditLog('product_edit.resolve', { type: 'product_edit', id }, {
      before: { status: 'pending' }, after: { decision: input.decision, notes: input.notes ?? null },
    });
    return { ok: true };
  });
}
