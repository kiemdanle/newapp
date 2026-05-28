import { randomUUID } from 'node:crypto';
import { getPrisma } from '../../src/db.js';

export async function makeUser(
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    role: 'user' | 'admin';
  }> = {},
) {
  const prisma = getPrisma();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `u-${randomUUID()}@test.local`,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
      emailVerifiedAt: overrides.emailVerified ? new Date() : null,
      role: overrides.role ?? 'user',
    },
  });
}
