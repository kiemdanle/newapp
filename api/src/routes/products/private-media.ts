import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { getVisibleProduct } from '../../services/products/product-visibility.js';
import { mediaKeyToPath, variantFileKey, type MediaVariant } from '../../services/products/product-media-storage.js';

const paramSchema = z.object({
  productId: z.string().uuid(),
  photoId: z.string().uuid(),
  variant: z.enum(['display', 'thumb']),
});

function notFound(): never {
  throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Photo not found' });
}

/**
 * Authorized private photo byte delivery for `ProductPhoto`. Parent-bound: the
 * query binds `photoId` to its declared `productId` before any visibility check, so
 * a photo ID that belongs to a *different* product 404s exactly like one that
 * doesn't exist at all — no enumeration signal either way. Never serves an already
 * -approved (public) photo's bytes; those are meant to be fetched from their public
 * CDN URL instead.
 */
export async function privateMediaRoute(app: FastifyInstance) {
  app.get('/:productId/photos/:photoId/:variant', { onRequest: app.requireAuth }, async (req, reply) => {
    const { productId, photoId, variant } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };
    const prisma = getPrisma();

    const photo = await prisma.productPhoto.findFirst({ where: { id: photoId, productId } });
    if (!photo || !photo.privateStorageKey) notFound();

    const product = await getVisibleProduct(actor, productId);
    if (!product) notFound();

    const cfg = getConfig().media;
    const path = mediaKeyToPath(cfg.root, variantFileKey(photo.privateStorageKey, variant as MediaVariant));
    const buffer = await readFile(path).catch(() => notFound());

    void reply.header('Content-Type', 'image/webp');
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('Cache-Control', 'private, no-store');
    return reply.send(buffer);
  });
}
