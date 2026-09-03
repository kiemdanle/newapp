import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  processFeedbackAttachmentUpload,
  resolveFeedbackAttachmentPath,
  deleteFeedbackAttachmentFiles,
  feedbackAttachmentPrefix,
  MAX_FEEDBACK_ATTACHMENT_BYTES,
} from './attachment-storage.js';
import { AppError } from '../../errors.js';
import { MediaPathError } from '../products/product-media-storage.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'feedback-storage-test-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('Feedback Attachment Storage', () => {
  describe('Path resolution & containment', () => {
    it('generates containment-safe path under root', () => {
      const uploaderId = randomUUID();
      const attachmentId = randomUUID();
      const p = resolveFeedbackAttachmentPath(root, uploaderId, attachmentId, 'display.webp');
      expect(p.startsWith(root)).toBe(true);
      expect(p.includes(uploaderId)).toBe(true);
      expect(p.includes(attachmentId)).toBe(true);
    });

    it('rejects path traversal attempts in filename or UUIDs', () => {
      const uploaderId = randomUUID();
      const attachmentId = randomUUID();
      expect(() => resolveFeedbackAttachmentPath(root, uploaderId, attachmentId, '../evil.webp')).toThrow(
        MediaPathError,
      );
      expect(() => resolveFeedbackAttachmentPath(root, 'invalid-uuid', attachmentId, 'file.txt')).toThrow(
        MediaPathError,
      );
    });
  });

  describe('processFeedbackAttachmentUpload', () => {
    it('processes a valid image and generates display and thumb WebP variants', async () => {
      const uploaderId = randomUUID();
      const attachmentId = randomUUID();

      // Create a small 50x50 PNG buffer
      const pngBuffer = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 4,
          background: { r: 75, g: 174, b: 138, alpha: 1 }, // Expyrico Fresh Sage
        },
      })
        .png()
        .toBuffer();

      const result = await processFeedbackAttachmentUpload({
        root,
        uploaderId,
        attachmentId,
        fileName: 'screenshot.png',
        mimeType: 'image/png',
        buffer: pngBuffer,
      });

      expect(result.isImage).toBe(true);
      expect(result.mimeType).toBe('image/webp');
      expect(result.storageKey).toBe(`private/feedback/${uploaderId}/${attachmentId}/display.webp`);
      expect(result.thumbStorageKey).toBe(`private/feedback/${uploaderId}/${attachmentId}/thumb.webp`);

      const displayStat = await stat(result.diskPath);
      expect(displayStat.size).toBeGreaterThan(0);

      const thumbStat = await stat(result.thumbPath!);
      expect(thumbStat.size).toBeGreaterThan(0);
    });

    it('processes a text/plain document correctly', async () => {
      const uploaderId = randomUUID();
      const attachmentId = randomUUID();
      const textBuffer = Buffer.from('Error log details:\nNullPointerException at scanner.ts:42');

      const result = await processFeedbackAttachmentUpload({
        root,
        uploaderId,
        attachmentId,
        fileName: 'log.txt',
        mimeType: 'text/plain',
        buffer: textBuffer,
      });

      expect(result.isImage).toBe(false);
      expect(result.mimeType).toBe('text/plain');
      expect(result.storageKey).toBe(`private/feedback/${uploaderId}/${attachmentId}/file.txt`);

      const fileStat = await stat(result.diskPath);
      expect(fileStat.size).toBe(textBuffer.length);
    });

    it('rejects unsupported MIME types', async () => {
      const uploaderId = randomUUID();
      const attachmentId = randomUUID();
      const buffer = Buffer.from('fake exe content');

      await expect(
        processFeedbackAttachmentUpload({
          root,
          uploaderId,
          attachmentId,
          fileName: 'malicious.exe',
          mimeType: 'application/x-msdownload',
          buffer,
        }),
      ).rejects.toThrow(AppError);
    });

    it('rejects files exceeding the 10 MB limit', async () => {
      const uploaderId = randomUUID();
      const attachmentId = randomUUID();
      const oversizedBuffer = Buffer.alloc(MAX_FEEDBACK_ATTACHMENT_BYTES + 1);

      await expect(
        processFeedbackAttachmentUpload({
          root,
          uploaderId,
          attachmentId,
          fileName: 'large.pdf',
          mimeType: 'application/pdf',
          buffer: oversizedBuffer,
        }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteFeedbackAttachmentFiles', () => {
    it('cleans up attachment directory', async () => {
      const uploaderId = randomUUID();
      const attachmentId = randomUUID();
      const textBuffer = Buffer.from('test data');

      const result = await processFeedbackAttachmentUpload({
        root,
        uploaderId,
        attachmentId,
        fileName: 'doc.txt',
        mimeType: 'text/plain',
        buffer: textBuffer,
      });

      expect((await stat(result.diskPath)).isFile()).toBe(true);

      await deleteFeedbackAttachmentFiles(root, uploaderId, attachmentId);

      await expect(stat(result.diskPath)).rejects.toThrow();
    });
  });
});
