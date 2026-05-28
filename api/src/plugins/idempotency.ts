import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { getRedis } from '../redis.js';
import { AppError } from '../errors.js';
import { ERROR_CODES } from '@pantry/shared';

declare module 'fastify' {
  interface FastifyContextConfig {
    idempotent?: boolean | 'required';
  }
}

const TTL_SECONDS = 24 * 60 * 60;

function redisKey(url: string, key: string): string {
  // strip query string
  const path = url.split('?')[0] ?? url;
  return `idem:${path}:${key}`;
}

interface CachedResponse {
  status: number;
  body: string;
  contentType: string | undefined;
}

export const idempotencyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const cfg = req.routeOptions.config?.idempotent;
    if (!cfg) return;
    const key = req.headers['idempotency-key'];
    const keyStr = Array.isArray(key) ? key[0] : key;
    if (!keyStr) {
      if (cfg === 'required') {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Idempotency-Key header is required',
        });
      }
      return;
    }
    const redis = getRedis();
    const cached = await redis.get(redisKey(req.url, keyStr));
    if (cached) {
      const parsed = JSON.parse(cached) as CachedResponse;
      if (parsed.contentType) void reply.type(parsed.contentType);
      void reply.status(parsed.status).send(parsed.body);
      return reply;
    }
  });

  app.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload) => {
    const cfg = req.routeOptions.config?.idempotent;
    if (!cfg) return payload;
    const key = req.headers['idempotency-key'];
    const keyStr = Array.isArray(key) ? key[0] : key;
    if (!keyStr) return payload;
    if (reply.statusCode >= 500) return payload; // don't cache errors
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const cached: CachedResponse = {
      status: reply.statusCode,
      body,
      contentType: reply.getHeader('content-type')?.toString(),
    };
    await getRedis().setex(redisKey(req.url, keyStr), TTL_SECONDS, JSON.stringify(cached));
    return payload;
  });
});
