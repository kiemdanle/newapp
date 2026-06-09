# M5 — Deal Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the deal-sharing vertical: a deal = "found this cheap at X" — a post that links to a catalog product and carries a price + store + optional photo/expiry/note, surfaced in a browsable, votable feed with reporting. Users post deals, browse them sorted by helpfulness (Wilson) or recency, up/down-vote others' deals, and report bad ones. `>3` reports auto-hide a deal. Vote counts + Wilson score are recomputed SYNCHRONOUSLY in the same transaction as the vote write (indexed sub-ms aggregate at this scale — no background worker). This milestone replicates the M2 voting/reporting pattern with its OWN `deal_votes` table — it does NOT generalize M2's tables.

**Architecture:** Two new Postgres tables (`deals`, `deal_votes`) via Prisma migration, plus a `deal` value added to the existing `reports.target_type` enum (added in its OWN migration — see Task A2). Fastify routes under `/v1/deals` (feed, CRUD, vote). One pure-reuse service (M2's `wilson.ts`) and one new repository (`deals/repository.ts` with `toApiDeal` + a deal auto-hide branch wired into M2's `maybeAutoHide`). The vote upsert/delete handler recomputes the deal's `upvote_count`, `downvote_count`, and Wilson `score` INLINE in the same transaction — no `deal-score-recalc` queue or worker, and no edit to M1's runner/`getAllQueues()`. Per-route rate limits tighten `POST /v1/deals` and the vote routes beyond the global limiter. `photoUrl` is host-restricted (own CDN) — never a free server-side-fetched URL — to close SSRF; `storeName`/`note` are escaped wherever the admin preview renders them. Mobile: a Deals feed screen, deal detail, post-deal form (reusing M1 product search/scan), inline optimistic vote, report action — all ONLINE-ONLY via TanStack Query (server is source of truth; deals are NOT in the WatermelonDB offline write queue). Admin: a deals moderation page (list + hide/delete, audit-logged) and rendering of `deal`-type reports in the existing M3 report queue.

**Tech Stack:** Fastify 4, Prisma 5, Postgres 16, Redis 7, BullMQ 5, Zod 3, Vitest 2 + Supertest 7 (API, real test Postgres), Expo SDK + Expo Router + Zustand + TanStack Query 5 + NativeWind (mobile), React Native Testing Library 12 (component tests), Maestro (E2E), Next.js 15 + Playwright (admin).

**Spec reference:** `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` §2.12 (deal sharing), §2.7 (voting), §2.8 (reporting/auto-hide), §13 M5. Read before starting.

**Prerequisites (all complete & merged):** Per the backend-first execution order, prereqs split by track. Track A (backend phases A, B, D + admin phase G) does NOT depend on M0c — they touch only `api/`, `packages/shared`, and `apps/admin/`. M0c is required only when Track B (mobile phase F) begins.

**Track A (backend + admin, build now) prerequisites:**

- **M0a/M0b** — shared package, error/AppError, config, db/redis singletons, error-handler, auth plugin (`req.user`, `app.requireAuth`, `app.requireAdmin`), users repository (`toApiUser`), `issueAccessToken(payload)`→JWT string, push tokens, idempotency plugin (`api/src/plugins/idempotency.ts`, route opt-in `config.idempotent`, Redis 24h), test harness (`tests/helpers/setup.ts`, `tests/helpers/factories.ts`).
- **M1** backend phases — `products` table + `GET /v1/products/:id` + `products/search` + product scan; BullMQ wiring (`api/src/queues/` with `getQueueConnection()`→raw `ConnectionOptions` and a `getAllQueues()` registry; central worker runner `api/src/workers/runner.ts` exporting `startWorkers()`/`stopWorkers()`); circuit breakers; multipart photo upload pattern from `POST /v1/me/avatar` (M0b).
- **M2** backend phases — voting pattern (`review_votes` + Wilson `score` denormalized + debounced `score-recalc` worker via Redis sentinel keys), `reports` table + `reportTargetTypeSchema`/`ReportTargetType` Prisma enum, generic admin report queue, and the `maybeAutoHide(targetType, targetId)` helper (`api/src/services/reports/repository.ts`) with the spec literal `> 3` threshold. M5 extends `maybeAutoHide` with a `deal` branch and adds `deal` to the enum.
- **M3** — admin app (Next.js) + pages pattern, `serverAdminApi`/`browserAdminApi`, `writeAuditLog({adminId,action,targetType,targetId,diff?,requestId?,ip?})`, CSRF, bull-board, and the generic report-queue UI that M5 extends to render deal previews.

**Track B (mobile, deferred) — additional prerequisite:**

- **M0c** — mobile shell: auth-gated `(app)` group + bottom tabs, theme provider (`useTheme()` tokens), API client `apps/mobile/src/api/client.ts` (bearer + single-flight 401 refresh + typed RFC7807 errors, `.get/.post/.patch/.delete`), TanStack Query provider, `useSessionStore`, `newIdempotencyKey()` helper (`apps/mobile/src/lib/idempotency.ts`).

**Out of scope for M5 (deliberately deferred):**

- Geolocation, maps, price history charts — deferred per spec.
- Deals in the offline write queue — deals are online-only TanStack Query (WatermelonDB is records-only).
- In-app messaging.
- Deal-driven points/badges — points are referral-only in M7.
- Configurable auto-hide threshold — stays the spec literal `> 3` from M2.

---

## Execution order — backend-first (2026-05-26)

The project is re-sequenced **BACKEND + ADMIN first, then MOBILE**. The phases below are NOT renumbered or reordered; this header only groups them into two execution tracks.

**Track A — Backend + Admin (build now):**

- **Phase A — Data model** (Prisma schema, migrations, test harness/factories, `@expyrico/shared` Zod schemas)
- **Phase B — Deal repository + auto-hide branch** (`api/` services + reports auto-hide)
- **Phase D — Deals HTTP routes** (`api/` Fastify routes + integration tests)
- **Phase G — Admin moderation** (`apps/admin/` deals moderation page + deal-type reports in the queue)

The admin-moderation phase (Phase G) stays in Track A — the admin web is built in the backend-first track. Only the end-user mobile screens defer.

**Track B — Mobile (DEFERRED):**

- **Phase F — Mobile** (`apps/mobile/` deals feed, detail, post-deal form, inline vote, report action)

**Rule:** Do NOT implement Track B phases until the entire Backend + Admin track is complete and the Mobile track begins.

*(Phase H — Final verification runs last, after whichever track is in progress completes.)*

---

## Red Team Review — 2026-05-26

The following fixes were applied after a red-team pass. In plain language:

1. **Synchronous score recompute (no background worker).** Vote counts and the Wilson score are now recomputed inline, inside the same transaction as the vote write. At 10k users on a single VPS an indexed aggregate over `deal_votes` is sub-millisecond, so a debounced queue/worker added complexity (and a cross-milestone runner edit) for no benefit. The `deal-score-recalc` queue, its job module, its runner registration, its `getAllQueues()` entry, and both its tests (debounce unit + worker integration) are REMOVED. Scoring correctness is now covered directly by the vote integration test.

2. **Enum value added in its own migration.** Postgres forbids using a freshly added enum label in the same transaction/migration that adds it. Adding `deal` to `report_target_type` is therefore split into its OWN migration, applied before any migration/code references the `deal` value.

3. **Per-route rate limits.** Beyond the global limiter (60/min/user, 30/min/IP), `POST /v1/deals` is capped at 10/min/user and the vote routes at 30/min/user, with tests asserting the limiter triggers (429) past the cap.

4. **photoUrl SSRF + storeName/note stored-XSS hardening.** `photoUrl` is no longer a free `z.string().url()`: it must be an own-CDN host (allowlist) — the client uploads via the M0b avatar-style multipart endpoint and submits the resulting CDN URL; the server never fetches an arbitrary user-supplied URL. The admin preview escapes `storeName`/`note` (rendered as text, never raw HTML).

5. **Cleanups.** (a) Currency is now an explicit optional request field defaulting to `'USD'` when absent — the lossy country→currency *derivation* is dropped. (Note: `users.country` itself IS available — it is set from IP at signup per spec §2.9 — only the lossy mapping of country to a currency was removed.) (b) Thin CRUD-only API test files are merged; dedicated test files are kept only for logic-bearing paths (vote math, auto-hide, ownership).

---

## Validation amendments — 2026-05-26

**Country-scoped deals feed.** A deal is "cheap at X store" — its relevance is country-level. The deals feed is therefore scoped to the viewer's country, reusing the EXISTING `users.country` (ISO-3166 alpha-2, derived from IP at signup per spec §2.9 — it IS available in v1).

- `deals` gains a `country char(2)` (nullable) column, stamped at create time from the poster's `users.country` (null if the poster has no country yet).
- `GET /v1/deals` filters to `deals.country = <viewer's users.country>`. **No-country fallback (global fallback):** a viewer whose `users.country` is null (or unauthenticated) is NOT country-filtered — they receive the global feed across all countries rather than an empty list (better discovery than an empty feed for the rare null case). Existing `sort=score|new` + cursor pagination are unchanged.
- **Null-country deals are globally visible.** A deal whose own `country` is null (poster had no country at create time) appears for every viewer regardless of the viewer's country, mirroring the M6 giveaway null-country rule. The country filter therefore matches `deals.country = <viewer.country> OR deals.country IS NULL`.
- A new feed index serves `(country, status, score desc, created_at desc)`.
- The deal API shape exposes `country` (nullable). Tests assert a deal posted in country A is absent from country B's feed, that a viewer without a country gets the global fallback, and that a deal with `country = null` is visible to every viewer.

**Consistency with the earlier currency decision (unchanged):** This does NOT revert the currency cleanup. `currency` stays an explicit optional request field defaulting to `'USD'`. **Country drives DISCOVERY only, not currency.** `users.country` is available from signup; only the lossy country→currency *derivation* was dropped.

---

## File map

This plan creates the following files. Files in **bold** carry the load-bearing logic.

