import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { useSessionStore } from '../auth/session-store';
import { secureStore } from '../auth/secure-store';
import { apiUrl, refreshTokensOnce } from './client';

export type PrivateMediaVariant = 'display' | 'thumb';

export type PrivateMediaTarget =
  | { kind: 'draft'; productId: string }
  | { kind: 'product_edit'; editId: string };

// In-memory only, per-process — deliberately not backed by any persistent
// file/disk cache. Handing the native <Image> component a `data:` URI (see
// below) rather than the real authenticated https:// URL means RN's own
// native image loader never sees a URL to key its shared network cache by,
// so "disable shared native URL caching" falls out of the approach rather
// than needing a special prop. Keyed by user ID first so a purge is a single
// Map.clear() and two different accounts can never read each other's entry.
interface CacheEntry {
  promise: Promise<string>;
}
const cache = new Map<string, CacheEntry>();

function parentKey(target: PrivateMediaTarget): string {
  return target.kind === 'draft' ? `draft:${target.productId}` : `edit:${target.editId}`;
}

function cacheKey(userId: string, target: PrivateMediaTarget, photoId: string, variant: PrivateMediaVariant): string {
  return `${userId}::${parentKey(target)}::${photoId}::${variant}`;
}

function pathFor(target: PrivateMediaTarget, photoId: string, variant: PrivateMediaVariant): string {
  const base = target.kind === 'draft' ? `/products/${target.productId}` : `/product-edits/${target.editId}`;
  return `${base}/photos/${photoId}/${variant}`;
}

/** Clears every cached private-image entry. Call on logout and on sign-in
 * (covers a user switch without an intervening explicit sign-out) — wired in
 * `session-store.ts`'s `signOut`/`signIn`. Also called internally on a
 * 401/403 from the private-media route itself, since either means whatever
 * was cached for that key is no longer a valid authorization boundary. */
export function purgePrivateImageCache(): void {
  cache.clear();
}

/** Removes only the entries for one draft/edit target — for the narrower
 * case of a terminal or public-transition state change (the target itself
 * still exists, but its private copies are no longer the source of truth),
 * where wiping every other in-flight private image would be unnecessarily
 * disruptive. */
export function purgePrivateImageCacheForTarget(target: PrivateMediaTarget): void {
  const key = parentKey(target);
  for (const cached of cache.keys()) {
    if (cached.includes(`::${key}::`)) cache.delete(cached);
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Deliberately not `Blob`/`FileReader` (React Native's Blob support is
// native-module-backed, an extra compile/link surface with no benefit here)
// nor Node's `Buffer` (not a guaranteed RN global). A small dependency-free
// encoder over the raw response bytes keeps this file's only external
// dependency the standard `fetch`/ArrayBuffer APIs already used everywhere
// else in the API layer.
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

async function fetchAsDataUri(url: string, retrying = false): Promise<string> {
  const access = await secureStore.getAccessToken();
  const res = await fetch(url, { headers: access ? { Authorization: `Bearer ${access}` } : {} });

  if (res.status === 401 && !retrying) {
    const refreshed = await refreshTokensOnce();
    if (refreshed) return fetchAsDataUri(url, true);
  }
  if (res.status === 401 || res.status === 403) {
    purgePrivateImageCache();
    throw new Error(`private image request failed with ${res.status}`);
  }
  if (!res.ok) throw new Error(`private image request failed with ${res.status}`);

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const buffer = await res.arrayBuffer();
  const base64 = bytesToBase64(new Uint8Array(buffer));
  return `data:${contentType};base64,${base64}`;
}

interface DataUriState {
  uri: string | null;
  error: Error | null;
}

function useAuthorizedDataUri(
  target: PrivateMediaTarget,
  photoId: string,
  variant: PrivateMediaVariant,
): DataUriState {
  const userId = useSessionStore((s) => s.user?.id);
  const [state, setState] = useState<DataUriState>({ uri: null, error: null });
  const parent = parentKey(target);

  useEffect(() => {
    if (!userId) {
      setState({ uri: null, error: null });
      return;
    }
    let cancelled = false;
    const key = cacheKey(userId, target, photoId, variant);
    let entry = cache.get(key);
    if (!entry) {
      const promise = fetchAsDataUri(apiUrl(pathFor(target, photoId, variant)));
      entry = { promise };
      cache.set(key, entry);
      // A failed fetch must not permanently poison the cache — the next
      // mount/retry should issue a fresh request, not replay the rejection.
      promise.catch(() => cache.delete(key));
    }
    entry.promise.then(
      (uri) => {
        if (!cancelled) setState({ uri, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setState({ uri: null, error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, parent, photoId, variant]);

  return state;
}

export interface PrivateProductImageProps extends Omit<ImageProps, 'source'> {
  target: PrivateMediaTarget;
  photoId: string;
  variant: PrivateMediaVariant;
}

/** Renders a privately-authorized product/edit photo. Never passes the
 * bearer token in a URL — bytes are fetched once with an Authorization
 * header and handed to <Image> as a `data:` URI. */
export function PrivateProductImage({ target, photoId, variant, ...imageProps }: PrivateProductImageProps) {
  const { uri } = useAuthorizedDataUri(target, photoId, variant);
  if (!uri) return null;
  return <Image {...imageProps} source={{ uri }} accessibilityIgnoresInvertColors />;
}
