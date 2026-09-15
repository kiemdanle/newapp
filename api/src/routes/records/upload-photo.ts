import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { getConfig } from '../../config.js';
import { ERROR_CODES, recordPhotoUploadResponseSchema } from '@expyrico/shared';
import { processRecordPhotoUpload } from '../../services/media/record-photo-processor.js';
import { resolveMediaPath } from '../../services/products/product-media-storage.js';

const MAX_RECORD_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadRecordPhotoRoute(app: FastifyInstance) {
  app.post(
    '/records/upload-photo',
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
      if (filePart.file.truncated || buffer.length > MAX_RECORD_PHOTO_BYTES) {
        throw new AppError({
          status: 413,
          code: ERROR_CODES.VALIDATION,
          title: 'Image exceeds maximum 10 MB upload size',
        });
      }

      const userId = req.user!.id;
      const processed = await processRecordPhotoUpload({
        sourceBuffer: buffer,
        userId,
        mimeType: filePart.mimetype,
      });

      const response = recordPhotoUploadResponseSchema.parse({
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

export async function publicRecordPhotoRoutes(app: FastifyInstance) {
  app.get('/record-photos/:userId/:photoId/:variant', async (req, reply) => {
    const parsed = publicPhotoParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(404).send({ message: 'Photo not found' });
    }

    const { userId, photoId, variant } = parsed.data;
    const filename = `${variant}.webp`;
    const cfg = getConfig().media;
    const diskPath = resolveMediaPath(cfg.root, 'public', 'records', userId, photoId, filename);

    try {
      await stat(diskPath);
    } catch {
      return reply.status(404).send({ message: 'Photo not found' });
    }

    reply.header('content-type', 'image/webp');
    reply.header('cache-control', 'public, max-age=31536000, immutable');
    return reply.send(createReadStream(diskPath));
  });
}
