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
import { productRoutes } from './routes/products/index.js';
import { recordRoutes } from './routes/records/index.js';
import { reviewsRoutes } from './routes/reviews/index.js';
import { reportsRoutes } from './routes/reports/index.js';
import { dealsRoutes } from './routes/deals/index.js';
import { giveawaysRoutes } from './routes/giveaways/index.js';
import { userReputationRoute } from './routes/users/reputation.js';
import { referralRoutes } from './routes/referrals/index.js';
import { householdsRoutes } from './routes/households/index.js';
import { adminRoutes } from './routes/admin/index.js';
import { apiErrorRecorderPlugin } from './plugins/api-error-recorder.js';
import { startWorkers, stopWorkers } from './workers/runner.js';

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
  await app.register(apiErrorRecorderPlugin);
  if (cfg.rateLimit.enabled) await registerRateLimit(app);
  await registerErrorHandler(app);

  app.addHook('onSend', async (req, reply) => {
    void reply.header('x-request-id', req.id);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(meRoutes, { prefix: '/v1/me' });
  await app.register(productRoutes, { prefix: '/v1/products' });
  await app.register(recordRoutes, { prefix: '/v1/records' });
  await app.register(reviewsRoutes, { prefix: '/v1' });
  await app.register(reportsRoutes, { prefix: '/v1' });
  await app.register(dealsRoutes, { prefix: '/v1' });
  await app.register(giveawaysRoutes, { prefix: '/v1' });
  await app.register(userReputationRoute, { prefix: '/v1' });
  await app.register(referralRoutes, { prefix: '/v1' });
  await app.register(householdsRoutes, { prefix: '/v1' });
  await app.register(adminRoutes, { prefix: '/v1/admin' });

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
  startWorkers();
  app.addHook('onClose', async () => {
    await stopWorkers();
  });
  await app.listen({ port: cfg.port, host: cfg.host });
}
