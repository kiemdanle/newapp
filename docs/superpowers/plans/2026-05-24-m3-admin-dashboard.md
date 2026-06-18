# M3 — Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire admin dashboard end-to-end: every `/v1/admin/*` HTTP endpoint from spec §6.7 (with audit logging, TOTP-gated session, and integration tests), plus every admin page from spec §8.3 wired against those endpoints. By the end of M3, an operator can sign in to the admin web app, moderate reports, merge products, suspend users, approve pending edits, review analytics, watch system health, and edit settings.

**Architecture:** Admin endpoints live in a Fastify sub-app mounted at `/v1/admin` and gated by two plugins built first: `admin-only` (extends `requireAuth` with `role === 'admin'`) and `audit` (decorates `req.auditLog(action, target, diff)` which writes to `admin_audit_log`). Every mutation route calls `req.auditLog(...)` before returning. The Next.js 15 (App Router) admin app uses Server Components for data-heavy pages, TanStack Query for client-side interactivity, TanStack Table for lists, shadcn/ui for primitives, recharts for charts, and a confirmation-modal pattern for every destructive action. All requests share the cookie-based API client installed in M0d.

**Tech Stack:** Fastify 4, Prisma 5, Zod 3, BullMQ, opossum, `@bull-board/api`, `@bull-board/fastify`, Next.js 15, TypeScript 5, Tailwind, shadcn/ui, TanStack Query 5, TanStack Table 8, recharts, Playwright, Vitest + Supertest.

**Spec reference:** `docs/superpowers/specs/2026-05-23-expyrico-app-design.md`. Read sections 2.8, 5 (`admin_audit_log`), 6.7, 8 before starting.

**Prerequisites (other milestones, assumed complete and merged):**

- **M0a/M0b** — Fastify API foundation, `requireAuth`/`requireAdmin` decorators, sessions service (with `revokeAllSessions`), `users`, `sessions`, `admin_audit_log` tables, `@expyrico/shared` Zod plumbing.
- **M0d** — Admin Next.js app shell, `/login` with TOTP, CSRF middleware, HTTP-only cookie session, the API client `lib/api.ts`, the `writeAuditLog({...})` low-level helper, page stubs at every route listed in spec §8.3, Ansible/nginx/systemd plumbing.
- **M1** — `products`, `records`, `product_edits`, `push_logs` tables; BullMQ queues registered (`product-lookup`, `notification-schedule`, `notification-send`); opossum circuit breakers wrapping OFF/UPCitemdb/Expo Push exposed via `getBreaker(name)`.
- **M2** — `reviews`, `review_votes`, `reports`, `product_rating_country` tables; review status enum (`visible`, `hidden`, `deleted`); `moderation-flag` queue. A review carries a single three-option `rating` (`buy_again`/`buy_again_on_sale`/`wont_buy`) + optional `body` (comment) + helpful/not-helpful counts; the `rating-recalc` worker denormalizes the per-product tallies (`buy_again_count`/`buy_again_on_sale_count`/`wont_buy_count`/`rating_count`/`review_count`) and the per-country rollup.

**Out of scope for M3:** anything not in spec §6.7 or §8. Mobile screens (M0c/M1/M2). Provisioning/deploy (M0d/M4).

---

## Execution order — backend-first (2026-05-26)

The project is re-sequenced to build **backend + admin first (Track A)**, then **mobile (Track B)**. This file is **Track A (admin dashboard — entire plan: admin API + admin web; runs after M1/M2 backend).** Track A order: M0a → M0b → M0d → M1 (backend phases) → M2 (backend phases) → M3 → M5–M8 (backend + admin phases). All backend/admin (Track A) plans are built and deployed before ANY mobile (Track B) work begins.

---

## Requirement revision — 2026-06-08 (Expyrico)

Canonical contract: `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` (2026-06-08 revision §2.6/§2.7). **This supersedes the 2026-05-26 "Feature additions" block below.** M2's rating model changed from taste+value to a single three-option rating, and voting from up/down to helpful/not-helpful. M3 consumes the new contract everywhere it showed ratings/votes:

- **Admin reviews Zod** (`packages/shared/src/schemas/admin/reviews.ts`): `adminReviewRowSchema` exposes `rating` (`buy_again` / `buy_again_on_sale` / `wont_buy`) + `comment` (the body) + `helpfulCount` / `notHelpfulCount`; `adminReviewsQuerySchema` filters by `rating` (enum). No `tasteRating` / `valueRating`, no `upvoteCount` / `downvoteCount`.
- **Admin reviews routes** (`/v1/admin/reviews` list, `/v1/admin/reviews/:id` get): return `rating` + helpful/not-helpful counts. The report `targetPreview` for a review carries `rating` + `comment`.
- **Admin product surface:** products carry the three-option tallies `buyAgainCount` / `buyAgainOnSaleCount` / `wontBuyCount` / `ratingCount` + `reviewCount` and `isCommunityEligible` (provided by M1, denormalized by the M2 `rating-recalc` worker). The admin product row schema, list/get/patch routes, the product-merge recalc + merge response (tallies + `newRatingCount` / `newReviewCount`), and the products list page show the three-option breakdown (e.g. "% buy again"). No `rating_avg` / `rating_count`-as-average or taste/value columns.
- **Analytics:** `/v1/admin/analytics/reviews` reports the three-option distribution (`buyAgainPct` / `buyAgainOnSalePct` / `wontBuyPct` over the window) alongside the existing `autoFlaggedRate`; the analytics reviews page shows the breakdown.
- **Admin pages:** the reviews table shows a Rating column (three-option pill) + Helpful/Not-helpful counts with a rating filter; the review detail page shows the rating choice + comment + helpful/not-helpful.

Field names used throughout: wire `rating` (enum) + `comment` + `helpfulCount` / `notHelpfulCount`; product `buyAgainCount` / `buyAgainOnSaleCount` / `wontBuyCount` / `ratingCount` / `reviewCount` + `isCommunityEligible`.

---

## Feature additions — 2026-05-26  ⚠️ SUPERSEDED (see 2026-06-08 revision above)

> The two-criteria taste+value admin surface described here was replaced on 2026-06-08 by the three-option rating + helpful/not-helpful model. Retained only as change history — **do not implement the taste/value contract below.**

**Two-criteria review ratings surface in admin (replaces the single `rating`).** M2 replaced the single review `rating` with two required 1–5 criteria; M3 consumes that everywhere it showed `rating`:

- **Admin reviews Zod** (`packages/shared/src/schemas/admin/reviews.ts`): `adminReviewRowSchema` exposes `tasteRating` + `valueRating` (1–5); `adminReviewsQuerySchema` filters by `tasteRating` and/or `valueRating` (the old single `rating` filter is gone).
- **Admin reviews routes** (`/v1/admin/reviews` list, `/v1/admin/reviews/:id` get): return both criteria. The report `targetPreview` for a review carries `tasteRating` + `valueRating`.
- **Admin product surface:** products now carry `taste_avg` / `value_avg` (`numeric(3,2)`) + `review_count` (provided by M1, denormalized by the M2 `product-rating-recalc` worker). The admin product row schema, list/get/patch routes, the product-merge recalc + merge response (`newTasteAvg` / `newValueAvg` / `newReviewCount`), and the products list page show `tasteAvg` / `valueAvg`. The old `rating_avg` / `rating_count` are no longer read or written.
- **Analytics:** `/v1/admin/analytics/reviews` adds window-mean `avgTaste` / `avgValue` (nullable) alongside the existing `autoFlaggedRate`; the analytics reviews page shows both.
- **Admin pages:** the reviews table shows Taste + Value columns with separate filter inputs; the review detail page shows `Taste: x/5 · Value: y/5`.

Field names used throughout: wire `tasteRating` / `valueRating`; product `tasteAvg` / `valueAvg` / `reviewCount` (DB `taste_avg` / `value_avg` / `review_count`).

---

## Completion status — 2026-06-14

M3 is implemented and verified end-to-end. Verification gates: admin API integration tests 36/36 pass; system/analytics/settings 11/11; admin unit tests 17/17; `@expyrico/shared`, `@expyrico/api`, `@expyrico/admin` typecheck clean; Phase K Playwright suite 6/6 pass (3 login + moderate-report + merge-product + suspend-user).

Two implementation decisions differ from the literal task text and were confirmed with the product owner:

1. **Task I7 — dedicated merge page (built as specified).** `/products/[id]/merge` exists as a Server Component (`page.tsx`) plus a client island (`merge-tool.tsx`) with candidate search + checkbox selection. It is built in the codebase's standardized idiom — Server Components + server actions over `serverAdminApi` — not the original draft's `browserAdminApi`/TanStack Query client, which the project never adopted. The product detail page links to this tool (the earlier inline comma-separated-ids textarea was removed).
2. **Phase K — hermetic mock harness (not a live API).** The three E2E specs (`moderate-report`, `merge-product`, `suspend-user`) run against the in-process mock API M0d shipped (`tests/e2e/mock-api.ts` + `mock-store.ts` + `mock-admin-handlers.ts`) on port 4099, reset per-spec via `POST /v1/dev/reset`, with a shared `loginAsAdmin`/`resetStore` helper (`admin-helpers.ts`). The plan's original draft assumed a live API on :4000 with `/v1/dev/seed-*` routes and a seeded Postgres; that harness was never built, so the specs were written for the mock instead. Specs live under `apps/admin/tests/e2e/` (not the draft's `apps/admin/e2e/`). Selectors match the real shipped DOM (native `window.confirm`, button labels "Hide content"/"Suspend", etc.).

Note for CI: Playwright needs the Chromium system libraries (`libatk-1.0` et al.) installed in the runner image.

---

## Validation amendments — 2026-05-26

These corrections were applied after a validation pass. They are folded into the relevant tasks below; this list is a plain-language summary.

1. **Admin API client naming is standardized.** The admin web app's typed client (Phase H, `apps/admin/src/lib/admin-api.ts`) exports two variants over M0d's low-level fetchers: `serverAdminApi` (built on `apiServerFetch`, for Server Components / data pages / server actions) and `browserAdminApi` (built on `apiBrowserFetch`, for Client Components / `'use client'` interactivity). Earlier draft page code imported a non-existent `{ adminApi }`, which would not compile. Every admin page now imports the correct variant for its component type: Server Components use `serverAdminApi`; `'use client'` islands use `browserAdminApi`.
2. **Detail pages fetch by id instead of searching the list.** `/products/[id]` previously fetched via `list({ q: id })`, but `q` matches name/brand/barcode (not id), so valid products rendered "not found". `/reviews/[id]` previously read an unfiltered first page, so reviews past page 1 were unreachable. Two new audit-free by-id endpoints are added — `GET /v1/admin/products/:id` (Task C3a) and `GET /v1/admin/reviews/:id` (Task D2a) — each with an integration test, and both detail pages now fetch by id through the admin API client.
3. **Queue-health + seeded system user confirmed (no change).** The system-health test already asserts the `product-rating-recalc` queue, and the users-list test already asserts the seeded system user `00000000-0000-0000-0000-000000000001` (both provided by M2). The plan text is consistent; left as-is.

---

## File map

This plan adds the following files. Files in **bold** carry significant logic.

```
expyrico/
├── packages/shared/
│   └── src/schemas/admin/
│       ├── common.ts                                ← cursor pagination, diff envelope
│       ├── users.ts
│       ├── products.ts
│       ├── reviews.ts
│       ├── reports.ts
│       ├── analytics.ts
│       ├── system.ts
│       └── settings.ts
├── api/
│   ├── prisma/schema.prisma                         ← +Settings, +ApiError, +ProductEdit (if not in M1), +NotificationTemplate
│   ├── src/
│   │   ├── plugins/
│   │   │   ├── admin-only.ts                        ← preHandler: requireAdmin
│   │   │   ├── audit.ts                             ← req.auditLog()
│   │   │   └── api-error-recorder.ts                ← onResponse hook → api_errors table
│   │   ├── routes/admin/
│   │   │   ├── index.ts                             ← mounts sub-app at /v1/admin
│   │   │   ├── users/
│   │   │   │   ├── list.ts
│   │   │   │   ├── get.ts
│   │   │   │   ├── patch.ts
│   │   │   │   ├── revoke-sessions.ts
│   │   │   │   └── impersonate.ts
│   │   │   ├── products/
│   │   │   │   ├── list.ts
│   │   │   │   ├── get.ts                           ← by-id fetch for detail page
│   │   │   │   ├── patch.ts
│   │   │   │   ├── merge.ts                         ← **transactional merge**
│   │   │   │   ├── pending.ts
│   │   │   │   └── pending-resolve.ts
│   │   │   ├── reviews/
│   │   │   │   ├── list.ts
│   │   │   │   ├── get.ts                           ← by-id fetch for detail page
│   │   │   │   └── status.ts
│   │   │   ├── reports/
│   │   │   │   ├── list.ts
│   │   │   │   └── resolve.ts                       ← **transactional resolve**
│   │   │   ├── analytics/
│   │   │   │   ├── overview.ts
│   │   │   │   ├── scans.ts
│   │   │   │   ├── reviews.ts
│   │   │   │   └── geography.ts
│   │   │   ├── system/
│   │   │   │   ├── queue-health.ts
│   │   │   │   ├── push-logs.ts
│   │   │   │   ├── api-errors.ts
│   │   │   │   ├── external-apis.ts
│   │   │   │   └── bullboard.ts                     ← mounts @bull-board/fastify
│   │   │   └── settings/
│   │   │       ├── feature-flags.ts
│   │   │       ├── notification-templates.ts
│   │   │       ├── moderation.ts
│   │   │       └── admins.ts
│   │   └── services/admin/
│   │       ├── settings.ts                          ← typed get/put against settings table
│   │       ├── merge.ts                             ← product merge tx
│   │       ├── analytics.ts                         ← raw SQL aggregations
│   │       └── breakers.ts                          ← opossum stats getter
│   └── tests/integration/admin/
│       ├── plugin-admin-only.test.ts
│       ├── plugin-audit.test.ts
│       ├── users-list.test.ts
│       ├── users-get.test.ts
│       ├── users-patch.test.ts
│       ├── users-revoke.test.ts
│       ├── users-impersonate.test.ts
│       ├── products-list.test.ts
│       ├── products-get.test.ts
│       ├── products-patch.test.ts
│       ├── products-merge.test.ts
│       ├── products-pending.test.ts
│       ├── reviews-list.test.ts
│       ├── reviews-get.test.ts
│       ├── reviews-status.test.ts
│       ├── reports-list.test.ts
│       ├── reports-resolve.test.ts
│       ├── analytics.test.ts
│       ├── system.test.ts
│       └── settings.test.ts
└── apps/admin/
    ├── src/
    │   ├── lib/
    │   │   ├── admin-api.ts                         ← typed wrappers over M0d's api client
    │   │   ├── use-bulk-selection.ts                ← Part D hook
    │   │   └── toast.ts                             ← shadcn toast helper
    │   ├── components/
    │   │   ├── confirm-modal.tsx                    ← <ConfirmModal>
    │   │   ├── data-table.tsx                       ← TanStack Table wrapper
    │   │   ├── kpi-card.tsx
    │   │   ├── chart-line.tsx
    │   │   ├── chart-bar.tsx
    │   │   └── status-badge.tsx
    │   └── app/(admin)/
    │       ├── page.tsx                             ← /
    │       ├── users/page.tsx
    │       ├── users/[id]/page.tsx
    │       ├── users/[id]/_tabs/*.tsx
    │       ├── products/page.tsx
    │       ├── products/[id]/page.tsx
    │       ├── products/[id]/merge/page.tsx
    │       ├── products/pending/page.tsx
    │       ├── reviews/page.tsx
    │       ├── reviews/[id]/page.tsx
    │       ├── reports/page.tsx
    │       ├── reports/[id]/page.tsx
    │       ├── analytics/overview/page.tsx
    │       ├── analytics/scans/page.tsx
    │       ├── analytics/reviews/page.tsx
    │       ├── analytics/geography/page.tsx
    │       ├── system/queue/page.tsx
    │       ├── system/push/page.tsx
    │       ├── system/api-errors/page.tsx
    │       ├── system/external-apis/page.tsx
    │       ├── settings/feature-flags/page.tsx
    │       ├── settings/notification-templates/page.tsx
    │       ├── settings/moderation/page.tsx
    │       └── settings/admins/page.tsx
    └── e2e/
        ├── moderate-report.spec.ts
        ├── merge-product.spec.ts
        └── suspend-user.spec.ts
```

---

## Conventions

- **TDD on every endpoint.** Write the failing Vitest+Supertest integration test, run it, watch it fail, implement, watch it pass, commit. UI tasks: write the Playwright spec last (Part E) after underlying endpoints work; unit-test pure hooks (`use-bulk-selection`) inline.
- **Conventional commits.** Scopes:
  - `api` — anything under `api/` (admin routes, plugins, services, migrations).
  - `admin` — anything under `apps/admin/`.
  - `shared` — Zod schemas under `packages/shared/src/schemas/admin/`.
- **Every admin mutation MUST call `req.auditLog(action, target, diff)` before returning.** Integration tests assert the row exists.
- **All Zod schemas live in `@expyrico/shared`** and are imported by both API routes and admin pages — no inline `z.object(...)` inside routes or pages.
- **Cursor pagination everywhere.** Cursor is the base64-encoded `{createdAt, id}` of the last row. `limit` defaults to 50, max 200.
- **Server vs Client components.** Default to Server Components for data fetching; mark `'use client'` only when the component owns local state (forms, tables with sorting, modals).
- **TanStack Query** owns mutation invalidation. `queryKey` arrays follow `['admin', resource, ...filters]`.

---

## Phase A — Schema additions, shared Zod, admin sub-app skeleton

### Task A1: Add `settings`, `notification_templates`, `api_errors` tables to Prisma schema

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Append the new models to the bottom of `api/prisma/schema.prisma`**

```prisma
/// Single-row key/value JSON store for feature flags, moderation knobs, etc.
model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.Uuid

  @@map("settings")
}

/// Push-notification message templates editable from the admin UI.
model NotificationTemplate {
  id        String   @id @default(uuid()) @db.Uuid
  key       String   @unique // e.g., "expiry_7d", "expiry_1d", "expiry_today"
  title     String
  body      String
  enabled   Boolean  @default(true)
  updatedAt DateTime @updatedAt
  updatedBy String?  @db.Uuid

  @@map("notification_templates")
}

/// Captured by an onResponse hook for every 4xx/5xx; powers /admin/system/api-errors.
model ApiError {
  id         String   @id @default(uuid()) @db.Uuid
  route      String
  method     String
  status     Int
  code       String?
  message    String?
  requestId  String?
  userId     String?  @db.Uuid
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([route, status])
  @@map("api_errors")
}
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm --filter @expyrico/api exec prisma migrate dev --name m3_admin_tables
```
Expected: a new SQL file under `api/prisma/migrations/<ts>_m3_admin_tables/` and `Generated Prisma Client`.

- [ ] **Step 3: Apply to the test database**

```bash
DATABASE_URL=postgresql://expyrico:expyrico@localhost:5432/expyrico_test pnpm --filter @expyrico/api exec prisma migrate deploy
```

- [ ] **Step 4: Commit**

```bash
git add api/prisma
git commit -m "feat(api): add settings, notification_templates, api_errors tables"
```

---

### Task A2: Seed default settings rows + notification templates

**Files:**
- Create: `api/prisma/seed-admin.ts`
- Modify: `api/package.json` (add script)

