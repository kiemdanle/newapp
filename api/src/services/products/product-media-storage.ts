import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { AppError } from '../../errors.js';
import {
  cp,
  mkdir,
  open,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Storage keys are POSIX-style relative strings rooted at `config.media.root`
// (e.g. `private/products/<id>/<photoId>/<variantId>`). Every segment is either a
// fixed literal (`private`, `products`, `display.webp`) or a server-generated UUID —
// never a client-supplied path fragment — so containment can be enforced purely by
// validating each segment's shape before it ever touches the filesystem, in addition
// to the resolved-prefix check below (defense in depth).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGMENT_RE = /^[A-Za-z0-9_.-]+$/;

export type MediaVariant = 'display' | 'thumb';
export const MEDIA_VARIANTS: readonly MediaVariant[] = ['display', 'thumb'];

// Extends `AppError` (not a bare `Error`) so a path-containment violation that
// somehow reaches `toProblem` degrades to a typed 400, not a generic
// signal-free 500 — reviewer-p3 M9. Currently unreachable from any real request
// (busboy truncates before the independent byte counter fires, and every path
// segment is always either a fixed literal or a server-generated UUID), but a
// defensive class hierarchy should never rely on "currently unreachable" alone.
export class MediaPathError extends AppError {
  constructor(message: string) {
    super({ status: 400, code: 'invalid_media_path', title: message });
  }
}

/** Throws unless `value` is a UUID (v4 or otherwise well-formed UUID shape). */
export function assertUuidSegment(value: string, label: string): string {
  if (!UUID_RE.test(value)) {
    throw new MediaPathError(`${label} must be a UUID`);
  }
  return value;
}

function assertSafeSegment(segment: string): string {
  if (
    !segment ||
    segment === '.' ||
    segment === '..' ||
    segment.includes('/') ||
    segment.includes('\\') ||
    !SEGMENT_RE.test(segment)
  ) {
    throw new MediaPathError(`invalid media path segment: ${JSON.stringify(segment)}`);
  }
  return segment;
}

/**
 * Resolves `segments` under `root`, rejecting any result that would escape it.
 * Every segment is validated against a conservative charset first (no `.`/`..`/
 * separators), then the fully resolved path is asserted to still be inside the
 * resolved root — two independent layers so a single bug in either check alone
 * can't produce traversal.
 */
export function resolveMediaPath(root: string, ...segments: string[]): string {
  for (const segment of segments) assertSafeSegment(segment);
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, ...segments);
  if (candidate !== resolvedRoot && !candidate.startsWith(resolvedRoot + sep)) {
    throw new MediaPathError('media path escapes configured root');
  }
  return candidate;
}

/** Converts a stored relative key (e.g. `private/products/<id>/...`) to an absolute,
 * containment-checked filesystem path under `root`. */
export function mediaKeyToPath(root: string, key: string): string {
  const segments = key.split('/');
  return resolveMediaPath(root, ...segments);
}

export function newQuarantineRequestId(): string {
  return randomUUID();
}

export function quarantineDirKey(requestId: string): string {
  assertUuidSegment(requestId, 'requestId');
  return `quarantine/${requestId}`;
}

export function quarantineSourceKey(requestId: string): string {
  return `${quarantineDirKey(requestId)}/source`;
}

/** Directory prefix shared by a photo's display+thumb variant pair. Both files are
 * generated together and promoted (renamed) into place as a single unit so a photo's
 * two variants can never diverge mid-mutation — moving the whole directory in one
 * `rename()` call is atomic at the filesystem level. */
export function privateProductPhotoPrefix(productId: string, photoId: string, variantId: string): string {
  assertUuidSegment(productId, 'productId');
  assertUuidSegment(photoId, 'photoId');
  assertUuidSegment(variantId, 'variantId');
  return `private/products/${productId}/${photoId}/${variantId}`;
}

/** The photo-level directory one level above a specific variant prefix — a fresh
 * `photoId` is generated per upload attempt and never reused, so it's always safe to
 * remove this whole directory (not just the variant-uuid leaf) when an attempt is
 * compensated/rolled back, avoiding an empty leftover directory. */
export function privateProductPhotoDir(productId: string, photoId: string): string {
  assertUuidSegment(productId, 'productId');
  assertUuidSegment(photoId, 'photoId');
  return `private/products/${productId}/${photoId}`;
}

export function privateProductEditPhotoPrefix(editId: string, photoId: string, variantId: string): string {
  assertUuidSegment(editId, 'editId');
  assertUuidSegment(photoId, 'photoId');
  assertUuidSegment(variantId, 'variantId');
  return `private/product-edits/${editId}/${photoId}/${variantId}`;
}

export function publicProductPhotoPrefix(productId: string, publicationId: string): string {
  assertUuidSegment(productId, 'productId');
  assertUuidSegment(publicationId, 'publicationId');
  return `public/products/${productId}/${publicationId}`;
}

export function variantFileKey(prefix: string, variant: MediaVariant): string {
  return `${prefix}/${variant}.webp`;
}

