import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig, resetConfigForTests } from '../../config.js';
import { AppError } from '../../errors.js';
import {
  canDecodeAsImage,
  probeMediaCapabilities,
  processProductUpload,
  resetMediaCapabilitiesForTests,
} from './product-image-processor.js';
import { readHeicProbeFixture } from './__fixtures__/heic-probe-sample.js';

let dir: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'image-processor-test-'));
  resetMediaCapabilitiesForTests();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
  resetMediaCapabilitiesForTests();
});

function overrideMediaEnv(overrides: Record<string, string>) {
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  resetConfigForTests();
}

async function writeFixture(name: string, buffer: Buffer): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, buffer);
  return path;
}

/** Gaussian noise compresses poorly and is expensive to decode/resize/encode —
 * unlike a flat-color fixture, this genuinely keeps libvips busy for a measurable
 * time through the real (no-blur) production pipeline, which is what the deadline
 * -cancellation and concurrency-bound tests below need to observe. */
async function noisyJpeg(size: number): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background: 'black', noise: { type: 'gaussian', mean: 128, sigma: 45 } } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** PNG, not JPEG: libjpeg's shrink-on-load lets a JPEG decode directly at a much
 * lower internal resolution when the pipeline immediately downsizes it (exactly
 * what `processProductUpload` does), so even a huge noisy JPEG source finishes
 * well under a second — no good for proving a *slow* decode gets cancelled. PNG
 * has no equivalent optimization, so a large noisy PNG forces a genuinely
 * expensive full-resolution decode. Generated at `sharp.concurrency(4)` (module
 * import elsewhere pins the global to 1 for production single-threaded-per-op
 * behavior, which would otherwise make fixture generation itself glacially slow)
 * and restored to 1 immediately after, matching what `processProductUpload` runs
 * under in every other test in this file. */
