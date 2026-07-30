import { readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { logger } from '../../logger.js';
import type { MediaVariant } from './product-media-storage.js';

// `sharp`'s CJS `export =` + namespace declaration doesn't resolve cleanly as a type
// namespace under this project's ESM/NodeNext + Bundler-resolution TS setup, so these
// derive the instance/metadata shapes structurally from the value itself instead of
// referencing `sharp.Sharp`/`sharp.Metadata` directly.
type SharpInstance = ReturnType<typeof sharp>;
type SharpMetadata = Awaited<ReturnType<SharpInstance['metadata']>>;

const SOURCE_FORMATS = ['jpeg', 'png', 'heif'] as const;
type SourceFormat = (typeof SOURCE_FORMATS)[number];

function unsupportedMediaType(detail: string): never {
  throw new AppError({
    status: 415,
    code: 'unsupported_media_type',
    title: 'Unsupported photo format',
    detail,
  });
}

function processingFailed(status: number, code: string, detail: string): never {
  throw new AppError({ status, code, title: 'Photo could not be processed', detail });
}

// ---------------------------------------------------------------------------
// HEIC capability probe. A static "does this libvips build declare HEIF input
// support" flag can be a false positive: many prebuilt libvips/libheif
// distributions include the HEIF *container* parser without the HEVC decoder
// plugin (licensing), so a real HEIC (HEVC-coded) file will parse headers fine
// via `.metadata()` but throw on actual pixel decode. Only a real decode attempt
// proves the deployed binary can serve HEIC uploads.
// ---------------------------------------------------------------------------
export interface MediaCapabilities {
  heic: boolean;
}

let cachedCapabilities: MediaCapabilities | undefined;

/** Exported so tests can exercise the decode-success/decode-failure branches
 * directly without depending on a real HEIC fixture existing/working on the
 * host running the test. */
export async function canDecodeAsImage(buffer: Buffer): Promise<boolean> {
  try {
    await sharp(buffer, { limitInputPixels: 50_000_000 }).resize(4, 4).toBuffer();
    return true;
  } catch {
    return false;
  }
}

async function readHeicFixture(): Promise<Buffer> {
  const fixturePath = fileURLToPath(new URL('./__fixtures__/heic-probe-sample.heic', import.meta.url));
  return readFile(fixturePath);
}

/** Cached after first call — the deployed binary's capability can't change at
 * runtime, so re-probing per-request would just waste a real decode every time. */
export async function probeMediaCapabilities(): Promise<MediaCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;
  const staticHeifSupport = Boolean((sharp.format.heif as { input?: { buffer?: boolean } } | undefined)?.input?.buffer);
  let heic = false;
  if (staticHeifSupport) {
    try {
      const fixture = await readHeicFixture();
      heic = await canDecodeAsImage(fixture);
    } catch (err) {
      logger.warn({ err }, 'HEIC capability probe fixture unreadable; treating HEIC as unsupported');
      heic = false;
    }
  }
  cachedCapabilities = { heic };
  if (heic) {
    logger.info('HEIC upload support: enabled (decoder verified at startup)');
  } else {
    logger.warn('HEIC upload support: disabled (libvips build cannot decode HEIC pixel data on this host)');
  }
  return cachedCapabilities;
}

export function resetMediaCapabilitiesForTests(): void {
  cachedCapabilities = undefined;
}

// ---------------------------------------------------------------------------
// Decode concurrency semaphore. Bounds how many Sharp pipelines can be actively
// decoding/encoding at once, independent of how many HTTP requests are in
// flight, so a burst of uploads can't multiply CPU/memory pressure unbounded.
// Each individual pipeline is also pinned to a single libvips thread
// (`sharp.concurrency(1)`, set once at module load) so total worker threads
// stay at (semaphore limit × 1) regardless of request volume.
// ---------------------------------------------------------------------------
sharp.concurrency(1);

let activeDecodes = 0;
const decodeWaitQueue: Array<() => void> = [];

async function acquireDecodeSlot(limit: number): Promise<() => void> {
  if (activeDecodes >= limit) {
    await new Promise<void>((resolve) => decodeWaitQueue.push(resolve));
  }
  activeDecodes++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeDecodes--;
    const next = decodeWaitQueue.shift();
    if (next) next();
  };
}

export interface ProcessedVariant {
  variant: MediaVariant;
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
}

export interface ProcessedVariants {
  sourceMimeType: string;
  display: ProcessedVariant;
  thumb: ProcessedVariant;
}

const FORMAT_TO_MIME: Record<SourceFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  heif: 'image/heic',
};

