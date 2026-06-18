import Constants from 'expo-constants';
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

function getBaseUrl(): string {
  const url = (Constants?.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  if (!url) throw new Error('apiBaseUrl not configured');
  return url.replace(/\/+$/, '');
}

async function parseError(res: Response): Promise<ApiError> {
  let body: {
    code?: string;
    status?: number;
    title?: string;
    detail?: string;
    errors?: Array<{ path: string; message: string }>;
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
  });
}

// --- Single-flight refresh ---

let refreshInFlight: Promise<boolean> | null = null;
let onSignOut: (() => void) | null = null;

export function setOnSignOut(cb: () => void) {
  onSignOut = cb;
}

async function refreshTokensOnce(): Promise<boolean> {
  // Single-flight: every concurrent 401 awaits the SAME promise. Whoever arrives
  // first creates it; everyone else gets the in-flight one. Because the promise
  // is only cleared synchronously in the finally below (after the rotated tokens
  // are already written to secure-store), there is no multi-tick window in which
  // a late caller can miss the rotation and kick off a second refresh.
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
        await secureStore.clearAll();
        onSignOut?.();
        return false;
      }
      const data = (await res.json()) as RefreshResponse;
      await secureStore.setAccessToken(data.accessToken);
      await secureStore.setRefreshToken(data.refreshToken);
      return true;
    } catch {
      await secureStore.clearAll();
      onSignOut?.();
      return false;
    } finally {
      // Clear synchronously: by the time this runs the rotated tokens are already
      // persisted, so any request that awaited this promise replays against the
      // new access token, and a request that arrives afterwards starts a fresh
      // single-flight only if it genuinely 401s again.
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function doFetch<T>(req: ApiRequest, retrying = false): Promise<T> {
  // path must NOT include /v1 prefix; client adds it
  const url = `${getBaseUrl()}/v1${req.path.startsWith('/') ? '' : '/'}${req.path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(req.headers ?? {}),
  };
  if (req.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!req.skipAuth) {
    const access = await secureStore.getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
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
  delete: <T>(path: string, opts?: ApiClientOpts) =>
    doFetch<T>({ method: 'DELETE', path, ...opts }),
};
