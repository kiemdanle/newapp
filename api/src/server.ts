import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import { idempotencyPlugin } from './plugins/idempotency.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth/index.js';
import { meRoutes } from './routes/me/index.js';
import { recordRoutes } from './routes/records/index.js';

const REDACT_PATHS = [
  'password',
  'passwordHash',
  'refreshToken',
  'accessToken',
  'totpSecret',
  'authorization',
  'req.headers.authorization',
];

export async function buildServer(): Promise<FastifyInstance> {
  const cfg = getConfig();
  const app: FastifyInstance = Fastify({
    logger: {
      level: cfg.logLevel,
      redact: { paths: REDACT_PATHS, remove: true },
      ...(cfg.env === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
            },
          }
        : {}),
    },
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    trustProxy: true,
    bodyLimit: 1_000_000, // 1 MB
  });

  await app.register(helmet, { global: true });
  await registerCors(app);
  // The auth plugin's onRequest hook must populate req.user BEFORE the rate
  // limiter runs so the limiter can pick the per-user vs per-IP budget.
  await app.register(authPlugin);
  await app.register(idempotencyPlugin);
  if (cfg.rateLimit.enabled) await registerRateLimit(app);
  await registerErrorHandler(app);

  app.addHook('onSend', async (req, reply) => {
    void reply.header('x-request-id', req.id);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(meRoutes, { prefix: '/v1/me' });
  await app.register(recordRoutes, { prefix: '/v1/records' });

  return app;
}

// Symlink-resilient entrypoint guard: under a symlinked deploy
// (/opt/pantry/current → /opt/pantry/releases/<sha>), Node resolves
// import.meta.url to the real path while process.argv[1] keeps the
// symlinked path, so a strict string comparison never matches.
// Compare resolved real paths instead.
const entrypointReal = realpathSync(process.argv[1] ?? '');
const moduleReal = realpathSync(fileURLToPath(import.meta.url));
if (entrypointReal === moduleReal) {
  const cfg = getConfig();
  const app = await buildServer();
  await app.listen({ port: cfg.port, host: cfg.host });
}
