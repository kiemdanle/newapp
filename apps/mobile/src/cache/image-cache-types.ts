import { getBaseUrl } from '../api/client';

export type PrivateMediaVariant = 'display' | 'thumb';

export type PrivateMediaTarget =
  | { kind: 'draft'; productId: string }
  | { kind: 'product_edit'; editId: string };

export interface CacheMetadata {
  key: string;
  uri: string;
  localUri: string;
  etag?: string | null;
  lastModified?: string | null;
  timestamp: number;
  lastAccessed?: number;
  byteSize: number;
  isPrivate: boolean;
  userId?: string | null;
  contentType?: string;
}

export interface CacheOptions {
  uri?: string | null;
  target?: PrivateMediaTarget;
  photoId?: string;
  variant?: PrivateMediaVariant;
  headers?: Record<string, string>;
  freshTtlMs?: number;
  isPrivate?: boolean;
  userId?: string | null;
}

export const DEFAULT_PUBLIC_FRESH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_PRIVATE_FRESH_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_CACHE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export function isPrivateUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  if (trimmed.startsWith('/')) {
    return (
      ((trimmed.startsWith('/products/') ||
        trimmed.startsWith('/v1/products/') ||
        trimmed.startsWith('/product-edits/') ||
        trimmed.startsWith('/v1/product-edits/')) &&
        trimmed.includes('/photos/')) ||
      trimmed.startsWith('/feedback/attachments/') ||
      trimmed.startsWith('/v1/feedback/attachments/')
    );
  }

  try {
    const parsed = new URL(trimmed);
    const baseUrl = getBaseUrl();
    let baseOrigin = 'https://api.linhkienkts.com';
    try {
      baseOrigin = new URL(baseUrl).origin;
    } catch {
      // Fallback
    }

    const isLocalDevHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '10.0.2.2';

    // Must match configured baseOrigin or be a local development host
    const isTrustedOrigin =
      parsed.origin === baseOrigin ||
      (isLocalDevHost && (parsed.protocol === 'http:' || parsed.protocol === 'https:'));
    if (!isTrustedOrigin) return false;

    // Production remote endpoints MUST use https:
    if (!isLocalDevHost && parsed.protocol !== 'https:') return false;

    return (
      ((parsed.pathname.includes('/products/') &&
        parsed.pathname.includes('/photos/')) ||
      (parsed.pathname.includes('/product-edits/') &&
        parsed.pathname.includes('/photos/')) ||
      parsed.pathname.includes('/feedback/attachments/'))
    );
  } catch {
    return false;
  }
}

/**
 * 64-bit double-hashed key generator providing high-speed collision-safe key bounds.
 */
export function simpleHash(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x5b79a2e3;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x000001b3);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function hashKeyIfLong(prefix: string, body: string): string {
  if (body.length <= 96) {
    return `${prefix}::${body}`;
  }
  return `${prefix}::${body.slice(0, 56)}_${simpleHash(body)}`;
}

export function computeCacheKey(
  options: CacheOptions,
  currentUserId?: string | null,
): string | null {
  if (options.target && options.photoId) {
    const uid = options.userId || currentUserId;
    if (!uid) return null; // Private targets strictly require a verified user identity

    const targetKey =
      options.target.kind === 'draft'
        ? `draft:${options.target.productId}`
        : `edit:${options.target.editId}`;
    const variant = options.variant || 'thumb';
    const body = `${targetKey}::${options.photoId}::${variant}`;
    return hashKeyIfLong(`private::${uid}`, body);
  }

  if (options.uri && typeof options.uri === 'string') {
    const trimmed = options.uri.trim();
    if (!trimmed) return null;
    if (options.isPrivate || isPrivateUrl(trimmed)) {
      const uid = options.userId || currentUserId;
      if (!uid) return null; // Private URLs strictly require a verified user identity
      return hashKeyIfLong(`private::${uid}`, trimmed);
    }
    return hashKeyIfLong('public', trimmed);
  }

  return null;
}
