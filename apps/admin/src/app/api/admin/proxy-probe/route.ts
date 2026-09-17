import { NextResponse } from 'next/server';
import { serverAdminApi } from '@/lib/admin-api';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await serverAdminApi.system.googleMapsProbe(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
