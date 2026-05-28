import type { FastifyInstance } from 'fastify';
import { refreshSchema } from '@pantry/shared';
import {
  findActiveSessionByToken,
  revokeSession,
} from '../../services/auth/sessions.js';

export async function logoutRoute(app: FastifyInstance) {
  app.post('/logout', async (req, reply) => {
    const input = refreshSchema.parse(req.body);
    const session = await findActiveSessionByToken(input.refreshToken);
    if (session) await revokeSession(session.id);
    return reply.status(204).send();
  });
}
