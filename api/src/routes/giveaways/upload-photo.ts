import type { FastifyInstance } from 'fastify';
import { AppError } from '../../errors.js';
import { ERROR_CODES, giveawayPhotoUploadResponseSchema } from '@expyrico/shared';
import { processGiveawayPhotoUpload } from '../../services/media/giveaway-photo-processor.js';

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
