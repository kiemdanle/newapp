import { v4 as uuidv4 } from 'uuid';
import Config from 'react-native-config';
import { secureStore } from '../auth/secure-store';
import { ApiError } from './errors';
// path must NOT include /v1 prefix; client adds it
export type ApiClientOpts = { headers?: Record<string, string>; skipAuth?: boolean };

interface ApiRequest extends ApiClientOpts {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Exported so the XHR-based upload transport (product-photo-upload.ts) and
// the private-image fetcher (product-private-image.tsx) build the exact same
// `<base>/v1<path>` URL shape as this client, instead of duplicating the
// trailing-slash-trim/prefix logic.
export function getBaseUrl(): string {
  const url = Config.API_BASE_URL || 'https://api.linhkienkts.com';
  return url.replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  return `${getBaseUrl()}/v1${path.startsWith('/') ? '' : '/'}${path}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: {
    code?: string;
    status?: number;
    title?: string;
    detail?: string;
    errors?: Array<{ path: string; message: string }>;
    currentVersion?: number;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // non-JSON
  }
  return new ApiError({
    code: body.code ?? 'unknown_error',
    status: body.status ?? res.status,
    title: body.title ?? res.statusText ?? 'Request failed',
    detail: body.detail,
    errors: body.errors,
    currentVersion: body.currentVersion,
  });
}

// --- Single-flight refresh ---

let refreshInFlight: Promise<boolean> | null = null;
let onSignOut: (() => void) | null = null;

export function setOnSignOut(cb: () => void) {
  onSignOut = cb;
}

// Exported so product-photo-upload.ts's XHR transport and
// product-private-image.tsx's authorized fetch share this exact single-flight
// promise — two independent refresh implementations racing on the same 401
// would each mint their own refresh call and only one rotated token would
// survive, failing the other's replay.
export async function refreshTokensOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = await secureStore.getRefreshToken();
      if (!refresh) return false;
      const res = await fetch(`${getBaseUrl()}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        // Only sign out if the server explicitly rejects with 401 or 403 (token revoked or invalid)
        if (res.status === 401 || res.status === 403) {
          await secureStore.clearAll();
          onSignOut?.();
        }
        return false;
      }
      const data = (await res.json()) as RefreshResponse;
      await secureStore.setAccessToken(data.accessToken);
      await secureStore.setRefreshToken(data.refreshToken);
      return true;
    } catch {
      // Network failure / offline / timeout: do NOT sign out! Retain credentials for retry when online.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function doFetch<T>(req: ApiRequest, retrying = false): Promise<T> {
  const url = apiUrl(req.path);
  const isFormData = typeof FormData !== 'undefined' && req.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(req.headers ?? {}),
  };
  // Automatically provide Idempotency-Key for mutation requests if not explicitly set
  const isMutation = req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE';
  if (isMutation && !headers['Idempotency-Key'] && !headers['idempotency-key']) {
    headers['Idempotency-Key'] = uuidv4();
  }
  // FormData must never get a manually-set Content-Type: fetch/XHR compute
  // the multipart boundary themselves from the body, and a hand-set header
  // here would ship without that boundary and the server couldn't parse it.
  if (req.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (!req.skipAuth) {
    const access = await secureStore.getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.body === undefined ? undefined : isFormData ? (req.body as FormData) : JSON.stringify(req.body),
  });
  if (res.status === 401 && !retrying && !req.skipAuth && !req.path.startsWith('/auth/')) {
    const refreshed = await refreshTokensOnce();
    if (refreshed) return doFetch<T>(req, true);
    throw await parseError(res);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  request: doFetch,
  get: <T>(path: string, opts?: ApiClientOpts) => doFetch<T>({ method: 'GET', path, ...opts }),
  post: <T>(path: string, body?: unknown, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'POST', path, body, ...opts }),
  patch: <T>(path: string, body?: unknown, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'PATCH', path, body, ...opts }),
  put: <T>(path: string, body?: unknown, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'PUT', path, body, ...opts }),
  delete: <T>(path: string, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'DELETE', path, ...opts }),
};
