import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productEditPhotoReorderRequestSchema } from '@expyrico/shared';
import { reorderProductEditPhotos } from '../../services/products/product-photos.js';
import { toProductEditRow } from '../../services/products/product-edits.js';

const paramSchema = z.object({ editId: z.string().uuid() });

export async function editPhotoOrderRoute(app: FastifyInstance) {
  app.patch('/:editId/photos/order', { onRequest: app.requireAuth }, async (req, reply) => {
    const { editId } = paramSchema.parse(req.params);
    const input = productEditPhotoReorderRequestSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const edit = await reorderProductEditPhotos(actor, { editId, photoIds: input.photoIds });
    return reply.status(200).send(toProductEditRow(edit));
  });
}
