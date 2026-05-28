import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_ISSUER: z.string().default('pantry-api'),
  JWT_AUDIENCE: z.string().default('pantry-app'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Rate limiting (per 1-minute window). Kept configurable so tests can tune
  // them rather than disabling the limiter outright.
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  RATE_LIMIT_PER_USER_PER_MIN: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_PER_IP_PER_MIN: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_AUTH_PER_IP_PER_MIN: z.coerce.number().int().positive().default(10),

  TOTP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes base64'),

  GOOGLE_CLIENT_ID: z.string().min(1),
  APPLE_CLIENT_ID: z.string().min(1),
  APPLE_TEAM_ID: z.string().min(1),
  APPLE_KEY_ID: z.string().min(1),

  WEBAUTHN_RP_ID: z.string().min(1),
  WEBAUTHN_RP_NAME: z.string().min(1),
  WEBAUTHN_ORIGIN: z.string().url(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1),

  APP_DEEP_LINK: z.string().min(1),
  ADMIN_URL: z.string().url(),

  COUNTRY_DETECT_PRIMARY: z.string().url(),
  COUNTRY_DETECT_FALLBACK: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  logLevel: Env['LOG_LEVEL'];
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    accessTtlSeconds: number;
    issuer: string;
    audience: string;
    refreshTtlDays: number;
  };
  totp: { encryptionKey: Buffer };
  rateLimit: {
    enabled: boolean;
    perUserPerMin: number;
    perIpPerMin: number;
    authPerIpPerMin: number;
  };
  oauth: {
    googleClientId: string;
    appleClientId: string;
    appleTeamId: string;
    appleKeyId: string;
  };
  webauthn: { rpId: string; rpName: string; origin: string };
  smtp: { host: string; port: number; user?: string; pass?: string; from: string };
  frontend: { appDeepLink: string; adminUrl: string };
  countryDetect: { primary: string; fallback: string };
}

export function parseConfig(source: NodeJS.ProcessEnv | Record<string, unknown>): Config {
  const e = envSchema.parse(source);
  const smtp: Config['smtp'] = {
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    from: e.SMTP_FROM,
  };
  if (e.SMTP_USER !== undefined) smtp.user = e.SMTP_USER;
  if (e.SMTP_PASS !== undefined) smtp.pass = e.SMTP_PASS;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    jwt: {
      accessSecret: e.JWT_ACCESS_SECRET,
      accessTtlSeconds: e.JWT_ACCESS_TTL_SECONDS,
      issuer: e.JWT_ISSUER,
      audience: e.JWT_AUDIENCE,
      refreshTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    },
    totp: { encryptionKey: Buffer.from(e.TOTP_ENCRYPTION_KEY, 'base64') },
    rateLimit: {
      enabled: e.RATE_LIMIT_ENABLED,
      perUserPerMin: e.RATE_LIMIT_PER_USER_PER_MIN,
      perIpPerMin: e.RATE_LIMIT_PER_IP_PER_MIN,
      authPerIpPerMin: e.RATE_LIMIT_AUTH_PER_IP_PER_MIN,
    },
    oauth: {
      googleClientId: e.GOOGLE_CLIENT_ID,
      appleClientId: e.APPLE_CLIENT_ID,
      appleTeamId: e.APPLE_TEAM_ID,
      appleKeyId: e.APPLE_KEY_ID,
    },
    webauthn: { rpId: e.WEBAUTHN_RP_ID, rpName: e.WEBAUTHN_RP_NAME, origin: e.WEBAUTHN_ORIGIN },
    smtp,
    frontend: { appDeepLink: e.APP_DEEP_LINK, adminUrl: e.ADMIN_URL },
    countryDetect: { primary: e.COUNTRY_DETECT_PRIMARY, fallback: e.COUNTRY_DETECT_FALLBACK },
  };
}

let cached: Config | undefined;
export function getConfig(): Config {
  if (!cached) cached = parseConfig(process.env);
  return cached;
}

export function resetConfigForTests() {
  cached = undefined;
}
