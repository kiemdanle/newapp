import { getJson, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { mapOffProduct, type ExternalProductData } from './mappers.js';

// Explicit source outcome so callers can tell a conclusive miss (safe to offer
// creation) apart from an unavailable provider (never conclusive, must retry).
export type ExternalLookupResult =
  | { status: 'found'; data: ExternalProductData }
  | { status: 'not_found' }
  | { status: 'unavailable' };

const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

interface OffStatusPayload {
  status?: number;
}

async function fetchOff(barcode: string): Promise<ExternalLookupResult> {
  let raw: unknown;
  try {
    raw = await getJson<unknown>(OFF_URL(barcode), {
      timeoutMs: 1500,
      headers: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return { status: 'not_found' };
    // 429/5xx/timeout: rethrow so the circuit breaker counts it as a failure and
    // its fallback resolves this call to 'unavailable' instead of a conclusive miss.
    throw err;
  }
  const mapped = mapOffProduct(barcode, raw);
  if (mapped) return { status: 'found', data: mapped };
  // OFF's own explicit "no such product" signal is a conclusive miss. Anything
  // else that failed to map (missing/incomplete product data) is a payload we
  // can't trust — never fabricate a conclusive miss from data we couldn't parse.
  const payload = raw as OffStatusPayload;
  if (payload && payload.status !== undefined && payload.status !== 1) return { status: 'not_found' };
  return { status: 'unavailable' };
}

export const offBreaker = makeBreaker(fetchOff, {
  name: 'off',
  timeout: 2000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

// Fallback: when the breaker is open or the call failed/timed out, the outcome is
// unavailable rather than a conclusive miss.
offBreaker.fallback(() => ({ status: 'unavailable' }) satisfies ExternalLookupResult);

// Register in the global breaker registry for health/observability.
register('off', offBreaker);

export async function lookupOff(barcode: string): Promise<ExternalLookupResult> {
  return offBreaker.fire(barcode);
}
