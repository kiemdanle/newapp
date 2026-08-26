import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import { publicMediaUrl, resolveMediaPath } from '../products/product-media-storage.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
]);

export interface ProcessedAvatarResult {
  avatarUrl: string;
  storageKeyPrefix: string;
  displayPath: string;
  thumbPath: string;
}

/**
 * Validates, square-crops, and converts an uploaded user avatar into 512px
 * (display) and 128px (thumb) WebP variants under the public media root.
 */
export async function processAvatarUpload(input: {
  sourceBuffer: Buffer;
  userId: string;
  mimeType?: string;
}): Promise<ProcessedAvatarResult> {
  const cfg = getConfig().media;

  // Enforce strict MIME allowlist, rejecting SVG (XSS) and GIF (CPU exhaustion)
  if (input.mimeType && !ALLOWED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    throw new AppError({
      status: 415,
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      title: 'Only JPEG, PNG, HEIC, and WebP avatar images are supported',
    });
  }

  const avatarId = randomUUID();
  const storageKeyPrefix = `public/avatars/${input.userId}/${avatarId}`;
  const displayDiskPath = resolveMediaPath(cfg.root, 'public', 'avatars', input.userId, avatarId, 'display.webp');
  const thumbDiskPath = resolveMediaPath(cfg.root, 'public', 'avatars', input.userId, avatarId, 'thumb.webp');

  let pipeline = sharp(input.sourceBuffer, { failOnError: true }).rotate();
  const meta = await pipeline.metadata().catch((err: unknown) => {
    throw new AppError({
      status: 415,
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      title: 'Image decoding failed or corrupted image payload',
    });
  });

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new AppError({
      status: 415,
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      title: 'Image has invalid dimensions',
    });
  }

  // Decompression bomb guard
  if (width * height > cfg.maxDecodedMegapixels * 1_000_000 || width > cfg.maxDimensionPx || height > cfg.maxDimensionPx) {
    throw new AppError({
      status: 413,
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      title: 'Image dimensions exceed maximum allowed limits',
    });
  }

  // Calculate square center crop
  const squareSize = Math.min(width, height);
  const left = Math.floor((width - squareSize) / 2);
  const top = Math.floor((height - squareSize) / 2);

  const cropped = pipeline.extract({ left, top, width: squareSize, height: squareSize });

  // Generate 512x512 display and 128x128 thumbnail
  const [displayBuffer, thumbBuffer] = await Promise.all([
    cropped.clone().resize(512, 512, { fit: 'cover' }).webp({ quality: 90 }).toBuffer(),
    cropped.clone().resize(128, 128, { fit: 'cover' }).webp({ quality: 90 }).toBuffer(),
  ]);

  await mkdir(dirname(displayDiskPath), { recursive: true });
  await Promise.all([
    writeFile(displayDiskPath, displayBuffer),
    writeFile(thumbDiskPath, thumbBuffer),
  ]);

  const avatarUrl = publicMediaUrl(cfg.publicBaseUrl, storageKeyPrefix, 'display');

  return {
    avatarUrl,
    storageKeyPrefix,
    displayPath: displayDiskPath,
    thumbPath: thumbDiskPath,
  };
}

/**
 * Removes avatar files and parent avatar directory from disk if they exist.
 */
export async function deleteAvatarFromDisk(userId: string, avatarUrl: string): Promise<void> {
  try {
    const cfg = getConfig().media;
    // Derive relative directory from user id
    const userAvatarDir = resolveMediaPath(cfg.root, 'public', 'avatars', userId);
    await rm(userAvatarDir, { recursive: true, force: true }).catch(() => {});
  } catch {
    /* best-effort cleanup */
  }
}