- [ ] **Step 1: Write `api/prisma/seed-admin.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: { key: 'feature_flags' },
    update: {},
    create: {
      key: 'feature_flags',
      value: {
        reviewsEnabled: true,
        passkeysEnabled: true,
        ocrEnabled: true,
        maintenanceBanner: null,
      },
    },
  });
  await prisma.setting.upsert({
    where: { key: 'moderation' },
    update: {},
    create: {
      key: 'moderation',
      value: {
        autoHideReportThreshold: 3,
        profanitySensitivity: 'medium', // 'low' | 'medium' | 'high'
      },
    },
  });

  const templates = [
    { key: 'expiry_7d', title: 'Expires in 7 days', body: '{name} expires on {date}.' },
    { key: 'expiry_1d', title: 'Expires tomorrow', body: '{name} expires tomorrow.' },
    { key: 'expiry_today', title: 'Expires today', body: '{name} expires today.' },
  ];
  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { key: t.key },
      update: {},
      create: t,
    });
  }
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add a `seed:admin` script to `api/package.json`**

In the `"scripts"` block, add:
```json
"seed:admin": "tsx prisma/seed-admin.ts"
```

- [ ] **Step 3: Run the seed against dev DB**

```bash
pnpm --filter @expyrico/api seed:admin
```
Expected: completes without errors.

- [ ] **Step 4: Commit**

```bash
git add api/prisma/seed-admin.ts api/package.json
git commit -m "chore(api): seed default admin settings and notification templates"
```

---

### Task A3: Shared cursor + diff Zod helpers

**Files:**
- Create: `packages/shared/src/schemas/admin/common.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin/common.ts`**

```ts
import { z } from 'zod';

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const cursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export const auditDiffSchema = z.object({
  before: z.record(z.unknown()).nullable(),
  after: z.record(z.unknown()).nullable(),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;
export type AuditDiff = z.infer<typeof auditDiffSchema>;

/** Encode a (createdAt, id) pair to an opaque cursor string. */
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64url');
}

/** Decode an opaque cursor or return null if malformed. */
export function decodeCursor(cursor: string | undefined | null): { t: Date; i: string } | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return { t: new Date(raw.t), i: String(raw.i) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/admin/common.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @expyrico/shared typecheck
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): cursor pagination + audit diff schemas"
```

---

### Task A4: Admin sub-app skeleton + mount

**Files:**
- Create: `api/src/routes/admin/index.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write `api/src/routes/admin/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';

export async function adminRoutes(app: FastifyInstance) {
  // Plugins and child routers are registered in Tasks A5, A6 and subsequent phases.
  // This empty mount confirms the prefix is reachable before sub-routes exist.
  app.get('/_ping', async () => ({ ok: true }));
}
```

- [ ] **Step 2: Mount in `api/src/server.ts`**

Find the existing `await app.register(authRoutes, { prefix: '/v1/auth' });` line and add right after:
```ts
await app.register(adminRoutes, { prefix: '/v1/admin' });
```
And at the top:
```ts
import { adminRoutes } from './routes/admin/index.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add api/src
git commit -m "feat(api): mount admin sub-app at /v1/admin"
```

---

### Task A5: `admin-only` Fastify plugin (TDD)

**Files:**
- Create: `api/src/plugins/admin-only.ts`
- Create: `api/tests/integration/admin/plugin-admin-only.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/plugin-admin-only.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { hashPassword } from '../../../src/services/auth/passwords.js';
import { issueAccessToken } from '../../../src/services/auth/tokens.js';

async function bearer(role: 'user' | 'admin') {
  const prisma = getPrisma();
  const user = await prisma.user.create({
    data: {
      email: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      passwordHash: await hashPassword('correct-horse-battery-staple'),
      firstName: 'A',
      lastName: 'B',
      role,
      emailVerifiedAt: new Date(),
    },
  });
  return `Bearer ${await issueAccessToken({ sub: user.id, role: user.role })}`;
}

describe('admin-only plugin', () => {
  it('returns 401 when no bearer is sent', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/_ping' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 403 when caller is a non-admin user', async () => {
    const app = await buildServer();
    const auth = await bearer('user');
    const res = await app.inject({ method: 'GET', url: '/v1/admin/_ping', headers: { authorization: auth } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('allows admin through', async () => {
    const app = await buildServer();
    const auth = await bearer('admin');
    const res = await app.inject({ method: 'GET', url: '/v1/admin/_ping', headers: { authorization: auth } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/plugin-admin-only.test.ts
```

- [ ] **Step 3: Write `api/src/plugins/admin-only.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export const adminOnlyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (req, reply) => {
    await app.requireAdmin(req, reply);
  });
});
```

- [ ] **Step 4: Apply in `api/src/routes/admin/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { adminOnlyPlugin } from '../../plugins/admin-only.js';

export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminOnlyPlugin);
  app.get('/_ping', async () => ({ ok: true }));
}
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/plugin-admin-only.test.ts
```
Expected: all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add api/src/plugins/admin-only.ts api/src/routes/admin/index.ts api/tests/integration/admin/plugin-admin-only.test.ts
git commit -m "feat(api): admin-only plugin gates /v1/admin sub-app"
```

---

### Task A6: `audit` Fastify plugin — `req.auditLog()` (TDD)

**Files:**
- Create: `api/src/plugins/audit.ts`
- Create: `api/tests/integration/admin/plugin-audit.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/plugin-audit.test.ts
import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { makeAdmin } from '../../helpers/admin.js';
import * as auditService from '../../../src/services/audit/log.js';

vi.spyOn(auditService, 'writeAuditLog').mockResolvedValue();

describe('audit plugin', () => {
  it('delegates to writeAuditLog when req.auditLog is called', async () => {
    const app = await buildServer();
    // Register a one-off probe route inside the admin sub-app for this test.
    app.post('/v1/admin/_test-audit', async (req) => {
      await req.auditLog('test.action', { type: 'thing', id: 'thing-1' }, { before: null, after: { x: 1 } });
      return { ok: true };
    });

    const { admin, headers } = await makeAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/_test-audit',
      headers: { ...headers, 'x-request-id': 'req-abc' },
    });
    expect(res.statusCode).toBe(200);

    expect(auditService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: admin.id,
        action: 'test.action',
        targetType: 'thing',
        targetId: 'thing-1',
        requestId: 'req-abc',
        diff: { before: null, after: { x: 1 } },
      }),
    );
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/plugin-audit.test.ts
```

- [ ] **Step 3: Write `api/src/plugins/audit.ts`**

```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { writeAuditLog } from '../services/audit/log.js'; // helper shipped in M0d (Phase C)
import type { AuditDiff } from '@expyrico/shared';

export type AuditTarget = { type: string; id: string };

declare module 'fastify' {
  interface FastifyRequest {
    auditLog: (action: string, target: AuditTarget, diff?: AuditDiff | null) => Promise<void>;
  }
}

export const auditPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('auditLog', async function (this: FastifyRequest, action, target, diff = null) {
    if (!this.user) throw new Error('auditLog requires an authenticated admin');
    await writeAuditLog({
      adminId: this.user.id,
      action,
      targetType: target.type,
      targetId: target.id,
      diff,
      requestId: (this.headers['x-request-id'] as string) ?? this.id,
      ip: this.ip,
    });
  });
});
```

- [ ] **Step 4: Register inside the admin sub-app**

Update `api/src/routes/admin/index.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { adminOnlyPlugin } from '../../plugins/admin-only.js';
import { auditPlugin } from '../../plugins/audit.js';

export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminOnlyPlugin);
  await app.register(auditPlugin);
  app.get('/_ping', async () => ({ ok: true }));
}
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/plugin-audit.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/plugins/audit.ts api/src/routes/admin/index.ts api/tests/integration/admin/plugin-audit.test.ts
git commit -m "feat(api): req.auditLog plugin for admin sub-app"
```

---

### Task A7: Test helpers — admin / user factories

**Files:**
- Create: `api/tests/helpers/admin.ts`

- [ ] **Step 1: Write the helper**

```ts
// api/tests/helpers/admin.ts
import { getPrisma } from '../../src/db.js';
import { hashPassword } from '../../src/services/auth/passwords.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

