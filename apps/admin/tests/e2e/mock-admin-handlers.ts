// apps/admin/tests/e2e/mock-admin-handlers.ts
// Admin-surface request handlers for the E2E mock API. Split from mock-api.ts to
// keep each file focused. Reads/writes the in-memory `store` (mock-store.ts).
//
// Endpoints implemented (Phase K specs + Phase 6 moderation console):
//   GET   /v1/admin/analytics/overview       (overview page after login)
//   GET   /v1/admin/reports                  (reports list + detail-by-list-scan)
//   PATCH /v1/admin/reports/:id/resolve      (moderate-report)
//   GET   /v1/admin/products                 (queue new-product source, merge candidates)
//   GET   /v1/admin/products/:id             (product detail + merge winner)
//   PATCH /v1/admin/products/:id             (direct admin correction)
//   POST  /v1/admin/products/:id/merge       (merge-product; targetId/sourceIds/version)
//   POST  /v1/admin/products/:id/moderate    (new-product approve/request_changes)
//   GET   /v1/admin/products/pending         (queue revision source)
//   GET   /v1/admin/products/pending/:editId (revision detail incl. liveProductVersion)
//   PATCH /v1/admin/products/pending/:id     (revision approve/request_changes)
//   POST  /v1/admin/products/edits/:editId/recover (stale-revision rebase/supersede)
//   GET   /v1/admin/users                    (users list search)
//   GET   /v1/admin/users/:id                (user detail)
//   PATCH /v1/admin/users/:id                (suspend-user)
//   POST  /v1/dev/reset                      (per-spec store reset)

import type { IncomingMessage } from 'node:http';
import {
  adminProductRowSchema,
  adminProductEditRowSchema,
  adminProductEditDetailSchema,
  adminProductMergeResponseSchema,
  productEditRowSchema,
} from '@expyrico/shared';
import {
  reset,
  store,
  userDetail,
  userListRow,
  productPhotoUrls,
  editPhotoUrls,
  fullProductDto,
  type ProductRow,
  type ProductEditRow,
} from './mock-store';

export interface AdminResp {
  status?: number;
  body?: unknown;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function productRow(p: ProductRow) {
  return adminProductRowSchema.parse({
    id: p.id,
    barcode: p.barcode,
    qrPayload: p.qrPayload,
    name: p.name,
    description: p.description,
    brand: p.brand,
    category: p.category,
    imageUrl: p.imageUrl,
    source: p.source,
    status: p.status,
    version: p.version,
    mergedIntoProductId: p.mergedIntoProductId,
    isCommunityEligible: p.isCommunityEligible,
    buyAgainCount: p.buyAgainCount,
    buyAgainOnSaleCount: p.buyAgainOnSaleCount,
    wontBuyCount: p.wontBuyCount,
    ratingCount: p.ratingCount,
    reviewCount: p.reviewCount,
    photos: p.photos
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        position: photo.position,
        thumbnailUrl: productPhotoUrls(p.id, photo, 'thumb'),
        displayUrl: productPhotoUrls(p.id, photo, 'display'),
      })),
    moderationNotes: null,
    moderatedAt: null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
}

function editListRow(e: ProductEditRow) {
  return adminProductEditRowSchema.parse({
    id: e.id,
    productId: e.productId,
    submittedBy: e.submittedBy,
    proposed: { name: e.name, description: e.description, brand: e.brand, category: e.category },
    name: e.name,
    status: e.status,
    version: e.version,
    baseProductVersion: e.baseProductVersion,
    moderationNotes: e.moderationNotes,
    submittedAt: e.submittedAt,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: e.createdAt,
  });
}

// The creator-facing `productEditRowSchema` shape (`.strict()` — no admin-only
// fields). Every route that returns a *revision* rather than a *published
// product* (request_changes, rebase, supersede) must return exactly this shape,
// not the queue's `editListRow` projection, or the client's schema parse throws.
function creatorEditRow(e: ProductEditRow) {
  return productEditRowSchema.parse({
    id: e.id,
    productId: e.productId,
    status: e.status,
    version: e.version,
    baseProductVersion: e.baseProductVersion,
    name: e.name,
    description: e.description,
    brand: e.brand,
    category: e.category,
    photos: e.photos
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        position: photo.position,
        retained: photo.retained,
        thumbnailUrl: editPhotoUrls(e.id, photo, 'thumb'),
        displayUrl: editPhotoUrls(e.id, photo, 'display'),
      })),
    moderationFeedback: e.moderationNotes,
    submittedAt: e.submittedAt,
    updatedAt: e.updatedAt,
  });
}

function editDetailRow(e: ProductEditRow, liveProductVersion: number) {
  return adminProductEditDetailSchema.parse({ ...creatorEditRow(e), submittedBy: e.submittedBy, liveProductVersion });
}

/**
 * Returns an AdminResp for any admin/dev route this mock understands, or null so
 * the caller falls through to its 404. `path` is the URL minus the query string.
 */
