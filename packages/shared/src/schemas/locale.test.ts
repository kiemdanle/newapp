import { describe, it, expect } from 'vitest';
import { getCountryMetadata, getAllCountries, RECORD_COUNTRIES } from './locale.js';

describe('locale schemas and metadata', () => {
  it('returns valid metadata for known country codes', () => {
    const vn = getCountryMetadata('VN');
    expect(vn.name).toBe('Vietnam');
    expect(vn.currencyCode).toBe('VND');
    expect(vn.currencySymbol).toBe('₫');
    expect(vn.dateFormat).toBe('DMY');

    const us = getCountryMetadata('US');
    expect(us.name).toBe('United States');
    expect(us.currencyCode).toBe('USD');
    expect(us.currencySymbol).toBe('$');
    expect(us.dateFormat).toBe('MDY');
  });

  it('falls back to default metadata on empty or unrecognized codes', () => {
    const fallbackNull = getCountryMetadata(null);
    expect(fallbackNull.code).toBe('US');

    const custom = getCountryMetadata('ZZ');
    expect(custom.code).toBe('ZZ');
    expect(custom.currencyCode).toBe('USD');
  });

  it('lists sorted countries', () => {
    const countries = getAllCountries();
    expect(countries.length).toBe(Object.keys(RECORD_COUNTRIES).length);
    expect(countries[0]!.name.localeCompare(countries[1]!.name)).toBeLessThanOrEqual(0);
  });
});
