import { apiUrl, getBaseUrl, refreshTokensOnce } from '../api/client';
import { secureStore } from '../auth/secure-store';
import {
  computeCacheKey,
  isPrivateUrl,
  type CacheMetadata,
  type CacheOptions,
} from './image-cache-types';
import { imageDiskCache } from './image-disk-cache';

export class AuthorizationError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out +=
      b1 === undefined
        ? '='
        : BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

export function resolveTargetUrl(options: CacheOptions): string | null {
  if (options.target && options.photoId) {
    const base =
      options.target.kind === 'draft'
        ? `/products/${options.target.productId}`
        : `/product-edits/${options.target.editId}`;
    const variant = options.variant || 'thumb';
    return apiUrl(`${base}/photos/${options.photoId}/${variant}`);
  }

  if (options.uri && typeof options.uri === 'string') {
    const trimmed = options.uri.trim();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('file://') ||
      trimmed.startsWith('ph://') ||
      trimmed.startsWith('content://')
    ) {
      return trimmed;
    }
    if (trimmed.startsWith('/v1/') || trimmed.startsWith('/public-media/')) {
      return `${getBaseUrl()}${trimmed}`;
    }
    if (trimmed.startsWith('/')) {
      return `file://${trimmed}`;
    }
    return trimmed;
  }

  return null;
}

// In-flight Promise deduplication map: guarantees that concurrent requests for
// the exact same image share a single network Promise.
const inFlightRequests = new Map<string, Promise<CacheMetadata | null>>();

// User session generation/epoch tracker: increments on logout so any in-flight
// network responses that resolve after sign-out are immediately discarded.
const userSessionEpochs = new Map<string, number>();
const targetEpochs = new Map<string, number>();

export function invalidateUserSession(userId: string): void {
  const current = userSessionEpochs.get(userId) ?? 0;
  userSessionEpochs.set(userId, current + 1);
  clearInFlightRequestsForUser(userId);
}

export function invalidateTarget(targetSubstr: string): void {
  const current = targetEpochs.get(targetSubstr) ?? 0;
  targetEpochs.set(targetSubstr, current + 1);
  clearInFlightRequestsForTarget(targetSubstr);
}

export function clearInFlightRequestsForUser(userId: string): void {
  const prefix = `private::${userId}::`;
  for (const key of inFlightRequests.keys()) {
    if (key.startsWith(prefix) || key.includes(`::${userId}::`)) {
      inFlightRequests.delete(key);
    }
  }
}

export function clearInFlightRequestsForTarget(targetSubstr: string): void {
  for (const key of inFlightRequests.keys()) {
    if (
      key.includes(`::${targetSubstr}::`) ||
      key.includes(`/${targetSubstr}/`)
    ) {
      inFlightRequests.delete(key);
    }
  }
}

export function clearAllInFlightRequests(): void {
  inFlightRequests.clear();
}

