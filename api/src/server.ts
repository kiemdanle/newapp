import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import { getConfig } from './config.js';
import { logger } from './logger.js';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';

export async function buildServer(): Promise<FastifyInstance> {
  const cfg = getConfig();
  const app = Fastify({
    loggerInstance: logger,
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    trustProxy: true,
    bodyLimit: 1_000_000, // 1 MB
  });

  await app.register(helmet, { global: true });
  await registerCors(app);
  if (cfg.rateLimit.enabled) await registerRateLimit(app);
  await registerErrorHandler(app);

  app.addHook('onSend', async (req, reply) => {
    void reply.header('x-request-id', req.id);
  });

  await app.register(healthRoutes);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = getConfig();
  const app = await buildServer();
  await app.listen({ port: cfg.port, host: cfg.host });
}
