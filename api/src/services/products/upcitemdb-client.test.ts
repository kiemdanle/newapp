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

import {
  lookupUpcitemdb,
  resetUpcQuotaCooldown,
  getUpcQuotaCooldownUntil,
  upcBreaker,
} from './upcitemdb-client.js';

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

describe('upcitemdb-client', () => {
  beforeEach(() => {
    getJsonWithMetaMock.mockReset();
    resetUpcQuotaCooldown();
    upcBreaker.close();
  });

  it('returns found when item is present', async () => {
    getJsonWithMetaMock.mockResolvedValueOnce(
      mockMeta({
        items: [
          {
            title: 'Test Milk',
            brand: 'Dairy',
            category: 'Food',
            images: ['https://example.com/milk.jpg'],
          },
        ],
      }),
    );

    const res = await lookupUpcitemdb('012345678905');
    expect(res.status).toBe('found');
    if (res.status === 'found') {
      expect(res.data.name).toBe('Test Milk');
      expect(res.data.brand).toBe('Dairy');
    }
  });

  it('returns not_found on 404 response', async () => {
    getJsonWithMetaMock.mockResolvedValueOnce(mockMeta(null, 404));
    const res = await lookupUpcitemdb('000000000000');
    expect(res.status).toBe('not_found');
  });

  it('returns not_found on 429 response, activates cooldown, and skips subsequent network calls', async () => {
    getJsonWithMetaMock.mockResolvedValueOnce(mockMeta(null, 429));

    const res1 = await lookupUpcitemdb('111111111111');
    expect(res1.status).toBe('not_found');
    expect(getUpcQuotaCooldownUntil()).toBeGreaterThan(Date.now());
    expect(upcBreaker.opened).toBe(false);

    // Second call during cooldown should return not_found immediately without calling network
    const res2 = await lookupUpcitemdb('222222222222');
    expect(res2.status).toBe('not_found');
    expect(getJsonWithMetaMock).toHaveBeenCalledTimes(1); // Only the first call invoked network
  });

  it('falls back to unavailable on 5xx errors or network drops', async () => {
    getJsonWithMetaMock.mockResolvedValue(mockMeta(null, 500));
    const res = await lookupUpcitemdb('333333333333');
    expect(res.status).toBe('unavailable');
  });
});
