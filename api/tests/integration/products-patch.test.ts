import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { makeAdmin } from '../helpers/admin.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('PATCH /v1/products/:id', () => {
  it('creates a pending product_edits row, does NOT mutate the product', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const p = await makeProduct({ name: 'Old Name' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: { name: 'New Name', brand: 'Acme' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('pending');

    const fresh = await getPrisma().product.findUnique({ where: { id: p.id } });
    expect(fresh?.name).toBe('Old Name'); // unchanged

    const edits = await getPrisma().productEdit.findMany({ where: { productId: p.id } });
    expect(edits).toHaveLength(1);
    expect(edits[0]!.submittedBy).toBe(user.id);
    expect(edits[0]!.status).toBe('pending');
    expect((edits[0]!.proposed as { name?: string }).name).toBe('New Name');
    await app.close();
  });

  it('marks the created edit isLegacy:false so the one-open-edit constraint applies', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const p = await makeProduct({});
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: { name: 'New Name' },
    });
    expect(res.statusCode).toBe(202);
    const edit = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: res.json().editId } });
    expect(edit.isLegacy).toBe(false);
    await app.close();
  });

  it('blocks a second concurrent open edit by the same submitter via the real writer path', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const p = await makeProduct({});
    // Two concurrent PATCH requests from the same authenticated caller against the
    // same product — the DB partial unique index (not an app-level pre-check) must
    // resolve the race so exactly one succeeds.
    const [first, second] = await Promise.all([
      app.inject({ method: 'PATCH', url: `/v1/products/${p.id}`, headers, payload: { name: 'Attempt 1' } }),
      app.inject({ method: 'PATCH', url: `/v1/products/${p.id}`, headers, payload: { name: 'Attempt 2' } }),
    ]);
    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([202, 409]);

    const edits = await getPrisma().productEdit.findMany({ where: { productId: p.id } });
    expect(edits).toHaveLength(1);
    await app.close();
  });

  it('a sequential (non-racing) second patch is blocked while the first edit is genuinely pending', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const p = await makeProduct({});
    const first = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: { name: 'Attempt 1' },
    });
    expect(first.statusCode).toBe(202);
    expect(first.json().status).toBe('pending');

    const second = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: { name: 'Attempt 2' },
    });
    expect(second.statusCode).toBe(409);
    await app.close();
  });

  it('resubmits an existing changes_required edit in place instead of dead-ending the creator', async () => {
    const app = await buildServer();
    const { headers: adminHeaders } = await makeAdmin();
    const { headers } = await authed();
    const p = await makeProduct({ name: 'Original' });
    const prisma = getPrisma();

    // 1. Creator patches -> pending.
    const firstPatch = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: { name: 'First proposal' },
    });
    expect(firstPatch.statusCode).toBe(202);
    const editId = firstPatch.json().editId as string;

    // 2. Admin requests changes -> changes_required, with feedback.
    const requestChanges = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/products/pending/${editId}`,
      headers: adminHeaders,
      payload: { decision: 'request_changes', notes: 'Please fix the name.' },
    });
    expect(requestChanges.statusCode).toBe(200);
    const afterRequestChanges = await prisma.productEdit.findUniqueOrThrow({ where: { id: editId } });
    expect(afterRequestChanges.status).toBe('changes_required');
    expect(afterRequestChanges.moderationNotes).toBe('Please fix the name.');

    // 3. Creator patches again — must succeed (not dead-end at 409) by updating the
    // same edit row in place, clearing the old feedback and returning it to pending.
    const secondPatch = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: { name: 'Revised proposal' },
    });
    expect(secondPatch.statusCode).toBe(202);
    expect(secondPatch.json().editId).toBe(editId);
    expect(secondPatch.json().status).toBe('pending');

    const editsForProduct = await prisma.productEdit.findMany({ where: { productId: p.id } });
    expect(editsForProduct).toHaveLength(1); // updated in place, not a second row
    const updated = editsForProduct[0]!;
    expect(updated.status).toBe('pending');
    expect(updated.moderationNotes).toBeNull();
    expect((updated.proposed as { name?: string }).name).toBe('Revised proposal');

    // 4. Admin sees it in the pending queue again and can resolve it.
    const pendingList = await app.inject({ method: 'GET', url: '/v1/admin/products/pending', headers: adminHeaders });
    expect(pendingList.statusCode).toBe(200);
    expect(pendingList.json().items.some((i: { id: string }) => i.id === editId)).toBe(true);

    const approve = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/products/pending/${editId}`,
      headers: adminHeaders,
      payload: { decision: 'approve' },
    });
    expect(approve.statusCode).toBe(200);
    const finalProduct = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(finalProduct.name).toBe('Revised proposal');
    await app.close();
  });

  it('404 on unknown product', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/products/00000000-0000-0000-0000-000000000000',
      headers,
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('400 on empty patch', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const p = await makeProduct({});
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
