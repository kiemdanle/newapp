import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminReviewRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminReviewsGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const r = await getPrisma().review.findUnique({ where: { id } });
    if (!r) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Review not found' });
    return adminReviewRowSchema.parse({
      id: r.id, userId: r.userId, productId: r.productId, rating: r.rating,
      comment: r.body, helpfulCount: r.helpfulCount, notHelpfulCount: r.notHelpfulCount,
      status: r.status, createdAt: r.createdAt.toISOString(),
    });
  });
}
