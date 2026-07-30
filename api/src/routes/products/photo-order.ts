import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productDraftReorderRequestSchema, productSchema } from '@expyrico/shared';
import { reorderProductPhotos } from '../../services/products/product-photos.js';

const paramSchema = z.object({ productId: z.string().uuid() });

export async function photoOrderRoute(app: FastifyInstance) {
  app.patch('/:productId/photos/order', { onRequest: app.requireAuth }, async (req, reply) => {
    const { productId } = paramSchema.parse(req.params);
    const input = productDraftReorderRequestSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const product = await reorderProductPhotos(actor, { productId, photoIds: input.photoIds });
    return reply.status(200).send(productSchema.parse(product));
  });
}
