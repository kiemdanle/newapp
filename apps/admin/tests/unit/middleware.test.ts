import { describe, expect, it } from 'vitest';
import { isUnsafePublicPageMethod } from '@/middleware';

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