async function slowToProcessNoisyPng(size: number): Promise<Buffer> {
  sharp.concurrency(4);
  try {
    return await sharp({ create: { width: size, height: size, channels: 3, background: 'black', noise: { type: 'gaussian', mean: 128, sigma: 45 } } })
      .png({ compressionLevel: 1 })
      .toBuffer();
  } finally {
    sharp.concurrency(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// CRC32 + minimal IHDR patcher so we can make a real, tiny, cheaply-decodable PNG
// whose *header* claims a much larger width/height than its actual pixel data —
// exactly how a decompression-bomb-style resource-exhaustion attack is shaped, and
// exactly what `limitInputPixels`/the explicit dimension check must reject without
// ever materializing the claimed pixel count.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function pngWithClaimedDimensions(claimedWidth: number, claimedHeight: number): Promise<Buffer> {
  const real = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();
  // PNG: 8-byte signature, then chunks of [length(4) type(4) data(len) crc(4)].
  // IHDR is always the first chunk, data = width(4) height(4) bitdepth colortype ...
  const ihdrDataStart = 8 + 8; // signature + (length+type) of IHDR chunk header
  const patched = Buffer.from(real);
  patched.writeUInt32BE(claimedWidth, ihdrDataStart);
  patched.writeUInt32BE(claimedHeight, ihdrDataStart + 4);
  const ihdrLength = patched.readUInt32BE(8);
  const chunkTypeAndData = patched.subarray(12, 12 + 4 + ihdrLength);
  const newCrc = crc32(chunkTypeAndData);
  patched.writeUInt32BE(newCrc, 12 + 4 + ihdrLength);
  return patched;
}

describe('canDecodeAsImage', () => {
  it('resolves true for a real image buffer', async () => {
    const buf = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).png().toBuffer();
    await expect(canDecodeAsImage(buf)).resolves.toBe(true);
  });

  it('resolves false for garbage bytes', async () => {
    await expect(canDecodeAsImage(randomBytes(64))).resolves.toBe(false);
  });
});

describe('readHeicProbeFixture — build-safety (reviewer-p3 I4)', () => {
  it('has no filesystem dependency at all, so it cannot vanish when `tsc` copies no non-.ts assets into dist/', () => {
    // The bug: the previous fixture was read from a sibling `.heic` file resolved
    // relative to `import.meta.url`. `tsc` never copies non-`.ts` assets into
    // `dist/`, so that file silently didn't exist in any compiled build — the
    // probe always reported HEIC unsupported in production, regardless of the
    // host's real capability. Embedding the bytes as a base64 constant in this
    // `.ts` module eliminates the file read entirely: if this module compiles,
    // the fixture ships with it, structurally.
    const buf = readHeicProbeFixture();
    expect(buf.length).toBeGreaterThan(100_000); // the real fixture, not a stub
    // Real ISO-BMFF/HEIF files start with a box-size (4 bytes) then the 'ftyp' box.
    expect(buf.subarray(4, 8).toString('ascii')).toBe('ftyp');
  });
});

describe('probeMediaCapabilities', () => {
  it('reports a stable, cached HEIC support result exposing the real deployed decoder', async () => {
    const first = await probeMediaCapabilities();
    const second = await probeMediaCapabilities();
    expect(second).toBe(first); // same cached object reference
    expect(typeof first.heic).toBe('boolean');
  });
});

describe('processProductUpload — accepted formats', () => {
  it('processes a valid JPEG into display+thumb WebP variants', async () => {
    const source = await sharp({ create: { width: 200, height: 100, channels: 3, background: 'blue' } })
      .jpeg()
      .toBuffer();
    const path = await writeFixture('in.jpg', source);
    const result = await processProductUpload({ sourcePath: path });
    expect(result.sourceMimeType).toBe('image/jpeg');
    expect(result.display.variant).toBe('display');
    expect(result.thumb.variant).toBe('thumb');
    expect(result.display.width).toBeLessThanOrEqual(getConfig().media.displayMaxDimensionPx);
    expect(result.thumb.width).toBeLessThanOrEqual(getConfig().media.thumbnailMaxDimensionPx);

    const displayMeta = await sharp(result.display.buffer).metadata();
    expect(displayMeta.format).toBe('webp');
    expect(displayMeta.space).toBe('srgb');
    // No EXIF block at all (Sharp strips it by default) implies no GPS sub-IFD either.
    expect(displayMeta.exif).toBeUndefined();
  });

  it('processes a valid PNG', async () => {
    const source = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } })
      .png()
      .toBuffer();
    const path = await writeFixture('in.png', source);
    const result = await processProductUpload({ sourcePath: path });
    expect(result.sourceMimeType).toBe('image/png');
  });

  it('never enlarges a source smaller than the target dimensions', async () => {
    const source = await sharp({ create: { width: 10, height: 8, channels: 3, background: 'green' } })
      .jpeg()
      .toBuffer();
    const path = await writeFixture('small.jpg', source);
    const result = await processProductUpload({ sourcePath: path });
    expect(result.display.width).toBeLessThanOrEqual(10);
    expect(result.display.height).toBeLessThanOrEqual(8);
  });

  it('applies EXIF auto-orientation and then strips it from the output', async () => {
    // Orientation 6 = rotate 90° CW: a 40x20 source should come out swapped (~20x40).
    const source = await sharp({ create: { width: 40, height: 20, channels: 3, background: 'yellow' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const path = await writeFixture('rotated.jpg', source);
    const result = await processProductUpload({ sourcePath: path });
    expect(result.display.height).toBeGreaterThan(result.display.width);
  });

  it('rejects the real committed HEIC fixture when the host cannot decode HEVC pixel data (the common case for default Sharp/libvips builds)', async () => {
    const capabilities = await probeMediaCapabilities();
    const fixturePath = await writeFixture('heic-probe.heic', readHeicProbeFixture());
    if (capabilities.heic) {
      // Host genuinely supports HEIC decode — processing should succeed.
      const result = await processProductUpload({ sourcePath: fixturePath });
      expect(result.sourceMimeType).toBe('image/heic');
    } else {
      await expect(processProductUpload({ sourcePath: fixturePath })).rejects.toMatchObject({
        status: 415,
        code: 'unsupported_media_type',
      });
    }
  });
});

describe('processProductUpload — hostile input rejection', () => {
  it('rejects an unsupported source format (WebP is not in the accept-list)', async () => {
    const source = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).webp().toBuffer();
    const path = await writeFixture('in.webp', source);
    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({
      status: 415,
      code: 'unsupported_media_type',
    });
  });

  it('rejects SVG even though libvips can technically rasterize it', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    const path = await writeFixture('in.svg', svg);
    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({
      status: 415,
      code: 'unsupported_media_type',
    });
  });

  it('rejects GIF', async () => {
    // Minimal valid 1x1 transparent GIF87a.
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64');
    const path = await writeFixture('in.gif', gif);
    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({
      status: 415,
      code: 'unsupported_media_type',
    });
  });

  it('rejects corrupt/polyglot data with a spoofed JPEG magic number', async () => {
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(200)]);
    const path = await writeFixture('corrupt.jpg', corrupt);
    await expect(processProductUpload({ sourcePath: path })).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a decoded pixel count above the configured megapixel limit (header-claimed, not materialized)', async () => {
    overrideMediaEnv({ MEDIA_MAX_DECODED_MEGAPIXELS: '1' });
    // 2000x2000 = 4MP > 1MP limit, actual pixel data is a tiny 4x4 image.
    const bomb = await pngWithClaimedDimensions(2000, 2000);
    const path = await writeFixture('bomb.png', bomb);
    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({ status: 413 });
  });

  it('rejects a single dimension above the configured per-side limit even under the megapixel cap', async () => {
    overrideMediaEnv({ MEDIA_MAX_DIMENSION_PX: '500', MEDIA_MAX_DECODED_MEGAPIXELS: '40' });
    // 20000x50 = 1,000,000px (well under 40MP) but width 20000 > 500px limit.
    const bomb = await pngWithClaimedDimensions(20_000, 50);
    const path = await writeFixture('wide-bomb.png', bomb);
    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({ status: 413 });
  });

  it('rejects a source whose channel count exceeds the configured limit', async () => {
    overrideMediaEnv({ MEDIA_MAX_CHANNELS: '2' });
    const rgb = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).jpeg().toBuffer();
    const path = await writeFixture('rgb.jpg', rgb);
    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({
      status: 413,
      code: 'image_too_large',
    });
  });

  it('rejects generated output that overflows the configured byte ceiling instead of silently shipping it', async () => {
    overrideMediaEnv({ MEDIA_MAX_DISPLAY_BYTES: '10' });
    const source = await sharp({ create: { width: 200, height: 200, channels: 3, background: 'purple' } }).jpeg().toBuffer();
    const path = await writeFixture('overflow.jpg', source);
    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({
      status: 422,
      code: 'image_too_complex',
    });
  });

  it('aborts processing that exceeds the configured deadline, and actually stops libvips work rather than merely abandoning the JS promise (reviewer-p3 C1)', async () => {
    overrideMediaEnv({
      MEDIA_PROCESSING_DEADLINE_MS: '1', // rounds up to sharp's 1-second minimum granularity
      MEDIA_SHARP_CONCURRENCY: '1',
      MEDIA_MAX_DECODED_MEGAPIXELS: '100',
      MEDIA_MAX_DIMENSION_PX: '10000',
    });
    // Large enough that the real (no-blur) display-encode step alone takes more
    // than the 1-second timeout, so a pass here can only mean sharp's own
    // `.timeout()` genuinely aborted the work (see `slowToProcessNoisyPng`'s
    // comment for why this has to be a PNG, not a JPEG).
    const heavy = await slowToProcessNoisyPng(6500);
    const path = await writeFixture('heavy.png', heavy);

    await expect(processProductUpload({ sourcePath: path })).rejects.toMatchObject({
      status: 408,
      code: 'processing_timeout',
    });

    // Give libvips a brief moment to fully unwind the aborted thread, then prove
    // nothing is still consuming a worker — this is exactly what shipped broken
    // before: the promise rejected but `sharp.counters().process` stayed nonzero
    // because the `.clone()`d encode pipelines kept running unseen.
    await sleep(300);
    expect(sharp.counters().process).toBe(0);
    expect(sharp.counters().queue).toBe(0);
  }, 20_000);
});

