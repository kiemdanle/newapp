import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MediaPathError,
  assertUuidSegment,
  keyPrefixExists,
  mediaKeyToPath,
  privateProductEditPhotoPrefix,
  privateProductEditPhotoRoute,
  privateProductPhotoPrefix,
  privateProductPhotoRoute,
  promoteKeyPrefix,
  publicMediaUrl,
  publicProductPhotoPrefix,
  quarantineDirKey,
  quarantineSourceKey,
  removeKeyPrefix,
  resolveMediaPath,
  variantFileKey,
  writeQuarantineFile,
} from './product-media-storage.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'media-storage-test-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('assertUuidSegment', () => {
  it('accepts a well-formed UUID', () => {
    const id = randomUUID();
    expect(assertUuidSegment(id, 'x')).toBe(id);
  });

  it('rejects a non-UUID string', () => {
    expect(() => assertUuidSegment('not-a-uuid', 'x')).toThrow(MediaPathError);
  });
});

describe('resolveMediaPath / mediaKeyToPath containment', () => {
  it('resolves a well-formed key under root', () => {
    const id = randomUUID();
    const p = resolveMediaPath(root, 'private', 'products', id);
    expect(p.startsWith(root)).toBe(true);
  });

  it('rejects a segment containing ".."', () => {
    expect(() => resolveMediaPath(root, '..', 'etc', 'passwd')).toThrow(MediaPathError);
  });

  it('rejects a segment containing a path separator', () => {
    expect(() => resolveMediaPath(root, 'private/../../etc')).toThrow(MediaPathError);
    expect(() => resolveMediaPath(root, 'a\\b')).toThrow(MediaPathError);
  });

  it('rejects an empty segment', () => {
    expect(() => resolveMediaPath(root, '')).toThrow(MediaPathError);
  });

  it('mediaKeyToPath rejects a key that resolves outside root even when split on slashes', () => {
    expect(() => mediaKeyToPath(root, '../outside')).toThrow(MediaPathError);
  });
});

describe('key/route/URL builders', () => {
  it('builds a private product photo prefix and variant keys from UUID parts', () => {
    const productId = randomUUID();
    const photoId = randomUUID();
    const variantId = randomUUID();
    const prefix = privateProductPhotoPrefix(productId, photoId, variantId);
    expect(prefix).toBe(`private/products/${productId}/${photoId}/${variantId}`);
    expect(variantFileKey(prefix, 'display')).toBe(`${prefix}/display.webp`);
    expect(variantFileKey(prefix, 'thumb')).toBe(`${prefix}/thumb.webp`);
  });

  it('rejects a non-UUID product/photo/variant id in prefix builders', () => {
    const ok = randomUUID();
    expect(() => privateProductPhotoPrefix('not-a-uuid', ok, ok)).toThrow(MediaPathError);
    expect(() => privateProductPhotoPrefix(ok, 'not-a-uuid', ok)).toThrow(MediaPathError);
    expect(() => privateProductPhotoPrefix(ok, ok, 'not-a-uuid')).toThrow(MediaPathError);
  });

  it('builds a private product-edit photo prefix under a distinct namespace', () => {
    const editId = randomUUID();
    const photoId = randomUUID();
    const variantId = randomUUID();
    expect(privateProductEditPhotoPrefix(editId, photoId, variantId)).toBe(
      `private/product-edits/${editId}/${photoId}/${variantId}`,
    );
  });

  it('builds a public product photo prefix', () => {
    const productId = randomUUID();
    const publicationId = randomUUID();
    expect(publicProductPhotoPrefix(productId, publicationId)).toBe(
      `public/products/${productId}/${publicationId}`,
    );
  });

  it('builds parent-bound private delivery routes', () => {
    const productId = randomUUID();
    const photoId = randomUUID();
    expect(privateProductPhotoRoute(productId, photoId, 'thumb')).toBe(
      `/v1/products/${productId}/photos/${photoId}/thumb`,
    );
    const editId = randomUUID();
    expect(privateProductEditPhotoRoute(editId, photoId, 'display')).toBe(
      `/v1/product-edits/${editId}/photos/${photoId}/display`,
    );
  });

  it('derives a public CDN URL, stripping the leading public/ segment', () => {
    const productId = randomUUID();
    const publicationId = randomUUID();
    const prefix = publicProductPhotoPrefix(productId, publicationId);
    const url = publicMediaUrl('https://media.example.com', prefix, 'display');
    expect(url).toBe(`https://media.example.com/products/${productId}/${publicationId}/display.webp`);
  });

  it('normalizes a trailing slash on the base URL', () => {
    const prefix = publicProductPhotoPrefix(randomUUID(), randomUUID());
    const url = publicMediaUrl('https://media.example.com/', prefix, 'thumb');
    expect(url.startsWith('https://media.example.com/products/')).toBe(true);
    expect(url).not.toContain('.com//');
  });
});

