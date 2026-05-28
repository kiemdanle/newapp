import pino from 'pino';
import { getConfig } from './config.js';

const cfg = (() => {
  try {
    return getConfig();
  } catch {
    return null;
  }
})();

export const logger = pino({
  level: cfg?.logLevel ?? process.env.LOG_LEVEL ?? 'info',
  ...(cfg?.env === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : {}),
  redact: {
    paths: [
      'password',
      'passwordHash',
      'refreshToken',
      'accessToken',
      'totpSecret',
      'authorization',
    ],
    remove: true,
  },
});
