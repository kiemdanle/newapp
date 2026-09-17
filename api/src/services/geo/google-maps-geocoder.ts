import CircuitBreaker from 'opossum';
import { getPrisma } from '../../db.js';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';
import { AppError } from '../../errors.js';
import { getGeocodeCache, setGeocodeCache } from './cache.js';

export interface ReverseGeocodeResult {
  address: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  cached: boolean;
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  types: string[];
}

interface GoogleGeocodeApiResponse {
  status: string;
  results: GoogleGeocodeResult[];
  error_message?: string;
}

const GOOGLE_MAPS_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const TIMEOUT_MS = 4000;

async function fetchFromGoogleApi(lat: number, lng: number, apiKey: string): Promise<GoogleGeocodeApiResponse> {
  const url = `${GOOGLE_MAPS_GEOCODE_URL}?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Google Maps API responded with HTTP ${res.status}`);
  }
  return (await res.json()) as GoogleGeocodeApiResponse;
}

const breaker = new CircuitBreaker(fetchFromGoogleApi, {
  timeout: TIMEOUT_MS + 500,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

breaker.on('open', () => logger.warn('Google Maps geocoder circuit breaker OPENED'));
breaker.on('halfOpen', () => logger.info('Google Maps geocoder circuit breaker HALF-OPEN'));
breaker.on('close', () => logger.info('Google Maps geocoder circuit breaker CLOSED'));

/**
 * Extracts a privacy-preserving neighbourhood and city address:
 * Omit house/premise numbers to protect home location privacy while
 * keeping route/neighbourhood, ward/sublocality, district, and city.
 */
export function formatPrivacyPreservingAddress(components: GoogleAddressComponent[], fullAddress?: string): string {
  // Collect relevant parts in geographic hierarchy
  let route = '';
  let neighbourhood = '';
  let district = '';
  let city = '';

  for (const comp of components) {
    if (comp.types.includes('route')) {
      route = comp.long_name;
    } else if (
      comp.types.includes('sublocality_level_1') ||
      comp.types.includes('sublocality') ||
      comp.types.includes('neighborhood')
    ) {
      if (!neighbourhood) neighbourhood = comp.long_name;
    } else if (
      comp.types.includes('administrative_area_level_2') ||
      comp.types.includes('sublocality_level_2')
    ) {
      if (!district) district = comp.long_name;
    } else if (
      comp.types.includes('locality') ||
      comp.types.includes('administrative_area_level_1')
    ) {
      if (!city) city = comp.long_name;
    }
  }

  const parts = [route, neighbourhood, district, city].filter(Boolean);
  if (parts.length >= 2) {
    return parts.join(', ');
  }

  // Fallback: strip leading house numbers from full formatted address
  if (fullAddress) {
    return fullAddress
      .replace(/^[\w\d+]+,\s*/, '') // Strip plus-codes like "QPG2+HCR, "
      .replace(/^\d+[A-Za-z]?[/\d-]*\s+/, '') // Strip house numbers like "86 " or "123/4B "
      .trim();
  }

  return 'Local Area';
}

export function extractCountryCode(components: GoogleAddressComponent[]): string {
  const countryComp = components.find((c) => c.types.includes('country'));
  return countryComp?.short_name?.toUpperCase() || 'US';
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  userId?: string | null,
  callerContext: string = 'profile_location',
): Promise<ReverseGeocodeResult> {
  // 1. Check in-memory cache first
  const cached = getGeocodeCache(lat, lng);
  if (cached) {
    // Log cache hit asynchronously
    void getPrisma().googleMapsApiCallLog.create({
      data: {
        endpoint: GOOGLE_MAPS_GEOCODE_URL,
        latitude: lat,
        longitude: lng,
        status: 'cached',
        httpStatus: 200,
        durationMs: 0,
        formattedAddress: cached.address,
        countryCode: cached.countryCode,
        callerContext,
        userId: userId || null,
      },
    }).catch((err: unknown) => {
      logger.error({ err }, 'Failed to record cached Google Maps API audit log');
    });

    return {
      address: cached.address,
      countryCode: cached.countryCode,
      latitude: lat,
      longitude: lng,
      cached: true,
    };
  }

  // 2. Resolve API key
  const apiKey = getConfig().googleMaps.apiKey || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new AppError({
      status: 503,
      code: 'GEOCODING_SERVICE_NOT_CONFIGURED',
      title: 'Google Maps API key is not configured on this server.',
    });
  }

  const startTime = performance.now();
  let status = 'success';
  let httpStatus = 200;
  let formattedAddress: string | null = null;
  let countryCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    const data = await breaker.fire(lat, lng, apiKey);
    const durationMs = Math.round(performance.now() - startTime);

    if (data.status === 'ZERO_RESULTS') {
      status = 'zero_results';
      httpStatus = 404;
      errorMessage = 'No address found for the specified coordinates';
      throw new AppError({
        status: 404,
        code: 'GEOCODE_ZERO_RESULTS',
        title: errorMessage,
      });
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      status = 'rate_limited';
      httpStatus = 429;
      errorMessage = 'Google Maps Geocoding API daily quota exceeded';
      throw new AppError({
        status: 429,
        code: 'GEOCODE_QUOTA_EXCEEDED',
        title: 'Geocoding service is temporarily rate-limited. Please try again later.',
      });
    }

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      status = 'error';
      httpStatus = 502;
      errorMessage = data.error_message || `Google Maps API returned status: ${data.status}`;
      throw new AppError({
        status: 502,
        code: 'GEOCODE_UPSTREAM_ERROR',
        title: errorMessage,
      });
    }

    // Pick top result and format
    const topResult = data.results[0]!;
    formattedAddress = formatPrivacyPreservingAddress(topResult.address_components, topResult.formatted_address);
    countryCode = extractCountryCode(topResult.address_components);

    // Save to cache
    setGeocodeCache(lat, lng, { address: formattedAddress, countryCode });

    // Asynchronously record success audit log
    void getPrisma().googleMapsApiCallLog.create({
      data: {
        endpoint: GOOGLE_MAPS_GEOCODE_URL,
        latitude: lat,
        longitude: lng,
        status: 'success',
        httpStatus: 200,
        durationMs,
        formattedAddress,
        countryCode,
        callerContext,
        userId: userId || null,
      },
    }).catch((err: unknown) => {
      logger.error({ err }, 'Failed to record Google Maps API audit log');
    });

    return {
      address: formattedAddress,
      countryCode,
      latitude: lat,
      longitude: lng,
      cached: false,
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const errMessage = err instanceof Error ? err.message : String(err);

    // Record error log
    void getPrisma().googleMapsApiCallLog.create({
      data: {
        endpoint: GOOGLE_MAPS_GEOCODE_URL,
        latitude: lat,
        longitude: lng,
        status: status === 'success' ? 'error' : status,
        httpStatus: err instanceof AppError ? err.status : (httpStatus || 500),
        durationMs,
        errorMessage: errorMessage || errMessage,
        callerContext,
        userId: userId || null,
      },
    }).catch((logErr: unknown) => {
      logger.error({ logErr }, 'Failed to record Google Maps API error audit log');
    });

    if (err instanceof AppError) throw err;
    throw new AppError({
      status: 502,
      code: 'GEOCODE_REQUEST_FAILED',
      title: 'Failed to retrieve address from geocoding service',
      detail: errMessage,
    });
  }
}
