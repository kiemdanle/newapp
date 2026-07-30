import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import type { ProcessedVariants } from '../../src/services/products/product-image-processor.js';
import { addProductPhoto } from '../../src/services/products/product-photos.js';
import { reserveMediaCapacity } from '../../src/services/products/product-media-capacity.js';
import { keyPrefixExists, mediaKeyToPath } from '../../src/services/products/product-media-storage.js';
import { moderateProduct } from '../../src/services/products/product-moderation.js';
import * as auditLog from '../../src/services/audit/log.js';

// I7: injects a failure *after* publish (capacity reserved, intent prepared, bytes
// copied) but before the reference transaction commits — `writeAuditLog` is the
// last statement inside that transaction, so throwing from it exercises exactly
// the "process/transaction dies after every public copy but before the DB/audit
// transaction commits" fault Task 1 requires, without a real fault-injection
// framework. Delegates to the real implementation by default; only a test that
// explicitly calls `mockImplementationOnce` sees the forced failure, and every
// other test in this file still gets a real, verifiable audit row.
const writeAuditLogSpy = vi.spyOn(auditLog, 'writeAuditLog');

let root: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'admin-product-moderation-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
  // This file exercises moderation/photo-correction mechanics, not the Phase 7
  // `product_creation` mode gate (covered separately in product-creation-mode.test.ts)
  // — set mode to `all` so a non-admin creator's own draft mutations aren't
  // incidentally blocked by the default `off` mode.
  await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'all' } } });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
});

async function makePendingProduct(creatorId: string) {
  return getPrisma().product.create({
    data: {
      barcode: `bc-${randomUUID()}`,
      name: 'New Product',
      source: 'user',
      createdByUserId: creatorId,
      status: 'pending',
    },
  });
}

async function fakeProcessedUpload(): Promise<ProcessedVariants> {
  const buf = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'teal' } }).jpeg().toBuffer();
  return {
    sourceMimeType: 'image/jpeg',
    display: { variant: 'display', buffer: buf, width: 20, height: 20, bytes: buf.length },
    thumb: { variant: 'thumb', buffer: buf, width: 20, height: 20, bytes: buf.length },
  };
}

/** `addProductPhoto` refuses writes once a product is `pending` (locked for
 * review, by design — see `checkPhotoMutablePolicy`). Fixtures that need a
 * pending product with photos already attached must stage the photos while the
 * product is still `draft`, then flip it to `pending` directly, mirroring what a
 * real (currently-disabled) `submitDraft` transition will eventually do. */
async function addPhotoToDraft(actorId: string, productId: string) {
  const reservation = await reserveMediaCapacity({ bytes: 10_000 });
  const processed = await fakeProcessedUpload();
  return addProductPhoto({ id: actorId, role: 'user' }, { productId, processed, capacityReservationId: reservation.id });
}

async function makePendingProductWithPhotos(creatorId: string, photoCount: number) {
  const product = await getPrisma().product.create({
    data: {
      barcode: `bc-${randomUUID()}`,
      name: 'New Product',
      source: 'user',
      createdByUserId: creatorId,
      status: 'draft',
    },
  });
  for (let i = 0; i < photoCount; i++) await addPhotoToDraft(creatorId, product.id);
  return getPrisma().product.update({ where: { id: product.id }, data: { status: 'pending' } });
}

describe('POST /v1/admin/products/:id/moderate — RBAC', () => {
  it('rejects an unauthenticated caller', async () => {
    const app = await buildServer();
    const creator = await makeUserForAdmin();
    const product = await makePendingProduct(creator.id);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      payload: { decision: 'approve', version: 1 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects an authenticated non-admin caller', async () => {
    const app = await buildServer();
    const creator = await makeUserForAdmin();
    const product = await makePendingProduct(creator.id);
    const user = await makeUser({ emailVerified: true });
    const token = await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: user.tokenVersion });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'approve', version: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('POST /v1/admin/products/:id/moderate — approve, no photos', () => {
  it('activates the product, bumps version, and writes an atomic audit row', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProduct(creator.id);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'approve', version: 1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('active');

    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.status).toBe('active');
    expect(after.version).toBe(2);
    expect(after.moderatedByUserId).toBe(admin.id);

    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, targetId: product.id, action: 'product.moderate' } });
    expect(log).toBeTruthy();
    await app.close();
  });
});

