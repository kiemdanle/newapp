import { describe, expect, it } from 'vitest';
import { parseAdminEnv } from '@/lib/env';

describe('parseAdminEnv', () => {
  const base = {
    API_BASE_URL: 'http://localhost:4000',
    COOKIE_SECURE: 'false',
    COOKIE_DOMAIN: '',
    NODE_ENV: 'development',
  };

  it('parses a valid env', () => {
    const cfg = parseAdminEnv(base);
    expect(cfg.apiBaseUrl).toBe('http://localhost:4000');
    expect(cfg.cookieSecure).toBe(false);
    expect(cfg.cookieDomain).toBeUndefined();
  });

  it('coerces COOKIE_SECURE=true', () => {
    expect(parseAdminEnv({ ...base, COOKIE_SECURE: 'true' }).cookieSecure).toBe(true);
  });

  it('rejects a non-URL API_BASE_URL', () => {
    expect(() => parseAdminEnv({ ...base, API_BASE_URL: 'not-a-url' })).toThrow();
  });
});
