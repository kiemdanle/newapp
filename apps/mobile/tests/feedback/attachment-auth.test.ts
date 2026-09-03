import { describe, expect, it, jest } from '@jest/globals';
import { isPrivateUrl } from '../../src/cache/image-cache-types';
import { apiUrl } from '../../src/api/client';
import { secureStore } from '../../src/auth/secure-store';
import { fetchAndCacheImage } from '../../src/cache/image-revalidator';

describe('Feedback Attachment Auth Verification', () => {
  it('correctly identifies feedback attachment URLs as private', () => {
    // Relative paths
    expect(isPrivateUrl('/feedback/attachments/00000000-0000-0000-0000-000000000001')).toBe(true);
    expect(isPrivateUrl('/v1/feedback/attachments/00000000-0000-0000-0000-000000000001')).toBe(true);

    // Configured API origin
    expect(
      isPrivateUrl(apiUrl('/feedback/attachments/00000000-0000-0000-0000-000000000001')),
    ).toBe(true);

    // Local dev origins
    expect(
      isPrivateUrl('http://localhost:4000/v1/feedback/attachments/00000000-0000-0000-0000-000000000001'),
    ).toBe(true);
    expect(
      isPrivateUrl('http://10.0.2.2:4000/v1/feedback/attachments/00000000-0000-0000-0000-000000000001'),
    ).toBe(true);
  });

  it('rejects public URLs from private classification', () => {
    expect(isPrivateUrl('https://example.com/photo.jpg')).toBe(false);
    expect(isPrivateUrl('/public-media/products/123/thumb.webp')).toBe(false);
  });

  it('attaches Bearer authorization token when fetching private attachment', async () => {
    const mockToken = 'test-bearer-token-auth-check';
    jest.spyOn(secureStore, 'getAccessToken').mockResolvedValue(mockToken);

    let capturedHeaders: Record<string, string> | undefined;
    const originalFetch = global.fetch;

    try {
      global.fetch = jest.fn(async (_url: any, init: any) => {
        capturedHeaders = init?.headers;
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: {
            'content-type': 'image/webp',
            etag: '"test-etag"',
          },
        });
      }) as any;

      await fetchAndCacheImage(
        {
          uri: apiUrl('/feedback/attachments/00000000-0000-0000-0000-000000000001'),
          isPrivate: true,
          userId: 'test-user-123',
        },
        'test-user-123',
      );
      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders?.Authorization).toBe(`Bearer ${mockToken}`);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
