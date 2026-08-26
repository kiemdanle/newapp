import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { getConfig } from '../../config.js';
import { ERROR_CODES, giveawayPhotoUploadResponseSchema } from '@expyrico/shared';
import { processGiveawayPhotoUpload } from '../../services/media/giveaway-photo-processor.js';
import { resolveMediaPath } from '../../services/products/product-media-storage.js';
const MAX_GIVEAWAY_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadGiveawayPhotoRoute(app: FastifyInstance) {
  app.post(
    '/giveaways/upload-photo',
    {
      onRequest: [app.requireAuth],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      if (!req.isMultipart()) {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Expected multipart/form-data with a photo file',
        });
      }

      const parts = req.parts();
      const first = await parts.next();
      if (first.done || first.value.type !== 'file') {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Missing image file in multipart form upload',
        });
      }

      const filePart = first.value;
      const buffer = await filePart.toBuffer();
      if (filePart.file.truncated || buffer.length > MAX_GIVEAWAY_PHOTO_BYTES) {
        throw new AppError({
          status: 413,
          code: ERROR_CODES.VALIDATION,
          title: 'Image exceeds maximum 10 MB upload size',
        });
      }

      const userId = req.user!.id;
      const processed = await processGiveawayPhotoUpload({
        sourceBuffer: buffer,
        userId,
        mimeType: filePart.mimetype,
      });

      const response = giveawayPhotoUploadResponseSchema.parse({
        photoUrl: processed.photoUrl,
        thumbUrl: processed.thumbUrl,
      });

      return reply.status(201).send(response);
    },
  );
}

const publicPhotoParamsSchema = z.object({
  userId: z.string().uuid(),
  photoId: z.string().uuid(),
  variant: z.string().min(1),
});

/**
 * Public, unauthenticated giveaway photo delivery route (defense-in-depth fallback
 * when requested directly through the API origin).
 */
export async function publicGiveawayPhotoRoutes(app: FastifyInstance) {
  app.get('/giveaway-photos/:userId/:photoId/:variant', async (req, reply) => {
    const { userId, photoId, variant } = publicPhotoParamsSchema.parse(req.params);
    const cleanVariant = variant.replace(/\.webp$/, '');
    if (cleanVariant !== 'display' && cleanVariant !== 'thumb') {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Photo variant not found',
      });
    }

    const cfg = getConfig().media;
    const diskPath = resolveMediaPath(cfg.root, 'public', 'giveaways', userId, photoId, `${cleanVariant}.webp`);

    const fileExists = await stat(diskPath).catch(() => null);
    if (!fileExists || !fileExists.isFile()) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Photo not found',
      });
    }

    const stream = createReadStream(diskPath);
    return reply
      .type('image/webp')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(stream);
  });
}
