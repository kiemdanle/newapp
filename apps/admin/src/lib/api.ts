import { cookies } from 'next/headers';
import { COOKIE_NAMES } from './cookies';
import { getAdminEnv } from './env';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string | undefined,
  ) {
    super(`API ${status} ${code}`);
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Override or extend headers; Authorization is set automatically when an access cookie exists. */
  headers?: Record<string, string>;
}

/**
 * Server-side fetch wrapper for the admin app. Reads the access-token cookie
 * and forwards it as a Bearer token to the Fastify API. Throws ApiError on
 * non-2xx responses.
 */
export async function apiServerFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  const access = cookieStore.get(COOKIE_NAMES.access)?.value;

  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    ...(opts.headers ?? {}),
  };
  if (access && !headers.authorization) headers.authorization = `Bearer ${access}`;

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    cache: 'no-store',
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  const res = await fetch(`${env.apiBaseUrl}${path}`, init);

  if (!res.ok) {
    let code = 'unknown_error';
    let detail: string | undefined;
    try {
      const problem = (await res.json()) as { code?: string; detail?: string };
      code = problem.code ?? code;
      detail = problem.detail;
    } catch {
      // body wasn't problem+json
    }
    throw new ApiError(res.status, code, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
