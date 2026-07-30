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
  adminProductEditDetailSchema,
  productSchema,
  productEditRowSchema,
  type AdminProductEditResolveDecision,
  type AdminProductModerateDecision,
  type ProductEditRecoverRequest,
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
  adminReferralOverviewSchema,
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
    // `adminProductRowSchema` carries `version`/`description`/`mergedIntoProductId`
    // directly — a prior two-request composition grafted a *different*
    // product's version/description onto this row via the general
    // product-get route, which silently broke identity on a `merged_into` row
    // (that route resolves merge chains to the canonical product before
    // returning). Single request, always describes exactly the row asked for.
    get: (id: string) => apiServerFetch(`/v1/admin/products/${id}`).then((r) => adminProductRowSchema.parse(r)),
    // `version` is the admin's last-known product version — required so a direct
    // correction is optimistic-concurrency-guarded, not applied blind.
    patch: (id: string, version: number, body: object) =>
      apiServerFetch(`/v1/admin/products/${id}`, { method: 'PATCH', body: { ...body, version } }).then((r) =>
        adminProductRowSchema.parse(r),
      ),
    // `targetId`/`sourceIds` (not `winnerId`/`loserIds`) and a required `version` for the
    // target — matches Phase 4's merge contract exactly.
    merge: (targetId: string, sourceIds: string[], version: number) =>
      apiServerFetch(`/v1/admin/products/${targetId}/merge`, {
        method: 'POST',
        body: { targetId, sourceIds, version },
      }).then((r) => adminProductMergeResponseSchema.parse(r)),
    // Admin decision on a brand-new creator submission (`Product.status === 'pending'`,
    // no `ProductEdit` row involved). Distinct from `resolveEdit`, which is for
    // revisions to already-active products.
    moderate: (id: string, decision: AdminProductModerateDecision, version: number, notes?: string) =>
      apiServerFetch(`/v1/admin/products/${id}/moderate`, {
        method: 'POST',
        body: { decision, version, notes },
      }).then((r) => adminProductRowSchema.parse(r)),
    pending: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/products/pending${qs(q)}`).then((r) =>
        adminProductEditsListSchema.parse(r),
      ),
    // Single-revision detail (full desired metadata + photo order) plus the live
    // product's current version, so the UI can flag a stale revision before the admin
    // ever attempts approve/request-changes.
    getPendingEdit: (editId: string) =>
      apiServerFetch(`/v1/admin/products/pending/${editId}`).then((r) => adminProductEditDetailSchema.parse(r)),
    // `approve` publishes the revision to the live product and returns the full
    // product; `request_changes` returns the revision back to the creator and returns
    // the edit row. The caller already knows which one it asked for.
    resolveEdit: (id: string, decision: AdminProductEditResolveDecision, notes?: string) =>
      apiServerFetch(`/v1/admin/products/pending/${id}`, {
        method: 'PATCH',
        body: { decision, notes },
      }).then((r) => (decision === 'approve' ? productSchema.parse(r) : productEditRowSchema.parse(r))),
    // Recovery for a stale open revision (`product.version !== edit.baseProductVersion`):
    // `rebase` (reviewed desired-photo mapping, returns to pending) or `supersede`
    // (terminal `rejected`, frees the one-open-edit slot).
    recoverEdit: (editId: string, input: ProductEditRecoverRequest) =>
      apiServerFetch(`/v1/admin/products/edits/${editId}/recover`, {
        method: 'POST',
        body: input,
      }).then((r) => productEditRowSchema.parse(r)),
    // Direct correction of a live product's own photo set. These are the
    // creator-facing routes (`/v1/products/:id/photos/...`), not `/v1/admin/...` —
    // `checkPhotoMutablePolicy` explicitly grants the admin role a bypass of the
    // ownership check, and audit-logs the mutation when the caller is an admin.
    photos: {
      reorder: (productId: string, photoIds: string[]) =>
        apiServerFetch(`/v1/products/${productId}/photos/order`, {
          method: 'PATCH',
          body: { photoIds },
        }).then((r) => productSchema.parse(r)),
      remove: (productId: string, photoId: string) =>
        apiServerFetch(`/v1/products/${productId}/photos/${photoId}`, { method: 'DELETE' }).then((r) =>
          productSchema.parse(r),
        ),
    },
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
  giveaways: {
    list: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/giveaways${qs(q)}`),
    cancel: (id: string) =>
      apiServerFetch(`/v1/admin/giveaways/${id}/cancel`, { method: 'PATCH' }),
  },
  referrals: {
    overview: () =>
      apiServerFetch('/v1/admin/referrals/overview').then((r) =>
        adminReferralOverviewSchema.parse(r),
      ),
  },
  households: {
    list: (q: Q = {}) =>
      apiServerFetch(`/v1/admin/households${qs(q)}`).then((r) =>
        z.object({
          items: z.array(
            z.object({
              id: z.string().uuid(),
              name: z.string(),
              ownerUserId: z.string().uuid(),
              memberCount: z.number(),
              ownerFirstName: z.string(),
              ownerEmail: z.string().email(),
              createdAt: z.string(),
              updatedAt: z.string(),
            }),
          ),
          nextCursor: z.string().nullable(),
        }).parse(r),
      ),
    dissolve: (id: string) =>
      apiServerFetch(`/v1/admin/households/${id}`, { method: 'DELETE' }),
  },
};
