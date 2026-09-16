import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { ERROR_CODES, type Record as ApiRecord } from '@expyrico/shared';
import { acquireMediaFreeze, releaseMediaFreeze } from '../../src/services/products/product-media-freeze.js';

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

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

async function sampleJpegBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 120, g: 180, b: 240 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('Record Photo Upload Route & Freeze Policy', () => {
  it('POST /v1/records/upload-photo succeeds and double prefix /v1/records/records/upload-photo is 404', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const image = await sampleJpegBuffer();
    const payload = multipartBody([
      { name: 'file', filename: 'pantry-item.jpg', contentType: 'image/jpeg', content: image },
    ]);

    // 1. Correct route /v1/records/upload-photo must succeed with 201
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/upload-photo',
      headers: {
        ...headers,
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.photoUrl).toMatch(/^https?:\/\/.+\/records\/.+\/display\.webp$/);
    expect(body.thumbUrl).toMatch(/^https?:\/\/.+\/records\/.+\/thumb\.webp$/);

    // 2. Double-prefixed route /v1/records/records/upload-photo must return 404
    const badRes = await app.inject({
      method: 'POST',
      url: '/v1/records/records/upload-photo',
      headers: {
        ...headers,
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload,
    });
    expect(badRes.statusCode).toBe(404);

    // 3. Public media delivery route correctness:
    // Extract path from the returned photoUrl (e.g. /records/userId/photoId/display.webp)
    const urlObj = new URL(body.photoUrl);
    const mediaPath = urlObj.pathname;

    // Both direct /records/... and /v1/records/... work
    const mediaRes = await app.inject({
      method: 'GET',
      url: mediaPath,
    });
    expect(mediaRes.statusCode).toBe(200);
    expect(mediaRes.headers['content-type']).toBe('image/webp');
    expect(mediaRes.headers['cache-control']).toContain('immutable');

    const mediaResV1 = await app.inject({
      method: 'GET',
      url: `/v1${mediaPath}`,
    });
    expect(mediaResV1.statusCode).toBe(200);
    expect(mediaResV1.headers['content-type']).toBe('image/webp');

    // Invalid variant returns 404
    const invalidVariantRes = await app.inject({
      method: 'GET',
      url: mediaPath.replace('display.webp', 'invalid.webp'),
    });
    expect(invalidVariantRes.statusCode).toBe(404);

    await app.close();
  });

  it('POST /v1/records/upload-photo obeys active media freeze policy', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const image = await sampleJpegBuffer();
    const payload = multipartBody([
      { name: 'file', filename: 'pantry-item.jpg', contentType: 'image/jpeg', content: image },
    ]);

    const freeze = await acquireMediaFreeze();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/records/upload-photo',
        headers: {
          ...headers,
          'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
        },
        payload,
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().code).toBe('temporarily_unavailable');
    } finally {
      await releaseMediaFreeze(freeze.token);
    }

    // After unfreeze, upload succeeds
    const successRes = await app.inject({
      method: 'POST',
      url: '/v1/records/upload-photo',
      headers: {
        ...headers,
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload,
    });
    expect(successRes.statusCode).toBe(201);

    await app.close();
  });
});

