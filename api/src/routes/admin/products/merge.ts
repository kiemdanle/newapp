import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductMergeSchema, adminProductMergeResponseSchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../../errors.js';
import { mergeProducts } from '../../../services/admin/merge.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsMergeRoute(app: FastifyInstance) {
  app.post('/:id/merge', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductMergeSchema.parse(req.body);
    if (input.winnerId !== id) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'winnerId must match :id' });
    }
    const result = await mergeProducts(input.winnerId, input.loserIds);
    await req.auditLog('product.merge', { type: 'product', id }, {
      before: null,
      after: { loserIds: input.loserIds, movedRecords: result.movedRecords, movedReviews: result.movedReviews },
    });
    return adminProductMergeResponseSchema.parse(result);
  });
}