async function encodeVariant(
  pipeline: SharpInstance,
  variant: MediaVariant,
  maxDimensionPx: number,
  maxBytes: number,
  quality: number,
): Promise<ProcessedVariant> {
  const { data, info } = await pipeline
    .clone()
    .resize(maxDimensionPx, maxDimensionPx, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  if (data.length > maxBytes) {
    processingFailed(
      422,
      'image_too_complex',
      `generated ${variant} exceeds the maximum allowed output size after compression`,
    );
  }
  return { variant, buffer: data, width: info.width, height: info.height, bytes: data.length };
}

/**
 * Decodes `sourcePath` (already-quarantined, on-disk file — never a Buffer, so
 * libvips streams from disk rather than requiring the whole source resident in
 * memory) and produces bounded, metadata-stripped display+thumbnail WebP
 * variants. Every hostile-input bound from the phase spec is enforced here:
 * format allow-list (real content sniffing via libvips, never the client's
 * declared multipart mimetype), decode-time pixel/channel limits, explicit
 * per-dimension caps, a decode concurrency semaphore, an abortable processing
 * deadline, and output-size ceilings on the generated variants.
 */
export async function processProductUpload(input: { sourcePath: string }): Promise<ProcessedVariants> {
  const cfg = getConfig().media;
  const release = await acquireDecodeSlot(cfg.sharpConcurrency);
  let pipeline: SharpInstance | undefined;
  let timer: NodeJS.Timeout | undefined;
  try {
    const run = (async (): Promise<ProcessedVariants> => {
      pipeline = sharp(input.sourcePath, {
        limitInputPixels: cfg.maxDecodedMegapixels * 1_000_000,
        limitInputChannels: cfg.maxChannels,
        failOn: 'error',
        sequentialRead: true,
      });

      let metadata: SharpMetadata;
      try {
        metadata = await pipeline.metadata();
      } catch (err) {
        // `limitInputPixels`/`limitInputChannels` reject at header-read time with a
        // specific message — classify that as a resource-limit rejection (413), and
        // everything else (corrupt/polyglot/unreadable) as an unsupported format (415).
        const message = err instanceof Error ? err.message : 'could not read image metadata';
        if (/exceeds pixel limit|exceeds channel limit/i.test(message)) {
          processingFailed(413, 'image_too_large', message);
        }
        unsupportedMediaType(message);
      }

      const format = metadata.format;
      if (!format || !(SOURCE_FORMATS as readonly string[]).includes(format)) {
        unsupportedMediaType(`unsupported source format: ${format ?? 'unknown'}`);
      }
      const sourceFormat = format as SourceFormat;

      if (sourceFormat === 'heif') {
        const capabilities = await probeMediaCapabilities();
        if (!capabilities.heic) {
          unsupportedMediaType('HEIC uploads are not supported by this deployment');
        }
      }

      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (width <= 0 || height <= 0) {
        unsupportedMediaType('image has no readable dimensions');
      }
      if (width > cfg.maxDimensionPx || height > cfg.maxDimensionPx) {
        processingFailed(413, 'image_too_large', `dimensions ${width}x${height} exceed the maximum of ${cfg.maxDimensionPx}px per side`);
      }
      if (width * height > cfg.maxDecodedMegapixels * 1_000_000) {
        processingFailed(413, 'image_too_large', 'decoded pixel count exceeds the configured limit');
      }
      const channels = metadata.channels ?? 0;
      if (channels <= 0) {
        unsupportedMediaType('image has no readable channel data');
      }
      if (channels > cfg.maxChannels) {
        processingFailed(413, 'image_too_large', `channel count ${channels} exceeds the maximum of ${cfg.maxChannels}`);
      }

      // EXIF auto-orient, then force sRGB. No `.withMetadata()` call — Sharp strips
      // all metadata (EXIF/GPS/ICC) from the output by default, which is exactly the
      // "strip all metadata/GPS" requirement; calling `.withMetadata()` would instead
      // *preserve* it, so its absence here is load-bearing, not an oversight.
      const oriented = pipeline.rotate().toColourspace('srgb');

      const display = await encodeVariant(oriented, 'display', cfg.displayMaxDimensionPx, cfg.maxDisplayBytes, cfg.webpQuality);
      const thumb = await encodeVariant(oriented, 'thumb', cfg.thumbnailMaxDimensionPx, cfg.maxThumbnailBytes, cfg.webpQuality);

      return { sourceMimeType: FORMAT_TO_MIME[sourceFormat], display, thumb };
    })();

    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        // Swallow the stream-level 'error' Duplex#destroy() emits — the caller learns
        // about the timeout through this Promise.race rejection, not a stream event,
        // and an unhandled 'error' event would otherwise crash the process.
        pipeline?.on('error', () => {});
        pipeline?.destroy(new Error('processing deadline exceeded'));
        reject(
          new AppError({
            status: 408,
            code: 'processing_timeout',
            title: 'Photo processing timed out',
          }),
        );
      }, cfg.processingDeadlineMs);
    });

    return await Promise.race([run, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    release();
  }
}

/** Best-effort removal of the quarantined source file; failures are logged, never
 * thrown — the caller's own outbox/cleanup path is the durability guarantee, this
 * is just tidiness on the common (non-crash) success/failure path. */
export async function safeUnlink(path: string): Promise<void> {
  await unlink(path).catch((err: unknown) => {
    logger.warn({ err, path }, 'failed to remove quarantined source file');
  });
}
