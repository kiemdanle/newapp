import type { Prisma, AdminTrustedDevice } from '@prisma/client';
import prismaPkg from '@prisma/client';
const PrismaRuntime = prismaPkg.Prisma;
import { getPrisma } from '../../db.js';
import { hashToken, randomToken } from '../../utils/random.js';

export const TRUSTED_DEVICE_TTL_DAYS = 60;
export const TRUSTED_DEVICE_TTL_MS = TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface DeviceContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface IssuedTrustedDevice {
  token: string;
  expiresAt: Date;
  device: AdminTrustedDevice;
}

/**
 * Generates a 32-byte cryptographically secure token, persists its SHA-256
 * hash with a 60-day expiry, and returns the raw token to set in the admin cookie.
 */
export async function issueTrustedDeviceToken(
  userId: string,
  ctx: DeviceContext = {},
): Promise<IssuedTrustedDevice> {
  const prisma = getPrisma();
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS);

  const data: Prisma.AdminTrustedDeviceUncheckedCreateInput = {
    userId,
    tokenHash,
    ip: ctx.ip ?? null,
    deviceInfo: ctx.userAgent
      ? { userAgent: ctx.userAgent }
      : PrismaRuntime.JsonNull,
    expiresAt,
  };

  const device = await prisma.adminTrustedDevice.create({ data });
  return { token, expiresAt, device };
}

/**
 * Validates whether the provided raw token corresponds to an active, non-revoked,
 * non-expired trusted device strictly bound to the authenticating admin userId.
 * On match, updates lastUsedAt and IP address.
 */
export async function verifyTrustedDeviceToken(
  userId: string,
  rawToken?: string | null,
  ctx: DeviceContext = {},
): Promise<boolean> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    return false;
  }

  const prisma = getPrisma();
  const tokenHash = hashToken(rawToken);

  const device = await prisma.adminTrustedDevice.findUnique({
    where: { tokenHash },
  });

  if (!device) return false;
  if (device.userId !== userId) return false;
  if (device.revokedAt) return false;
  if (device.expiresAt.getTime() <= Date.now()) return false;

  // Stamped asynchronously on successful match
  await prisma.adminTrustedDevice
    .update({
      where: { id: device.id },
      data: {
        lastUsedAt: new Date(),
        ip: ctx.ip ?? device.ip,
      },
    })
    .catch(() => undefined);

  return true;
}

/**
 * Returns all active (non-revoked, non-expired) trusted devices for an admin.
 */
export async function listAdminTrustedDevices(
  userId: string,
): Promise<AdminTrustedDevice[]> {
  const prisma = getPrisma();
  return prisma.adminTrustedDevice.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Explicitly revokes a single trusted device for an admin.
 */
export async function revokeTrustedDevice(
  id: string,
  userId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.adminTrustedDevice.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Revokes all trusted devices for a user (called on password change, reset,
 * suspension, or admin role demotion).
 */
export async function revokeAllTrustedDevices(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.adminTrustedDevice.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
