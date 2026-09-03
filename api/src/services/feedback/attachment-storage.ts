import sharp from 'sharp';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import {
  resolveMediaPath,
  assertUuidSegment,
} from '../products/product-media-storage.js';
export const FEEDBACK_ALLOWED_MIME_TYPES: Record<string, 'image' | 'document'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/heic': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
  'text/plain': 'document',
};

export const MAX_FEEDBACK_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ProcessedFeedbackAttachment {
  storageKey: string;
  diskPath: string;
  thumbPath?: string;
  thumbStorageKey?: string;
  fileSizeBytes: number;
  mimeType: string;
  isImage: boolean;
}

export function feedbackAttachmentPrefix(uploaderId: string, attachmentId: string): string {
  assertUuidSegment(uploaderId, 'uploaderId');
  assertUuidSegment(attachmentId, 'attachmentId');
  return `private/feedback/${uploaderId}/${attachmentId}`;
}

export function resolveFeedbackAttachmentPath(
  root: string,
  uploaderId: string,
  attachmentId: string,
  fileNameOrVariant: string,
): string {
  assertUuidSegment(uploaderId, 'uploaderId');
  assertUuidSegment(attachmentId, 'attachmentId');
  return resolveMediaPath(root, 'private', 'feedback', uploaderId, attachmentId, fileNameOrVariant);
}

export async function processFeedbackAttachmentUpload(input: {
  root: string;
  uploaderId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ProcessedFeedbackAttachment> {
  // 1. Enforce size limit
  if (input.buffer.length > MAX_FEEDBACK_ATTACHMENT_BYTES) {
    throw new AppError({
      status: 413,
      code: ERROR_CODES.FEEDBACK_ATTACHMENT_TOO_LARGE,
      title: 'Attachment exceeds 10 MB maximum allowed size',
    });
  }

  // 2. Enforce MIME type allowlist
  const normalizedMime = input.mimeType.toLowerCase();
  const kind = FEEDBACK_ALLOWED_MIME_TYPES[normalizedMime];
  if (!kind) {
    throw new AppError({
      status: 415,
      code: ERROR_CODES.UNSUPPORTED_MEDIA,
      title: `Unsupported file type (${input.mimeType}). Expected JPEG, PNG, HEIC, WebP, PDF, or text.`,
    });
  }

  assertUuidSegment(input.uploaderId, 'uploaderId');
  assertUuidSegment(input.attachmentId, 'attachmentId');

  const prefix = feedbackAttachmentPrefix(input.uploaderId, input.attachmentId);

  if (kind === 'image') {
    const displayDiskPath = resolveMediaPath(
      input.root,
      'private',
      'feedback',
      input.uploaderId,
      input.attachmentId,
      'display.webp',
    );
    const thumbDiskPath = resolveMediaPath(
      input.root,
      'private',
      'feedback',
      input.uploaderId,
      input.attachmentId,
      'thumb.webp',
    );

    await mkdir(dirname(displayDiskPath), { recursive: true });

    // Validate image format with sharp
    const meta = await sharp(input.buffer)
      .metadata()
      .catch(() => {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Uploaded image could not be decoded or is corrupted',
        });
      });

    if (!meta.width || !meta.height) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: 'Uploaded image has zero dimensions',
      });
    }

    // Process display (max 1600px, WebP, quality 85)
    const displayBuf = await sharp(input.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Process thumb (max 320px, WebP, quality 80)
    const thumbBuf = await sharp(input.buffer)
      .rotate()
      .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    await writeFile(displayDiskPath, displayBuf, { mode: 0o644 });
    await writeFile(thumbDiskPath, thumbBuf, { mode: 0o644 });

    return {
      storageKey: `${prefix}/display.webp`,
      diskPath: displayDiskPath,
      thumbStorageKey: `${prefix}/thumb.webp`,
      thumbPath: thumbDiskPath,
      fileSizeBytes: displayBuf.length,
      mimeType: 'image/webp',
      isImage: true,
    };
  } else {
    // Document (PDF or TXT)
    const safeExt = normalizedMime === 'application/pdf' ? 'pdf' : 'txt';
    const diskPath = resolveMediaPath(
      input.root,
      'private',
      'feedback',
      input.uploaderId,
      input.attachmentId,
      `file.${safeExt}`,
    );

    await mkdir(dirname(diskPath), { recursive: true });
    await writeFile(diskPath, input.buffer, { mode: 0o644 });

    return {
      storageKey: `${prefix}/file.${safeExt}`,
      diskPath,
      fileSizeBytes: input.buffer.length,
      mimeType: normalizedMime,
      isImage: false,
    };
  }
}

export async function deleteFeedbackAttachmentFiles(
  root: string,
  uploaderId: string,
  attachmentId: string,
): Promise<void> {
  const dirPath = resolveMediaPath(root, 'private', 'feedback', uploaderId, attachmentId);
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}