export async function makeAdmin(overrides: Partial<{ email: string; firstName: string; lastName: string }> = {}) {
  const email = overrides.email ?? `admin-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const admin = await getPrisma().user.create({
    data: {
      email,
      passwordHash: await hashPassword('correct-horse-battery-staple'),
      firstName: overrides.firstName ?? 'Ada',
      lastName: overrides.lastName ?? 'Lovelace',
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });
  const token = await issueAccessToken({ sub: admin.id, role: 'admin' });
  return { admin, headers: { authorization: `Bearer ${token}` } };
}

export async function makeUser(overrides: Partial<{ email: string; status: 'active' | 'suspended' | 'deleted'; country: string }> = {}) {
  const email = overrides.email ?? `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  return getPrisma().user.create({
    data: {
      email,
      passwordHash: await hashPassword('correct-horse-battery-staple'),
      firstName: 'Reg',
      lastName: 'User',
      role: 'user',
      status: overrides.status ?? 'active',
      country: overrides.country ?? 'US',
      emailVerifiedAt: new Date(),
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/tests/helpers/admin.ts
git commit -m "test(api): admin/user factory helpers"
```

---

## Phase B — Admin users endpoints

### Task B1: Shared Zod schemas for admin users

**Files:**
- Create: `packages/shared/src/schemas/admin/users.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin/users.ts`**

```ts
import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const userRoleSchema = z.enum(['user', 'admin']);
export const userStatusSchema = z.enum(['active', 'suspended', 'deleted']);

export const adminUserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  country: z.string().nullable(),
  role: userRoleSchema,
  status: userStatusSchema,
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
});

export const adminUsersQuerySchema = cursorQuerySchema.extend({
  status: userStatusSchema.optional(),
  role: userRoleSchema.optional(),
  country: z.string().length(2).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(['createdAt', 'lastSeenAt', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const adminUsersListSchema = cursorPageSchema(adminUserRowSchema);

export const adminUserDetailSchema = adminUserRowSchema.extend({
  emailVerifiedAt: z.string().datetime().nullable(),
  totpEnabledAt: z.string().datetime().nullable(),
  recordCount: z.number().int(),
  reviewCount: z.number().int(),
  openReportsAgainst: z.number().int(),
  sessions: z.array(z.object({
    id: z.string().uuid(),
    ip: z.string().nullable(),
    deviceInfo: z.record(z.unknown()).nullable(),
    expiresAt: z.string().datetime(),
    revokedAt: z.string().datetime().nullable(),
  })),
});

export const adminUserPatchSchema = z.object({
  status: userStatusSchema.optional(),
  role: userRoleSchema.optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'no fields to update' });

export const adminUserImpersonateResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserPatch = z.infer<typeof adminUserPatchSchema>;
```

- [ ] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/admin/users.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @expyrico/shared typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): admin users zod schemas"
```

---

### Task B2: GET /v1/admin/users (list)

**Files:**
- Create: `api/src/routes/admin/users/list.ts`
- Create: `api/tests/integration/admin/users-list.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/users-list.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('GET /v1/admin/users', () => {
  it('returns paginated users with filtering and search', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await makeUser({ email: 'alice@example.com', country: 'US' });
    await makeUser({ email: 'bob@example.com', country: 'GB', status: 'suspended' });
    await makeUser({ email: 'carol@example.com', country: 'US' });

    // D30: the M2 system user must exist in the DB but be hidden from the admin list.
    const systemUser = await getPrisma().user.findUnique({ where: { id: '00000000-0000-0000-0000-000000000001' } });
    expect(systemUser).not.toBeNull(); // sanity: it exists in DB

    const res = await app.inject({ method: 'GET', url: '/v1/admin/users?limit=10', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(3);
    expect(body.nextCursor === null || typeof body.nextCursor === 'string').toBe(true);
    expect(body.items.find((u: { id: string }) => u.id === '00000000-0000-0000-0000-000000000001')).toBeUndefined();

    const filtered = await app.inject({ method: 'GET', url: '/v1/admin/users?status=suspended', headers });
    const bodyF = filtered.json();
    expect(bodyF.items.every((u: { status: string }) => u.status === 'suspended')).toBe(true);

    const searched = await app.inject({ method: 'GET', url: '/v1/admin/users?q=carol', headers });
    expect(searched.json().items.some((u: { email: string }) => u.email === 'carol@example.com')).toBe(true);
    await app.close();
  });

  it('paginates with cursor', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    for (let i = 0; i < 5; i++) await makeUser({ email: `pg-${i}-${Date.now()}@example.com` });

    const p1 = await app.inject({ method: 'GET', url: '/v1/admin/users?limit=2', headers });
    const b1 = p1.json();
    expect(b1.items).toHaveLength(2);
    expect(b1.nextCursor).toBeTruthy();
    const p2 = await app.inject({ method: 'GET', url: `/v1/admin/users?limit=2&cursor=${encodeURIComponent(b1.nextCursor)}`, headers });
    const b2 = p2.json();
    expect(b2.items).toHaveLength(2);
    expect(b2.items[0].id).not.toBe(b1.items[0].id);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-list.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/users/list.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  adminUsersQuerySchema,
  adminUsersListSchema,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminUsersListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminUsersQuerySchema.parse(req.query);
    const prisma = getPrisma();

    // D30: hide the system user (M2 seeds it with id 00000000-0000-0000-0000-000000000001) from the admin list.
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
    const where: Prisma.UserWhereInput = { id: { not: SYSTEM_USER_ID } };
    if (q.status) where.status = q.status;
    if (q.role) where.role = q.role;
    if (q.country) where.country = q.country;
    if (q.q) {
      where.OR = [
        { email: { contains: q.q, mode: 'insensitive' } },
        { firstName: { contains: q.q, mode: 'insensitive' } },
        { lastName: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const cur = decodeCursor(q.cursor);
    // Cursor comparison uses (sort field, id) tuple. We always sort by createdAt under the hood
    // to keep the cursor stable, then apply the user-chosen sort as a secondary order.
    if (cur) {
      where.OR = [
        ...(where.OR ?? []),
        { createdAt: { lt: cur.t } },
        { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] },
      ];
    }

    const rows = await prisma.user.findMany({
      where,
      orderBy: [{ [q.sort]: q.order }, { id: 'desc' }],
      take: q.limit + 1,
    });

    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      country: u.country,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    }));
    const last = items.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null;

    return adminUsersListSchema.parse({ items, nextCursor });
  });
}
```

- [ ] **Step 4: Wire into admin router**

Update `api/src/routes/admin/index.ts` (add inside `adminRoutes` after audit plugin):
```ts
import { adminUsersListRoute } from './users/list.js';
// ...
await app.register(adminUsersListRoute, { prefix: '/users' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-list.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/users/list.ts api/src/routes/admin/index.ts api/tests/integration/admin/users-list.test.ts
git commit -m "feat(api): GET /v1/admin/users with filters and cursor pagination"
```

---

### Task B3: GET /v1/admin/users/:id (detail)

**Files:**
- Create: `api/src/routes/admin/users/get.ts`
- Create: `api/tests/integration/admin/users-get.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/users-get.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('GET /v1/admin/users/:id', () => {
  it('returns full profile with counts and sessions', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const u = await makeUser({ email: 'detail@example.com' });
    await getPrisma().session.create({
      data: {
        userId: u.id,
        refreshTokenHash: 'h1',
        ip: '1.2.3.4',
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });

    const res = await app.inject({ method: 'GET', url: `/v1/admin/users/${u.id}`, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(u.id);
    expect(body.sessions).toHaveLength(1);
    expect(body.recordCount).toBe(0);
    expect(body.reviewCount).toBe(0);
    expect(body.openReportsAgainst).toBe(0);
    await app.close();
  });

  it('returns 404 for missing user', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/users/00000000-0000-0000-0000-000000000000', headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-get.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/users/get.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminUserDetailSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });

    const [recordCount, reviewCount, openReportsAgainst, sessions] = await Promise.all([
      prisma.record.count({ where: { userId: id } }),
      prisma.review.count({ where: { userId: id } }),
      prisma.report.count({ where: { targetType: 'user', targetId: id, status: 'open' } }),
      prisma.session.findMany({
        where: { userId: id },
        orderBy: { expiresAt: 'desc' },
        take: 20,
      }),
    ]);

    return adminUserDetailSchema.parse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      country: user.country,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      totpEnabledAt: user.totpEnabledAt?.toISOString() ?? null,
      recordCount,
      reviewCount,
      openReportsAgainst,
      sessions: sessions.map((s) => ({
        id: s.id,
        ip: s.ip,
        deviceInfo: (s.deviceInfo as Record<string, unknown>) ?? null,
        expiresAt: s.expiresAt.toISOString(),
        revokedAt: s.revokedAt?.toISOString() ?? null,
      })),
    });
  });
}
```

- [ ] **Step 4: Wire into admin router** — add to `api/src/routes/admin/index.ts`:

```ts
import { adminUsersGetRoute } from './users/get.js';
// ...
await app.register(adminUsersGetRoute, { prefix: '/users' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-get.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/users/get.ts api/src/routes/admin/index.ts api/tests/integration/admin/users-get.test.ts
git commit -m "feat(api): GET /v1/admin/users/:id detail"
```

---

### Task B4: PATCH /v1/admin/users/:id (status/role/name) — audit-logged

**Files:**
- Create: `api/src/routes/admin/users/patch.ts`
- Create: `api/tests/integration/admin/users-patch.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/users-patch.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('PATCH /v1/admin/users/:id', () => {
  it('updates fields and writes an audit row with before/after diff', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const u = await makeUser({ email: 'patch@example.com' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/users/${u.id}`,
      headers,
      payload: { status: 'suspended', firstName: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('suspended');
    expect(body.firstName).toBe('Renamed');

    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, targetType: 'user', targetId: u.id } });
    expect(log.action).toBe('user.update');
    expect(log.diff).toMatchObject({
      before: { status: 'active', firstName: 'Reg' },
      after: { status: 'suspended', firstName: 'Renamed' },
    });
    await app.close();
  });

  it('returns 400 on empty patch', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const u = await makeUser();
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/users/${u.id}`, headers, payload: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-patch.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/users/patch.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminUserPatchSchema, adminUserRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersPatchRoute(app: FastifyInstance) {
  app.patch('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminUserPatchSchema.parse(req.body);
    const prisma = getPrisma();

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });

    const after = await prisma.user.update({ where: { id }, data: input });

    const beforeDiff: Record<string, unknown> = {};
    const afterDiff: Record<string, unknown> = {};
    for (const k of Object.keys(input) as (keyof typeof input)[]) {
      beforeDiff[k] = (before as Record<string, unknown>)[k];
      afterDiff[k] = (after as Record<string, unknown>)[k];
    }
    await req.auditLog('user.update', { type: 'user', id }, { before: beforeDiff, after: afterDiff });

    return adminUserRowSchema.parse({
      id: after.id,
      email: after.email,
      firstName: after.firstName,
      lastName: after.lastName,
      country: after.country,
      role: after.role,
      status: after.status,
      createdAt: after.createdAt.toISOString(),
      lastSeenAt: after.lastSeenAt?.toISOString() ?? null,
    });
  });
}
```

- [ ] **Step 4: Wire** — append in `api/src/routes/admin/index.ts`:

```ts
import { adminUsersPatchRoute } from './users/patch.js';
// ...
await app.register(adminUsersPatchRoute, { prefix: '/users' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-patch.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/users/patch.ts api/src/routes/admin/index.ts api/tests/integration/admin/users-patch.test.ts
git commit -m "feat(api): PATCH /v1/admin/users/:id with audit diff"
```

---

### Task B5: POST /v1/admin/users/:id/sessions/revoke-all

**Files:**
- Create: `api/src/routes/admin/users/revoke-sessions.ts`
- Create: `api/tests/integration/admin/users-revoke.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/users-revoke.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('POST /v1/admin/users/:id/sessions/revoke-all', () => {
  it('sets revoked_at on every active session and writes audit row', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const u = await makeUser();
    const prisma = getPrisma();
    await prisma.session.createMany({
      data: [
        { userId: u.id, refreshTokenHash: 'h1', expiresAt: new Date(Date.now() + 86400_000) },
        { userId: u.id, refreshTokenHash: 'h2', expiresAt: new Date(Date.now() + 86400_000) },
      ],
    });

    const res = await app.inject({ method: 'POST', url: `/v1/admin/users/${u.id}/sessions/revoke-all`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().revoked).toBe(2);

    const active = await prisma.session.count({ where: { userId: u.id, revokedAt: null } });
    expect(active).toBe(0);

    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'user.sessions.revoke_all', targetId: u.id } });
    expect(log).toBeTruthy();
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-revoke.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/users/revoke-sessions.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../../../db.js';
import { revokeAllSessions } from '../../../services/auth/sessions.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersRevokeSessionsRoute(app: FastifyInstance) {
  app.post('/:id/sessions/revoke-all', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const beforeActive = await getPrisma().session.count({ where: { userId: id, revokedAt: null } });
    await revokeAllSessions(id);
    await req.auditLog('user.sessions.revoke_all', { type: 'user', id }, { before: { activeSessions: beforeActive }, after: { activeSessions: 0 } });
    return { revoked: beforeActive };
  });
}
```

- [ ] **Step 4: Wire** — add in `api/src/routes/admin/index.ts`:

```ts
import { adminUsersRevokeSessionsRoute } from './users/revoke-sessions.js';
// ...
await app.register(adminUsersRevokeSessionsRoute, { prefix: '/users' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-revoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/users/revoke-sessions.ts api/src/routes/admin/index.ts api/tests/integration/admin/users-revoke.test.ts
git commit -m "feat(api): POST /v1/admin/users/:id/sessions/revoke-all"
```

---

### Task B6: POST /v1/admin/users/:id/impersonate

**Files:**
- Create: `api/src/routes/admin/users/impersonate.ts`
- Create: `api/tests/integration/admin/users-impersonate.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/users-impersonate.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('POST /v1/admin/users/:id/impersonate', () => {
  it('returns a short-lived access token for the target user', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const u = await makeUser();

    const res = await app.inject({ method: 'POST', url: `/v1/admin/users/${u.id}/impersonate`, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.expiresIn).toBe(15 * 60);

    // The token should authorize as the target user
    const me = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${body.accessToken}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().id).toBe(u.id);

    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'user.impersonate', targetId: u.id } });
    expect(log).toBeTruthy();
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-impersonate.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/users/impersonate.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminUserImpersonateResponseSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { issueAccessToken } from '../../../services/auth/tokens.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const TTL_SECONDS = 15 * 60;

export async function adminUsersImpersonateRoute(app: FastifyInstance) {
  app.post('/:id/impersonate', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const target = await getPrisma().user.findUnique({ where: { id } });
    if (!target) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });

    const accessToken = await issueAccessToken({ sub: target.id, role: target.role }, { expiresIn: TTL_SECONDS });
    await req.auditLog('user.impersonate', { type: 'user', id }, { before: null, after: { ttlSeconds: TTL_SECONDS } });

    return adminUserImpersonateResponseSchema.parse({ accessToken, expiresIn: TTL_SECONDS });
  });
}
```

> **Note:** `issueAccessToken` from M0a accepts an optional `{ expiresIn }` override. If not present, extend the M0a function inline here (TDD already covers behavior).

- [ ] **Step 4: Wire** — add in `api/src/routes/admin/index.ts`:

```ts
import { adminUsersImpersonateRoute } from './users/impersonate.js';
// ...
await app.register(adminUsersImpersonateRoute, { prefix: '/users' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/users-impersonate.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/users/impersonate.ts api/src/routes/admin/index.ts api/tests/integration/admin/users-impersonate.test.ts
git commit -m "feat(api): POST /v1/admin/users/:id/impersonate (15min token)"
```

---

## Phase C — Admin products endpoints + merge tool

### Task C1: Shared Zod schemas for admin products

**Files:**
- Create: `packages/shared/src/schemas/admin/products.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin/products.ts`**

```ts
import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const productStatusSchema = z.enum(['active', 'pending', 'merged_into']);
export const productSourceSchema = z.enum(['off', 'upcitemdb', 'user']);

export const adminProductRowSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string().nullable(),
  qrPayload: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  imageUrl: z.string().nullable(),
  source: productSourceSchema,
  status: productStatusSchema,
  isCommunityEligible: z.boolean(),
  buyAgainCount: z.number().int(),
  buyAgainOnSaleCount: z.number().int(),
  wontBuyCount: z.number().int(),
  ratingCount: z.number().int(),
  reviewCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const adminProductsQuerySchema = cursorQuerySchema.extend({
  status: productStatusSchema.optional(),
  source: productSourceSchema.optional(),
  q: z.string().trim().min(1).optional(),
});

export const adminProductsListSchema = cursorPageSchema(adminProductRowSchema);

export const adminProductPatchSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  defaultShelfLifeDays: z.number().int().min(0).nullable().optional(),
  status: productStatusSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'no fields to update' });

export const adminProductMergeSchema = z.object({
  winnerId: z.string().uuid(),
  loserIds: z.array(z.string().uuid()).min(1),
}).refine((d) => !d.loserIds.includes(d.winnerId), { message: 'winner cannot also be a loser' });

export const adminProductMergeResponseSchema = z.object({
  winnerId: z.string().uuid(),
  movedRecords: z.number().int(),
  movedReviews: z.number().int(),
  newReviewCount: z.number().int(),
  newRatingCount: z.number().int(),
  newBuyAgainCount: z.number().int(),
  newBuyAgainOnSaleCount: z.number().int(),
  newWontBuyCount: z.number().int(),
});

export const adminProductEditRowSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  submittedBy: z.string().uuid(),
  proposed: z.record(z.unknown()),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string().datetime(),
});

export const adminProductEditsListSchema = cursorPageSchema(adminProductEditRowSchema);

export const adminProductEditResolveSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

export type AdminProductPatch = z.infer<typeof adminProductPatchSchema>;
export type AdminProductMerge = z.infer<typeof adminProductMergeSchema>;
```

- [ ] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/admin/products.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @expyrico/shared typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): admin products zod schemas"
```

---

### Task C2: GET /v1/admin/products (list)

**Files:**
- Create: `api/src/routes/admin/products/list.ts`
- Create: `api/tests/integration/admin/products-list.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/products-list.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin } from '../../helpers/admin.js';

describe('GET /v1/admin/products', () => {
  it('lists products with filters and denorm counts', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await getPrisma().product.createMany({
      data: [
        { name: 'Milk', source: 'off', status: 'active', barcode: 'B1' },
        { name: 'Bread', source: 'user', status: 'pending', barcode: 'B2' },
      ],
    });

    const res = await app.inject({ method: 'GET', url: '/v1/admin/products?status=pending', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.every((p: { status: string }) => p.status === 'pending')).toBe(true);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-list.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/products/list.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  adminProductsQuerySchema,
  adminProductsListSchema,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminProductsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminProductsQuerySchema.parse(req.query);
    const where: Prisma.ProductWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.source) where.source = q.source;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { brand: { contains: q.q, mode: 'insensitive' } },
        { barcode: { equals: q.q } },
      ];
    }
    const cur = decodeCursor(q.cursor);
    if (cur) {
      where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];
    }

    const rows = await getPrisma().product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((p) => ({
      id: p.id,
      barcode: p.barcode,
      qrPayload: p.qrPayload,
      name: p.name,
      brand: p.brand,
      category: p.category,
      imageUrl: p.imageUrl,
      source: p.source,
      status: p.status,
      isCommunityEligible: p.isCommunityEligible,
      buyAgainCount: p.buyAgainCount,
      buyAgainOnSaleCount: p.buyAgainOnSaleCount,
      wontBuyCount: p.wontBuyCount,
      ratingCount: p.ratingCount,
      reviewCount: p.reviewCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
    const last = items.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null;
    return adminProductsListSchema.parse({ items, nextCursor });
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminProductsListRoute } from './products/list.js';
// ...
await app.register(adminProductsListRoute, { prefix: '/products' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-list.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/products/list.ts api/src/routes/admin/index.ts api/tests/integration/admin/products-list.test.ts
git commit -m "feat(api): GET /v1/admin/products with filters"
```

---

### Task C3: PATCH /v1/admin/products/:id (audit-logged)

**Files:**
- Create: `api/src/routes/admin/products/patch.ts`
- Create: `api/tests/integration/admin/products-patch.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/products-patch.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin } from '../../helpers/admin.js';

describe('PATCH /v1/admin/products/:id', () => {
  it('edits a product and audit-logs the diff', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Old', source: 'user', status: 'active' } });

    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/products/${p.id}`, headers, payload: { name: 'New', brand: 'Acme' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('New');

    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, targetType: 'product', targetId: p.id } });
    expect(log.action).toBe('product.update');
    expect(log.diff).toMatchObject({ before: { name: 'Old', brand: null }, after: { name: 'New', brand: 'Acme' } });
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-patch.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/products/patch.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductPatchSchema, adminProductRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsPatchRoute(app: FastifyInstance) {
  app.patch('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductPatchSchema.parse(req.body);
    const prisma = getPrisma();

    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });

    const after = await prisma.product.update({ where: { id }, data: input });

    const beforeDiff: Record<string, unknown> = {};
    const afterDiff: Record<string, unknown> = {};
    for (const k of Object.keys(input) as (keyof typeof input)[]) {
      beforeDiff[k] = (before as Record<string, unknown>)[k];
      afterDiff[k] = (after as Record<string, unknown>)[k];
    }
    await req.auditLog('product.update', { type: 'product', id }, { before: beforeDiff, after: afterDiff });

    return adminProductRowSchema.parse({
      id: after.id,
      barcode: after.barcode,
      qrPayload: after.qrPayload,
      name: after.name,
      brand: after.brand,
      category: after.category,
      imageUrl: after.imageUrl,
      source: after.source,
      status: after.status,
      isCommunityEligible: after.isCommunityEligible,
      buyAgainCount: after.buyAgainCount,
      buyAgainOnSaleCount: after.buyAgainOnSaleCount,
      wontBuyCount: after.wontBuyCount,
      ratingCount: after.ratingCount,
      reviewCount: after.reviewCount,
      createdAt: after.createdAt.toISOString(),
      updatedAt: after.updatedAt.toISOString(),
    });
  });
}
```

- [ ] **Step 4: Wire** in `api/src/routes/admin/index.ts`:

```ts
import { adminProductsPatchRoute } from './products/patch.js';
// ...
await app.register(adminProductsPatchRoute, { prefix: '/products' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-patch.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/products/patch.ts api/src/routes/admin/index.ts api/tests/integration/admin/products-patch.test.ts
git commit -m "feat(api): PATCH /v1/admin/products/:id"
```

---

### Task C3a: GET /v1/admin/products/:id (by-id fetch for detail page)

The `/products/[id]` admin page must fetch a single product by its primary key. Searching the list with `q` does not work because `q` matches name/brand/barcode, never the id — so a valid product can render as "not found". This task adds a true by-id read. It is a GET, so it is **not** audit-logged.

**Files:**
- Create: `api/src/routes/admin/products/get.ts`
- Create: `api/tests/integration/admin/products-get.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/products-get.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin } from '../../helpers/admin.js';

describe('GET /v1/admin/products/:id', () => {
  it('returns the product when it exists', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const p = await getPrisma().product.create({ data: { name: 'Milk', source: 'off', status: 'active' } });

    const res = await app.inject({ method: 'GET', url: `/v1/admin/products/${p.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(p.id);
    expect(res.json().name).toBe('Milk');
    await app.close();
  });

  it('returns 404 for a missing product', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/products/00000000-0000-0000-0000-000000000000', headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-get.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/products/get.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const p = await getPrisma().product.findUnique({ where: { id } });
    if (!p) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });

    return adminProductRowSchema.parse({
      id: p.id,
      barcode: p.barcode,
      qrPayload: p.qrPayload,
      name: p.name,
      brand: p.brand,
      category: p.category,
      imageUrl: p.imageUrl,
      source: p.source,
      status: p.status,
      isCommunityEligible: p.isCommunityEligible,
      buyAgainCount: p.buyAgainCount,
      buyAgainOnSaleCount: p.buyAgainOnSaleCount,
      wontBuyCount: p.wontBuyCount,
      ratingCount: p.ratingCount,
      reviewCount: p.reviewCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    });
  });
}
```

- [ ] **Step 4: Wire** in `api/src/routes/admin/index.ts` (register before the PATCH route so the `:id` GET is mounted under `/products`):

```ts
import { adminProductsGetRoute } from './products/get.js';
// ...
await app.register(adminProductsGetRoute, { prefix: '/products' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-get.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/products/get.ts api/src/routes/admin/index.ts api/tests/integration/admin/products-get.test.ts
git commit -m "feat(api): GET /v1/admin/products/:id by-id fetch"
```

---

### Task C4: Product merge service (transaction) — unit test for invariants

**Files:**
- Create: `api/src/services/admin/merge.ts`
- Create: `api/tests/integration/admin/products-merge.test.ts`

- [ ] **Step 1: Write the failing test (drives both service and route)**

```ts
// api/tests/integration/admin/products-merge.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('POST /v1/admin/products/:id/merge', () => {
  it('repoints records + reviews, recomputes winner denorms, marks losers merged_into', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const u = await makeUser();

    const winner = await prisma.product.create({ data: { name: 'Winner', source: 'off', status: 'active' } });
    const loser1 = await prisma.product.create({ data: { name: 'Loser 1', source: 'off', status: 'active' } });
    const loser2 = await prisma.product.create({ data: { name: 'Loser 2', source: 'user', status: 'active' } });

    await prisma.record.createMany({
      data: [
        { userId: u.id, productId: loser1.id, expiryDate: new Date('2026-12-01'), clientId: '11111111-1111-1111-1111-111111111111' },
        { userId: u.id, productId: loser2.id, expiryDate: new Date('2026-12-02'), clientId: '22222222-2222-2222-2222-222222222222' },
      ],
    });
    await prisma.review.createMany({
      data: [
        { userId: u.id, productId: loser1.id, rating: 'buy_again', body: 'great', status: 'visible' },
        // Cannot also review loser2 as same user — uniqueness (user,product) would still hold post-merge,
        // but spec says one rating per (user, product). Different user reviews loser2:
      ],
    });
    const u2 = await makeUser();
    await prisma.review.create({ data: { userId: u2.id, productId: loser2.id, rating: 'wont_buy', status: 'visible' } });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${winner.id}/merge`,
      headers,
      payload: { winnerId: winner.id, loserIds: [loser1.id, loser2.id] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.winnerId).toBe(winner.id);
    expect(body.movedRecords).toBe(2);
    expect(body.movedReviews).toBe(2);
    expect(body.newRatingCount).toBe(2);
    expect(body.newBuyAgainCount).toBe(1);
    expect(body.newWontBuyCount).toBe(1);
    expect(body.newReviewCount).toBe(1); // only the buy_again rating had a comment

    expect(await prisma.record.count({ where: { productId: winner.id } })).toBe(2);
    expect(await prisma.review.count({ where: { productId: winner.id } })).toBe(2);
    expect(await prisma.record.count({ where: { productId: loser1.id } })).toBe(0);

    const l1 = await prisma.product.findUniqueOrThrow({ where: { id: loser1.id } });
    expect(l1.status).toBe('merged_into');
    expect(l1.mergedIntoProductId).toBe(winner.id);

    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'product.merge', targetId: winner.id } });
    expect(log.diff).toMatchObject({ after: { loserIds: [loser1.id, loser2.id] } });
    await app.close();
  });

  it('rejects merging a product into itself', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const winner = await getPrisma().product.create({ data: { name: 'Self', source: 'off', status: 'active' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${winner.id}/merge`,
      headers,
      payload: { winnerId: winner.id, loserIds: [winner.id] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('preserves vote counts on moved reviews', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const u = await makeUser();
    const winner = await prisma.product.create({ data: { name: 'W', source: 'off', status: 'active' } });
    const loser = await prisma.product.create({ data: { name: 'L', source: 'off', status: 'active' } });
    const r = await prisma.review.create({ data: { userId: u.id, productId: loser.id, rating: 'buy_again', body: 'good', status: 'visible', helpfulCount: 3, notHelpfulCount: 1 } });

    await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${winner.id}/merge`,
      headers,
      payload: { winnerId: winner.id, loserIds: [loser.id] },
    });
    const moved = await prisma.review.findUniqueOrThrow({ where: { id: r.id } });
    expect(moved.productId).toBe(winner.id);
    expect(moved.helpfulCount).toBe(3);
    expect(moved.notHelpfulCount).toBe(1);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-merge.test.ts
```

- [ ] **Step 3: Write `api/src/services/admin/merge.ts`**

```ts
import { getPrisma } from '../../db.js';

export type MergeResult = {
  winnerId: string;
  movedRecords: number;
  movedReviews: number;
  newReviewCount: number;
  newRatingCount: number;
  newBuyAgainCount: number;
  newBuyAgainOnSaleCount: number;
  newWontBuyCount: number;
};

export async function mergeProducts(winnerId: string, loserIds: string[]): Promise<MergeResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    // Repoint records
    const movedRecords = await tx.record.updateMany({
      where: { productId: { in: loserIds } },
      data: { productId: winnerId },
    });

    // Repoint reviews. Reviews enforce unique (userId, productId); on collision we keep the
    // existing winner-side review (delete the loser-side review to free the constraint).
    const loserReviews = await tx.review.findMany({ where: { productId: { in: loserIds } } });
    const winnerReviewerIds = new Set(
      (await tx.review.findMany({ where: { productId: winnerId }, select: { userId: true } })).map((r) => r.userId),
    );
    const toDelete = loserReviews.filter((r) => winnerReviewerIds.has(r.userId)).map((r) => r.id);
    if (toDelete.length) await tx.review.deleteMany({ where: { id: { in: toDelete } } });
    const movedReviews = await tx.review.updateMany({
      where: { productId: { in: loserIds }, id: { notIn: toDelete.length ? toDelete : ['00000000-0000-0000-0000-000000000000'] } },
      data: { productId: winnerId },
    });

    // Recompute winner denorms (three-option tallies + review_count).
    const byRating = await tx.review.groupBy({
      by: ['rating'],
      where: { productId: winnerId, status: 'visible' },
      _count: { _all: true },
    });
    const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 };
    for (const row of byRating) tally[row.rating] = row._count._all;
    const newBuyAgainCount = tally.buy_again;
    const newBuyAgainOnSaleCount = tally.buy_again_on_sale;
    const newWontBuyCount = tally.wont_buy;
    const newRatingCount = newBuyAgainCount + newBuyAgainOnSaleCount + newWontBuyCount;
    const newReviewCount = await tx.review.count({
      where: { productId: winnerId, status: 'visible', body: { not: null } },
    });

    await tx.product.update({
      where: { id: winnerId },
      data: {
        reviewCount: newReviewCount,
        ratingCount: newRatingCount,
        buyAgainCount: newBuyAgainCount,
        buyAgainOnSaleCount: newBuyAgainOnSaleCount,
        wontBuyCount: newWontBuyCount,
      },
    });

    await tx.product.updateMany({
      where: { id: { in: loserIds } },
      data: { status: 'merged_into', mergedIntoProductId: winnerId },
    });

    return {
      winnerId,
      movedRecords: movedRecords.count,
      movedReviews: movedReviews.count,
      newReviewCount,
      newRatingCount,
      newBuyAgainCount,
      newBuyAgainOnSaleCount,
      newWontBuyCount,
    };
  });
}
```

- [ ] **Step 4: Write `api/src/routes/admin/products/merge.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductMergeSchema, adminProductMergeResponseSchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../../errors.js';
import { mergeProducts } from '../../../services/admin/merge.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsMergeRoute(app: FastifyInstance) {
  app.post('/:id/merge', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductMergeSchema.parse(req.body);
    if (input.winnerId !== id) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION_ERROR, title: 'winnerId must match :id' });
    }
    const result = await mergeProducts(input.winnerId, input.loserIds);
    await req.auditLog('product.merge', { type: 'product', id }, { before: null, after: { loserIds: input.loserIds, movedRecords: result.movedRecords, movedReviews: result.movedReviews } });
    return adminProductMergeResponseSchema.parse(result);
  });
}
```

- [ ] **Step 5: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminProductsMergeRoute } from './products/merge.js';
// ...
await app.register(adminProductsMergeRoute, { prefix: '/products' });
```

- [ ] **Step 6: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-merge.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add api/src/services/admin/merge.ts api/src/routes/admin/products/merge.ts api/src/routes/admin/index.ts api/tests/integration/admin/products-merge.test.ts
git commit -m "feat(api): POST /v1/admin/products/:id/merge (transactional)"
```

---

### Task C5: GET /v1/admin/products/pending + resolve edits

**Files:**
- Create: `api/src/routes/admin/products/pending.ts`
- Create: `api/src/routes/admin/products/pending-resolve.ts`
- Create: `api/tests/integration/admin/products-pending.test.ts`
- Modify: `api/src/routes/admin/index.ts`

> **Cross-milestone note:** M1 ships the `product_edits` table. The Prisma model name is `ProductEdit` with columns `id`, `productId`, `submittedBy`, `proposed (Json)`, `status ('pending'|'approved'|'rejected')`, `createdAt`, `resolvedBy`, `resolvedAt`, `notes`. M3 consumes this shape directly — no fallback migration needed.

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/products-pending.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('admin pending product edits', () => {
  it('lists pending edits', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const u = await makeUser();
    await prisma.productEdit.create({ data: { productId: p.id, submittedBy: u.id, proposed: { name: 'Better' }, status: 'pending' } });

    const res = await app.inject({ method: 'GET', url: '/v1/admin/products/pending', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    await app.close();
  });

  it('approves a pending edit, applies it to the product, audit-logs', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'Before', source: 'off', status: 'active' } });
    const u = await makeUser();
    const edit = await prisma.productEdit.create({ data: { productId: p.id, submittedBy: u.id, proposed: { name: 'After' }, status: 'pending' } });

    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/products/pending/${edit.id}`, headers, payload: { decision: 'approve' } });
    expect(res.statusCode).toBe(200);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.name).toBe('After');
    const resolved = await prisma.productEdit.findUniqueOrThrow({ where: { id: edit.id } });
    expect(resolved.status).toBe('approved');

    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'product_edit.resolve', targetId: edit.id } });
    expect(log.diff).toMatchObject({ after: { decision: 'approve' } });
    await app.close();
  });

  it('rejects a pending edit without applying it', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'Keep', source: 'off', status: 'active' } });
    const u = await makeUser();
    const edit = await prisma.productEdit.create({ data: { productId: p.id, submittedBy: u.id, proposed: { name: 'NotApplied' }, status: 'pending' } });

    await app.inject({ method: 'PATCH', url: `/v1/admin/products/pending/${edit.id}`, headers, payload: { decision: 'reject', notes: 'spam' } });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.name).toBe('Keep');
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-pending.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/products/pending.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import {
  cursorQuerySchema,
  adminProductEditsListSchema,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminProductsPendingListRoute(app: FastifyInstance) {
  app.get('/pending', async (req) => {
    const q = cursorQuerySchema.parse(req.query);
    const cur = decodeCursor(q.cursor);
    const rows = await getPrisma().productEdit.findMany({
      where: {
        status: 'pending',
        ...(cur ? { OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((e) => ({
      id: e.id,
      productId: e.productId,
      submittedBy: e.submittedBy,
      proposed: e.proposed as Record<string, unknown>,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    }));
    const last = items.at(-1);
    return adminProductEditsListSchema.parse({
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
```

- [ ] **Step 4: Write `api/src/routes/admin/products/pending-resolve.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductEditResolveSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsPendingResolveRoute(app: FastifyInstance) {
  app.patch('/pending/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductEditResolveSchema.parse(req.body);
    const prisma = getPrisma();

    const edit = await prisma.productEdit.findUnique({ where: { id } });
    if (!edit) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Edit not found' });
    if (edit.status !== 'pending') throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already resolved' });

    await prisma.$transaction(async (tx) => {
      if (input.decision === 'approve') {
        await tx.product.update({ where: { id: edit.productId }, data: edit.proposed as Record<string, unknown> });
      }
      await tx.productEdit.update({
        where: { id: edit.id },
        data: {
          status: input.decision === 'approve' ? 'approved' : 'rejected',
          resolvedBy: req.user!.id,
          resolvedAt: new Date(),
          notes: input.notes ?? null,
        },
      });
    });

    await req.auditLog('product_edit.resolve', { type: 'product_edit', id }, {
      before: { status: 'pending' },
      after: { decision: input.decision, notes: input.notes ?? null },
    });

    return { ok: true };
  });
}
```

- [ ] **Step 5: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminProductsPendingListRoute } from './products/pending.js';
import { adminProductsPendingResolveRoute } from './products/pending-resolve.js';
// ...
await app.register(adminProductsPendingListRoute, { prefix: '/products' });
await app.register(adminProductsPendingResolveRoute, { prefix: '/products' });
```

- [ ] **Step 6: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/products-pending.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add api/src/routes/admin/products api/src/routes/admin/index.ts api/tests/integration/admin/products-pending.test.ts
git commit -m "feat(api): admin pending product edits list + resolve"
```

---

## Phase D — Admin reviews + reports endpoints

### Task D1: Shared Zod schemas for admin reviews + reports

**Files:**
- Create: `packages/shared/src/schemas/admin/reviews.ts`
- Create: `packages/shared/src/schemas/admin/reports.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin/reviews.ts`**

```ts
import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const reviewStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export const reviewRatingSchema = z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy']);

export const adminReviewRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  rating: reviewRatingSchema,
  comment: z.string().nullable(),
  helpfulCount: z.number().int(),
  notHelpfulCount: z.number().int(),
  status: reviewStatusSchema,
  createdAt: z.string().datetime(),
});

export const adminReviewsQuerySchema = cursorQuerySchema.extend({
  status: reviewStatusSchema.optional(),
  rating: reviewRatingSchema.optional(),
  productId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const adminReviewsListSchema = cursorPageSchema(adminReviewRowSchema);

export const adminReviewStatusPatchSchema = z.object({
  status: reviewStatusSchema,
});
```

- [ ] **Step 2: Write `packages/shared/src/schemas/admin/reports.ts`**

```ts
import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const reportTargetSchema = z.enum(['review', 'user', 'product']);
export const reportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export const reportReasonSchema = z.enum(['spam', 'abuse', 'incorrect', 'other']);

export const adminReportRowSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  targetType: reportTargetSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  body: z.string().nullable(),
  status: reportStatusSchema,
  createdAt: z.string().datetime(),
  targetPreview: z.record(z.unknown()).nullable(),
});

export const adminReportsQuerySchema = cursorQuerySchema.extend({
  status: reportStatusSchema.optional(),
  targetType: reportTargetSchema.optional(),
});

export const adminReportsListSchema = cursorPageSchema(adminReportRowSchema);

export const adminReportResolveSchema = z.object({
  action: z.enum(['hide', 'delete', 'dismiss', 'ban']),
  notes: z.string().optional(),
});
```

- [ ] **Step 3: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/admin/reviews.js';
export * from './schemas/admin/reports.js';
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @expyrico/shared typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): admin reviews + reports zod schemas"
```

---

### Task D2: GET /v1/admin/reviews (list)

**Files:**
- Create: `api/src/routes/admin/reviews/list.ts`
- Create: `api/tests/integration/admin/reviews-list.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/reviews-list.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('GET /v1/admin/reviews', () => {
  it('filters by status, taste/value rating, productId, userId', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'X', source: 'off', status: 'active' } });
    const u = await makeUser();
    await prisma.review.createMany({
      data: [
        { userId: u.id, productId: p.id, rating: 'buy_again', status: 'visible' },
      ],
    });
    const u2 = await makeUser();
    await prisma.review.create({ data: { userId: u2.id, productId: p.id, rating: 'wont_buy', status: 'hidden' } });

    const res = await app.inject({ method: 'GET', url: `/v1/admin/reviews?status=hidden`, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.every((r: { status: string }) => r.status === 'hidden')).toBe(true);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reviews-list.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/reviews/list.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  adminReviewsQuerySchema,
  adminReviewsListSchema,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminReviewsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminReviewsQuerySchema.parse(req.query);
    const where: Prisma.ReviewWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.rating) where.rating = q.rating;
    if (q.productId) where.productId = q.productId;
    if (q.userId) where.userId = q.userId;
    const cur = decodeCursor(q.cursor);
    if (cur) where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];

    const rows = await getPrisma().review.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r) => ({
      id: r.id,
      userId: r.userId,
      productId: r.productId,
      rating: r.rating,
      comment: r.body,
      helpfulCount: r.helpfulCount,
      notHelpfulCount: r.notHelpfulCount,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
    const last = items.at(-1);
    return adminReviewsListSchema.parse({
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminReviewsListRoute } from './reviews/list.js';
// ...
await app.register(adminReviewsListRoute, { prefix: '/reviews' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reviews-list.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/reviews/list.ts api/src/routes/admin/index.ts api/tests/integration/admin/reviews-list.test.ts
git commit -m "feat(api): GET /v1/admin/reviews"
```

---

### Task D2a: GET /v1/admin/reviews/:id (by-id fetch for detail page)

The `/reviews/[id]` admin page must fetch a single review by its primary key. The earlier draft read an unfiltered first page of the list and searched it client-side, so any review past page 1 was unreachable. This task adds a true by-id read. It is a GET, so it is **not** audit-logged. The detail row shape matches `adminReviewRowSchema` used by the list.

**Files:**
- Create: `api/src/routes/admin/reviews/get.ts`
- Create: `api/tests/integration/admin/reviews-get.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/reviews-get.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('GET /v1/admin/reviews/:id', () => {
  it('returns the review when it exists', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const u = await makeUser();
    const r = await prisma.review.create({ data: { userId: u.id, productId: p.id, rating: 'buy_again', status: 'visible' } });

    const res = await app.inject({ method: 'GET', url: `/v1/admin/reviews/${r.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(r.id);
    expect(res.json().rating).toBe('buy_again');
    await app.close();
  });

  it('returns 404 for a missing review', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/reviews/00000000-0000-0000-0000-000000000000', headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reviews-get.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/reviews/get.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminReviewRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminReviewsGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const r = await getPrisma().review.findUnique({ where: { id } });
    if (!r) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Review not found' });

    return adminReviewRowSchema.parse({
      id: r.id,
      userId: r.userId,
      productId: r.productId,
      rating: r.rating,
      comment: r.body,
      helpfulCount: r.helpfulCount,
      notHelpfulCount: r.notHelpfulCount,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    });
  });
}
```

> The `adminReviewRowSchema` is the per-item schema wrapped by `adminReviewsListSchema` in Task D1's shared schemas. If D1 only exported the list wrapper, also export the row schema (`adminReviewRowSchema`) so both the list and this by-id route share one source of truth.

- [ ] **Step 4: Wire** in `api/src/routes/admin/index.ts` (register before the status route so `:id` GET is mounted under `/reviews`):

```ts
import { adminReviewsGetRoute } from './reviews/get.js';
// ...
await app.register(adminReviewsGetRoute, { prefix: '/reviews' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reviews-get.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/reviews/get.ts api/src/routes/admin/index.ts api/tests/integration/admin/reviews-get.test.ts
git commit -m "feat(api): GET /v1/admin/reviews/:id by-id fetch"
```

---

### Task D3: PATCH /v1/admin/reviews/:id/status

**Files:**
- Create: `api/src/routes/admin/reviews/status.ts`
- Create: `api/tests/integration/admin/reviews-status.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/reviews-status.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('PATCH /v1/admin/reviews/:id/status', () => {
  it('hides a visible review and audit-logs', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const u = await makeUser();
    const r = await prisma.review.create({ data: { userId: u.id, productId: p.id, rating: 'buy_again', status: 'visible' } });

    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/reviews/${r.id}/status`, headers, payload: { status: 'hidden' } });
    expect(res.statusCode).toBe(200);
    const updated = await prisma.review.findUniqueOrThrow({ where: { id: r.id } });
    expect(updated.status).toBe('hidden');
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'review.status', targetId: r.id } });
    expect(log.diff).toMatchObject({ before: { status: 'visible' }, after: { status: 'hidden' } });
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reviews-status.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/reviews/status.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminReviewStatusPatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminReviewsStatusRoute(app: FastifyInstance) {
  app.patch('/:id/status', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const { status } = adminReviewStatusPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.review.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Review not found' });
    await prisma.review.update({ where: { id }, data: { status } });
    await req.auditLog('review.status', { type: 'review', id }, { before: { status: before.status }, after: { status } });
    return { ok: true };
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminReviewsStatusRoute } from './reviews/status.js';
// ...
await app.register(adminReviewsStatusRoute, { prefix: '/reviews' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reviews-status.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/reviews/status.ts api/src/routes/admin/index.ts api/tests/integration/admin/reviews-status.test.ts
git commit -m "feat(api): PATCH /v1/admin/reviews/:id/status"
```

---

### Task D4: GET /v1/admin/reports (with target preview)

**Files:**
- Create: `api/src/routes/admin/reports/list.ts`
- Create: `api/tests/integration/admin/reports-list.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/reports-list.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('GET /v1/admin/reports', () => {
  it('lists open reports with target preview joined', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    const reporter = await makeUser();
    const offender = await makeUser({ email: 'bad@example.com' });
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const review = await prisma.review.create({ data: { userId: offender.id, productId: p.id, rating: 'wont_buy', body: 'rude', status: 'visible' } });
    await prisma.report.create({ data: { reporterId: reporter.id, targetType: 'review', targetId: review.id, reason: 'abuse', status: 'open' } });

    const res = await app.inject({ method: 'GET', url: '/v1/admin/reports?status=open', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].targetPreview).toMatchObject({ kind: 'review', body: 'rude' });
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reports-list.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/reports/list.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  adminReportsQuerySchema,
  adminReportsListSchema,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

async function buildPreview(prisma: ReturnType<typeof getPrisma>, targetType: string, targetId: string): Promise<Record<string, unknown> | null> {
  if (targetType === 'review') {
    const r = await prisma.review.findUnique({ where: { id: targetId }, select: { body: true, rating: true, status: true } });
    return r ? { kind: 'review', comment: r.body, rating: r.rating, status: r.status } : null;
  }
  if (targetType === 'user') {
    const u = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true, status: true } });
    return u ? { kind: 'user', email: u.email, status: u.status } : null;
  }
  if (targetType === 'product') {
    const p = await prisma.product.findUnique({ where: { id: targetId }, select: { name: true, brand: true, status: true } });
    return p ? { kind: 'product', name: p.name, brand: p.brand, status: p.status } : null;
  }
  return null;
}

export async function adminReportsListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminReportsQuerySchema.parse(req.query);
    const where: Prisma.ReportWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.targetType) where.targetType = q.targetType;
    const cur = decodeCursor(q.cursor);
    if (cur) where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];

    const prisma = getPrisma();
    const rows = await prisma.report.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const sliced = hasMore ? rows.slice(0, -1) : rows;

    const items = await Promise.all(sliced.map(async (r) => ({
      id: r.id,
      reporterId: r.reporterId,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      targetPreview: await buildPreview(prisma, r.targetType, r.targetId),
    })));
    const last = items.at(-1);
    return adminReportsListSchema.parse({
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminReportsListRoute } from './reports/list.js';
// ...
await app.register(adminReportsListRoute, { prefix: '/reports' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reports-list.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/reports/list.ts api/src/routes/admin/index.ts api/tests/integration/admin/reports-list.test.ts
git commit -m "feat(api): GET /v1/admin/reports with target preview"
```

---

### Task D5: PATCH /v1/admin/reports/:id/resolve (transactional)

**Files:**
- Create: `api/src/routes/admin/reports/resolve.ts`
- Create: `api/tests/integration/admin/reports-resolve.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/reports-resolve.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('PATCH /v1/admin/reports/:id/resolve', () => {
  async function setup() {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const reporter = await makeUser();
    const offender = await makeUser({ email: `off-${Date.now()}@example.com` });
    const p = await prisma.product.create({ data: { name: 'P', source: 'off', status: 'active' } });
    const review = await prisma.review.create({ data: { userId: offender.id, productId: p.id, rating: 'wont_buy', body: 'rude', status: 'visible' } });
    const report = await prisma.report.create({ data: { reporterId: reporter.id, targetType: 'review', targetId: review.id, reason: 'abuse', status: 'open' } });
    return { app, admin, headers, prisma, offender, review, report };
  }

  it('hide: marks review hidden and report resolved', async () => {
    const { app, headers, prisma, review, report } = await setup();
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/reports/${report.id}/resolve`, headers, payload: { action: 'hide' } });
    expect(res.statusCode).toBe(200);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).status).toBe('hidden');
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('resolved');
    await app.close();
  });

  it('delete: soft-deletes review', async () => {
    const { app, headers, prisma, review, report } = await setup();
    await app.inject({ method: 'PATCH', url: `/v1/admin/reports/${report.id}/resolve`, headers, payload: { action: 'delete' } });
    expect((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).status).toBe('deleted');
    await app.close();
  });

  it('dismiss: marks report dismissed, leaves review alone', async () => {
    const { app, headers, prisma, review, report } = await setup();
    await app.inject({ method: 'PATCH', url: `/v1/admin/reports/${report.id}/resolve`, headers, payload: { action: 'dismiss' } });
    expect((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).status).toBe('visible');
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('dismissed');
    await app.close();
  });

  it('ban: suspends offender, marks report resolved, audit-logs', async () => {
    const { app, admin, headers, prisma, offender, report } = await setup();
    await app.inject({ method: 'PATCH', url: `/v1/admin/reports/${report.id}/resolve`, headers, payload: { action: 'ban', notes: 'repeat offender' } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: offender.id } })).status).toBe('suspended');
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('resolved');
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'report.resolve', targetId: report.id } });
    expect(log.diff).toMatchObject({ after: { action: 'ban', notes: 'repeat offender' } });
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reports-resolve.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/reports/resolve.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminReportResolveSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminReportsResolveRoute(app: FastifyInstance) {
  app.patch('/:id/resolve', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminReportResolveSchema.parse(req.body);
    const prisma = getPrisma();

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Report not found' });
    if (report.status !== 'open') throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already resolved' });

    await prisma.$transaction(async (tx) => {
      if (input.action === 'hide' && report.targetType === 'review') {
        await tx.review.update({ where: { id: report.targetId }, data: { status: 'hidden' } });
      } else if (input.action === 'delete' && report.targetType === 'review') {
        await tx.review.update({ where: { id: report.targetId }, data: { status: 'deleted' } });
      } else if (input.action === 'ban') {
        // Suspend the user who created the offending content.
        let offenderId: string | null = null;
        if (report.targetType === 'user') offenderId = report.targetId;
        if (report.targetType === 'review') {
          const r = await tx.review.findUnique({ where: { id: report.targetId } });
          offenderId = r?.userId ?? null;
        }
        if (report.targetType === 'product') {
          const p = await tx.product.findUnique({ where: { id: report.targetId } });
          offenderId = p?.createdByUserId ?? null;
        }
        if (offenderId) await tx.user.update({ where: { id: offenderId }, data: { status: 'suspended' } });
      }

      await tx.report.update({
        where: { id },
        data: {
          status: input.action === 'dismiss' ? 'dismissed' : 'resolved',
          resolvedByAdminId: req.user!.id,
          resolvedAt: new Date(),
        },
      });
    });

    await req.auditLog('report.resolve', { type: 'report', id }, {
      before: { status: 'open' },
      after: { action: input.action, notes: input.notes ?? null },
    });
    return { ok: true };
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminReportsResolveRoute } from './reports/resolve.js';
// ...
await app.register(adminReportsResolveRoute, { prefix: '/reports' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/reports-resolve.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/reports/resolve.ts api/src/routes/admin/index.ts api/tests/integration/admin/reports-resolve.test.ts
git commit -m "feat(api): PATCH /v1/admin/reports/:id/resolve (hide|delete|dismiss|ban)"
```

---

## Phase E — Analytics endpoints

### Task E1: Shared Zod schemas for analytics

**Files:**
- Create: `packages/shared/src/schemas/admin/analytics.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin/analytics.ts`**

```ts
import { z } from 'zod';

export const analyticsRangeSchema = z.enum(['7d', '30d', '90d']);

export const analyticsOverviewSchema = z.object({
  totalUsers: z.number().int(),
  activeUsers7d: z.number().int(),
  activeUsers30d: z.number().int(),
  totalRecords: z.number().int(),
  totalReviews: z.number().int(),
  scans7d: z.number().int(),
});

export const analyticsDailyPointSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  count: z.number().int(),
});

export const analyticsScansSchema = z.object({
  range: analyticsRangeSchema,
  daily: z.array(analyticsDailyPointSchema),
  bySource: z.object({
    off: z.number().int(),
    upcitemdb: z.number().int(),
    manual: z.number().int(),
  }),
});

export const analyticsReviewsSchema = z.object({
  range: analyticsRangeSchema,
  daily: z.array(analyticsDailyPointSchema),
  autoFlaggedRate: z.number(), // 0.0 - 1.0
  // Three-option rating distribution over reviews created in the window (0 when none).
  buyAgainPct: z.number().min(0).max(100),
  buyAgainOnSalePct: z.number().min(0).max(100),
  wontBuyPct: z.number().min(0).max(100),
  ratingCount: z.number().int().nonnegative(),
});

export const analyticsGeographySchema = z.object({
  top: z.array(z.object({ country: z.string().length(2), users: z.number().int() })),
});
```

- [ ] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/admin/analytics.js';
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @expyrico/shared typecheck
git add packages/shared
git commit -m "feat(shared): admin analytics zod schemas"
```

---

### Task E2: Analytics service (raw SQL)

**Files:**
- Create: `api/src/services/admin/analytics.ts`

- [ ] **Step 1: Write `api/src/services/admin/analytics.ts`**

```ts
import { getPrisma } from '../../db.js';

export async function overview() {
  const prisma = getPrisma();
  const since7 = new Date(Date.now() - 7 * 86400_000);
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const [totalUsers, activeUsers7d, activeUsers30d, totalRecords, totalReviews, scans7d] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastSeenAt: { gte: since7 } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: since30 } } }),
    prisma.record.count(),
    prisma.review.count(),
    // Scans are records created in the last 7 days that came from a scanned product.
    prisma.record.count({ where: { createdAt: { gte: since7 }, productId: { not: null } } }),
  ]);
  return { totalUsers, activeUsers7d, activeUsers30d, totalRecords, totalReviews, scans7d };
}

function daysFromRange(r: '7d' | '30d' | '90d'): number {
  return r === '7d' ? 7 : r === '30d' ? 30 : 90;
}

export async function scansDaily(range: '7d' | '30d' | '90d') {
  const prisma = getPrisma();
  const days = daysFromRange(range);
  const since = new Date(Date.now() - days * 86400_000);

  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', r."createdAt") as day, COUNT(*)::bigint as count
    FROM records r
    WHERE r."createdAt" >= ${since} AND r."productId" IS NOT NULL
    GROUP BY day ORDER BY day ASC
  `;
  const bySource = await prisma.$queryRaw<{ source: string; count: bigint }[]>`
    SELECT p."source" as source, COUNT(*)::bigint as count
    FROM records r
    LEFT JOIN products p ON p.id = r."productId"
    WHERE r."createdAt" >= ${since}
    GROUP BY p."source"
  `;
  const sourceCounts = { off: 0, upcitemdb: 0, manual: 0 };
  for (const row of bySource) {
    if (row.source === 'off') sourceCounts.off = Number(row.count);
    else if (row.source === 'upcitemdb') sourceCounts.upcitemdb = Number(row.count);
    else sourceCounts.manual += Number(row.count); // null source or 'user' counts as manual
  }
  return {
    range,
    daily: rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
    bySource: sourceCounts,
  };
}

export async function reviewsDaily(range: '7d' | '30d' | '90d') {
  const prisma = getPrisma();
  const days = daysFromRange(range);
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
    FROM reviews
    WHERE "createdAt" >= ${since}
    GROUP BY day ORDER BY day ASC
  `;
  // auto-flagged rate = reports where status='open' and reason='abuse' against reviews in window
  const [allInWindow, autoFlagged, byRating] = await Promise.all([
    prisma.review.count({ where: { createdAt: { gte: since } } }),
    prisma.review.count({ where: { createdAt: { gte: since }, status: 'hidden' } }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 };
  for (const row of byRating) tally[row.rating] = row._count._all;
  const ratingCount = tally.buy_again + tally.buy_again_on_sale + tally.wont_buy;
  const pct = (n: number) => (ratingCount === 0 ? 0 : Math.round((n / ratingCount) * 100));
  return {
    range,
    daily: rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
    autoFlaggedRate: allInWindow === 0 ? 0 : autoFlagged / allInWindow,
    buyAgainPct: pct(tally.buy_again),
    buyAgainOnSalePct: pct(tally.buy_again_on_sale),
    wontBuyPct: pct(tally.wont_buy),
    ratingCount,
  };
}

export async function geography(): Promise<{ top: { country: string; users: number }[] }> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<{ country: string | null; count: bigint }[]>`
    SELECT country, COUNT(*)::bigint as count
    FROM users
    WHERE country IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
    LIMIT 20
  `;
  return { top: rows.map((r) => ({ country: r.country!, users: Number(r.count) })) };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add api/src/services/admin/analytics.ts
git commit -m "feat(api): admin analytics aggregation service"
```

---

### Task E3: Analytics routes (4 endpoints in one task — same test file)

**Files:**
- Create: `api/src/routes/admin/analytics/overview.ts`
- Create: `api/src/routes/admin/analytics/scans.ts`
- Create: `api/src/routes/admin/analytics/reviews.ts`
- Create: `api/src/routes/admin/analytics/geography.ts`
- Create: `api/tests/integration/admin/analytics.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/analytics.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin, makeUser } from '../../helpers/admin.js';

describe('admin analytics', () => {
  it('overview returns counts', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await makeUser();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/overview', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalUsers).toBeGreaterThan(0);
    expect(typeof body.scans7d).toBe('number');
    await app.close();
  });

  it('scans returns daily + bySource for the given range', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/scans?range=30d', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().range).toBe('30d');
    expect(Array.isArray(res.json().daily)).toBe(true);
    expect(res.json().bySource).toHaveProperty('off');
    await app.close();
  });

  it('reviews returns daily + autoFlaggedRate + rating distribution', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/reviews?range=7d', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().autoFlaggedRate).toBeGreaterThanOrEqual(0);
    expect(res.json()).toHaveProperty('buyAgainPct');
    expect(res.json()).toHaveProperty('wontBuyPct');
    expect(res.json()).toHaveProperty('ratingCount');
    await app.close();
  });

  it('geography returns top-20 by country', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await makeUser({ country: 'US' });
    await makeUser({ country: 'GB' });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/geography', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().top.length).toBeLessThanOrEqual(20);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/analytics.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/analytics/overview.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { analyticsOverviewSchema } from '@expyrico/shared';
import { overview } from '../../../services/admin/analytics.js';

export async function adminAnalyticsOverviewRoute(app: FastifyInstance) {
  app.get('/overview', async () => analyticsOverviewSchema.parse(await overview()));
}
```

- [ ] **Step 4: Write `api/src/routes/admin/analytics/scans.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyticsRangeSchema, analyticsScansSchema } from '@expyrico/shared';
import { scansDaily } from '../../../services/admin/analytics.js';

const querySchema = z.object({ range: analyticsRangeSchema.default('7d') });

export async function adminAnalyticsScansRoute(app: FastifyInstance) {
  app.get('/scans', async (req) => {
    const { range } = querySchema.parse(req.query);
    return analyticsScansSchema.parse(await scansDaily(range));
  });
}
```

- [ ] **Step 5: Write `api/src/routes/admin/analytics/reviews.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyticsRangeSchema, analyticsReviewsSchema } from '@expyrico/shared';
import { reviewsDaily } from '../../../services/admin/analytics.js';

const querySchema = z.object({ range: analyticsRangeSchema.default('7d') });

export async function adminAnalyticsReviewsRoute(app: FastifyInstance) {
  app.get('/reviews', async (req) => {
    const { range } = querySchema.parse(req.query);
    return analyticsReviewsSchema.parse(await reviewsDaily(range));
  });
}
```

- [ ] **Step 6: Write `api/src/routes/admin/analytics/geography.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { analyticsGeographySchema } from '@expyrico/shared';
import { geography } from '../../../services/admin/analytics.js';

export async function adminAnalyticsGeographyRoute(app: FastifyInstance) {
  app.get('/geography', async () => analyticsGeographySchema.parse(await geography()));
}
```

- [ ] **Step 7: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminAnalyticsOverviewRoute } from './analytics/overview.js';
import { adminAnalyticsScansRoute } from './analytics/scans.js';
import { adminAnalyticsReviewsRoute } from './analytics/reviews.js';
import { adminAnalyticsGeographyRoute } from './analytics/geography.js';
// ...
await app.register(adminAnalyticsOverviewRoute, { prefix: '/analytics' });
await app.register(adminAnalyticsScansRoute, { prefix: '/analytics' });
await app.register(adminAnalyticsReviewsRoute, { prefix: '/analytics' });
await app.register(adminAnalyticsGeographyRoute, { prefix: '/analytics' });
```

- [ ] **Step 8: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/analytics.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add api/src/routes/admin/analytics api/src/routes/admin/index.ts api/tests/integration/admin/analytics.test.ts
git commit -m "feat(api): admin analytics endpoints (overview, scans, reviews, geography)"
```

---

## Phase F — System endpoints + bull-board + api-error recorder

### Task F1: Shared Zod schemas for system

**Files:**
- Create: `packages/shared/src/schemas/admin/system.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin/system.ts`**

```ts
import { z } from 'zod';
import { cursorQuerySchema, cursorPageSchema } from './common.js';

export const queueHealthSchema = z.object({
  queues: z.array(z.object({
    name: z.string(),
    waiting: z.number().int(),
    active: z.number().int(),
    completed: z.number().int(),
    failed: z.number().int(),
    delayed: z.number().int(),
  })),
});

export const pushLogRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateKey: z.string(),
  status: z.enum(['sent', 'failed']),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const pushLogsQuerySchema = cursorQuerySchema.extend({
  userId: z.string().uuid().optional(),
  status: z.enum(['sent', 'failed']).optional(),
});

export const pushLogsListSchema = cursorPageSchema(pushLogRowSchema);

export const apiErrorsQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d']).default('24h'),
});

export const apiErrorsAggSchema = z.object({
  range: z.enum(['24h', '7d', '30d']),
  rows: z.array(z.object({
    route: z.string(),
    method: z.string(),
    status: z.number().int(),
    count: z.number().int(),
  })),
});

export const externalApiStateSchema = z.object({
  breakers: z.array(z.object({
    name: z.string(),
    state: z.enum(['closed', 'open', 'halfOpen']),
    fires: z.number().int(),
    failures: z.number().int(),
    successes: z.number().int(),
    lastFailureAt: z.string().datetime().nullable(),
  })),
});
```

- [ ] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/admin/system.js';
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @expyrico/shared typecheck
git add packages/shared
git commit -m "feat(shared): admin system zod schemas"
```

---

### Task F2: api-error recorder onResponse hook

**Files:**
- Create: `api/src/plugins/api-error-recorder.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write `api/src/plugins/api-error-recorder.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getPrisma } from '../db.js';

export const apiErrorRecorderPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onResponse', async (req, reply) => {
    if (reply.statusCode < 400) return;
    // Best-effort; don't block the response cycle on failure.
    try {
      await getPrisma().apiError.create({
        data: {
          route: req.routeOptions?.url ?? req.url,
          method: req.method,
          status: reply.statusCode,
          code: (req.raw as unknown as { __errCode?: string }).__errCode ?? null,
          message: null,
          requestId: (req.headers['x-request-id'] as string) ?? req.id,
          userId: req.user?.id ?? null,
        },
      });
    } catch (e) {
      req.log.warn({ err: e }, 'api-error-recorder failed');
    }
  });
});
```

- [ ] **Step 2: Register in `api/src/server.ts`**

Find `await app.register(authPlugin);` and add after:
```ts
await app.register(apiErrorRecorderPlugin);
```
And at the top:
```ts
import { apiErrorRecorderPlugin } from './plugins/api-error-recorder.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```

- [ ] **Step 4: Commit**

```bash
git add api/src
git commit -m "feat(api): record 4xx/5xx responses to api_errors table"
```

---

### Task F3: GET /v1/admin/system/queue-health

**Files:**
- Create: `api/src/routes/admin/system/queue-health.ts`
- Create: `api/tests/integration/admin/system.test.ts` (will add to it in F3–F6)
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/system.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { makeAdmin } from '../../helpers/admin.js';

describe('GET /v1/admin/system/queue-health', () => {
  it('returns BullMQ stats for each registered queue', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/queue-health', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.queues)).toBe(true);
    // Names registered in M1/M2:
    const names = body.queues.map((q: { name: string }) => q.name);
    expect(names).toEqual(expect.arrayContaining(['product-lookup', 'notification-schedule', 'notification-send', 'score-recalc', 'moderation-flag', 'product-rating-recalc']));
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/system/queue-health.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { queueHealthSchema } from '@expyrico/shared';
import { getAllQueues } from '../../queues/index.js'; // exposed by M1 (api/src/queues/index.ts)

export async function adminSystemQueueHealthRoute(app: FastifyInstance) {
  app.get('/queue-health', async () => {
    const queues = getAllQueues(); // returns { name: string; queue: Queue }[]
    const stats = await Promise.all(queues.map(async ({ name, queue }) => {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return {
        name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      };
    }));
    return queueHealthSchema.parse({ queues: stats });
  });
}
```

> **Cross-milestone note:** M1 ships `getAllQueues()` from `api/src/queues/index.ts` (committed). It returns the array `{ name, queue }[]` for every registered BullMQ queue.

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminSystemQueueHealthRoute } from './system/queue-health.js';
// ...
await app.register(adminSystemQueueHealthRoute, { prefix: '/system' });
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/admin/system/queue-health.ts api/src/routes/admin/index.ts api/tests/integration/admin/system.test.ts
git commit -m "feat(api): GET /v1/admin/system/queue-health"
```

---

### Task F4: GET /v1/admin/system/push-logs

**Files:**
- Create: `api/src/routes/admin/system/push-logs.ts`
- Modify: `api/tests/integration/admin/system.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Append the failing test**

Add this describe block at the bottom of `api/tests/integration/admin/system.test.ts`:

```ts
import { getPrisma } from '../../../src/db.js';
import { makeUser } from '../../helpers/admin.js';

describe('GET /v1/admin/system/push-logs', () => {
  it('returns paginated push logs with filters', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const u = await makeUser();
    const prisma = getPrisma();
    await prisma.pushLog.createMany({
      data: [
        { userId: u.id, templateKey: 'expiry_7d', status: 'sent' },
        { userId: u.id, templateKey: 'expiry_1d', status: 'failed', errorMessage: 'DeviceNotRegistered' },
      ],
    });
    const res = await app.inject({ method: 'GET', url: `/v1/admin/system/push-logs?user_id=${u.id}&status=failed`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.every((r: { status: string }) => r.status === 'failed')).toBe(true);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/system/push-logs.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  pushLogsQuerySchema,
  pushLogsListSchema,
  encodeCursor,
  decodeCursor,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

export async function adminSystemPushLogsRoute(app: FastifyInstance) {
  app.get('/push-logs', async (req) => {
    const q = pushLogsQuerySchema.parse(req.query);
    const where: Prisma.PushLogWhereInput = {};
    if (q.userId) where.userId = q.userId;
    if (q.status) where.status = q.status;
    const cur = decodeCursor(q.cursor);
    if (cur) where.AND = [{ OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] }];

    const rows = await getPrisma().pushLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r) => ({
      id: r.id,
      userId: r.userId,
      templateKey: r.templateKey,
      status: r.status,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    }));
    const last = items.at(-1);
    return pushLogsListSchema.parse({
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminSystemPushLogsRoute } from './system/push-logs.js';
// ...
await app.register(adminSystemPushLogsRoute, { prefix: '/system' });
```

- [ ] **Step 5: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
git add api/src/routes/admin/system/push-logs.ts api/src/routes/admin/index.ts api/tests/integration/admin/system.test.ts
git commit -m "feat(api): GET /v1/admin/system/push-logs"
```

---

### Task F5: GET /v1/admin/system/api-errors

**Files:**
- Create: `api/src/routes/admin/system/api-errors.ts`
- Modify: `api/tests/integration/admin/system.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Append the failing test**

```ts
describe('GET /v1/admin/system/api-errors', () => {
  it('returns aggregated counts by route+status for the requested range', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const prisma = getPrisma();
    await prisma.apiError.createMany({
      data: [
        { route: '/v1/products/lookup', method: 'POST', status: 500 },
        { route: '/v1/products/lookup', method: 'POST', status: 500 },
        { route: '/v1/products/lookup', method: 'POST', status: 404 },
      ],
    });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/api-errors?range=24h', headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const five = body.rows.find((r: { status: number; route: string }) => r.status === 500 && r.route === '/v1/products/lookup');
    expect(five.count).toBe(2);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/system/api-errors.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { apiErrorsQuerySchema, apiErrorsAggSchema } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';

function sinceFor(range: '24h' | '7d' | '30d'): Date {
  const h = range === '24h' ? 24 : range === '7d' ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - h * 3600_000);
}

export async function adminSystemApiErrorsRoute(app: FastifyInstance) {
  app.get('/api-errors', async (req) => {
    const { range } = apiErrorsQuerySchema.parse(req.query);
    const since = sinceFor(range);
    const rows = await getPrisma().$queryRaw<{ route: string; method: string; status: number; count: bigint }[]>`
      SELECT route, method, status, COUNT(*)::bigint as count
      FROM api_errors
      WHERE "createdAt" >= ${since}
      GROUP BY route, method, status
      ORDER BY count DESC
      LIMIT 200
    `;
    return apiErrorsAggSchema.parse({
      range,
      rows: rows.map((r) => ({ route: r.route, method: r.method, status: r.status, count: Number(r.count) })),
    });
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminSystemApiErrorsRoute } from './system/api-errors.js';
// ...
await app.register(adminSystemApiErrorsRoute, { prefix: '/system' });
```

- [ ] **Step 5: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
git add api/src/routes/admin/system/api-errors.ts api/src/routes/admin/index.ts api/tests/integration/admin/system.test.ts
git commit -m "feat(api): GET /v1/admin/system/api-errors"
```

---

### Task F6: GET /v1/admin/system/external-apis (opossum breaker state)

**Files:**
- Create: `api/src/services/admin/breakers.ts`
- Create: `api/src/routes/admin/system/external-apis.ts`
- Modify: `api/tests/integration/admin/system.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write `api/src/services/admin/breakers.ts`**

```ts
import { getBreaker } from '../../services/external/breakers.js'; // exposed by M1

const NAMES = ['off', 'upcitemdb', 'expo-push'] as const;

export function snapshotBreakers() {
  return NAMES.map((name) => {
    const b = getBreaker(name);
    const stats = b.stats;
    return {
      name,
      state: b.opened ? 'open' : b.halfOpen ? 'halfOpen' : 'closed',
      fires: stats.fires ?? 0,
      failures: stats.failures ?? 0,
      successes: stats.successes ?? 0,
      lastFailureAt: (b as unknown as { lastFailureAt?: Date }).lastFailureAt?.toISOString() ?? null,
    } as const;
  });
}
```

> **Cross-milestone note:** M1 ships `getBreaker(name)` and `getAllBreakers()` from `api/src/services/external/breakers.ts` (committed). The three registered names are `'off'`, `'upcitemdb'`, `'expo-push'`.

- [ ] **Step 2: Append the failing test**

```ts
describe('GET /v1/admin/system/external-apis', () => {
  it('returns breaker state for each registered external dependency', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/system/external-apis', headers });
    expect(res.statusCode).toBe(200);
    const names = res.json().breakers.map((b: { name: string }) => b.name);
    expect(names).toEqual(expect.arrayContaining(['off', 'upcitemdb', 'expo-push']));
    await app.close();
  });
});
```

- [ ] **Step 3: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
```

- [ ] **Step 4: Write `api/src/routes/admin/system/external-apis.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { externalApiStateSchema } from '@expyrico/shared';
import { snapshotBreakers } from '../../../services/admin/breakers.js';

export async function adminSystemExternalApisRoute(app: FastifyInstance) {
  app.get('/external-apis', async () => externalApiStateSchema.parse({ breakers: snapshotBreakers() }));
}
```

- [ ] **Step 5: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminSystemExternalApisRoute } from './system/external-apis.js';
// ...
await app.register(adminSystemExternalApisRoute, { prefix: '/system' });
```

- [ ] **Step 6: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/system.test.ts
git add api/src api/tests/integration/admin/system.test.ts
git commit -m "feat(api): GET /v1/admin/system/external-apis (opossum stats)"
```

---

### Task F7: Mount @bull-board at /v1/admin/bullboard

**Files:**
- Create: `api/src/routes/admin/system/bullboard.ts`
- Modify: `api/src/routes/admin/index.ts`
- Modify: `api/package.json` (add deps)

- [ ] **Step 1: Add dependencies**

```bash
pnpm --filter @expyrico/api add @bull-board/api @bull-board/fastify
```

- [ ] **Step 2: Write `api/src/routes/admin/system/bullboard.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { FastifyAdapter } from '@bull-board/fastify';
import { getAllQueues } from '../../queues/index.js';

export async function adminBullBoardRoute(app: FastifyInstance) {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/v1/admin/bullboard');
  createBullBoard({
    queues: getAllQueues().map(({ queue }) => new BullMQAdapter(queue)),
    serverAdapter,
  });
  await app.register(serverAdapter.registerPlugin(), { prefix: '/bullboard', basePath: '' });
}
```

- [ ] **Step 3: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminBullBoardRoute } from './system/bullboard.js';
// ...
await app.register(adminBullBoardRoute);
```

- [ ] **Step 4: Smoke test**

```bash
pnpm --filter @expyrico/api dev &
sleep 2
# Without admin auth this should 401 (gate is the admin-only plugin)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/v1/admin/bullboard/
kill %1
```
Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/admin/system/bullboard.ts api/src/routes/admin/index.ts api/package.json pnpm-lock.yaml
git commit -m "feat(api): mount @bull-board at /v1/admin/bullboard"
```

---

## Phase G — Settings endpoints

### Task G1: Shared Zod schemas for settings

**Files:**
- Create: `packages/shared/src/schemas/admin/settings.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin/settings.ts`**

```ts
import { z } from 'zod';

export const featureFlagsSchema = z.object({
  reviewsEnabled: z.boolean(),
  passkeysEnabled: z.boolean(),
  ocrEnabled: z.boolean(),
  maintenanceBanner: z.string().nullable(),
});

export const moderationSettingsSchema = z.object({
  autoHideReportThreshold: z.number().int().min(1).max(100),
  profanitySensitivity: z.enum(['low', 'medium', 'high']),
});

export const notificationTemplateSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  title: z.string(),
  body: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const notificationTemplatePatchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'no fields' });

export const adminRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  totpEnabledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const adminInviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const adminRevokeSchema = z.object({
  revoke: z.literal(true),
});
```

- [ ] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/admin/settings.js';
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @expyrico/shared typecheck
git add packages/shared
git commit -m "feat(shared): admin settings zod schemas"
```

---

### Task G2: Settings service (typed get/put against `settings` table)

**Files:**
- Create: `api/src/services/admin/settings.ts`

- [ ] **Step 1: Write `api/src/services/admin/settings.ts`**

```ts
import { z } from 'zod';
import { getPrisma } from '../../db.js';
import { featureFlagsSchema, moderationSettingsSchema } from '@expyrico/shared';

export async function getSetting<T extends z.ZodTypeAny>(key: string, schema: T): Promise<z.infer<T>> {
  const row = await getPrisma().setting.findUnique({ where: { key } });
  if (!row) throw new Error(`Setting ${key} missing — did you run seed-admin?`);
  return schema.parse(row.value);
}

export async function putSetting<T extends z.ZodTypeAny>(key: string, value: z.infer<T>, schema: T, updatedBy: string) {
  const parsed = schema.parse(value);
  await getPrisma().setting.upsert({
    where: { key },
    update: { value: parsed as object, updatedBy },
    create: { key, value: parsed as object, updatedBy },
  });
  return parsed;
}

export const SETTING_KEYS = {
  FEATURE_FLAGS: 'feature_flags',
  MODERATION: 'moderation',
} as const;

export { featureFlagsSchema, moderationSettingsSchema };
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/api typecheck
git add api/src/services/admin/settings.ts
git commit -m "feat(api): typed settings service"
```

---

### Task G3: GET/PATCH /v1/admin/settings/feature-flags + /moderation

**Files:**
- Create: `api/src/routes/admin/settings/feature-flags.ts`
- Create: `api/src/routes/admin/settings/moderation.ts`
- Create: `api/tests/integration/admin/settings.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/admin/settings.test.ts
import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from '../../../src/server.js';
import { getPrisma } from '../../../src/db.js';
import { makeAdmin } from '../../helpers/admin.js';

beforeAll(async () => {
  const prisma = getPrisma();
  await prisma.setting.upsert({
    where: { key: 'feature_flags' },
    update: { value: { reviewsEnabled: true, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: null } },
    create: { key: 'feature_flags', value: { reviewsEnabled: true, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: null } },
  });
  await prisma.setting.upsert({
    where: { key: 'moderation' },
    update: { value: { autoHideReportThreshold: 3, profanitySensitivity: 'medium' } },
    create: { key: 'moderation', value: { autoHideReportThreshold: 3, profanitySensitivity: 'medium' } },
  });
});

describe('admin settings — feature flags', () => {
  it('GET returns current flags', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/settings/feature-flags', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ reviewsEnabled: true });
    await app.close();
  });

  it('PATCH updates flags and audit-logs', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const res = await app.inject({ method: 'PATCH', url: '/v1/admin/settings/feature-flags', headers, payload: { reviewsEnabled: false, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: null } });
    expect(res.statusCode).toBe(200);
    expect(res.json().reviewsEnabled).toBe(false);
    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'settings.feature_flags.update' } });
    expect(log.diff).toMatchObject({ after: { reviewsEnabled: false } });
    await app.close();
  });

  it('PATCH can set and clear maintenanceBanner', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    // Set a banner.
    const set = await app.inject({ method: 'PATCH', url: '/v1/admin/settings/feature-flags', headers, payload: { reviewsEnabled: true, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: 'Scheduled maintenance at 02:00 UTC' } });
    expect(set.statusCode).toBe(200);
    expect(set.json().maintenanceBanner).toBe('Scheduled maintenance at 02:00 UTC');
    // Clear it.
    const clear = await app.inject({ method: 'PATCH', url: '/v1/admin/settings/feature-flags', headers, payload: { reviewsEnabled: true, passkeysEnabled: true, ocrEnabled: true, maintenanceBanner: null } });
    expect(clear.statusCode).toBe(200);
    expect(clear.json().maintenanceBanner).toBeNull();
    await app.close();
  });
});

describe('admin settings — moderation', () => {
  it('GET returns moderation config', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/settings/moderation', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().profanitySensitivity).toBe('medium');
    await app.close();
  });

  it('PATCH updates moderation', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'PATCH', url: '/v1/admin/settings/moderation', headers, payload: { autoHideReportThreshold: 5, profanitySensitivity: 'high' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().autoHideReportThreshold).toBe(5);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/settings.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/settings/feature-flags.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { featureFlagsSchema } from '@expyrico/shared';
import { getSetting, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminFeatureFlagsRoute(app: FastifyInstance) {
  app.get('/feature-flags', async () => getSetting(SETTING_KEYS.FEATURE_FLAGS, featureFlagsSchema));
  app.patch('/feature-flags', async (req) => {
    const before = await getSetting(SETTING_KEYS.FEATURE_FLAGS, featureFlagsSchema);
    const after = await putSetting(SETTING_KEYS.FEATURE_FLAGS, req.body as never, featureFlagsSchema, req.user!.id);
    await req.auditLog('settings.feature_flags.update', { type: 'settings', id: 'feature_flags' }, { before, after });
    return after;
  });
}
```

- [ ] **Step 4: Write `api/src/routes/admin/settings/moderation.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { moderationSettingsSchema } from '@expyrico/shared';
import { getSetting, putSetting, SETTING_KEYS } from '../../../services/admin/settings.js';

export async function adminModerationRoute(app: FastifyInstance) {
  app.get('/moderation', async () => getSetting(SETTING_KEYS.MODERATION, moderationSettingsSchema));
  app.patch('/moderation', async (req) => {
    const before = await getSetting(SETTING_KEYS.MODERATION, moderationSettingsSchema);
    const after = await putSetting(SETTING_KEYS.MODERATION, req.body as never, moderationSettingsSchema, req.user!.id);
    await req.auditLog('settings.moderation.update', { type: 'settings', id: 'moderation' }, { before, after });
    return after;
  });
}
```

- [ ] **Step 5: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminFeatureFlagsRoute } from './settings/feature-flags.js';
import { adminModerationRoute } from './settings/moderation.js';
// ...
await app.register(adminFeatureFlagsRoute, { prefix: '/settings' });
await app.register(adminModerationRoute, { prefix: '/settings' });
```

- [ ] **Step 6: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/settings.test.ts
git add api/src api/tests/integration/admin/settings.test.ts
git commit -m "feat(api): admin settings (feature-flags, moderation)"
```

---

### Task G4: GET/PATCH /v1/admin/settings/notification-templates

**Files:**
- Create: `api/src/routes/admin/settings/notification-templates.ts`
- Modify: `api/tests/integration/admin/settings.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Append the failing test**

```ts
describe('admin settings — notification templates', () => {
  it('GET returns all templates', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    await getPrisma().notificationTemplate.upsert({
      where: { key: 'expiry_7d' },
      update: {},
      create: { key: 'expiry_7d', title: 'T', body: 'B' },
    });
    const res = await app.inject({ method: 'GET', url: '/v1/admin/settings/notification-templates', headers });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    await app.close();
  });

  it('PATCH updates a template and audit-logs', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    const prisma = getPrisma();
    const t = await prisma.notificationTemplate.upsert({
      where: { key: 'expiry_1d' },
      update: { title: 'Old' },
      create: { key: 'expiry_1d', title: 'Old', body: 'X' },
    });
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/settings/notification-templates/${t.id}`, headers, payload: { title: 'New' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('New');
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'settings.notification_template.update', targetId: t.id } });
    expect(log).toBeTruthy();
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/settings.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/settings/notification-templates.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notificationTemplateSchema, notificationTemplatePatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminNotificationTemplatesRoute(app: FastifyInstance) {
  app.get('/notification-templates', async () => {
    const rows = await getPrisma().notificationTemplate.findMany({ orderBy: { key: 'asc' } });
    return rows.map((t) => notificationTemplateSchema.parse({
      id: t.id, key: t.key, title: t.title, body: t.body, enabled: t.enabled,
      updatedAt: t.updatedAt.toISOString(),
    }));
  });

  app.patch('/notification-templates/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = notificationTemplatePatchSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Template not found' });
    const after = await prisma.notificationTemplate.update({ where: { id }, data: { ...input, updatedBy: req.user!.id } });
    await req.auditLog('settings.notification_template.update', { type: 'notification_template', id }, {
      before: { title: before.title, body: before.body, enabled: before.enabled },
      after: { title: after.title, body: after.body, enabled: after.enabled },
    });
    return notificationTemplateSchema.parse({
      id: after.id, key: after.key, title: after.title, body: after.body, enabled: after.enabled,
      updatedAt: after.updatedAt.toISOString(),
    });
  });
}
```

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminNotificationTemplatesRoute } from './settings/notification-templates.js';
// ...
await app.register(adminNotificationTemplatesRoute, { prefix: '/settings' });
```

- [ ] **Step 5: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/settings.test.ts
git add api/src api/tests/integration/admin/settings.test.ts
git commit -m "feat(api): admin notification template GET/PATCH"
```

---

### Task G3a: Extend email service with `sendAdminInviteEmail` (D21)

**Files:**
- Modify: `api/src/services/auth/email.ts` (created in M0a)
- Modify: `api/src/services/auth/email.test.ts` (created in M0a)

- [ ] **Step 1: Verify `EmailToken.purpose` is a `String` column (no enum migration needed)**

```bash
grep -n "purpose\s\+String" api/prisma/schema.prisma
```
Expected: a line `purpose String` (M0a's shape). If it's an enum, halt — that's a separate refactor outside this task's scope.

- [ ] **Step 2: Write the failing unit test**

```ts
// api/src/services/auth/email.test.ts (append)
import { sendAdminInviteEmail } from './email.js';
import { transport } from './email.js';

describe('sendAdminInviteEmail', () => {
  it('sends an invite email with the accept-invite link', async () => {
    const send = vi.spyOn(transport, 'sendMail').mockResolvedValue({ messageId: 'm1' } as any);
    await sendAdminInviteEmail({ email: 'a@b.test', inviteUrl: 'https://admin.example.com/accept-invite?token=xyz' });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.test',
      subject: expect.stringMatching(/admin/i),
      html: expect.stringContaining('https://admin.example.com/accept-invite?token=xyz'),
    }));
  });
});
```

- [ ] **Step 3: Run, verify FAIL** — `pnpm --filter @expyrico/api test email`

- [ ] **Step 4: Implement**

```ts
// api/src/services/auth/email.ts (append)
export async function sendAdminInviteEmail(input: { email: string; inviteUrl: string }): Promise<void> {
  await transport.sendMail({
    from: cfg.smtp.from,
    to: input.email,
    subject: "You've been invited to administer Expyrico",
    text: `Click to accept: ${input.inviteUrl}`,
    html: `<p>You've been invited to administer Expyrico. <a href="${input.inviteUrl}">Accept invite</a> (expires in 7 days).</p>`,
  });
}
```

- [ ] **Step 5: Run, verify PASS**

- [ ] **Step 6: Commit**

```bash
git add api/src/services/auth/email.ts api/src/services/auth/email.test.ts
git commit -m "feat(api): sendAdminInviteEmail for admin invites (D21)"
```

---

### Task G5: GET/POST/PATCH /v1/admin/settings/admins (list/invite/revoke)

**Files:**
- Create: `api/src/routes/admin/settings/admins.ts`
- Modify: `api/tests/integration/admin/settings.test.ts`
- Modify: `api/src/routes/admin/index.ts`

- [ ] **Step 1: Append the failing test**

```ts
describe('admin settings — admins', () => {
  it('GET lists role=admin users', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/settings/admins', headers });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json().every((u: { id: string }) => typeof u.id === 'string')).toBe(true);
    await app.close();
  });

  it('POST invite sends an admin-grant magic link to a new email', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'POST', url: '/v1/admin/settings/admins/invite', headers, payload: { email: `inv-${Date.now()}@example.com`, firstName: 'A', lastName: 'B' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toBe(true);
    await app.close();
  });

  it('PATCH revokes an admin (role -> user)', async () => {
    const app = await buildServer();
    const { admin, headers } = await makeAdmin();
    // Create another admin to revoke
    const other = await getPrisma().user.create({
      data: { email: `other-${Date.now()}@example.com`, firstName: 'O', lastName: 'A', role: 'admin', emailVerifiedAt: new Date() },
    });
    const res = await app.inject({ method: 'PATCH', url: `/v1/admin/settings/admins/${other.id}`, headers, payload: { revoke: true } });
    expect(res.statusCode).toBe(200);
    const after = await getPrisma().user.findUniqueOrThrow({ where: { id: other.id } });
    expect(after.role).toBe('user');
    const log = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id, action: 'admin.revoke', targetId: other.id } });
    expect(log).toBeTruthy();
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/settings.test.ts
```

- [ ] **Step 3: Write `api/src/routes/admin/settings/admins.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminRowSchema, adminInviteSchema, adminRevokeSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { sendAdminInviteEmail } from '../../../services/auth/email.js';
import { hashToken, randomToken } from '../../../utils/random.js';
import { cfg } from '../../../config.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminAdminsRoute(app: FastifyInstance) {
  app.get('/admins', async () => {
    const rows = await getPrisma().user.findMany({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' } });
    return rows.map((u) => adminRowSchema.parse({
      id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
      totpEnabledAt: u.totpEnabledAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  });

  app.post('/admins/invite', async (req) => {
    const input = adminInviteSchema.parse(req.body);
    const prisma = getPrisma();
    // Find or create user; ensure they don't already have admin role.
    let user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: input.email, firstName: input.firstName, lastName: input.lastName, role: 'user' },
      });
    } else if (user.role === 'admin') {
      throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already an admin' });
    }
    const token = randomToken(32);
    await prisma.emailToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), purpose: 'admin_grant', expiresAt: new Date(Date.now() + 24 * 3600_000) },
    });
    const inviteUrl = `${cfg.frontend.adminUrl}/accept-invite?token=${token}`;
    await sendAdminInviteEmail({ email: user.email, inviteUrl });
    await req.auditLog('admin.invite', { type: 'user', id: user.id }, { before: null, after: { email: user.email } });
    return { sent: true };
  });

  app.patch('/admins/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminRevokeSchema.parse(req.body);
    if (!input.revoke) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION_ERROR, title: 'revoke flag required' });
    const prisma = getPrisma();
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before || before.role !== 'admin') throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Admin not found' });
    await prisma.user.update({ where: { id }, data: { role: 'user' } });
    await req.auditLog('admin.revoke', { type: 'user', id }, { before: { role: 'admin' }, after: { role: 'user' } });
    return { ok: true };
  });
}
```

> **D21:** `sendAdminInviteEmail` and acceptance of `EmailToken.purpose = 'admin_grant'` are added in Task G3a immediately above. `purpose` is a `String` column (M0a) — no enum migration is required.

- [ ] **Step 4: Wire** — in `api/src/routes/admin/index.ts`:

```ts
import { adminAdminsRoute } from './settings/admins.js';
// ...
await app.register(adminAdminsRoute, { prefix: '/settings' });
```

- [ ] **Step 5: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin/settings.test.ts
git add api/src api/tests/integration/admin/settings.test.ts api/prisma
git commit -m "feat(api): admin settings/admins (list, invite, revoke)"
```

