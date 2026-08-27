import { COOKIE_NAMES } from './cookies';
import { CSRF_HEADER } from './csrf-constants';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

export interface BrowserApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

let inFlightRefresh: Promise<void> | null = null;

async function executeRefresh(): Promise<void> {
  const csrf = readCookie(COOKIE_NAMES.csrf);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf) headers[CSRF_HEADER] = csrf;

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }
}

export async function requestTokenRefresh(): Promise<void> {
  if (!inFlightRefresh) {
    inFlightRefresh = executeRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/**
 * Browser fetch wrapper. All requests hit the admin app's own Route Handlers
 * under `/api/...` (same origin); the handlers proxy to the Fastify API and
 * re-issue cookies as needed. Mutating methods carry the CSRF header.
 * Transparently deduplicates and refreshes expired tokens on 401.
 */
export async function apiBrowserFetch<T>(
  path: string,
  opts: BrowserApiOptions = {},
  isRetry = false,
): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (method !== 'GET') {
    const csrf = readCookie(COOKIE_NAMES.csrf);
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  const res = await fetch(path, init);

  if (res.status === 401 && !isRetry && !path.startsWith('/api/auth/')) {
    try {
      await requestTokenRefresh();
      return apiBrowserFetch<T>(path, opts, true);
    } catch (refreshErr) {
      throw refreshErr;
    }
  }

  if (!res.ok) {
    let code = 'unknown_error';
    try {
      const problem = (await res.json()) as { code?: string };
      code = problem.code ?? code;
    } catch {
      // ignore
    }
    throw new Error(`API ${res.status} ${code}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