describe('POST /v1/admin/products/:id/moderate — approve with photos', () => {
  it('publishes every pending photo to a public key and activates the product', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProductWithPhotos(creator.id, 2);

    const before = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'approve', version: before.version },
    });
    expect(res.statusCode).toBe(200);

    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    expect(photos).toHaveLength(2);

    // C1: the public key must live under the PRODUCT's own namespace and be
    // exactly what the prepared intent recorded — the two must never be able to
    // drift apart (that drift is precisely what C1 was).
    const intent = await getPrisma().mediaOperationOutbox.findFirstOrThrow({
      where: { operation: 'publish_public' },
      orderBy: { createdAt: 'desc' },
    });
    const intentKeys = (intent.payload as { keys: string[] }).keys;
    for (const photo of photos) {
      expect(photo.moderationStatus).toBe('approved');
      expect(photo.publicStorageKey).toBeTruthy();
      expect(photo.privateStorageKey).toBeNull();
      expect(photo.publicStorageKey).toMatch(new RegExp(`^public/products/${product.id}/`));
      expect(intentKeys).toContain(photo.publicStorageKey);
      await expect(keyPrefixExists(root, photo.publicStorageKey!)).resolves.toBe(true);
    }
    await app.close();
  });

  it('I4: sets the compatibility cover imageUrl to the position-0 photo\'s public display URL', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProductWithPhotos(creator.id, 2);
    const before = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'approve', version: before.version },
    });
    expect(res.statusCode).toBe(200);

    const cover = await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id, position: 0 } });
    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.imageUrl).toBeTruthy();
    expect(after.imageUrl).toContain(cover.publicStorageKey!.split('/').pop());
    await app.close();
  });

  it('a stale caller-supplied version never reaches publish work at all', async () => {
    const { admin } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProductWithPhotos(creator.id, 1);

    await expect(
      moderateProduct(
        { id: admin.id, role: 'admin' },
        {},
        { productId: product.id, decision: 'approve', version: 999 },
      ),
    ).rejects.toMatchObject({ status: 409, code: 'version_conflict' });

    const photo = await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } });
    expect(photo.moderationStatus).toBe('pending');
    expect(photo.publicStorageKey).toBeNull();
    const untouched = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(untouched.status).toBe('pending');
  });

  it('I7: leaves no orphaned public bytes and no reference when the reference transaction fails AFTER every public copy has already happened', async () => {
    const { admin } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProductWithPhotos(creator.id, 1);
    const before = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });

    // `writeAuditLog` is the last statement inside the reference transaction, so
    // throwing from it only fires after `reserveMediaCapacity`, `prepareMediaOperation`,
    // and `publishProductPhoto` (the real byte copy) have all already run — the exact
    // "process/transaction dies after every public copy but before the DB/audit
    // transaction commits" scenario Task 1 requires.
    writeAuditLogSpy.mockImplementationOnce(() => {
      throw new Error('forced failure after publish, before commit');
    });

    await expect(
      moderateProduct(
        { id: admin.id, role: 'admin' },
        {},
        { productId: product.id, decision: 'approve', version: before.version },
      ),
    ).rejects.toThrow('forced failure after publish, before commit');

    // (a) product/photo rows unchanged
    const photo = await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } });
    expect(photo.moderationStatus).toBe('pending');
    expect(photo.publicStorageKey).toBeNull();
    expect(photo.privateStorageKey).toBeTruthy();
    const untouched = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(untouched.status).toBe('pending');
    expect(untouched.version).toBe(before.version);

    // (b) no file remains under the public root — the compensation path actually
    // deleted the bytes `publishProductPhoto` copied (this is exactly the check
    // that would have caught C1: a wrong key namespace makes the compensating
    // `removeKeyPrefix` call a no-op against a path that was never written).
    // `removeKeyPrefix` removes the publication-id leaf, not necessarily an
    // emptied product-id parent directory, so this walks recursively for actual
    // files rather than asserting the parent directory itself is gone.
    async function countFilesRecursively(dir: string): Promise<number> {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      let count = 0;
      for (const entry of entries) {
        if (entry.isDirectory()) count += await countFilesRecursively(join(dir, entry.name));
        else count += 1;
      }
      return count;
    }
    const publicRoot = mediaKeyToPath(root, 'public');
    expect(await countFilesRecursively(publicRoot)).toBe(0);

    // (c) the prepared intent row is recoverable — never left `completed` (this
    // path never reached `completeMediaOperation`) with keys matching what was
    // actually written under the product's own id.
    const intent = await getPrisma().mediaOperationOutbox.findFirstOrThrow({
      where: { operation: 'publish_public' },
      orderBy: { createdAt: 'desc' },
    });
    expect(intent.status).toBe('prepared');
    const keys = (intent.payload as { keys: string[] }).keys;
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(new RegExp(`^public/products/${product.id}/`));
  });
});

