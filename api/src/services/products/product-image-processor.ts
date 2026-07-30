import { unlink } from 'node:fs/promises';
import sharp from 'sharp';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { logger } from '../../logger.js';
import type { MediaVariant } from './product-media-storage.js';
import { readHeicProbeFixture } from './__fixtures__/heic-probe-sample.js';

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

// Sharp's own `.timeout()` mechanism throws an error whose message starts with
// `timeout: NN% complete` when libvips genuinely aborts in-flight work (as opposed
// to any other decode/encode error). Matching on this is how a real, worker
// -thread-level cancellation is distinguished from a corrupt/unsupported input.
function isSharpTimeoutError(err: unknown): boolean {
  return err instanceof Error && /^timeout:/i.test(err.message);
}

function processingTimedOut(): never {
  throw new AppError({ status: 408, code: 'processing_timeout', title: 'Photo processing timed out' });
}

/** Internal-only marker for the outer wall-clock race below — never thrown
 * across the public API, always translated to `processingTimedOut()`. */
class ProcessingDeadlineExceededError extends Error {}

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

/** Cached after first call — the deployed binary's capability can't change at
 * runtime, so re-probing per-request would just waste a real decode every time.
 * The fixture is base64-embedded in source (see `__fixtures__/heic-probe-sample.ts`)
 * specifically so it survives compilation into `dist/` — `tsc` copies no
 * non-`.ts` assets, so a file-path-relative fixture silently vanished from every
 * production build and the probe always reported HEIC unsupported regardless of
 * the host's real capability. A static "does this libvips build
 * declare HEIF input support" flag alone is insufficient too: many prebuilt
 * libvips/libheif distributions include the HEIF *container* parser without the
 * HEVC decoder plugin (licensing), reporting the flag `true` while still failing
 * every real decode — only an actual decode attempt proves the deployed binary
 * can serve HEIC uploads. An unreadable/corrupt embedded fixture on a host whose
 * static flag says `true` is a startup **error**, not a silent warning — that
 * combination is otherwise indistinguishable from a genuinely HEIC-incapable host. */
