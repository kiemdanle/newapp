import { describe, expect, it } from 'vitest';
import { encrypt, decrypt } from '../../src/utils/encryption.js';

describe('encryption', () => {
  const key = Buffer.from('a'.repeat(32));

  it('round-trips a value', () => {
    const cipher = encrypt('hello world', key);
    expect(cipher).not.toContain('hello');
    expect(decrypt(cipher, key)).toBe('hello world');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    expect(encrypt('x', key)).not.toBe(encrypt('x', key));
  });

  it('rejects tampered ciphertext', () => {
    const cipher = encrypt('hello', key);
    const parts = cipher.split('.');
    parts[2] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
  });
});
