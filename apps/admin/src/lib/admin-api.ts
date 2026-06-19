// Typed wrappers around the admin app's server-side fetcher (`apiServerFetch`,
// which forwards the access cookie as a Bearer token to the Fastify API).
//
// This is a SERVER-ONLY client: every page is a Server Component that reads
// through `serverAdminApi`, and every mutation runs in a server action that
// also uses this client. Responses are parsed against the @expyrico/shared admin
// schemas so the UI is typed end-to-end against the same contracts the API
// emits.
import { apiServerFetch } from './api';
import {
  adminUsersListSchema,
  adminUserDetailSchema,
  adminUserRowSchema,
  adminUserImpersonateResponseSchema,
  adminProductsListSchema,
  adminProductRowSchema,
  adminProductMergeResponseSchema,
  adminProductEditsListSchema,
  adminReviewsListSchema,
  adminReviewRowSchema,
  adminReportsListSchema,
  analyticsOverviewSchema,
  analyticsScansSchema,
  analyticsReviewsSchema,
  analyticsGeographySchema,
  queueHealthSchema,
  pushLogsListSchema,
  apiErrorsAggSchema,
  externalApiStateSchema,
  featureFlagsSchema,
  moderationSettingsSchema,
  notificationTemplateSchema,
  adminRowSchema,
  adminDealsListSchema,
  adminDealRowSchema,
} from '@expyrico/shared';
import { z } from 'zod';

type Q = Record<string, string | number | undefined>;

