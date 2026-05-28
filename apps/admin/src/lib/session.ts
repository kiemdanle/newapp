// apps/admin/src/lib/session.ts
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, apiServerFetch } from './api';
import { COOKIE_NAMES } from './cookies';

export interface AdminMe {
  id: string;
  email: string;
  role: 'user' | 'admin';
  firstName: string;
  lastName: string;
}

/**
 * Server-side helper used by admin pages. Fetches /v1/auth/me; on 401 it hands
 * off to the /api/auth/refresh-redirect Route Handler (the only place cookies
 * may be written) which refreshes and returns to `next`. It also enforces
 * role === 'admin'. This function NEVER writes cookies — doing so during a
 * Server Component render is forbidden in Next.js 15 and causes a redirect loop.
 */
export async function requireAdminSession(currentPath = '/'): Promise<AdminMe> {
  try {
    const me = await apiServerFetch<AdminMe>('/v1/auth/me');
    if (me.role !== 'admin') redirect('/login');
    return me;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const cookieStore = await cookies();
      const hasRefresh = Boolean(cookieStore.get(COOKIE_NAMES.refresh)?.value);
      if (hasRefresh) {
        // Hand off to a Route Handler that may legally set cookies, then return here.
        redirect(`/api/auth/refresh-redirect?next=${encodeURIComponent(currentPath)}`);
      }
    }
    redirect('/login');
  }
}
