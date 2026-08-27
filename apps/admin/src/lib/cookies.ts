export const COOKIE_NAMES = {
  access: 'pantry_admin_access',
  refresh: 'pantry_admin_refresh',
  csrf: 'pantry_admin_csrf',
  trustedDevice: 'pantry_admin_trusted_device',
} as const;

export const ACCESS_MAX_AGE_SEC = 60 * 15; // 15 minutes
export const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 365 days (sliding window)
export const TRUSTED_DEVICE_MAX_AGE_SEC = 60 * 60 * 24 * 60; // 60 days

export interface SetCookieOptions {
  name: string;
  value: string;
  maxAgeSec: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain?: string | undefined;
  path?: string | undefined;
}

export function buildSetCookie(opts: SetCookieOptions): string {
  const parts: string[] = [`${opts.name}=${opts.value}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  parts.push(`Max-Age=${opts.maxAgeSec}`);
  parts.push(`SameSite=${opts.sameSite.charAt(0).toUpperCase()}${opts.sameSite.slice(1)}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join('; ');
}
