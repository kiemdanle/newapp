import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/services/auth/passwords.js';

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('S3cret-passw0rd!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('S3cret-passw0rd!', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong horse battery staple', hash)).toBe(false);
  });

  it('returns false on a malformed hash without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-real-hash')).toBe(false);
  });
});
