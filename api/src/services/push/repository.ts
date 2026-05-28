import type { PushToken } from '@prisma/client';
import { getPrisma } from '../../db.js';

export async function upsertPushToken(input: {
  userId: string;
  expoPushToken: string;
  platform: 'ios' | 'android';
  deviceInfo?: Record<string, unknown> | undefined;
}): Promise<PushToken> {
  return getPrisma().pushToken.upsert({
    where: { expoPushToken: input.expoPushToken },
    create: {
      userId: input.userId,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
      deviceInfo: (input.deviceInfo ?? null) as never,
    },
    update: {
      userId: input.userId,
      platform: input.platform,
      deviceInfo: (input.deviceInfo ?? null) as never,
      lastUsedAt: new Date(),
      revokedAt: null,
    },
  });
}

export async function revokePushToken(userId: string, id: string): Promise<boolean> {
  const found = await getPrisma().pushToken.findFirst({ where: { id, userId } });
  if (!found) return false;
  await getPrisma().pushToken.update({ where: { id }, data: { revokedAt: new Date() } });
  return true;
}

export async function activeTokensForUser(userId: string): Promise<PushToken[]> {
  return getPrisma().pushToken.findMany({ where: { userId, revokedAt: null } });
}
