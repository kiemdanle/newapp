import { getJson, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { mapUpcitemdbProduct } from './mappers.js';
import type { ExternalLookupResult } from './off-client.js';

export type { ExternalLookupResult };

const UPC_URL = (barcode: string) =>
  `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;

interface UpcItemsPayload {
  items?: unknown[];
}

async function fetchUpc(barcode: string): Promise<ExternalLookupResult> {
  let raw: unknown;
  try {
    raw = await getJson<unknown>(UPC_URL(barcode), { timeoutMs: 2000 });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return { status: 'not_found' };
    throw err;
  }
  const mapped = mapUpcitemdbProduct(barcode, raw);
  if (mapped) return { status: 'found', data: mapped };
  // upcitemdb's explicit empty-items response is a conclusive miss; anything else
  // that failed to map (missing/malformed item) is untrustworthy, not a miss.
  const payload = raw as UpcItemsPayload;
  if (payload && Array.isArray(payload.items) && payload.items.length === 0) return { status: 'not_found' };
  return { status: 'unavailable' };
}

export const upcBreaker = makeBreaker(fetchUpc, {
  name: 'upcitemdb',
  timeout: 2500,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

upcBreaker.fallback(() => ({ status: 'unavailable' }) satisfies ExternalLookupResult);

// Register in the global breaker registry.
register('upcitemdb', upcBreaker);

export async function lookupUpcitemdb(barcode: string): Promise<ExternalLookupResult> {
  return upcBreaker.fire(barcode);
}
