import { randomBytes, createHash, randomInt } from 'node:crypto';

/** URL-safe base64 token of N random bytes. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Stable sha256 hex of a token, for storage and lookup. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
