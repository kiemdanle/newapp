import type { FastifyInstance } from 'fastify';
import { productLookupRequestSchema, productLookupV2ResponseSchema } from '@expyrico/shared';
import { lookupProductV2, isRestrictedInStoreBarcode } from '../../services/products/lookup.js';
import { enqueueLookupBackfill } from '../../services/products/lookup-backfill.js';

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

    if (
      response.outcome === 'not_found' &&
      input.barcode &&
      !isRestrictedInStoreBarcode(input.barcode)
    ) {
      void enqueueLookupBackfill(input.barcode, req.user!.id);
    }
    return reply.send(productLookupV2ResponseSchema.parse(response));
  });
}
