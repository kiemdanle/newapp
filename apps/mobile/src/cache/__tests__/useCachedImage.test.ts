import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { __reset } from '../../../tests/mocks/react-native-keychain';
import { queueFetch } from '../../../tests/mocks/fetch';
import { secureStore } from '../../auth/secure-store';
import { useSessionStore } from '../../auth/session-store';
import { imageDiskCache } from '../image-disk-cache';
import { bytesToBase64, fetchAndCacheImage } from '../image-revalidator';
import { useCachedImage } from '../useCachedImage';

const USER_A = { id: 'user-a', email: 'a@example.com' } as const;
const USER_B = { id: 'user-b', email: 'b@example.com' } as const;

function mockImageResponse(
  body = 'mock-image-bytes',
  options: { status?: number; etag?: string; lastModified?: string; contentType?: string } = {},
): Response {
  const headers = new Headers();
  headers.set('content-type', options.contentType ?? 'image/webp');
  if (options.etag) headers.set('etag', options.etag);
  if (options.lastModified) headers.set('last-modified', options.lastModified);

  return new Response(body, {
    status: options.status ?? 200,
    headers,
  });
}

describe('useCachedImage & RevalidationEngine (SWR)', () => {
  beforeEach(async () => {
    __reset();
    await imageDiskCache.purgeAll();
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: true,
      pendingAuth: null,
    });
  });

  it('bytesToBase64 correctly encodes binary buffers without native module dependencies', () => {
    const raw = new TextEncoder().encode('Hello Expyrico Image Cache');
    const b64 = bytesToBase64(raw);
    expect(b64).toBe(Buffer.from('Hello Expyrico Image Cache').toString('base64'));
  });

  it('cold start: fetches image over network, stores in cache, and returns data URI', async () => {
    const fetchMock = queueFetch(
      mockImageResponse('sample-webp-bytes', { etag: '"etag-100"' }),
    );

    const { result } = renderHook(() =>
      useCachedImage('https://cdn.example.com/p1.webp'),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.uri).toMatch(/^data:image\/webp;base64,/);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify stored in disk cache
    const cached = await imageDiskCache.get('public::https://cdn.example.com/p1.webp');
    expect(cached).toBeTruthy();
    expect(cached?.etag).toBe('"etag-100"');
  });

  it('warm start: immediately returns cached image synchronously on Frame 0 (<0.01ms)', async () => {
    const uri = 'https://cdn.example.com/instant.webp';
    await imageDiskCache.set(`public::${uri}`, {
      uri,
      localUri: 'data:image/webp;base64,instant-bytes',
      etag: '"v1"',
      lastModified: null,
      timestamp: Date.now(), // fresh
      byteSize: 100,
      isPrivate: false,
    });

    const fetchMock = queueFetch();

    // Render hook
    const { result } = renderHook(() => useCachedImage(uri));

    // Instant synchronous Frame-0 return
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRevalidating).toBe(false);
    expect(result.current.uri).toBe('data:image/webp;base64,instant-bytes');

    // No network requests triggered for fresh cache
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('in-flight deduplication: multiple concurrent callers for the same URI trigger exactly 1 network fetch', async () => {
    const uri = 'https://cdn.example.com/shared.webp';
    const fetchMock = queueFetch(mockImageResponse('shared-bytes'));

    // Trigger 5 concurrent requests simultaneously
    const p1 = fetchAndCacheImage({ uri });
    const p2 = fetchAndCacheImage({ uri });
    const p3 = fetchAndCacheImage({ uri });
    const p4 = fetchAndCacheImage({ uri });
    const p5 = fetchAndCacheImage({ uri });

    const results = await Promise.all([p1, p2, p3, p4, p5]);

    // Exactly 1 network fetch fired
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // All 5 callers resolved with the exact same valid cached metadata
    for (const res of results) {
      expect(res?.localUri).toMatch(/^data:image\/webp;base64,/);
    }
  });

  it('SWR 304 Not Modified: sends If-None-Match, transfers 0 payload bytes, and refreshes timestamp', async () => {
    const uri = 'https://cdn.example.com/swr-304.webp';
    const staleTime = Date.now() - (30 * 60 * 60 * 1000); // 30 hours old (stale)

    await imageDiskCache.set(`public::${uri}`, {
      uri,
      localUri: 'data:image/webp;base64,existing-bytes',
      etag: '"etag-original"',
      lastModified: 'Sun, 24 Aug 2026 00:00:00 GMT',
      timestamp: staleTime,
      byteSize: 100,
      isPrivate: false,
    });

    const fetchMock = queueFetch(
      new Response(null, {
        status: 304,
        headers: {
          etag: '"etag-original"',
          'last-modified': 'Sun, 24 Aug 2026 00:00:00 GMT',
        },
      }),
    );

    const { result } = renderHook(() => useCachedImage(uri));

    // Renders existing cached image immediately
    expect(result.current.uri).toBe('data:image/webp;base64,existing-bytes');

    await waitFor(() => {
      expect(result.current.isRevalidating).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      'If-None-Match': '"etag-original"',
      'If-Modified-Since': 'Sun, 24 Aug 2026 00:00:00 GMT',
    });

    // Timestamp was refreshed in cache
    const updated = await imageDiskCache.get(`public::${uri}`);
    expect(updated?.timestamp).toBeGreaterThan(staleTime);
    expect(updated?.localUri).toBe('data:image/webp;base64,existing-bytes');
  });

  it('SWR 200 Replacement: replaces cache and smoothly updates rendered URI when server image is modified', async () => {
    const uri = 'https://cdn.example.com/swr-200.webp';
    const staleTime = Date.now() - (48 * 60 * 60 * 1000); // 48 hours old (stale)

    await imageDiskCache.set(`public::${uri}`, {
      uri,
      localUri: 'data:image/webp;base64,old-image-bytes',
      etag: '"old-etag"',
      lastModified: null,
      timestamp: staleTime,
      byteSize: 100,
      isPrivate: false,
    });

    queueFetch(
      mockImageResponse('brand-new-image-bytes', { etag: '"new-etag-200"' }),
    );

    const { result } = renderHook(() => useCachedImage(uri));

    // Initially shows stale image
    expect(result.current.uri).toBe('data:image/webp;base64,old-image-bytes');

    // Smoothly updates to new image after revalidation completes
    await waitFor(() => {
      expect(result.current.uri).toBe(
        `data:image/webp;base64,${bytesToBase64(new TextEncoder().encode('brand-new-image-bytes'))}`,
      );
    });

    const updated = await imageDiskCache.get(`public::${uri}`);
    expect(updated?.etag).toBe('"new-etag-200"');
  });

  it('offline / network error resilience: retains cached image seamlessly without throwing UI errors', async () => {
    const uri = 'https://cdn.example.com/offline.webp';
    const staleTime = Date.now() - (48 * 60 * 60 * 1000);

    await imageDiskCache.set(`public::${uri}`, {
      uri,
      localUri: 'data:image/webp;base64,offline-fallback',
      etag: '"offline-etag"',
      lastModified: null,
      timestamp: staleTime,
      byteSize: 100,
      isPrivate: false,
    });

    // Simulate network error / offline disconnection
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    const { result } = renderHook(() => useCachedImage(uri));

    // Renders cached image
    expect(result.current.uri).toBe('data:image/webp;base64,offline-fallback');

    await waitFor(() => {
      expect(result.current.isRevalidating).toBe(false);
    });

    // Error is gracefully suppressed and cached image remains displayed
    expect(result.current.error).toBeNull();
    expect(result.current.uri).toBe('data:image/webp;base64,offline-fallback');
  });

  it('multi-user privacy isolation: private drafts are isolated per user account', async () => {
    await secureStore.setAccessToken('token-a');
    useSessionStore.setState({ user: USER_A as never });

    const fetchMock = queueFetch(
      mockImageResponse('user-a-secret-draft'),
      mockImageResponse('user-b-secret-draft'),
    );

    // User A fetches draft image
    const resA = await fetchAndCacheImage(
      { target: { kind: 'draft', productId: 'p1' }, photoId: 'photo-1', variant: 'thumb' },
      'user-a',
    );
    expect(resA?.localUri).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // User A signs out
    await imageDiskCache.purgeUserPrivate('user-a');

    // User B signs in
    await secureStore.setAccessToken('token-b');
    useSessionStore.setState({ user: USER_B as never });

    // User B fetches same target ID -> triggers fresh authorized fetch, never reuses User A's cache
    const resB = await fetchAndCacheImage(
      { target: { kind: 'draft', productId: 'p1' }, photoId: 'photo-1', variant: 'thumb' },
      'user-b',
    );
    expect(resB?.localUri).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, initB] = fetchMock.mock.calls[1]!;
    expect((initB as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer token-b',
    });
  });

  it('authorization revocation on 401/403: clears cached private image and does not fall back to stale bytes', async () => {
    const target = { kind: 'draft' as const, productId: 'p1' };
    const key = 'private::user-a::draft:p1::photo-1::display';
    await secureStore.setAccessToken('expired-token');
    useSessionStore.setState({ user: USER_A as never });

    // Stale private image in cache
    await imageDiskCache.set(key, {
      uri: '/products/p1/photos/photo-1/display',
      localUri: 'data:image/webp;base64,revoked-secret',
      timestamp: Date.now() - 3600000,
      isPrivate: true,
      userId: 'user-a',
    });

    // Server returns 401 Unauthorized
    queueFetch(new Response(null, { status: 401 }));

    const { result } = renderHook(() =>
      useCachedImage({ target, photoId: 'photo-1', variant: 'display' }),
    );

    await waitFor(() => {
      expect(result.current.isRevalidating).toBe(false);
    });

    // Private image must be cleared and uri must be null, not stale bytes!
    expect(result.current.uri).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(await imageDiskCache.get(key)).toBeNull();
  });

  it('deferred in-flight fetch resolving after logout is discarded and does not repopulate private cache', async () => {
    const target = { kind: 'draft' as const, productId: 'p-deferred' };
    const key = 'private::user-a::draft:p-deferred::photo-1::thumb';
    await secureStore.setAccessToken('token-a');
    useSessionStore.setState({ user: USER_A as never });

    let resolveFetch!: (res: Response) => void;
    const deferredPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = jest.fn().mockImplementation(() => deferredPromise);

    // Start in-flight request for User A
    const fetchPromise = fetchAndCacheImage(
      { target, photoId: 'photo-1', variant: 'thumb' },
      'user-a',
    );

    // User A logs out while fetch is still in flight
    await useSessionStore.getState().signOut();

    // Resolve the deferred network response
    resolveFetch(mockImageResponse('post-logout-secret-data'));
    const result = await fetchPromise;

    // Result must be discarded (null)
    expect(result).toBeNull();

    // Cache must remain clean
    expect(await imageDiskCache.get(key)).toBeNull();
  });

  it('live target purge: mounted hook watching a target resets URI to null when purgeTarget is called', async () => {
    const target = { kind: 'draft' as const, productId: 'p-live' };
    const key = 'private::user-a::draft:p-live::photo-1::thumb';
    await secureStore.setAccessToken('token-a');
    useSessionStore.setState({ user: USER_A as never });

    // Seed cache
    await imageDiskCache.set(key, {
      uri: '/products/p-live/photos/photo-1/thumb',
      localUri: 'data:image/webp;base64,live-data',
      timestamp: Date.now(),
      isPrivate: true,
      userId: 'user-a',
    });

    const { result } = renderHook(() =>
      useCachedImage({ target, photoId: 'photo-1', variant: 'thumb' }),
    );

    expect(result.current.uri).toBe('data:image/webp;base64,live-data');

    // Purge the target while hook is still mounted
    await imageDiskCache.purgeTarget('draft:p-live');

    // Hook must immediately clear uri
    await waitFor(() => {
      expect(result.current.uri).toBeNull();
    });
  });
});
