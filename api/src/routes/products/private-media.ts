import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
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
 * CDN URL instead (an `approved` row never has `privateStorageKey` set — enforced
 * by the DB check constraint — so this route structurally can't reach one).
 *
 * The route enforces `moderationStatus` itself, independent of the serializer's
 * own filtering (a trust-boundary check belongs at both layers, since redacting
 * a URL from a response never stops a caller who already knows or guesses the
 * photo ID from requesting it directly): an admin may fetch any
 * pending/rejected photo; the product's own creator may fetch their own still
 * -`pending` photos (their own not-yet-reviewed upload); a `rejected` photo is
 * never served to anyone but an admin, not even its own creator; every other
 * caller gets the same non-enumerating 404 as a nonexistent photo.
 */
export async function privateMediaRoute(app: FastifyInstance) {
  app.get('/:productId/photos/:photoId/:variant', { onRequest: app.requireAuth }, async (req, reply) => {
    const { productId, photoId, variant } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };
    const prisma = getPrisma();

    const photo = await prisma.productPhoto.findFirst({ where: { id: photoId, productId } });
    if (!photo || !photo.privateStorageKey) notFound();

    if (actor.role !== 'admin') {
      if (photo.moderationStatus === 'rejected') notFound();
      // Remaining case is `pending`: only the product's own creator may view it.
      const product = await getVisibleProduct(actor, productId);
      if (!product || product.createdByUserId !== actor.id) notFound();
    }

    const cfg = getConfig().media;
    const path = mediaKeyToPath(cfg.root, variantFileKey(photo.privateStorageKey, variant as MediaVariant));
    // Stream rather than buffer the whole file into memory —
    // at the configured 8MiB display ceiling, concurrent fetches would otherwise
    // multiply directly into heap. `stat` first (cheap, no content read) so a
    // missing file still 404s cleanly instead of surfacing as a stream error
    // after headers may already be committed.
    const fileStat = await stat(path).catch(() => notFound());
    const etag = `"${photo.id}-${variant}-${fileStat.size}-${Math.floor(fileStat.mtimeMs)}"`;

    if (req.headers['if-none-match'] === etag) {
      void reply.status(304);
      return reply.send();
    }

    void reply.header('Content-Type', 'image/webp');
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('ETag', etag);
    void reply.header('Last-Modified', fileStat.mtime.toUTCString());
    void reply.header('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    return reply.send(createReadStream(path));
  });
}
