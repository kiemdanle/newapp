export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function problemResponse(code: string, status: number, title = 'Error'): Response {
  return new Response(JSON.stringify({ code, status, title }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

export function queueFetch(...responses: Response[]) {
  const fn = jest.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  (globalThis as any).fetch = fn;
  return fn;
}
