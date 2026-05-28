import { getJson, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { mapOffProduct, type ExternalProductData } from './mappers.js';

const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

async function fetchOff(barcode: string): Promise<ExternalProductData | null> {
  try {
    const raw = await getJson<unknown>(OFF_URL(barcode), {
      timeoutMs: 1500,
      headers: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
    });
    return mapOffProduct(barcode, raw);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

export const offBreaker = makeBreaker(fetchOff, {
  name: 'off',
  timeout: 2000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

// Fallback: when the breaker is open, return null so caller can fall through.
offBreaker.fallback(() => null);

// Register in the global breaker registry for health/observability.
register('off', offBreaker);

export async function lookupOff(barcode: string): Promise<ExternalProductData | null> {
  return offBreaker.fire(barcode);
}
