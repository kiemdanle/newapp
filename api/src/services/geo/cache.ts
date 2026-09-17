// In-memory reverse-geocoding cache with coordinate-rounding and TTL
export interface CachedGeocode {
  address: string;
  countryCode: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 5000;

const cache = new Map<string, CachedGeocode>();

/**
 * Rounds latitude and longitude to 4 decimal places (~11 meters at the equator),
 * which aggregates close proximity requests to save external API quota while
 * preserving neighbourhood precision.
 */
export function geoCacheKey(lat: number, lng: number): string {
  return `geo:${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

export function getGeocodeCache(lat: number, lng: number): { address: string; countryCode: string } | null {
  const key = geoCacheKey(lat, lng);
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return { address: entry.address, countryCode: entry.countryCode };
}

export function setGeocodeCache(
  lat: number,
  lng: number,
  data: { address: string; countryCode: string },
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  // Simple eviction if cache exceeds capacity
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  const key = geoCacheKey(lat, lng);
  cache.set(key, {
    address: data.address,
    countryCode: data.countryCode,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearGeocodeCache(): void {
  cache.clear();
}

export function getGeocodeCacheSize(): number {
  return cache.size;
}
