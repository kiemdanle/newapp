import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
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
  // Primary WebAuthn origin (web URL or android:apk-key-hash:…).
  WEBAUTHN_ORIGIN: z.string().min(1),
  // Optional comma-separated extra origins accepted during verify (native apps
  // use android:apk-key-hash:<base64url-sha256> / iOS uses https://<rp-id>).
  WEBAUTHN_ADDITIONAL_ORIGINS: z.string().optional(),
  // Optional Digital Asset Links / AASA payload for passkey domain association.
  // Comma-separated SHA-256 fingerprints of Android signing certs (colon-hex).
  ANDROID_PACKAGE_NAME: z.string().min(1).default('com.expyrico.app'),
  ANDROID_SHA256_CERT_FINGERPRINTS: z.string().optional(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1),

  ADMIN_URL: z.string().url(),

  COUNTRY_DETECT_PRIMARY: z.string().url(),
  COUNTRY_DETECT_FALLBACK: z.string().url(),

  // Production FCM uses Google Application Default Credentials. The project ID
  // is explicit so a missing/misrouted deployment fails during config parsing.
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CREDENTIAL_MODE: z.enum(['workload_identity', 'service_account_file']).default('workload_identity'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
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
  webauthn: {
    rpId: string;
    rpName: string;
    /** @deprecated Prefer `origins`; kept as the first configured origin. */
    origin: string;
    origins: string[];
  };
  android: {
    packageName: string;
    sha256CertFingerprints: string[];
  };
  smtp: { host: string; port: number; user?: string; pass?: string; from: string };
  frontend: { adminUrl: string };
  countryDetect: { primary: string; fallback: string };
  firebase: {
    projectId: string;
    credentialMode: 'workload_identity' | 'service_account_file';
    credentialsPath?: string;
  };
}

function parseOriginList(...parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.split(',')) {
      const origin = raw.trim();
      if (!origin || seen.has(origin)) continue;
      if (!origin.startsWith('android:apk-key-hash:')) {
        try {
          // eslint-disable-next-line no-new
          new URL(origin);
        } catch {
          throw new Error(`Invalid WEBAUTHN origin: ${origin}`);
        }
      }
      seen.add(origin);
      out.push(origin);
    }
  }
  if (out.length === 0) throw new Error('At least one WEBAUTHN origin is required');
  return out;
}

function parseSha256Fingerprints(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
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

  const firebase: Config['firebase'] = {
    projectId: e.FIREBASE_PROJECT_ID,
    credentialMode: e.FIREBASE_CREDENTIAL_MODE,
  };
  if (e.FIREBASE_CREDENTIAL_MODE === 'service_account_file') {
    if (!e.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required when FIREBASE_CREDENTIAL_MODE=service_account_file');
    }
    const credentialsPath = resolve(e.GOOGLE_APPLICATION_CREDENTIALS);
    if (!existsSync(credentialsPath)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS does not exist: ${credentialsPath}`);
    }
    firebase.credentialsPath = credentialsPath;
  }

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
    webauthn: (() => {
      const origins = parseOriginList(e.WEBAUTHN_ORIGIN, e.WEBAUTHN_ADDITIONAL_ORIGINS);
      return {
        rpId: e.WEBAUTHN_RP_ID,
        rpName: e.WEBAUTHN_RP_NAME,
        origin: origins[0]!,
        origins,
      };
    })(),
    android: {
      packageName: e.ANDROID_PACKAGE_NAME,
      sha256CertFingerprints: parseSha256Fingerprints(e.ANDROID_SHA256_CERT_FINGERPRINTS),
    },
    smtp,
    frontend: { adminUrl: e.ADMIN_URL },
    countryDetect: { primary: e.COUNTRY_DETECT_PRIMARY, fallback: e.COUNTRY_DETECT_FALLBACK },
    firebase,
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
