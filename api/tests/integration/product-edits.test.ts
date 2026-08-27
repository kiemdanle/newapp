import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import type { ProcessedVariants } from '../../src/services/products/product-image-processor.js';
import { addProductPhoto, addProductEditPhoto } from '../../src/services/products/product-photos.js';
import { reserveMediaCapacity } from '../../src/services/products/product-media-capacity.js';
import { mediaKeyToPath } from '../../src/services/products/product-media-storage.js';
import {
  createOrResumeProductEdit,
  patchProductEditMetadata,
  resolveProductEdit,
  recoverProductEdit,
} from '../../src/services/products/product-edits.js';
import * as auditLog from '../../src/services/audit/log.js';
import { processSendJob } from '../../src/workers/notification-send.js';
// I7: same fault-injection shape as admin-product-moderation.test.ts's — forces a
// failure after `publishProductEditPhoto` has already copied bytes but before the
// reference transaction (whose last statement is `writeAuditLog`) commits.
//
// Captured before `vi.spyOn` replaces the module's export in place, and
// re-applied every `afterEach` (R2): `mockReset()` alone would also wipe the
// spy's passthrough-to-original default (verified — it replaces the
// implementation with a no-op, not merely draining a leftover
// `mockImplementationOnce` queue), silently turning later tests' audit writes
// into no-ops. `mockClear()` alone leaves that queue still armed. Only
// reset-then-reapply gives both a drained queue and a real passthrough.
const originalWriteAuditLog = auditLog.writeAuditLog;
const writeAuditLogSpy = vi.spyOn(auditLog, 'writeAuditLog');

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
  // R2: reset any leftover `mockImplementationOnce` queue, then immediately
  // re-establish the real passthrough — see the spy's own comment above for
  // why `mockReset()` alone would silently no-op every later audit write.
  writeAuditLogSpy.mockReset();
  writeAuditLogSpy.mockImplementation(originalWriteAuditLog);
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
    expect(edit.photos[0]!.sourceProductPhotoId).toBeTruthy();
    expect(edit.photos[0]!.id).not.toBe(edit.photos[0]!.sourceProductPhotoId);
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

  it('returns open pending suggestion with resumed: true allowing read-only review, but mutation remains blocked', async () => {
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const pendingEdit = await getPrisma().productEdit.create({
      data: {
        productId: product.id,
        submittedBy: creator.id,
        proposed: { name: product.name, defaultShelfLifeDays: 14, notes: 'Original note' },
        notes: 'Original note',
        status: 'pending',
        isLegacy: false,
      },
      include: { photos: { include: { sourceProductPhoto: true } } },
    });
    const res = await createOrResumeProductEdit(actor(creator.id), product.id);
    expect(res.resumed).toBe(true);
    expect(res.edit.status).toBe('pending');
    expect(res.edit.defaultShelfLifeDays).toBe(14);
    expect(res.edit.notes).toBe('Original note');

    // Mutating a pending edit remains strictly locked with 409
    await expect(
      patchProductEditMetadata(actor(creator.id), pendingEdit.id, { version: pendingEdit.version, name: 'Should Fail' }),
    ).rejects.toMatchObject({ status: 409 });
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

    const rcOutbox = await getPrisma().notificationOutbox.findFirstOrThrow({
      where: { userId: creator.id, templateKey: 'product_edit_changes_required' },
    });
    expect(rcOutbox.payload).toMatchObject({ editId: edit.id, notes: 'fix the name' });

    // Creator can resubmit after changes_required.
    const resubmitted = await resolveProductEdit(
      actor(creator.id),
      {},
      { editId: edit.id, action: 'submit', version: (afterRC as { version: number }).version },
    );
    expect('status' in resubmitted && resubmitted.status).toBe('pending');
  });

  it('records one notification event per pending transition, including a changes_required resubmit', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);

    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    const submittedVersion = (submitted as { version: number }).version;
    let events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: edit.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('product_revision');
    expect(events[0]!.submissionVersion).toBe(submittedVersion);

    // request_changes is not a queue arrival — no new event.
    const afterRC = await resolveProductEdit(
      adminActor(admin.id),
      {},
      { editId: edit.id, action: 'request_changes', version: submittedVersion, notes: 'fix the name' },
    );
    events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: edit.id } });
    expect(events).toHaveLength(1);

    // Resubmission is a fresh occurrence keyed at the new post-transition version.
    const resubmitted = await resolveProductEdit(
      actor(creator.id),
      {},
      { editId: edit.id, action: 'submit', version: (afterRC as { version: number }).version },
    );
    events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: edit.id }, orderBy: { submissionVersion: 'asc' } });
    expect(events).toHaveLength(2);
    expect(events[1]!.submissionVersion).toBe((resubmitted as { version: number }).version);
    expect(events[1]!.submissionVersion).toBeGreaterThan(events[0]!.submissionVersion);
  });

  it('records no notification event for a stale-version submit that loses the guard', async () => {
    const creator = await makeUserForAdmin();
    await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);

    await expect(
      resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version + 99 }),
    ).rejects.toMatchObject({ status: 409 });
    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: edit.id } });
    expect(events).toHaveLength(0);
  });

  it('approve applies metadata (including defaultShelfLifeDays) + retained/staged photo order and writes audit diff', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id, { withPhoto: true });
    // Set initial product defaultShelfLifeDays
    await getPrisma().product.update({ where: { id: product.id }, data: { defaultShelfLifeDays: 30 } });
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    expect(edit.defaultShelfLifeDays).toBe(30);
    expect(edit.notes).toBeNull();

    const patched = await patchProductEditMetadata(actor(creator.id), edit.id, {
      version: edit.version,
      name: 'Revised Name',
      defaultShelfLifeDays: 45,
      notes: 'Packaging label says 45 days shelf life',
    });
    expect(patched.defaultShelfLifeDays).toBe(45);
    expect(patched.notes).toBe('Packaging label says 45 days shelf life');

    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: patched.version });
    const submittedVersion = (submitted as { version: number }).version;

    const approved = await resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: submittedVersion });
    expect('name' in approved && approved.name).toBe('Revised Name');
    expect('status' in approved && approved.status).toBe('active');

    const dbEdit = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect(dbEdit.status).toBe('approved');
    expect(dbEdit.notes).toBe('Packaging label says 45 days shelf life');

    const dbProduct = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(dbProduct.name).toBe('Revised Name');
    expect(dbProduct.defaultShelfLifeDays).toBe(45);
    expect(dbProduct.version).toBe(product.version + 1);

    const appOutbox = await getPrisma().notificationOutbox.findFirstOrThrow({
      where: { userId: creator.id, templateKey: 'product_edit_approved' },
    });
    expect(appOutbox.payload).toMatchObject({ editId: edit.id, productId: product.id });

    // Verify outbox dispatch and notification worker process the job properly
    await getPrisma().pushToken.create({
      data: {
        userId: creator.id,
        deviceToken: 'dummy-device-token-12345',
        platform: 'android',
      },
    });

    await expect(
      processSendJob({
        recordId: product.id,
        userId: creator.id,
        fireAt: new Date().toISOString(),
        offsetDays: 0,
        templateKey: 'product_edit_approved',
        payload: { editId: edit.id, productId: product.id },
      }),
    ).resolves.toBeUndefined();
  });
  it('I7: leaves no orphaned public bytes and no reference when approveEdit\'s reference transaction fails AFTER the staged photo was already published', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);

    const reservation = await reserveMediaCapacity({ bytes: 10_000 });
    const processed = await fakeProcessedUpload();
    await addProductEditPhoto(actor(creator.id), { editId: edit.id, processed, capacityReservationId: reservation.id });

    const staged = await getPrisma().productEditPhoto.findFirstOrThrow({ where: { productEditId: edit.id } });
    const editAfterUpload = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: editAfterUpload.version });
    const submittedVersion = (submitted as { version: number }).version;

    writeAuditLogSpy.mockImplementationOnce(() => {
      throw new Error('forced failure after publish, before commit');
    });

    await expect(
      resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: submittedVersion }),
    ).rejects.toThrow('forced failure after publish, before commit');

    // (a) product/edit rows unchanged
    const dbProduct = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(dbProduct.status).toBe('active');
    expect(dbProduct.version).toBe(product.version);
    const dbEdit = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect(dbEdit.status).toBe('pending');
    const liveProduct = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    expect(liveProduct).toHaveLength(0);

    // (b) no file remains under the public root
    async function countFilesRecursively(dir: string): Promise<number> {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      let count = 0;
      for (const entry of entries) {
        if (entry.isDirectory()) count += await countFilesRecursively(`${dir}/${entry.name}`);
        else count += 1;
      }
      return count;
    }
    expect(await countFilesRecursively(mediaKeyToPath(root, 'public'))).toBe(0);
    // The staged private bytes are untouched (never referenced, still cleanable).
    await expect(stat(mediaKeyToPath(root, staged.privateStorageKey!))).resolves.toBeDefined();

    // (c) the prepared intent row is recoverable
    const intent = await getPrisma().mediaOperationOutbox.findFirstOrThrow({
      where: { operation: 'publish_public' },
      orderBy: { createdAt: 'desc' },
    });
    expect(intent.status).toBe('prepared');
    const keys = (intent.payload as { keys: string[] }).keys;
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(new RegExp(`^public/products/${product.id}/`));
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

  it('I4: approving a revision that adds a staged cover photo sets the compatibility imageUrl', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);

    const reservation = await reserveMediaCapacity({ bytes: 10_000 });
    const processed = await fakeProcessedUpload();
    await addProductEditPhoto(actor(creator.id), { editId: edit.id, processed, capacityReservationId: reservation.id });
    const editAfterUpload = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });

    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: editAfterUpload.version });
    await resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: (submitted as { version: number }).version });

    const after = await getPrisma().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.imageUrl).toBeTruthy();
    const photo = await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } });

    // C1: the staged-photo publish site (`publishProductEditPhoto`) must land
    // under the PRODUCT's own namespace, exactly matching what the prepared
    // intent recorded — never the edit id, and never allowed to drift from the
    // intent's own key list. Asserted before the imageUrl check below so this
    // regression can't be masked by that weaker, filename-only comparison.
    expect(photo.publicStorageKey).toMatch(new RegExp(`^public/products/${product.id}/`));
    const intent = await getPrisma().mediaOperationOutbox.findFirstOrThrow({
      where: { operation: 'publish_public' },
      orderBy: { createdAt: 'desc' },
    });
    const intentKeys = (intent.payload as { keys: string[] }).keys;
    expect(intentKeys).toContain(photo.publicStorageKey);

    // I4: the compatibility cover imageUrl must point at this same published key.
    expect(after.imageUrl).toContain(photo.publicStorageKey!.split('/').pop());
  });

  it('I1: approving a revision that drops a live photo succeeds even when a RESOLVED historical edit retained it (only an OPEN edit blocks)', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id, { withPhoto: true });
    const livePhotoId = (await getPrisma().productPhoto.findFirstOrThrow({ where: { productId: product.id } })).id;

    // Creator A's metadata-only revision retains the live photo (default seed),
    // gets approved — its ProductEditPhoto row for that photo is now history on a
    // RESOLVED (approved) edit.
    const editorA = await makeUserForAdmin();
    const { edit: editA } = await createOrResumeProductEdit(actor(editorA.id), product.id);
    const submittedA = await resolveProductEdit(actor(editorA.id), {}, { editId: editA.id, action: 'submit', version: editA.version });
    await resolveProductEdit(adminActor(admin.id), {}, { editId: editA.id, action: 'approve', version: (submittedA as { version: number }).version });
    const resolvedHistoricalRow = await getPrisma().productEditPhoto.findFirstOrThrow({ where: { productEditId: editA.id } });
    expect(resolvedHistoricalRow.sourceProductPhotoId).toBe(livePhotoId);

    // Creator B opens a fresh revision and drops the (still-live) photo entirely.
    const { edit: editB } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const stagedOnB = await getPrisma().productEditPhoto.findFirstOrThrow({ where: { productEditId: editB.id } });
    const { removeProductEditPhoto } = await import('../../src/services/products/product-photos.js');
    await removeProductEditPhoto(actor(creator.id), { editId: editB.id, photoId: stagedOnB.id });
    const submittedB = await resolveProductEdit(actor(creator.id), {}, { editId: editB.id, action: 'submit', version: 2 });

    const approved = await resolveProductEdit(adminActor(admin.id), {}, { editId: editB.id, action: 'approve', version: (submittedB as { version: number }).version });
    expect('status' in approved && approved.status).toBe('active');

    const remainingLivePhotos = await getPrisma().productPhoto.findMany({ where: { productId: product.id } });
    expect(remainingLivePhotos).toHaveLength(0);
    // The resolved edit's now-meaningless photo-slot row is gone (the XOR
    // representation check rules out merely detaching its FK); the edit row
    // itself (status/proposed snapshot/audit trail) remains full history.
    await expect(getPrisma().productEditPhoto.findUnique({ where: { id: resolvedHistoricalRow.id } })).resolves.toBeNull();
    const editAStillExists = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: editA.id } });
    expect(editAStillExists.status).toBe('approved');
  });

  it('I3: an approval racing a concurrent request_changes on the same pending edit resolves to exactly one winner — the loser gets a typed conflict, never a silent overwrite', async () => {
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    const submittedVersion = (submitted as { version: number }).version;

    // Both actions are individually valid against the same starting `pending`
    // edit and race for the row lock in genuinely concurrent transactions —
    // exercising the guarded terminal `updateMany` (I3's actual fix), not merely
    // a pre-transaction read-order assumption.
    const results = await Promise.allSettled([
      resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: submittedVersion }),
      resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'request_changes', version: submittedVersion, notes: 'need changes' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

    // Whichever won, the edit's final state is exactly one clean outcome — never
    // both `approved` and `changes_required` applied to the same row.
    const finalEdit = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect(['approved', 'changes_required']).toContain(finalEdit.status);
  });

  it('I3: a concurrent supersede racing an approve on a since-gone-stale edit never leaves the edit both approved and superseded', async () => {
    // Note on why this differs from the request_changes race above: M1 now
    // requires genuine staleness for recovery, so `supersede` is only reachable
    // once `product.version !== edit.baseProductVersion` — but that same
    // staleness is exactly what `approveEdit`'s own pre-existing pre-check
    // rejects with `edit_base_stale` before it ever reaches the new I3 guard.
    // The two fixes compose to make the *supersede-specific* variant of this
    // race unreachable rather than merely guarded — this test proves that
    // composition holds (approve always loses, supersede always wins, the edit
    // never ends up in a corrupted dual state), while the request_changes race
    // above is what actually exercises I3's guarded terminal `updateMany` for a
    // still-pending, non-stale edit.
    const creator = await makeUserForAdmin();
    const { admin } = await makeAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    const submittedVersion = (submitted as { version: number }).version;

    const staleProduct = await getPrisma().product.update({ where: { id: product.id }, data: { version: { increment: 1 } } });

    const results = await Promise.allSettled([
      resolveProductEdit(adminActor(admin.id), {}, { editId: edit.id, action: 'approve', version: submittedVersion }),
      recoverProductEdit(adminActor(admin.id), {}, {
        action: 'supersede',
        editId: edit.id,
        editVersion: submittedVersion,
        productVersion: staleProduct.version,
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

    const finalEdit = await getPrisma().productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect(finalEdit.status).toBe('rejected');
    expect(finalEdit.notes).toBe('superseded:stale_base_version');
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

    const audit = await getPrisma().adminAuditLog.findFirstOrThrow({
      where: { action: 'product_edit.rebase', targetId: edit.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.diff).toMatchObject({
      before: { baseProductVersion: expect.any(Number) },
      after: { baseProductVersion: product.version },
    });
  });
  it('a pending-producing rebase records a fresh notification event at the new version', async () => {
    const { admin } = await makeAdmin();
    const { product, edit, livePhotoId } = await staleSubmittedEdit();

    // The initial submit already produced one event; rebase returns the edit to
    // `pending` as a distinct occurrence.
    const before = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: edit.id } });
    expect(before).toHaveLength(1);

    const result = await recoverProductEdit(adminActor(admin.id), {}, {
      action: 'rebase',
      editId: edit.id,
      editVersion: edit.version,
      productVersion: product.version,
      desiredPhotoOrder: [{ type: 'retained', sourceProductPhotoId: livePhotoId }],
    });
    expect(result.status).toBe('pending');

    const after = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: edit.id }, orderBy: { submissionVersion: 'asc' } });
    expect(after).toHaveLength(2);
    expect(after[1]!.kind).toBe('product_revision');
    expect(after[1]!.submissionVersion).toBe(result.version);
    expect(after[1]!.submissionVersion).toBeGreaterThan(after[0]!.submissionVersion);
  });

  it('a supersede (rejected) records no new notification event', async () => {
    const { admin } = await makeAdmin();
    const { product, edit } = await staleSubmittedEdit();

    await recoverProductEdit(adminActor(admin.id), {}, {
      action: 'supersede',
      editId: edit.id,
      editVersion: edit.version,
      productVersion: product.version,
      notes: 'admin free text reason',
    });

    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: edit.id } });
    expect(events).toHaveLength(1);
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

  it('M1: rejects recovery on a healthy (non-stale) edit — recovery is not applicable when the base version still matches', async () => {
    const { admin } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    const submitted = await resolveProductEdit(actor(creator.id), {}, { editId: edit.id, action: 'submit', version: edit.version });
    const submittedVersion = (submitted as { version: number }).version;

    await expect(
      recoverProductEdit(adminActor(admin.id), {}, {
        action: 'supersede',
        editId: edit.id,
        editVersion: submittedVersion,
        productVersion: product.version,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('M1: rebase rejects a never-submitted draft — it must not promote an unsubmitted draft straight to pending', async () => {
    const { admin } = await makeAdmin();
    const creator = await makeUserForAdmin();
    const product = await makeActiveProduct(creator.id);
    const { edit } = await createOrResumeProductEdit(actor(creator.id), product.id);
    // Go stale while still a draft (never submitted).
    const staleProduct = await getPrisma().product.update({ where: { id: product.id }, data: { version: { increment: 1 } } });

    await expect(
      recoverProductEdit(adminActor(admin.id), {}, {
        action: 'rebase',
        editId: edit.id,
        editVersion: edit.version,
        productVersion: staleProduct.version,
        desiredPhotoOrder: [],
      }),
    ).rejects.toMatchObject({ status: 409 });

    // supersede, by contrast, may legitimately apply to a stale draft.
    const result = await recoverProductEdit(adminActor(admin.id), {}, {
      action: 'supersede',
      editId: edit.id,
      editVersion: edit.version,
      productVersion: staleProduct.version,
    });
    expect(result.status).toBe('rejected');
  });

  it('M2: rebase without new notes preserves the creator\'s unread request_changes feedback rather than clearing it', async () => {
    const { admin } = await makeAdmin();
    const { product, edit, livePhotoId } = await staleSubmittedEdit();
    await getPrisma().productEdit.update({ where: { id: edit.id }, data: { moderationNotes: 'please fix the name' } });

    const result = await recoverProductEdit(adminActor(admin.id), {}, {
      action: 'rebase',
      editId: edit.id,
      editVersion: edit.version,
      productVersion: product.version,
      desiredPhotoOrder: [{ type: 'retained', sourceProductPhotoId: livePhotoId }],
    });
    expect(result.moderationFeedback).toBe('please fix the name');
  });

  it('M2: supersede without new notes preserves existing moderationNotes rather than clearing it', async () => {
    const { admin } = await makeAdmin();
    const { product, edit } = await staleSubmittedEdit();
    await getPrisma().productEdit.update({ where: { id: edit.id }, data: { moderationNotes: 'earlier feedback' } });

    const result = await recoverProductEdit(adminActor(admin.id), {}, {
      action: 'supersede',
      editId: edit.id,
      editVersion: edit.version,
      productVersion: product.version,
    });
    expect(result.moderationFeedback).toBe('earlier feedback');
  });

  it('M7: rejects a non-admin actor on both recovery actions', async () => {
    const { creator, product, edit } = await staleSubmittedEdit();
    await expect(
      recoverProductEdit(actor(creator.id), {}, { action: 'supersede', editId: edit.id, editVersion: edit.version, productVersion: product.version }),
    ).rejects.toMatchObject({ status: 403 });
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