describe('Record Photo Gallery Persistence & Wire Contract', () => {
  it('creates record with ordered photoUrls gallery, keeping photoUrl cover consistent', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const clientId = randomUUID();

    const photoUrls = [
      'https://example.com/photos/item1.webp',
      'https://example.com/photos/item2.webp',
    ];

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: {
        clientId,
        customName: 'Cereal Box',
        expiryDate: '2026-12-31',
        photoUrls,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.photoUrls).toEqual(photoUrls);
    expect(body.photoUrl).toBe(photoUrls[0]);

    // Verify database row
    const row = await getPrisma().record.findUniqueOrThrow({ where: { clientId } });
    expect(row.photoUrl).toBe(photoUrls[0]);
    expect(row.photoUrls).toEqual(photoUrls);

    await app.close();
  });

  it('creates record with explicitly empty photoUrls: [] and null photoUrls: null', async () => {
    const app = await buildServer();
    const { headers } = await authed();

    const clientEmpty = randomUUID();
    const resEmpty = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientEmpty },
      payload: {
        clientId: clientEmpty,
        customName: 'Empty Gallery Item',
        expiryDate: '2026-12-31',
        photoUrls: [],
      },
    });
    expect(resEmpty.statusCode).toBe(201);
    expect(resEmpty.json().photoUrls).toEqual([]);
    expect(resEmpty.json().photoUrl).toBeNull();
    const rowEmpty = await getPrisma().record.findUniqueOrThrow({ where: { clientId: clientEmpty } });
    expect(rowEmpty.photoUrls).toEqual([]);
    expect(rowEmpty.photoUrl).toBeNull();

    const clientNull = randomUUID();
    const resNull = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientNull },
      payload: {
        clientId: clientNull,
        customName: 'Fallback Item',
        expiryDate: '2026-12-31',
        photoUrls: null,
      },
    });
    expect(resNull.statusCode).toBe(201);
    expect(resNull.json().photoUrls).toBeNull();
    expect(resNull.json().photoUrl).toBeNull();
    const rowNull = await getPrisma().record.findUniqueOrThrow({ where: { clientId: clientNull } });
    expect(rowNull.photoUrls).toBeNull();
    expect(rowNull.photoUrl).toBeNull();

    await app.close();
  });

  it('creates record with omitted photoUrls (legacy client with photoUrl)', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const clientId = randomUUID();
    const legacyUrl = 'https://example.com/legacy-cover.webp';

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: {
        clientId,
        customName: 'Legacy Item',
        expiryDate: '2026-12-31',
        photoUrl: legacyUrl,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.photoUrl).toBe(legacyUrl);
    expect(body.photoUrls).toBeNull();

    const row = await getPrisma().record.findUniqueOrThrow({ where: { clientId } });
    expect(row.photoUrl).toBe(legacyUrl);
    expect(row.photoUrls).toBeNull();

    await app.close();
  });

  it('rejects record creation exceeding maxPantryItemPhotos limit', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const clientId = randomUUID();
    // Default limit is 5 photos
    const urls = Array.from({ length: 6 }, (_, i) => `https://example.com/p${i}.webp`);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: {
        clientId,
        customName: 'Too Many Photos',
        expiryDate: '2026-12-31',
        photoUrls: urls,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ERROR_CODES.VALIDATION);

    await app.close();
  });

  it('PATCH /v1/records/:id updates gallery, empties gallery, sets null fallback, or leaves unchanged when omitted', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const clientId = randomUUID();

    // 1. Create initial record with 2 photos
    const initialUrls = ['https://example.com/1.webp', 'https://example.com/2.webp'];
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: {
        clientId,
        customName: 'Patch Test Item',
        expiryDate: '2026-12-31',
        photoUrls: initialUrls,
      },
    });
    const recordId = createRes.json().id;

    // 2. Patch with omitted photoUrls (update customName only) -> leaves gallery and cover unchanged!
    const patchOmitted = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${recordId}`,
      headers,
      payload: {
        customName: 'Updated Name Only',
      },
    });
    expect(patchOmitted.statusCode).toBe(200);
    expect(patchOmitted.json().photoUrls).toEqual(initialUrls);
    expect(patchOmitted.json().photoUrl).toBe(initialUrls[0]);

    // 3. Patch with new photoUrls array -> updates gallery and sets cover to photoUrls[0]
    const updatedUrls = ['https://example.com/new1.webp', 'https://example.com/new2.webp', 'https://example.com/new3.webp'];
    const patchNew = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${recordId}`,
      headers,
      payload: {
        photoUrls: updatedUrls,
      },
    });
    expect(patchNew.statusCode).toBe(200);
    expect(patchNew.json().photoUrls).toEqual(updatedUrls);
    expect(patchNew.json().photoUrl).toBe(updatedUrls[0]);

    // 4. Patch with photoUrls: [] -> clears gallery and cover
    const patchEmpty = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${recordId}`,
      headers,
      payload: {
        photoUrls: [],
      },
    });
    expect(patchEmpty.statusCode).toBe(200);
    expect(patchEmpty.json().photoUrls).toEqual([]);
    expect(patchEmpty.json().photoUrl).toBeNull();

    // 5. Patch with photoUrls: null -> catalog fallback (null)
    const patchNull = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${recordId}`,
      headers,
      payload: {
        photoUrls: null,
      },
    });
    expect(patchNull.statusCode).toBe(200);
    expect(patchNull.json().photoUrls).toBeNull();
    expect(patchNull.json().photoUrl).toBeNull();

    // 6. Legacy patch: update photoUrl only when photoUrls omitted
    const patchLegacy = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${recordId}`,
      headers,
      payload: {
        photoUrl: 'https://example.com/legacy-cover.webp',
      },
    });
    expect(patchLegacy.statusCode).toBe(200);
    expect(patchLegacy.json().photoUrl).toBe('https://example.com/legacy-cover.webp');
    expect(patchLegacy.json().photoUrls).toBeNull();

    // 7. Reject PATCH exceeding max photos
    const tooMany = Array.from({ length: 6 }, (_, i) => `https://example.com/patch-${i}.webp`);
    const patchTooMany = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${recordId}`,
      headers,
      payload: {
        photoUrls: tooMany,
      },
    });
    expect(patchTooMany.statusCode).toBe(400);
    expect(patchTooMany.json().code).toBe(ERROR_CODES.VALIDATION);

    const syncTooMany = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        upserts: [{
          clientId: randomUUID(), customName: 'Too many photos',
          expiryDate: '2026-12-31', updatedAt: new Date().toISOString(), photoUrls: tooMany,
        }],
        deletes: [recordId],
      },
    });
    expect(syncTooMany.statusCode).toBe(400);
    expect(await getPrisma().record.findUnique({ where: { id: recordId } })).not.toBeNull();

    await app.close();
  });

  it('GET /v1/records (list) serializes photoUrls and legacy photoUrl', async () => {
    const app = await buildServer();
    const { headers } = await authed();

    const id1 = randomUUID();
    const id2 = randomUUID();

    await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': id1 },
      payload: {
        clientId: id1,
        customName: 'Item With Gallery',
        expiryDate: '2026-12-31',
        photoUrls: ['https://example.com/list1.webp', 'https://example.com/list2.webp'],
      },
    });

    await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': id2 },
      payload: {
        clientId: id2,
        customName: 'Item Without Gallery',
        expiryDate: '2026-12-31',
        photoUrl: 'https://example.com/legacy-only.webp',
      },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/records',
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const items = listRes.json().items as ApiRecord[];
    const item1 = items.find((i) => i.clientId === id1)!;
    const item2 = items.find((i) => i.clientId === id2)!;

    expect(item1.photoUrls).toEqual(['https://example.com/list1.webp', 'https://example.com/list2.webp']);
    expect(item1.photoUrl).toBe('https://example.com/list1.webp');

    expect(item2.photoUrls).toBeNull();
    expect(item2.photoUrl).toBe('https://example.com/legacy-only.webp');

    await app.close();
  });

  it('POST /v1/records/:id/duplicate duplicates photoUrls and photoUrl', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const clientId = randomUUID();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: {
        clientId,
        customName: 'Item To Duplicate',
        expiryDate: '2026-12-31',
        photoUrls: ['https://example.com/dup1.webp', 'https://example.com/dup2.webp'],
      },
    });
    const recordId = createRes.json().id;

    const dupRes = await app.inject({
      method: 'POST',
      url: `/v1/records/${recordId}/duplicate`,
      headers,
      payload: {
        expiryDate: '2027-01-15',
      },
    });
    expect(dupRes.statusCode).toBe(201);
    const dupBody = dupRes.json();
    expect(dupBody.id).not.toBe(recordId);
    expect(dupBody.photoUrls).toEqual(['https://example.com/dup1.webp', 'https://example.com/dup2.webp']);
    expect(dupBody.photoUrl).toBe('https://example.com/dup1.webp');

    await app.close();
  });

  it('POST /v1/records/sync creates, updates, and echoes photoUrls', async () => {
    const app = await buildServer();
    const { headers } = await authed();

    const client1 = randomUUID();
    const syncUrls = ['https://example.com/sync1.webp', 'https://example.com/sync2.webp'];

    // 1. Sync batch creation with photoUrls
    const syncRes = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        upserts: [
          {
            clientId: client1,
            customName: 'Sync Created Item',
            expiryDate: '2026-12-31',
            updatedAt: new Date().toISOString(),
            photoUrls: syncUrls,
          },
        ],
        deletes: [],
      },
    });
    expect(syncRes.statusCode).toBe(200);
    const changes = syncRes.json().changes as ApiRecord[];
    const synced = changes.find((c) => c.clientId === client1)!;
    expect(synced.photoUrls).toEqual(syncUrls);
    expect(synced.photoUrl).toBe(syncUrls[0]);

    // 2. Sync batch update with empty photoUrls: []
    const laterDate = new Date(Date.now() + 5000).toISOString();
    const syncRes2 = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        upserts: [
          {
            clientId: client1,
            customName: 'Sync Updated Item',
            expiryDate: '2026-12-31',
            updatedAt: laterDate,
            photoUrls: [],
          },
        ],
        deletes: [],
      },
    });
    expect(syncRes2.statusCode).toBe(200);
    const synced2 = (syncRes2.json().changes as ApiRecord[]).find((c) => c.clientId === client1)!;
    expect(synced2.photoUrls).toEqual([]);
    expect(synced2.photoUrl).toBeNull();

    // 3. Sync batch update with omitted photoUrls leaves gallery unchanged
    const evenLaterDate = new Date(Date.now() + 10000).toISOString();
    const syncRes3 = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        upserts: [
          {
            clientId: client1,
            customName: 'Sync Updated Item Again',
            expiryDate: '2026-12-31',
            updatedAt: evenLaterDate,
          },
        ],
        deletes: [],
      },
    });
    expect(syncRes3.statusCode).toBe(200);
    const synced3 = (syncRes3.json().changes as ApiRecord[]).find((c) => c.clientId === client1)!;
    expect(synced3.photoUrls).toEqual([]); // Still [] from step 2

    await app.close();
  });
});
