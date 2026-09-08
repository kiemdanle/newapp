import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '../../lib/http.js';

const getJsonMock = vi.fn();
vi.mock('../../lib/http.js', async () => {
  const actual = await vi.importActual('../../lib/http.js');
  return {
    ...actual,
    getJson: (...args: unknown[]) => getJsonMock(...args),
  };
});

import {
  lookupUpcitemdb,
  resetUpcQuotaCooldown,
  getUpcQuotaCooldownUntil,
  upcBreaker,
} from './upcitemdb-client.js';

describe('upcitemdb-client', () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    resetUpcQuotaCooldown();
    upcBreaker.close();
  });

  it('returns found when item is present', async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [
        {
          title: 'Test Milk',
          brand: 'Dairy',
          category: 'Food',
          images: ['https://example.com/milk.jpg'],
        },
      ],
    });

    const res = await lookupUpcitemdb('012345678905');
    expect(res.status).toBe('found');
    if (res.status === 'found') {
      expect(res.data.name).toBe('Test Milk');
      expect(res.data.brand).toBe('Dairy');
    }
  });

  it('returns not_found on 404 response', async () => {
    getJsonMock.mockRejectedValueOnce(new HttpError(404, 'not found'));
    const res = await lookupUpcitemdb('000000000000');
    expect(res.status).toBe('not_found');
  });

  it('returns not_found on 429 response, activates cooldown, and skips subsequent network calls', async () => {
    getJsonMock.mockRejectedValueOnce(new HttpError(429, 'client error 429'));

    const res1 = await lookupUpcitemdb('111111111111');
    expect(res1.status).toBe('not_found');
    expect(getUpcQuotaCooldownUntil()).toBeGreaterThan(Date.now());
    expect(upcBreaker.opened).toBe(false);

    // Second call during cooldown should return not_found immediately without calling getJson
    const res2 = await lookupUpcitemdb('222222222222');
    expect(res2.status).toBe('not_found');
    expect(getJsonMock).toHaveBeenCalledTimes(1); // Only the first call invoked getJson
  });

  it('falls back to unavailable on 5xx errors or network drops', async () => {
    getJsonMock.mockRejectedValue(new HttpError(500, 'upstream 500'));
    const res = await lookupUpcitemdb('333333333333');
    expect(res.status).toBe('unavailable');
  });
});
