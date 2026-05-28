import type { Session } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';
import { issueRefreshToken } from './tokens.js';

export interface SessionContext {
  ip?: string;
  deviceInfo?: Record<string, unknown>;
}

export async function createSession(
  userId: string,
  ctx: SessionContext = {},
): Promise<{ session: Session; refreshToken: string }> {
  const prisma = getPrisma();
  const issued = issueRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: issued.hash,
      expiresAt: issued.expiresAt,
      ip: ctx.ip ?? null,
      deviceInfo: ctx.deviceInfo ?? null,
    },
  });
  return { session, refreshToken: issued.token };
}

export async function findActiveSessionByToken(token: string): Promise<Session | null> {
  const prisma = getPrisma();
  const hash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function rotateSession(
  oldToken: string,
): Promise<{ session: Session; refreshToken: string }> {
  const prisma = getPrisma();
  const current = await findActiveSessionByToken(oldToken);
  if (!current) throw new Error('session not found');
  const issued = issueRefreshToken();
  const [, session] = await prisma.$transaction([
    prisma.session.update({
      where: { id: current.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: current.userId,
        refreshTokenHash: issued.hash,
        expiresAt: issued.expiresAt,
        ip: current.ip,
        deviceInfo: current.deviceInfo ?? undefined,
      },
    }),
  ]);
  return { session, refreshToken: issued.token };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