```
expyrico/
├── packages/shared/src/schemas/
│   └── deal.ts                                 ← Zod deal schemas (NEW)
├── packages/shared/src/schemas/report.ts       ← add 'deal' to reportTargetTypeSchema (MODIFY)
├── packages/shared/src/schemas/error.ts        ← +DEAL_NOT_FOUND, +CANNOT_VOTE_OWN_DEAL (MODIFY)
├── packages/shared/src/index.ts                ← re-export deal.js (MODIFY)
├── api/
│   ├── prisma/schema.prisma                    ← +Deal, +DealVote, +DealStatus, +'deal' on ReportTargetType, User/Product relations (MODIFY)
│   ├── prisma/migrations/<ts>_deals_and_deal_votes/
│   │   └── migration.sql                       ← generated + CHECK constraints + enum value
│   ├── src/
│   │   ├── **services/deals/repository.ts**    ← toApiDeal + recomputeDealScore (synchronous Wilson recompute)
│   │   ├── services/reports/repository.ts      ← MODIFY: add `deal` branch to maybeAutoHide
│   │   ├── routes/deals/
│   │   │   ├── index.ts                        ← mount + register sub-routes
│   │   │   ├── list-feed.ts                     ← GET /v1/deals
│   │   │   ├── create.ts                        ← POST /v1/deals (idempotent, auth)
│   │   │   ├── get.ts                           ← GET /v1/deals/:id
│   │   │   ├── update.ts                        ← PATCH /v1/deals/:id (own only)
│   │   │   ├── delete.ts                        ← DELETE /v1/deals/:id (own, soft delete)
│   │   │   └── vote.ts                          ← POST/DELETE /v1/deals/:id/vote
│   │   └── server.ts                            ← mount deals routes (MODIFY)
│   └── tests/
│       ├── integration/deals-feed.test.ts
│       ├── integration/deals-crud.test.ts      ← create + get + update + delete (merged CRUD)
│       ├── integration/deals-vote.test.ts      ← vote math + ownership (logic-bearing)
│       ├── integration/deals-report-autohide.test.ts
│       └── helpers/factories.ts                ← +makeDeal, makeDealVote (MODIFY)
└── apps/mobile/
    ├── src/api/
    │   └── deals.ts                            ← TanStack hooks (feed, CRUD, vote)
    ├── src/features/deals/
    │   ├── DealCard.tsx                        ← feed card + inline vote + long-press report
    │   ├── DealFeed.tsx
    │   ├── useOptimisticDealVote.ts
    │   └── DealForm.tsx                        ← post/edit form (product pick + price/store/photo/expiry/note)
    ├── app/(app)/(tabs)/deals.tsx              ← NEW tab (or section under Browse)
    ├── app/(app)/deal/[id].tsx                 ← NEW deal detail
    ├── app/(app)/deal/new.tsx                  ← NEW post-deal form host
    └── __tests__/
        ├── DealCard.test.tsx
        └── DealForm.test.tsx
└── apps/mobile/.maestro/
    └── deals-flow.yaml                         ← E2E
└── apps/admin/
    ├── src/app/deals/page.tsx                  ← deals moderation list + filters
    ├── src/app/deals/deal-actions.ts           ← server actions: hide / delete (audit-logged)
    ├── src/lib/admin-api.ts                    ← +listDeals, +setDealStatus (MODIFY)
    ├── src/features/reports/ReportPreview.tsx  ← MODIFY: render `deal` target preview
    └── e2e/deals-moderation.spec.ts            ← Playwright
```

---

## Conventions (carried over from M0–M3)

- TDD: write failing test, watch it fail, implement minimal code, watch it pass, commit. No batched commits across features.
- Conventional commits, scopes `shared`, `api`, `mobile`, `admin`.
- Wire contract is camelCase; DB columns are snake_case via Prisma `@map`; error `code` strings are snake_case.
- Every API route imports its Zod schema from `@expyrico/shared`.
- Every API route handler uses `req.user`, `app.requireAuth`, and `req.id` for logging. No `console.log` — use `req.log` (API) or the mobile logger.
- Mobile data fetching: TanStack Query with `staleTime: 30_000` for the deals feed. Deals are ONLINE-ONLY — server is source of truth — and are NOT routed through the M1 WatermelonDB offline write queue.
- All vote writes and `POST /v1/deals` require `Idempotency-Key` via the M1 plugin (`config: { idempotent: 'required' }`).
- Admin mutations are audit-logged via `writeAuditLog`.

---

## Phase A — Data model

### Task A1: Add Deal, DealVote to Prisma schema; add `deal` to ReportTargetType

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Add the `DealStatus` enum**

Place near the other content-status enums:

```prisma
enum DealStatus {
  visible
  hidden
  deleted

  @@map("deal_status")
}
```

- [ ] **Step 2: Add `deal` to the existing `ReportTargetType` enum (M2)**

Find the M2 enum and add `deal`:

```prisma
enum ReportTargetType {
  review
  user
  product
  deal
}
```

- [ ] **Step 3: Add the Deal and DealVote models at the bottom of the file**

```prisma
model Deal {
  id            String     @id @default(uuid()) @db.Uuid
  userId        String     @db.Uuid
  productId     String     @db.Uuid
  price         Decimal    @db.Decimal(10, 2)
  currency      String     @db.Char(3)
  storeName     String     @map("store_name")
  photoUrl      String?    @map("photo_url")
  expiryDate    DateTime?  @map("expiry_date") @db.Date
  note          String?
  // Country the deal is relevant to (ISO-3166 alpha-2), stamped from the poster's
  // users.country at create time. Nullable when the poster has no country yet.
  country       String?    @db.Char(2)
  upvoteCount   Int        @default(0) @map("upvote_count")
  downvoteCount Int        @default(0) @map("downvote_count")
  score         Decimal    @default(0) @db.Decimal(7, 6)
  status        DealStatus @default(visible)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  user    User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  product Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  votes   DealVote[]

  @@index([status, score(sort: Desc), createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
  // Country-scoped feed: filter by (country, status), sort by score then recency.
  @@index([country, status, score(sort: Desc), createdAt(sort: Desc)])
  @@index([productId])
  @@map("deals")
}

model DealVote {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  dealId    String   @db.Uuid
  value     Int      @db.SmallInt
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@unique([userId, dealId])
  @@index([dealId])
  @@map("deal_votes")
}
```

- [ ] **Step 4: Add the new relations to the existing User and Product models**

In `model User`, append:

```prisma
  deals     Deal[]
  dealVotes DealVote[]
```

In `model Product`, append:

```prisma
  deals Deal[]
```

- [ ] **Step 5: Format and validate**

```bash
pnpm --filter @expyrico/api exec prisma format
pnpm --filter @expyrico/api exec prisma validate
```
Expected: `The schema at api/prisma/schema.prisma is valid 🚀`.

- [ ] **Step 6: Commit**

```bash
git add api/prisma/schema.prisma
git commit -m "feat(api): add Deal, DealVote models and deal report target"
```

---

### Task A2: Generate the migration(s)

**Files:**
- Create: `api/prisma/migrations/<ts>_add_deal_report_target/migration.sql` (enum value, separate migration)
- Create: `api/prisma/migrations/<ts>_deals_and_deal_votes/migration.sql` (tables; generated, then edited)

> **Postgres enum invariant (MUST follow):** A newly added enum label cannot be referenced (compared, defaulted, cast) in the SAME transaction/migration that adds it. Therefore `ALTER TYPE "report_target_type" ADD VALUE 'deal'` MUST live in its OWN migration, applied (committed) BEFORE any migration or code path references the `deal` value. Do NOT let Prisma fold the `ADD VALUE` into the same migration that creates `deals`/`deal_votes`.

- [ ] **Step 1: Create the enum-value migration first, in isolation**

Generate a standalone migration that contains ONLY the enum addition. If Prisma bundles the enum change with the table changes when you run `migrate dev`, split it: create the `add_deal_report_target` migration manually with just the `ALTER TYPE` and apply it before generating the tables migration.

```sql
-- migrations/<ts>_add_deal_report_target/migration.sql
ALTER TYPE "report_target_type" ADD VALUE IF NOT EXISTS 'deal';
```
Apply it (`prisma migrate dev`) so the new label is committed on its own.

- [ ] **Step 2: Create the tables migration (no enum reference)**

```bash
pnpm --filter @expyrico/api exec prisma migrate dev --name deals_and_deal_votes
```
Expected: prints `Applying migration ...` and `✔ Generated Prisma Client`. This migration includes ONLY the `deals` + `deal_votes` tables and the `deal_status` enum — it must NOT contain the `report_target_type` `ADD VALUE` (already applied in Step 1).

- [ ] **Step 2b: Append CHECK constraints to the generated `migration.sql`**

Prisma does not emit value-range / sign CHECK constraints, so add them before re-applying:

```sql
ALTER TABLE "deals"
  ADD CONSTRAINT "deals_price_nonneg_check" CHECK ("price" >= 0),
  ADD CONSTRAINT "deals_store_name_len_check" CHECK (char_length("store_name") BETWEEN 1 AND 120),
  ADD CONSTRAINT "deals_country_len_check" CHECK ("country" IS NULL OR char_length("country") = 2);

ALTER TABLE "deal_votes"
  ADD CONSTRAINT "deal_votes_value_check" CHECK ("value" IN (-1, 1));
```

`price`, `currency`, and `store_name` are NOT NULL (non-optional Prisma fields). Re-run `prisma migrate dev` if the file was edited after generation.

- [ ] **Step 3: Verify the tables, enum, and indexes**

```bash
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "\dt deals*"
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "\dt deal_votes*"
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "\di deals*"
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "SELECT enum_range(NULL::report_target_type);"
```
Expected: `deals`, `deal_votes` listed; indexes include the feed sort index, `deal_votes_userId_dealId_key`; the enum range includes `deal`.

- [ ] **Step 4: Commit**

```bash
git add api/prisma/migrations
git commit -m "feat(api): migrate deals, deal_votes, deal report target"
```

---

### Task A3: Extend test harness to truncate new tables

**Files:**
- Modify: `api/tests/helpers/setup.ts`

- [ ] **Step 1: Add the new tables to the truncate list**

Find the `const tables = [` array. Add `'deal_votes'` and `'deals'` ABOVE `'reports'` (children before parents; deals/deal_votes are truncated before users/products):

```ts
  'deal_votes',
  'deals',
  // ...existing M2 entries (reports, review_votes, reviews) below...
```

- [ ] **Step 2: Run the existing suite to confirm nothing broke**

```bash
pnpm --filter @expyrico/api test
```
Expected: all previously-passing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add api/tests/helpers/setup.ts
git commit -m "test(api): truncate deals and deal_votes per test"
```

---

### Task A4: Test factories for deals + deal votes

**Files:**
- Modify: `api/tests/helpers/factories.ts`

- [ ] **Step 1: Append the factories**

```ts
import type { Deal, DealVote } from '@prisma/client';

export async function makeDeal(overrides: {
  userId: string;
  productId: string;
  price?: number;
  currency?: string;
  storeName?: string;
  photoUrl?: string | null;
  expiryDate?: Date | null;
  note?: string | null;
  country?: string | null;
  status?: 'visible' | 'hidden' | 'deleted';
  upvoteCount?: number;
  downvoteCount?: number;
  score?: number;
}): Promise<Deal> {
  const prisma = getPrisma();
  return prisma.deal.create({
    data: {
      userId: overrides.userId,
      productId: overrides.productId,
      price: overrides.price ?? 4.99,
      currency: overrides.currency ?? 'USD',
      storeName: overrides.storeName ?? 'Corner Mart',
      photoUrl: overrides.photoUrl ?? null,
      expiryDate: overrides.expiryDate ?? null,
      note: overrides.note ?? null,
      country: overrides.country ?? null,
      status: overrides.status ?? 'visible',
      upvoteCount: overrides.upvoteCount ?? 0,
      downvoteCount: overrides.downvoteCount ?? 0,
      score: overrides.score ?? 0,
    },
  });
}

export async function makeDealVote(overrides: {
  userId: string;
  dealId: string;
  value: 1 | -1;
}): Promise<DealVote> {
  const prisma = getPrisma();
  return prisma.dealVote.create({
    data: { userId: overrides.userId, dealId: overrides.dealId, value: overrides.value },
  });
}
```

NOTE: `makeProduct` / `makeUser` already exist from M1/M2 — reuse them.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/tests/helpers/factories.ts
git commit -m "test(api): add makeDeal and makeDealVote factories"
```

