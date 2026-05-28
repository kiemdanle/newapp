import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/config.js';

describe('config', () => {
  const valid = {
    NODE_ENV: 'test',
    PORT: '4000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://u:p@h:5432/d',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_ISSUER: 'pantry',
    JWT_AUDIENCE: 'pantry-app',
    REFRESH_TOKEN_TTL_DAYS: '30',
    TOTP_ENCRYPTION_KEY: Buffer.from('a'.repeat(32)).toString('base64'),
    RATE_LIMIT_ENABLED: 'true',
    RATE_LIMIT_PER_USER_PER_MIN: '60',
    RATE_LIMIT_PER_IP_PER_MIN: '30',
    RATE_LIMIT_AUTH_PER_IP_PER_MIN: '10',
    GOOGLE_CLIENT_ID: 'g',
    APPLE_CLIENT_ID: 'a',
    APPLE_TEAM_ID: 'T',
    APPLE_KEY_ID: 'K',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_RP_NAME: 'Pantry',
    WEBAUTHN_ORIGIN: 'http://localhost',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM: 't@e.x',
    APP_DEEP_LINK: 'pantry://',
    ADMIN_URL: 'http://localhost:3000',
    COUNTRY_DETECT_PRIMARY: 'https://ipapi.co',
    COUNTRY_DETECT_FALLBACK: 'http://ip-api.com',
  };

  it('parses a valid env', () => {
    const cfg = parseConfig(valid);
    expect(cfg.port).toBe(4000);
    expect(cfg.jwt.accessSecret).toHaveLength(32);
    expect(cfg.totp.encryptionKey).toBeInstanceOf(Buffer);
    expect(cfg.totp.encryptionKey.length).toBe(32);
    expect(cfg.rateLimit.enabled).toBe(true);
    expect(cfg.rateLimit.perUserPerMin).toBe(60);
    expect(cfg.rateLimit.perIpPerMin).toBe(30);
    expect(cfg.rateLimit.authPerIpPerMin).toBe(10);
  });

  it('rejects a JWT secret shorter than 32 bytes', () => {
    expect(() => parseConfig({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('rejects a TOTP key that decodes to less than 32 bytes', () => {
    expect(() =>
      parseConfig({ ...valid, TOTP_ENCRYPTION_KEY: Buffer.from('short').toString('base64') }),
    ).toThrow();
  });
});
