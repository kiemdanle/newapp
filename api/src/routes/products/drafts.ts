import type { FastifyInstance } from 'fastify';
import {
  productDraftCreateRequestSchema,
  productDraftsQuerySchema,
  productDraftsPageSchema,
} from '@expyrico/shared';
import { createOrResumeDraft, listDrafts } from '../../services/products/product-drafts.js';

export async function draftsRoute(app: FastifyInstance) {
  app.post(
    '/drafts',
    { onRequest: app.requireAuth, config: { idempotent: 'required' } },
    async (req, reply) => {
      const input = productDraftCreateRequestSchema.parse(req.body);
      const { product, resumed } = await createOrResumeDraft(req.user!.id, input);
      return reply.status(resumed ? 200 : 201).send({ product, resumed });
    },
  );

  app.get('/drafts', { onRequest: app.requireAuth }, async (req, reply) => {
    const query = productDraftsQuerySchema.parse(req.query);
    const page = await listDrafts(req.user!.id, query);
    return reply.send(productDraftsPageSchema.parse(page));
  });
}
