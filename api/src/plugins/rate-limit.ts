import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { getConfig } from '../config.js';
import { getRedis } from '../redis.js';

// Local fallback typing for `req.user` used by the limiter's key/budget choice.
// The auth plugin (plugins/auth.ts) declares the canonical module augmentation.
type WithUser = FastifyRequest & { user?: { id: string; role: 'user' | 'admin' } };

export async function registerRateLimit(app: FastifyInstance) {
  const cfg = getConfig();
  await app.register(rateLimit, {
    global: true,
    // Authenticated callers get the higher per-user budget; anonymous traffic
    // is held to the stricter per-IP budget.
    max: (req) =>
      (req as WithUser).user?.id ? cfg.rateLimit.perUserPerMin : cfg.rateLimit.perIpPerMin,
    timeWindow: '1 minute',
    redis: getRedis(),
    // Digital Asset Links / AASA are polled by Google and must never 429.
    allowList: (req) =>
      typeof req.url === 'string' && req.url.startsWith('/.well-known/'),
    keyGenerator: (req) => {
      const u = (req as WithUser).user;
      return u?.id ? `user:rl:global:${u.id}` : `ip:rl:global:${req.ip}`;
    },
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true },
  });
}

/**
 * Per-route rate-limit config for the `/v1/auth/*` scope: a tighter per-IP budget
 * applied on top of the global limiter to slow credential-stuffing / brute force.
 * M0b spreads this into the route options when registering the auth plugin.
 */
export function authRateLimitConfig(_app: FastifyInstance): RouteShorthandOptions['config'] {
  const cfg = getConfig();
  return {
    rateLimit: {
      max: cfg.rateLimit.authPerIpPerMin,
      timeWindow: '1 minute',
      keyGenerator: (req: FastifyRequest) => `ip:rl:auth:${req.ip}`,
    },
  };
}
