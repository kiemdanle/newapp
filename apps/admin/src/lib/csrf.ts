import { randomBytes, timingSafeEqual } from 'node:crypto';

export { CSRF_HEADER } from './csrf-constants';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isCsrfValid(
  cookieValue: string | undefined,
  headerValue: string | undefined,
): boolean {
  if (!cookieValue || !headerValue) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
