import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../../../db.js';
import { revokeAllSessions } from '../../../services/auth/sessions.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersRevokeSessionsRoute(app: FastifyInstance) {
  app.post('/:id/sessions/revoke-all', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const beforeActive = await getPrisma().session.count({ where: { userId: id, revokedAt: null } });
    await revokeAllSessions(id);
    await req.auditLog('user.sessions.revoke_all', { type: 'user', id }, {
      before: { activeSessions: beforeActive }, after: { activeSessions: 0 },
    });
    return { revoked: beforeActive };
  });
}
