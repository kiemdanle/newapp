---
phase: 3
title: Expose admin observability
status: completed
priority: P2
dependencies:
  - 1
  - 2
---

# Phase 3: Expose Admin Observability

<!-- Updated: Validation Session 1 — current-role authorization, canonical server/mobile admin-origin trust, and durable pipeline-health observability. -->

## Overview

Make the current moderation backlog, batch history, and channel outcomes visible to authorized administrators. Add a reliable mobile notification-open behavior that sends admins to the existing HTTPS moderation queue, without exposing moderation data through public APIs or changing ordinary expiry-push flows.

## Requirements

- Functional:
  - Before the new history surface ships, fix `requireAdmin` to authorize against the database-current `User.role` (or atomically bump token version on role removal) and add a demoted-admin token regression test.
  - Show the current count of `Product.status = pending` plus `ProductEdit.status = pending` beside the existing “Pending edits” navigation link.
  - Link the count/badge to `/products/pending`; it must not imply that all items are new since a particular admin's last alert.
  - Add an admin-only system page for batch timestamp/counts, recipient-channel status/errors, per-token aggregate outcomes, and durable pipeline health with cursor pagination/filters.
  - Extend shared schemas and the admin server API client; responses must contain no FCM token value, recipient email, raw SMTP response, creator data, product names, or private URLs.
  - Add public mobile `MOBILE_ADMIN_URL` build config. In production it must normalize to and match canonical server `ADMIN_URL` origin; the mobile app accepts only its HTTPS origin, empty credentials, exact `/products/pending` path, and no fragment before opening a moderation push.
- Non-functional:
  - Preserve server-rendered admin page patterns and existing `DataTable`/`FilterBar` components.
  - Enforce authorization at the API route, not only UI; role must be current at request time.
  - Keep mobile notification-open handling fail-closed for malformed/untrusted payloads and make development-origin allowance explicit/test-only.

## Architecture

```text
Admin layout (server component)
  └─ serverAdminApi.system.moderationSummary()
       └─ GET /v1/admin/system/moderation-notifications/summary
            ├─ pending Product count
            └─ pending ProductEdit count

Admin system page
  └─ GET /v1/admin/system/moderation-notifications
       └─ batch rows + recipient/channel delivery status (paginated)

FCM notification-open handler
  └─ data.type === 'moderation_queue'
       └─ validate configured/known admin HTTPS URL + exact /products/pending path
            └─ Linking.openURL(url)
```

Use a dedicated API route instead of overloading `/system/push`: the existing route/list schema is intentionally `PushLog`-only and record-oriented. The new history endpoint treats a delivery row as the authoritative parent status while optionally surfacing a non-sensitive provider reference. Email and push outcomes remain comparable in one UI.

### Response shape sketch

```ts
type ModerationNotificationBatchRow = {
  id: string;
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  newProductCount: number;
  revisionCount: number;
  totalCount: number;
  deliverySummary: { pending: number; processing: number; sent: number; skipped: number; failed: number };
};

type ModerationNotificationDeliveryRow = {
  id: string;
  batchId: string;
  channel: 'push' | 'email';
  status: 'pending' | 'processing' | 'sent' | 'skipped' | 'failed';
  attempts: number;
  errorMessage: string | null;
  completedAt: string | null;
  tokenSummary?: { sent: number; failed: number; invalid: number };
};

type ModerationNotificationHealth = {
  lastSuccessfulTickAt: string | null;
  lastRecoveryAt: string | null;
  lastSchedulerReconciliationAt: string | null;
  oldestUnbatchedEventAt: string | null;
  oldestDueDeliveryAt: string | null;
  pendingDeliveries: number;
  terminalFailures: number;
};
```

Recipient identities are not included in general history. If operations needs per-recipient diagnosis, restrict it to a filtered admin-only endpoint accepting a user UUID and return the ID only, matching the existing system push-log pattern.

## Related Code Files

