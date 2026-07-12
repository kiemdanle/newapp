import { getPrisma } from '../../src/db.js';
import { hashPassword } from '../../src/services/auth/passwords.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

export async function makeAdmin(overrides: Partial<{ email: string; firstName: string; lastName: string }> = {}) {
  const email = overrides.email ?? `admin-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const admin = await getPrisma().user.create({
    data: {
      email,
      passwordHash: await hashPassword('correct-horse-battery-staple'),
      firstName: overrides.firstName ?? 'Ada',
      lastName: overrides.lastName ?? 'Lovelace',
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });
  const token = await issueAccessToken({ sub: admin.id, role: 'admin', tokenVersion: admin.tokenVersion });
  return { admin, headers: { authorization: `Bearer ${token}` } };
}

export async function makeUserForAdmin(overrides: Partial<{
  email: string;
  status: 'active' | 'suspended' | 'deleted';
  country: string;
}> = {}) {
  const email = overrides.email ?? `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  return getPrisma().user.create({
    data: {
      email,
      passwordHash: await hashPassword('correct-horse-battery-staple'),
      firstName: 'Reg',
      lastName: 'User',
      role: 'user',
      status: overrides.status ?? 'active',
      country: overrides.country ?? 'US',
      emailVerifiedAt: new Date(),
    },
  });
}
