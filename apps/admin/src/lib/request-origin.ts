// Resolves the public origin (scheme + host) for the current request when the
// admin server runs behind nginx. The Next.js standalone server binds to
// HOSTNAME=127.0.0.1 PORT=4001, which makes `req.nextUrl` and `req.url` carry
// `localhost:4001` instead of the public domain. Build redirect targets from
// the forwarded headers so Location points at the public host.
type HeaderSource = Headers | { get(name: string): string | null };

export function getPublicOrigin(headers: HeaderSource): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost';
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export function buildPublicUrl(headers: HeaderSource, path: string, search?: string): URL {
  const url = new URL(path, getPublicOrigin(headers));
  if (search) url.search = search;
  return url;
}
