import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeAdmin } from '../helpers/admin.js';
import { makeUser, makeProduct, makeRecord, makeGiveaway } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { mergeProducts } from '../../src/services/admin/merge.js';
import { ERROR_CODES } from '@expyrico/shared';

describe('Admin Product Delete Integration', () => {
  let app: FastifyInstance;
  let adminHeaders: Record<string, string>;
  let adminUser: { id: string };

  beforeEach(async () => {
    app = await buildServer();
    const { admin, headers } = await makeAdmin();
    adminUser = admin;
    adminHeaders = headers;
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. Direct deletion of unused product frees barcode and records audit log', async () => {
    const prisma = getPrisma();
    const barcode = `del-test-${randomUUID().slice(0, 8)}`;
    const product = await makeProduct({ barcode, status: 'active', version: 1 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(204);

    // Verify row is deleted
    const deleted = await prisma.product.findUnique({ where: { id: product.id } });
    expect(deleted).toBeNull();

    // Verify barcode can be reused
    const newProduct = await makeProduct({ barcode, status: 'active' });
    expect(newProduct.barcode).toBe(barcode);

    // Verify audit log
    const audit = await prisma.adminAuditLog.findFirst({
      where: { targetType: 'product', targetId: product.id, action: 'product.delete' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.adminId).toBe(adminUser.id);
  });

  it('2. Deletion is blocked for product in use with 409 PRODUCT_HAS_PANTRY_ITEMS', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct({ status: 'active', version: 1 });
    await makeRecord(user.id, { productId: product.id });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe(ERROR_CODES.PRODUCT_HAS_PANTRY_ITEMS);

    // Product remains intact
    const stillThere = await prisma.product.findUnique({ where: { id: product.id } });
    expect(stillThere).not.toBeNull();
  });

  it('3. Optimistic concurrency: mismatched version returns 409 version_conflict', async () => {
    const prisma = getPrisma();
    const product = await makeProduct({ status: 'active', version: 2 });
    expect(product.version).toBe(2);
    const persistedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(persistedProduct.version).toBe(2);

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe(ERROR_CODES.VERSION_CONFLICT);
    expect(body.currentVersion).toBe(2);

    const stillThere = await prisma.product.findUnique({ where: { id: product.id } });
    expect(stillThere).not.toBeNull();
  });

  it('4. Inbound merged alias blocks deletion', async () => {
    const prisma = getPrisma();
    const targetProduct = await makeProduct({ status: 'active', version: 1 });
    // Product A merged into targetProduct
    const aliasProduct = await makeProduct({ status: 'merged_into', mergedIntoProductId: targetProduct.id });
    expect(aliasProduct.mergedIntoProductId).toBe(targetProduct.id);
    const persistedAlias = await prisma.product.findUniqueOrThrow({ where: { id: aliasProduct.id } });
    expect(persistedAlias.mergedIntoProductId).toBe(targetProduct.id);

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${targetProduct.id}?version=1`,
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe(ERROR_CODES.PRODUCT_HAS_PANTRY_ITEMS);

    const stillThere = await prisma.product.findUnique({ where: { id: targetProduct.id } });
    expect(stillThere).not.toBeNull();
  });

  it('5. Open revision blocks deletion', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct({ status: 'active', version: 1 });

    await prisma.productEdit.create({
      data: {
        productId: product.id,
        submittedBy: user.id,
        proposed: { name: 'New Name' },
        status: 'pending',
        isLegacy: false,
        version: 1,
        baseProductVersion: 1,
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe(ERROR_CODES.CONFLICT);

    const stillThere = await prisma.product.findUnique({ where: { id: product.id } });
    expect(stillThere).not.toBeNull();
  });

  it('6. Giveaway referencing the product is detached to null', async () => {
    const prisma = getPrisma();
    const giver = await makeUser();
    const product = await makeProduct({ status: 'active', version: 1 });
    const giveaway = await makeGiveaway({ giverUserId: giver.id, productId: product.id });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(204);

    const updatedGiveaway = await prisma.giveaway.findUnique({ where: { id: giveaway.id } });
    expect(updatedGiveaway?.productId).toBeNull();
  });

  it('7. Associated photos trigger media cleanup outbox enqueue', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const product = await makeProduct({ status: 'active', version: 1 });

    const photoKey = `test-photo-${randomUUID()}`;
    await prisma.productPhoto.create({
      data: {
        productId: product.id,
        position: 0,
        uploadedByUserId: user.id,
        moderationStatus: 'approved',
        publicStorageKey: photoKey,
        mimeType: 'image/webp',
        displayByteSize: 100,
        displayWidth: 100,
        displayHeight: 100,
        thumbnailByteSize: 50,
        thumbnailWidth: 50,
        thumbnailHeight: 50,
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(204);

    const cleanupOutbox = await prisma.mediaOperationOutbox.findFirst({
      where: {
        operation: 'delete_public',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(cleanupOutbox).not.toBeNull();
    const payload = cleanupOutbox?.payload as { keys: string[] };
    expect(payload.keys).toContain(photoKey);
  });

  it('8. Polymorphic reports targeting the deleted product are dismissed', async () => {
    const prisma = getPrisma();
    const reporter = await makeUser();
    const product = await makeProduct({ status: 'active', version: 1 });

    const report = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: 'product',
        targetId: product.id,
        reason: 'spam',
        status: 'open',
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(204);

    const updatedReport = await prisma.report.findUnique({ where: { id: report.id } });
    expect(updatedReport?.status).toBe('dismissed');
    expect(updatedReport?.resolvedByAdminId).toBe(adminUser.id);
  });

  it('9. "Hide from search" source merges successfully into active target', async () => {
    const prisma = getPrisma();
    const user = await makeUser();
    const hiddenSource = await makeProduct({ status: 'report_hidden', version: 1, barcode: null });
    const activeTarget = await makeProduct({ status: 'active', version: 1 });
    const record = await makeRecord(user.id, { productId: hiddenSource.id });

    // Calling mergeProducts directly
    const result = await mergeProducts(
      { id: adminUser.id, role: 'admin' },
      { ip: '127.0.0.1' },
      [hiddenSource.id],
      activeTarget.id,
      1,
    );

    expect(result.targetId).toBe(activeTarget.id);

    // Record is repointed to activeTarget
    const updatedRecord = await prisma.record.findUnique({ where: { id: record.id } });
    expect(updatedRecord?.productId).toBe(activeTarget.id);

    // Source is retired as merged_into
    const updatedSource = await prisma.product.findUnique({ where: { id: hiddenSource.id } });
    expect(updatedSource?.status).toBe('merged_into');
    expect(updatedSource?.mergedIntoProductId).toBe(activeTarget.id);
  });

  it('10. RBAC: Unauthenticated rejected with 401, non-admin rejected with 403', async () => {
    const product = await makeProduct({ status: 'active', version: 1 });

    // Unauthenticated
    const resNoAuth = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
    });
    expect(resNoAuth.statusCode).toBe(401);

    // Non-admin user
    const regularUser = await makeUser();
    const userToken = await issueAccessToken({ sub: regularUser.id, role: 'user', tokenVersion: regularUser.tokenVersion });
    const resUser = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/products/${product.id}?version=1`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(resUser.statusCode).toBe(403);
  });

  it('11. POST /v1/records with deleted product returns 404 with product_not_found code', async () => {
    const user = await makeUser();
    const userToken = await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: user.tokenVersion });
    const deletedProductId = randomUUID();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: {
        authorization: `Bearer ${userToken}`,
        'idempotency-key': randomUUID(),
      },
      payload: {
        clientId: randomUUID(),
        productId: deletedProductId,
        customName: 'Custom Juice',
        quantity: 1,
        unit: 'pcs',
        expiryDate: '2026-12-31',
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
  });
});
