import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productDraftPatchRequestSchema } from '@expyrico/shared';
import { patchDraft } from '../../services/products/product-drafts.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function draftUpdateRoute(app: FastifyInstance) {
  app.patch('/drafts/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const input = productDraftPatchRequestSchema.parse(req.body);
    const product = await patchDraft({ id: req.user!.id, role: req.user!.role }, id, input);
    return reply.send(product);
  });
}
