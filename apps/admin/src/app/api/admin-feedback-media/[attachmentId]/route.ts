import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { COOKIE_NAMES } from '@/lib/cookies';
import { getAdminEnv } from '@/lib/env';

const paramsSchema = z.object({
  attachmentId: z.string().uuid(),
});

function errorResponse(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

/**
 * Same-origin, cookie-authenticated streaming proxy for private feedback attachments.
 * The admin browser never makes direct bearer-bearing requests to the API origin —
 * it requests this same-origin endpoint with its session cookie, and this route handler
 * makes the authenticated upstream call server-side.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attachmentId: string }> },
) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return errorResponse(404);
  const { attachmentId } = parsed.data;

  const cookieStore = await cookies();
  const access = cookieStore.get(COOKIE_NAMES.access)?.value;
  if (!access) return errorResponse(401);

  const env = getAdminEnv();
  const upstreamUrl = `${env.apiBaseUrl}/v1/feedback/attachments/${attachmentId}`;

  const ifNoneMatch = req.headers.get('if-none-match');
  const requestHeaders: Record<string, string> = {
    authorization: `Bearer ${access}`,
    accept: '*/*',
  };
  if (ifNoneMatch) requestHeaders['if-none-match'] = ifNoneMatch;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: requestHeaders,
      cache: 'no-store',
    });
  } catch {
    return errorResponse(502);
  }

  if (upstream.status === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'Cache-Control': 'private, no-cache',
        etag: upstream.headers.get('etag') ?? `"${attachmentId}"`,
      },
    });
  }

  if (upstream.type === 'opaqueredirect' || (upstream.status >= 300 && upstream.status < 400)) {
    return errorResponse(502);
  }

  if (!upstream.ok || !upstream.body) {
    return errorResponse(upstream.status);
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const contentDisposition =
    upstream.headers.get('content-disposition') ??
    `inline; filename="attachment-${attachmentId}"`;

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache',
      ...(upstream.headers.get('etag') ? { etag: upstream.headers.get('etag')! } : {}),
      ...(upstream.headers.get('content-length')
        ? { 'Content-Length': upstream.headers.get('content-length')! }
        : {}),
    },
  });
}
