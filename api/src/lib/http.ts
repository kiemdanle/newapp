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

export interface HttpMetaResult<T> {
  data: T | null;
  status: number;
  headers: Record<string, string>;
  sizeBytes: number;
  rawTextPreview: string;
}

function sanitizeHeaders(rawHeaders: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (
      key === 'authorization' ||
      key === 'cookie' ||
      key === 'set-cookie' ||
      key.includes('token') ||
      key.includes('secret') ||
      key.includes('password')
    ) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = Array.isArray(v) ? v.join(', ') : String(v);
    }
  }
  return result;
}

export async function getJsonWithMeta<T>(url: string, opts: HttpJsonOptions): Promise<HttpMetaResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await request(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...(opts.headers ?? {}) },
      signal: controller.signal,
    });
    const text = await res.body.text();
    const sizeBytes = Buffer.byteLength(text, 'utf8');
    const rawTextPreview = text.slice(0, 4096);
    const headers = sanitizeHeaders(res.headers as Record<string, string | string[] | undefined>);
    let data: T | null = null;
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null;
    }
    return {
      data,
      status: res.statusCode,
      headers,
      sizeBytes,
      rawTextPreview,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson<T>(url: string, opts: HttpJsonOptions): Promise<T> {
  const meta = await getJsonWithMeta<T>(url, opts);
  if (meta.status >= 500) {
    throw new HttpError(meta.status, `upstream ${meta.status}`);
  }
  if (meta.status === 404) {
    throw new HttpError(404, 'not found');
  }
  if (meta.status >= 400) {
    throw new HttpError(meta.status, `client error ${meta.status}`);
  }
  return meta.data as T;
}
