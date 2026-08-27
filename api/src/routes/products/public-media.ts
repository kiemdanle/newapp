import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { getConfig } from '../../config.js';
import { resolveMediaPath } from '../../services/products/product-media-storage.js';

const publicPhotoParamsSchema = z.object({
  productId: z.string().uuid(),
  publicationId: z.string().uuid(),
  variant: z.string().min(1),
});

/**
 * Public, unauthenticated product photo delivery route (served with 1-year immutable caching).
 * Fastify fallback when requests hit the API origin directly.
 */
export async function publicProductMediaRoutes(app: FastifyInstance) {
  app.get('/products/:productId/:publicationId/:variant', async (req, reply) => {
    const parsed = publicPhotoParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(404).send({ code: 'not_found' });
    }
    const { productId, publicationId, variant } = parsed.data;
    const cleanVariant = variant.replace(/\.webp$/, '');
    if (cleanVariant !== 'display' && cleanVariant !== 'thumb') {
      return reply.status(404).send({ code: 'not_found' });
    }

    const cfg = getConfig().media;
    const diskPath = resolveMediaPath(cfg.root, 'public', 'products', productId, publicationId, `${cleanVariant}.webp`);

    let fileStat;
    try {
      fileStat = await stat(diskPath);
      if (!fileStat.isFile()) return reply.status(404).send({ code: 'not_found' });
    } catch {
      return reply.status(404).send({ code: 'not_found' });
    }

    const etag = `"${productId}-${publicationId}-${cleanVariant}-${fileStat.size}"`;
    if (req.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    return reply
      .type('image/webp')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('ETag', etag)
      .header('Last-Modified', fileStat.mtime.toUTCString())
      .header('X-Content-Type-Options', 'nosniff')
      .send(createReadStream(diskPath));
  });
}
