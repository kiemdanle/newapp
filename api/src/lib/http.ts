import { request } from 'undici';

export interface HttpJsonOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function getJson<T>(url: string, opts: HttpJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await request(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...(opts.headers ?? {}) },
      signal: controller.signal,
    });
    if (res.statusCode >= 500) {
      throw new HttpError(res.statusCode, `upstream ${res.statusCode}`);
    }
    if (res.statusCode === 404) {
      throw new HttpError(404, 'not found');
    }
    if (res.statusCode >= 400) {
      throw new HttpError(res.statusCode, `client error ${res.statusCode}`);
    }
    return (await res.body.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
