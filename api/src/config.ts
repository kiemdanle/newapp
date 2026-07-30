import { existsSync, accessSync, constants as fsConstants } from 'node:fs';
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

  // Product media (Phase 3): filesystem root for private/public/quarantine trees and
  // the public base URL nginx serves `public/` from. Both are deployment-specific and
  // required (no default) — a missing value must fail boot rather than silently write
  // media into a release checkout or serve un-derivable public URLs. Numeric limits all
  // have explicit spec-mandated defaults but stay overridable for tests/ops tuning.
  MEDIA_ROOT: z.string().min(1),
  MEDIA_PUBLIC_BASE_URL: z.string().url(),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MEDIA_MAX_DECODED_MEGAPIXELS: z.coerce.number().int().positive().default(40),
  MEDIA_MAX_DIMENSION_PX: z.coerce.number().int().positive().default(12_000),
  MEDIA_MAX_CHANNELS: z.coerce.number().int().positive().default(4),
  MEDIA_MAX_DISPLAY_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
  MEDIA_MAX_THUMBNAIL_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  MEDIA_DISPLAY_MAX_DIMENSION_PX: z.coerce.number().int().positive().default(1600),
  MEDIA_THUMBNAIL_MAX_DIMENSION_PX: z.coerce.number().int().positive().default(480),
  MEDIA_PROCESSING_DEADLINE_MS: z.coerce.number().int().positive().default(30_000),
  MEDIA_SHARP_CONCURRENCY: z.coerce.number().int().positive().default(2),
  MEDIA_WEBP_QUALITY: z.coerce.number().int().min(1).max(100).default(82),
  // Redis-only capacity budget (soft abuse/exhaustion protection, not a durability
  // guarantee) — deployment-specific disk sizing, so defaults are conservative
  // placeholders operators are expected to tune, not spec-mandated numbers.
  MEDIA_CAPACITY_USABLE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024 * 1024),
  MEDIA_CAPACITY_RESERVE_BYTES: z.coerce.number().int().nonnegative().default(512 * 1024 * 1024),

  // reCAPTCHA Enterprise (Phase 7): server-side CreateAssessment for the
  // `submit_product` action. Android and iOS each require a distinct site key
  // (Google does not allow one key to cover both platforms) — no default for
  // any of these, since an unset value must fail boot rather than silently
  // accept every submission or call a nonexistent project.
  RECAPTCHA_PROJECT_ID: z.string().min(1),
  RECAPTCHA_SITE_KEY_ANDROID: z.string().min(1),
  RECAPTCHA_SITE_KEY_IOS: z.string().min(1),
  RECAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5),
  RECAPTCHA_ASSESSMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  // `product_creation` mode (Phase 7): `internal` cohort is admins plus this
  // environment-managed allowlist of user IDs. Optional/empty is valid — an
  // `internal`-mode deployment with no allowlist simply has no non-admin
  // internal cohort yet.
  PRODUCT_CREATION_INTERNAL_ALLOWLIST: z.string().optional(),
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
  media: {
    root: string;
    publicBaseUrl: string;
    maxUploadBytes: number;
    maxDecodedMegapixels: number;
    maxDimensionPx: number;
    maxChannels: number;
    maxDisplayBytes: number;
    maxThumbnailBytes: number;
    displayMaxDimensionPx: number;
    thumbnailMaxDimensionPx: number;
    processingDeadlineMs: number;
    sharpConcurrency: number;
    webpQuality: number;
    capacityUsableBytes: number;
    capacityReserveBytes: number;
  };
  recaptcha: {
    projectId: string;
    siteKeyAndroid: string;
    siteKeyIos: string;
    minScore: number;
    assessmentTimeoutMs: number;
  };
  productCreation: {
    internalAllowlist: string[];
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuidAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const ids = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  for (const id of ids) {
    if (!uuidPattern.test(id)) {
      throw new Error(`PRODUCT_CREATION_INTERNAL_ALLOWLIST contains a non-UUID entry: ${id}`);
    }
  }
  return ids;
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
    media: (() => {
      const root = resolve(e.MEDIA_ROOT);
      if (!existsSync(root)) {
        throw new Error(`MEDIA_ROOT does not exist: ${root}`);
      }
      try {
        accessSync(root, fsConstants.W_OK);
      } catch {
        throw new Error(`MEDIA_ROOT is not writable: ${root}`);
      }
      return {
        root,
        publicBaseUrl: e.MEDIA_PUBLIC_BASE_URL,
        maxUploadBytes: e.MEDIA_MAX_UPLOAD_BYTES,
        maxDecodedMegapixels: e.MEDIA_MAX_DECODED_MEGAPIXELS,
        maxDimensionPx: e.MEDIA_MAX_DIMENSION_PX,
        maxChannels: e.MEDIA_MAX_CHANNELS,
        maxDisplayBytes: e.MEDIA_MAX_DISPLAY_BYTES,
        maxThumbnailBytes: e.MEDIA_MAX_THUMBNAIL_BYTES,
        displayMaxDimensionPx: e.MEDIA_DISPLAY_MAX_DIMENSION_PX,
        thumbnailMaxDimensionPx: e.MEDIA_THUMBNAIL_MAX_DIMENSION_PX,
        processingDeadlineMs: e.MEDIA_PROCESSING_DEADLINE_MS,
        sharpConcurrency: e.MEDIA_SHARP_CONCURRENCY,
        webpQuality: e.MEDIA_WEBP_QUALITY,
        capacityUsableBytes: e.MEDIA_CAPACITY_USABLE_BYTES,
        capacityReserveBytes: e.MEDIA_CAPACITY_RESERVE_BYTES,
      };
    })(),
    recaptcha: {
      projectId: e.RECAPTCHA_PROJECT_ID,
      siteKeyAndroid: e.RECAPTCHA_SITE_KEY_ANDROID,
      siteKeyIos: e.RECAPTCHA_SITE_KEY_IOS,
      minScore: e.RECAPTCHA_MIN_SCORE,
      assessmentTimeoutMs: e.RECAPTCHA_ASSESSMENT_TIMEOUT_MS,
    },
    productCreation: {
      internalAllowlist: parseUuidAllowlist(e.PRODUCT_CREATION_INTERNAL_ALLOWLIST),
    },
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