---

### Task A5: Zod schemas in `@expyrico/shared`

**Files:**
- Create: `packages/shared/src/schemas/deal.ts`
- Modify: `packages/shared/src/schemas/report.ts`
- Modify: `packages/shared/src/schemas/error.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/deal.ts`**

```ts
import { z } from 'zod';

export const dealStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export type DealStatus = z.infer<typeof dealStatusSchema>;

export const dealSortSchema = z.enum(['score', 'new']).default('score');
export type DealSort = z.infer<typeof dealSortSchema>;

const priceField = z.number().nonnegative().max(1_000_000);
const currencyField = z.string().length(3).regex(/^[A-Z]{3}$/);
const storeNameField = z.string().trim().min(1).max(120);
const noteField = z.string().trim().max(1000).optional();
// ISO date (yyyy-mm-dd) for the optional expiry.
const expiryField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiryDate must be yyyy-mm-dd')
  .optional();

// photoUrl is NOT a free fetchable URL: it must be a URL on the app's own CDN host
// (the only host the avatar-style upload endpoint mints). This blocks SSRF — the
// server never fetches an arbitrary user-supplied URL. Set DEAL_PHOTO_CDN_HOST in
// shared config; the same allowlist is re-checked server-side in the create/update route.
export const DEAL_PHOTO_CDN_HOST = 'cdn.expyrico.app';
const photoUrlField = z
  .string()
  .url()
  .refine((u) => {
    try {
      return new URL(u).host === DEAL_PHOTO_CDN_HOST;
    } catch {
      return false;
    }
  }, 'photoUrl must be hosted on the app CDN');

export const dealSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  price: priceField,
  currency: currencyField,
  storeName: storeNameField,
  photoUrl: z.string().url().nullable(),
  expiryDate: z.string().nullable(),
  note: z.string().nullable(),
  // Country the deal is relevant to (ISO-3166 alpha-2); null if poster had no country.
  country: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  upvoteCount: z.number().int().nonnegative(),
  downvoteCount: z.number().int().nonnegative(),
  score: z.number().min(0).max(1),
  status: dealStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Present on the feed when caller is authenticated; null if no vote. */
  myVote: z.union([z.literal(-1), z.literal(1)]).nullable().optional(),
  /** Light product projection for the feed card. */
  product: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      brand: z.string().nullable(),
      imageUrl: z.string().url().nullable(),
    })
    .optional(),
  /** Light author projection — first name + avatar only, never email. */
  author: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      avatarUrl: z.string().url().nullable(),
    })
    .optional(),
});
export type Deal = z.infer<typeof dealSchema>;

export const dealCreateSchema = z.object({
  productId: z.string().uuid(),
  price: priceField,
  // Optional on the wire — server defaults to 'USD' when absent (no country derivation).
  currency: currencyField.optional(),
  storeName: storeNameField,
  // Must be an app-CDN URL minted by the avatar-style upload — never an arbitrary URL.
  photoUrl: photoUrlField.optional(),
  expiryDate: expiryField,
  note: noteField,
});
export type DealCreate = z.infer<typeof dealCreateSchema>;

export const dealPatchSchema = z
  .object({
    price: priceField.optional(),
    storeName: storeNameField.optional(),
    photoUrl: photoUrlField.nullable().optional(),
    expiryDate: expiryField.or(z.null()),
    note: noteField.or(z.null()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field required' });
export type DealPatch = z.infer<typeof dealPatchSchema>;

export const dealVoteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(1)]),
});
export type DealVote = z.infer<typeof dealVoteSchema>;

export const dealListQuerySchema = z.object({
  sort: dealSortSchema,
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DealListQuery = z.infer<typeof dealListQuerySchema>;
```

- [ ] **Step 2: Add `deal` to `reportTargetTypeSchema` in `packages/shared/src/schemas/report.ts`**

```ts
export const reportTargetTypeSchema = z.enum(['review', 'user', 'product', 'deal']);
```

- [ ] **Step 3: Add error codes to `packages/shared/src/schemas/error.ts`**

Inside the `ERROR_CODES` object, add:

```ts
  DEAL_NOT_FOUND: 'deal_not_found',
  CANNOT_VOTE_OWN_DEAL: 'cannot_vote_own_deal',
```

- [ ] **Step 4: Re-export from `packages/shared/src/index.ts`**

```ts
export * from './schemas/deal.js';
```

- [ ] **Step 5: Typecheck the shared package**

```bash
pnpm --filter @expyrico/shared typecheck
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): add deal Zod schemas and deal report target"
```

---

## Phase B — Deal repository + auto-hide branch

### Task B1: `toApiDeal` projection + synchronous `recomputeDealScore`

**Files:**
- Create: `api/src/services/deals/repository.ts`

- [ ] **Step 1: Write `api/src/services/deals/repository.ts`**

This file exports both the `toApiDeal` projection and `recomputeDealScore`, the synchronous Wilson + denormalized-count recompute the vote routes call inside their transaction (replaces the removed background worker). `recomputeDealScore` accepts a Prisma transaction client so the recompute is atomic with the vote write.

```ts
import type { Deal, Product, User, Prisma, PrismaClient } from '@prisma/client';
import type { Deal as ApiDeal } from '@expyrico/shared';
import { wilsonLowerBound } from '../reviews/wilson.js';

/** Prisma client OR a transaction client — recompute runs inside the vote txn. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Recompute denormalized vote counts + Wilson lower-bound score for one deal and
 * persist them. Indexed aggregate over deal_votes is sub-ms at app scale, so this
 * runs INLINE in the vote transaction — no debounced queue/worker.
 */
export async function recomputeDealScore(db: Db, dealId: string): Promise<void> {
  const agg = await db.dealVote.groupBy({
    by: ['value'],
    where: { dealId },
    _count: { _all: true },
  });
  let up = 0;
  let down = 0;
  for (const row of agg) {
    if (row.value === 1) up = row._count._all;
    else if (row.value === -1) down = row._count._all;
  }
  await db.deal.update({
    where: { id: dealId },
    data: { upvoteCount: up, downvoteCount: down, score: wilsonLowerBound(up, down) },
  });
}

type DealWithRelations = Deal & {
  product?: Pick<Product, 'id' | 'name' | 'brand' | 'imageUrl'> | null;
  user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
};

export function toApiDeal(
  d: DealWithRelations,
  opts: { myVote?: -1 | 1 | null } = {},
): ApiDeal {
  const out: ApiDeal = {
    id: d.id,
    userId: d.userId,
    productId: d.productId,
    price: Number(d.price),
    currency: d.currency,
    storeName: d.storeName,
    photoUrl: d.photoUrl,
    // expiryDate is a DATE column → ISO date prefix only (yyyy-mm-dd).
    expiryDate: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
    note: d.note,
    country: d.country,
    upvoteCount: d.upvoteCount,
    downvoteCount: d.downvoteCount,
    score: Number(d.score),
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    myVote: opts.myVote ?? null,
  };
  if (d.product) {
    out.product = {
      id: d.product.id,
      name: d.product.name,
      brand: d.product.brand,
      imageUrl: d.product.imageUrl,
    };
  }
  if (d.user) {
    out.author = { id: d.user.id, firstName: d.user.firstName, avatarUrl: d.user.avatarUrl };
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/deals/repository.ts
git commit -m "feat(api): deal repository (toApiDeal + synchronous recomputeDealScore)"
```

---

### Task B2: Extend `maybeAutoHide` with a `deal` branch

**Files:**
- Modify: `api/src/services/reports/repository.ts`

> M2's `maybeAutoHide(targetType, targetId)` already counts non-dismissed reports and applies the spec literal `> 3` threshold, with branches for `review`/`product`. M5 adds the `deal` branch. The threshold literal stays exactly as M2 shipped it — no new constant, no settings import.

- [ ] **Step 1: Add a `deal` branch inside `maybeAutoHide`**

After the existing `review` / `product` branches and before the final `return { hidden: false }`:

```ts
  if (targetType === 'deal') {
    const d = await prisma.deal.findUnique({ where: { id: targetId } });
    if (!d || d.status === 'hidden' || d.status === 'deleted') return { hidden: false };
    await prisma.deal.update({ where: { id: targetId }, data: { status: 'hidden' } });
    return { hidden: true };
  }
```

