import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { removeProductEditPhoto } from '../../services/products/product-photos.js';
import { toProductEditRow } from '../../services/products/product-edits.js';

const paramSchema = z.object({ editId: z.string().uuid(), photoId: z.string().uuid() });

export async function editPhotoDeleteRoute(app: FastifyInstance) {
  app.delete('/:editId/photos/:photoId', { onRequest: app.requireAuth }, async (req, reply) => {
    const { editId, photoId } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };
    const edit = await removeProductEditPhoto(actor, { editId, photoId });
    return reply.status(200).send(toProductEditRow(edit));
  });
}
