import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { randomUUID } from 'node:crypto';
import {
  setProductCreationAssessmentClientForTests,
  resetProductCreationAssessmentBreakerForTests,
} from '../../src/services/abuse/product-creation-assessment.js';

function stubAssessmentClient() {
  setProductCreationAssessmentClientForTests({
    projectPath: (p: string) => `projects/${p}`,
    createAssessment: async () => [
      { tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.9, reasons: [] } },
    ],
  } as never);
}

afterEach(() => {
  setProductCreationAssessmentClientForTests(undefined);
  resetProductCreationAssessmentBreakerForTests();
});

async function authedUser(requireProductApproval = false) {
  const u = await makeUser({ emailVerified: true });
  if (requireProductApproval) {
    await getPrisma().user.update({
      where: { id: u.id },
      data: { requireProductApproval: true },
    });
  }
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('Product Approval Policy: Global & Per-User matrix', () => {
  it('Scenario A: Auto-approves to active when global approval is disabled and user is not flagged', async () => {
    stubAssessmentClient();
    const prisma = getPrisma();
    await prisma.setting.update({
      where: { key: 'product_creation' },
      data: { value: { mode: 'all', requireApproval: false } },
    });

    const { user, headers } = await authedUser(false);
    const product = await makeProduct({
      createdByUserId: user.id,
      name: 'Organic Green Tea',
    });
    await prisma.product.update({ where: { id: product.id }, data: { status: 'draft' } });

    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${product.id}/submit`,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { version: 1, abuseToken: 'valid-token', platform: 'android' },
    });
    if (res.statusCode !== 200) console.log('ERROR RESPONSE:', res.json());
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('active');

    const inDb = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(inDb.status).toBe('active');
    expect(inDb.moderationNotes).toContain('Auto-approved');
  });

  it('Scenario B: Diverts to pending when user is flagged for approval despite global auto-approval', async () => {
    stubAssessmentClient();
    const prisma = getPrisma();
    await prisma.setting.update({
      where: { key: 'product_creation' },
      data: { value: { mode: 'all', requireApproval: false } },
    });

    // Spam-flagged user
    const { user, headers } = await authedUser(true);
    const product = await makeProduct({
      createdByUserId: user.id,
      name: 'Suspect Spam Product',
    });
    await prisma.product.update({ where: { id: product.id }, data: { status: 'draft' } });

    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${product.id}/submit`,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { version: 1, abuseToken: 'valid-token', platform: 'android' },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('pending');

    const inDb = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(inDb.status).toBe('pending');
  });

  it('Scenario C: Diverts to pending when global approval is enabled even if user is not flagged', async () => {
    stubAssessmentClient();
    const prisma = getPrisma();
    await prisma.setting.update({
      where: { key: 'product_creation' },
      data: { value: { mode: 'all', requireApproval: true } },
    });

    const { user, headers } = await authedUser(false);
    const product = await makeProduct({
      createdByUserId: user.id,
      name: 'Pending Moderation Item',
    });
    await prisma.product.update({ where: { id: product.id }, data: { status: 'draft' } });

    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${product.id}/submit`,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { version: 1, abuseToken: 'valid-token', platform: 'android' },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('pending');

    const inDb = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(inDb.status).toBe('pending');
  });

  it('Scenario D: Admin can update requireProductApproval on a user via PATCH /v1/admin/users/:id', async () => {
    const prisma = getPrisma();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const target = await makeUser({ role: 'user', emailVerified: true });
    const adminToken = await issueAccessToken({ sub: admin.id, role: 'admin', tokenVersion: 0 });

    const app = await buildServer();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/users/${target.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { requireProductApproval: true },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.requireProductApproval).toBe(true);

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(inDb.requireProductApproval).toBe(true);
  });

  it('Scenario E: Admin can update requireApproval setting via PATCH /v1/admin/settings/product-creation', async () => {
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const adminToken = await issueAccessToken({ sub: admin.id, role: 'admin', tokenVersion: 0 });

    const app = await buildServer();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/product-creation',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { mode: 'all', requireApproval: true },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.requireApproval).toBe(true);
  });

});