describe('POST /v1/admin/products/:id/moderate — request_changes', () => {
  it('sets changes_required with the reason, never rejected, and retains private media', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProductWithPhotos(creator.id, 1);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'request_changes', version: product.version, notes: 'Please add a real description' },
    });
    expect(res.statusCode).toBe(200);

    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.status).toBe('changes_required');
    expect(after.moderationNotes).toBe('Please add a real description');
    expect(after.moderatedByUserId).toBe(admin.id);

    const photo = await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } });
    expect(photo.moderationStatus).toBe('pending');
    expect(photo.privateStorageKey).toBeTruthy();
    await app.close();
  });

  it('requires notes', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProduct(creator.id);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'request_changes', version: 1 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('POST /v1/admin/products/:id/moderate — replay, stale version, invalid transitions', () => {
  it('rejects moderating an already-active product', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const product = await getPrisma().product.create({ data: { name: 'Already active', source: 'off', status: 'active' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'approve', version: 1 },
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('rejects a replayed/stale decision with a typed version conflict carrying currentVersion', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProduct(creator.id);

    const first = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'approve', version: 1 },
    });
    expect(first.statusCode).toBe(200);

    const replay = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'approve', version: 1 },
    });
    expect(replay.statusCode).toBe(409);
    await app.close();
  });

  it('exactly one of two concurrent approvals on the same version wins; the loser gets a typed conflict', async () => {
    const { admin } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProductWithPhotos(creator.id, 1);

    const results = await Promise.allSettled([
      moderateProduct({ id: admin.id, role: 'admin' }, {}, { productId: product.id, decision: 'approve', version: product.version }),
      moderateProduct({ id: admin.id, role: 'admin' }, {}, { productId: product.id, decision: 'approve', version: product.version }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const photos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    expect(photos).toHaveLength(1);
    // The winner's photo is referenced by exactly one public key; the loser never got
    // far enough to reference anything (it lost the version-guarded update before its
    // reference transaction, since both raced from the same starting version).
    expect(photos[0]!.publicStorageKey).toBeTruthy();
    await expect(keyPrefixExists(root, photos[0]!.publicStorageKey!)).resolves.toBe(true);

    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.status).toBe('active');
    expect(after.version).toBe(product.version + 1);
  });
});

describe('POST /v1/admin/products/:id/moderate — creator feedback and other-user invisibility', () => {
  it('creator can see the request_changes reason on their own draft-like product via the creator surface', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProduct(creator.id);
    await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${product.id}/moderate`,
      headers,
      payload: { decision: 'request_changes', version: 1, notes: 'fix it' },
    });
    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.moderationNotes).toBe('fix it');
    await app.close();
  });

  it('404 for a non-existent product', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${randomUUID()}/moderate`,
      headers,
      payload: { decision: 'approve', version: 1 },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /v1/admin/products/:id — review projection', () => {
  it('includes ordered private review photos and moderation history for a pending product', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makePendingProductWithPhotos(creator.id, 2);

    const res = await app.inject({ method: 'GET', url: `/v1/admin/products/${product.id}`, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.photos).toHaveLength(2);
    expect(body.photos[0].position).toBe(0);
    expect(body.photos[0].thumbnailUrl).toContain(`/v1/products/${product.id}/photos/`);
    await app.close();
  });
});

const CORRECTION_BOUNDARY = '----expyricoAdminCorrectionBoundary';
function multipartBody(parts: Array<{ name: string; filename?: string; contentType?: string; content: Buffer | string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    let header = `--${CORRECTION_BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.contentType) header += `Content-Type: ${part.contentType}\r\n`;
    header += '\r\n';
    chunks.push(Buffer.from(header, 'utf8'));
    chunks.push(Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content, 'utf8'));
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${CORRECTION_BOUNDARY}--\r\n`, 'utf8'));
  return Buffer.concat(chunks);
}
async function correctionJpegBytes(): Promise<Buffer> {
  return sharp({ create: { width: 20, height: 20, channels: 3, background: 'orange' } }).jpeg().toBuffer();
}

