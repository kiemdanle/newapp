// apps/admin/src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { apiServerFetch, ApiError } from '@/lib/api';

export async function GET() {
  try {
    const me = await apiServerFetch<unknown>('/v1/auth/me');
    return NextResponse.json(me);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { code: err.code, detail: err.detail },
        { status: err.status },
      );
    }
    return NextResponse.json({ code: 'internal_error' }, { status: 500 });
  }
}
