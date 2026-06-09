import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminRowSchema, adminInviteSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { hashPassword } from '../../../services/auth/passwords.js';

const paramsSchema = z.object({ id: z.string().uuid() });

function toRow(u: { id: string; email: string; firstName: string; lastName: string; totpEnabledAt: Date | null; createdAt: Date }) {
  return adminRowSchema.parse({
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
    totpEnabledAt: u.totpEnabledAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  });
}

export async function adminSettingsAdminsRoute(app: FastifyInstance) {
  app.get('/admins', async () => {
    const rows = await getPrisma().user.findMany({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' } });
    return { items: rows.map(toRow) };
  });

  app.post('/admins', async (req, reply) => {
    const input = adminInviteSchema.parse(req.body);
    const tempPass = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const user = await getPrisma().user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'admin',
        passwordHash: await hashPassword(tempPass),
      },
    });
    await req.auditLog('admin.invite', { type: 'user', id: user.id }, {
      before: null, after: { email: input.email, role: 'admin' },
    });
    return reply.status(201).send(toRow(user));
  });

  app.delete('/admins/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    if (id === req.user!.id) throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Cannot revoke yourself' });
    const user = await getPrisma().user.findUnique({ where: { id } });
    if (!user || user.role !== 'admin') throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Admin not found' });
    await getPrisma().user.update({ where: { id }, data: { role: 'user' } });
    await req.auditLog('admin.revoke', { type: 'user', id }, { before: { role: 'admin' }, after: { role: 'user' } });
    return reply.status(204).send();
  });
}
