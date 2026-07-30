import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productEditMetadataPatchRequestSchema } from '@expyrico/shared';
import { patchProductEditMetadata } from '../../services/products/product-edits.js';

const paramSchema = z.object({ editId: z.string().uuid() });

export async function editMetadataRoute(app: FastifyInstance) {
  app.patch('/:editId', { onRequest: app.requireAuth }, async (req, reply) => {
    const { editId } = paramSchema.parse(req.params);
    const input = productEditMetadataPatchRequestSchema.parse(req.body);
    const edit = await patchProductEditMetadata({ id: req.user!.id, role: req.user!.role }, editId, input);
    return reply.send(edit);
  });
}
