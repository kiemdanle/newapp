import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import type { ProcessedVariants } from '../../src/services/products/product-image-processor.js';
import { addProductPhoto } from '../../src/services/products/product-photos.js';
import { reserveMediaCapacity } from '../../src/services/products/product-media-capacity.js';
import {
  createOrResumeProductEdit,
  patchProductEditMetadata,
  resolveProductEdit,
  recoverProductEdit,
} from '../../src/services/products/product-edits.js';

const BOUNDARY = '----expyricoProductEditsTestBoundary';

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

let root: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'product-edits-test-'));
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
});

async function fakeProcessedUpload(): Promise<ProcessedVariants> {
  const buf = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'teal' } }).jpeg().toBuffer();
  return {
    sourceMimeType: 'image/jpeg',
    display: { variant: 'display', buffer: buf, width: 20, height: 20, bytes: buf.length },
    thumb: { variant: 'thumb', buffer: buf, width: 20, height: 20, bytes: buf.length },
  };
}

/** Direct photo mutation on an `active` product is admin-only (creator revisions to
 * a live catalog product go through the moderated `ProductEdit` flow, never this
 * direct path), so a live/retained-photo fixture attaches the photo while the
 * product is still a `draft` and simulates the "already approved and published"
 * state a real moderation approval would have produced, before flipping the
 * product to `active`. */
async function makeActiveProduct(
  creatorId: string,
  overrides: { name?: string; imageUrl?: string | null; withPhoto?: boolean } = {},
) {
  const draft = await getPrisma().product.create({
    data: {
      barcode: `bc-${randomUUID()}`,
      name: overrides.name ?? 'Live Product',
      source: 'user',
      createdByUserId: creatorId,
      status: 'draft',
      imageUrl: overrides.imageUrl ?? null,
    },
  });
  if (overrides.withPhoto) {
    const reservation = await reserveMediaCapacity({ bytes: 10_000 });
    const processed = await fakeProcessedUpload();
    const withPhoto = await addProductPhoto({ id: creatorId, role: 'user' }, { productId: draft.id, processed, capacityReservationId: reservation.id });
    const photo = withPhoto.photos[0]!;
    await getPrisma().productPhoto.update({
      where: { id: photo.id },
      data: { moderationStatus: 'approved', publicStorageKey: `public/products/${draft.id}/${randomUUID()}`, privateStorageKey: null },
    });
  }
  return getPrisma().product.update({ where: { id: draft.id }, data: { status: 'active' } });
}

const actor = (id: string) => ({ id, role: 'user' as const });
const adminActor = (id: string) => ({ id, role: 'admin' as const });

