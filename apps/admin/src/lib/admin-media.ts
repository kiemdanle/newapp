// Same-origin private-media proxy URL builder. Every admin UI surface that
// renders a pending product photo or a staged revision photo must go through
// this proxy (`/api/admin-product-media/...`) — never a bearer-bearing upstream
// URL, and never `next/image`'s optimizer, which would otherwise cache/reshape
// private bytes outside our control.
export type AdminMediaTargetKind = 'product' | 'edit';
export type AdminMediaVariant = 'display' | 'thumb';

export function adminProductMediaUrl(
  targetKind: AdminMediaTargetKind,
  parentId: string,
  photoId: string,
  variant: AdminMediaVariant,
): string {
  return `/api/admin-product-media/${targetKind}/${parentId}/${photoId}/${variant}`;
}

/**
 * Resolves the URL to actually render for a photo the API returned. An already
 * -approved (public) photo's `thumbnailUrl`/`displayUrl` is already an absolute
 * CDN URL — rendered as-is, never routed through the proxy. Anything else (the
 * API's private routes always return a relative path, e.g.
 * `/v1/products/:id/photos/:photoId/:variant`) is unapproved/private and must go
 * through the same-origin proxy instead of being requested directly (that path
 * requires a Bearer header an `<img>` tag can never send).
 */
export function resolveAdminPhotoUrl(
  targetKind: AdminMediaTargetKind,
  parentId: string,
  photo: { id: string; thumbnailUrl: string; displayUrl: string },
  variant: AdminMediaVariant,
): string {
  const raw = variant === 'thumb' ? photo.thumbnailUrl : photo.displayUrl;
  if (/^https?:\/\//.test(raw)) return raw;
  return adminProductMediaUrl(targetKind, parentId, photo.id, variant);
}
