import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productSearchResultSchema } from '@pantry/shared';
import { searchProducts } from '../../services/products/search.js';
import { toApiProduct } from '../../services/products/serializer.js';

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function searchRoute(app: FastifyInstance) {
  app.get('/search', { onRequest: app.requireAuth }, async (req, reply) => {
    const { q, limit } = querySchema.parse(req.query);
    const items = await searchProducts(q, limit);
    return reply.send(
      productSearchResultSchema.parse({ items: items.map(toApiProduct) }),
    );
  });
}
