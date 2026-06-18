// apps/admin/tests/e2e/mock-admin-handlers.ts
// Admin-surface request handlers for the E2E mock API. Split from mock-api.ts to
// keep each file focused. Reads/writes the in-memory `store` (mock-store.ts).
//
// Only the endpoints the three Phase K specs traverse are implemented:
//   GET   /v1/admin/analytics/overview      (overview page after login)
//   GET   /v1/admin/reports                 (reports list + detail-by-list-scan)
//   PATCH /v1/admin/reports/:id/resolve      (moderate-report)
//   GET   /v1/admin/products                 (merge candidate search + list)
//   GET   /v1/admin/products/:id             (product detail + merge winner)
//   POST  /v1/admin/products/:id/merge       (merge-product)
//   GET   /v1/admin/users                    (users list search)
//   GET   /v1/admin/users/:id                (user detail)
//   PATCH /v1/admin/users/:id                (suspend-user)
//   POST  /v1/dev/reset                      (per-spec store reset)

import type { IncomingMessage } from 'node:http';
import {
  reset,
  store,
  userDetail,
  userListRow,
  type ProductRow,
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
  return { ...p };
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

  const productById = path.match(/^\/v1\/admin\/products\/([^/]+)$/);
  if (method === 'GET' && productById) {
    const p = store.products.find((x) => x.id === productById[1]);
    if (!p) return { status: 404, body: { code: 'not_found' } };
    return { body: productRow(p) };
  }

  const productMerge = path.match(/^\/v1\/admin\/products\/([^/]+)\/merge$/);
  if (method === 'POST' && productMerge) {
    const winnerId = productMerge[1];
    const winner = store.products.find((p) => p.id === winnerId);
    if (!winner) return { status: 404, body: { code: 'not_found' } };
    const body = await readJson(req);
    const loserIds = Array.isArray(body.loserIds) ? (body.loserIds as string[]) : [];
    let movedReviews = 0;
    for (const loser of store.products.filter((p) => loserIds.includes(p.id))) {
      loser.status = 'merged_into';
      movedReviews += loser.reviewCount;
      winner.reviewCount += loser.reviewCount;
      winner.ratingCount += loser.ratingCount;
      winner.buyAgainCount += loser.buyAgainCount;
      winner.buyAgainOnSaleCount += loser.buyAgainOnSaleCount;
      winner.wontBuyCount += loser.wontBuyCount;
    }
    return {
      status: 200,
      body: {
        winnerId,
        movedRecords: 0,
        movedReviews,
        newReviewCount: winner.reviewCount,
        newRatingCount: winner.ratingCount,
        newBuyAgainCount: winner.buyAgainCount,
        newBuyAgainOnSaleCount: winner.buyAgainOnSaleCount,
        newWontBuyCount: winner.wontBuyCount,
      },
    };
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