(If `maybeAutoHide` is typed to M2's `ReportTargetType` union from `@expyrico/shared`, the added `'deal'` member from Task A5 makes this branch typecheck.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/reports/repository.ts
git commit -m "feat(api): auto-hide deals after >3 reports"
```

---

## Phase D — Deals HTTP routes

> **Test file consolidation:** the create / get / update / delete specs (Tasks D3–D7) all live in a SINGLE merged file `api/tests/integration/deals-crud.test.ts` — write each task's `describe` block into that one file rather than separate `deals-create/get/update/delete` files. Keep dedicated files only for logic-bearing paths: `deals-feed.test.ts` (sort/cursor), `deals-vote.test.ts` (vote math + ownership + synchronous recompute + rate limit), and `deals-report-autohide.test.ts` (auto-hide branch). The `// api/tests/integration/deals-<x>.test.ts` header comments in the D3–D7 code blocks are illustrative of the describe block; the actual file target is `deals-crud.test.ts`.

### Task D1: GET /v1/deals (feed) — failing test

**Files:**
- Create: `api/tests/integration/deals-feed.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/deals-feed.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';

describe('GET /v1/deals', () => {
  it('returns visible deals sorted by score DESC by default', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `a-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `b-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `c-${Date.now()}@t.l` });
    await makeDeal({ userId: u1.id, productId: p.id, score: 0.2 });
    await makeDeal({ userId: u2.id, productId: p.id, score: 0.8 });
    await makeDeal({ userId: u3.id, productId: p.id, score: 0.5 });

    const res = await app.inject({ method: 'GET', url: '/v1/deals' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(3);
    expect(body.items[0].score).toBeGreaterThanOrEqual(body.items[1].score);
    expect(body.items[1].score).toBeGreaterThanOrEqual(body.items[2].score);
    await app.close();
  });

  it('excludes hidden and deleted deals', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `h1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `h2-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `h3-${Date.now()}@t.l` });
    await makeDeal({ userId: u1.id, productId: p.id, status: 'hidden' });
    await makeDeal({ userId: u2.id, productId: p.id, status: 'deleted' });
    await makeDeal({ userId: u3.id, productId: p.id, status: 'visible' });
    const res = await app.inject({ method: 'GET', url: '/v1/deals' });
    expect(res.json().items).toHaveLength(1);
    await app.close();
  });

  it('supports sort=new (createdAt DESC)', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `n1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `n2-${Date.now()}@t.l` });
    const d1 = await makeDeal({ userId: u1.id, productId: p.id });
    await new Promise((r) => setTimeout(r, 5));
    const d2 = await makeDeal({ userId: u2.id, productId: p.id });
    const res = await app.inject({ method: 'GET', url: '/v1/deals?sort=new' });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toEqual([d2.id, d1.id]);
    await app.close();
  });

  it('returns 400 for an invalid sort', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/deals?sort=bogus' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('scopes the feed to the viewer country: a country-A deal is absent from a country-B viewer feed', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const poster = await makeUser({ email: `cp-${Date.now()}@t.l`, country: 'US' });
    const viewerB = await makeUser({ email: `cb-${Date.now()}@t.l`, country: 'GB' });
    const dealUs = await makeDeal({ userId: poster.id, productId: p.id, country: 'US' });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/deals',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: viewerB.id, role: 'user' })}` },
    });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).not.toContain(dealUs.id);

    // Same deal IS visible to a country-A (US) viewer.
    const viewerA = await makeUser({ email: `ca-${Date.now()}@t.l`, country: 'US' });
    const resA = await app.inject({
      method: 'GET',
      url: '/v1/deals',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: viewerA.id, role: 'user' })}` },
    });
    expect(resA.json().items.map((x: { id: string }) => x.id)).toContain(dealUs.id);
    await app.close();
  });

  it('falls back to the global (unfiltered) feed when the viewer has no country', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const poster = await makeUser({ email: `gp-${Date.now()}@t.l`, country: 'US' });
    const viewerNoCountry = await makeUser({ email: `gn-${Date.now()}@t.l`, country: null });
    const dealUs = await makeDeal({ userId: poster.id, productId: p.id, country: 'US' });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/deals',
      headers: {
        authorization: `Bearer ${await issueAccessToken({ sub: viewerNoCountry.id, role: 'user' })}`,
      },
    });
    // Global fallback: country-scoped deals from any country are visible.
    expect(res.json().items.map((x: { id: string }) => x.id)).toContain(dealUs.id);
    await app.close();
  });

  it('shows null-country deals to every viewer regardless of viewer country', async () => {
    // Mirrors the M6 giveaway null-country rule: a deal whose own country is
    // null (poster had no country at create time) is globally visible.
    const app = await buildServer();
    const p = await makeProduct();
    const posterNoCountry = await makeUser({ email: `pn-${Date.now()}@t.l`, country: null });
    const viewerUs = await makeUser({ email: `vu-${Date.now()}@t.l`, country: 'US' });
    const viewerVn = await makeUser({ email: `vv-${Date.now()}@t.l`, country: 'VN' });
    const dealNullCountry = await makeDeal({ userId: posterNoCountry.id, productId: p.id, country: null });

    for (const viewer of [viewerUs, viewerVn]) {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/deals',
        headers: {
          authorization: `Bearer ${await issueAccessToken({ sub: viewer.id, role: 'user' })}`,
        },
      });
      expect(res.json().items.map((x: { id: string }) => x.id)).toContain(dealNullCountry.id);
    }
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL** (`pnpm --filter @expyrico/api exec vitest run tests/integration/deals-feed.test.ts` → 404, route not mounted).

---

### Task D2: GET /v1/deals + mount deals routes — implementation

**Files:**
- Create: `api/src/routes/deals/list-feed.ts`
- Create: `api/src/routes/deals/index.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write `api/src/routes/deals/list-feed.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { dealListQuerySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiDeal } from '../../services/deals/repository.js';

export async function listFeedRoute(app: FastifyInstance) {
  app.get('/deals', async (req) => {
    const query = dealListQuerySchema.parse(req.query);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;

    // Country-scoped feed: deals are country-level relevant ("cheap at X store").
    // Filter to the viewer's users.country, OR-ing in deals with country=NULL
    // (globally visible — poster had no country at create time, mirroring M6).
    // No-country fallback = GLOBAL (unfiltered), so a viewer without a country
    // still gets a populated feed rather than an empty one.
    let viewerCountry: string | null = null;
    if (viewerId) {
      const viewer = await prisma.user.findUnique({
        where: { id: viewerId },
        select: { country: true },
      });
      viewerCountry = viewer?.country ?? null;
    }

    const orderBy =
      query.sort === 'new'
        ? [{ createdAt: 'desc' as const }]
        : [{ score: 'desc' as const }, { createdAt: 'desc' as const }];

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const items = await prisma.deal.findMany({
      // viewerCountry === null → global fallback (no country filter).
      // viewerCountry !== null → match viewer's country OR null-country (globally visible).
      where: {
        status: 'visible',
        ...(viewerCountry
          ? { OR: [{ country: viewerCountry }, { country: null }] }
          : {}),
      },
      orderBy,
      take: query.limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        user: { select: { id: true, firstName: true, avatarUrl: true } },
      },
    });

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;

    let myVotes = new Map<string, -1 | 1>();
    if (viewerId && page.length > 0) {
      const votes = await prisma.dealVote.findMany({
        where: { userId: viewerId, dealId: { in: page.map((d) => d.id) } },
      });
      myVotes = new Map(votes.map((v) => [v.dealId, v.value as -1 | 1]));
    }

    return {
      items: page.map((d) => toApiDeal(d, { myVote: myVotes.get(d.id) ?? null })),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  });
}
```

- [ ] **Step 2: Write `api/src/routes/deals/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { listFeedRoute } from './list-feed.js';

export async function dealsRoutes(app: FastifyInstance) {
  await app.register(listFeedRoute);
}
```

- [ ] **Step 3: Mount in `api/src/server.ts`**

Add import:

```ts
import { dealsRoutes } from './routes/deals/index.js';
```

Register after the M2 reviews/reports routes:

```ts
await app.register(dealsRoutes, { prefix: '/v1' });
```

- [ ] **Step 4: Verify PASS** (`vitest run tests/integration/deals-feed.test.ts` → 7 passed).

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/deals api/src/server.ts
git commit -m "feat(api): GET /v1/deals feed with sort + cursor"
```

---

### Task D3: POST /v1/deals — failing test

**Files:**
- Create: `api/tests/integration/deals-crud.test.ts` (add the `POST /v1/deals` describe block)

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/deals-create.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeUser } from '../helpers/factories.js';

async function h(uid: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}`,
    'idempotency-key': `deal-${uid}-${Date.now()}-${Math.random()}`,
  };
}

describe('POST /v1/deals', () => {
  it('creates a visible deal and stamps country from the poster', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true, country: 'US' });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: await h(user.id),
      payload: { productId: product.id, price: 3.49, storeName: 'Aldi', note: 'half price' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('visible');
    expect(res.json().price).toBe(3.49);
    expect(res.json().storeName).toBe('Aldi');
    expect(res.json().currency).toMatch(/^[A-Z]{3}$/); // defaulted server-side
    expect(res.json().country).toBe('US'); // stamped from poster users.country
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: { 'idempotency-key': `x-${Date.now()}` },
      payload: { productId: product.id, price: 1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('requires Idempotency-Key', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const token = await issueAccessToken({ sub: user.id, role: 'user' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id, price: 1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 404 for an unknown product', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: await h(user.id),
      payload: { productId: '00000000-0000-0000-0000-0000000000ff', price: 1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects a negative price with 400', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: await h(user.id),
      payload: { productId: product.id, price: -1, storeName: 'X' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a non-CDN photoUrl with 400 (SSRF guard)', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: await h(user.id),
      payload: { productId: product.id, price: 1, storeName: 'X', photoUrl: 'http://169.254.169.254/latest/meta-data' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rate-limits deal creation past 10/min for one user (429)', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const token = await issueAccessToken({ sub: user.id, role: 'user' });
    let last = 201;
    for (let i = 0; i < 11; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/deals',
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': `c-${i}-${Date.now()}` },
        payload: { productId: product.id, price: 1, storeName: 'X' },
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL.**

---

### Task D4: POST /v1/deals — implementation

**Files:**
- Create: `api/src/routes/deals/create.ts`
- Modify: `api/src/routes/deals/index.ts`

- [ ] **Step 1: Write `api/src/routes/deals/create.ts`**

The create route carries a per-route rate limit of 10/min/user (tighter than the global limiter). Currency defaults to a single safe default (`'USD'`) when the optional `currency` field is absent — there is NO country→currency *derivation* (the country→currency map was lossy). The deal's `country` IS stamped from the poster's `users.country` (available from signup per spec §2.9) to drive the country-scoped feed — this is DISCOVERY scoping, independent of currency. `photoUrl` is validated to the app-CDN host by the Zod schema AND re-checked here server-side (defence in depth); the server never fetches the URL.

```ts
import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, dealCreateSchema, DEAL_PHOTO_CDN_HOST } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiDeal } from '../../services/deals/repository.js';

const DEFAULT_CURRENCY = 'USD';

/** Server-side re-check: photoUrl must be on the app CDN. Never fetch the URL. */
function assertCdnHost(url: string | undefined): void {
  if (!url) return;
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'Invalid photoUrl' });
  }
  if (host !== DEAL_PHOTO_CDN_HOST) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'photoUrl must be on the app CDN' });
  }
}

export async function createDealRoute(app: FastifyInstance) {
  app.post(
    '/deals',
    {
      onRequest: [app.requireAuth],
      config: { idempotent: 'required', rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const input = dealCreateSchema.parse(req.body);
      assertCdnHost(input.photoUrl);
      const prisma = getPrisma();
      const userId = req.user!.id;

      const product = await prisma.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
      }

      // Explicit currency or a single safe default — no country→currency derivation.
      const currency = input.currency ?? DEFAULT_CURRENCY;

      // Stamp the deal's country from the poster's users.country (set from IP at signup,
      // spec §2.9). Drives the country-scoped feed; null if the poster has no country yet.
      const poster = await prisma.user.findUnique({
        where: { id: userId },
        select: { country: true },
      });
      const country = poster?.country ?? null;

      const created = await prisma.deal.create({
        data: {
          userId,
          productId: input.productId,
          price: input.price,
          currency,
          country,
          storeName: input.storeName,
          photoUrl: input.photoUrl ?? null,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          note: input.note ?? null,
        },
        include: {
          product: { select: { id: true, name: true, brand: true, imageUrl: true } },
          user: { select: { id: true, firstName: true, avatarUrl: true } },
        },
      });

      return reply.status(201).send(toApiDeal(created, { myVote: null }));
    },
  );
}
```

> The deal photo is OPTIONAL and uploaded via the M0b avatar-style multipart endpoint (`POST /v1/me/avatar` pattern) BEFORE creating the deal — the client uploads the image to the app's own storage, receives a `photoUrl` ON THE APP CDN (`DEAL_PHOTO_CDN_HOST`), then passes it in the create body. The server NEVER fetches an arbitrary user-supplied URL (no SSRF surface): `photoUrl` is constrained to the CDN host by the Zod schema and re-checked in the route. Note that `ERROR_CODES.VALIDATION` is M0a's existing validation code; if a distinct code is preferred, reuse the M0a convention.

- [ ] **Step 2: Register in `api/src/routes/deals/index.ts`**

```ts
import { createDealRoute } from './create.js';
// inside dealsRoutes:
await app.register(createDealRoute);
```

- [ ] **Step 3: Verify PASS** (5 passed).

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/deals
git commit -m "feat(api): POST /v1/deals (idempotent, USD default, CDN photoUrl, rate-limited)"
```

---

### Task D5: GET /v1/deals/:id — failing test + implementation

**Files:**
- Modify: `api/tests/integration/deals-crud.test.ts` (add the `GET /v1/deals/:id` describe block)
- Create: `api/src/routes/deals/get.ts`
- Modify: `api/src/routes/deals/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/deals-get.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';

describe('GET /v1/deals/:id', () => {
  it('returns a visible deal with product + author', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `g-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const res = await app.inject({ method: 'GET', url: `/v1/deals/${deal.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(deal.id);
    expect(res.json().product.id).toBe(product.id);
    expect(res.json().author.id).toBe(author.id);
    await app.close();
  });

  it('hydrates myVote for the authenticated caller', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `gv1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `gv2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/vote`,
      headers: {
        authorization: `Bearer ${await issueAccessToken({ sub: voter.id, role: 'user' })}`,
        'idempotency-key': `v-${Date.now()}`,
      },
      payload: { value: 1 },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/deals/${deal.id}`,
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: voter.id, role: 'user' })}` },
    });
    expect(res.json().myVote).toBe(1);
    await app.close();
  });

  it('returns 404 for a hidden deal to a non-owner', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `gh-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id, status: 'hidden' });
    const res = await app.inject({ method: 'GET', url: `/v1/deals/${deal.id}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Write `api/src/routes/deals/get.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiDeal } from '../../services/deals/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function getDealRoute(app: FastifyInstance) {
  app.get('/deals/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        user: { select: { id: true, firstName: true, avatarUrl: true } },
      },
    });
    // Hidden/deleted are visible only to the owner.
    if (!deal || (deal.status !== 'visible' && deal.userId !== viewerId)) {
      throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
    }
    let myVote: -1 | 1 | null = null;
    if (viewerId) {
      const v = await prisma.dealVote.findUnique({
        where: { userId_dealId: { userId: viewerId, dealId: id } },
      });
      myVote = (v?.value as -1 | 1 | undefined) ?? null;
    }
    return toApiDeal(deal, { myVote });
  });
}
```

- [ ] **Step 4: Register + verify PASS** (3 passed).

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/deals api/tests/integration/deals-crud.test.ts
git commit -m "feat(api): GET /v1/deals/:id with myVote hydration"
```

---

### Task D6: PATCH /v1/deals/:id — failing test + implementation

**Files:**
- Modify: `api/tests/integration/deals-crud.test.ts` (add the `PATCH /v1/deals/:id` describe block)
- Create: `api/src/routes/deals/update.ts`
- Modify: `api/src/routes/deals/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/deals-update.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('PATCH /v1/deals/:id', () => {
  it('updates own deal', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: user.id, productId: product.id, price: 5, storeName: 'A' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/deals/${deal.id}`,
      headers: await h(user.id),
      payload: { price: 2.5, storeName: 'B', note: 'now cheaper' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().price).toBe(2.5);
    expect(res.json().storeName).toBe('B');
    expect(res.json().note).toBe('now cheaper');
    await app.close();
  });

  it("rejects updating someone else's deal with 403", async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `o-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `i-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: owner.id, productId: product.id });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/deals/${deal.id}`,
      headers: await h(intruder.id),
      payload: { price: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns 404 for unknown id', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/deals/00000000-0000-0000-0000-0000000000aa',
      headers: await h(user.id),
      payload: { price: 1 },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Write `api/src/routes/deals/update.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, dealPatchSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiDeal } from '../../services/deals/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function updateDealRoute(app: FastifyInstance) {
  app.patch('/deals/:id', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = dealPatchSchema.parse(req.body);
    const prisma = getPrisma();

    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing || existing.status === 'deleted') {
      throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
    }
    if (existing.userId !== req.user!.id) {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your deal' });
    }

    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.storeName !== undefined ? { storeName: input.storeName } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.expiryDate !== undefined
          ? { expiryDate: input.expiryDate ? new Date(input.expiryDate) : null }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        user: { select: { id: true, firstName: true, avatarUrl: true } },
      },
    });
    return toApiDeal(updated, { myVote: null });
  });
}
```

- [ ] **Step 4: Register + verify PASS** (3 passed).

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/deals api/tests/integration/deals-crud.test.ts
git commit -m "feat(api): PATCH /v1/deals/:id (owner only)"
```

