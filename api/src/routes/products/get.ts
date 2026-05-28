import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productWithReviewsSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiProduct } from '../../services/products/serializer.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function getProductRoute(app: FastifyInstance) {
  app.get('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const product = await getPrisma().product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Product not found',
      });
    }
    return reply.send(
      productWithReviewsSchema.parse({
        ...toApiProduct(product),
        topReviews: [], // populated in M2
      }),
    );
  });
}
