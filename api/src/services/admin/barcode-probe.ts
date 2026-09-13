import {
  type BarcodeApiProbeResponse,
  type BarcodeApiStatus,
} from '@expyrico/shared';
import { getJsonWithMeta } from '../../lib/http.js';
import { mapOffProduct } from '../products/mappers.js';
import { mapUpcitemdbProduct } from '../products/mappers.js';
import { bufferBarcodeApiCallLog } from '../external/barcode-api-tracker.js';

export async function probeBarcodeProvider(
  barcode: string,
  provider: string,
  adminUserId: string,
): Promise<BarcodeApiProbeResponse> {
  const cleanBarcode = barcode.trim();
  let endpoint = '';
  let reqHeaders: Record<string, string> = {};

  if (provider === 'off') {
    endpoint = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json`;
    reqHeaders = { 'user-agent': 'PantryApp/1.0 (+self-hosted)' };
  } else if (provider === 'upcitemdb') {
    endpoint = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(cleanBarcode)}`;
  } else {
    return {
      provider,
      barcode: cleanBarcode,
      endpoint: '',
      durationMs: 0,
      httpStatus: null,
      status: 'error',
      errorMessage: `Unknown provider: ${provider}`,
    };
  }

  const startTime = Date.now();

  try {
    const res = await getJsonWithMeta<unknown>(endpoint, {
      timeoutMs: 5000,
      headers: reqHeaders,
    });
    const durationMs = Math.max(1, Date.now() - startTime);

    let status: BarcodeApiStatus = 'error';
    let errorMessage: string | null = null;
    let parsedProduct: { name?: string | null; brand?: string | null; found: boolean } = { found: false };

    if (res.status === 404) {
      status = 'miss';
    } else if (res.status === 429) {
      status = 'rate_limited';
      errorMessage = 'Upstream provider returned HTTP 429 rate limit exceeded';
    } else if (res.status >= 500) {
      status = 'error';
      errorMessage = `Upstream server error (HTTP ${res.status})`;
    } else if (res.status >= 400) {
      status = 'error';
      errorMessage = `Upstream client error (HTTP ${res.status})`;
    } else if (res.status === 200) {
      if (provider === 'off') {
        const mapped = mapOffProduct(cleanBarcode, res.data);
        if (mapped) {
          status = 'hit';
          parsedProduct = { name: mapped.name, brand: mapped.brand, found: true };
        } else if (
          res.data &&
          typeof res.data === 'object' &&
          'status' in res.data &&
          res.data.status === 0
        ) {
          status = 'miss';
        } else {
          status = 'error';
          errorMessage = 'OpenFoodFacts payload could not be parsed into product fields';
        }
      } else if (provider === 'upcitemdb') {
        const mapped = mapUpcitemdbProduct(cleanBarcode, res.data);
        if (mapped) {
          status = 'hit';
          parsedProduct = { name: mapped.name, brand: mapped.brand, found: true };
        } else if (
          res.data &&
          typeof res.data === 'object' &&
          'items' in res.data &&
          Array.isArray(res.data.items) &&
          res.data.items.length === 0
        ) {
          status = 'miss';
        } else {
          status = 'error';
          errorMessage = 'UPCitemdb payload could not be parsed into product fields';
        }
      }
    }

    // Persist as admin_probe so it appears in request logs but is excluded from organic KPIs
    bufferBarcodeApiCallLog({
      provider,
      barcode: cleanBarcode,
      endpoint,
      status,
      httpStatus: res.status,
      durationMs,
      errorMessage,
      responseSizeBytes: res.sizeBytes,
      callerContext: 'admin_probe',
      requestHeaders: reqHeaders,
      responseHeaders: res.headers,
      rawResponsePreview: res.rawTextPreview,
      userId: adminUserId,
    });

    return {
      provider,
      barcode: cleanBarcode,
      endpoint,
      durationMs,
      httpStatus: res.status,
      status,
      headers: res.headers,
      parsedProduct,
      rawResponsePreview: res.rawTextPreview,
      errorMessage: errorMessage ?? undefined,
    };
  } catch (err) {
    const durationMs = Math.max(1, Date.now() - startTime);
    const isTimeout =
      (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))) ||
      (typeof err === 'object' && err !== null && 'code' in err && err.code === 'UND_ERR_HEADERS_TIMEOUT');

    const status: BarcodeApiStatus = isTimeout ? 'timeout' : 'error';
    const errorMessage = err instanceof Error ? err.message : String(err);

    bufferBarcodeApiCallLog({
      provider,
      barcode: cleanBarcode,
      endpoint,
      status,
      durationMs,
      errorMessage,
      callerContext: 'admin_probe',
      requestHeaders: reqHeaders,
      userId: adminUserId,
    });

    return {
      provider,
      barcode: cleanBarcode,
      endpoint,
      durationMs,
      httpStatus: null,
      status,
      errorMessage,
    };
  }
}
