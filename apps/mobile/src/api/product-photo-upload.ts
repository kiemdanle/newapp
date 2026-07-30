import type { Product } from '@expyrico/shared';
import { secureStore } from '../auth/secure-store';
import { apiClient, apiUrl, refreshTokensOnce } from './client';
import { ApiError } from './errors';

// XHR, not fetch, because fetch gives no upload-progress events in React
// Native. The mutation coordinator (Phase 5 Task 5) and ProductPhotoEditor
// (Task 6) depend only on this file's exported shape, not on how the bytes
// actually move — an implementation swap stays contained here.

/** A draft (pre-approval) product owns its own photos directly; an active
 * product's revision stages photos against its `ProductEdit` instead. The
 * URL shapes differ (`/products/:id/photos*` vs
 * `/product-edits/:editId/photos*`), so every upload/delete/order call in
 * this module is parameterized by this target rather than assuming one. */
export type ProductPhotoTarget =
  | { kind: 'draft'; productId: string }
  | { kind: 'product_edit'; editId: string };

export interface UploadablePhoto {
  path: string;
  mime: string;
}

export interface UploadHandle<T> {
  promise: Promise<T>;
  cancel(): void;
  /** Registers a progress listener (0..1); returns an unsubscribe function. */
  onProgress(listener: (ratio: number) => void): () => void;
}

function photosPathFor(target: ProductPhotoTarget): string {
  return target.kind === 'draft' ? `/products/${target.productId}/photos` : `/product-edits/${target.editId}/photos`;
}

function filenameFor(path: string): string {
  return path.split('/').pop() || 'photo.jpg';
}

interface ParsedErrorBody {
  code?: string;
  status?: number;
  title?: string;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
  currentVersion?: number;
}

function errorFromXhr(xhr: XMLHttpRequest): ApiError {
  let body: ParsedErrorBody = {};
  try {
    body = JSON.parse(xhr.responseText) as ParsedErrorBody;
  } catch {
    // non-JSON body
  }
  return new ApiError({
    code: body.code ?? 'unknown_error',
    status: body.status ?? xhr.status,
    title: body.title ?? 'Upload failed',
    detail: body.detail,
    errors: body.errors,
    currentVersion: body.currentVersion,
  });
}

/**
 * Uploads one photo (single-file multipart, matching the server's one-file-
 * per-request contract) to a draft product or a staged product-edit. Retries
 * exactly once, automatically, after a single-flight token refresh on a 401
 * — the same refresh promise `apiClient` uses, so a concurrent JSON request
 * and this upload never mint two competing refreshes. `cancel()` aborts the
 * in-flight transport; the returned promise then rejects and never resolves
 * with a stale success, even if a response was already in flight when abort
 * was called.
 */
export function uploadProductPhoto(target: ProductPhotoTarget, photo: UploadablePhoto): UploadHandle<Product> {
  const progressListeners = new Set<(ratio: number) => void>();
  let cancelled = false;
  let activeXhr: XMLHttpRequest | null = null;

  const attempt = (retrying: boolean): Promise<Product> =>
    new Promise<Product>((resolve, reject) => {
      if (cancelled) {
        reject(new ApiError({ code: 'upload_cancelled', status: 0, title: 'Upload was cancelled' }));
        return;
      }

      void secureStore.getAccessToken().then((access) => {
        if (cancelled) {
          reject(new ApiError({ code: 'upload_cancelled', status: 0, title: 'Upload was cancelled' }));
          return;
        }

        const xhr = new XMLHttpRequest();
        activeXhr = xhr;
        xhr.open('POST', apiUrl(photosPathFor(target)));
        xhr.setRequestHeader('Accept', 'application/json');
        if (access) xhr.setRequestHeader('Authorization', `Bearer ${access}`);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || event.total === 0) return;
          const ratio = event.loaded / event.total;
          for (const listener of progressListeners) listener(ratio);
        };

        xhr.onabort = () => {
          reject(new ApiError({ code: 'upload_cancelled', status: 0, title: 'Upload was cancelled' }));
        };

        xhr.onerror = () => {
          if (cancelled) return; // abort already rejected; don't double-settle
          reject(new ApiError({ code: 'network_error', status: 0, title: 'Network error during upload' }));
        };

        xhr.onload = () => {
          if (cancelled) return; // never resolve/reject with a post-cancel response
          if (xhr.status === 401 && !retrying) {
            void refreshTokensOnce().then((refreshed) => {
              if (cancelled) {
                reject(new ApiError({ code: 'upload_cancelled', status: 0, title: 'Upload was cancelled' }));
                return;
              }
              if (!refreshed) {
                reject(errorFromXhr(xhr));
                return;
              }
              attempt(true).then(resolve, reject);
            });
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as Product);
            } catch {
              reject(new ApiError({ code: 'unknown_error', status: xhr.status, title: 'Invalid upload response' }));
            }
            return;
          }
          reject(errorFromXhr(xhr));
        };

        const form = new FormData();
        // React Native's FormData accepts this {uri, type, name} file-part
        // shape for a local file path; `photo` is always the sole part, since
        // the server rejects a second part on this route entirely.
        form.append('photo', { uri: photo.path, type: photo.mime, name: filenameFor(photo.path) } as unknown as Blob);
        xhr.send(form);
      });
    });

  const promise = attempt(false);

  return {
    promise,
    cancel(): void {
      cancelled = true;
      activeXhr?.abort();
    },
    onProgress(listener: (ratio: number) => void): () => void {
      progressListeners.add(listener);
      return () => progressListeners.delete(listener);
    },
  };
}

/** Deletes one photo from a draft product or staged product-edit. */
export async function deleteProductPhoto(target: ProductPhotoTarget, photoId: string): Promise<Product> {
  return apiClient.delete<Product>(`${photosPathFor(target)}/${photoId}`);
}

/** Rewrites the full photo order (index 0 is cover) for a draft product or
 * staged product-edit — the server requires the complete desired ordering. */
export async function reorderProductPhotos(target: ProductPhotoTarget, photoIds: string[]): Promise<Product> {
  return apiClient.patch<Product>(`${photosPathFor(target)}/order`, { photoIds });
}