/** Same-origin authenticated delivery route for a private product photo variant.
 * Parent-bound (`productId` in the path) so cross-product photo-ID substitution is
 * rejected by the route handler before any lookup happens, not merely by convention. */
export function privateProductPhotoRoute(productId: string, photoId: string, variant: MediaVariant): string {
  return `/v1/products/${productId}/photos/${photoId}/${variant}`;
}

export function privateProductEditPhotoRoute(editId: string, photoId: string, variant: MediaVariant): string {
  return `/v1/product-edits/${editId}/photos/${photoId}/${variant}`;
}

/** Absolute nginx-served CDN URL for an approved public photo variant. `publicStorageKey`
 * is the `public/...` prefix stored on the row (see `publicProductPhotoPrefix`); nginx
 * (Phase 7) aliases `publicBaseUrl` to `<MEDIA_ROOT>/public/`, so the `public/` segment
 * itself is stripped before appending to the base URL. */
export function publicMediaUrl(publicBaseUrl: string, publicStorageKeyPrefix: string, variant: MediaVariant): string {
  const withoutPublicPrefix = publicStorageKeyPrefix.startsWith('public/')
    ? publicStorageKeyPrefix.slice('public/'.length)
    : publicStorageKeyPrefix;
  return `${publicBaseUrl.replace(/\/+$/, '')}/${withoutPublicPrefix}/${variant}.webp`;
}

/**
 * Streams `source` into the quarantine tree with backpressure, enforcing `maxBytes`
 * by counting through-bytes independently of any upstream limit (defense in depth —
 * never trust a single layer to bound size). On any failure (stream error, byte
 * overflow) the partial file and its directory are removed before rethrowing; nothing
 * partial is ever left behind for a caller to accidentally treat as complete.
 */
export async function writeQuarantineFile(
  root: string,
  requestId: string,
  source: Readable,
  maxBytes: number,
): Promise<{ key: string; path: string; bytes: number }> {
  const key = quarantineSourceKey(requestId);
  const path = mediaKeyToPath(root, key);
  await mkdir(resolveMediaPath(root, ...quarantineDirKey(requestId).split('/')), { recursive: true });

  let bytes = 0;
  const handle = await open(path, 'wx');
  try {
    const writable = handle.createWriteStream();
    source.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        source.destroy(new MediaPathError('upload exceeds maximum allowed size'));
        writable.destroy(new MediaPathError('upload exceeds maximum allowed size'));
      }
    });
    await pipeline(source, writable);
  } catch (err) {
    await handle.close().catch(() => {});
    await removeKeyPrefix(root, quarantineDirKey(requestId)).catch(() => {});
    throw err;
  }
  await handle.close();
  return { key, path, bytes };
}

/** Recursively removes everything under `key` (a directory prefix) inside `root`.
 * Safe to call on a path that doesn't exist. Used for quarantine/temp cleanup and for
 * outbox-driven deletion of unreferenced private/public artifacts — never for
 * arbitrary caller-supplied paths (the key is always one of this module's own
 * builders or a value already validated against them). */
export async function removeKeyPrefix(root: string, key: string): Promise<void> {
  const path = mediaKeyToPath(root, key);
  await rm(path, { recursive: true, force: true });
}

/** Atomically promotes a fully-generated variant directory (both display+thumb
 * webp files already written under `fromKey`) into its final `toKey` location.
 * Creates `toKey`'s parent directories first; a bare `rename()` is atomic on the
 * same filesystem, which the quarantine and private/public trees always share
 * (all live under one configured `MEDIA_ROOT`). */
export async function promoteKeyPrefix(root: string, fromKey: string, toKey: string): Promise<void> {
  const fromPath = mediaKeyToPath(root, fromKey);
  const toPath = mediaKeyToPath(root, toKey);
  await mkdir(resolve(toPath, '..'), { recursive: true });
  await rename(fromPath, toPath);
}

/** Copies (never moves) a variant directory from `fromKey` to `toKey`, so the
 * source stays intact for the caller to clean up only after its own reference
 * transaction commits ("old/private paths are cleaned only post-commit"). Refuses
 * to overwrite an existing target — public keys are immutable by construction
 * (always a fresh publication UUID), so a collision here means a caller bug, not a
 * legitimate re-publish. */
export async function copyKeyPrefix(root: string, fromKey: string, toKey: string): Promise<void> {
  const fromPath = mediaKeyToPath(root, fromKey);
  const toPath = mediaKeyToPath(root, toKey);
  if (await keyPrefixExists(root, toKey)) {
    throw new MediaPathError(`refusing to overwrite existing media key: ${toKey}`);
  }
  await mkdir(resolve(toPath, '..'), { recursive: true });
  await cp(fromPath, toPath, { recursive: true, errorOnExist: true });
}

/** True if a key prefix (directory) exists on disk. Used by prepared-intent recovery
 * to distinguish "bytes were written, only the reference commit is missing" from
 * "nothing was ever written" without assuming either outcome. */
export async function keyPrefixExists(root: string, key: string): Promise<boolean> {
  try {
    await stat(mediaKeyToPath(root, key));
    return true;
  } catch {
    return false;
  }
}
