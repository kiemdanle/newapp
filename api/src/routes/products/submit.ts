import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productDraftSubmitRequestSchema, productSchema } from '@expyrico/shared';
import { submitDraft } from '../../services/products/product-drafts.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function draftSubmitRoute(app: FastifyInstance) {
  app.post(
    '/drafts/:id/submit',
    { onRequest: app.requireAuth, config: { idempotent: 'required' } },
    async (req, reply) => {
      const { id } = paramSchema.parse(req.params);
      const input = productDraftSubmitRequestSchema.parse(req.body);
      const product = await submitDraft({ id: req.user!.id, role: req.user!.role }, id, input);
      // Schema-pinned response, matching every sibling draft-mutation route
      // (photo-delete.ts, photo-upload.ts, drafts.ts) — this was the one
      // holdout sending the raw service return value.
      return reply.send(productSchema.parse(product));
    },
  );
}
