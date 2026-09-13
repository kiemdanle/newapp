import { getJsonWithMeta, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { logger } from '../../logger.js';
import { mapUpcitemdbProduct } from './mappers.js';
import type { ExternalLookupResult, ExternalLookupOptions } from './off-client.js';
import { bufferBarcodeApiCallLog } from '../external/barcode-api-tracker.js';
import {
  isProviderEnabled,
  reserveDailyQuota,
  getProviderTimeoutMs,
} from '../external/barcode-provider-settings.js';

export type { ExternalLookupResult, ExternalLookupOptions };

const UPC_URL = (barcode: string) =>
  `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;

let upcQuotaCooldownUntil = 0;

export function resetUpcQuotaCooldown(): void {
  upcQuotaCooldownUntil = 0;
}

export function getUpcQuotaCooldownUntil(): number {
  return upcQuotaCooldownUntil;
}

async function fetchUpc(barcode: string, options?: ExternalLookupOptions): Promise<ExternalLookupResult> {
  const callerContext = options?.callerContext ?? 'sync_lookup';
  const userId = options?.userId ?? null;
  const endpoint = UPC_URL(barcode);

  // 1. CRITICAL EXECUTION ORDER: Cooldown check FIRST
  // If provider is cooling down from a prior 429, log as cooldown_skipped with durationMs: 0
  // and return immediately WITHOUT reserving or consuming daily quota.
  if (Date.now() < upcQuotaCooldownUntil) {
    bufferBarcodeApiCallLog({
      provider: 'upcitemdb',
      barcode,
      endpoint,
      status: 'cooldown_skipped',
      durationMs: 0,
      errorMessage: 'Provider in cooldown period from prior 429',
      callerContext,
      userId,
    });
    return { status: 'not_found' };
  }

  // 2. Check provider enabled setting
  const enabled = await isProviderEnabled('upcitemdb');
  if (!enabled) {
    bufferBarcodeApiCallLog({
      provider: 'upcitemdb',
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

  // 3. Reserve daily quota (atomic Redis counter)
  const quota = await reserveDailyQuota('upcitemdb');
  if (!quota.granted) {
    bufferBarcodeApiCallLog({
      provider: 'upcitemdb',
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

  const timeoutMs = await getProviderTimeoutMs('upcitemdb', 2000);
  const startTime = Date.now();

  try {
    const res = await getJsonWithMeta<unknown>(endpoint, { timeoutMs });
    const durationMs = Math.max(1, Date.now() - startTime);

    if (res.status === 404) {
      bufferBarcodeApiCallLog({
        provider: 'upcitemdb',
        barcode,
        endpoint,
        status: 'miss',
        httpStatus: 404,
        durationMs,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      return { status: 'not_found' };
    }

    if (res.status === 429) {
      logger.warn({ barcode }, 'upcitemdb 429 quota reached, cooling down 5m');
      upcQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
      bufferBarcodeApiCallLog({
        provider: 'upcitemdb',
        barcode,
        endpoint,
        status: 'rate_limited',
        httpStatus: 429,
        durationMs,
        errorMessage: 'Upstream rate limited (429), activated 5m cooldown',
        responseSizeBytes: res.sizeBytes,
        callerContext,
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      return { status: 'not_found' };
    }

    if (res.status >= 500) {
      bufferBarcodeApiCallLog({
        provider: 'upcitemdb',
        barcode,
        endpoint,
        status: 'error',
        httpStatus: res.status,
        durationMs,
        errorMessage: `Upstream server error (${res.status})`,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      throw new HttpError(res.status, `upstream ${res.status}`);
    }

    if (res.status >= 400) {
      bufferBarcodeApiCallLog({
        provider: 'upcitemdb',
        barcode,
        endpoint,
        status: 'error',
        httpStatus: res.status,
        durationMs,
        errorMessage: `Upstream client error (${res.status})`,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      throw new HttpError(res.status, `client error ${res.status}`);
    }

    const mapped = mapUpcitemdbProduct(barcode, res.data);
    if (mapped) {
      bufferBarcodeApiCallLog({
        provider: 'upcitemdb',
        barcode,
        endpoint,
        status: 'hit',
        httpStatus: res.status,
        durationMs,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      return { status: 'found', data: mapped };
    }

    if (
      res.data &&
      typeof res.data === 'object' &&
      'items' in res.data &&
      Array.isArray(res.data.items) &&
      res.data.items.length === 0
    ) {
      bufferBarcodeApiCallLog({
        provider: 'upcitemdb',
        barcode,
        endpoint,
        status: 'miss',
        httpStatus: res.status,
        durationMs,
        responseSizeBytes: res.sizeBytes,
        callerContext,
        responseHeaders: res.headers,
        rawResponsePreview: res.rawTextPreview,
        userId,
      });
      return { status: 'not_found' };
    }

    bufferBarcodeApiCallLog({
      provider: 'upcitemdb',
      barcode,
      endpoint,
      status: 'error',
      httpStatus: res.status,
      durationMs,
      errorMessage: 'Unparseable or incomplete product payload from UPCitemdb',
      responseSizeBytes: res.sizeBytes,
      callerContext,
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
      provider: 'upcitemdb',
      barcode,
      endpoint,
      status: isTimeout ? 'timeout' : 'error',
      durationMs,
      errorMessage: err instanceof Error ? err.message : String(err),
      callerContext,
      userId,
    });
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

upcBreaker.fallback(() => ({ status: 'unavailable' }) satisfies ExternalLookupResult);

// Register in the global breaker registry.
register('upcitemdb', upcBreaker);

export async function lookupUpcitemdb(
  barcode: string,
  options?: ExternalLookupOptions,
): Promise<ExternalLookupResult> {
  return upcBreaker.fire(barcode, options);
}
