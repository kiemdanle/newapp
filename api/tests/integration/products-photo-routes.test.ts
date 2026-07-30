import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeUser } from '../helpers/factories.js';

let root: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'photo-routes-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
  // This file exercises upload/delete/order mechanics, not the `product_creation`
  // mode gate itself (covered separately in product-creation-mode.test.ts) — set
  // mode to `all` so a non-allowlisted regular user isn't incidentally blocked.
  await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'all' } } });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
});

async function authHeaders(role: 'user' | 'admin' = 'user') {
  const u = await makeUser({ role, emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

async function makeDraftProduct(createdByUserId: string) {
  return getPrisma().product.create({
    data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId, status: 'draft' },
  });
}

const BOUNDARY = '----expyricoTestBoundary';

function multipartBody(parts: Array<{ name: string; filename?: string; contentType?: string; content: Buffer | string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    let header = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.contentType) header += `Content-Type: ${part.contentType}\r\n`;
    header += '\r\n';
    chunks.push(Buffer.from(header, 'utf8'));
    chunks.push(Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content, 'utf8'));
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`, 'utf8'));
  return Buffer.concat(chunks);
}

async function jpegBytes(): Promise<Buffer> {
  return sharp({ create: { width: 30, height: 30, channels: 3, background: 'orange' } }).jpeg().toBuffer();
}

describe('POST /v1/products/:productId/photos', () => {
  it('accepts a single-file multipart upload and attaches it to the product', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const body = multipartBody([{ name: 'file', filename: 'photo.jpg', contentType: 'image/jpeg', content: await jpegBytes() }]);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.photos).toHaveLength(1);
    expect(json.photos[0].displayUrl).toBe(`/v1/products/${product.id}/photos/${json.photos[0].id}/display`);
    await app.close();
  });

  it('rejects a request with two file parts', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const jpeg = await jpegBytes();
    const body = multipartBody([
      { name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', content: jpeg },
      { name: 'file2', filename: 'b.jpg', contentType: 'image/jpeg', content: jpeg },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    expect(photos).toHaveLength(0);
    await app.close();
  });

  it('rejects a request with an extra form field alongside the file', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const body = multipartBody([
      { name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', content: await jpegBytes() },
      { name: 'caption', content: 'not allowed' },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a request with only a field and no file', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const body = multipartBody([{ name: 'caption', content: 'hello' }]);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects an unauthenticated request', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const product = await makeDraftProduct(owner.id);
    const body = multipartBody([{ name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', content: await jpegBytes() }]);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects a non-multipart request body', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers,
      payload: { not: 'multipart' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('reserves capacity before streaming a single byte to disk — an exhausted budget leaves no quarantine residue (reviewer-p3 I3)', async () => {
    process.env.MEDIA_CAPACITY_USABLE_BYTES = '1000';
    process.env.MEDIA_CAPACITY_RESERVE_BYTES = '0';
    resetConfigForTests();
    const { reserveMediaCapacity } = await import('../../src/services/products/product-media-capacity.js');
    // Fills the entire budget before the request even starts, so the route's own
    // reservation call must fail immediately — proving it happens before any
    // `writeQuarantineFile` call, not after (the bug: N concurrent uploaders could
    // each put a full MEDIA_MAX_UPLOAD_BYTES on disk while the budget read zero).
    await reserveMediaCapacity({ bytes: 1000 });

    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const body = multipartBody([{ name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', content: await jpegBytes() }]);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: body,
    });
    expect(res.statusCode).toBe(507);

    const { readdir } = await import('node:fs/promises');
    const { mediaKeyToPath } = await import('../../src/services/products/product-media-storage.js');
    const quarantineDir = mediaKeyToPath(root, 'quarantine');
    const entries = await readdir(quarantineDir).catch(() => []);
    expect(entries).toHaveLength(0);
    await app.close();
  });
});

describe('DELETE /v1/products/:productId/photos/:photoId', () => {
  it('removes a photo via the real HTTP route', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const uploadBody = multipartBody([{ name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', content: await jpegBytes() }]);
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: uploadBody,
    });
    const photoId = uploadRes.json().photos[0].id as string;

    const res = await app.inject({ method: 'DELETE', url: `/v1/products/${product.id}/photos/${photoId}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().photos).toHaveLength(0);
    await app.close();
  });
});

describe('PATCH /v1/products/:productId/photos/order', () => {
  it('reorders photos via the real HTTP route', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeDraftProduct(user.id);
    const jsonHeaders = { ...headers, 'content-type': 'application/json' };
    const photoIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const uploadRes = await app.inject({
        method: 'POST',
        url: `/v1/products/${product.id}/photos`,
        headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload: multipartBody([{ name: 'file', filename: `${i}.jpg`, contentType: 'image/jpeg', content: await jpegBytes() }]),
      });
      photoIds.push(uploadRes.json().photos[uploadRes.json().photos.length - 1].id);
    }

    const rotated = [photoIds[1], photoIds[0]];
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${product.id}/photos/order`,
      headers: jsonHeaders,
      payload: JSON.stringify({ photoIds: rotated }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().photos.map((p: { id: string }) => p.id)).toEqual(rotated);
    await app.close();
  });
});
