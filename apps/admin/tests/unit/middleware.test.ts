import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isUnsafePublicPageMethod, middleware } from '@/middleware';
import { COOKIE_NAMES } from '@/lib/cookies';
describe('isUnsafePublicPageMethod', () => {
  it('blocks POST requests to the public login page', () => {
    expect(isUnsafePublicPageMethod('/login', 'POST')).toBe(true);
  });

  it('allows normal navigation requests to the public login page', () => {
    expect(isUnsafePublicPageMethod('/login', 'GET')).toBe(false);
    expect(isUnsafePublicPageMethod('/login', 'HEAD')).toBe(false);
  });

  it('does not block authenticated page server actions outside public pages', () => {
    expect(isUnsafePublicPageMethod('/users', 'POST')).toBe(false);
  });
});

describe('middleware routing', () => {
  it('allows public prefix routes through', () => {
    const req = new NextRequest('http://localhost:3000/_next/static/chunks/main.js');
    const res = middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated users on protected paths to /login?next=...', () => {
    const req = new NextRequest('http://localhost:3000/products');
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?next=%2Fproducts');
  });

  it('redirects users with expired access but valid refresh token to /api/auth/refresh-redirect?next=...', () => {
    const req = new NextRequest('http://localhost:3000/products', {
      headers: { cookie: `${COOKIE_NAMES.refresh}=valid-refresh` },
    });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/api/auth/refresh-redirect?next=%2Fproducts');
  });

  it('redirects users with valid refresh token on /login to /api/auth/refresh-redirect?next=/', () => {
    const req = new NextRequest('http://localhost:3000/login', {
      headers: { cookie: `${COOKIE_NAMES.refresh}=valid-refresh` },
    });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/api/auth/refresh-redirect?next=%2F');
  });

  it('redirects authenticated users with access token on /login to /', () => {
    const req = new NextRequest('http://localhost:3000/login', {
      headers: { host: 'localhost:3000', cookie: `${COOKIE_NAMES.access}=valid-access` },
    });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('allows authenticated users with access token on protected paths through', () => {
    const req = new NextRequest('http://localhost:3000/products', {
      headers: { cookie: `${COOKIE_NAMES.access}=valid-access` },
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