describe('admin direct correction — field patch', () => {
  it('version-conflict rejects a stale admin correction', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Original', source: 'off', status: 'active' } });

    const first = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { version: p.version, name: 'First' } });
    expect(first.statusCode).toBe(200);

    const replay = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { version: p.version, name: 'Second' } });
    expect(replay.statusCode).toBe(409);
    expect(replay.json().code).toBe('version_conflict');
    await app.close();
  });

  it('a correction bumps product version, making any pending revision base stale', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Original', source: 'off', status: 'active' } });
    const edit = await getPrisma().productEdit.create({
      data: { productId: p.id, submittedBy: creator.id, proposed: { name: 'Creator wants this' }, status: 'pending', isLegacy: false, baseProductVersion: p.version },
    });

    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { version: p.version, name: 'Admin corrected' } });
    expect(res.statusCode).toBe(200);

    const afterProduct = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(afterProduct.version).toBe(p.version + 1);
    expect(edit.baseProductVersion).not.toBe(afterProduct.version);
  });

  it('I5: rejects activating a pending product directly — that bypass must go through moderateProduct', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const p = await makePendingProductWithPhotos(creator.id, 1);

    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { version: p.version, status: 'active' } });
    expect(res.statusCode).toBe(409);

    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.status).toBe('pending');
    const photo = await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: p.id } });
    expect(photo.moderationStatus).toBe('pending');
    expect(photo.publicStorageKey).toBeNull();
  });

  it('I5: rejects setting merged_into directly at the schema boundary, but allows the legitimate active <-> report_hidden catalog toggle', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Live', source: 'off', status: 'active' } });

    // Not merely a route-level 409 — `merged_into` is not a valid value for this
    // schema at all, so it never even reaches the handler.
    const bypass = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { version: p.version, status: 'merged_into' } });
    expect(bypass.statusCode).toBe(400);
    expect(bypass.json().code).toBe('validation_error');

    const hide = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { version: p.version, status: 'report_hidden' } });
    expect(hide.statusCode).toBe(200);
    const hidden = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(hidden.status).toBe('report_hidden');

    const unhide = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { version: hidden.version, status: 'active' } });
    expect(unhide.statusCode).toBe(200);
  });
});

describe('admin direct photo management — audit and version bump', () => {
  it('admin photo add/remove on an active product is audited atomically and bumps product version', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const owner = await makeUserForAdmin();
    const product = await getPrisma().product.create({ data: { barcode: `bc-${randomUUID()}`, name: 'Live', source: 'user', createdByUserId: owner.id, status: 'active' } });
    const versionBefore = product.version;

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${CORRECTION_BOUNDARY}` },
      payload: multipartBody([{ name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', content: await correctionJpegBytes() }]),
    });
    expect(uploadRes.statusCode).toBe(201);

    const addLog = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, targetId: product.id, action: 'product.photo.add' } });
    expect(addLog).toBeTruthy();

    const afterAdd = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(afterAdd.version).toBe(versionBefore + 1);

    const photoId = uploadRes.json().photos[0].id as string;
    const deleteRes = await app.inject({ method: 'DELETE', url: `/v1/products/${product.id}/photos/${photoId}`, headers });
    expect(deleteRes.statusCode).toBe(200);
    const removeLog = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, targetId: product.id, action: 'product.photo.remove' } });
    expect(removeLog).toBeTruthy();
    await app.close();
  });

  it('a creator\'s own photo change on their own draft is never admin-audited', async () => {
    const app = await buildServer();
    const owner = await makeUserForAdmin();
    const token = await issueAccessToken({ sub: owner.id, role: 'user', tokenVersion: 0 });
    const headers = { authorization: `Bearer ${token}` };
    const product = await getPrisma().product.create({ data: { barcode: `bc-${randomUUID()}`, name: 'Draft', source: 'user', createdByUserId: owner.id, status: 'draft' } });

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${CORRECTION_BOUNDARY}` },
      payload: multipartBody([{ name: 'file', filename: 'a.jpg', contentType: 'image/jpeg', content: await correctionJpegBytes() }]),
    });
    expect(uploadRes.statusCode).toBe(201);

    const logs = await getPrisma().adminAuditLog.findMany({ where: { targetId: product.id } });
    expect(logs).toHaveLength(0);
    await app.close();
  });
});
