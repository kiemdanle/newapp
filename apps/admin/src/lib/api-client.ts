import { COOKIE_NAMES } from './cookies';
import { CSRF_HEADER } from './csrf';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

export interface BrowserApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/**
 * Browser fetch wrapper. All requests hit the admin app's own Route Handlers
 * under `/api/...` (same origin); the handlers proxy to the Fastify API and
 * re-issue cookies as needed. Mutating methods carry the CSRF header.
 */
export async function apiBrowserFetch<T>(path: string, opts: BrowserApiOptions = {}): Promise<T> {
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
