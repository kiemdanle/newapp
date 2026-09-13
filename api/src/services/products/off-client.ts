import { getJsonWithMeta, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { mapOffProduct, type ExternalProductData } from './mappers.js';
import { bufferBarcodeApiCallLog } from '../external/barcode-api-tracker.js';
import {
  isProviderEnabled,
  reserveDailyQuota,
  getProviderTimeoutMs,
} from '../external/barcode-provider-settings.js';
import type { BarcodeApiCallerContext } from '@expyrico/shared';

// Explicit source outcome so callers can tell a conclusive miss (safe to offer
// creation) apart from an unavailable provider (never conclusive, must retry).
export type ExternalLookupResult =
  | { status: 'found'; data: ExternalProductData }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export interface ExternalLookupOptions {
  callerContext?: BarcodeApiCallerContext;
  userId?: string | null;
}

const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

interface OffStatusPayload {
  status?: number;
}

async function fetchOff(barcode: string, options?: ExternalLookupOptions): Promise<ExternalLookupResult> {
  const callerContext = options?.callerContext ?? 'sync_lookup';
  const userId = options?.userId ?? null;
  const endpoint = OFF_URL(barcode);

  // 1. Check provider enabled setting
  const enabled = await isProviderEnabled('off');
  if (!enabled) {
    bufferBarcodeApiCallLog({
      provider: 'off',
      barcode,
      endpoint,
      status: 'error',
      errorMessage: 'Provider disabled by administrator',
      durationMs: 0,
      callerContext,
      userId,
    });
    return { status: 'unavailable' };
  }

  // 2. Reserve daily quota (atomic Redis counter)
  const quota = await reserveDailyQuota('off');
  if (!quota.granted) {
    bufferBarcodeApiCallLog({
      provider: 'off',
      barcode,
      endpoint,
      status: 'rate_limited',
      errorMessage: 'Daily quota exhausted',
      durationMs: 0,
      callerContext,
      userId,
    });
    return { status: 'unavailable' };
  }

  const timeoutMs = await getProviderTimeoutMs('off', 3500);
  const startTime = Date.now();

  try {
    const res = await getJsonWithMeta<unknown>(endpoint, {
      timeoutMs,
      headers: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
    });
    const durationMs = Math.max(1, Date.now() - startTime);

    if (res.status === 404) {
      bufferBarcodeApiCallLog({
        provider: 'off',
        barcode,
        endpoint,
        status: 'miss',
        httpStatus: 404,
        durationMs,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      return { status: 'not_found' };
    }

    if (res.status === 429) {
      bufferBarcodeApiCallLog({
        provider: 'off',
        barcode,
        endpoint,
        status: 'rate_limited',
        httpStatus: 429,
        durationMs,
        errorMessage: 'Upstream rate limited (429)',
        responseSizeBytes: res.sizeBytes,
        callerContext,
        requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      throw new HttpError(429, 'upstream 429 rate limit');
    }

    if (res.status >= 500) {
      bufferBarcodeApiCallLog({
        provider: 'off',
        barcode,
        endpoint,
        status: 'error',
        httpStatus: res.status,
        durationMs,
        errorMessage: `Upstream server error (${res.status})`,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      throw new HttpError(res.status, `upstream ${res.status}`);
    }

    if (res.status >= 400) {
      bufferBarcodeApiCallLog({
        provider: 'off',
        barcode,
        endpoint,
        status: 'error',
        httpStatus: res.status,
        durationMs,
        errorMessage: `Upstream client error (${res.status})`,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      throw new HttpError(res.status, `client error ${res.status}`);
    }

    const mapped = mapOffProduct(barcode, res.data);
    if (mapped) {
      bufferBarcodeApiCallLog({
        provider: 'off',
        barcode,
        endpoint,
        status: 'hit',
        httpStatus: res.status,
        durationMs,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      return { status: 'found', data: mapped };
    }

    const payload = res.data as OffStatusPayload;
    if (payload && payload.status !== undefined && payload.status !== 1) {
      bufferBarcodeApiCallLog({
        provider: 'off',
        barcode,
        endpoint,
        status: 'miss',
        httpStatus: res.status,
        durationMs,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      return { status: 'not_found' };
    }

    bufferBarcodeApiCallLog({
      provider: 'off',
      barcode,
      endpoint,
      status: 'error',
      httpStatus: res.status,
      durationMs,
      errorMessage: 'Unparseable or incomplete product payload from OpenFoodFacts',
      responseSizeBytes: res.sizeBytes,
      callerContext,
      requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
      responseHeaders: res.headers,
      rawResponsePreview: res.rawTextPreview,
      userId,
    });
    return { status: 'unavailable' };
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    const durationMs = Math.max(1, Date.now() - startTime);
    const isTimeout =
      (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))) ||
      (typeof err === 'object' && err !== null && 'code' in err && err.code === 'UND_ERR_HEADERS_TIMEOUT');

    bufferBarcodeApiCallLog({
      provider: 'off',
      barcode,
      endpoint,
      status: isTimeout ? 'timeout' : 'error',
      durationMs,
      errorMessage: err instanceof Error ? err.message : String(err),
      callerContext,
      requestHeaders: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
      userId,
    });
    throw err;
  }
}

export const offBreaker = makeBreaker(fetchOff, {
  name: 'off',
  timeout: 4000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

// Fallback: when the breaker is open or the call failed/timed out, the outcome is
// unavailable rather than a conclusive miss.
offBreaker.fallback(() => ({ status: 'unavailable' }) satisfies ExternalLookupResult);

// Register in the global breaker registry for health/observability.
register('off', offBreaker);

export async function lookupOff(
  barcode: string,
  options?: ExternalLookupOptions,
): Promise<ExternalLookupResult> {
  return offBreaker.fire(barcode, options);
}
