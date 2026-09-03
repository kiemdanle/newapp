import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { ERROR_CODES, feedbackAttachmentSchema } from '@expyrico/shared';
import {
  processFeedbackAttachmentUpload,
  resolveFeedbackAttachmentPath,
  MAX_FEEDBACK_ATTACHMENT_BYTES,
} from '../../services/feedback/attachment-storage.js';
import { toApiFeedbackAttachment } from '../../services/feedback/repository.js';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function feedbackAttachmentRoutes(app: FastifyInstance) {
  // 1. Upload Attachment
  app.post(
    '/feedback/attachments',
    {
      onRequest: [app.requireAuth],
      config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      if (!req.isMultipart()) {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Expected multipart/form-data upload',
        });
      }

      const parts = req.parts();
      const first = await parts.next();
      if (first.done || first.value.type !== 'file') {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Missing file in multipart form upload',
        });
      }

      const filePart = first.value;
      const buffer = await filePart.toBuffer();
      if (filePart.file.truncated || buffer.length > MAX_FEEDBACK_ATTACHMENT_BYTES) {
        throw new AppError({
          status: 413,
          code: ERROR_CODES.FEEDBACK_ATTACHMENT_TOO_LARGE,
          title: 'File exceeds 10 MB maximum upload size',
        });
      }

      const userId = req.user!.id;
      const attachmentId = randomUUID();
      const cfg = getConfig().media;

      const processed = await processFeedbackAttachmentUpload({
        root: cfg.root,
        uploaderId: userId,
        attachmentId,
        fileName: filePart.filename || 'attachment',
        mimeType: filePart.mimetype,
        buffer,
      });

      const prisma = getPrisma();
      const attachment = await prisma.feedbackAttachment.create({
        data: {
          id: attachmentId,
          uploaderId: userId,
          fileName: filePart.filename || 'attachment',
          mimeType: processed.mimeType,
          fileSizeBytes: processed.fileSizeBytes,
          storageKey: processed.storageKey,
        },
      });

      return reply.status(201).send(toApiFeedbackAttachment(attachment));
    },
  );

  // 2. Stream/Download Attachment
  app.get(
    '/feedback/attachments/:id',
    { onRequest: [app.requireAuth] },
    async (req, reply) => {
      const { id } = idParamSchema.parse(req.params);
      const prisma = getPrisma();
      const userId = req.user!.id;
      const role = req.user!.role;

      const attachment = await prisma.feedbackAttachment.findUnique({
        where: { id },
        include: { ticket: true },
      });

      if (!attachment) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.FEEDBACK_ATTACHMENT_NOT_FOUND,
          title: 'Attachment not found',
        });
      }

      // Authorization: Must be uploader, ticket owner, or admin
      const isUploader = attachment.uploaderId === userId;
      const isTicketOwner = attachment.ticket?.userId === userId;
      const isAdmin = role === 'admin';

      if (!isUploader && !isTicketOwner && !isAdmin) {
        throw new AppError({
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
          title: 'Access denied to this attachment',
        });
      }

      const cfg = getConfig().media;
      // Extract fileNameOrVariant from storageKey: e.g. "display.webp" or "file.pdf"
      const leafName = attachment.storageKey.split('/').pop() || 'file';
      const diskPath = resolveFeedbackAttachmentPath(
        cfg.root,
        attachment.uploaderId,
        attachment.id,
        leafName,
      );

      try {
        await stat(diskPath);
      } catch {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.FEEDBACK_ATTACHMENT_NOT_FOUND,
          title: 'Attachment file not found on disk',
        });
      }

      reply.header('Content-Type', attachment.mimeType);
      reply.header('Content-Disposition', `inline; filename="${attachment.fileName}"`);
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'private, no-cache');

      return reply.send(createReadStream(diskPath));
    },
  );
}
