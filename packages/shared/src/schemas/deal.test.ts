import { describe, expect, it } from 'vitest';
import {
  dealSortSchema,
  dealExpiryStatusSchema,
  dealListQuerySchema,
  dealCreateSchema,
  dealStoreFacetSchema,
} from './deal.js';

describe('dealSortSchema', () => {
  it('defaults to score', () => {
    expect(dealSortSchema.parse(undefined)).toBe('score');
  });

  it('accepts all 5 valid sort orders', () => {
    expect(dealSortSchema.parse('score')).toBe('score');
    expect(dealSortSchema.parse('new')).toBe('new');
    expect(dealSortSchema.parse('price_asc')).toBe('price_asc');
    expect(dealSortSchema.parse('price_desc')).toBe('price_desc');
    expect(dealSortSchema.parse('expiry_asc')).toBe('expiry_asc');
  });

  it('rejects invalid sort values', () => {
    expect(() => dealSortSchema.parse('invalid')).toThrow();
  });
});

describe('dealExpiryStatusSchema', () => {
  it('defaults to all', () => {
    expect(dealExpiryStatusSchema.parse(undefined)).toBe('all');
  });

  it('accepts valid expiry statuses', () => {
    expect(dealExpiryStatusSchema.parse('all')).toBe('all');
    expect(dealExpiryStatusSchema.parse('unexpired')).toBe('unexpired');
    expect(dealExpiryStatusSchema.parse('expiring_soon')).toBe('expiring_soon');
  });
});

describe('dealListQuerySchema', () => {
  it('parses empty query with defaults', () => {
    const res = dealListQuerySchema.parse({});
    expect(res.sort).toBe('score');
    expect(res.limit).toBe(20);
    expect(res.q).toBeUndefined();
    expect(res.store).toBeUndefined();
  });

  it('coerces string numbers for limit, minPrice, and maxPrice', () => {
    const res = dealListQuerySchema.parse({
      limit: '15',
      minPrice: '2.50',
      maxPrice: '19.99',
      q: '  Milk  ',
      store: ' Trader Joe\'s ',
      sort: 'price_asc',
      country: 'US',
      expiryStatus: 'unexpired',
    });
    expect(res.limit).toBe(15);
    expect(res.minPrice).toBe(2.5);
    expect(res.maxPrice).toBe(19.99);
    expect(res.q).toBe('Milk');
    expect(res.store).toBe("Trader Joe's");
    expect(res.sort).toBe('price_asc');
    expect(res.country).toBe('US');
    expect(res.expiryStatus).toBe('unexpired');
  });

  it('rejects negative prices', () => {
    expect(() => dealListQuerySchema.parse({ minPrice: '-1' })).toThrow();
  });
});

describe('dealStoreFacetSchema', () => {
  it('validates store facet structure', () => {
    const facet = dealStoreFacetSchema.parse({ name: 'Costco', count: 12 });
    expect(facet.name).toBe('Costco');
    expect(facet.count).toBe(12);
  });
});
