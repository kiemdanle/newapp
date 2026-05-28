import { getJson, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { mapUpcitemdbProduct, type ExternalProductData } from './mappers.js';

const UPC_URL = (barcode: string) =>
  `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;

async function fetchUpc(barcode: string): Promise<ExternalProductData | null> {
  try {
    const raw = await getJson<unknown>(UPC_URL(barcode), { timeoutMs: 2000 });
    return mapUpcitemdbProduct(barcode, raw);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

export const upcBreaker = makeBreaker(fetchUpc, {
  name: 'upcitemdb',
  timeout: 2500,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

upcBreaker.fallback(() => null);

// Register in the global breaker registry.
register('upcitemdb', upcBreaker);

export async function lookupUpcitemdb(barcode: string): Promise<ExternalProductData | null> {
  return upcBreaker.fire(barcode);
}
