import type { FastifyInstance } from 'fastify';
import { productLookupRequestSchema, productLookupV2ResponseSchema } from '@expyrico/shared';
import { lookupProductV2 } from '../../services/products/lookup.js';

export async function lookupV2Route(app: FastifyInstance) {
  app.post('/lookup-v2', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = productLookupRequestSchema.parse(req.body);
    const response = await lookupProductV2(
      {
        ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
        ...(input.qr !== undefined ? { qr: input.qr } : {}),
      },
      { id: req.user!.id, role: req.user!.role },
    );
    return reply.send(productLookupV2ResponseSchema.parse(response));
  });
}
