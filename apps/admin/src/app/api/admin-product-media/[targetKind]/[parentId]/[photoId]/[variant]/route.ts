import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { COOKIE_NAMES } from '@/lib/cookies';
import { getAdminEnv } from '@/lib/env';

const paramsSchema = z.object({
  targetKind: z.enum(['product', 'edit']),
  parentId: z.string().uuid(),
  photoId: z.string().uuid(),
  variant: z.enum(['display', 'thumb']),
});

// Maps this proxy's own (parentId-agnostic) target kind onto the Phase 3 upstream
// path prefix that actually serves the bytes: a live product's approved-pending
// photo, or a staged revision's not-yet-approved photo.
const UPSTREAM_PREFIX: Record<'product' | 'edit', string> = {
  product: '/v1/products',
  edit: '/v1/product-edits',
};

// Never forward upstream body/headers on a non-2xx or failure — the only signal a
// caller needs is the status; forwarding an upstream problem+json body risks
// echoing detail that was only ever meant for a first-party API consumer, and
// this route's whole point is to never let anything upstream-shaped reach the
// browser directly.
function errorResponse(status: number): NextResponse {
  return new NextResponse(null, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/**
 * Same-origin, cookie-authenticated, no-store proxy for private product/edit
 * photo bytes. The admin browser never receives a bearer-bearing upstream URL —
 * it only ever requests this same-origin path with its own session cookie, and
 * this route makes the authenticated upstream call server-side. Upstream
 * (`/v1/products/:id/photos/:photoId/:variant` /
 * `/v1/product-edits/:id/photos/:photoId/:variant`) remains the sole authority on
 * visibility/role — this proxy adds no authorization logic of its own beyond a
 * cheap fail-fast when there is plainly no session cookie to forward (so it never
 * opens an upstream connection in that case). Bytes are streamed through, never
 * buffered, and served through `next/image`'s optimizer or a bearer-bearing URL.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return errorResponse(404);
  const { targetKind, parentId, photoId, variant } = parsed.data;

  const cookieStore = await cookies();
  const access = cookieStore.get(COOKIE_NAMES.access)?.value;
  if (!access) return errorResponse(401);

  const env = getAdminEnv();
  const upstreamUrl = `${env.apiBaseUrl}${UPSTREAM_PREFIX[targetKind]}/${parentId}/photos/${photoId}/${variant}`;

  const ifNoneMatch = req.headers.get('if-none-match');
  const requestHeaders: Record<string, string> = { authorization: `Bearer ${access}` };
  if (ifNoneMatch) requestHeaders['if-none-match'] = ifNoneMatch;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: requestHeaders,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return errorResponse(502);
  }

  if (upstream.status === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
        ...(upstream.headers.get('etag') ? { ETag: upstream.headers.get('etag')! } : {}),
      },
    });
  }

  if (upstream.type === 'opaqueredirect' || (upstream.status >= 300 && upstream.status < 400)) {
    return errorResponse(502);
  }
  if (!upstream.ok || !upstream.body) {
    return errorResponse(upstream.status);
  }

  const etag = upstream.headers.get('etag') ?? `"${photoId}-${variant}"`;
  const lastModified = upstream.headers.get('last-modified');

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
      ...(lastModified ? { 'Last-Modified': lastModified } : {}),
    },
  });
}
