import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeUser } from '../helpers/factories.js';
import {
  mediaKeyToPath,
  privateProductEditPhotoPrefix,
  privateProductPhotoPrefix,
} from '../../src/services/products/product-media-storage.js';

let root: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'private-media-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
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

async function writeVariantBytes(prefix: string, content: string): Promise<void> {
  await mkdir(mediaKeyToPath(root, prefix), { recursive: true });
  await writeFile(mediaKeyToPath(root, `${prefix}/display.webp`), content);
  await writeFile(mediaKeyToPath(root, `${prefix}/thumb.webp`), content);
}

async function makeProduct(createdByUserId: string, status: 'draft' | 'pending' | 'changes_required' | 'active' = 'draft') {
  return getPrisma().product.create({
    data: { barcode: `bc-${randomUUID()}`, name: 'T', source: 'user', createdByUserId, status },
  });
}

async function makePrivatePhoto(
  productId: string,
  uploaderId: string,
  prefix: string,
  moderationStatus: 'pending' | 'rejected' = 'pending',
) {
  return getPrisma().productPhoto.create({
    data: {
      productId,
      position: 0,
      uploadedByUserId: uploaderId,
      moderationStatus,
      mimeType: 'image/webp',
      displayByteSize: 1,
      displayWidth: 1,
      displayHeight: 1,
      thumbnailByteSize: 1,
      thumbnailWidth: 1,
      thumbnailHeight: 1,
      privateStorageKey: prefix,
    },
  });
}