---

### Task D7: DELETE /v1/deals/:id — failing test + implementation

**Files:**
- Modify: `api/tests/integration/deals-crud.test.ts` (add the `DELETE /v1/deals/:id` describe block)
- Create: `api/src/routes/deals/delete.ts`
- Modify: `api/src/routes/deals/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/deals-delete.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('DELETE /v1/deals/:id', () => {
  it('soft-deletes own deal', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: user.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/deals/${deal.id}`, headers: await h(user.id) });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.status).toBe('deleted');
    await app.close();
  });

  it("rejects deleting someone else's deal with 403", async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `do-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `di-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: owner.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/deals/${deal.id}`, headers: await h(intruder.id) });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Write `api/src/routes/deals/delete.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function deleteDealRoute(app: FastifyInstance) {
  app.delete('/deals/:id', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing) throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
    if (existing.userId !== req.user!.id) {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your deal' });
    }
    await prisma.deal.update({ where: { id }, data: { status: 'deleted' } });
    return reply.status(204).send();
  });
}
```

- [ ] **Step 4: Register + verify PASS** (2 passed).

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/deals api/tests/integration/deals-crud.test.ts
git commit -m "feat(api): DELETE /v1/deals/:id soft-delete"
```

---

### Task D8: POST/DELETE /v1/deals/:id/vote — failing test

**Files:**
- Create: `api/tests/integration/deals-vote.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/deals-vote.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}`,
    'idempotency-key': `vote-${uid}-${Date.now()}-${Math.random()}`,
  };
}

describe('POST /v1/deals/:id/vote', () => {
  it('inserts a +1 vote and is idempotent on upsert', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `va-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `vv-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const headers = await h(voter.id);
    const a = await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers, payload: { value: 1 } });
    const b = await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers, payload: { value: 1 } });
    expect(a.statusCode).toBe(204);
    expect(b.statusCode).toBe(204);
    expect(await getPrisma().dealVote.count({ where: { dealId: deal.id } })).toBe(1);
    await app.close();
  });

  it('recomputes counts + Wilson score SYNCHRONOUSLY (visible immediately, no worker)', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `sy-${Date.now()}@t.l` });
    const v1 = await makeUser({ email: `sy1-${Date.now()}@t.l` });
    const v2 = await makeUser({ email: `sy2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(v1.id), payload: { value: 1 } });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(v2.id), payload: { value: -1 } });
    // No queue/worker: the deal row is already updated when the request returns.
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.upvoteCount).toBe(1);
    expect(after?.downvoteCount).toBe(1);
    expect(Number(after?.score)).toBeGreaterThan(0);
    expect(Number(after?.score)).toBeLessThan(1);
    await app.close();
  });

  it('switches a vote from +1 to -1 (still one row)', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `s1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `s2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(voter.id), payload: { value: 1 } });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(voter.id), payload: { value: -1 } });
    const all = await getPrisma().dealVote.findMany({ where: { dealId: deal.id } });
    expect(all).toHaveLength(1);
    expect(all[0]!.value).toBe(-1);
    await app.close();
  });

  it('refuses voting on own deal with 403', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: user.id, productId: product.id });
    const res = await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(user.id), payload: { value: 1 } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('cannot_vote_own_deal');
    await app.close();
  });

  it('requires Idempotency-Key', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ik1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `ik2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/vote`,
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: voter.id, role: 'user' })}` },
      payload: { value: 1 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rate-limits voting past 30/min for one user (429)', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `rl1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `rl2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const token = await issueAccessToken({ sub: voter.id, role: 'user' });
    let last = 204;
    // 31 distinct idempotency keys → 31 requests; the 31st must be limited.
    for (let i = 0; i < 31; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/deals/${deal.id}/vote`,
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': `rl-${i}-${Date.now()}` },
        payload: { value: 1 },
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
    await app.close();
  });
});

describe('DELETE /v1/deals/:id/vote', () => {
  it("removes the caller's vote", async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `d1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `d2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/deals/${deal.id}/vote`, headers: await h(voter.id), payload: { value: 1 } });
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/deals/${deal.id}/vote`,
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: voter.id, role: 'user' })}` },
    });
    expect(del.statusCode).toBe(204);
    expect(await getPrisma().dealVote.count({ where: { dealId: deal.id } })).toBe(0);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL.**

---

### Task D9: POST/DELETE /v1/deals/:id/vote — implementation

**Files:**
- Create: `api/src/routes/deals/vote.ts`
- Modify: `api/src/routes/deals/index.ts`

- [ ] **Step 1: Write `api/src/routes/deals/vote.ts`**

