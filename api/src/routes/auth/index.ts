import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { registerRoute } from './register.js';
import { loginRoute } from './login.js';
import { refreshRoute } from './refresh.js';

export async function authRoutes(app: FastifyInstance) {
  const cfg = getConfig();
  if (cfg.rateLimit.enabled) {
    // Encapsulated to this plugin scope → only affects /v1/auth/* routes.
    await app.register(rateLimit, {
      max: cfg.rateLimit.authPerIpPerMin,
      timeWindow: '1 minute',
      redis: getRedis(),
      nameSpace: 'rl:auth:',
      keyGenerator: (req) => `ip:${req.ip}`,
    });
  }
  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.register(refreshRoute);
}