- Modify: `api/src/plugins/auth.ts` and the admin role-revocation route/service — authorize with current DB role or invalidate existing tokens on demotion; add regression test.
- Modify: `api/src/config.ts`, `api/.env.example`, mobile build environment/config, and deployment validation — canonical server `ADMIN_URL`, production HTTPS/no-userinfo/no-fragment rule, and independently configured `MOBILE_ADMIN_URL` consistency gate with explicit development exception.
- Modify: `packages/shared/src/schemas/admin/system.ts` (or the project’s established shared admin-system schema module) — Zod schemas for summary, batches, deliveries, health, filters, cursor lists.
- Modify: `packages/shared/src/index.ts` — export new shared contracts when required by existing barrel conventions.
- Create: `api/src/routes/admin/system/moderation-notifications.ts` — current-role-admin-only summary/history/health endpoints and request validation.
- Modify: `api/src/routes/admin/index.ts` — register the route under the existing admin/system boundary.
- Modify: `apps/admin/src/lib/admin-api.ts` — parse calls with shared schemas.
- Modify: `apps/admin/src/app/(admin)/layout.tsx`, `apps/admin/src/components/sidebar.tsx`, `apps/admin/src/lib/nav.ts` — inject display-only pending count into the existing queue navigation item while preserving desktop/mobile layout.
- Create: `apps/admin/src/app/(admin)/system/moderation-notifications/page.tsx` — server-rendered batch/delivery/health page.
- Modify: `apps/admin/src/components/header.tsx` only if layout evidence shows it is the least intrusive badge location; do not add a second duplicate indicator.
- Modify/Create: `apps/admin/tests/e2e/mock-admin-handlers.ts`, `apps/admin/tests/e2e/mock-store.ts`, and focused admin E2E specs — mock and validate summary/history/health view.
- Create/Modify: `apps/mobile/src/features/push/handle-notification-open.ts`, app startup/root handler, mobile config loader, and colocated Jest test — guarded moderation push tap behavior.
- Modify: mobile notification mocks/setup only when necessary for tap/config tests.
- Create/Modify: `api/tests/integration/admin-moderation-notification-system.test.ts` — current-role RBAC, schema redaction, health, counts, ordering/cursors.

## Implementation Steps

1. Fix the current-role authorization prerequisite first: `requireAdmin` must load/check current DB role, or role revocation must invalidate token versions. Add regression coverage proving a pre-demotion token cannot access new history/health endpoints.
2. Add canonical-origin config contracts: parse/normalize `cfg.frontend.adminUrl`; reject HTTP/userinfo/fragment in production; expose a non-secret `MOBILE_ADMIN_URL` build configuration; and test server/mobile origin equality in deployment/build validation. Isolate an explicit development-only exception.
3. Locate the shared admin system-contract module and add strict Zod response/query schemas for summary, batches, delivery/token aggregates, and health. Keep errors length-bounded/redacted.
4. Implement current-role-admin-only summary endpoint counting pending `Product` and `ProductEdit` rows. Add paginated batch history plus health endpoint ordered/filtered without N+1 queries: last tick/recovery/reconciliation/cleanup, oldest stranded-work age, pending/retryable/terminal counts, and cleanup counters.
5. Extend `serverAdminApi` with schema parsing. Update navigation model only enough to pass an optional count to “Pending edits.” Fetch summary in server-rendered layout, render an accessible badge, and preserve sidebar drawer behavior.
6. Build `/system/moderation-notifications` using established table/filter/pagination patterns. Present counts, window, channel/status, attempts, token aggregate, terminal time, safe error, and health/staleness status; link to `/products/pending`.
7. Add mobile helper/config loader. Return without action unless `type === 'moderation_queue'`, canonical `MOBILE_ADMIN_URL` is HTTPS/credential-free, payload origin exactly matches it, path exactly equals `/products/pending`, and fragment is empty. Construct/open canonical URL rather than trusting arbitrary query/redirect values. Register foreground/background/quit callbacks once.
8. Test current-role RBAC/redaction/cursor/health/zero counts, config rejection/mismatch, badge/history behavior, and mobile accepted/rejected config/payload paths. Re-run expiry-push registration/open tests.

## Success Criteria

- [ ] A pre-demotion token cannot access summary/history/health after role removal; active admins see one accessible pending-count badge and no count appears for non-admin/unauthenticated users.
- [ ] The count equals pending new products plus pending revisions at render time and remains correct when batches have not yet run.
- [ ] System history shows durable batches, per-channel outcomes, per-token aggregates, terminal times, and pipeline health with pagination/filtering, no N+1 queries, and no sensitive data.
- [ ] New endpoints parse/return shared Zod contracts and authorize using database-current role.
- [ ] Production config rejects unsafe server/mobile admin origins; a valid moderation push opens only the configured canonical HTTPS queue; malformed URL/config, wrong origin/path, credentials, fragments, and unknown types open nothing.
- [ ] Existing product queue, expiry pushes, sidebar/drawer navigation, and admin Playwright tests remain functional.
- [ ] Focused API/admin/mobile tests and TypeScript checks pass.

## Risk Assessment

- **Badge load impact:** server layout fetching on every admin render could add a count query. Keep it indexed/count-only and measure under expected moderation scale; do not introduce polling without a stated need.
- **Current-role authorization:** JWT role claims can become stale. The endpoint security gate must load current role or revoke token version on privilege removal.
- **Mobile web session mismatch:** an admin may need to authenticate in browser after tapping a push. This is safer than passing API tokens in URLs; never embed credentials in a notification.
- **Config drift:** independently configured server/mobile origins can diverge. Normalize/compare in a deployment build gate and fail production startup/build on unsafe values.
- **Response data leakage:** delivery history is operational data. Return opaque IDs only when explicitly filtered, structured status/counters, and redacted errors.
- **Duplicate tap handling:** React Native FCM can surface an initial notification and an open callback. Centralize idempotent handling around normalized message/batch ID.
