import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findActiveSessionByToken, revokeSession } from '../../services/auth/sessions.js';

// Best-effort logout: body may be empty (older clients) or carry refreshToken.
const logoutBodySchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .passthrough()
  .optional()
  .default({});

export async function logoutRoute(app: FastifyInstance) {
  app.post('/logout', async (req, reply) => {
    const input = logoutBodySchema.parse(req.body ?? {});
    if (input.refreshToken) {
      const session = await findActiveSessionByToken(input.refreshToken);
      if (session) await revokeSession(session.id);
    }
    return reply.status(204).send();
  });
}
