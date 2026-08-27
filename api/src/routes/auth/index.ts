import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { registerRoute } from './register.js';
import { loginRoute } from './login.js';
import { refreshRoute } from './refresh.js';
import { logoutRoute } from './logout.js';
import { meRoute } from './me.js';
import { verifyEmailRoute } from './verify-email.js';
import { resendVerificationRoute } from './resend-verification.js';
import { forgotPasswordRoute } from './forgot-password.js';
import { verifyResetCodeRoute } from './verify-reset-code.js';
import { resetPasswordRoute } from './reset-password.js';
import { oauthGoogleRoute } from './oauth-google.js';
import { oauthAppleRoute } from './oauth-apple.js';
import { passkeyRegisterRoute } from './passkey-register.js';
import { passkeyLoginRoute } from './passkey-login.js';
import { totpRoutes } from './totp.js';

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
      allowList: (req) => {
        // Authenticated calls (e.g. /v1/auth/me) and session endpoints do not belong
        // to the 10/min brute-force limit. They are protected by the global rate limiter.
        if ((req as FastifyRequest & { user?: { id: string } }).user?.id) return true;
        const url = typeof req.url === 'string' ? req.url : '';
        return url.endsWith('/me') || url.includes('/me?') || url.endsWith('/logout');
      },
    });
  }
  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.register(refreshRoute);
  await app.register(logoutRoute);
  await app.register(meRoute);
  await app.register(verifyEmailRoute);
  await app.register(resendVerificationRoute);
  await app.register(forgotPasswordRoute);
  await app.register(verifyResetCodeRoute);
  await app.register(resetPasswordRoute);
  await app.register(oauthGoogleRoute);
  await app.register(oauthAppleRoute);
  await app.register(passkeyRegisterRoute);
  await app.register(passkeyLoginRoute);
  await app.register(totpRoutes);
}
