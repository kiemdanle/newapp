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
    ADMIN_URL: 'http://localhost:3000',
    COUNTRY_DETECT_PRIMARY: 'https://ipapi.co',
    COUNTRY_DETECT_FALLBACK: 'http://ip-api.com',
    FIREBASE_PROJECT_ID: 'expyrico-test',
    FIREBASE_CREDENTIAL_MODE: 'workload_identity',
    MEDIA_ROOT: '/tmp',
    MEDIA_PUBLIC_BASE_URL: 'https://media.expyrico.test',
    RECAPTCHA_PROJECT_ID: 'expyrico-test',
    RECAPTCHA_SITE_KEY_ANDROID: 'site-key-android',
    RECAPTCHA_SITE_KEY_IOS: 'site-key-ios',
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

  it('requires GOOGLE_APPLICATION_CREDENTIALS for service_account_file mode', () => {
    expect(() =>
      parseConfig({
        ...valid,
        FIREBASE_CREDENTIAL_MODE: 'service_account_file',
      }),
    ).toThrow(/GOOGLE_APPLICATION_CREDENTIALS is required/);
  });

  it('rejects a missing service account credentials path', () => {
    expect(() =>
      parseConfig({
        ...valid,
        FIREBASE_CREDENTIAL_MODE: 'service_account_file',
        GOOGLE_APPLICATION_CREDENTIALS: '/tmp/does-not-exist-firebase.json',
      }),
    ).toThrow(/does not exist/);
  });

  it('parses additional WebAuthn origins and Android asset-link fingerprints', () => {
    const cfg = parseConfig({
      ...valid,
      WEBAUTHN_ORIGIN: 'https://api.example.com',
      WEBAUTHN_ADDITIONAL_ORIGINS:
        'android:apk-key-hash:NLZkeczh53uWVb671-fChbNCjLYITNizt7hx13uuIco,https://api.example.com',
      ANDROID_PACKAGE_NAME: 'com.expyrico.app',
      ANDROID_SHA256_CERT_FINGERPRINTS:
        '34:B6:64:79:CC:E1:E7:7B:96:55:BE:BB:D7:E7:C2:85:B3:42:8C:B6:08:4C:D8:B3:B7:B8:71:D7:7B:AE:21:CA',
    });
    expect(cfg.webauthn.origin).toBe('https://api.example.com');
    expect(cfg.webauthn.origins).toEqual([
      'https://api.example.com',
      'android:apk-key-hash:NLZkeczh53uWVb671-fChbNCjLYITNizt7hx13uuIco',
    ]);
    expect(cfg.android.packageName).toBe('com.expyrico.app');
    expect(cfg.android.sha256CertFingerprints).toHaveLength(1);
  });

  it('rejects invalid additional WebAuthn origins', () => {
    expect(() =>
      parseConfig({
        ...valid,
        WEBAUTHN_ADDITIONAL_ORIGINS: 'not-a-url',
      }),
    ).toThrow(/Invalid WEBAUTHN origin/);
  });

  it('parses media config with spec defaults', () => {
    const cfg = parseConfig(valid);
    expect(cfg.media.root).toBe('/tmp');
    expect(cfg.media.publicBaseUrl).toBe('https://media.expyrico.test');
    expect(cfg.media.maxUploadBytes).toBe(10 * 1024 * 1024);
    expect(cfg.media.maxDecodedMegapixels).toBe(40);
    expect(cfg.media.maxDimensionPx).toBe(12_000);
    expect(cfg.media.maxChannels).toBe(4);
    expect(cfg.media.maxDisplayBytes).toBe(8 * 1024 * 1024);
    expect(cfg.media.maxThumbnailBytes).toBe(2 * 1024 * 1024);
    expect(cfg.media.displayMaxDimensionPx).toBe(1600);
    expect(cfg.media.thumbnailMaxDimensionPx).toBe(480);
    expect(cfg.media.processingDeadlineMs).toBe(30_000);
    expect(cfg.media.sharpConcurrency).toBe(2);
  });

  it('rejects a MEDIA_ROOT that does not exist', () => {
    expect(() =>
      parseConfig({ ...valid, MEDIA_ROOT: '/tmp/does-not-exist-media-root-xyz' }),
    ).toThrow(/MEDIA_ROOT does not exist/);
  });

  it('rejects a MEDIA_PUBLIC_BASE_URL that is not a URL', () => {
    expect(() => parseConfig({ ...valid, MEDIA_PUBLIC_BASE_URL: 'not-a-url' })).toThrow();
  });

  it('allows overriding media numeric limits', () => {
    const cfg = parseConfig({ ...valid, MEDIA_SHARP_CONCURRENCY: '5', MEDIA_WEBP_QUALITY: '60' });
    expect(cfg.media.sharpConcurrency).toBe(5);
    expect(cfg.media.webpQuality).toBe(60);
  });

  it('defaults recaptcha minScore to 0.5 and an empty internal allowlist', () => {
    const cfg = parseConfig(valid);
    expect(cfg.recaptcha.minScore).toBe(0.5);
    expect(cfg.recaptcha.projectId).toBe('expyrico-test');
    expect(cfg.recaptcha.siteKeyAndroid).toBe('site-key-android');
    expect(cfg.recaptcha.siteKeyIos).toBe('site-key-ios');
    expect(cfg.productCreation.internalAllowlist).toEqual([]);
  });

  it('rejects a missing RECAPTCHA_SITE_KEY_ANDROID', () => {
    const { RECAPTCHA_SITE_KEY_ANDROID: _omit, ...rest } = valid;
    expect(() => parseConfig(rest)).toThrow();
  });

  it('parses a comma-separated PRODUCT_CREATION_INTERNAL_ALLOWLIST of UUIDs', () => {
    const a = '11111111-1111-1111-1111-111111111111';
    const b = '22222222-2222-2222-2222-222222222222';
    const cfg = parseConfig({ ...valid, PRODUCT_CREATION_INTERNAL_ALLOWLIST: ` ${a} , ${b} ` });
    expect(cfg.productCreation.internalAllowlist).toEqual([a, b]);
  });

  it('rejects a PRODUCT_CREATION_INTERNAL_ALLOWLIST entry that is not a UUID', () => {
    expect(() =>
      parseConfig({ ...valid, PRODUCT_CREATION_INTERNAL_ALLOWLIST: 'not-a-uuid' }),
    ).toThrow(/non-UUID/);
  });
});
