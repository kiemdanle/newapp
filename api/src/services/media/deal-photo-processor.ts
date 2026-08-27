import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import { publicMediaUrl, resolveMediaPath } from '../products/product-media-storage.js';

const ALLOWED_MIME_TYPES: Record<string, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/heic': true,
  'image/webp': true,
};

export interface ProcessedDealPhotoResult {
  photoUrl: string;
  thumbUrl: string;
  storageKeyPrefix: string;
  displayPath: string;
  thumbPath: string;
}

/**
 * Validates, auto-rotates, and converts an uploaded deal photo into
 * 1600px max (display) and 320px (thumb) WebP variants under the public media root.
 */
export async function processDealPhotoUpload(input: {
  sourceBuffer: Buffer;
  userId: string;
  mimeType?: string;
}): Promise<ProcessedDealPhotoResult> {
  const cfg = getConfig().media;

  // Enforce strict MIME allowlist
  if (input.mimeType && !ALLOWED_MIME_TYPES[input.mimeType.toLowerCase()]) {
    throw new AppError({
      status: 415,
      code: ERROR_CODES.UNSUPPORTED_MEDIA,
      title: `Unsupported image format (${input.mimeType}). Expected JPEG, PNG, HEIC, or WebP.`,
    });
  }

  const photoId = randomUUID();
  const storageKeyPrefix = `public/deals/${input.userId}/${photoId}`;
  const displayDiskPath = resolveMediaPath(cfg.root, 'public', 'deals', input.userId, photoId, 'display.webp');
  const thumbDiskPath = resolveMediaPath(cfg.root, 'public', 'deals', input.userId, photoId, 'thumb.webp');

  const meta = await sharp(input.sourceBuffer)
    .metadata()
    .catch(() => {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: 'Uploaded file is not a valid image or could not be decoded',
      });
    });

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: 'Image has zero dimensions',
    });
  }

  // Decompression bomb guard
  if (width * height > cfg.maxDecodedMegapixels * 1_000_000 || width > cfg.maxDimensionPx || height > cfg.maxDimensionPx) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: 'Image exceeds maximum allowed dimensions',
    });
  }

  // Generate 1600px max display and 320px max thumbnail WebP
  const [displayBuffer, thumbBuffer] = await Promise.all([
    sharp(input.sourceBuffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer(),
    sharp(input.sourceBuffer)
      .rotate()
      .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer(),
  ]);

  const photoDir = dirname(displayDiskPath);
  await mkdir(photoDir, { recursive: true });

  await Promise.all([
    writeFile(displayDiskPath, displayBuffer),
    writeFile(thumbDiskPath, thumbBuffer),
  ]);

  await Promise.all([
    chmod(displayDiskPath, 0o644),
    chmod(thumbDiskPath, 0o644),
  ]);

  const photoUrl = publicMediaUrl(cfg.publicBaseUrl, storageKeyPrefix, 'display');
  const thumbUrl = publicMediaUrl(cfg.publicBaseUrl, storageKeyPrefix, 'thumb');

  return {
    photoUrl,
    thumbUrl,
    storageKeyPrefix,
    displayPath: displayDiskPath,
    thumbPath: thumbDiskPath,
  };
}
