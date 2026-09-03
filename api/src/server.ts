import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import { idempotencyPlugin } from './plugins/idempotency.js';
import { recordRateEvent } from './services/products/product-operational-health.js';
import { healthRoutes } from './routes/health.js';
import { wellKnownRoutes } from './routes/well-known.js';
import { authRoutes } from './routes/auth/index.js';
import { meRoutes } from './routes/me/index.js';
import { publicAvatarRoutes } from './routes/me/avatar.js';
import { publicProductMediaRoutes } from './routes/products/public-media.js';
import { productRoutes } from './routes/products/index.js';
import { editPrivateMediaRoute } from './routes/products/edit-private-media.js';
import { editMetadataRoute } from './routes/products/edit-metadata.js';
import { editPhotoUploadRoute } from './routes/products/edit-photo-upload.js';
import { editPhotoDeleteRoute } from './routes/products/edit-photo-delete.js';
import { editPhotoOrderRoute } from './routes/products/edit-photo-order.js';
import { editSubmitRoute } from './routes/products/edit-submit.js';
import { recordRoutes } from './routes/records/index.js';
import { reviewsRoutes } from './routes/reviews/index.js';
import { reportsRoutes } from './routes/reports/index.js';
import { dealsRoutes } from './routes/deals/index.js';
import { giveawaysRoutes } from './routes/giveaways/index.js';
import { userReputationRoute } from './routes/users/reputation.js';
import { referralRoutes } from './routes/referrals/index.js';
import { householdsRoutes } from './routes/households/index.js';
import { adminRoutes } from './routes/admin/index.js';
import { feedbackRoutes } from './routes/feedback/index.js';
import { apiErrorRecorderPlugin } from './plugins/api-error-recorder.js';
import { startWorkers, stopWorkers } from './workers/runner.js';
import { probeMediaCapabilities } from './services/products/product-image-processor.js';
import { installMediaFreezePolicy } from './services/products/product-media-freeze.js';

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
    // Nginx proxies from loopback and overwrites X-Forwarded-For with its
    // directly connected client address. Trust only those proxy addresses, never
    // a direct peer that could supply its own forwarding headers.
    trustProxy: ['127.0.0.1', '::1'],
    bodyLimit: 1_000_000, // 1 MB
  });

  await app.register(helmet, { global: true });
  await registerCors(app);
  // Separate from Fastify's global JSON `bodyLimit` above — multipart uploads are
  // capped independently at the configured media byte ceiling. `files`/`fields`/
  // `parts` allow a small amount of headroom above "exactly one file, no extra
  // parts" so a hostile second part surfaces to the route's own typed rejection
  // instead of a raw plugin-level FilesLimitError/PartsLimitError.
  await app.register(multipart, {
    limits: { fileSize: cfg.media.maxUploadBytes, files: 2, fields: 1, parts: 5 },
    throwFileSizeLimit: false,
  });
  // The auth plugin's onRequest hook must populate req.user BEFORE the rate
  // limiter runs so the limiter can pick the per-user vs per-IP budget.
  await app.register(authPlugin);
  await app.register(idempotencyPlugin);
  await app.register(apiErrorRecorderPlugin);
  if (cfg.rateLimit.enabled) await registerRateLimit(app);
  await registerErrorHandler(app);

  // Startup HEIC capability probe: a real decode attempt against a committed
  // fixture, not just a static libvips build flag (see product-image-processor.ts)
  // — cached after this first call, so every upload request reuses the result.
  await probeMediaCapabilities();

  // Wires the real (Redis-backed, cross-process) backup-freeze policy into
  // every `withMediaMutationLease` call — Phase 3 shipped only the always
  // -allow placeholder. See product-media-freeze.ts's header comment for why
  // this can't be an in-process flag.
  installMediaFreezePolicy();

  app.addHook('onSend', async (req, reply) => {
    void reply.header('x-request-id', req.id);
  });

  // Feeds the operational health payload's API 5xx rate (Task 7's
  // "API 5xx >2%/15m" alert threshold) — previously parsed into config with
  // no consumer anywhere. `onResponse` fires for every
  // completed request regardless of outcome, unlike apiErrorRecorderPlugin's
  // hook (which only fires for >=400 and persists individual rows for
  // inspection, a different concern from this cheap alerting counter).
  app.addHook('onResponse', async (_req, reply) => {
    await recordRateEvent('api5xx', 'total').catch(() => {});
    if (reply.statusCode >= 500) {
      await recordRateEvent('api5xx', 'failure').catch(() => {});
    }
  });

  await app.register(healthRoutes);
  await app.register(wellKnownRoutes);
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(meRoutes, { prefix: '/v1/me' });
  await app.register(publicAvatarRoutes, { prefix: '/v1' });
  await app.register(publicAvatarRoutes);
  await app.register(publicProductMediaRoutes, { prefix: '/v1' });
  await app.register(publicProductMediaRoutes);
  await app.register(productRoutes, { prefix: '/v1/products' });
  await app.register(editPrivateMediaRoute, { prefix: '/v1/product-edits' });
  await app.register(editMetadataRoute, { prefix: '/v1/product-edits' });
  await app.register(editPhotoUploadRoute, { prefix: '/v1/product-edits' });
  await app.register(editPhotoDeleteRoute, { prefix: '/v1/product-edits' });
  await app.register(editPhotoOrderRoute, { prefix: '/v1/product-edits' });
  await app.register(editSubmitRoute, { prefix: '/v1/product-edits' });
  await app.register(recordRoutes, { prefix: '/v1/records' });
  await app.register(reviewsRoutes, { prefix: '/v1' });
  await app.register(reportsRoutes, { prefix: '/v1' });
  await app.register(dealsRoutes, { prefix: '/v1' });
  await app.register(giveawaysRoutes, { prefix: '/v1' });
  await app.register(userReputationRoute, { prefix: '/v1' });
  await app.register(referralRoutes, { prefix: '/v1' });
  await app.register(householdsRoutes, { prefix: '/v1' });
  await app.register(feedbackRoutes, { prefix: '/v1' });
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
