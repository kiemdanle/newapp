import type { User } from '@prisma/client';
import type { User as ApiUser } from '@expyrico/shared';
import { getPrisma } from '../../db.js';

export function toApiUser(u: User): ApiUser {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerifiedAt !== null,
    firstName: u.firstName,
    lastName: u.lastName,
    country: u.country,
    avatarUrl: u.avatarUrl,
    role: u.role,
    status: u.status,
    themePreference: u.themePreference,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export async function findUserByEmail(email: string) {
  return getPrisma().user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function findUserById(id: string) {
  return getPrisma().user.findUnique({ where: { id } });
}

export async function touchLastSeen(id: string): Promise<void> {
  await getPrisma().user.update({ where: { id }, data: { lastSeenAt: new Date() } });
}