function qs(q: Q): string {
  const entries = Object.entries(q).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  const params = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${params.toString()}`;
}

export const serverAdminApi = {
  users: {
    list: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/users${qs(q)}`).then((r) => adminUsersListSchema.parse(r)),
    get: (id: string) =>
      apiServerFetch(`/v1/admin/users/${id}`).then((r) => adminUserDetailSchema.parse(r)),
    patch: (id: string, body: object) =>
      apiServerFetch(`/v1/admin/users/${id}`, { method: 'PATCH', body }).then((r) =>
        adminUserRowSchema.parse(r),
      ),
    revokeSessions: (id: string) =>
      apiServerFetch(`/v1/admin/users/${id}/sessions/revoke-all`, { method: 'POST' }).then((r) =>
        z.object({ revoked: z.number() }).parse(r),
      ),
    impersonate: (id: string) =>
      apiServerFetch(`/v1/admin/users/${id}/impersonate`, { method: 'POST' }).then((r) =>
        adminUserImpersonateResponseSchema.parse(r),
      ),
  },
  products: {
    list: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/products${qs(q)}`).then((r) => adminProductsListSchema.parse(r)),
    get: (id: string) =>
      apiServerFetch(`/v1/admin/products/${id}`).then((r) => adminProductRowSchema.parse(r)),
    patch: (id: string, body: object) =>
      apiServerFetch(`/v1/admin/products/${id}`, { method: 'PATCH', body }).then((r) =>
        adminProductRowSchema.parse(r),
      ),
    merge: (winnerId: string, loserIds: string[]) =>
      apiServerFetch(`/v1/admin/products/${winnerId}/merge`, {
        method: 'POST',
        body: { winnerId, loserIds },
      }).then((r) => adminProductMergeResponseSchema.parse(r)),
    pending: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/products/pending${qs(q)}`).then((r) =>
        adminProductEditsListSchema.parse(r),
      ),
    resolveEdit: (id: string, decision: 'approve' | 'reject', notes?: string) =>
      apiServerFetch(`/v1/admin/products/pending/${id}`, {
        method: 'PATCH',
        body: { decision, notes },
      }),
  },
  reviews: {
    list: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/reviews${qs(q)}`).then((r) => adminReviewsListSchema.parse(r)),
    get: (id: string) =>
      apiServerFetch(`/v1/admin/reviews/${id}`).then((r) => adminReviewRowSchema.parse(r)),
    setStatus: (id: string, status: 'visible' | 'hidden' | 'deleted') =>
      apiServerFetch(`/v1/admin/reviews/${id}/status`, { method: 'PATCH', body: { status } }),
  },
  reports: {
    list: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/reports${qs(q)}`).then((r) => adminReportsListSchema.parse(r)),
    resolve: (id: string, action: 'hide' | 'delete' | 'dismiss' | 'ban', notes?: string) =>
      apiServerFetch(`/v1/admin/reports/${id}/resolve`, {
        method: 'PATCH',
        body: { action, notes },
      }),
  },
  analytics: {
    overview: () =>
      apiServerFetch('/v1/admin/analytics/overview').then((r) => analyticsOverviewSchema.parse(r)),
    scans: (range: '7d' | '30d' | '90d') =>
      apiServerFetch(`/v1/admin/analytics/scans?range=${range}`).then((r) =>
        analyticsScansSchema.parse(r),
      ),
    reviews: (range: '7d' | '30d' | '90d') =>
      apiServerFetch(`/v1/admin/analytics/reviews?range=${range}`).then((r) =>
        analyticsReviewsSchema.parse(r),
      ),
    geography: () =>
      apiServerFetch('/v1/admin/analytics/geography').then((r) =>
        analyticsGeographySchema.parse(r),
      ),
  },
  system: {
    queueHealth: () =>
      apiServerFetch('/v1/admin/system/queue-health').then((r) => queueHealthSchema.parse(r)),
    pushLogs: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/system/push-logs${qs(q)}`).then((r) => pushLogsListSchema.parse(r)),
    apiErrors: (range: '24h' | '7d' | '30d') =>
      apiServerFetch(`/v1/admin/system/api-errors?range=${range}`).then((r) =>
        apiErrorsAggSchema.parse(r),
      ),
    externalApis: () =>
      apiServerFetch('/v1/admin/system/external-apis').then((r) =>
        externalApiStateSchema.parse(r),
      ),
  },
  settings: {
    featureFlags: {
      get: () =>
        apiServerFetch('/v1/admin/settings/feature-flags').then((r) => featureFlagsSchema.parse(r)),
      put: (body: z.infer<typeof featureFlagsSchema>) =>
        apiServerFetch('/v1/admin/settings/feature-flags', { method: 'PATCH', body }).then((r) =>
          featureFlagsSchema.parse(r),
        ),
    },
    moderation: {
      get: () =>
        apiServerFetch('/v1/admin/settings/moderation').then((r) =>
          moderationSettingsSchema.parse(r),
        ),
      put: (body: z.infer<typeof moderationSettingsSchema>) =>
        apiServerFetch('/v1/admin/settings/moderation', { method: 'PATCH', body }).then((r) =>
          moderationSettingsSchema.parse(r),
        ),
    },
    notificationTemplates: {
      list: () =>
        apiServerFetch('/v1/admin/settings/notification-templates').then((r) =>
          z.object({ items: z.array(notificationTemplateSchema) }).parse(r).items,
        ),
      patch: (id: string, body: object) =>
        apiServerFetch(`/v1/admin/settings/notification-templates/${id}`, {
          method: 'PATCH',
          body,
        }).then((r) => notificationTemplateSchema.parse(r)),
    },
    admins: {
      list: () =>
        apiServerFetch('/v1/admin/settings/admins').then((r) =>
          z.object({ items: z.array(adminRowSchema) }).parse(r).items,
        ),
      invite: (body: { email: string; firstName: string; lastName: string }) =>
        apiServerFetch('/v1/admin/settings/admins', { method: 'POST', body }).then((r) =>
          adminRowSchema.parse(r),
        ),
      revoke: (id: string) =>
        apiServerFetch(`/v1/admin/settings/admins/${id}`, { method: 'DELETE' }),
    },
  },
  deals: {
    list: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/deals${qs(q)}`).then((r) => adminDealsListSchema.parse(r)),
    setStatus: (id: string, status: 'visible' | 'hidden' | 'deleted') =>
      apiServerFetch(`/v1/admin/deals/${id}/status`, { method: 'PATCH', body: { status } }),
  },
};