---

## Phase H — Admin web app: shared UI primitives and helpers

> **Setup assumption:** M0d already installed shadcn/ui primitives (button, dialog, input, dropdown-menu, table, badge, toast, sonner). If a primitive used below is missing, run `pnpm --filter @expyrico/admin exec shadcn@latest add <name>` and commit separately before the task that needs it.

### Task H1: Install client deps + utilities

**Files:**
- Modify: `apps/admin/package.json` (add deps)

- [ ] **Step 1: Install dependencies**

```bash
pnpm --filter @expyrico/admin add @tanstack/react-query @tanstack/react-table recharts zod
```

- [ ] **Step 2: Verify install**

```bash
pnpm --filter @expyrico/admin exec vitest --version >/dev/null 2>&1 || echo 'vitest not configured — using next test'
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/package.json pnpm-lock.yaml
git commit -m "chore(admin): add tanstack query/table + recharts"
```

---

### Task H2: Admin API wrapper

**Files:**
- Create: `apps/admin/src/lib/admin-api.ts`

- [ ] **Step 1: Write `apps/admin/src/lib/admin-api.ts`**

```ts
// Thin typed wrappers around M0d's cookie-based api client (`lib/api.ts`),
// which exports `apiServerFetch` (Server Components / server actions, forwards
// the cookie header from the inbound request) and `apiBrowserFetch` (Client
// Components, runs in the browser using fetch with credentials: 'include').
// Each function returns a Promise<T> typed against @expyrico/shared schemas.
//
// Both factories share the same shape so callers pick the right one for their
// runtime: `serverAdminApi` for server-side fetches and `browserAdminApi` for
// client-side fetches. (Importing the wrong one in the wrong context is a
// typecheck-clean runtime bug — server fetch in a client component throws.)
import { apiServerFetch, apiBrowserFetch } from './api.js'; // exported by M0d
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
} from '@expyrico/shared';
import { z } from 'zod';

type Q = Record<string, string | number | undefined>;
function qs(q: Q): string {
  const e = Object.entries(q).filter(([, v]) => v !== undefined && v !== '');
  return e.length === 0 ? '' : '?' + new URLSearchParams(Object.fromEntries(e.map(([k, v]) => [k, String(v)]))).toString();
}

type Fetcher = (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;

function makeAdminApi(apiFetch: Fetcher) {
  return {
    users: {
      list: (q: Q = {}) => apiFetch(`/v1/admin/users${qs(q)}`).then((r) => adminUsersListSchema.parse(r)),
      get: (id: string) => apiFetch(`/v1/admin/users/${id}`).then((r) => adminUserDetailSchema.parse(r)),
      patch: (id: string, body: object) => apiFetch(`/v1/admin/users/${id}`, { method: 'PATCH', body }).then((r) => adminUserRowSchema.parse(r)),
      revokeSessions: (id: string) => apiFetch(`/v1/admin/users/${id}/sessions/revoke-all`, { method: 'POST' }).then((r) => z.object({ revoked: z.number() }).parse(r)),
      impersonate: (id: string) => apiFetch(`/v1/admin/users/${id}/impersonate`, { method: 'POST' }).then((r) => adminUserImpersonateResponseSchema.parse(r)),
    },
    products: {
      list: (q: Q = {}) => apiFetch(`/v1/admin/products${qs(q)}`).then((r) => adminProductsListSchema.parse(r)),
      get: (id: string) => apiFetch(`/v1/admin/products/${id}`).then((r) => adminProductRowSchema.parse(r)),
      patch: (id: string, body: object) => apiFetch(`/v1/admin/products/${id}`, { method: 'PATCH', body }).then((r) => adminProductRowSchema.parse(r)),
      merge: (winnerId: string, loserIds: string[]) => apiFetch(`/v1/admin/products/${winnerId}/merge`, { method: 'POST', body: { winnerId, loserIds } }).then((r) => adminProductMergeResponseSchema.parse(r)),
      pending: (q: Q = {}) => apiFetch(`/v1/admin/products/pending${qs(q)}`).then((r) => adminProductEditsListSchema.parse(r)),
      resolveEdit: (id: string, decision: 'approve' | 'reject', notes?: string) => apiFetch(`/v1/admin/products/pending/${id}`, { method: 'PATCH', body: { decision, notes } }),
    },
    reviews: {
      list: (q: Q = {}) => apiFetch(`/v1/admin/reviews${qs(q)}`).then((r) => adminReviewsListSchema.parse(r)),
      get: (id: string) => apiFetch(`/v1/admin/reviews/${id}`).then((r) => adminReviewRowSchema.parse(r)),
      setStatus: (id: string, status: 'visible' | 'hidden' | 'deleted') => apiFetch(`/v1/admin/reviews/${id}/status`, { method: 'PATCH', body: { status } }),
    },
    reports: {
      list: (q: Q = {}) => apiFetch(`/v1/admin/reports${qs(q)}`).then((r) => adminReportsListSchema.parse(r)),
      resolve: (id: string, action: 'hide' | 'delete' | 'dismiss' | 'ban', notes?: string) => apiFetch(`/v1/admin/reports/${id}/resolve`, { method: 'PATCH', body: { action, notes } }),
    },
    analytics: {
      overview: () => apiFetch('/v1/admin/analytics/overview').then((r) => analyticsOverviewSchema.parse(r)),
      scans: (range: '7d' | '30d' | '90d') => apiFetch(`/v1/admin/analytics/scans?range=${range}`).then((r) => analyticsScansSchema.parse(r)),
      reviews: (range: '7d' | '30d' | '90d') => apiFetch(`/v1/admin/analytics/reviews?range=${range}`).then((r) => analyticsReviewsSchema.parse(r)),
      geography: () => apiFetch('/v1/admin/analytics/geography').then((r) => analyticsGeographySchema.parse(r)),
    },
    system: {
      queueHealth: () => apiFetch('/v1/admin/system/queue-health').then((r) => queueHealthSchema.parse(r)),
      pushLogs: (q: Q = {}) => apiFetch(`/v1/admin/system/push-logs${qs(q)}`).then((r) => pushLogsListSchema.parse(r)),
      apiErrors: (range: '24h' | '7d' | '30d') => apiFetch(`/v1/admin/system/api-errors?range=${range}`).then((r) => apiErrorsAggSchema.parse(r)),
      externalApis: () => apiFetch('/v1/admin/system/external-apis').then((r) => externalApiStateSchema.parse(r)),
    },
    settings: {
      featureFlags: {
        get: () => apiFetch('/v1/admin/settings/feature-flags').then((r) => featureFlagsSchema.parse(r)),
        put: (body: z.infer<typeof featureFlagsSchema>) => apiFetch('/v1/admin/settings/feature-flags', { method: 'PATCH', body }).then((r) => featureFlagsSchema.parse(r)),
      },
      moderation: {
        get: () => apiFetch('/v1/admin/settings/moderation').then((r) => moderationSettingsSchema.parse(r)),
        put: (body: z.infer<typeof moderationSettingsSchema>) => apiFetch('/v1/admin/settings/moderation', { method: 'PATCH', body }).then((r) => moderationSettingsSchema.parse(r)),
      },
      notificationTemplates: {
        list: () => apiFetch('/v1/admin/settings/notification-templates').then((r) => z.array(notificationTemplateSchema).parse(r)),
        patch: (id: string, body: object) => apiFetch(`/v1/admin/settings/notification-templates/${id}`, { method: 'PATCH', body }).then((r) => notificationTemplateSchema.parse(r)),
      },
      admins: {
        list: () => apiFetch('/v1/admin/settings/admins').then((r) => z.array(adminRowSchema).parse(r)),
        invite: (body: { email: string; firstName: string; lastName: string }) => apiFetch('/v1/admin/settings/admins/invite', { method: 'POST', body }),
        revoke: (id: string) => apiFetch(`/v1/admin/settings/admins/${id}`, { method: 'PATCH', body: { revoke: true } }),
      },
    },
  };
}

/** Use from Server Components, server actions, route handlers. Forwards the inbound cookie header. */
export const serverAdminApi = makeAdminApi(apiServerFetch);

/** Use from Client Components ('use client'). Runs in the browser, sends cookies via credentials: 'include'. */
export const browserAdminApi = makeAdminApi(apiBrowserFetch);
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @expyrico/admin typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/admin-api.ts
git commit -m "feat(admin): typed admin api client"
```

