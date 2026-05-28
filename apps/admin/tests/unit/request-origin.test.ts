import { describe, it, expect } from 'vitest';
import { getPublicOrigin, buildPublicUrl } from '../../src/lib/request-origin';

function h(map: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(map)) headers.set(k, v);
  return headers;
}

describe('getPublicOrigin', () => {
  it('uses x-forwarded-host + x-forwarded-proto when present', () => {
    const headers = h({
      'x-forwarded-host': 'admin.linhkienkt.com',
      'x-forwarded-proto': 'https',
      host: '127.0.0.1:4001',
    });
    expect(getPublicOrigin(headers)).toBe('https://admin.linhkienkt.com');
  });

  it('falls back to host when x-forwarded-host is absent', () => {
    const headers = h({ host: 'admin.linhkienkt.com', 'x-forwarded-proto': 'https' });
    expect(getPublicOrigin(headers)).toBe('https://admin.linhkienkt.com');
  });

  it('defaults proto to http when no x-forwarded-proto', () => {
    const headers = h({ host: 'admin.linhkienkt.com' });
    expect(getPublicOrigin(headers)).toBe('http://admin.linhkienkt.com');
  });

  it('defaults host to localhost when nothing is provided', () => {
    expect(getPublicOrigin(h({}))).toBe('http://localhost');
  });
});

describe('buildPublicUrl', () => {
  it('appends path to the public origin', () => {
    const url = buildPublicUrl(
      h({ 'x-forwarded-host': 'admin.linhkienkt.com', 'x-forwarded-proto': 'https' }),
      '/login',
    );
    expect(url.toString()).toBe('https://admin.linhkienkt.com/login');
  });

  it('does NOT leak the bound HOSTNAME from the standalone server', () => {
    // Reproduces the bug: req.url would be http://localhost:4001/, but
    // forwarded headers carry the public domain. The helper must use the
    // headers, not req.url.
    const url = buildPublicUrl(
      h({ 'x-forwarded-host': 'admin.linhkienkt.com', 'x-forwarded-proto': 'https' }),
      '/login',
    );
    expect(url.host).not.toContain('localhost');
    expect(url.host).not.toContain('4001');
  });
});
