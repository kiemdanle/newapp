import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { HttpMetaResult } from '../../lib/http.js';

const getJsonWithMetaMock = vi.fn();
vi.mock('../../lib/http.js', async () => {
  const actual = await vi.importActual('../../lib/http.js');
  return {
    ...actual,
    getJsonWithMeta: (...args: unknown[]) => getJsonWithMetaMock(...args),
  };
});

import { lookupOff, offBreaker } from './off-client.js';

function mockMeta<T>(data: T | null, status = 200): HttpMetaResult<T> {
  const rawTextPreview = JSON.stringify(data ?? {});
  return {
    data,
    status,
    headers: { 'content-type': 'application/json' },
    sizeBytes: rawTextPreview.length,
    rawTextPreview,
  };
}

describe('off-client', () => {
  beforeEach(() => {
    getJsonWithMetaMock.mockReset();
    offBreaker.close();
  });

  it('returns found when product is mapped', async () => {
    getJsonWithMetaMock.mockResolvedValueOnce(
      mockMeta({
        status: 1,
        product: {
          product_name: 'Organic Milk',
          brands: 'Organic Valley',
          categories_tags: ['en:dairy'],
          image_url: 'https://images.openfoodfacts.org/milk.jpg',
        },
      }),
    );

    const res = await lookupOff('5449000000996');
    expect(res.status).toBe('found');
    if (res.status === 'found') {
      expect(res.data.name).toBe('Organic Milk');
      expect(res.data.brand).toBe('Organic Valley');
    }
  });

  it('returns not_found on 404 response', async () => {
    getJsonWithMetaMock.mockResolvedValueOnce(mockMeta(null, 404));
    const res = await lookupOff('000000000000');
    expect(res.status).toBe('not_found');
  });

  it('returns not_found on status !== 1 (explicit product not found)', async () => {
    getJsonWithMetaMock.mockResolvedValueOnce(
      mockMeta({
        status: 0,
        status_verbose: 'product not found',
      }),
    );
    const res = await lookupOff('111111111111');
    expect(res.status).toBe('not_found');
  });

  it('falls back to unavailable on 5xx or rate limit errors', async () => {
    getJsonWithMetaMock.mockResolvedValue(mockMeta(null, 500));
    const res = await lookupOff('333333333333');
    expect(res.status).toBe('unavailable');
  });
});
