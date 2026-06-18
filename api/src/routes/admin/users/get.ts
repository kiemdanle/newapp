import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminUserDetailSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });
    const [recordCount, reviewCount, openReportsAgainst, sessions] = await Promise.all([
      prisma.record.count({ where: { userId: id } }),
      prisma.review.count({ where: { userId: id } }),
      prisma.report.count({ where: { targetType: 'user', targetId: id, status: 'open' } }),
      prisma.session.findMany({ where: { userId: id }, orderBy: { expiresAt: 'desc' }, take: 20 }),
    ]);
    return adminUserDetailSchema.parse({
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      country: user.country, role: user.role, status: user.status,
      createdAt: user.createdAt.toISOString(), lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      totpEnabledAt: user.totpEnabledAt?.toISOString() ?? null,
      recordCount, reviewCount, openReportsAgainst,
      sessions: sessions.map((s) => ({
        id: s.id, ip: s.ip, deviceInfo: (s.deviceInfo as Record<string, unknown>) ?? null,
        expiresAt: s.expiresAt.toISOString(), revokedAt: s.revokedAt?.toISOString() ?? null,
      })),
    });
  });
}
