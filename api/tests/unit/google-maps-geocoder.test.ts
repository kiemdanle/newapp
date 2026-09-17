import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatPrivacyPreservingAddress,
  extractCountryCode,
  reverseGeocodeCoordinates,
} from '../../src/services/geo/google-maps-geocoder.js';
import {
  geoCacheKey,
  getGeocodeCache,
  setGeocodeCache,
  clearGeocodeCache,
} from '../../src/services/geo/cache.js';
import { AppError } from '../../src/errors.js';

// Mock Prisma database calls
const mockCreateLog = vi.fn().mockImplementation(() => Promise.resolve({}));
vi.mock('../../src/db.js', () => ({
  getPrisma: () => ({
    googleMapsApiCallLog: {
      create: mockCreateLog,
    },
  }),
}));

describe('Google Maps Geocoder & Cache', () => {
  beforeEach(() => {
    clearGeocodeCache();
    mockCreateLog.mockReset();
    mockCreateLog.mockResolvedValue({});
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  });

  describe('geoCacheKey and cache behavior', () => {
    it('rounds coordinates to 4 decimal places', () => {
      const key1 = geoCacheKey(10.776912, 106.700918);
      const key2 = geoCacheKey(10.776949, 106.700942);
      expect(key1).toBe('geo:10.7769:106.7009');
      expect(key2).toBe('geo:10.7769:106.7009');
      expect(key1).toBe(key2);
    });

    it('stores and retrieves cached geocodes', () => {
      setGeocodeCache(10.7769, 106.7009, {
        address: 'Ben Nghe, District 1, Ho Chi Minh City',
        countryCode: 'VN',
      });

      const cached = getGeocodeCache(10.7769, 106.7009);
      expect(cached).toEqual({
        address: 'Ben Nghe, District 1, Ho Chi Minh City',
        countryCode: 'VN',
      });
    });

    it('expires cache after TTL', () => {
      setGeocodeCache(
        10.7769,
        106.7009,
        {
          address: 'Test Address',
          countryCode: 'VN',
        },
        -1000, // Expired 1 second ago
      );

      const cached = getGeocodeCache(10.7769, 106.7009);
      expect(cached).toBeNull();
    });
  });

  describe('formatPrivacyPreservingAddress', () => {
    it('omits street number and preserves street, ward, district, city', () => {
      const components = [
        { long_name: '86', short_name: '86', types: ['street_number'] },
        { long_name: 'Le Thanh Ton', short_name: 'Le Thanh Ton', types: ['route'] },
        { long_name: 'Ben Nghe', short_name: 'Ben Nghe', types: ['sublocality_level_1', 'sublocality'] },
        { long_name: 'District 1', short_name: 'District 1', types: ['administrative_area_level_2'] },
        { long_name: 'Ho Chi Minh City', short_name: 'Ho Chi Minh City', types: ['locality'] },
        { long_name: 'Vietnam', short_name: 'VN', types: ['country'] },
      ];

      const formatted = formatPrivacyPreservingAddress(components, '86 Le Thanh Ton, Ben Nghe, District 1, Ho Chi Minh City');
      expect(formatted).toBe('Le Thanh Ton, Ben Nghe, District 1, Ho Chi Minh City');
      expect(formatted).not.toContain('86');
    });

    it('falls back to stripping leading house number if components are minimal', () => {
      const components = [
        { long_name: 'Vietnam', short_name: 'VN', types: ['country'] },
      ];
      const full = '123 Market Street, San Francisco, CA, USA';
      const formatted = formatPrivacyPreservingAddress(components, full);
      expect(formatted).toBe('Market Street, San Francisco, CA, USA');
      expect(formatted).not.toContain('123');
    });
  });

  describe('extractCountryCode', () => {
    it('extracts uppercase 2-letter country code', () => {
      const components = [
        { long_name: 'Singapore', short_name: 'sg', types: ['country', 'political'] },
      ];
      expect(extractCountryCode(components)).toBe('SG');
    });

    it('defaults to US if country component is missing', () => {
      expect(extractCountryCode([])).toBe('US');
    });
  });

  describe('reverseGeocodeCoordinates', () => {
    it('returns cached result immediately without calling upstream fetch', async () => {
      setGeocodeCache(1.3521, 103.8198, {
        address: 'Orchard, Singapore',
        countryCode: 'SG',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = await reverseGeocodeCoordinates(1.3521, 103.8198, 'test-user-id');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        address: 'Orchard, Singapore',
        countryCode: 'SG',
        latitude: 1.3521,
        longitude: 103.8198,
        cached: true,
      });
      expect(mockCreateLog).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cached',
            latitude: 1.3521,
            longitude: 103.8198,
          }),
        }),
      );
    });

    it('fetches from Google API on cache miss and parses address', async () => {
      const fakeGoogleResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: 'QPG2+HCR, 86 Le Thanh Ton, Ben Nghe, District 1, Ho Chi Minh City, Vietnam',
            address_components: [
              { long_name: '86', short_name: '86', types: ['street_number'] },
              { long_name: 'Le Thanh Ton', short_name: 'Le Thanh Ton', types: ['route'] },
              { long_name: 'Ben Nghe', short_name: 'Ben Nghe', types: ['sublocality_level_1'] },
              { long_name: 'District 1', short_name: 'District 1', types: ['administrative_area_level_2'] },
              { long_name: 'Ho Chi Minh City', short_name: 'Ho Chi Minh City', types: ['locality'] },
              { long_name: 'Vietnam', short_name: 'VN', types: ['country'] },
            ],
            types: ['street_address'],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => fakeGoogleResponse,
      } as Response);

      const result = await reverseGeocodeCoordinates(10.7769, 106.7009, 'test-user-id');

      expect(result.address).toBe('Le Thanh Ton, Ben Nghe, District 1, Ho Chi Minh City');
      expect(result.countryCode).toBe('VN');
      expect(result.cached).toBe(false);

      // Verify cached for next call
      const cached = getGeocodeCache(10.7769, 106.7009);
      expect(cached?.address).toBe('Le Thanh Ton, Ben Nghe, District 1, Ho Chi Minh City');
    });

    it('throws 404 AppError on ZERO_RESULTS', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
      } as Response);

      await expect(
        reverseGeocodeCoordinates(0, 0, 'test-user-id'),
      ).rejects.toThrowError(AppError);
    });

    it('throws 429 AppError on OVER_QUERY_LIMIT', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'OVER_QUERY_LIMIT', results: [] }),
      } as Response);

      await expect(
        reverseGeocodeCoordinates(10.7769, 106.7009, 'test-user-id'),
      ).rejects.toThrowError(AppError);
    });
  });
});