describe('GET /v1/products/:productId/photos/:photoId/:variant', () => {
  it('allows the owning creator to fetch their own private photo bytes with no-store headers', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'hello-display');
    const photo = await makePrivatePhoto(product.id, user.id, prefix);

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.rawPayload.toString()).toBe('hello-display');
    await app.close();
  });

  it('allows admin to fetch any private photo', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders('admin');
    const product = await makeProduct(owner.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'admin-view');
    const photo = await makePrivatePhoto(product.id, owner.id, prefix);

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/thumb`, headers });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects another (non-owner) user', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders();
    const product = await makeProduct(owner.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'secret');
    const photo = await makePrivatePhoto(product.id, owner.id, prefix);

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('reviewer-p3 C2 regression: rejects an unrelated authenticated user for a rejected photo on an active product (the exact proven exploit)', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders();
    const product = await makeProduct(owner.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'REJECTED-ABUSIVE-CONTENT');
    const photo = await makePrivatePhoto(product.id, owner.id, prefix, 'rejected');

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects a rejected photo for its own creator too — visible to no one but an admin', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'rejected-own');
    const photo = await makePrivatePhoto(product.id, user.id, prefix, 'rejected');

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('allows admin to fetch a rejected photo', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders('admin');
    const product = await makeProduct(owner.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'rejected-admin-view');
    const photo = await makePrivatePhoto(product.id, owner.id, prefix, 'rejected');

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects an unrelated user for a merely-pending photo on an active product too', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders();
    const product = await makeProduct(owner.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'pending-on-active');
    const photo = await makePrivatePhoto(product.id, owner.id, prefix, 'pending');

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('allows the creator to fetch their own still-pending photo on their active product', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'own-pending-on-active');
    const photo = await makePrivatePhoto(product.id, user.id, prefix, 'pending');

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects an anonymous (unauthenticated) request', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct(owner.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'secret');
    const photo = await makePrivatePhoto(product.id, owner.id, prefix);

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display` });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects a revoked/invalid access token', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const product = await makeProduct(owner.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'secret');
    const photo = await makePrivatePhoto(product.id, owner.id, prefix);

    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/${product.id}/photos/${photo.id}/display`,
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects an invalid variant name', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'x');
    const photo = await makePrivatePhoto(product.id, user.id, prefix);

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/original`, headers });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a photo ID that belongs to a different product (mismatched parent, non-enumerating)', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const productA = await makeProduct(user.id);
    const productB = await makeProduct(user.id);
    const prefix = privateProductPhotoPrefix(productA.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'a-only');
    const photo = await makePrivatePhoto(productA.id, user.id, prefix);

    // Same photo ID, but requested through productB's URL — must not resolve.
    const res = await app.inject({ method: 'GET', url: `/v1/products/${productB.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('404s a photo that has already been approved/published (no private bytes left to serve)', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const photo = await getPrisma().productPhoto.create({
      data: {
        productId: product.id,
        position: 0,
        uploadedByUserId: user.id,
        moderationStatus: 'approved',
        mimeType: 'image/webp',
        displayByteSize: 1,
        displayWidth: 1,
        displayHeight: 1,
        thumbnailByteSize: 1,
        thumbnailWidth: 1,
        thumbnailHeight: 1,
        publicStorageKey: `public/products/${product.id}/${randomUUID()}`,
      },
    });
    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/photos/${photo.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /v1/product-edits/:editId/photos/:photoId/:variant', () => {
  async function makeProductEdit(submittedBy: string, productId: string) {
    return getPrisma().productEdit.create({
      data: { productId, submittedBy, proposed: {} },
    });
  }

  it('allows the edit submitter to fetch a staged edit photo', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const edit = await makeProductEdit(user.id, product.id);
    const prefix = privateProductEditPhotoPrefix(edit.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'staged-bytes');
    const editPhoto = await getPrisma().productEditPhoto.create({
      data: { productEditId: edit.id, position: 0, uploadedByUserId: user.id, privateStorageKey: prefix, mimeType: 'image/webp', displayByteSize: 1, displayWidth: 1, displayHeight: 1, thumbnailByteSize: 1, thumbnailWidth: 1, thumbnailHeight: 1 },
    });

    const res = await app.inject({ method: 'GET', url: `/v1/product-edits/${edit.id}/photos/${editPhoto.id}/display`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.toString()).toBe('staged-bytes');
    expect(res.headers['cache-control']).toBe('private, no-store');
    await app.close();
  });

  it('allows admin to fetch a staged edit photo submitted by someone else', async () => {
    const app = await buildServer();
    const submitter = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders('admin');
    const product = await makeProduct(submitter.id, 'active');
    const edit = await makeProductEdit(submitter.id, product.id);
    const prefix = privateProductEditPhotoPrefix(edit.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'admin-staged');
    const editPhoto = await getPrisma().productEditPhoto.create({
      data: { productEditId: edit.id, position: 0, uploadedByUserId: submitter.id, privateStorageKey: prefix, mimeType: 'image/webp', displayByteSize: 1, displayWidth: 1, displayHeight: 1, thumbnailByteSize: 1, thumbnailWidth: 1, thumbnailHeight: 1 },
    });

    const res = await app.inject({ method: 'GET', url: `/v1/product-edits/${edit.id}/photos/${editPhoto.id}/thumb`, headers });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects another (non-submitter, non-admin) user', async () => {
    const app = await buildServer();
    const submitter = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders();
    const product = await makeProduct(submitter.id, 'active');
    const edit = await makeProductEdit(submitter.id, product.id);
    const prefix = privateProductEditPhotoPrefix(edit.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'nope');
    const editPhoto = await getPrisma().productEditPhoto.create({
      data: { productEditId: edit.id, position: 0, uploadedByUserId: submitter.id, privateStorageKey: prefix, mimeType: 'image/webp', displayByteSize: 1, displayWidth: 1, displayHeight: 1, thumbnailByteSize: 1, thumbnailWidth: 1, thumbnailHeight: 1 },
    });

    const res = await app.inject({ method: 'GET', url: `/v1/product-edits/${edit.id}/photos/${editPhoto.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects a photo ID requested through the wrong edit ID (mismatched parent)', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const editA = await makeProductEdit(user.id, product.id);
    const editB = await getPrisma().productEdit.create({ data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: true } });
    const prefix = privateProductEditPhotoPrefix(editA.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'edit-a-only');
    const editPhoto = await getPrisma().productEditPhoto.create({
      data: { productEditId: editA.id, position: 0, uploadedByUserId: user.id, privateStorageKey: prefix, mimeType: 'image/webp', displayByteSize: 1, displayWidth: 1, displayHeight: 1, thumbnailByteSize: 1, thumbnailWidth: 1, thumbnailHeight: 1 },
    });

    const res = await app.inject({ method: 'GET', url: `/v1/product-edits/${editB.id}/photos/${editPhoto.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects a retained entry (no staged bytes of its own — sourceProductPhotoId set instead)', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'source-photo');
    const sourcePhoto = await makePrivatePhoto(product.id, user.id, prefix);
    const edit = await makeProductEdit(user.id, product.id);
    const retained = await getPrisma().productEditPhoto.create({
      data: { productEditId: edit.id, position: 0, sourceProductPhotoId: sourcePhoto.id },
    });

    const res = await app.inject({ method: 'GET', url: `/v1/product-edits/${edit.id}/photos/${retained.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects cross-kind photo-ID substitution (a ProductPhoto ID against the edit-media route)', async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'product-photo');
    const productPhoto = await makePrivatePhoto(product.id, user.id, prefix);
    const edit = await makeProductEdit(user.id, product.id);

    const res = await app.inject({ method: 'GET', url: `/v1/product-edits/${edit.id}/photos/${productPhoto.id}/display`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /v1/products/:id — reviewer-p3 C2 layer (b): the response never enumerates a non-approved photo URL', () => {
  it("excludes a rejected photo's URL from an unrelated user's product read, even though the product itself is active/visible", async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders();
    const product = await makeProduct(owner.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'rejected');
    await makePrivatePhoto(product.id, owner.id, prefix, 'rejected');

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().photos).toEqual([]);
    await app.close();
  });

  it("still shows the creator their own product's pending photo URL on their own read", async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const product = await makeProduct(user.id, 'active');
    const prefix = privateProductPhotoPrefix(product.id, randomUUID(), randomUUID());
    await writeVariantBytes(prefix, 'own-pending');
    const photo = await makePrivatePhoto(product.id, user.id, prefix, 'pending');

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().photos.map((p: { id: string }) => p.id)).toEqual([photo.id]);
    await app.close();
  });
});