export async function handleAdmin(
  method: string,
  url: string,
  req: IncomingMessage,
): Promise<AdminResp | null> {
  const [path = '', queryString = ''] = url.split('?');
  const query = new URLSearchParams(queryString);

  if (method === 'POST' && path === '/v1/dev/reset') {
    reset();
    return { status: 200, body: { ok: true } };
  }

  // --- Analytics (overview page renders right after login) ---
  if (method === 'GET' && path === '/v1/admin/analytics/overview') {
    return {
      body: {
        totalUsers: store.users.length,
        activeUsers7d: 0,
        activeUsers30d: 0,
        totalRecords: 0,
        totalReviews: 0,
        scans7d: 0,
      },
    };
  }

  // --- Reports ---
  if (method === 'GET' && path === '/v1/admin/reports') {
    const status = query.get('status') ?? undefined;
    const items = store.reports.filter((r) => (status ? r.status === status : true));
    return { body: { items, nextCursor: null } };
  }

  const reportResolve = path.match(/^\/v1\/admin\/reports\/([^/]+)\/resolve$/);
  if (method === 'PATCH' && reportResolve) {
    const id = reportResolve[1];
    const report = store.reports.find((r) => r.id === id);
    if (!report) return { status: 404, body: { code: 'not_found' } };
    const body = await readJson(req);
    // hide/delete/ban resolve the report; dismiss closes it as dismissed.
    report.status = body.action === 'dismiss' ? 'dismissed' : 'resolved';
    return { status: 200, body: { ok: true } };
  }

  // --- Revision (ProductEdit) queue — checked before the generic /:id routes so
  // the literal `/pending` segment never gets captured as an id. ---
  if (method === 'GET' && path === '/v1/admin/products/pending') {
    const items = store.edits.filter((e) => e.status === 'pending').map(editListRow);
    return { body: { items, nextCursor: null } };
  }

  const editDetail = path.match(/^\/v1\/admin\/products\/pending\/([^/]+)$/);
  if (method === 'GET' && editDetail) {
    const e = store.edits.find((x) => x.id === editDetail[1]);
    if (!e) return { status: 404, body: { code: 'not_found' } };
    const product = store.products.find((p) => p.id === e.productId);
    if (!product) return { status: 404, body: { code: 'not_found' } };
    return { body: editDetailRow(e, product.version) };
  }

  if (method === 'PATCH' && editDetail) {
    const e = store.edits.find((x) => x.id === editDetail[1]);
    if (!e) return { status: 404, body: { code: 'not_found' } };
    if (e.status !== 'pending') return { status: 409, body: { code: 'conflict', title: 'Already resolved' } };
    const body = await readJson(req);
    if (body.decision === 'request_changes' && typeof body.notes !== 'string') {
      return { status: 400, body: { code: 'validation_error', detail: 'notes required when requesting changes' } };
    }
    if (body.decision === 'approve') {
      e.status = 'approved';
      const product = store.products.find((p) => p.id === e.productId)!;
      product.name = e.name;
      product.description = e.description;
      product.brand = e.brand;
      product.category = e.category;
      product.version += 1;
      return { status: 200, body: fullProductDto(product) };
    }
    e.status = 'changes_required';
    e.moderationNotes = typeof body.notes === 'string' ? body.notes : e.moderationNotes;
    e.version += 1;
    return { status: 200, body: creatorEditRow(e) };
  }

  const editRecover = path.match(/^\/v1\/admin\/products\/edits\/([^/]+)\/recover$/);
  if (method === 'POST' && editRecover) {
    const e = store.edits.find((x) => x.id === editRecover[1]);
    if (!e) return { status: 404, body: { code: 'not_found' } };
    const product = store.products.find((p) => p.id === e.productId);
    if (!product) return { status: 404, body: { code: 'not_found' } };
    const body = await readJson(req);
    if (body.editVersion !== e.version) {
      return { status: 409, body: { code: 'version_conflict', currentVersion: e.version } };
    }
    if (body.productVersion !== product.version) {
      return { status: 409, body: { code: 'conflict', title: 'Product version mismatch' } };
    }
    if (body.action === 'supersede') {
      e.status = 'rejected';
      e.moderationNotes = typeof body.notes === 'string' ? body.notes : e.moderationNotes;
      e.version += 1;
      return { status: 200, body: creatorEditRow(e) };
    }
    // rebase
    e.baseProductVersion = product.version;
    e.status = 'pending';
    e.moderationNotes = typeof body.notes === 'string' ? body.notes : e.moderationNotes;
    e.version += 1;
    return { status: 200, body: creatorEditRow(e) };
  }

  // --- Products ---
  if (method === 'GET' && path === '/v1/admin/products') {
    const status = query.get('status') ?? undefined;
    const q = query.get('q')?.toLowerCase() ?? undefined;
    const items = store.products
      .filter((p) => (status ? p.status === status : true))
      .filter((p) =>
        q
          ? [p.name, p.brand, p.barcode].some((f) => f?.toLowerCase().includes(q))
          : true,
      )
      .map(productRow);
    return { body: { items, nextCursor: null } };
  }

  const productModerate = path.match(/^\/v1\/admin\/products\/([^/]+)\/moderate$/);
  if (method === 'POST' && productModerate) {
    const p = store.products.find((x) => x.id === productModerate[1]);
    if (!p) return { status: 404, body: { code: 'not_found' } };
    const body = await readJson(req);
    if (body.version !== p.version) return { status: 409, body: { code: 'version_conflict', currentVersion: p.version } };
    if (body.decision === 'request_changes' && typeof body.notes !== 'string') {
      return { status: 400, body: { code: 'validation_error', detail: 'notes required when requesting changes' } };
    }
    p.status = body.decision === 'approve' ? 'active' : 'changes_required';
    p.version += 1;
    return { status: 200, body: productRow(p) };
  }

  const productMerge = path.match(/^\/v1\/admin\/products\/([^/]+)\/merge$/);
  if (method === 'POST' && productMerge) {
    const targetId = productMerge[1];
    const target = store.products.find((p) => p.id === targetId);
    if (!target) return { status: 404, body: { code: 'not_found' } };
    const body = await readJson(req);
    if (body.version !== target.version) {
      return { status: 409, body: { code: 'version_conflict', currentVersion: target.version } };
    }
    const sourceIds = Array.isArray(body.sourceIds) ? (body.sourceIds as string[]) : [];
    const sources = store.products.filter((p) => sourceIds.includes(p.id));
    const conflicting = sources.find((s) => s.barcode && target.barcode && s.barcode !== target.barcode);
    if (conflicting) {
      return {
        status: 409,
        body: {
          code: 'identifier_conflict',
          title: 'Merge blocked by identifier conflict',
          identifierConflict: { slot: 'barcode', sourceValue: conflicting.barcode, targetValue: target.barcode },
        },
      };
    }
    let movedReviews = 0;
    for (const source of sources) {
      source.status = 'merged_into';
      source.mergedIntoProductId = target.id;
      movedReviews += source.reviewCount;
      target.reviewCount += source.reviewCount;
      target.ratingCount += source.ratingCount;
      target.buyAgainCount += source.buyAgainCount;
      target.buyAgainOnSaleCount += source.buyAgainOnSaleCount;
      target.wontBuyCount += source.wontBuyCount;
    }
    target.version += 1;
    return {
      status: 200,
      body: adminProductMergeResponseSchema.parse({
        targetId,
        movedRecords: 0,
        movedReviews,
        newReviewCount: target.reviewCount,
        newRatingCount: target.ratingCount,
        newBuyAgainCount: target.buyAgainCount,
        newBuyAgainOnSaleCount: target.buyAgainOnSaleCount,
        newWontBuyCount: target.wontBuyCount,
      }),
    };
  }

  const productById = path.match(/^\/v1\/admin\/products\/([^/]+)$/);
  if (productById) {
    const p = store.products.find((x) => x.id === productById[1]);
    if (!p) return { status: 404, body: { code: 'not_found' } };
    if (method === 'GET') return { body: productRow(p) };
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (body.version !== p.version) return { status: 409, body: { code: 'version_conflict', currentVersion: p.version } };
      if (typeof body.name === 'string') p.name = body.name;
      if ('brand' in body) p.brand = (body.brand as string | null) ?? null;
      if ('category' in body) p.category = (body.category as string | null) ?? null;
      p.version += 1;
      return { status: 200, body: productRow(p) };
    }
  }

  // --- Users ---
  if (method === 'GET' && path === '/v1/admin/users') {
    const status = query.get('status') ?? undefined;
    const q = query.get('q')?.toLowerCase() ?? undefined;
    const items = store.users
      .filter((u) => (status ? u.status === status : true))
      .filter((u) =>
        q
          ? [u.email, u.firstName, u.lastName].some((f) => f.toLowerCase().includes(q))
          : true,
      )
      .map(userListRow);
    return { body: { items, nextCursor: null } };
  }

  const userById = path.match(/^\/v1\/admin\/users\/([^/]+)$/);
  if (userById) {
    const user = store.users.find((u) => u.id === userById[1]);
    if (!user) return { status: 404, body: { code: 'not_found' } };
    if (method === 'GET') return { body: userDetail(user) };
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (typeof body.status === 'string') {
        user.status = body.status as typeof user.status;
      }
      if (typeof body.role === 'string') user.role = body.role as typeof user.role;
      if (typeof body.firstName === 'string') user.firstName = body.firstName;
      if (typeof body.lastName === 'string') user.lastName = body.lastName;
      return { status: 200, body: userListRow(user) };
    }
  }

  return null;
}
