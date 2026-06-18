import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import { verifyAccessToken } from '../services/auth/tokens.js';
import { findUserById } from '../services/users/repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; role: 'user' | 'admin' };
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function attachUser(req: FastifyRequest): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return;
  const token = auth.slice('Bearer '.length);
  try {
    const claims = await verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role };
  } catch {
    // ignore — handler decides whether auth was required
  }
}

const authPluginImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', attachUser);

  app.decorate('requireAuth', async (req: FastifyRequest) => {
    if (!req.user) {
      throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    }
    const user = await findUserById(req.user.id);
    if (!user || user.status !== 'active') {
      throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    }
  });

  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(req, reply);
    if (req.user?.role !== 'admin') {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Forbidden' });
    }
  });
};

export const authPlugin = fp(authPluginImpl, { name: 'auth' });