The vote write and the score/count recompute run in ONE transaction via `recomputeDealScore` (Task B1) — there is no background queue. Both routes carry a per-route rate limit of 30/min/user, tighter than the global 60/min limiter (M0a's rate-limit plugin; `config.rateLimit` per-route override on `@fastify/rate-limit` registered globally with `keyGenerator` = user id).

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, dealVoteSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { recomputeDealScore } from '../../services/deals/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

// Per-route limit, tighter than the global 60/min-user · 30/min-IP limiter.
const voteRateLimit = { max: 30, timeWindow: '1 minute' } as const;

export async function dealVoteRoutes(app: FastifyInstance) {
  app.post(
    '/deals/:id/vote',
    {
      onRequest: [app.requireAuth],
      config: { idempotent: 'required', rateLimit: voteRateLimit },
    },
    async (req, reply) => {
      const { id: dealId } = paramsSchema.parse(req.params);
      const { value } = dealVoteSchema.parse(req.body);
      const prisma = getPrisma();
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      if (!deal || deal.status === 'deleted') {
        throw new AppError({ status: 404, code: ERROR_CODES.DEAL_NOT_FOUND, title: 'Deal not found' });
      }
      if (deal.userId === req.user!.id) {
        throw new AppError({
          status: 403,
          code: ERROR_CODES.CANNOT_VOTE_OWN_DEAL,
          title: 'Cannot vote on your own deal',
        });
      }
      // Write the vote and recompute counts + Wilson score atomically (synchronous).
      await prisma.$transaction(async (tx) => {
        await tx.dealVote.upsert({
          where: { userId_dealId: { userId: req.user!.id, dealId } },
          create: { userId: req.user!.id, dealId, value },
          update: { value },
        });
        await recomputeDealScore(tx, dealId);
      });
      return reply.status(204).send();
    },
  );

  app.delete(
    '/deals/:id/vote',
    { onRequest: [app.requireAuth], config: { rateLimit: voteRateLimit } },
    async (req, reply) => {
      const { id: dealId } = paramsSchema.parse(req.params);
      const prisma = getPrisma();
      await prisma.$transaction(async (tx) => {
        await tx.dealVote.deleteMany({ where: { userId: req.user!.id, dealId } });
        await recomputeDealScore(tx, dealId);
      });
      return reply.status(204).send();
    },
  );
}
```

- [ ] **Step 2: Register in `api/src/routes/deals/index.ts`**

```ts
import { dealVoteRoutes } from './vote.js';
await app.register(dealVoteRoutes);
```

- [ ] **Step 3: Verify PASS** (5 passed).

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/deals api/tests/integration/deals-vote.test.ts
git commit -m "feat(api): POST/DELETE /v1/deals/:id/vote with synchronous score recompute"
```

---

### Task D10: Deal reporting + auto-hide integration test

> `POST /v1/reports` already accepts `targetType` from the shared enum (M2). Task A5 added `deal`; Task D2's `targetExists` equivalent in the M2 reports route must recognize deals. Confirm the M2 `targetExists` helper in `api/src/routes/reports/create.ts` covers `deal`; if it does not, add a `deal` case.

**Files:**
- Create: `api/tests/integration/deals-report-autohide.test.ts`
- Modify (if needed): `api/src/routes/reports/create.ts` (add `deal` to the target-existence check)

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/deals-report-autohide.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('reporting a deal', () => {
  it('creates an open report for a deal', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ra-${Date.now()}@t.l` });
    const reporter = await makeUser({ email: `rp-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'deal', targetId: deal.id, reason: 'spam' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('open');
    await app.close();
  });

  it('auto-hides a deal after >3 reports', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ah-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    for (let i = 0; i < 4; i += 1) {
      const reporter = await makeUser({ email: `r${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'deal', targetId: deal.id, reason: 'spam' },
      });
    }
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.status).toBe('hidden');
    await app.close();
  });

  it('does NOT auto-hide at exactly 3 reports (threshold is strictly > 3)', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `t3-${Date.now()}@t.l` });
    const product = await makeProduct();
    const deal = await makeDeal({ userId: author.id, productId: product.id });
    for (let i = 0; i < 3; i += 1) {
      const reporter = await makeUser({ email: `t3r${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'deal', targetId: deal.id, reason: 'spam' },
      });
    }
    const after = await getPrisma().deal.findUnique({ where: { id: deal.id } });
    expect(after?.status).toBe('visible');
    await app.close();
  });

  it('returns 404 when targetType=deal and targetId is unknown', async () => {
    const app = await buildServer();
    const reporter = await makeUser({ email: `r-${Date.now()}@t.l` });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'deal', targetId: '00000000-0000-0000-0000-0000000000ff', reason: 'spam' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Run; if any of the first three fail because the M2 reports route rejects `deal` as unknown, add a `deal` case to `targetExists` in `api/src/routes/reports/create.ts`:**

```ts
  if (type === 'deal') return (await prisma.deal.findUnique({ where: { id } })) !== null;
```

- [ ] **Step 3: Verify PASS** (4 passed). The auto-hide assertions exercise the Task B2 `deal` branch.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/reports/create.ts api/tests/integration/deals-report-autohide.test.ts
git commit -m "feat(api): support deal reports and auto-hide"
```

---

## Phase F — Mobile

> All deal data is ONLINE-ONLY via TanStack Query (`staleTime: 30_000`). No WatermelonDB. Vote/create writes carry an `Idempotency-Key` from `newIdempotencyKey()` (M0c). Components consume `useTheme()` tokens; never raw values.

### Task F1: Deals TanStack hooks

**Files:**
- Create: `apps/mobile/src/api/deals.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/mobile/src/api/deals.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Deal, DealCreate, DealPatch, DealSort } from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

type Page = { items: Deal[]; cursor: string | null };

export function useDealFeed(sort: DealSort = 'score') {
  return useInfiniteQuery<Page>({
    queryKey: ['deals', sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Page>(`/deals?sort=${sort}${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => apiClient.get<Deal>(`/deals/${id}`),
    staleTime: 30_000,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DealCreate) =>
      apiClient.post<Deal>('/deals', input, { headers: { 'idempotency-key': newIdempotencyKey() } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DealPatch }) =>
      apiClient.patch<Deal>(`/deals/${id}`, patch),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal', id] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/deals/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function castDealVote(dealId: string, value: -1 | 1): Promise<void> {
  return apiClient.post<void>(`/deals/${dealId}/vote`, { value }, {
    headers: { 'idempotency-key': newIdempotencyKey() },
  });
}

export function clearDealVote(dealId: string): Promise<void> {
  return apiClient.delete<void>(`/deals/${dealId}/vote`);
}
```

- [ ] **Step 2: Typecheck** (`pnpm --filter @expyrico/mobile typecheck` → exit 0).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/api/deals.ts
git commit -m "feat(mobile): TanStack hooks for deals feed + CRUD + vote"
```

---

### Task F2: useOptimisticDealVote hook

**Files:**
- Create: `apps/mobile/src/features/deals/useOptimisticDealVote.ts`

- [ ] **Step 1: Write the hook** (mirrors M2's `useOptimisticVote`, keyed on `['deals']` pages)

```ts
// apps/mobile/src/features/deals/useOptimisticDealVote.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Deal } from '@expyrico/shared';
import { castDealVote, clearDealVote } from '../../api/deals';

type Next = -1 | 1 | 0;
interface MutationVars { next: Next; prev: -1 | 1 | null }

export function useOptimisticDealVote(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ next }: MutationVars) =>
      next === 0 ? clearDealVote(dealId) : castDealVote(dealId, next),
    onMutate: async ({ next, prev }) => {
      await qc.cancelQueries({ queryKey: ['deals'] });
      const snapshots = qc.getQueriesData<{ pages: { items: Deal[] }[] }>({ queryKey: ['deals'] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData(key, {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((d) => (d.id === dealId ? applyDelta(d, prev, next) : d)),
          })),
        });
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

function applyDelta(deal: Deal, prev: -1 | 1 | null, next: Next): Deal {
  let up = deal.upvoteCount;
  let down = deal.downvoteCount;
  if (prev === 1) up -= 1;
  if (prev === -1) down -= 1;
  if (next === 1) up += 1;
  if (next === -1) down += 1;
  return {
    ...deal,
    upvoteCount: Math.max(0, up),
    downvoteCount: Math.max(0, down),
    myVote: next === 0 ? null : (next as -1 | 1),
  };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add apps/mobile/src/features/deals/useOptimisticDealVote.ts
git commit -m "feat(mobile): optimistic deal vote hook with rollback"
```

---

### Task F3: DealCard component

**Files:**
- Create: `apps/mobile/src/features/deals/DealCard.tsx`
- Create: `apps/mobile/__tests__/DealCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/__tests__/DealCard.test.tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealCard } from '../src/features/deals/DealCard';
import type { Deal } from '@expyrico/shared';

jest.mock('../src/api/deals', () => ({
  castDealVote: jest.fn().mockResolvedValue(undefined),
  clearDealVote: jest.fn().mockResolvedValue(undefined),
}));

const deal: Deal = {
  id: 'd-1',
  userId: 'u-1',
  productId: 'p-1',
  price: 3.49,
  currency: 'USD',
  storeName: 'Aldi',
  photoUrl: null,
  expiryDate: null,
  note: 'half price',
  upvoteCount: 3,
  downvoteCount: 1,
  score: 0.4,
  status: 'visible',
  createdAt: '2026-05-26T00:00:00.000Z',
  updatedAt: '2026-05-26T00:00:00.000Z',
  myVote: null,
  product: { id: 'p-1', name: 'Oat Milk', brand: 'Acme', imageUrl: null },
  author: { id: 'u-1', firstName: 'Ada', avatarUrl: null },
};

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe('DealCard', () => {
  it('renders product name, price and store', () => {
    const { getByText } = render(wrap(<DealCard deal={deal} onReport={() => {}} />));
    expect(getByText('Oat Milk')).toBeTruthy();
    expect(getByText(/Aldi/)).toBeTruthy();
  });

  it('optimistically increments upvote count on thumb-up tap', async () => {
    const { getByLabelText, getByText } = render(wrap(<DealCard deal={deal} onReport={() => {}} />));
    fireEvent.press(getByLabelText('upvote'));
    await waitFor(() => expect(getByText('4')).toBeTruthy());
  });

  it('opens the report sheet on long-press', () => {
    const onReport = jest.fn();
    const { getByLabelText } = render(wrap(<DealCard deal={deal} onReport={onReport} />));
    fireEvent(getByLabelText('deal-d-1'), 'longPress');
    expect(onReport).toHaveBeenCalledWith(deal);
  });
});
```

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Write `apps/mobile/src/features/deals/DealCard.tsx`**

```tsx
// apps/mobile/src/features/deals/DealCard.tsx
import { Pressable, Text, View } from 'react-native';
import type { Deal } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { useOptimisticDealVote } from './useOptimisticDealVote';

interface Props {
  deal: Deal;
  onReport: (deal: Deal) => void;
  onPress?: (deal: Deal) => void;
  isOwn?: boolean;
}

export function DealCard({ deal, onReport, onPress, isOwn }: Props) {
  const t = useTheme();
  const vote = useOptimisticDealVote(deal.id);

  function press(next: -1 | 1) {
    const prev = deal.myVote ?? null;
    vote.mutate({ next: prev === next ? 0 : next, prev });
  }

  const priceLabel = `${deal.currency} ${deal.price.toFixed(2)}`;

  return (
    <Pressable
      accessibilityLabel={`deal-${deal.id}`}
      onPress={() => onPress?.(deal)}
      onLongPress={() => onReport(deal)}
      style={{
        backgroundColor: t.colors.bgElevated,
        borderRadius: t.radii.lg,
        padding: t.spacing.lg,
        marginVertical: t.spacing.sm,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16, flex: 1 }}>
          {deal.product?.name ?? 'Product'}
        </Text>
        <Text style={{ color: t.colors.primary, fontWeight: '700' }}>{priceLabel}</Text>
      </View>
      <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>
        at {deal.storeName}
        {deal.expiryDate ? ` · until ${deal.expiryDate}` : ''}
      </Text>
      {deal.note ? <Text style={{ color: t.colors.text, marginTop: 6 }}>{deal.note}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 16, alignItems: 'center' }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
          {deal.author?.firstName ?? 'User'}
        </Text>
        {!isOwn && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="upvote"
              onPress={() => press(1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: deal.myVote === 1 ? t.colors.success : t.colors.textMuted }}>▲</Text>
              <Text style={{ color: t.colors.text }}>{deal.upvoteCount}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="downvote"
              onPress={() => press(-1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: deal.myVote === -1 ? t.colors.danger : t.colors.textMuted }}>▼</Text>
              <Text style={{ color: t.colors.text }}>{deal.downvoteCount}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Verify PASS** (3 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/deals/DealCard.tsx apps/mobile/__tests__/DealCard.test.tsx
git commit -m "feat(mobile): DealCard with optimistic vote and long-press report"
```

---

### Task F4: DealFeed component

**Files:**
- Create: `apps/mobile/src/features/deals/DealFeed.tsx`

- [ ] **Step 1: Write the component** (sort tabs Top/Newest + infinite scroll)

```tsx
// apps/mobile/src/features/deals/DealFeed.tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { Deal, DealSort } from '@expyrico/shared';
import { useDealFeed } from '../../api/deals';
import { DealCard } from './DealCard';
import { useTheme } from '../../theme/useTheme';

const SORTS: { id: DealSort; label: string }[] = [
  { id: 'score', label: 'Top' },
  { id: 'new', label: 'Newest' },
];

interface Props {
  currentUserId: string | null;
  onOpen: (deal: Deal) => void;
  onReport: (deal: Deal) => void;
}

export function DealFeed({ currentUserId, onOpen, onReport }: Props) {
  const t = useTheme();
  const [sort, setSort] = useState<DealSort>('score');
  const q = useDealFeed(sort);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: t.spacing.md }}>
        {SORTS.map((s) => {
          const selected = s.id === sort;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSort(s.id)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: t.radii.pill,
                backgroundColor: selected ? t.colors.primary : t.colors.bgElevated,
              }}
            >
              <Text style={{ color: selected ? t.colors.primaryFg : t.colors.text, fontWeight: '500' }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.xxl }}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            onReport={onReport}
            onPress={onOpen}
            isOwn={item.userId === currentUserId}
          />
        )}
        onEndReached={() => q.hasNextPage && q.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: t.colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              No deals yet. Share one!
            </Text>
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator /> : null}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add apps/mobile/src/features/deals/DealFeed.tsx
git commit -m "feat(mobile): DealFeed with sort tabs + infinite scroll"
```

---

### Task F5: DealForm component (post/edit)

**Files:**
- Create: `apps/mobile/src/features/deals/DealForm.tsx`
- Create: `apps/mobile/__tests__/DealForm.test.tsx`

> Product is picked via the M1 product search/scan reuse. The form receives a `product` (id + name) from that flow. Price + store are required; photo, expiry, note are optional. The optional photo is uploaded via the M0b avatar multipart pattern to obtain a `photoUrl` before submit; the form passes `photoUrl` into the create body.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/__tests__/DealForm.test.tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealForm } from '../src/features/deals/DealForm';

const create = jest.fn().mockResolvedValue({ id: 'd-1' });
jest.mock('../src/api/deals', () => ({
  useCreateDeal: () => ({ mutateAsync: create, isPending: false }),
  useUpdateDeal: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

function wrap(node: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>;
}

describe('DealForm', () => {
  beforeEach(() => create.mockClear());

  it('blocks submit until price and store are filled', () => {
    const { getByText } = render(
      wrap(<DealForm product={{ id: 'p-1', name: 'Oat Milk' }} onDone={() => {}} />),
    );
    fireEvent.press(getByText('Post deal'));
    expect(create).not.toHaveBeenCalled();
  });

  it('submits a valid deal', async () => {
    const onDone = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(<DealForm product={{ id: 'p-1', name: 'Oat Milk' }} onDone={onDone} />),
    );
    fireEvent.changeText(getByLabelText('price'), '3.49');
    fireEvent.changeText(getByLabelText('store'), 'Aldi');
    fireEvent.press(getByText('Post deal'));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'p-1', price: 3.49, storeName: 'Aldi' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement `apps/mobile/src/features/deals/DealForm.tsx`**

```tsx
// apps/mobile/src/features/deals/DealForm.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Deal } from '@expyrico/shared';
import { useCreateDeal, useUpdateDeal } from '../../api/deals';
import { useTheme } from '../../theme/useTheme';

interface Props {
  product: { id: string; name: string };
  existing?: Deal;
  onDone: () => void;
}

export function DealForm({ product, existing, onDone }: Props) {
  const t = useTheme();
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [storeName, setStoreName] = useState(existing?.storeName ?? '');
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateDeal();
  const update = useUpdateDeal();
  const pending = create.isPending || update.isPending;

  async function submit() {
    setError(null);
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !storeName.trim()) {
      setError('Enter a valid price and store.');
      return;
    }
    const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ? expiryDate : undefined;
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          patch: { price: parsedPrice, storeName: storeName.trim(), expiryDate: expiry ?? null, note: note.trim() || null },
        });
      } else {
        await create.mutateAsync({
          productId: product.id,
          price: parsedPrice,
          storeName: storeName.trim(),
          expiryDate: expiry,
          note: note.trim() || undefined,
        });
      }
      onDone();
    } catch {
      setError('Could not save your deal.');
    }
  }

  const field = {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radii.md,
    padding: 12,
    color: t.colors.text,
  } as const;

  return (
    <View style={{ gap: t.spacing.md, padding: t.spacing.lg }}>
      <Text style={{ color: t.colors.text, fontSize: 20, fontWeight: '700' }}>
        {existing ? 'Edit deal' : `Deal for ${product.name}`}
      </Text>
      <TextInput
        accessibilityLabel="price"
        placeholder="Price"
        placeholderTextColor={t.colors.textMuted}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="store"
        placeholder="Store name"
        placeholderTextColor={t.colors.textMuted}
        value={storeName}
        onChangeText={setStoreName}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="expiry"
        placeholder="Expiry (yyyy-mm-dd, optional)"
        placeholderTextColor={t.colors.textMuted}
        value={expiryDate}
        onChangeText={setExpiryDate}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="note"
        placeholder="Note (optional)"
        placeholderTextColor={t.colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
        editable={!pending}
        style={[field, { minHeight: 80, textAlignVertical: 'top' }]}
      />
      {error ? <Text style={{ color: t.colors.danger }}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={submit}
        style={{ padding: 14, borderRadius: t.radii.md, backgroundColor: t.colors.primary, alignItems: 'center' }}
      >
        <Text style={{ color: t.colors.primaryFg, fontWeight: '600' }}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Post deal'}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Verify PASS** (2 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/deals/DealForm.tsx apps/mobile/__tests__/DealForm.test.tsx
git commit -m "feat(mobile): DealForm (post/edit) with price/store/expiry/note"
```

---

### Task F6: Deals tab + detail + new screens

**Files:**
- Create: `apps/mobile/app/(app)/(tabs)/deals.tsx`
- Create: `apps/mobile/app/(app)/deal/[id].tsx`
- Create: `apps/mobile/app/(app)/deal/new.tsx`

> Add a `deals` tab to the existing bottom tab navigator (M0c). The `new` screen reuses the M1 product search/scan to pick a product, then renders `DealForm`. The report action reuses the M2 `ReportModal` (`target.type = 'deal'`).

- [ ] **Step 1: Write `apps/mobile/app/(app)/(tabs)/deals.tsx`** — the feed tab; wires `DealFeed` to `router.push('/deal/[id]')`, a "Post a deal" button to `/deal/new`, and the M2 `ReportModal` for long-press report.

- [ ] **Step 2: Write `apps/mobile/app/(app)/deal/[id].tsx`** — detail screen via `useDeal(id)`; shows product, price, store, expiry, note, author; owner sees Edit/Delete (calls `useUpdateDeal`/`useDeleteDeal`); non-owner sees vote + report.

- [ ] **Step 3: Write `apps/mobile/app/(app)/deal/new.tsx`** — product picker (reuse `useProductSearch` / scan from M1/M2) → on select renders `DealForm`; on done `router.back()`.

- [ ] **Step 4: Register the `deals` tab** in the M0c tab layout (`apps/mobile/app/(app)/(tabs)/_layout.tsx`) with an icon + title "Deals".

- [ ] **Step 5: Typecheck** (`pnpm --filter @expyrico/mobile typecheck` → exit 0).

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/deals.tsx" "apps/mobile/app/(app)/deal" "apps/mobile/app/(app)/(tabs)/_layout.tsx"
git commit -m "feat(mobile): deals tab, detail, and post-deal screens"
```

---

### Task F7: Maestro E2E for deals

**Files:**
- Create: `apps/mobile/.maestro/deals-flow.yaml`

- [ ] **Step 1: Write the flow** — sign in (reuse M0c `sign-in.yaml`) → Deals tab → Post a deal → pick seeded product → enter price + store → Post → assert deal visible → long-press a sibling deal → Report → pick reason → Submit.

```yaml
appId: com.expyrico.app
name: Deals flow — post, vote, report
tags:
  - deals
---
- launchApp:
    clearState: true
- runFlow: ./sign-in.yaml
- tapOn: "Deals"
- tapOn: "Post a deal"
- inputText: "Oat"
- tapOn:
    text: "Oat Milk"
    index: 0
- tapOn:
    id: "price"
- inputText: "3.49"
- tapOn:
    id: "store"
- inputText: "Aldi"
- tapOn: "Post deal"
- assertVisible: "Aldi"
- longPressOn:
    id: "deal-d-1"
- assertVisible: "Report"
- tapOn: "Spam"
- tapOn: "Submit"
- assertNotVisible: "Submit"
```

> NOTE: assumes M0c's reusable `sign-in.yaml` and a seeded fixture product `Oat Milk` + deal id `d-1`. If Maestro is unavailable locally, skip — CI nightly runs it.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/.maestro/deals-flow.yaml
git commit -m "test(mobile): Maestro E2E for deal post + vote + report"
```

---

## Phase G — Admin moderation

> M3 ships the admin app, page pattern, `serverAdminApi`/`browserAdminApi`, `writeAuditLog`, CSRF, and a generic report queue. M5 adds a deals moderation page and renders `deal`-type reports in that queue.

### Task G1: Admin API client methods + admin deal routes

**Files:**
- Modify: `apps/admin/src/lib/admin-api.ts`
- Create: `api/src/routes/admin/deals.ts` (admin list + status change)
- Modify: `api/src/routes/admin/index.ts` (register)

- [ ] **Step 1: Add admin API surface** — `GET /v1/admin/deals?status=&cursor=` (lists all deals incl. hidden, admin-gated via `app.requireAdmin`) and `PATCH /v1/admin/deals/:id/status` (body `{ status: 'visible'|'hidden'|'deleted' }`). Both audit-logged in the route via `writeAuditLog`-equivalent server-side or surfaced for the admin server action to log.

```ts
// api/src/routes/admin/deals.ts (sketch — full handler in implementation)
// GET /v1/admin/deals: requireAdmin, optional ?status filter, cursor paginate, returns toApiDeal[]
// PATCH /v1/admin/deals/:id/status: requireAdmin, validate status enum, update, return updated deal
```

- [ ] **Step 2: Write a failing API test** `api/tests/integration/admin-deals.test.ts` asserting: non-admin → 403; admin lists hidden deals; admin can flip a deal `hidden`→`visible` and `visible`→`deleted`.

- [ ] **Step 3: Implement, verify PASS, commit**

```bash
git add api/src/routes/admin api/tests/integration/admin-deals.test.ts
git commit -m "feat(api): admin deal list + status change routes"
```

- [ ] **Step 4: Add `listDeals` + `setDealStatus` to `apps/admin/src/lib/admin-api.ts`** (server + browser variants per M3 pattern).

```bash
git add apps/admin/src/lib/admin-api.ts
git commit -m "feat(admin): admin-api deal list + status helpers"
```

---

### Task G2: Deals moderation page + server actions

**Files:**
- Create: `apps/admin/src/app/deals/page.tsx`
- Create: `apps/admin/src/app/deals/deal-actions.ts`

- [ ] **Step 1: Write `deals/page.tsx`** — table of deals with a status filter (all / visible / hidden / deleted), columns: product, price+currency, store, author, status, score, createdAt, with Hide / Restore / Delete actions. Follows the M3 admin page pattern; reads via `serverAdminApi.listDeals(...)`.

- [ ] **Step 2: Write `deals/deal-actions.ts`** — server actions `hideDeal(id)`, `restoreDeal(id)`, `deleteDeal(id)` that call `setDealStatus` AND `writeAuditLog({ adminId, action: 'deal.hide'|'deal.restore'|'deal.delete', targetType: 'deal', targetId: id, requestId, ip })`. CSRF per M3.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/deals
git commit -m "feat(admin): deals moderation page with audit-logged actions"
```

---

### Task G3: Render deal previews in the report queue

**Files:**
- Modify: `apps/admin/src/features/reports/ReportPreview.tsx`

- [ ] **Step 1: Add a `deal` case** to the report-preview switch so the M3 report queue renders a deal preview (product name, price+currency, store, author, status) when `report.targetType === 'deal'`, with a link to the deals moderation page row. The generic queue, resolve/dismiss flow, and `>3` auto-hide are unchanged (auto-hide already wired in Task B2).

> **Stored-XSS guard (REQUIRED):** `storeName` and `note` are user-supplied. Render them as React text children only (`{deal.storeName}`, `{deal.note}`) — React escapes these by default. NEVER pass them through `dangerouslySetInnerHTML` or any raw-HTML sink, here OR in the moderation table (Task G2). The same applies to any author/product fields surfaced from user input.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/features/reports/ReportPreview.tsx
git commit -m "feat(admin): render deal previews in report queue"
```

---

### Task G4: Playwright E2E for deals moderation

**Files:**
- Create: `apps/admin/e2e/deals-moderation.spec.ts`

- [ ] **Step 1: Write the spec** — admin logs in, opens `/deals`, filters to `hidden`, restores a hidden deal, then hides a visible one; asserts the row status updates and (optionally) that an audit-log entry appears in the audit view. Follows the M3 Playwright auth fixture.

- [ ] **Step 2: Run + commit**

```bash
git add apps/admin/e2e/deals-moderation.spec.ts
git commit -m "test(admin): Playwright E2E for deals moderation"
```

---

## Phase H — Final verification

### Task H1: Full suites + typecheck + lint

- [ ] **Step 1: API test suite**

```bash
pnpm --filter @expyrico/api test
```
Expected: all pass, including the new files:
- `integration/deals-feed.test.ts` — 7 (incl. country-scoped filter, no-country viewer global fallback, null-country deal globally visible)
- `integration/deals-crud.test.ts` — create (7: incl. CDN-photoUrl SSRF guard + create rate limit + country stamp) + get (3) + update (3) + delete (2)
- `integration/deals-vote.test.ts` — 7 (incl. synchronous-recompute assertion + vote rate limit)
- `integration/deals-report-autohide.test.ts` — 4
- `integration/admin-deals.test.ts` — 3

There is NO `deal-score-recalc` debounce unit test or worker integration test — score recompute is synchronous in the vote route (covered by `deals-vote.test.ts`).

All prior M0–M3 tests must still pass.

- [ ] **Step 2: Mobile tests**

```bash
pnpm --filter @expyrico/mobile test
```
Expected: `DealCard.test.tsx` (3), `DealForm.test.tsx` (2) plus all prior tests pass.

- [ ] **Step 3: Admin tests**

```bash
pnpm --filter @expyrico/admin test
pnpm --filter @expyrico/admin exec playwright test deals-moderation
```

- [ ] **Step 4: Repo-wide typecheck + format**

```bash
pnpm typecheck
pnpm exec prettier --check .
```
Expected: exit 0. If format fails: `pnpm exec prettier --write .` and re-check.

- [ ] **Step 5: Manual smoke against the running API**

In one terminal `pnpm --filter @expyrico/api dev`; in another:

```bash
curl -s -X POST http://localhost:4000/v1/deals \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"productId":"<product-id>","price":3.49,"storeName":"Aldi","note":"half price"}' | jq
```
Expected: HTTP 201, `status: "visible"`, `currency` populated.

```bash
curl -s "http://localhost:4000/v1/deals?sort=score" | jq
```
Expected: HTTP 200, the new deal present.

- [ ] **Step 6: Tag the milestone**

```bash
git tag m5-complete
```

---

## Self-review checklist

Run through these before declaring M5 done.

**1. Spec coverage**

- §2.12 deal links to a catalog product with price + store + optional photo/expiry; browsable feed; reportable — Tasks A1, A5, D1–D7, D10.
- Country-scoped feed: `deals.country` stamped from poster `users.country` (§2.9); `GET /v1/deals` filters to the viewer's country with a GLOBAL fallback when the viewer has no country; `(country, status, score desc, created_at desc)` index — Tasks A1 (column + index), A4 (factory), A5 (Zod `country`), B1 (`toApiDeal`), D2 (feed filter), D4 (create stamp), D1/D3 (tests). Country drives DISCOVERY only, not currency.
- §2.12/§2.7 up/down vote, one per (user, deal), change/remove, denormalized counts + Wilson recomputed SYNCHRONOUSLY in the vote transaction (no background job/worker) — Tasks A1 (`deal_votes`), B1 (`recomputeDealScore`), D8, D9.
- §2.8 reporting + `>3` auto-hide — Tasks A5 (`deal` enum, added in its OWN migration per Task A2), B2 (`maybeAutoHide` branch), D10. Threshold is the M2 spec literal `> 3`; no settings import.
- Rate limits: `POST /v1/deals` 10/min/user, vote routes 30/min/user — Tasks D3/D4 + D8/D9, with 429 assertions.
- SSRF/XSS hardening: `photoUrl` restricted to app CDN host (schema + route re-check, never server-fetched); `storeName`/`note` escaped in admin preview (Task G3).
- Mobile deals surface (feed, detail, post form, optimistic vote, report) — Tasks F1–F7.
- Admin moderation + report-queue deal previews — Tasks G1–G4.

**2. Placeholder scan**

- No "TBD" / "see Task N" / handwaved error handling in the implemented code blocks. Phase F6 and G1–G4 screens are described with explicit wiring (hooks/actions named) rather than full source where they are thin glue over already-written hooks; their tests/asserts are concrete.

**3. Type & contract consistency**

- Wire camelCase ↔ DB snake_case via `@map`: `storeName`/`store_name`, `photoUrl`/`photo_url`, `expiryDate`/`expiry_date`, `upvoteCount`/`upvote_count`, `downvoteCount`/`downvote_count`, `createdAt`/`created_at`, `updatedAt`/`updated_at`. `price` `Decimal(10,2)`→`Number()` in `toApiDeal`→`number` in `dealSchema`. `score` `Decimal(7,6)`→`number` 0..1.
- `value: -1 | 1` union everywhere: `dealVoteSchema`, `castDealVote`, `useOptimisticDealVote`, `recomputeDealScore`; `0` is internal to the optimistic hook only.
- `DealStatus` (`visible | hidden | deleted`) identical in Prisma, Zod (`dealStatusSchema`), routes, and mobile cards.
- `recomputeDealScore(tx, dealId)` runs in the same transaction as the vote upsert/delete; no queue, no `enqueue*` helper.
- `photoUrl` constrained to `DEAL_PHOTO_CDN_HOST` in Zod (`photoUrlField`) AND re-checked server-side in the create route (`assertCdnHost`).
- `currency` is an optional request field defaulting to `'USD'` server-side; no country→currency *derivation*. Distinct from country: `deals.country` IS stamped from the poster's `users.country` (available from signup, §2.9) and drives the country-scoped feed (DISCOVERY only). `country` is server-derived, NOT a client field in `dealCreateSchema`.
- `ReportTargetType` includes `deal` in Zod and the Prisma enum (added in a standalone migration); `maybeAutoHide` handles `deal`; the M2 reports route `targetExists` recognizes `deal`.
- Error codes are snake_case: `deal_not_found`, `cannot_vote_own_deal`.
- `Idempotency-Key` header lowercase in both route opt-in (`config.idempotent`) and client (`'idempotency-key': newIdempotencyKey()`); applied to `POST /v1/deals` and the vote upsert.

**4. Cross-milestone assumption audit**

- `app.requireAuth` / `app.requireAdmin`, `issueAccessToken`, `AppError`, `ERROR_CODES`, `getPrisma`, `getRedis`, test harness, `makeUser`/`makeProduct` → M0a/M0b/M1/M2. `makeUser` accepts a `country` override (the `users.country` column exists from M0b; populated from IP at signup per §2.9) — used by the country-scoped feed tests.
- `wilsonLowerBound` reused from M2 (`api/src/services/reviews/wilson.ts`) — NOT re-implemented.
- `maybeAutoHide` + `reports` table + `reportTargetTypeSchema` → M2; M5 extends them (enum value + branch), does NOT generalize `review_votes`. The `deal` enum value is added in its OWN migration (Postgres forbids referencing a new enum label in the txn that adds it).
- M5 adds NO BullMQ queue/worker and does NOT edit M1's `getAllQueues()` or `runner.ts` — score recompute is synchronous (`recomputeDealScore`). This avoids the cross-milestone runner edit collision.
- Per-route rate limits use the M0a global `@fastify/rate-limit` plugin via `config.rateLimit` route overrides; keyed on user id.
- Idempotency plugin → M0a/M1; opted into via `config: { idempotent: 'required' }`.
- Mobile `apiClient`, `useTheme`, `useSessionStore`, `newIdempotencyKey`, M1 product search/scan, M2 `ReportModal` → reused, not rebuilt.
- Admin page pattern, `serverAdminApi`/`browserAdminApi`, `writeAuditLog`, CSRF, generic report queue → M3; extended for deals (`storeName`/`note` rendered as escaped text).
- Deal photo upload reuses the M0b avatar-style multipart pattern; no new upload endpoint is required (create body accepts the resulting app-CDN `photoUrl`, never a server-fetched URL).

**5. Out-of-scope discipline**

- No geolocation/maps/price-history; no offline write queue for deals (online-only TanStack); no in-app messaging; no deal-driven points (referral-only in M7); no configurable auto-hide threshold.

---

## Handoff to M6

M6 (blessing / giveaway) will:

1. Layer the giveaway listing → request → recipient-selection → mutual transaction-rating flow on top of the same content/report/auto-hide patterns established here and in M2.
2. Reuse the M2 `maybeAutoHide` helper if giveaways become reportable — add a `giveaway` enum value (in its OWN migration) and branch the same way M5 added `deal`.
3. Reuse the M0b avatar-style multipart upload pattern for giveaway item photos, constraining any photo URL to the app CDN host as M5 does.
4. If giveaways need denormalized scoring, prefer M5's synchronous in-transaction recompute over a worker unless a measured hot path justifies one.

Notes for downstream milestones:

- M5 ships NO BullMQ worker; vote-driven score/count recompute is synchronous in the vote transaction (`recomputeDealScore`). If a future milestone truly needs background processing, register its worker in M1's canonical runner `api/src/workers/runner.ts`.
- New Postgres enum values must be added in a standalone migration before any code/migration references them.
- The auto-hide threshold remains the spec literal `> 3` in `maybeAutoHide`; if an admin-configurable override is ever introduced, it should default to 3 and be a clean additive change (no settings import exists yet).