---

### Task H3: `<ConfirmModal>` component

**Files:**
- Create: `apps/admin/src/components/confirm-modal.tsx`

- [ ] **Step 1: Write `apps/admin/src/components/confirm-modal.tsx`**

```tsx
'use client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', destructive, onConfirm, onCancel }: ConfirmModalProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(); } finally { setBusy(false); }
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/components/confirm-modal.tsx
git commit -m "feat(admin): ConfirmModal component"
```

---

### Task H4: Toast helper

**Files:**
- Create: `apps/admin/src/lib/toast.ts`

- [ ] **Step 1: Write `apps/admin/src/lib/toast.ts`**

```ts
import { toast as sonner } from 'sonner';

export const toast = {
  success: (msg: string) => sonner.success(msg),
  error: (e: unknown) => {
    const msg = e instanceof Error ? e.message : 'Something went wrong';
    sonner.error(msg);
  },
  promise: <T>(p: Promise<T>, msgs: { loading: string; success: string; error: string }) => sonner.promise(p, msgs),
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/lib/toast.ts
git commit -m "feat(admin): toast helper"
```

---

### Task H5: `useBulkSelection` hook (unit test in same file)

**Files:**
- Create: `apps/admin/src/lib/use-bulk-selection.ts`
- Create: `apps/admin/src/lib/use-bulk-selection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/admin/src/lib/use-bulk-selection.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from './use-bulk-selection.js';

describe('useBulkSelection', () => {
  it('toggles, selects all, clears, and reports counts', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const { result } = renderHook(() => useBulkSelection(items, (i) => i.id));
    expect(result.current.selectedIds).toEqual([]);
    act(() => result.current.toggle('a'));
    expect(result.current.selectedIds).toEqual(['a']);
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.sort()).toEqual(['a', 'b', 'c']);
    act(() => result.current.clear());
    expect(result.current.selectedIds).toEqual([]);
    act(() => { result.current.toggle('a'); result.current.toggle('b'); });
    expect(result.current.count).toBe(2);
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.isSelected('c')).toBe(false);
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/admin exec vitest run src/lib/use-bulk-selection.test.tsx
```