describe('writeQuarantineFile', () => {
  it('streams a source into quarantine and reports the byte count', async () => {
    const requestId = randomUUID();
    const body = Buffer.from('a'.repeat(1000));
    const { path, bytes, key } = await writeQuarantineFile(root, requestId, Readable.from(body), 10_000);
    expect(bytes).toBe(1000);
    expect(key).toBe(`quarantine/${requestId}/source`);
    const written = await stat(path);
    expect(written.size).toBe(1000);
  });

  it('aborts and removes partial bytes once the byte limit is exceeded', async () => {
    const requestId = randomUUID();
    // Chunked source so we exceed the limit mid-stream rather than in one chunk.
    async function* chunks() {
      for (let i = 0; i < 20; i++) yield Buffer.from('x'.repeat(1000));
    }
    await expect(
      writeQuarantineFile(root, requestId, Readable.from(chunks()), 5_000),
    ).rejects.toThrow(MediaPathError);
    const exists = await keyPrefixExists(root, quarantineDirKey(requestId));
    expect(exists).toBe(false);
  });

  it('removes the partial file when the source stream errors mid-write', async () => {
    const requestId = randomUUID();
    let pushed = false;
    const source = new Readable({
      read() {
        if (pushed) return;
        pushed = true;
        this.push(Buffer.from('partial'));
        process.nextTick(() => this.destroy(new Error('boom')));
      },
    });
    await expect(writeQuarantineFile(root, requestId, source, 10_000)).rejects.toThrow('boom');
    const exists = await keyPrefixExists(root, quarantineDirKey(requestId));
    expect(exists).toBe(false);
  });
});

describe('promoteKeyPrefix / removeKeyPrefix / keyPrefixExists', () => {
  it('atomically renames a directory from one key to another, creating parents', async () => {
    const requestId = randomUUID();
    await writeQuarantineFile(root, requestId, Readable.from(Buffer.from('hi')), 1000);
    const productId = randomUUID();
    const photoId = randomUUID();
    const variantId = randomUUID();
    const toPrefix = privateProductPhotoPrefix(productId, photoId, variantId);
    await promoteKeyPrefix(root, quarantineDirKey(requestId), toPrefix);
    expect(await keyPrefixExists(root, quarantineDirKey(requestId))).toBe(false);
    expect(await keyPrefixExists(root, toPrefix)).toBe(true);
    const files = await readdir(mediaKeyToPath(root, toPrefix));
    expect(files).toContain('source');
  });

  it('removeKeyPrefix is a no-op on a missing path', async () => {
    await expect(removeKeyPrefix(root, `private/products/${randomUUID()}`)).resolves.toBeUndefined();
  });

  it('removeKeyPrefix deletes an existing tree recursively', async () => {
    const requestId = randomUUID();
    await writeQuarantineFile(root, requestId, Readable.from(Buffer.from('hi')), 1000);
    await removeKeyPrefix(root, quarantineDirKey(requestId));
    expect(await keyPrefixExists(root, quarantineDirKey(requestId))).toBe(false);
  });
});

describe('quarantine key helpers', () => {
  it('quarantineSourceKey nests under quarantineDirKey', () => {
    const id = randomUUID();
    expect(quarantineSourceKey(id)).toBe(`${quarantineDirKey(id)}/source`);
  });
});
