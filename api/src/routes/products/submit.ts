import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productDraftSubmitRequestSchema } from '@expyrico/shared';
import { submitDraft } from '../../services/products/product-drafts.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function draftSubmitRoute(app: FastifyInstance) {
  app.post(
    '/drafts/:id/submit',
    { onRequest: app.requireAuth, config: { idempotent: 'required' } },
    async (req, reply) => {
      const { id } = paramSchema.parse(req.params);
      const input = productDraftSubmitRequestSchema.parse(req.body);
      const product = await submitDraft(req.user!.id, id, input);
      return reply.send(product);
    },
  );
}
