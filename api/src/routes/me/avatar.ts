import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import { toApiUser } from '../../services/users/repository.js';
import { processAvatarUpload, deleteAvatarFromDisk } from '../../services/media/avatar-processor.js';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export async function avatarRoutes(app: FastifyInstance) {
  app.post(
    '/avatar',
    {
      onRequest: [app.requireAuth],
    },
    async (req, reply) => {
      if (!req.isMultipart()) {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          title: 'Expected multipart/form-data with an avatar image file',
        });
      }

      const parts = req.parts();
      const first = await parts.next();
      if (first.done || first.value.type !== 'file') {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          title: 'A valid avatar image file is required',
        });
      }

      const filePart = first.value;
      const buffer = await filePart.toBuffer();
      if (filePart.file.truncated || buffer.length > MAX_AVATAR_BYTES) {
        throw new AppError({
          status: 413,
          code: ERROR_CODES.PAYLOAD_TOO_LARGE,
          title: 'Avatar image file must be 5 MB or smaller',
        });
      }

      const prisma = getPrisma();
      const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!currentUser) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'User not found',
        });
      }

      // Process and store the new 512px WebP avatar
      const processed = await processAvatarUpload({
        sourceBuffer: buffer,
        userId: currentUser.id,
        mimeType: filePart.mimetype,
      });

      // Cleanup prior avatar if existed
      if (currentUser.avatarUrl) {
        await deleteAvatarFromDisk(currentUser.id, currentUser.avatarUrl).catch(() => {});
      }

      const updated = await prisma.user.update({
        where: { id: currentUser.id },
        data: { avatarUrl: processed.avatarUrl },
      });

      return reply.status(200).send({
        avatarUrl: updated.avatarUrl,
        user: toApiUser(updated),
      });
    },
  );

  app.delete(
    '/avatar',
    {
      onRequest: [app.requireAuth],
    },
    async (req, reply) => {
      const prisma = getPrisma();
      const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!currentUser) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'User not found',
        });
      }

      if (currentUser.avatarUrl) {
        await deleteAvatarFromDisk(currentUser.id, currentUser.avatarUrl).catch(() => {});
      }

      const updated = await prisma.user.update({
        where: { id: currentUser.id },
        data: { avatarUrl: null },
      });

      return reply.status(200).send(toApiUser(updated));
    },
  );
}
