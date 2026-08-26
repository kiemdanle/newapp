import { describe, expect, it } from '@jest/globals';
import { buildDealQueryString } from '../src/api/deals';

describe('buildDealQueryString', () => {
  it('returns empty string for empty filters', () => {
    expect(buildDealQueryString({})).toBe('');
  });

  it('builds query with sort, search, store, price, and pagination', () => {
    const qs = buildDealQueryString(
      {
        sort: 'price_asc',
        q: 'Almond Milk',
        store: "Trader Joe's",
        minPrice: 2,
        maxPrice: 8.5,
        country: 'US',
        expiryStatus: 'unexpired',
      },
      'cursor-123',
    );

    expect(qs).toContain('sort=price_asc');
    expect(qs).toContain('q=Almond+Milk');
    expect(qs).toContain("store=Trader+Joe%27s");
    expect(qs).toContain('minPrice=2');
    expect(qs).toContain('maxPrice=8.5');
    expect(qs).toContain('country=US');
    expect(qs).toContain('expiryStatus=unexpired');
    expect(qs).toContain('cursor=cursor-123');
  });

  it('ignores all expiryStatus', () => {
    const qs = buildDealQueryString({ expiryStatus: 'all' });
    expect(qs).not.toContain('expiryStatus');
  });
});
