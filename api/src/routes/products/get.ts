import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productWithReviewsSchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getVisibleProduct } from '../../services/products/product-visibility.js';
import { toApiProduct } from '../../services/products/serializer.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function getProductRoute(app: FastifyInstance) {
  app.get('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };
    const product = await getVisibleProduct(actor, id);
    if (!product) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Product not found',
      });
    }
    return reply.send(
      productWithReviewsSchema.parse({
        ...toApiProduct(product, actor),
        topReviews: [], // populated in M2
      }),
    );
  });
}