- [ ] **Step 3: Write `apps/admin/src/lib/use-bulk-selection.ts`**

```ts
'use client';
import { useCallback, useMemo, useState } from 'react';

export function useBulkSelection<T>(items: readonly T[], idOf: (t: T) => string) {
  const [set, setSet] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback(() => setSet(new Set(items.map(idOf))), [items, idOf]);
  const clear = useCallback(() => setSet(new Set()), []);
  const isSelected = useCallback((id: string) => set.has(id), [set]);
  const selectedIds = useMemo(() => Array.from(set), [set]);
  return { selectedIds, count: set.size, toggle, selectAll, clear, isSelected };
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm --filter @expyrico/admin exec vitest run src/lib/use-bulk-selection.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/use-bulk-selection.ts apps/admin/src/lib/use-bulk-selection.test.tsx
git commit -m "feat(admin): useBulkSelection hook"
```

---

### Task H6: Reusable `<DataTable>` (TanStack Table wrapper)

**Files:**
- Create: `apps/admin/src/components/data-table.tsx`

- [ ] **Step 1: Write `apps/admin/src/components/data-table.tsx`**

```tsx
'use client';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  onLoadMore?: () => void;
  hasMore?: boolean;
};

export function DataTable<T>({ data, columns, onLoadMore, hasMore }: DataTableProps<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((c) => (
                <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore}>Load more</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/components/data-table.tsx
git commit -m "feat(admin): DataTable wrapper over TanStack Table"
```

---

### Task H7: KPI card + chart wrappers

**Files:**
- Create: `apps/admin/src/components/kpi-card.tsx`
- Create: `apps/admin/src/components/chart-line.tsx`
- Create: `apps/admin/src/components/chart-bar.tsx`
- Create: `apps/admin/src/components/status-badge.tsx`

- [ ] **Step 1: Write `apps/admin/src/components/kpi-card.tsx`**

```tsx
export function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Write `apps/admin/src/components/chart-line.tsx`**

```tsx
'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function ChartLine({ data, x, y, height = 260 }: { data: object[]; x: string; y: string; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={x} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey={y} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Write `apps/admin/src/components/chart-bar.tsx`**

```tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function ChartBar({ data, x, y, height = 260 }: { data: object[]; x: string; y: string; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={x} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey={y} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Write `apps/admin/src/components/status-badge.tsx`**

```tsx
import { Badge } from '@/components/ui/badge';

const VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  visible: 'default',
  pending: 'secondary',
  hidden: 'secondary',
  suspended: 'destructive',
  deleted: 'destructive',
  resolved: 'outline',
  dismissed: 'outline',
  open: 'secondary',
  merged_into: 'outline',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? 'outline'}>{status}</Badge>;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components
git commit -m "feat(admin): KPI card, chart wrappers, status badge"
```

---

## Phase I — Admin pages: overview, users, products

> Each page replaces the M0d stub. **Server Components import `serverAdminApi`** (forwards cookies from the inbound request via `apiServerFetch`). **Client Components / `'use client'` islands import `browserAdminApi`** (runs in the browser with `credentials: 'include'`). Both wrappers expose the identical typed surface from `@/lib/admin-api`. Every mutation pipes through `toast.promise(...)`.

### Task I1: `/` Overview dashboard

**Files:**
- Modify: `apps/admin/src/app/(admin)/page.tsx`

- [ ] **Step 1: Replace the stub with the overview page**

```tsx
// apps/admin/src/app/(admin)/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { ChartLine } from '@/components/chart-line';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [overview, scans] = await Promise.all([
    serverAdminApi.analytics.overview(),
    serverAdminApi.analytics.scans('7d'),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total users" value={overview.totalUsers} sub={`${overview.activeUsers7d} active 7d`} />
        <KpiCard label="Records" value={overview.totalRecords} />
        <KpiCard label="Reviews" value={overview.totalReviews} />
        <KpiCard label="Scans 7d" value={overview.scans7d} />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium mb-2">Scans (last 7 days)</h2>
        <ChartLine data={scans.daily} x="date" y="count" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + smoke**

```bash
pnpm --filter @expyrico/admin build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(admin\)/page.tsx
git commit -m "feat(admin): overview dashboard page"
```

---

### Task I2: `/users` list page

**Files:**
- Modify: `apps/admin/src/app/(admin)/users/page.tsx`
- Create: `apps/admin/src/app/(admin)/users/_users-table.tsx`

- [ ] **Step 1: Write the client table island**

```tsx
// apps/admin/src/app/(admin)/users/_users-table.tsx
'use client';
import { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { browserAdminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Row = Awaited<ReturnType<typeof browserAdminApi.users.list>>['items'][number];

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'email', header: 'Email', cell: ({ row }) => <Link className="underline" href={`/users/${row.original.id}`}>{row.original.email}</Link> },
  { accessorKey: 'firstName', header: 'Name', cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}` },
  { accessorKey: 'country', header: 'Country' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: 'createdAt', header: 'Joined', cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString() },
];

