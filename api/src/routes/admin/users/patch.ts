import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminUserPatchSchema, adminUserRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersPatchRoute(app: FastifyInstance) {
  app.patch('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminUserPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });
    const after = await prisma.user.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      },
    });
    const beforeDiff: Record<string, unknown> = {};
    const afterDiff: Record<string, unknown> = {};
    for (const k of Object.keys(input) as (keyof typeof input)[]) {
      beforeDiff[k] = (before as Record<string, unknown>)[k];
      afterDiff[k] = (after as Record<string, unknown>)[k];
    }
    await req.auditLog('user.update', { type: 'user', id }, { before: beforeDiff, after: afterDiff });
    return adminUserRowSchema.parse({
      id: after.id, email: after.email, firstName: after.firstName, lastName: after.lastName,
      country: after.country, role: after.role, status: after.status,
      createdAt: after.createdAt.toISOString(), lastSeenAt: after.lastSeenAt?.toISOString() ?? null,
    });
  });
}
