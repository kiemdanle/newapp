import type { FastifyInstance } from 'fastify';
import {
  productLookupRequestSchema,
  productLookupResponseSchema,
  ERROR_CODES,
} from '@pantry/shared';
import { AppError } from '../../errors.js';
import { lookupProduct } from '../../services/products/lookup.js';
import { toApiProduct } from '../../services/products/serializer.js';
import { enqueueLookupBackfill } from '../../services/products/lookup-backfill.js';

export async function lookupRoute(app: FastifyInstance) {
  app.post('/lookup', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = productLookupRequestSchema.parse(req.body);
    const product = await lookupProduct({
      ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
      ...(input.qr !== undefined ? { qr: input.qr } : {}),
    });
    if (!product) {
      // Synchronous path missed. For barcode misses, enqueue a slow background
      // backfill so a future request can hit local cache (spec §4.3).
      if (input.barcode) {
        await enqueueLookupBackfill(input.barcode, req.user!.id);
      }
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Product not found',
      });
    }
    return reply.send(
      productLookupResponseSchema.parse({ product: toApiProduct(product) }),
    );
  });
}
