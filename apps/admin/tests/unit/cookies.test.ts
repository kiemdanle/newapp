import { describe, expect, it } from 'vitest';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';

describe('cookies', () => {
  it('exposes stable cookie names', () => {
    expect(COOKIE_NAMES.access).toBe('pantry_admin_access');
    expect(COOKIE_NAMES.refresh).toBe('pantry_admin_refresh');
    expect(COOKIE_NAMES.csrf).toBe('pantry_admin_csrf');
  });

  it('builds an HTTP-only access cookie with a TTL', () => {
    const c = buildSetCookie({
      name: COOKIE_NAMES.access,
      value: 'a.b.c',
      maxAgeSec: 900,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    expect(c).toContain('pantry_admin_access=a.b.c');
    expect(c).toContain('Path=/');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Max-Age=900');
  });

  it('builds a non-HTTP-only CSRF cookie (readable by JS)', () => {
    const c = buildSetCookie({
      name: COOKIE_NAMES.csrf,
      value: 'csrf-token-value',
      maxAgeSec: 900,
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
    });
    expect(c).not.toContain('HttpOnly');
    expect(c).not.toContain('Secure');
  });

  it('builds an expiring delete cookie', () => {
    const c = buildSetCookie({
      name: COOKIE_NAMES.access,
      value: '',
      maxAgeSec: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    expect(c).toContain('Max-Age=0');
  });
});
