import { parseAuthDeepLink } from './linking';

describe('parseAuthDeepLink', () => {
  it('parses a reset-password link with token', () => {
    const r = parseAuthDeepLink('pantry://reset-password?token=abc');
    expect(r).toEqual({ kind: 'reset-password', token: 'abc' });
  });

  it('parses a verify-email link with token', () => {
    const r = parseAuthDeepLink('pantry://verify-email?token=xyz');
    expect(r).toEqual({ kind: 'verify-email', token: 'xyz' });
  });

  it('returns null for unrecognized links', () => {
    expect(parseAuthDeepLink('pantry://home')).toBeNull();
    expect(parseAuthDeepLink('https://example.com')).toBeNull();
  });

  it('returns null when the token is missing', () => {
    expect(parseAuthDeepLink('pantry://reset-password')).toBeNull();
  });
});
