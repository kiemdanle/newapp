import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { resetConfigForTests } from '../../src/config.js';

describe('well-known asset links', () => {
  const previousFingerprints = process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
  const previousPackage = process.env.ANDROID_PACKAGE_NAME;

  beforeEach(() => {
    resetConfigForTests();
  });

  afterEach(() => {
    if (previousFingerprints === undefined) delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
    else process.env.ANDROID_SHA256_CERT_FINGERPRINTS = previousFingerprints;
    if (previousPackage === undefined) delete process.env.ANDROID_PACKAGE_NAME;
    else process.env.ANDROID_PACKAGE_NAME = previousPackage;
    resetConfigForTests();
  });

  it('returns 404 when fingerprints are not configured', async () => {
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
    resetConfigForTests();
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('returns Digital Asset Links when fingerprints are configured', async () => {
    process.env.ANDROID_PACKAGE_NAME = 'com.expyrico.app';
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS =
      '34:B6:64:79:CC:E1:E7:7B:96:55:BE:BB:D7:E7:C2:85:B3:42:8C:B6:08:4C:D8:B3:B7:B8:71:D7:7B:AE:21:CA';
    resetConfigForTests();
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{
      relation: string[];
      target: { package_name: string; sha256_cert_fingerprints: string[] };
    }>;
    expect(body[0]?.target.package_name).toBe('com.expyrico.app');
    expect(body[0]?.target.sha256_cert_fingerprints[0]).toMatch(/^34:B6:/);
    expect(body[0]?.relation).toContain('delegate_permission/common.get_login_creds');
    await app.close();
  });
});