describe('createOrResumeProductEdit', () => {
  it('creates a new draft revision seeded from the live product, including retained live photos', async () => {
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id, { withPhoto: true });

    const { edit, resumed } = await createOrResumeProductEdit(actor(creator.id), product.id);
    expect(resumed).toBe(false);
    expect(edit.status).toBe('draft');
    expect(edit.baseProductVersion).toBe(product.version);
    expect(edit.name).toBe(product.name);
    expect(edit.photos).toHaveLength(1);
    expect(edit.photos[0]!.retained).toBe(true);
  });

  it('resumes the caller\'s own open edit instead of creating a second one (one-open-edit race)', async () => {
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);

    const results = await Promise.allSettled([
      createOrResumeProductEdit(actor(creator.id), product.id),
      createOrResumeProductEdit(actor(creator.id), product.id),
    ]);
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    expect(succeeded).toHaveLength(2);
    const editIds = new Set(succeeded.map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof createOrResumeProductEdit>>>).value.edit.id));
    expect(editIds.size).toBe(1);

    const rows = await getPrisma().productEdit.findMany({ where: { productId: product.id } });
    expect(rows).toHaveLength(1);
  });

  it('rejects a resume attempt while the caller\'s edit is pending under review', async () => {
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    await getPrisma().productEdit.create({
      data: { productId: product.id, submittedBy: creator.id, proposed: {}, status: 'pending', isLegacy: false },
    });
    await expect(createOrResumeProductEdit(actor(creator.id), product.id)).rejects.toMatchObject({ status: 409 });
  });

  it('allows any authenticated user to open a suggestion on someone else\'s active product (open-editing, same policy as the legacy PATCH route), but 404s a non-active product', async () => {
    const creator = await makeUserForAdmin();
    const other = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(other.id), product.id);
    expect(edit.productId).toBe(product.id);

    const draft = await getPrisma().product.create({ data: { barcode: `bc-${randomUUID()}`, name: 'D', source: 'user', createdByUserId: creator.id, status: 'draft' } });
    await expect(createOrResumeProductEdit(actor(creator.id), draft.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('patchProductEditMetadata', () => {
  it('updates fields in place and version-guards concurrent patches', async () => {
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);

    const patched = await patchProductEditMetadata(actor(creator.id), edit.id, { version: edit.version, name: 'New Name' });
    expect(patched.name).toBe('New Name');
    expect(patched.version).toBe(edit.version + 1);

    await expect(
      patchProductEditMetadata(actor(creator.id), edit.id, { version: edit.version, brand: 'Acme' }),
    ).rejects.toMatchObject({ status: 409, code: 'version_conflict' });
  });

  it('rejects another user and a pending edit', async () => {
    const creator = await makeUserForAdmin();
    const other = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    await expect(patchProductEditMetadata(actor(other.id), edit.id, { version: edit.version, name: 'X' })).rejects.toMatchObject({ status: 404 });

    await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    await expect(patchProductEditMetadata(actor(creator.id), edit.id, { version: edit.version + 1, name: 'X' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('resolveProductEdit — submit / request_changes / approve', () => {
  it('submits draft -> pending, then admin request_changes returns it with a reason (never rejected)', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);

    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    expect('status' in submitted && submitted.status).toBe('pending');

    const afterRC = await resolveProductEdit(
      adminActor(admin.id),
      {},
      { editId: edit.id, action: 'request_changes', version: (submitted as { version: number }).version, notes: 'fix the name' },
    );
    expect('status' in afterRC && afterRC.status).toBe('changes_required');
    expect((afterRC as { moderationFeedback: string | null }).moderationFeedback).toBe('fix the name');

    // Creator can resubmit after changes_required.
    const resubmitted = await resolveProductEdit(
      actor(creator.id),
      {},
      { editId: edit.id, action: 'submit', version: (afterRC as { version: number }).version },
    );
    expect('status' in resubmitted && resubmitted.status).toBe('pending');
  });

  it('approve applies metadata + retained/staged photo order and publishes staged bytes', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id, { withPhoto: true });
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);

    const patched = await patchProductEditMetadata(actor(creator.id), edit.id, { version: edit.version, name: 'Revised Name' });
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: patched.version });
    const submittedVersion = (submitted as { version: number }).version;

    const approved = await resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: submittedVersion });
    expect('name' in approved && approved.name).toBe('Revised Name');
    expect('status' in approved && approved.status).toBe('active');

    const dbEdit = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect(dbEdit.status).toBe('approved');
    const dbProduct = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(dbProduct.name).toBe('Revised Name');
    expect(dbProduct.version).toBe(product.version + 1);
  });

  it('rejects approve on another user\'s or a non-pending edit, and replay after approval', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    await expect(resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: edit.version })).rejects.toMatchObject({ status: 409 });

    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    const v = (submitted as { version: number }).version;
    await resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: v });
    await expect(resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: v })).rejects.toMatchObject({ status: 409 });
  });

  it('a metadata-only revision on a legacy imageUrl product preserves the compatibility imageUrl', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id, { imageUrl: 'https://legacy.example/img.jpg' });
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const patched = await patchProductEditMetadata(actor(creator.id), edit.id, { version: edit.version, name: 'New Legacy Name' });
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: patched.version });
    await resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: (submitted as { version: number }).version });

    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.imageUrl).toBe('https://legacy.example/img.jpg');
    expect(after.name).toBe('New Legacy Name');
  });

  it('public product bytes/DTO stay unchanged while the edit is draft/pending/changes_required', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    await patchProductEditMetadata(actor(creator.id), edit.id, { version: edit.version, name: 'Not Live Yet' });
    let current = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(current.name).toBe(product.name);

    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: 2 });
    current = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(current.name).toBe(product.name);

    await resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'request_changes', version: (submitted as { version: number }).version, notes: 'no' });
    current = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(current.name).toBe(product.name);
  });

  it('on stale base (product changed since edit was based on it), approve returns a typed conflict pointing to recovery', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });

    // Directly correct the live product (bumps its version) out from under the edit.
    await getPrisma().product.update({ where: { id: product.id }, data: { name: 'Corrected directly', version: { increment: 1 } } });

    await expect(
      resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: (submitted as { version: number }).version }),
    ).rejects.toMatchObject({ status: 409, code: 'edit_base_stale' });
  });
});