describe('processProductUpload — concurrency bound', () => {
  it('never lets more decodes run concurrently than MEDIA_SHARP_CONCURRENCY, sampled via sharp.counters() while genuinely-slow decodes overlap', async () => {
    overrideMediaEnv({ MEDIA_SHARP_CONCURRENCY: '2' });
    const paths = await Promise.all(
      Array.from({ length: 4 }, async (_, i) => writeFixture(`concurrent-${i}.jpg`, await noisyJpeg(3000))),
    );

    let peakProcessing = 0;
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        peakProcessing = Math.max(peakProcessing, sharp.counters().process);
        await sleep(10);
      }
    })();

    const results = await Promise.all(paths.map((p) => processProductUpload({ sourcePath: p })));
    sampling = false;
    await sampler;

    expect(results).toHaveLength(4);
    for (const r of results) expect(r.display.buffer.length).toBeGreaterThan(0);
    // Each in-flight call does at most one resize/encode at a time (display then
    // thumb, sequentially), so with the semaphore capped at 2 concurrent calls the
    // real libvips task count must never exceed 2 either — this is what C1's bug
    // (permit-count drift + uncancelled work) would have broken.
    expect(peakProcessing).toBeGreaterThan(0);
    expect(peakProcessing).toBeLessThanOrEqual(2);
  }, 15_000);

  it('handles many concurrent decodes above the configured limit without dropping any', async () => {
    overrideMediaEnv({ MEDIA_SHARP_CONCURRENCY: '2' });
    const buf = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'magenta' } }).jpeg().toBuffer();
    const paths = await Promise.all(
      Array.from({ length: 10 }, (_, i) => writeFixture(`many-${i}.jpg`, buf)),
    );
    const results = await Promise.all(paths.map((p) => processProductUpload({ sourcePath: p })));
    expect(results).toHaveLength(10);
  });
});
