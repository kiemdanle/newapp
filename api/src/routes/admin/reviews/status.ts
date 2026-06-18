import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminReviewStatusPatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminReviewsStatusRoute(app: FastifyInstance) {
  app.patch('/:id/status', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const { status } = adminReviewStatusPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.review.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Review not found' });
    await prisma.review.update({ where: { id }, data: { status } });
    await req.auditLog('review.status', { type: 'review', id }, {
      before: { status: before.status }, after: { status },
    });
    return { ok: true };
  });
}
