import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { discardDraft } from '../../services/products/product-drafts.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function draftDeleteRoute(app: FastifyInstance) {
  app.delete('/drafts/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const result = await discardDraft({ id: req.user!.id, role: req.user!.role }, id);
    return reply.status(200).send(result);
  });
}