describe('recoverProductEdit — rebase and supersede', () => {
  async function staleSubmittedEdit() {
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id, { withPhoto: true });
    const livePhotoId = (await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } })).id;
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    const staleProduct = await getPrisma().product.update({ where: { id: product.id }, data: { version: { increment: 1 } } });
    return { creator, product: staleProduct, edit: submitted as { id: string; version: number }, livePhotoId };
  }

  it('supersede closes the edit as rejected with a machine-safe reason distinct from admin notes, and frees the slot', async () => {
    const { admin } = await makeAdmin();
    const { creator, product, edit } = await staleSubmittedEdit();

    const result = await recoverProductEdit(adminActor(admin.id), {}, {
      action: 'supersede',
      editId: edit.id,
      editVersion: edit.version,
      productVersion: product.version,
      notes: 'admin free text reason',
    });
    expect(result.status).toBe('rejected');

    const dbEdit = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect(dbEdit.notes).toBe('superseded:stale_base_version');
    expect(dbEdit.moderationNotes).toBe('admin free text reason');

    // Slot is free: the creator can open a new edit again.
    const { resumed } = await createOrResumeProductEdit(actor(creator.id), product.id);
    expect(resumed).toBe(false);
  });

  it('rebase requires an explicit reviewed desired-photo mapping and returns the edit to pending', async () => {
    const { admin } = await makeAdmin();
    const { product, edit, livePhotoId } = await staleSubmittedEdit();

    const result = await recoverProductEdit(adminActor(admin.id), {}, {
      action: 'rebase',
      editId: edit.id,
      editVersion: edit.version,
      productVersion: product.version,
      desiredPhotoOrder: [{ type: 'retained', sourceProductPhotoId: livePhotoId }],
    });
    expect(result.status).toBe('pending');
    expect(result.baseProductVersion).toBe(product.version);
    expect(result.photos).toHaveLength(1);
  });

  it('version-guards both editVersion and productVersion with no silent auto-pick', async () => {
    const { admin } = await makeAdmin();
    const { product, edit } = await staleSubmittedEdit();

    await expect(
      recoverProductEdit(adminActor(admin.id), {}, {
        action: 'supersede',
        editId: edit.id,
        editVersion: edit.version + 5,
        productVersion: product.version,
      }),
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      recoverProductEdit(adminActor(admin.id), {}, {
        action: 'supersede',
        editId: edit.id,
        editVersion: edit.version,
        productVersion: product.version + 5,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('edit-scoped photo staging routes', () => {
  async function jpegBytes(): Promise<Buffer> {
    return sharp({ create: { width: 20, height: 20, channels: 3, background: 'teal' } }).jpeg().toBuffer();
  }

  it('stages a photo on an edit, reorders, and deletes it with durable cleanup', async () => {
    const app = await buildServer();
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const token = await issueAccessToken({ sub: creator.id, role: 'user', tokenVersion: 0 });
    const headers = { authorization: `Bearer ${token}` };

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/product-edits/${edit.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipartBody([{ name: 'file', filename: 'photo.jpg', contentType: 'image/jpeg', content: await jpegBytes() }]),
    });
    expect(uploadRes.statusCode).toBe(201);
    const afterUpload = uploadRes.json();
    expect(afterUpload.photos).toHaveLength(1);
    expect(afterUpload.photos[0].retained).toBe(false);

    const stagedPhotoId = afterUpload.photos[0].id;
    const deleteRes = await app.inject({ method: 'DELETE', url: `/v1/product-edits/${edit.id}/photos/${stagedPhotoId}`, headers });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().photos).toHaveLength(0);

    const staged = await getPrisma().productEditPhoto.findFirst({ where: { productEditId: edit.id } });
    expect(staged).toBeNull();
    await app.close();
  });

  it('rejects another user staging a photo on someone else\'s edit', async () => {
    const app = await buildServer();
    const creator = await makeUserForAdmin();
    const other = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const token = await issueAccessToken({ sub: other.id, role: 'user', tokenVersion: 0 });
    const headers = { authorization: `Bearer ${token}` };

    const res = await app.inject({
      method: 'POST',
      url: `/v1/product-edits/${edit.id}/photos`,
      headers: { ...headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipartBody([{ name: 'file', filename: 'photo.jpg', contentType: 'image/jpeg', content: await jpegBytes() }]),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