export function UsersTable() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);

  const query = useQuery({
    queryKey: ['admin', 'users', { q, status, role, cursor }],
    queryFn: () => browserAdminApi.users.list({ q: q || undefined, status: status || undefined, role: role || undefined, cursor }),
  });

  const items = query.data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Search email / name" value={q} onChange={(e) => { setCursors([]); setQ(e.target.value); }} className="max-w-xs" />
        <Select value={status} onValueChange={(v) => { setCursors([]); setStatus(v === 'all' ? '' : v); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="suspended">suspended</SelectItem>
            <SelectItem value="deleted">deleted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={(v) => { setCursors([]); setRole(v === 'all' ? '' : v); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        data={items}
        columns={columns}
        hasMore={!!query.data?.nextCursor}
        onLoadMore={() => query.data?.nextCursor && setCursors((p) => [...p, query.data!.nextCursor!])}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace `apps/admin/src/app/(admin)/users/page.tsx`**

```tsx
import { UsersTable } from './_users-table';

export const dynamic = 'force-dynamic';

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <UsersTable />
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
pnpm --filter @expyrico/admin build
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/\(admin\)/users
git commit -m "feat(admin): users list page with filters"
```

---

### Task I3: `/users/[id]` detail page with tabs

**Files:**
- Modify: `apps/admin/src/app/(admin)/users/[id]/page.tsx`
- Create: `apps/admin/src/app/(admin)/users/[id]/_actions.tsx`

- [ ] **Step 1: Write the actions client island**

```tsx
// apps/admin/src/app/(admin)/users/[id]/_actions.tsx
'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { browserAdminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmModal } from '@/components/confirm-modal';
import { toast } from '@/lib/toast';

type Props = { userId: string; current: { status: string; role: string; firstName: string; lastName: string } };

export function UserActions({ userId, current }: Props) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(current.status);
  const [role, setRole] = useState(current.role);
  const [confirm, setConfirm] = useState<null | 'revokeSessions' | 'impersonate' | 'savePatch'>(null);

  const patchMut = useMutation({
    mutationFn: (body: object) => browserAdminApi.users.patch(userId, body),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
    onError: toast.error,
  });
  const revokeMut = useMutation({
    mutationFn: () => browserAdminApi.users.revokeSessions(userId),
    onSuccess: (d) => { toast.success(`Revoked ${d.revoked} sessions`); qc.invalidateQueries({ queryKey: ['admin', 'users', userId] }); },
    onError: toast.error,
  });
  const imperMut = useMutation({
    mutationFn: () => browserAdminApi.users.impersonate(userId),
    onSuccess: (d) => {
      // Write to sessionStorage so a separate "open as user" link can pick it up. Simple v1.
      sessionStorage.setItem('impersonationToken', d.accessToken);
      toast.success('Impersonation token issued (15 min)');
    },
    onError: toast.error,
  });

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <div className="text-sm text-muted-foreground">Status</div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['active', 'suspended', 'deleted'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <div className="text-sm text-muted-foreground">Role</div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['user', 'admin'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => setConfirm('savePatch')} disabled={patchMut.isPending}>Save</Button>
        <Button variant="destructive" onClick={() => setConfirm('revokeSessions')}>Revoke all sessions</Button>
        <Button variant="outline" onClick={() => setConfirm('impersonate')}>Login as user</Button>
      </div>

      <ConfirmModal
        open={confirm === 'savePatch'}
        title="Apply changes?"
        description={`Set status=${status}, role=${role}.`}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await patchMut.mutateAsync({ status, role }); setConfirm(null); }}
      />
      <ConfirmModal
        open={confirm === 'revokeSessions'}
        title="Revoke all sessions?"
        description="The user will be signed out of every device immediately."
        destructive
        confirmLabel="Revoke"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await revokeMut.mutateAsync(); setConfirm(null); }}
      />
      <ConfirmModal
        open={confirm === 'impersonate'}
        title="Login as this user?"
        description="A 15-minute access token will be issued and audit-logged."
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await imperMut.mutateAsync(); setConfirm(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace `apps/admin/src/app/(admin)/users/[id]/page.tsx`**

```tsx
import { serverAdminApi } from '@/lib/admin-api';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserActions } from './_actions';

export const dynamic = 'force-dynamic';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await serverAdminApi.users.get(id);
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{user.firstName} {user.lastName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <StatusBadge status={user.status} />
      </header>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="sessions">Sessions ({user.sessions.length})</TabsTrigger>
          <TabsTrigger value="records">Records ({user.recordCount})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({user.reviewCount})</TabsTrigger>
          <TabsTrigger value="reports">Reports against ({user.openReportsAgainst})</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="space-y-4">
          <UserActions userId={user.id} current={{ status: user.status, role: user.role, firstName: user.firstName, lastName: user.lastName }} />
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Country</dt><dd>{user.country ?? '—'}</dd>
            <dt className="text-muted-foreground">Email verified</dt><dd>{user.emailVerifiedAt ?? '—'}</dd>
            <dt className="text-muted-foreground">TOTP enabled</dt><dd>{user.totpEnabledAt ?? '—'}</dd>
            <dt className="text-muted-foreground">Last seen</dt><dd>{user.lastSeenAt ?? '—'}</dd>
          </dl>
        </TabsContent>
        <TabsContent value="sessions">
          <ul className="space-y-2">
            {user.sessions.map((s) => (
              <li key={s.id} className="text-sm border rounded p-2 flex justify-between">
                <span>{s.ip ?? '—'} · expires {s.expiresAt}</span>
                <span>{s.revokedAt ? <StatusBadge status="deleted" /> : <StatusBadge status="active" />}</span>
              </li>
            ))}
            {user.sessions.length === 0 && <li className="text-sm text-muted-foreground">No sessions.</li>}
          </ul>
        </TabsContent>
        <TabsContent value="records"><p className="text-sm text-muted-foreground">Records list rendered via /v1/records?user_id={user.id} in M1. Placeholder count shown above.</p></TabsContent>
        <TabsContent value="reviews"><p className="text-sm text-muted-foreground">Reviews filtered via /v1/admin/reviews?userId={user.id}.</p></TabsContent>
        <TabsContent value="reports"><p className="text-sm text-muted-foreground">Reports filtered via /v1/admin/reports?target_type=user.</p></TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
pnpm --filter @expyrico/admin build
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/\(admin\)/users/\[id\]
git commit -m "feat(admin): user detail page with tabs + actions"
```

---

### Task I4: `/products` list page

**Files:**
- Modify: `apps/admin/src/app/(admin)/products/page.tsx`
- Create: `apps/admin/src/app/(admin)/products/_products-table.tsx`

- [ ] **Step 1: Write the table island**

```tsx
// apps/admin/src/app/(admin)/products/_products-table.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useState } from 'react';
import { browserAdminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';

type Row = Awaited<ReturnType<typeof browserAdminApi.products.list>>['items'][number];

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => <Link className="underline" href={`/products/${row.original.id}`}>{row.original.name}</Link> },
  { accessorKey: 'brand', header: 'Brand' },
  { accessorKey: 'source', header: 'Source' },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { id: 'buyAgainPct', header: '% Buy again', cell: ({ row }) => row.original.ratingCount > 0 ? `${Math.round((row.original.buyAgainCount / row.original.ratingCount) * 100)}%` : '—' },
  { accessorKey: 'ratingCount', header: 'Ratings', cell: ({ row }) => row.original.ratingCount },
  { accessorKey: 'reviewCount', header: 'Reviews' },
];

export function ProductsTable() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const query = useQuery({
    queryKey: ['admin', 'products', { q, status, source, cursor }],
    queryFn: () => browserAdminApi.products.list({ q: q || undefined, status: status || undefined, source: source || undefined, cursor }),
  });
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Search name / brand / barcode" value={q} onChange={(e) => { setCursor(undefined); setQ(e.target.value); }} className="max-w-xs" />
        <Select value={status} onValueChange={(v) => { setCursor(undefined); setStatus(v === 'all' ? '' : v); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="merged_into">merged_into</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => { setCursor(undefined); setSource(v === 'all' ? '' : v); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="off">off</SelectItem>
            <SelectItem value="upcitemdb">upcitemdb</SelectItem>
            <SelectItem value="user">user</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        data={query.data?.items ?? []}
        columns={columns}
        hasMore={!!query.data?.nextCursor}
        onLoadMore={() => query.data?.nextCursor && setCursor(query.data.nextCursor)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace `apps/admin/src/app/(admin)/products/page.tsx`**

```tsx
import { ProductsTable } from './_products-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/products/pending"><Button variant="outline">Pending edits</Button></Link>
      </header>
      <ProductsTable />
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/products
git commit -m "feat(admin): products list page"
```

---

### Task I5: `/products/[id]` view + inline edit + audit sidebar

**Files:**
- Modify: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Create: `apps/admin/src/app/(admin)/products/[id]/_edit-form.tsx`

- [ ] **Step 1: Write the edit form island**

```tsx
// apps/admin/src/app/(admin)/products/[id]/_edit-form.tsx
'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { browserAdminApi } from '@/lib/admin-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

type Init = { id: string; name: string; brand: string | null; category: string | null; imageUrl: string | null };

export function EditForm({ init }: { init: Init }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: init.name,
    brand: init.brand ?? '',
    category: init.category ?? '',
    imageUrl: init.imageUrl ?? '',
  });
  const mut = useMutation({
    mutationFn: () => browserAdminApi.products.patch(init.id, {
      name: form.name,
      brand: form.brand || null,
      category: form.category || null,
      imageUrl: form.imageUrl || null,
    }),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['admin', 'products'] }); },
    onError: toast.error,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3 max-w-md">
      <label className="block text-sm">Name<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label className="block text-sm">Brand<Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></label>
      <label className="block text-sm">Category<Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
      <label className="block text-sm">Image URL<Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></label>
      <Button type="submit" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : 'Save'}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Replace `apps/admin/src/app/(admin)/products/[id]/page.tsx`**

```tsx
import { serverAdminApi } from '@/lib/admin-api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { EditForm } from './_edit-form';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Fetch the product by id (Task C3a). The list endpoint's `q` matches
  // name/brand/barcode, never the id, so it cannot be used to load a detail page.
  let p;
  try {
    p = await serverAdminApi.products.get(id);
  } catch {
    return <p className="text-sm">Product not found.</p>;
  }
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <p className="text-sm text-muted-foreground">{p.brand ?? '—'} · {p.source}</p>
        </div>
        <div className="flex gap-2 items-center">
          <StatusBadge status={p.status} />
          <Link href={`/products/${p.id}/merge`}><Button variant="outline">Merge tool</Button></Link>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-3">
          <h2 className="font-medium">Edit</h2>
          <EditForm init={{ id: p.id, name: p.name, brand: p.brand, category: p.category, imageUrl: p.imageUrl }} />
        </section>
        <aside className="border rounded-lg p-3 text-sm">
          <h2 className="font-medium mb-2">Audit history</h2>
          <p className="text-muted-foreground">Recent audit-log entries for this product surface via /v1/admin/users/me/audit (deferred to v1.1). In M3 these are queryable via psql.</p>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/products/\[id\]/page.tsx apps/admin/src/app/\(admin\)/products/\[id\]/_edit-form.tsx
git commit -m "feat(admin): product detail + edit form"
```

---

### Task I6: `/products/pending` queue

**Files:**
- Modify: `apps/admin/src/app/(admin)/products/pending/page.tsx`
- Create: `apps/admin/src/app/(admin)/products/pending/_pending-table.tsx`

- [ ] **Step 1: Write the client island**

```tsx
// apps/admin/src/app/(admin)/products/pending/_pending-table.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { browserAdminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

type Row = Awaited<ReturnType<typeof browserAdminApi.products.pending>>['items'][number];

export function PendingTable() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'products', 'pending'], queryFn: () => browserAdminApi.products.pending() });
  const resolve = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => browserAdminApi.products.resolveEdit(id, decision),
    onSuccess: () => { toast.success('Resolved'); qc.invalidateQueries({ queryKey: ['admin', 'products', 'pending'] }); },
    onError: toast.error,
  });

  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'productId', header: 'Product' },
    { accessorKey: 'submittedBy', header: 'By' },
    { accessorKey: 'proposed', header: 'Proposed', cell: ({ row }) => <pre className="text-xs">{JSON.stringify(row.original.proposed)}</pre> },
    {
      id: 'actions', header: 'Actions', cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => resolve.mutate({ id: row.original.id, decision: 'approve' })}>Approve</Button>
          <Button size="sm" variant="destructive" onClick={() => resolve.mutate({ id: row.original.id, decision: 'reject' })}>Reject</Button>
        </div>
      ),
    },
  ];

  return <DataTable data={query.data?.items ?? []} columns={columns} />;
}
```

- [ ] **Step 2: Replace the page**

```tsx
// apps/admin/src/app/(admin)/products/pending/page.tsx
import { PendingTable } from './_pending-table';

export const dynamic = 'force-dynamic';

export default function PendingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pending product edits</h1>
      <PendingTable />
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/products/pending
git commit -m "feat(admin): pending product edits queue"
```

---

### Task I7: `/products/[id]/merge` tool

**Files:**
- Create: `apps/admin/src/app/(admin)/products/[id]/merge/page.tsx`
- Create: `apps/admin/src/app/(admin)/products/[id]/merge/_merge-tool.tsx`

- [ ] **Step 1: Write the client merge tool**

```tsx
// apps/admin/src/app/(admin)/products/[id]/merge/_merge-tool.tsx
'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { browserAdminApi } from '@/lib/admin-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/confirm-modal';
import { toast } from '@/lib/toast';

