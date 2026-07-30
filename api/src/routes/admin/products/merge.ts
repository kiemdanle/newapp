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
    if (input.targetId !== id) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'targetId must match :id' });
    }
    const result = await mergeProducts(
      { id: req.user!.id, role: 'admin' },
      { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
      input.sourceIds,
      input.targetId,
      input.version,
    );
    return adminProductMergeResponseSchema.parse(result);
  });
}