export async function fetchAndCacheImage(
  options: CacheOptions,
  currentUserId?: string | null,
  cachedEntry?: CacheMetadata | null,
): Promise<CacheMetadata | null> {
  const key = computeCacheKey(options, currentUserId);
  if (!key) return null;

  // In-flight deduplication check
  const activePromise = inFlightRequests.get(key);
  if (activePromise) {
    return activePromise;
  }

  const url = resolveTargetUrl(options);
  if (!url) return null;

  // If already a local file or data URI, cache directly
  if (url.startsWith('file://') || (url.startsWith('data:') && !options.target)) {
    const meta: CacheMetadata = {
      key,
      uri: url,
      localUri: url,
      etag: null,
      lastModified: null,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      byteSize: url.length,
      isPrivate: Boolean(options.isPrivate || options.target),
      userId: options.userId || currentUserId || null,
    };
    await imageDiskCache.set(key, meta);
    return meta;
  }

  const isPrivate =
    Boolean(options.isPrivate) ||
    Boolean(options.target) ||
    isPrivateUrl(url);

  const targetUserId = options.userId || currentUserId || null;
  const startEpoch = targetUserId ? userSessionEpochs.get(targetUserId) ?? 0 : 0;

  const targetSubstr = options.target
    ? options.target.kind === 'draft'
      ? `draft:${options.target.productId}`
      : `edit:${options.target.editId}`
    : null;
  const startTargetEpoch = targetSubstr
    ? targetEpochs.get(targetSubstr) ?? 0
    : 0;

  let inFlightInstance: Promise<CacheMetadata | null>;

  const promise = (async () => {
    let retriedAuth = false;

    const executeFetch = async (allowRetry = true): Promise<Response> => {
      const headers: Record<string, string> = { ...(options.headers ?? {}) };

      if (cachedEntry?.etag) {
        headers['If-None-Match'] = cachedEntry.etag;
      }
      if (cachedEntry?.lastModified) {
        headers['If-Modified-Since'] = cachedEntry.lastModified;
      }

      // Attach Authorization bearer only for Expyrico endpoints
      if (isPrivate) {
        const access = await secureStore.getAccessToken();
        if (access) {
          headers.Authorization = `Bearer ${access}`;
        }
      }

      const res = await fetch(url, { headers });

      if (res.status === 401 && isPrivate && allowRetry && !retriedAuth) {
        retriedAuth = true;
        const refreshed = await refreshTokensOnce();
        if (refreshed) {
          return executeFetch(false);
        }
      }

      return res;
    };

    try {
      const res = await executeFetch();

      // Check if user signed out / session invalidated while fetch was in-flight
      if (targetUserId && isPrivate) {
        const currentEpoch = userSessionEpochs.get(targetUserId) ?? 0;
        if (currentEpoch !== startEpoch) {
          return null;
        }
      }

      if (targetSubstr) {
        const currentTargetEpoch = targetEpochs.get(targetSubstr) ?? 0;
        if (currentTargetEpoch !== startTargetEpoch) {
          return null;
        }
      }

      // 304 Not Modified — server image unchanged! 0 payload bytes transferred
      if (res.status === 304 && cachedEntry) {
        if (targetUserId && isPrivate) {
          const currentEpoch = userSessionEpochs.get(targetUserId) ?? 0;
          if (currentEpoch !== startEpoch) {
            void imageDiskCache.remove(key);
            return null;
          }
        }

        if (targetSubstr) {
          const currentTargetEpoch = targetEpochs.get(targetSubstr) ?? 0;
          if (currentTargetEpoch !== startTargetEpoch) {
            void imageDiskCache.remove(key);
            return null;
          }
        }

        const newEtag = res.headers.get('etag') ?? cachedEntry.etag;
        const newLastModified =
          res.headers.get('last-modified') ?? cachedEntry.lastModified;
        const updatedTimestamp = Date.now();

        await imageDiskCache.updateMetadata(key, {
          etag: newEtag,
          lastModified: newLastModified,
          timestamp: updatedTimestamp,
        });

        if (targetUserId && isPrivate) {
          const currentEpoch = userSessionEpochs.get(targetUserId) ?? 0;
          if (currentEpoch !== startEpoch) {
            void imageDiskCache.remove(key);
            return null;
          }
        }

        if (targetSubstr) {
          const currentTargetEpoch = targetEpochs.get(targetSubstr) ?? 0;
          if (currentTargetEpoch !== startTargetEpoch) {
            void imageDiskCache.remove(key);
            return null;
          }
        }

        return {
          ...cachedEntry,
          etag: newEtag,
          lastModified: newLastModified,
          timestamp: updatedTimestamp,
          lastAccessed: Date.now(),
        };
      }

      // 401/403 Authorization Revoked
      if (res.status === 401 || res.status === 403) {
        await imageDiskCache.remove(key);
        if (isPrivate && targetUserId) {
          invalidateUserSession(targetUserId);
          void imageDiskCache.purgeUserPrivate(targetUserId);
        }
        throw new AuthorizationError(
          res.status,
          `Private image authorization failed with status ${res.status}`,
        );
      }

      if (!res.ok) {
        throw new Error(`Image fetch failed with status ${res.status}`);
      }

      const contentType =
        res.headers.get('content-type') ?? 'image/jpeg';
      const etag = res.headers.get('etag');
      const lastModified = res.headers.get('last-modified');
      const buffer = await res.arrayBuffer();

      // Check session epoch and target epoch again before writing to storage
      if (targetUserId && isPrivate) {
        const currentEpoch = userSessionEpochs.get(targetUserId) ?? 0;
        if (currentEpoch !== startEpoch) {
          return null;
        }
      }

      if (targetSubstr) {
        const currentTargetEpoch = targetEpochs.get(targetSubstr) ?? 0;
        if (currentTargetEpoch !== startTargetEpoch) {
          return null;
        }
      }

      const base64 = bytesToBase64(new Uint8Array(buffer));
      const localUri = `data:${contentType};base64,${base64}`;

      const newMeta = await imageDiskCache.set(key, {
        uri: url,
        localUri,
        etag,
        lastModified,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        byteSize: localUri.length,
        isPrivate,
        userId: targetUserId,
        contentType,
      });

      if (!newMeta) {
        return null;
      }

      // Final verification that session epoch did not change during async storage persist
      if (targetUserId && isPrivate) {
        const currentEpoch = userSessionEpochs.get(targetUserId) ?? 0;
        if (currentEpoch !== startEpoch) {
          void imageDiskCache.remove(key);
          return null;
        }
      }

      if (targetSubstr) {
        const currentTargetEpoch = targetEpochs.get(targetSubstr) ?? 0;
        if (currentTargetEpoch !== startTargetEpoch) {
          void imageDiskCache.remove(key);
          return null;
        }
      }

      return newMeta;
    } catch (err) {
      if (err instanceof AuthorizationError) {
        // Never fallback to stale cached media on authorization revocation
        throw err;
      }
      if (cachedEntry) {
        // Silent fallback: offline / network failure retains cached image
        return cachedEntry;
      }
      throw err;
    }
  })().finally(() => {
    // Only delete this entry if this promise is still the active one (prevents race with newer requests)
    if (inFlightRequests.get(key) === inFlightInstance) {
      inFlightRequests.delete(key);
    }
  });

  inFlightInstance = promise;
  inFlightRequests.set(key, promise);
  return promise;
}

export function getInFlightRequestCount(): number {
  return inFlightRequests.size;
}