export function MergeTool({ winnerId }: { winnerId: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);

  const candidates = useQuery({
    queryKey: ['admin', 'products', 'merge-candidates', q],
    queryFn: () => browserAdminApi.products.list({ q: q || undefined }),
    enabled: q.length > 1,
  });

  const merge = useMutation({
    mutationFn: () => browserAdminApi.products.merge(winnerId, selected),
    onSuccess: (res) => { toast.success(`Merged ${res.movedRecords} records, ${res.movedReviews} reviews`); router.push(`/products/${winnerId}`); },
    onError: toast.error,
  });

  const items = (candidates.data?.items ?? []).filter((p) => p.id !== winnerId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Search duplicates and select losers to merge into this product.</p>
      <Input placeholder="Search candidates" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="space-y-1">
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-2 border rounded p-2">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))} />
            <span className="flex-1">{p.name} <span className="text-xs text-muted-foreground">{p.brand}</span></span>
            <span className="text-xs">{p.reviewCount} reviews</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button disabled={selected.length === 0} onClick={() => setConfirm(true)}>Merge {selected.length} into this product</Button>
      </div>
      <ConfirmModal
        open={confirm}
        title="Merge selected products?"
        description="This rewrites records, reviews, and marks losers as merged_into. Cannot be undone."
        destructive
        confirmLabel="Merge"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => { await merge.mutateAsync(); setConfirm(false); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// apps/admin/src/app/(admin)/products/[id]/merge/page.tsx
import { MergeTool } from './_merge-tool';

export const dynamic = 'force-dynamic';

export default async function MergePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Merge into product</h1>
      <MergeTool winnerId={id} />
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/products/\[id\]/merge
git commit -m "feat(admin): product merge tool"
```

---

## Phase J — Admin pages: reviews, reports, analytics, system, settings

### Task J1: `/reviews` filterable list

**Files:**
- Modify: `apps/admin/src/app/(admin)/reviews/page.tsx`
- Create: `apps/admin/src/app/(admin)/reviews/_reviews-table.tsx`

- [ ] **Step 1: Write the table island**

```tsx
// apps/admin/src/app/(admin)/reviews/_reviews-table.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import Link from 'next/link';
import { browserAdminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

type Row = Awaited<ReturnType<typeof browserAdminApi.reviews.list>>['items'][number];

export function ReviewsTable() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [productId, setProductId] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const query = useQuery({
    queryKey: ['admin', 'reviews', { status, rating, productId, cursor }],
    queryFn: () =>
      browserAdminApi.reviews.list({
        status: status || undefined,
        rating: rating || undefined,
        productId: productId || undefined,
        cursor,
      }),
  });
  const setStatusMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: 'visible' | 'hidden' | 'deleted' }) => browserAdminApi.reviews.setStatus(id, s),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }); },
    onError: toast.error,
  });

  const RATING_LABEL: Record<string, string> = {
    buy_again: 'Buy again', buy_again_on_sale: 'On sale only', wont_buy: "Won't buy",
  };
  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID', cell: ({ row }) => <Link className="underline" href={`/reviews/${row.original.id}`}>{row.original.id.slice(0, 8)}</Link> },
    { accessorKey: 'rating', header: 'Rating', cell: ({ row }) => RATING_LABEL[row.original.rating] ?? row.original.rating },
    { id: 'helpful', header: 'Helpful', cell: ({ row }) => `${row.original.helpfulCount} / ${row.original.notHelpfulCount}` },
    { accessorKey: 'comment', header: 'Comment', cell: ({ row }) => <span className="line-clamp-1 max-w-md">{row.original.comment ?? '—'}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'actions', header: 'Actions', cell: ({ row }) => (
        <Select value={row.original.status} onValueChange={(v) => setStatusMut.mutate({ id: row.original.id, s: v as 'visible' | 'hidden' | 'deleted' })}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['visible', 'hidden', 'deleted'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={status} onValueChange={(v) => { setCursor(undefined); setStatus(v === 'all' ? '' : v); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {['visible', 'hidden', 'deleted'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={rating} onValueChange={(v) => { setCursor(undefined); setRating(v === 'all' ? '' : v); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {['buy_again', 'buy_again_on_sale', 'wont_buy'].map((s) => <SelectItem key={s} value={s}>{RATING_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="max-w-xs" placeholder="Product ID" value={productId} onChange={(e) => { setCursor(undefined); setProductId(e.target.value); }} />
      </div>
      <DataTable
        data={query.data?.items ?? []}
        columns={columns}
        hasMore={!!query.data?.nextCursor}
        onLoadMore={() => query.data?.nextCursor && setCursor(query.data.nextCursor)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace the page**

```tsx
// apps/admin/src/app/(admin)/reviews/page.tsx
import { ReviewsTable } from './_reviews-table';

export const dynamic = 'force-dynamic';

export default function ReviewsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <ReviewsTable />
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/reviews
git commit -m "feat(admin): reviews list with inline status change"
```

---

### Task J2: `/reviews/[id]` detail with vote breakdown chart

**Files:**
- Modify: `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`

- [ ] **Step 1: Replace the stub**

```tsx
// apps/admin/src/app/(admin)/reviews/[id]/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { ChartBar } from '@/components/chart-bar';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Fetch the review by id (Task D2a). Reading the first page of the list and
  // searching it client-side made any review past page 1 unreachable.
  let r;
  try {
    r = await serverAdminApi.reviews.get(id);
  } catch {
    return <p>Review not found.</p>;
  }
  const chartData = [{ kind: 'helpful', value: r.helpfulCount }, { kind: 'notHelpful', value: r.notHelpfulCount }];
  const RATING_LABEL: Record<string, string> = { buy_again: 'Will buy again', buy_again_on_sale: 'On sale only', wont_buy: "Won't buy" };
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Review {r.id.slice(0, 8)}</h1>
        <StatusBadge status={r.status} />
      </header>
      <p className="text-sm">Rating: {RATING_LABEL[r.rating] ?? r.rating}</p>
      <blockquote className="border-l-4 pl-4 italic">{r.comment ?? <em>No comment.</em>}</blockquote>
      <section>
        <h2 className="font-medium mb-2">Votes</h2>
        <ChartBar data={chartData} x="kind" y="value" height={200} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/reviews/\[id\]/page.tsx
git commit -m "feat(admin): review detail page with vote chart"
```

---

### Task J3: `/reports` queue with polling + bulk actions

**Files:**
- Modify: `apps/admin/src/app/(admin)/reports/page.tsx`
- Create: `apps/admin/src/app/(admin)/reports/_reports-table.tsx`

- [ ] **Step 1: Write the table island (polls every 10s; uses bulk-selection hook)**

```tsx
// apps/admin/src/app/(admin)/reports/_reports-table.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import Link from 'next/link';
import { browserAdminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/data-table';
import { useBulkSelection } from '@/lib/use-bulk-selection';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmModal } from '@/components/confirm-modal';
import { toast } from '@/lib/toast';

type Row = Awaited<ReturnType<typeof browserAdminApi.reports.list>>['items'][number];

export function ReportsTable() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'reports', 'open'],
    queryFn: () => browserAdminApi.reports.list({ status: 'open' }),
    refetchInterval: 10_000,
  });
  const items = query.data?.items ?? [];
  const sel = useBulkSelection(items, (i) => i.id);
  const [pending, setPending] = useState<null | 'hide' | 'delete' | 'dismiss' | 'ban'>(null);

  const resolveMut = useMutation({
    mutationFn: async (action: 'hide' | 'delete' | 'dismiss' | 'ban') => {
      for (const id of sel.selectedIds) await browserAdminApi.reports.resolve(id, action);
      return sel.selectedIds.length;
    },
    onSuccess: (n, action) => { toast.success(`Resolved ${n} (${action})`); sel.clear(); qc.invalidateQueries({ queryKey: ['admin', 'reports'] }); },
    onError: toast.error,
  });

  const columns: ColumnDef<Row>[] = [
    {
      id: 'select', header: () => <input type="checkbox" onChange={(e) => e.target.checked ? sel.selectAll() : sel.clear()} />,
      cell: ({ row }) => <input type="checkbox" checked={sel.isSelected(row.original.id)} onChange={() => sel.toggle(row.original.id)} />,
    },
    { accessorKey: 'targetType', header: 'Target' },
    { accessorKey: 'reason', header: 'Reason' },
    { id: 'preview', header: 'Preview', cell: ({ row }) => <pre className="text-xs line-clamp-2">{JSON.stringify(row.original.targetPreview)}</pre> },
    { id: 'age', header: 'Age', cell: ({ row }) => `${Math.round((Date.now() - new Date(row.original.createdAt).getTime()) / 60_000)}m` },
    { id: 'detail', header: '', cell: ({ row }) => <Link className="underline text-sm" href={`/reports/${row.original.id}`}>Open</Link> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">{sel.count} selected</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button disabled={sel.count === 0}>Bulk action</Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            {(['hide', 'delete', 'dismiss', 'ban'] as const).map((a) => (
              <DropdownMenuItem key={a} onClick={() => setPending(a)}>{a}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <DataTable data={items} columns={columns} />
      <ConfirmModal
        open={pending !== null}
        title={`Apply "${pending}" to ${sel.count} reports?`}
        destructive={pending === 'delete' || pending === 'ban'}
        onCancel={() => setPending(null)}
        onConfirm={async () => { if (pending) await resolveMut.mutateAsync(pending); setPending(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace the page**

```tsx
// apps/admin/src/app/(admin)/reports/page.tsx
import { ReportsTable } from './_reports-table';

export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reports queue</h1>
      <ReportsTable />
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/reports
git commit -m "feat(admin): reports queue with polling + bulk actions"
```

---

### Task J4: `/reports/[id]` detail with one-click actions

**Files:**
- Modify: `apps/admin/src/app/(admin)/reports/[id]/page.tsx`
- Create: `apps/admin/src/app/(admin)/reports/[id]/_actions.tsx`

- [ ] **Step 1: Write the actions island**

```tsx
// apps/admin/src/app/(admin)/reports/[id]/_actions.tsx
'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { browserAdminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/confirm-modal';
import { toast } from '@/lib/toast';

export function ReportActions({ reportId }: { reportId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState<null | 'hide' | 'delete' | 'dismiss' | 'ban'>(null);
  const mut = useMutation({
    mutationFn: (a: 'hide' | 'delete' | 'dismiss' | 'ban') => browserAdminApi.reports.resolve(reportId, a),
    onSuccess: () => { toast.success('Resolved'); qc.invalidateQueries({ queryKey: ['admin', 'reports'] }); router.push('/reports'); },
    onError: toast.error,
  });
  return (
    <div className="flex gap-2">
      {(['hide', 'delete', 'dismiss', 'ban'] as const).map((a) => (
        <Button key={a} variant={a === 'delete' || a === 'ban' ? 'destructive' : 'default'} onClick={() => setPending(a)}>{a}</Button>
      ))}
      <ConfirmModal
        open={pending !== null}
        title={`Apply "${pending}" to this report?`}
        destructive={pending === 'delete' || pending === 'ban'}
        onCancel={() => setPending(null)}
        onConfirm={async () => { if (pending) await mut.mutateAsync(pending); setPending(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace the page**

```tsx
// apps/admin/src/app/(admin)/reports/[id]/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { ReportActions } from './_actions';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await serverAdminApi.reports.list({ status: 'open' });
  const r = list.items.find((x) => x.id === id);
  if (!r) return <p>Report not found or already resolved.</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Report {r.id.slice(0, 8)}</h1>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Target</dt><dd>{r.targetType} / {r.targetId}</dd>
        <dt className="text-muted-foreground">Reason</dt><dd>{r.reason}</dd>
        <dt className="text-muted-foreground">Reporter</dt><dd>{r.reporterId}</dd>
        <dt className="text-muted-foreground">Body</dt><dd>{r.body ?? '—'}</dd>
      </dl>
      <pre className="text-xs p-3 border rounded bg-muted">{JSON.stringify(r.targetPreview, null, 2)}</pre>
      <ReportActions reportId={r.id} />
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/reports/\[id\]
git commit -m "feat(admin): report detail page with one-click actions"
```

---

### Task J5: Analytics pages (overview, scans, reviews, geography)

**Files:**
- Modify: `apps/admin/src/app/(admin)/analytics/overview/page.tsx`
- Modify: `apps/admin/src/app/(admin)/analytics/scans/page.tsx`
- Modify: `apps/admin/src/app/(admin)/analytics/reviews/page.tsx`
- Modify: `apps/admin/src/app/(admin)/analytics/geography/page.tsx`

- [ ] **Step 1: Overview page**

```tsx
// apps/admin/src/app/(admin)/analytics/overview/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';

export const dynamic = 'force-dynamic';

export default async function AnalyticsOverviewPage() {
  const o = await serverAdminApi.analytics.overview();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Analytics — Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Users" value={o.totalUsers} />
        <KpiCard label="Active 7d" value={o.activeUsers7d} />
        <KpiCard label="Active 30d" value={o.activeUsers30d} />
        <KpiCard label="Records" value={o.totalRecords} />
        <KpiCard label="Reviews" value={o.totalReviews} />
        <KpiCard label="Scans 7d" value={o.scans7d} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Scans page**

```tsx
// apps/admin/src/app/(admin)/analytics/scans/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { ChartLine } from '@/components/chart-line';
import { ChartBar } from '@/components/chart-bar';

export const dynamic = 'force-dynamic';

export default async function ScansPage() {
  const s = await serverAdminApi.analytics.scans('30d');
  const bySource = Object.entries(s.bySource).map(([source, count]) => ({ source, count }));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Scans (30d)</h1>
      <ChartLine data={s.daily} x="date" y="count" />
      <ChartBar data={bySource} x="source" y="count" height={220} />
    </div>
  );
}
```

- [ ] **Step 3: Reviews page**

```tsx
// apps/admin/src/app/(admin)/analytics/reviews/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { ChartLine } from '@/components/chart-line';
import { KpiCard } from '@/components/kpi-card';

export const dynamic = 'force-dynamic';

export default async function ReviewsAnalyticsPage() {
  const r = await serverAdminApi.analytics.reviews('30d');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reviews (30d)</h1>
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Auto-flagged rate" value={`${(r.autoFlaggedRate * 100).toFixed(1)}%`} />
        <KpiCard label="Buy again" value={`${r.buyAgainPct}%`} />
        <KpiCard label="On sale only" value={`${r.buyAgainOnSalePct}%`} />
        <KpiCard label="Won't buy" value={`${r.wontBuyPct}%`} />
      </div>
      <ChartLine data={r.daily} x="date" y="count" />
    </div>
  );
}
```

- [ ] **Step 4: Geography page**

```tsx
// apps/admin/src/app/(admin)/analytics/geography/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { ChartBar } from '@/components/chart-bar';

export const dynamic = 'force-dynamic';

export default async function GeographyPage() {
  const g = await serverAdminApi.analytics.geography();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Geography</h1>
      <ChartBar data={g.top} x="country" y="users" height={320} />
    </div>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/analytics
git commit -m "feat(admin): analytics pages (overview, scans, reviews, geography)"
```

---

### Task J6: System pages (queue, push, api-errors, external-apis)

**Files:**
- Modify: `apps/admin/src/app/(admin)/system/queue/page.tsx`
- Modify: `apps/admin/src/app/(admin)/system/push/page.tsx`
- Modify: `apps/admin/src/app/(admin)/system/api-errors/page.tsx`
- Modify: `apps/admin/src/app/(admin)/system/external-apis/page.tsx`

- [ ] **Step 1: Queue page (embeds bull-board iframe + summary)**

```tsx
// apps/admin/src/app/(admin)/system/queue/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  const h = await serverAdminApi.system.queueHealth();
  // API base URL is exposed by M0d as NEXT_PUBLIC_API_BASE_URL.
  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Queue health</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {h.queues.map((q) => (
          <KpiCard key={q.name} label={q.name} value={q.waiting + q.active} sub={`waiting ${q.waiting} · active ${q.active} · failed ${q.failed}`} />
        ))}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <iframe src={`${api}/v1/admin/bullboard`} className="w-full" style={{ height: 720 }} title="bull-board" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Push logs page**

```tsx
// apps/admin/src/app/(admin)/system/push/page.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { browserAdminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/data-table';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';

type Row = Awaited<ReturnType<typeof browserAdminApi.system.pushLogs>>['items'][number];

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'createdAt', header: 'When', cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  { accessorKey: 'userId', header: 'User' },
  { accessorKey: 'templateKey', header: 'Template' },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status === 'sent' ? 'active' : 'deleted'} /> },
  { accessorKey: 'errorMessage', header: 'Error' },
];

export default function PushPage() {
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const query = useQuery({
    queryKey: ['admin', 'push-logs', { userId, status, cursor }],
    queryFn: () => browserAdminApi.system.pushLogs({ user_id: userId || undefined, status: status || undefined, cursor }),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Push logs</h1>
      <div className="flex gap-2">
        <Input placeholder="User ID" value={userId} onChange={(e) => { setCursor(undefined); setUserId(e.target.value); }} className="max-w-xs" />
        <Input placeholder="status (sent|failed)" value={status} onChange={(e) => { setCursor(undefined); setStatus(e.target.value); }} className="max-w-xs" />
      </div>
      <DataTable
        data={query.data?.items ?? []}
        columns={columns}
        hasMore={!!query.data?.nextCursor}
        onLoadMore={() => query.data?.nextCursor && setCursor(query.data.nextCursor)}
      />
    </div>
  );
}
```

- [ ] **Step 3: API errors page**

```tsx
// apps/admin/src/app/(admin)/system/api-errors/page.tsx
import { serverAdminApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function ApiErrorsPage() {
  const e = await serverAdminApi.system.apiErrors('24h');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">API errors (24h)</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th>Route</th><th>Method</th><th>Status</th><th>Count</th></tr></thead>
        <tbody>
          {e.rows.map((r, i) => (
            <tr key={i} className="border-t"><td>{r.route}</td><td>{r.method}</td><td>{r.status}</td><td>{r.count}</td></tr>
          ))}
          {e.rows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No errors in window.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: External APIs page**

```tsx
// apps/admin/src/app/(admin)/system/external-apis/page.tsx
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ExternalApisPage() {
  const e = await serverAdminApi.system.externalApis();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">External APIs</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {e.breakers.map((b) => (
          <div key={b.name} className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between items-center"><strong>{b.name}</strong><StatusBadge status={b.state === 'closed' ? 'active' : b.state === 'open' ? 'deleted' : 'pending'} /></div>
            <KpiCard label="fires" value={b.fires} />
            <p className="text-xs text-muted-foreground">failures {b.failures} · successes {b.successes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/system
git commit -m "feat(admin): system pages (queue, push, api-errors, external-apis)"
```

---

### Task J7: Settings pages (feature flags, moderation, notification templates, admins)

**Files:**
- Modify: `apps/admin/src/app/(admin)/settings/feature-flags/page.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/moderation/page.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/notification-templates/page.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/admins/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/admins/_invite-modal.tsx`

- [ ] **Step 1: Feature flags page**

```tsx
// apps/admin/src/app/(admin)/settings/feature-flags/page.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { browserAdminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';

export default function FeatureFlagsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'settings', 'feature-flags'], queryFn: browserAdminApi.settings.featureFlags.get });
  const [form, setForm] = useState({ reviewsEnabled: true, passkeysEnabled: true, ocrEnabled: true });
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const mut = useMutation({
    mutationFn: () => browserAdminApi.settings.featureFlags.put(form),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['admin', 'settings', 'feature-flags'] }); },
    onError: toast.error,
  });
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-semibold">Feature flags</h1>
      {(['reviewsEnabled', 'passkeysEnabled', 'ocrEnabled'] as const).map((k) => (
        <label key={k} className="flex justify-between items-center border rounded p-3">
          <span>{k}</span>
          <Switch checked={form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
        </label>
      ))}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
    </div>
  );
}
```

- [ ] **Step 2: Moderation settings page**

```tsx
// apps/admin/src/app/(admin)/settings/moderation/page.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { browserAdminApi } from '@/lib/admin-api';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';

export default function ModerationPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'settings', 'moderation'], queryFn: browserAdminApi.settings.moderation.get });
  const [form, setForm] = useState({ autoHideReportThreshold: 3, profanitySensitivity: 'medium' as 'low' | 'medium' | 'high' });
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const mut = useMutation({
    mutationFn: () => browserAdminApi.settings.moderation.put(form),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['admin', 'settings', 'moderation'] }); },
    onError: toast.error,
  });
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-semibold">Moderation</h1>
      <label className="block space-y-1">
        <span className="text-sm">Auto-hide threshold</span>
        <Input type="number" value={form.autoHideReportThreshold} onChange={(e) => setForm({ ...form, autoHideReportThreshold: parseInt(e.target.value, 10) || 0 })} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm">Profanity sensitivity</span>
        <Select value={form.profanitySensitivity} onValueChange={(v) => setForm({ ...form, profanitySensitivity: v as 'low' | 'medium' | 'high' })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{['low', 'medium', 'high'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
    </div>
  );
}
```

- [ ] **Step 3: Notification templates page**

```tsx
// apps/admin/src/app/(admin)/settings/notification-templates/page.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { browserAdminApi } from '@/lib/admin-api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { useState } from 'react';

export default function NotificationTemplatesPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'settings', 'notification-templates'], queryFn: browserAdminApi.settings.notificationTemplates.list });
  const [edits, setEdits] = useState<Record<string, { title?: string; body?: string; enabled?: boolean }>>({});
  const mut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => browserAdminApi.settings.notificationTemplates.patch(id, body),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['admin', 'settings', 'notification-templates'] }); },
    onError: toast.error,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notification templates</h1>
      {(query.data ?? []).map((t) => {
        const e = edits[t.id] ?? {};
        return (
          <div key={t.id} className="border rounded p-4 space-y-2 max-w-2xl">
            <div className="flex items-center justify-between">
              <strong>{t.key}</strong>
              <Switch checked={e.enabled ?? t.enabled} onCheckedChange={(v) => setEdits({ ...edits, [t.id]: { ...e, enabled: v } })} />
            </div>
            <Input value={e.title ?? t.title} onChange={(ev) => setEdits({ ...edits, [t.id]: { ...e, title: ev.target.value } })} />
            <Textarea value={e.body ?? t.body} onChange={(ev) => setEdits({ ...edits, [t.id]: { ...e, body: ev.target.value } })} />
            <Button onClick={() => mut.mutate({ id: t.id, body: e })} disabled={mut.isPending || Object.keys(e).length === 0}>Save</Button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Admins page + invite modal**

```tsx
// apps/admin/src/app/(admin)/settings/admins/_invite-modal.tsx
'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { browserAdminApi } from '@/lib/admin-api';
import { toast } from '@/lib/toast';

export function InviteModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => browserAdminApi.settings.admins.invite(form),
    onSuccess: () => { toast.success('Invite sent'); setOpen(false); qc.invalidateQueries({ queryKey: ['admin', 'settings', 'admins'] }); },
    onError: toast.error,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Invite admin</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite a new admin</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.email}>Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// apps/admin/src/app/(admin)/settings/admins/page.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { browserAdminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/confirm-modal';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { InviteModal } from './_invite-modal';

export default function AdminsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'settings', 'admins'], queryFn: browserAdminApi.settings.admins.list });
  const [revoking, setRevoking] = useState<string | null>(null);
  const revokeMut = useMutation({
    mutationFn: (id: string) => browserAdminApi.settings.admins.revoke(id),
    onSuccess: () => { toast.success('Revoked'); qc.invalidateQueries({ queryKey: ['admin', 'settings', 'admins'] }); },
    onError: toast.error,
  });
  return (
    <div className="space-y-4">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Admins</h1>
        <InviteModal />
      </header>
      <ul className="space-y-2">
        {(query.data ?? []).map((u) => (
          <li key={u.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{u.firstName} {u.lastName}</div>
              <div className="text-sm text-muted-foreground">{u.email}</div>
            </div>
            <Button variant="destructive" onClick={() => setRevoking(u.id)}>Revoke</Button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        open={revoking !== null}
        title="Revoke admin role?"
        description="The user retains their account but loses admin access immediately."
        destructive
        confirmLabel="Revoke"
        onCancel={() => setRevoking(null)}
        onConfirm={async () => { if (revoking) await revokeMut.mutateAsync(revoking); setRevoking(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
pnpm --filter @expyrico/admin build
git add apps/admin/src/app/\(admin\)/settings
git commit -m "feat(admin): settings pages (flags, moderation, templates, admins)"
```

---

## Phase K — Playwright E2E tests

> Each spec assumes the admin app is reachable at `http://localhost:4001` and the API at `http://localhost:4000`, both with a seeded admin user (`admin@example.com` / `correct-horse-battery-staple` plus a known TOTP secret). M0d should have set up the Playwright config and the shared `loginAsAdmin(page)` helper. If not, add a `apps/admin/e2e/_helpers.ts` file with the helper inline.

### Task K1: E2E — moderate a report

**Files:**
- Create: `apps/admin/e2e/moderate-report.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// apps/admin/e2e/moderate-report.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin, seedOpenReport } from './_helpers';

test('moderator can hide a reported review', async ({ page, request }) => {
  const reportId = await seedOpenReport(request);
  await loginAsAdmin(page);
  await page.goto('/reports');
  await expect(page.getByText(reportId.slice(0, 8))).toBeVisible();
  await page.getByRole('link', { name: 'Open' }).first().click();
  await page.getByRole('button', { name: 'hide' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page).toHaveURL('/reports');
  await expect(page.getByText(reportId.slice(0, 8))).not.toBeVisible();
});
```

- [ ] **Step 2: Add `seedOpenReport` to `apps/admin/e2e/_helpers.ts`**

```ts
// apps/admin/e2e/_helpers.ts (append)
import type { APIRequestContext } from '@playwright/test';

export async function seedOpenReport(request: APIRequestContext): Promise<string> {
  // Calls a dev-only helper route added in M0d (POST /v1/dev/seed-report) that
  // creates a reporter, an offender, a product, a review, and an open report,
  // then returns { reportId }. If that endpoint does not exist, add it under
  // a NODE_ENV !== 'production' guard.
  const res = await request.post('/v1/dev/seed-report');
  const body = await res.json();
  return body.reportId;
}
```

- [ ] **Step 3: Run**

```bash
pnpm --filter @expyrico/admin exec playwright test moderate-report.spec.ts
```
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/e2e/moderate-report.spec.ts apps/admin/e2e/_helpers.ts
git commit -m "test(admin): e2e moderate-report flow"
```

---

### Task K2: E2E — merge product

**Files:**
- Create: `apps/admin/e2e/merge-product.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// apps/admin/e2e/merge-product.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './_helpers';

test('admin merges two duplicate products', async ({ page, request }) => {
  await loginAsAdmin(page);
  // Seed two dupes via dev helper.
  const seed = await request.post('/v1/dev/seed-duplicate-products');
  const { winnerId, loserId } = await seed.json();

  await page.goto(`/products/${winnerId}/merge`);
  await page.getByPlaceholder('Search candidates').fill('Dup');
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('button', { name: /Merge .* into this product/ }).click();
  await page.getByRole('button', { name: 'Merge' }).click();

  await expect(page).toHaveURL(new RegExp(`/products/${winnerId}$`));
  // Verify loser is marked merged_into via API
  const list = await request.get('/v1/admin/products?q=Dup&status=merged_into');
  const body = await list.json();
  expect(body.items.some((p: { id: string }) => p.id === loserId)).toBe(true);
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter @expyrico/admin exec playwright test merge-product.spec.ts
git add apps/admin/e2e/merge-product.spec.ts
git commit -m "test(admin): e2e merge-product flow"
```

---

### Task K3: E2E — suspend a user

**Files:**
- Create: `apps/admin/e2e/suspend-user.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// apps/admin/e2e/suspend-user.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './_helpers';

test('admin suspends a user, who can no longer sign in', async ({ page, request }) => {
  await loginAsAdmin(page);
  const seed = await request.post('/v1/dev/seed-user', { data: { email: 'victim@example.com', password: 'correct-horse-battery-staple' } });
  const { userId } = await seed.json();

  await page.goto('/users');
  await page.getByPlaceholder('Search email / name').fill('victim');
  await page.getByRole('link', { name: 'victim@example.com' }).click();

  // The status dropdown is the first Select on the actions panel.
  await page.locator('button[role="combobox"]').first().click();
  await page.getByRole('option', { name: 'suspended' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  // Attempt to sign in as the suspended user via the API; should 401.
  const login = await request.post('/v1/auth/login', { data: { email: 'victim@example.com', password: 'correct-horse-battery-staple' } });
  expect(login.status()).toBe(401);
  expect(userId).toBeTruthy();
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter @expyrico/admin exec playwright test suspend-user.spec.ts
git add apps/admin/e2e/suspend-user.spec.ts
git commit -m "test(admin): e2e suspend-user flow"
```

---

## Phase Z — Final verification

### Task Z1: Run full API test suite

- [ ] **Step 1: Generate Prisma client**

```bash
pnpm --filter @expyrico/api exec prisma generate
```

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @expyrico/api test
```
Expected: every file under `api/tests/integration/admin/` passes plus all M0a/M0b/M1/M2 tests still green.

- [ ] **Step 3: Typecheck the whole repo**

```bash
pnpm typecheck
```
Expected: exit 0 across all workspace packages.

- [ ] **Step 4: Build the admin app**

```bash
pnpm --filter @expyrico/admin build
```
Expected: exit 0.

- [ ] **Step 5: Run Playwright suite**

```bash
pnpm --filter @expyrico/admin exec playwright test
```
Expected: all 3 specs from Phase K pass.

- [ ] **Step 6: Prettier**

```bash
pnpm exec prettier --check .
```
Expected: exit 0. If not, `pnpm exec prettier --write .` and re-check.

- [ ] **Step 7: Tag**

```bash
git tag m3-complete
```

---

## Self-review checklist (run before declaring M3 done)

- [ ] Every endpoint in spec §6.7 has a route file + integration test.
- [ ] Every page listed in spec §8.3 has a server or client component that calls the admin API client (`serverAdminApi` in Server Components, `browserAdminApi` in `'use client'` islands). No page imports a non-existent `adminApi`.
- [ ] Detail pages fetch by id: `/products/[id]` calls `serverAdminApi.products.get(id)` and `/reviews/[id]` calls `serverAdminApi.reviews.get(id)` — neither relies on searching the list.
- [ ] Every mutation route calls `req.auditLog(...)` and the corresponding test asserts a row in `admin_audit_log` with correct `action`, `targetType`, `targetId`, and `diff`. (The two by-id GET routes, C3a and D2a, are reads and are intentionally not audit-logged.)
- [ ] No route ever bypasses the `admin-only` plugin.
- [ ] Every admin-side fetch goes through `serverAdminApi` / `browserAdminApi`, which always parse with a Zod schema from `@expyrico/shared`.
- [ ] No `console.log` in `api/src/**` or `apps/admin/src/**`.
- [ ] Cursor pagination behaves correctly: `nextCursor === null` only when no more rows.
- [ ] The merge tool preserves vote counts on moved reviews (Task C4 test).
- [ ] Three-option ratings are consistent: admin review schemas/routes/pages expose `rating` (`buy_again`/`buy_again_on_sale`/`wont_buy`) + `comment` + `helpfulCount`/`notHelpfulCount` (no taste/value, no up/down votes); product schemas/routes/pages expose the tallies `buyAgainCount`/`buyAgainOnSaleCount`/`wontBuyCount`/`ratingCount` + `reviewCount` + `isCommunityEligible`; the merge recalc writes those tallies; analytics reviews returns `buyAgainPct`/`buyAgainOnSalePct`/`wontBuyPct`/`ratingCount`. All review fixtures in admin tests set `rating`.
- [ ] The reports queue auto-refreshes every 10s (Task J3 — `refetchInterval: 10_000`).
- [ ] bull-board is reachable at `/v1/admin/bullboard` only with admin auth (Task F7 smoke = 401 unauth).

---

## Spec coverage matrix

| Spec item | Plan task |
|---|---|
| §6.7 `GET /admin/users` | B2 |
| §6.7 `GET /admin/users/:id` | B3 |
| §6.7 `PATCH /admin/users/:id` | B4 |
| §6.7 `POST /admin/users/:id/sessions/revoke-all` | B5 |
| §6.7 `POST /admin/users/:id/impersonate` | B6 |
| §6.7 `GET /admin/products` | C2 |
| `GET /admin/products/:id` (by-id detail fetch) | C3a |
| §6.7 `PATCH /admin/products/:id` | C3 |
| §6.7 `POST /admin/products/:id/merge` | C4 |
| §6.7 pending edits | C5 |
| §6.7 `GET /admin/reviews` (filter by `rating`) | D2 |
| `GET /admin/reviews/:id` (by-id detail fetch, rating + comment + helpful counts) | D2a |
| §6.7 `PATCH /admin/reviews/:id/status` | D3 |
| §6.7 `GET /admin/reports?status=open` | D4 |
| §6.7 `PATCH /admin/reports/:id/resolve` | D5 |
| §6.7 analytics overview / scans / reviews / geography | E3 |
| §6.7 queue-health / push-logs / api-errors / external-apis | F3–F6 |
| §6.7 bull-board mount | F7 |
| §6.7 settings: feature-flags / moderation | G3 |
| §6.7 settings: notification-templates | G4 |
| §6.7 settings: admins (list/invite/revoke) | G5 |
| §8.2 admin-only gate via TOTP cookie session | A5 (plugin), depends on M0d login |
| §8.2 audit-log every mutation | A6 + every mutation task |
| §8.3 overview / users / products / reviews / reports / analytics / system / settings pages | I1–I7, J1–J7 |
| §8.4 reports queue polling every 10s | J3 |
| §8.4 product merge tool | I7 |
| §8.4 user detail + sessions + impersonate | I3 |
| §8.4 bull-board embed | J6 |
| §8.4 bulk actions | H5 + J3 |
| §5 `admin_audit_log` | M0a — referenced and exercised |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-m3-admin-dashboard.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in this session with checkpoints. Use `superpowers:executing-plans`.

Which approach?

