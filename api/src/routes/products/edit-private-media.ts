import type { FastifyInstance } from 'fastify';
import { readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { mediaKeyToPath, variantFileKey, type MediaVariant } from '../../services/products/product-media-storage.js';

const paramSchema = z.object({
  editId: z.string().uuid(),
  photoId: z.string().uuid(),
  variant: z.enum(['display', 'thumb']),
});

function notFound(): never {
  throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Photo not found' });
}

/**
 * Authorized private byte delivery for staged `ProductEditPhoto` rows (the edit
 * owner or an admin only — no other visibility rule applies to a staged, unapproved
 * edit). Parent-bound the same way the product photo route is: `photoId` is bound
 * to its declared `editId` before any authorization check. A *retained* entry
 * (`sourceProductPhotoId` set, no staged bytes of its own) 404s here by design —
 * retained photos are served through the original product's photo route, not this
 * one, since this route only ever serves newly staged bytes.
 */
export async function editPrivateMediaRoute(app: FastifyInstance) {
  app.get('/:editId/photos/:photoId/:variant', { onRequest: app.requireAuth }, async (req, reply) => {
    const { editId, photoId, variant } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };
    const prisma = getPrisma();

    const editPhoto = await prisma.productEditPhoto.findFirst({
      where: { id: photoId, productEditId: editId },
      include: { productEdit: { select: { submittedBy: true } } },
    });
    if (!editPhoto || !editPhoto.privateStorageKey) notFound();
    if (actor.role !== 'admin' && editPhoto.productEdit.submittedBy !== actor.id) notFound();

    const cfg = getConfig().media;
    const path = mediaKeyToPath(cfg.root, variantFileKey(editPhoto.privateStorageKey, variant as MediaVariant));
    const fileStat = await stat(path).catch(() => notFound());
    const etag = `"${editPhoto.id}-${variant}-${fileStat.size}-${Math.floor(fileStat.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) {
      void reply.status(304);
      return reply.send();
    }

    const buffer = await readFile(path).catch(() => notFound());

    void reply.header('Content-Type', 'image/webp');
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('ETag', etag);
    void reply.header('Last-Modified', fileStat.mtime.toUTCString());
    void reply.header('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    return reply.send(buffer);
  });
}