export async function probeMediaCapabilities(): Promise<MediaCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;
  const staticHeifSupport = Boolean((sharp.format.heif as { input?: { buffer?: boolean } } | undefined)?.input?.buffer);
  let heic = false;
  if (staticHeifSupport) {
    let fixture: Buffer;
    try {
      fixture = readHeicProbeFixture();
    } catch (err) {
      throw new Error('HEIC capability probe fixture is corrupt or unreadable; refusing to start', { cause: err });
    }
    heic = await canDecodeAsImage(fixture);
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

/**
 * Counting semaphore that *transfers* a permit directly to the next waiter on
 * release rather than decrementing-then-letting-the-waiter-increment — the
 * previous version did the latter, which let `activeDecodes` drift above `limit`
 * when a queued `acquireDecodeSlot` call's `await` resolved as a microtask
 * interleaved between another caller's decrement and the waiter's own increment.
 * Only ever decrement when there is no waiter to hand the
 * permit to.
 */
async function acquireDecodeSlot(limit: number): Promise<() => void> {
  if (activeDecodes < limit) {
    activeDecodes++;
  } else {
    await new Promise<void>((resolve) => decodeWaitQueue.push(resolve));
    // Resumed by a release() that already earmarked this permit for us — the
    // count was never decremented for it, so we must not increment here either.
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = decodeWaitQueue.shift();
    if (next) {
      next();
    } else {
      activeDecodes--;
    }
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
 *
 * Cancellation is two-layered:
 *
 * 1. **Per-operation, via Sharp's own `.timeout()`.** libvips aborts the
 *    in-flight worker-thread task itself, not just the outer JS promise — an
 *    earlier version raced an external `setTimeout` against the decode
 *    promise, which only ever abandoned the JS side: `pipeline.destroy()`
 *    doesn't reach the `.clone()`d pipelines each variant encode runs on, and
 *    already-dispatched libvips threadpool work is not otherwise cancellable,
 *    so the semaphore slot was being handed back while a libvips thread kept
 *    consuming CPU/memory for the input's real processing time — silently
 *    defeating `MEDIA_SHARP_CONCURRENCY`. This bound is real
 *    cancellation, but it applies *per libvips operation* — the metadata
 *    read, the display encode, and the thumb encode each restart their own
 *    `timeoutSeconds` clock, so a pipeline with several serial operations
 *    could legitimately run several multiples of the configured deadline in
 *    total before *any* single operation's own clock ever fired.
 * 2. **Whole-request, via an outer `Promise.race`.** This is what actually
 *    makes `MEDIA_PROCESSING_DEADLINE_MS` a real bound on the *documented*
 *    unit — one upload — rather than on one internal libvips call. If the
 *    outer deadline fires first, the caller gets a timely 408 without
 *    waiting for whichever operation is still in flight — but the decode
 *    semaphore slot is only ever released once the real underlying work
 *    (`run` below) has genuinely settled, via `.finally()` on `run` itself,
 *    never eagerly on the race's timeout branch. Layer 1's cancellation is
 *    still what actually reaps the libvips work in that case; layer 2 only
 *    changes when the *caller* stops waiting for it.
 */
async function runProcessing(
  input: { sourcePath: string },
  cfg: ReturnType<typeof getConfig>['media'],
  setPipeline: (p: SharpInstance) => void,
): Promise<ProcessedVariants> {
  // Sharp's `.timeout()` only accepts whole seconds (1-3600); round up so a
  // sub-second configured deadline still gets at least the minimum granularity
  // sharp supports, rather than silently becoming "no timeout" at 0.
  const timeoutSeconds = Math.max(1, Math.ceil(cfg.processingDeadlineMs / 1000));
  const pipeline = sharp(input.sourcePath, {
    limitInputPixels: cfg.maxDecodedMegapixels * 1_000_000,
    limitInputChannels: cfg.maxChannels,
    failOn: 'error',
    sequentialRead: true,
  }).timeout({ seconds: timeoutSeconds });
  // Handed to the caller immediately (before any operation below can throw) so
  // the outer wrapper's cleanup can reach this pipeline no matter where
  // processing stops.
  setPipeline(pipeline);

  let metadata: SharpMetadata;
  try {
    metadata = await pipeline.metadata();
  } catch (err) {
    if (isSharpTimeoutError(err)) processingTimedOut();
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

  try {
    const display = await encodeVariant(oriented, 'display', cfg.displayMaxDimensionPx, cfg.maxDisplayBytes, cfg.webpQuality);
    const thumb = await encodeVariant(oriented, 'thumb', cfg.thumbnailMaxDimensionPx, cfg.maxThumbnailBytes, cfg.webpQuality);
    return { sourceMimeType: FORMAT_TO_MIME[sourceFormat], display, thumb };
  } catch (err) {
    if (isSharpTimeoutError(err)) processingTimedOut();
    throw err;
  }
}

/**
 * Public entry point: runs `runProcessing` under the decode concurrency
 * semaphore and the outer whole-request deadline described above. The
 * semaphore slot and the pipeline's own cleanup are only ever released once
 * `run` has genuinely settled — never eagerly when the outer race's deadline
 * branch wins — preserving the concurrency-bound invariant established
 * above.
 */
export async function processProductUpload(input: { sourcePath: string }): Promise<ProcessedVariants> {
  const cfg = getConfig().media;
  const release = await acquireDecodeSlot(cfg.sharpConcurrency);
  let pipeline: SharpInstance | undefined;

  const run = runProcessing(input, cfg, (p) => {
    pipeline = p;
  });

  // Attached to `run` itself (not to the raced promise below) so cleanup only
  // ever fires once the real work has settled, regardless of which branch of
  // the race below wins.
  run
    .finally(() => {
      // Sharp's own per-operation timeout is what actually stops libvips by
      // the time we get here — this is tidiness, not a substitute for
      // cancellation. Swallow any stream-level 'error' `destroy()` emits so it
      // can't surface as an unhandled event.
      pipeline?.on('error', () => {});
      pipeline?.destroy();
      release();
    })
    .catch(() => {}); // already handled by the `run` consumer below; avoid a duplicate unhandled-rejection report

  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    deadlineTimer = setTimeout(() => reject(new ProcessingDeadlineExceededError()), cfg.processingDeadlineMs);
  });

  try {
    return await Promise.race([run, deadline]);
  } catch (err) {
    if (err instanceof ProcessingDeadlineExceededError) processingTimedOut();
    throw err;
  } finally {
    clearTimeout(deadlineTimer);
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
