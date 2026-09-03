import { apiClient, apiUrl, refreshTokensOnce } from './client';
import { secureStore } from '../auth/secure-store';
import { ApiError } from './errors';
import type {
  CreateFeedbackTicketInput,
  FeedbackTicketDetail,
  FeedbackListPage,
  FeedbackReplyInput,
  FeedbackMessage,
  FeedbackAttachment,
  FeedbackListQuery,
} from '@expyrico/shared';

export interface UploadableFeedbackFile {
  path: string;
  mime: string;
  name?: string;
}

export interface UploadHandle<T> {
  promise: Promise<T>;
  cancel(): void;
  onProgress(listener: (ratio: number) => void): () => void;
}

function filenameFor(path: string, mime: string): string {
  const base = path.split('/').pop() || 'attachment';
  if (!base.includes('.')) {
    const ext = mime.split('/')[1] || 'jpg';
    return `${base}.${ext}`;
  }
  return base;
}

export function uploadFeedbackAttachment(
  file: UploadableFeedbackFile,
): UploadHandle<FeedbackAttachment> {
  const progressListeners = new Set<(ratio: number) => void>();
  let cancelled = false;
  let activeXhr: XMLHttpRequest | null = null;

  const attempt = (retrying: boolean): Promise<FeedbackAttachment> =>
    new Promise<FeedbackAttachment>((resolve, reject) => {
      if (cancelled) {
        reject(
          new ApiError({
            code: 'upload_cancelled',
            status: 0,
            title: 'Upload was cancelled',
          }),
        );
        return;
      }

      void secureStore.getAccessToken().then((access) => {
        if (cancelled) {
          reject(
            new ApiError({
              code: 'upload_cancelled',
              status: 0,
              title: 'Upload was cancelled',
            }),
          );
          return;
        }

        const xhr = new XMLHttpRequest();
        activeXhr = xhr;
        xhr.open('POST', apiUrl('/feedback/attachments'));
        xhr.setRequestHeader('Accept', 'application/json');
        if (access) xhr.setRequestHeader('Authorization', `Bearer ${access}`);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || event.total === 0) return;
          const ratio = event.loaded / event.total;
          for (const listener of progressListeners) listener(ratio);
        };

        xhr.onabort = () => {
          reject(
            new ApiError({
              code: 'upload_cancelled',
              status: 0,
              title: 'Upload was cancelled',
            }),
          );
        };

        xhr.onerror = () => {
          if (cancelled) return;
          reject(
            new ApiError({
              code: 'network_error',
              status: 0,
              title: 'Network error during upload',
            }),
          );
        };

        xhr.onload = () => {
          if (cancelled) return;
          if (xhr.status === 401 && !retrying) {
            void refreshTokensOnce()
              .then(() => attempt(true).then(resolve, reject))
              .catch(() =>
                reject(
                  new ApiError({
                    code: 'unauthorized',
                    status: 401,
                    title: 'Session expired',
                  }),
                ),
              );
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const body = JSON.parse(xhr.responseText);
              resolve(body as FeedbackAttachment);
            } catch {
              reject(
                new ApiError({
                  code: 'invalid_json',
                  status: xhr.status,
                  title: 'Invalid server response',
                }),
              );
            }
          } else {
            let body: any = {};
            try {
              body = JSON.parse(xhr.responseText);
            } catch {}
            reject(
              new ApiError({
                code: body.code ?? 'upload_failed',
                status: xhr.status,
                title: body.title ?? 'Upload failed',
                detail: body.detail,
              }),
            );
          }
        };

        const formData = new FormData();
        const filename = file.name || filenameFor(file.path, file.mime);
        formData.append('file', {
          uri: file.path.startsWith('file://') ? file.path : `file://${file.path}`,
          type: file.mime,
          name: filename,
        } as any);

        xhr.send(formData);
      });
    });

  return {
    promise: attempt(false),
    cancel() {
      cancelled = true;
      if (activeXhr) activeXhr.abort();
    },
    onProgress(listener) {
      progressListeners.add(listener);
      return () => progressListeners.delete(listener);
    },
  };
}

export async function createFeedbackTicket(
  payload: CreateFeedbackTicketInput,
): Promise<FeedbackTicketDetail> {
  return apiClient.post('/feedback', payload);
}

export async function fetchMyFeedbackTickets(
  query?: FeedbackListQuery,
): Promise<FeedbackListPage> {
  const params = new URLSearchParams();
  if (query?.cursor) params.set('cursor', query.cursor);
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.status) params.set('status', query.status);
  if (query?.type) params.set('type', query.type);
  const qs = params.toString();
  return apiClient.get(`/feedback${qs ? `?${qs}` : ''}`);
}

export async function fetchFeedbackTicketDetail(
  id: string,
): Promise<FeedbackTicketDetail> {
  return apiClient.get(`/feedback/${id}`);
}

export async function sendFeedbackReply(
  ticketId: string,
  message: string,
): Promise<FeedbackMessage> {
  return apiClient.post(`/feedback/${ticketId}/messages`, { message });
}
