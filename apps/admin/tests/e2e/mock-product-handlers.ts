// apps/admin/tests/e2e/mock-product-handlers.ts
// Non-admin-prefixed product surface the admin app also calls directly:
//   GET    /v1/products/:id                              (admin-bypass full DTO incl. version)
//   PATCH  /v1/products/:id/photos/order                  (admin photo reorder)
//   DELETE /v1/products/:id/photos/:photoId                (admin photo remove)
//   GET    /v1/products/:productId/photos/:photoId/:variant       (private product-photo bytes)
//   GET    /v1/product-edits/:editId/photos/:photoId/:variant     (private edit-photo bytes)
//
// Mirrors the real API's admin-bypass rule (`getVisibleProduct`'s
// `actor.role === 'admin'` branch) and its parent-bound photo lookups: a
// photoId that does not belong to the given parent 404s exactly like a
// nonexistent one, never revealing which case it was.

import type { IncomingMessage } from 'node:http';
import { ACCESS_TOKEN } from './mock-api-constants';
import { store, MOCK_IMAGE_BYTES, fullProductDto } from './mock-store';

export interface BinaryResp {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  binary?: Buffer;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function isAdminBearer(req: IncomingMessage): boolean {
  return req.headers.authorization === `Bearer ${ACCESS_TOKEN}`;
}

export async function handleProducts(method: string, url: string, req: IncomingMessage): Promise<BinaryResp | null> {
  const [path = ''] = url.split('?');

  // --- Public media (approved photos render from here directly, no auth) ---
  const publicMedia = path.match(/^\/public-media\/[^/]+\/[^/]+$/);
  if (method === 'GET' && publicMedia) {
    return { status: 200, headers: { 'content-type': 'image/webp' }, binary: MOCK_IMAGE_BYTES };
  }

  // --- Private product-photo bytes (parent-bound) ---
  const productPhoto = path.match(/^\/v1\/products\/([^/]+)\/photos\/([^/]+)\/(thumb|display)$/);
  if (method === 'GET' && productPhoto) {
    if (!req.headers.authorization) return { status: 401, body: { code: 'unauthorized' } };
    const [, productId, photoId] = productPhoto;
    const product = store.products.find((p) => p.id === productId);
    const photo = product?.photos.find((ph) => ph.id === photoId);
    if (!product || !photo) return { status: 404, body: { code: 'not_found' } };
    if (!isAdminBearer(req)) return { status: 404, body: { code: 'not_found' } };
    return { status: 200, headers: { 'content-type': 'image/webp' }, binary: MOCK_IMAGE_BYTES };
  }

  // --- Private edit-photo bytes (parent-bound, staged only) ---
  const editPhoto = path.match(/^\/v1\/product-edits\/([^/]+)\/photos\/([^/]+)\/(thumb|display)$/);
  if (method === 'GET' && editPhoto) {
    if (!req.headers.authorization) return { status: 401, body: { code: 'unauthorized' } };
    const [, editId, photoId] = editPhoto;
    const editRow = store.edits.find((e) => e.id === editId);
    const photo = editRow?.photos.find((ph) => ph.id === photoId && !ph.retained);
    if (!editRow || !photo) return { status: 404, body: { code: 'not_found' } };
    if (!isAdminBearer(req)) return { status: 404, body: { code: 'not_found' } };
    return { status: 200, headers: { 'content-type': 'image/webp' }, binary: MOCK_IMAGE_BYTES };
  }

  // --- Single product (admin-bypass full DTO incl. version) ---
  const productById = path.match(/^\/v1\/products\/([^/]+)$/);
  if (method === 'GET' && productById) {
    if (!req.headers.authorization) return { status: 401, body: { code: 'unauthorized' } };
    const p = store.products.find((x) => x.id === productById[1]);
    if (!p) return { status: 404, body: { code: 'not_found' } };
    return { status: 200, body: fullProductDto(p) };
  }

  // --- Photo reorder (admin bypasses ownership) ---
  const photoOrder = path.match(/^\/v1\/products\/([^/]+)\/photos\/order$/);
  if (method === 'PATCH' && photoOrder) {
    const p = store.products.find((x) => x.id === photoOrder[1]);
    if (!p) return { status: 404, body: { code: 'not_found' } };
    const body = await readJson(req);
    const photoIds = Array.isArray(body.photoIds) ? (body.photoIds as string[]) : [];
    const byId = new Map(p.photos.map((ph) => [ph.id, ph]));
    p.photos = photoIds.map((id, i) => ({ ...byId.get(id)!, position: i })).filter(Boolean);
    return { status: 200, body: fullProductDto(p) };
  }

  // --- Photo remove (admin bypasses ownership) ---
  const photoDelete = path.match(/^\/v1\/products\/([^/]+)\/photos\/([^/]+)$/);
  if (method === 'DELETE' && photoDelete) {
    const p = store.products.find((x) => x.id === photoDelete[1]);
    if (!p) return { status: 404, body: { code: 'not_found' } };
    p.photos = p.photos.filter((ph) => ph.id !== photoDelete[2]).map((ph, i) => ({ ...ph, position: i }));
    return { status: 200, body: fullProductDto(p) };
  }

  return null;
}
