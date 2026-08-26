import type { PushToken } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../../db.js';

export class PushTokenOwnershipError extends Error {
  constructor() {
    super('Device token is already registered to another account');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function upsertPushToken(input: {
  userId: string;
  deviceToken: string;
  platform: 'ios' | 'android';
  deviceInfo?: Record<string, unknown> | undefined;
}): Promise<PushToken> {
  const prisma = getPrisma();
  const existing = await prisma.pushToken.findUnique({ where: { deviceToken: input.deviceToken } });

  if (existing) {
    // Reassign ownership to the currently authenticated user and unrevoke the token
    return prisma.pushToken.update({
      where: { id: existing.id },
      data: {
        userId: input.userId,
        platform: input.platform,
        deviceInfo: (input.deviceInfo ?? null) as never,
        lastUsedAt: new Date(),
        revokedAt: null,
      },
    });
  }

  try {
    return await prisma.pushToken.create({
      data: {
        userId: input.userId,
        deviceToken: input.deviceToken,
        platform: input.platform,
        deviceInfo: (input.deviceInfo ?? null) as never,
      },
    });
  } catch (error) {
    // Concurrent create of the same token: re-update ownership instead of 500.
    if (!isUniqueViolation(error)) throw error;
    return prisma.pushToken.update({
      where: { deviceToken: input.deviceToken },
      data: {
        userId: input.userId,
        platform: input.platform,
        deviceInfo: (input.deviceInfo ?? null) as never,
        lastUsedAt: new Date(),
        revokedAt: null,
      },
    });
  }
}

export async function revokePushToken(userId: string, id: string): Promise<boolean> {
  const found = await getPrisma().pushToken.findFirst({ where: { id, userId } });
  if (!found) return false;
  await getPrisma().pushToken.update({ where: { id }, data: { revokedAt: new Date() } });
  return true;
}

export async function revokePushTokenById(id: string): Promise<void> {
  await getPrisma().pushToken.update({ where: { id }, data: { revokedAt: new Date() } });
}

export async function revokePushTokenByDeviceToken(userId: string, deviceToken: string): Promise<boolean> {
  const prisma = getPrisma();
  const found = await prisma.pushToken.findFirst({ where: { userId, deviceToken } });
  if (!found) return false;
  await prisma.pushToken.update({ where: { id: found.id }, data: { revokedAt: new Date() } });
  return true;
}

export async function activeTokensForUser(userId: string): Promise<PushToken[]> {
  return getPrisma().pushToken.findMany({ where: { userId, revokedAt: null } });
}
