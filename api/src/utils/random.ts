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

/**
 * Cryptographically secure random password generator.
 * Guarantees at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 symbol,
 * avoiding ambiguous characters like 0/O and 1/l/I for clean readability.
 */
export function randomSecurePassword(length = 16): string {
  const targetLength = Math.max(10, length);
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+[]{}';
  const all = upper + lower + digits + symbols;

  const sample = [
    upper[randomInt(0, upper.length)],
    lower[randomInt(0, lower.length)],
    digits[randomInt(0, digits.length)],
    symbols[randomInt(0, symbols.length)],
  ];

  while (sample.length < targetLength) {
    sample.push(all[randomInt(0, all.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = sample.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [sample[i], sample[j]] = [sample[j], sample[i]];
  }

  return sample.join('');
}
