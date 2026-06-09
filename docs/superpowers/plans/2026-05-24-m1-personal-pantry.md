# M1 — Personal Pantry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the personal-pantry vertical end-to-end: a shared `products` catalogue with external lookup (Open Food Facts → UPCitemdb), private `records` with offline-first sync, barcode/QR scanning, on-device OCR for expiry dates, and Expo Push notifications scheduled via BullMQ.

**Architecture:** Backend adds `products`, `product_edits`, `records`, `push_tokens`, and `push_logs` tables to Prisma. External product APIs are wrapped in `opossum` circuit breakers and called through `undici`; the synchronous lookup hierarchy is local → OFF → UPCitemdb → null, with a background `product-lookup` BullMQ job for slow backfill. Records are idempotent on `client_id` (Redis-backed `Idempotency-Key` middleware) and notifications are scheduled by a `notification-schedule` worker that fans out delayed `notification-send` jobs to the Expo Push API. Mobile reads/writes go through WatermelonDB; a sync engine pushes/pulls through `/v1/records/sync` on app foreground, network reconnect, after each local write, and every 5 minutes while foregrounded. Scanning uses one `expo-camera` `CameraView` flow (its built-in barcode scanner) that handles UPC-A/EAN-13/QR; expiry capture is either manual date picker or `@react-native-ml-kit/text-recognition` OCR parsed by a `parseExpiryString` helper.

**Tech Stack:** Fastify 4, Prisma 5, Postgres 16 (with `pg_trgm`), Redis 7, Zod 3, BullMQ 5, `opossum` 8, `undici` 6, `expo-server-sdk`, Vitest + Supertest, Expo SDK (latest stable), Expo Router, Zustand, TanStack Query, NativeWind, WatermelonDB, `expo-camera` (built-in `CameraView` barcode scanning), `@react-native-ml-kit/text-recognition`, `expo-notifications`, `@react-native-community/netinfo`, React Native Testing Library, Maestro.

**Spec reference:** `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` sections 2.2–2.5, 2.11, 4.3, 5, 6.2, 6.3, 6.6, 7.

**Prerequisites:** Per the backend-first execution order, prereqs split by track. Track A (backend phases A–I) does NOT depend on M0c — backend phases touch only `api/`, `packages/shared`, and Postgres. M0c is required only when Track B (mobile phases J–Q) begins.

**Track A (backend, build now) prerequisites:** M0a + M0b complete. Specifically:

- `@expyrico/shared` (Zod schemas)
- `api/src/server.ts`, `api/src/config.ts`, `api/src/db.ts`, `api/src/redis.ts`, `api/src/errors.ts`
- `api/src/plugins/auth.ts` (`req.user`, `app.requireAuth`)
- `api/src/services/users/repository.ts`
- `api/tests/helpers/setup.ts` and `factories.ts`

**Track B (mobile, deferred) — additional prerequisite:** M0c complete.

- Mobile: `apps/mobile/src/api/client.ts`, secure session store, theme provider with `useTheme()` from M0c.

**Out of scope for M1:**

- Reviews, votes, Wilson score, product reviews list, report submission (M2)
- Admin review of `product_edits`, admin pages, admin audit log entries (M3)
- Theme polish, app store submission (M4)

**Architecture decision: product edits.** The spec is ambiguous on whether user-suggested product edits live on the main `products` row (`status='pending'`) or in a side table. This plan picks a side table `product_edits` with a JSON `proposed` payload and `status enum(pending, approved, rejected)`. Reasons: (1) the live product row stays `active` and visible during review, (2) multiple competing edits can stack without overwriting, (3) the M3 admin queue maps cleanly to a list of `product_edits` rows. M3 will add the admin endpoints that resolve them (writing `resolvedBy`/`resolvedAt`/`notes`).

**Architecture decision: notification preferences.** Spec §2.5 mentions per-user override of the default reminder schedule. This plan adds `users.notificationPreferences Json?` with shape `{ "offsetsDays": number[] }`. Default (when null) is `[7, 3, 1, 0]` (7 days before, 3 days before, 1 day before, on the expiry day). Per-record overrides are stored inside the existing `records.notify_at jsonb` (already in the spec) — that field holds the *resolved* absolute timestamps, not the offsets.

---

## Requirement revision — 2026-06-08 (Expyrico)

Canonical contract: `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` (2026-06-08 revision). These supersede the 2026-05-26 blocks below where they conflict:

1. **Brand → Expyrico.** Monorepo root `expyrico/`, packages `@expyrico/*`, deep-link `expyrico://record/:id`. (Generic noun "pantry" = the personal-items feature, unchanged.)
2. **Reminder default → `[7, 3, 1, 0]`** (7/3/1/0 days). Supersedes feature-addition 1 and validation item 6's `[7,3,1,0]` fallback. Per-user `notificationPreferences.offsetsDays` and per-request `notificationOffsetsDays` still take precedence. Tapping a push deep-links to the record (`expyrico://record/:id`).
3. **Record fields.** `records` gains `category` (text, drives dashboard filter), `price` (numeric, accordion), `store` (text, accordion). All optional except `name`/`custom_name` and `expiry_date`. `AddRecordForm` surfaces price+store in a collapsed accordion. Manual-entry name field auto-suggests from OFF (`GET /v1/products/search`).
4. **Community-rating eligibility flag.** `products.is_community_eligible` (boolean) — true when barcode-sourced. Replaces feature-addition 3's taste/value columns with the three-option tallies (`buy_again_count`, `buy_again_on_sale_count`, `wont_buy_count`, `rating_count`, `review_count`), all default 0; M2 fills them. M1 only defines columns/field names.
5. **Dashboard.** `expiryStatus` → green/amber/red where **amber = within the user's `expiring_soon_threshold_days` (default 7)**, red = expired/today, green = beyond threshold. Home shows a summary count header (Good/Expiring-soon/Expired) and a category filter. Supersedes feature-addition 2's hardcoded 1–3 day amber band.
6. **Duplicate action.** `POST /v1/records/:id/duplicate` copies all fields except `expiry_date`. Mobile record-detail gains a "Duplicate" action.
7. **Item limit.** 50 active-record cap. `POST /v1/records` returns `409 item_limit_reached` at the cap; `GET /v1/me/usage` returns `{ itemCount, itemLimit: 50, readOnly }`. Mobile enters read-only add mode at the cap (reminders still fire) with an upgrade-prompt CTA.
8. **Referral activation hook.** When a record create pushes a user's lifetime item count to 5, enqueue/trigger the M7 `referral-activation` check (passive; no rewards in v1.x).

---

## Validation amendments — 2026-05-26

The following corrections were applied after a validation pass. They define contracts that M2/M3 depend on; treat them as canonical.

1. **`getQueueConnection()` returns a raw `ConnectionOptions`** — not a `{ connection: ... }` wrapper. Every queue/worker construction passes it as `new Queue(name, { connection: getQueueConnection() })` / `new Worker(name, processor, { connection: getQueueConnection() })`. This avoids the double-wrap that downstream milestones (which already pass `connection: getQueueConnection()`) would otherwise hit.
2. **The worker registry lives at `api/src/workers/runner.ts`** exposing `startWorkers()` / `stopWorkers()`. All worker processor files live under `api/src/workers/`. There is no `api/src/queues/workers.ts`. Later milestones add worker files under `api/src/workers/` and register them in `runner.ts`.
3. **`templateKey` is threaded through the notification job chain.** `push_logs.templateKey` is `NOT NULL`, so `NotificationSendJob` now carries `templateKey`; the `notification-schedule` worker sets a default (`'expiry_reminder'`) per enqueued send job; the `notification-send` worker reads it and writes it to `push_logs`.
4. **The `/v1/me` mount is a single `meScope` sub-app** registered under `prefix: '/v1/me'`; `pushTokenRoutes` and `countrySuggestionRoute` register inside it (no path prefixes on the child routes).
5. **The `product-lookup` backfill job is actually enqueued.** On a local cache miss in `POST /v1/products/lookup`, the route enqueues a background `product-lookup` job (spec §4.3) for slow backfill.
6. **`users.notificationPreferences.offsetsDays` is wired in.** When computing `notify_at` on record create/patch and during sync, the default offsets are read from the user's `notificationPreferences.offsetsDays`, falling back to **`[7, 3, 1, 0]`** when null (⚠️ updated by 2026-06-08 revision item 2 — was `[7, 3, 1, 0]`). A per-request `notificationOffsetsDays` still takes precedence when supplied.
7. **Scanning uses `expo-camera`'s built-in `CameraView` barcode scanning** (handles UPC-A/EAN-13/QR in one flow). The removed `expo-barcode-scanner` + `onBarCodeScanned` API is no longer used.

---

## Feature additions — 2026-05-26

Three product requirements landed after the validation pass. They are reflected throughout the tasks below.

1. **Expiry reminders now default to 3 days / 1 day / day-of (`[3, 1, 0]`).** ⚠️ **SUPERSEDED by 2026-06-08 revision item 2 → `[7, 3, 1, 0]`.** A per-user `notificationPreferences.offsetsDays` override and a per-request `notificationOffsetsDays` still take precedence. This affects the notify-at helper, the create/patch/sync defaulting, and the related tests (use `[7,3,1,0]`).

2. **Home screen shows a green / amber / red expiry indicator.** A small pure helper `expiryStatus(expiryDate, now, thresholdDays)` classifies each record: **red** when it has expired or expires today, **amber** when it expires within the user's `expiring_soon_threshold_days` (default 7 — ⚠️ updated by 2026-06-08 item 5; was a fixed 1–3 day band), and **green** beyond the threshold. The indicator renders as a colored bar/dot on each record card and detail screen, using the `success` / `warning` / `danger` theme tokens (Sage `#4BAE8A` / Honey `#F5A623` / Red `#E0442A`).

3. **Products carry rating columns.** ⚠️ **SUPERSEDED by 2026-06-08 item 4.** The old taste+value columns are replaced by three-option tallies: `buy_again_count`, `buy_again_on_sale_count`, `wont_buy_count`, `rating_count`, `review_count` (all default 0), plus `is_community_eligible` (boolean). The product API exposes these as camelCase. M1 only defines the columns/field names; M2's recalc worker fills them.

---

## Execution order — backend-first (2026-05-26)

This milestone is split across two tracks per the project's backend-first sequence: build the **Backend + Admin** track to completion first, then start the **Mobile** track. Phases keep their original letters, numbering, and order — this header only sets *when* each runs.

**Track A — Backend + Admin (build now):**

- Phase A — Shared Zod schemas (products + records)
- Phase B — Database schema (Prisma migration)
- Phase C — HTTP helpers, circuit breaker, and external product clients
- Phase D — Product HTTP routes
- Phase E — Idempotency middleware
- Phase F — BullMQ queues + notify-at computation
- Phase G — Records HTTP routes
- Phase H — Push tokens
- Phase I — Workers (BullMQ)

(The shared `packages/shared` Zod schemas in Phase A serve both tracks but are owned/built in Track A.)

**Track B — Mobile (DEFERRED):**

- Phase J — Mobile: dependencies + WatermelonDB
- Phase K — Mobile: sync engine
- Phase L — Mobile: TanStack Query hooks + groupRecords helper
- Phase M — Mobile: OCR + scan
- Phase N — Mobile: record UI components
- Phase O — Mobile: screens (scan, add, home, detail, product)
- Phase P — Mobile: push token registration
- Phase Q — Mobile: Maestro E2E

**Rule:** Do NOT implement the Track B phases until the entire Backend + Admin track is complete and the Mobile track begins (which starts with M0c).

**Final verification (Phase Z) splits accordingly:** run the backend verification (Task Z1 — full API suite + repo typecheck) at the end of Track A; run the mobile verification (Task Z2 — mobile checks) at the end of Track B.

---

## File map

```
expyrico/
├── packages/shared/
│   └── src/schemas/
│       ├── product.ts                                    ← NEW
│       └── record.ts                                     ← NEW
├── api/
│   ├── prisma/
│   │   └── schema.prisma                                 ← MODIFIED (add products, product_edits, records, push_tokens, push_logs; add notificationPreferences to User)
│   ├── src/
│   │   ├── server.ts                                     ← MODIFIED (mount product/record/me routes, start workers)
│   │   ├── plugins/
│   │   │   └── idempotency.ts                            ← NEW
│   │   ├── lib/
│   │   │   ├── breaker.ts                                ← NEW (opossum factory + Redis state)
│   │   │   └── http.ts                                   ← NEW (undici fetch with timeout)
│   │   ├── services/external/
│   │   │   └── breakers.ts                               ← NEW (D11 breaker registry)
│   │   ├── services/products/
│   │   │   ├── off-client.ts                             ← NEW
│   │   │   ├── upcitemdb-client.ts                       ← NEW
│   │   │   ├── lookup.ts                                 ← NEW
│   │   │   ├── search.ts                                 ← NEW
│   │   │   └── mappers.ts                                ← NEW
│   │   ├── services/records/
│   │   │   ├── repository.ts                             ← NEW
│   │   │   ├── notify-at.ts                              ← NEW (computes timestamp array from offsets)
│   │   │   └── sync.ts                                   ← NEW (batch merge)
│   │   ├── services/push/
│   │   │   ├── expo-push.ts                              ← NEW (Expo SDK wrapper + breaker)
│   │   │   └── repository.ts                             ← NEW
│   │   ├── queues/
│   │   │   ├── index.ts                                  ← NEW (queue registry)
│   │   │   ├── product-lookup.ts                         ← NEW (queue + types)
│   │   │   ├── notification-schedule.ts                  ← NEW
│   │   │   └── notification-send.ts                      ← NEW
│   │   ├── workers/
│   │   │   ├── runner.ts                                 ← NEW (boots all workers)
│   │   │   ├── product-lookup.ts                         ← NEW
│   │   │   ├── notification-schedule.ts                  ← NEW
│   │   │   └── notification-send.ts                      ← NEW
│   │   ├── routes/products/
│   │   │   ├── index.ts                                  ← NEW
│   │   │   ├── lookup.ts                                 ← NEW
│   │   │   ├── search.ts                                 ← NEW
│   │   │   ├── get.ts                                    ← NEW
│   │   │   ├── create.ts                                 ← NEW
│   │   │   └── patch.ts                                  ← NEW
│   │   ├── routes/records/
│   │   │   ├── index.ts                                  ← NEW
│   │   │   ├── list.ts                                   ← NEW
│   │   │   ├── create.ts                                 ← NEW
│   │   │   ├── patch.ts                                  ← NEW
│   │   │   ├── delete.ts                                 ← NEW
│   │   │   └── sync.ts                                   ← NEW
│   │   └── routes/me/
│   │       ├── push-token.ts                             ← NEW
│   │       └── country-suggestion.ts                     ← NEW (D28)
│   └── tests/
│       ├── helpers/
│       │   ├── factories.ts                              ← MODIFIED (add makeProduct, makeRecord)
│       │   ├── setup.ts                                  ← MODIFIED (add new tables to truncate list)
│       │   └── fixtures/
│       │       ├── off-cola.json                         ← NEW
│       │       └── upcitemdb-soap.json                   ← NEW
│       ├── unit/
│       │   ├── notify-at.test.ts                         ← NEW
│       │   ├── product-mappers.test.ts                   ← NEW
│       │   ├── breaker.test.ts                           ← NEW
│       │   ├── breakers-registry.test.ts                 ← NEW (D11)
│       │   ├── queue-registry.test.ts                    ← NEW (D10)
│       │   ├── worker-notification-schedule.test.ts      ← NEW
│       │   └── worker-notification-send.test.ts          ← NEW
│       └── integration/
│           ├── idempotency.test.ts                       ← NEW
│           ├── products-lookup.test.ts                   ← NEW
│           ├── products-search.test.ts                   ← NEW
│           ├── products-get.test.ts                      ← NEW
│           ├── products-create.test.ts                   ← NEW
│           ├── products-patch.test.ts                    ← NEW
│           ├── records-crud.test.ts                      ← NEW
│           ├── records-sync.test.ts                      ← NEW
│           ├── push-token.test.ts                        ← NEW
│           └── country-suggestion.test.ts                ← NEW (D28)
└── apps/mobile/
    ├── package.json                                      ← MODIFIED (add deps)
    ├── app/(app)/
    │   ├── scan.tsx                                      ← NEW
    │   ├── record/[id].tsx                               ← NEW
    │   ├── product/[id].tsx                              ← NEW
    │   └── (tabs)/
    │       └── home.tsx                                  ← MODIFIED (replace stub with grouped record list)
    └── src/
        ├── db/
        │   ├── index.ts                                  ← NEW (watermelon database singleton)
        │   ├── schema.ts                                 ← NEW (watermelon schema)
        │   ├── migrations.ts                             ← NEW
        │   ├── models/
        │   │   ├── Record.ts                             ← NEW
        │   │   └── ProductCache.ts                       ← NEW
        │   ├── sync.ts                                   ← NEW (push/pull engine)
        │   └── triggers.ts                               ← NEW (AppState/NetInfo/interval)
        ├── api/
        │   ├── products.ts                               ← NEW (TanStack Query hooks)
        │   ├── records.ts                                ← NEW
        │   └── push.ts                                   ← NEW
        ├── features/
        │   ├── scan/
        │   │   ├── ScanCamera.tsx                        ← NEW
        │   │   ├── usePermission.ts                      ← NEW
        │   │   └── PrePromptModal.tsx                    ← NEW
        │   ├── records/
        │   │   ├── AddRecordForm.tsx                     ← NEW
        │   │   ├── RecordList.tsx                        ← NEW
        │   │   ├── RecordCard.tsx                        ← NEW
        │   │   ├── groupRecords.ts                       ← NEW
        │   │   └── expiryStatus.ts                       ← NEW (green/amber/red from days-to-expiry)
        │   ├── expiry/
        │   │   ├── OcrCamera.tsx                         ← NEW
        │   │   └── parseExpiryString.ts                  ← NEW
        │   └── push/
        │       └── registerPushToken.ts                  ← NEW
        └── tests/
            ├── parseExpiryString.test.ts                 ← NEW
            ├── groupRecords.test.ts                      ← NEW
            ├── expiryStatus.test.ts                      ← NEW
            ├── AddRecordForm.test.tsx                    ← NEW
            ├── ScanCamera.test.tsx                       ← NEW
            └── e2e/scan-and-save.yaml                    ← NEW (Maestro)
```

---

## Conventions (carried over from M0a/M0b)

- **TDD where logic exists.** Failing test → run → fail → implement → run → pass → commit.
- **Conventional commits.** Scopes: `api` (backend), `mobile` (mobile), `shared` (Zod schemas).
- **Every route imports its Zod schema from `@expyrico/shared`** and validates input + output.
- **Idempotency-Key required** on `POST /v1/records` (client sends `client_id` UUID).
- **RFC 7807** errors via existing `AppError` from M0a.
- **No `console.log`.** Use `req.log` on the API and the existing mobile logger.
- **Test DB:** real Postgres `expyrico_test`, truncated before each test by the M0a harness.

---

## Phase A — Shared Zod schemas (products + records)

### Task A1: Add product Zod schemas

**Files:**
- Create: `packages/shared/src/schemas/product.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Write `packages/shared/src/schemas/product.ts`**

```ts
import { z } from 'zod';

export const productSourceSchema = z.enum(['off', 'upcitemdb', 'user']);
export type ProductSource = z.infer<typeof productSourceSchema>;

export const productStatusSchema = z.enum(['active', 'pending', 'merged_into']);

const barcodeField = z
  .string()
  .trim()
  .min(6)
  .max(64)
  .regex(/^[A-Za-z0-9\-_.:]+$/, 'barcode must be alphanumeric');

const qrField = z.string().trim().min(1).max(2048);

export const productSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string().nullable(),
  qrPayload: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  defaultShelfLifeDays: z.number().int().positive().nullable(),
  source: productSourceSchema,
  sourceId: z.string().nullable(),
  isCommunityEligible: z.boolean(),
  buyAgainCount: z.number().int().min(0),
  buyAgainOnSaleCount: z.number().int().min(0),
  wontBuyCount: z.number().int().min(0),
  ratingCount: z.number().int().min(0),
  reviewCount: z.number().int().min(0),
  status: productStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Product = z.infer<typeof productSchema>;

export const productWithReviewsSchema = productSchema.extend({
  topReviews: z.array(z.unknown()),
});
export type ProductWithReviews = z.infer<typeof productWithReviewsSchema>;

export const productLookupRequestSchema = z
  .object({
    barcode: barcodeField.optional(),
    qr: qrField.optional(),
  })
  .refine((v) => Boolean(v.barcode) !== Boolean(v.qr), {
    message: 'exactly one of barcode | qr is required',
  });
export type ProductLookupRequest = z.infer<typeof productLookupRequestSchema>;

export const productLookupResponseSchema = z.object({
  product: productSchema.nullable(),
});
export type ProductLookupResponse = z.infer<typeof productLookupResponseSchema>;

export const productSearchResultSchema = z.object({
  items: z.array(productSchema),
});
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;

export const productCreateRequestSchema = z.object({
  barcode: barcodeField.nullable().optional(),
  qrPayload: qrField.nullable().optional(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  defaultShelfLifeDays: z.number().int().positive().max(3650).nullable().optional(),
});
export type ProductCreateRequest = z.infer<typeof productCreateRequestSchema>;

export const productPatchRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  defaultShelfLifeDays: z.number().int().positive().max(3650).nullable().optional(),
});
export type ProductPatchRequest = z.infer<typeof productPatchRequestSchema>;
```

- [x] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/product.js';
```

- [x] **Step 3: Typecheck**

```bash
pnpm --filter @expyrico/shared typecheck
```
Expected: exit 0.

- [x] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/product.ts packages/shared/src/index.ts
git commit -m "feat(shared): add product Zod schemas"
```

---

### Task A2: Add record Zod schemas

**Files:**
- Create: `packages/shared/src/schemas/record.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Write `packages/shared/src/schemas/record.ts`**

```ts
import { z } from 'zod';

export const recordStatusSchema = z.enum(['active', 'consumed', 'discarded', 'expired']);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const recordSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  customName: z.string().nullable(),
  category: z.string().nullable(),
  expiryDate: isoDate,
  purchaseDate: isoDate.nullable(),
  quantity: z.number().nonnegative(),
  unit: z.string().max(16),
  price: z.number().nonnegative().nullable(),
  store: z.string().nullable(),
  notes: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  status: recordStatusSchema,
  notifyAt: z.array(z.string().datetime()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
});
export type Record = z.infer<typeof recordSchema>;

export const recordCreateSchema = z
  .object({
    clientId: z.string().uuid(),
    productId: z.string().uuid().nullable().optional(),
    customName: z.string().trim().min(1).max(200).nullable().optional(),
    category: z.string().trim().max(100).nullable().optional(),
    expiryDate: isoDate,
    purchaseDate: isoDate.nullable().optional(),
    quantity: z.number().nonnegative().max(100_000).default(1),
    unit: z.string().trim().max(16).default('pcs'),
    price: z.number().nonnegative().max(1_000_000).nullable().optional(),
    store: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
    notificationOffsetsDays: z.array(z.number().int().min(0).max(365)).max(10).optional(),
  })
  .refine((v) => Boolean(v.productId) || Boolean(v.customName), {
    message: 'one of productId | customName is required',
  });
export type RecordCreate = z.infer<typeof recordCreateSchema>;

export const recordPatchSchema = z.object({
  customName: z.string().trim().min(1).max(200).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  expiryDate: isoDate.optional(),
  purchaseDate: isoDate.nullable().optional(),
  quantity: z.number().nonnegative().max(100_000).optional(),
  unit: z.string().trim().max(16).optional(),
  price: z.number().nonnegative().max(1_000_000).nullable().optional(),
  store: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  status: recordStatusSchema.optional(),
  notificationOffsetsDays: z.array(z.number().int().min(0).max(365)).max(10).optional(),
});
export type RecordPatch = z.infer<typeof recordPatchSchema>;

export const recordListResponseSchema = z.object({
  items: z.array(recordSchema),
  nextCursor: z.string().nullable(),
});
export type RecordListResponse = z.infer<typeof recordListResponseSchema>;

export const recordSyncBatchSchema = z.object({
  since: z.string().datetime().nullable().optional(),
  upserts: z
    .array(
      recordCreateSchema.unwrap().extend({
        id: z.string().uuid().optional(),
        status: recordStatusSchema.optional(),
        updatedAt: z.string().datetime(),
      }),
    )
    .max(500),
  deletes: z.array(z.string().uuid()).max(500),
});
export type RecordSyncBatch = z.infer<typeof recordSyncBatchSchema>;

export const recordSyncResponseSchema = z.object({
  serverTime: z.string().datetime(),
  changes: z.array(recordSchema),
  deletedIds: z.array(z.string().uuid()),
});
export type RecordSyncResponse = z.infer<typeof recordSyncResponseSchema>;

export const pushTokenRegisterSchema = z.object({
  expoPushToken: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, 'invalid Expo push token'),
  platform: z.enum(['ios', 'android']),
  deviceInfo: z.record(z.unknown()).optional(),
});
export type PushTokenRegister = z.infer<typeof pushTokenRegisterSchema>;

export const pushTokenSchema = z.object({
  id: z.string().uuid(),
  expoPushToken: z.string(),
  platform: z.enum(['ios', 'android']),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});
export type PushToken = z.infer<typeof pushTokenSchema>;
```

> Note: `recordCreateSchema` is a `ZodEffects` (because of `.refine`). The sync batch uses `recordCreateSchema.unwrap()` to grab the underlying object schema so we can `.extend` it.

- [x] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/record.js';
```

- [x] **Step 3: Typecheck**

```bash
pnpm --filter @expyrico/shared typecheck
```
Expected: exit 0.

- [x] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/record.ts packages/shared/src/index.ts
git commit -m "feat(shared): add record + push-token Zod schemas"
```

---

## Phase B — Database schema (Prisma migration)

### Task B1: Add M1 enums + tables to `schema.prisma`

**Files:**
- Modify: `api/prisma/schema.prisma`

- [x] **Step 1: Add enums above the existing `User` model**

In `api/prisma/schema.prisma`, after the existing `AuthCredentialType` enum, append:

```prisma
enum ProductSource {
  off
  upcitemdb
  user
}

enum ProductStatus {
  active
  pending
  merged_into
}

enum ProductEditStatus {
  pending
  approved
  rejected

  @@map("product_edit_status")
}

enum RecordStatus {
  active
  consumed
  discarded
  expired
}

enum PushPlatform {
  ios
  android
}

enum PushLogStatus {
  sent
  failed

  @@map("push_log_status")
}
```

- [x] **Step 2: Add `notificationPreferences` field + relations to existing `User` model**

In the `User` model block, after the `totpEnabledAt` line add:
```prisma
  notificationPreferences Json?
```

In the relations section of `User` append:
```prisma
  products             Product[]     @relation("ProductCreator")
  records              Record[]
  productEditsAuthored ProductEdit[] @relation("ProductEditAuthor")
  productEditsResolved ProductEdit[] @relation("ProductEditResolver")
  pushLogs             PushLog[]
```

> Note: M0a's `User` model may already declare `pushLogs PushLog[]`. If so, do not duplicate — keep one entry. The `productEditsResolver` relation back-link is required for the renamed `ProductEdit.resolvedBy` foreign key introduced below; if M0a never wrote `pushLogs`, this M1 step adds it.

- [x] **Step 3: Add the new models at the bottom of `schema.prisma`**

```prisma
model Product {
  id                    String        @id @default(uuid()) @db.Uuid
  barcode               String?       @unique
  qrPayload             String?       @unique @map("qr_payload")
  name                  String
  brand                 String?
  category              String?
  imageUrl              String?       @map("image_url")
  defaultShelfLifeDays  Int?          @map("default_shelf_life_days")
  source                ProductSource
  sourceId              String?       @map("source_id")
  isCommunityEligible   Boolean       @default(false) @map("is_community_eligible")
  buyAgainCount         Int           @default(0) @map("buy_again_count")
  buyAgainOnSaleCount   Int           @default(0) @map("buy_again_on_sale_count")
  wontBuyCount          Int           @default(0) @map("wont_buy_count")
  ratingCount           Int           @default(0) @map("rating_count")
  reviewCount           Int           @default(0) @map("review_count")
  createdByUserId       String?       @db.Uuid @map("created_by_user_id")
  status                ProductStatus @default(active)
  mergedIntoProductId   String?       @db.Uuid @map("merged_into_product_id")
  createdAt             DateTime      @default(now()) @map("created_at")
  updatedAt             DateTime      @updatedAt @map("updated_at")

  createdBy   User?         @relation("ProductCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  mergedInto  Product?      @relation("ProductMerge", fields: [mergedIntoProductId], references: [id], onDelete: SetNull)
  mergedFrom  Product[]     @relation("ProductMerge")
  records     Record[]
  edits       ProductEdit[]

  @@index([source, sourceId])
  @@map("products")
}

model ProductEdit {
  id          String            @id @default(uuid()) @db.Uuid
  productId   String            @db.Uuid @map("product_id")
  submittedBy String            @db.Uuid @map("submitted_by")
  proposed    Json
  status      ProductEditStatus @default(pending)
  resolvedBy  String?           @db.Uuid @map("resolved_by")
  resolvedAt  DateTime?         @map("resolved_at")
  notes       String?
  createdAt   DateTime          @default(now()) @map("created_at")

  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  submitter User    @relation("ProductEditAuthor", fields: [submittedBy], references: [id])
  resolver  User?   @relation("ProductEditResolver", fields: [resolvedBy], references: [id])

  @@index([status, createdAt(sort: Desc)])
  @@index([productId])
  @@map("product_edits")
}

model Record {
  id            String       @id @default(uuid()) @db.Uuid
  userId        String       @db.Uuid @map("user_id")
  productId     String?      @db.Uuid @map("product_id")
  customName    String?      @map("custom_name")
  category      String?      @map("category")
  expiryDate    DateTime     @db.Date @map("expiry_date")
  purchaseDate  DateTime?    @db.Date @map("purchase_date")
  quantity      Decimal      @db.Decimal(12, 3) @default(1)
  unit          String       @default("pcs")
  price         Decimal?     @db.Decimal(10, 2) @map("price")
  store         String?      @map("store")
  notes         String?
  photoUrl      String?      @map("photo_url")
  status        RecordStatus @default(active)
  notifyAt      Json         @default("[]") @map("notify_at")
  clientId      String       @unique @db.Uuid @map("client_id")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  consumedAt    DateTime?    @map("consumed_at")

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  product  Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)
  pushLogs PushLog[]

  @@index([userId, status, expiryDate])
  @@map("records")
}

model PushLog {
  id            String        @id @default(uuid()) @db.Uuid
  userId        String        @db.Uuid @map("user_id")
  recordId      String?       @db.Uuid @map("record_id")
  expoTicketId  String?       @map("expo_ticket_id")
  templateKey   String        @map("template_key")
  status        PushLogStatus
  errorMessage  String?       @map("error_message")
  createdAt     DateTime      @default(now()) @map("created_at")

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  record Record? @relation(fields: [recordId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
  @@map("push_logs")
}
```

- [x] **Step 4: Convert `PushToken.platform` from `String` to the `PushPlatform` enum (D27)**

M0a ships `PushToken.platform` as a plain `String` column. M1 owns the conversion to the new `PushPlatform` enum. Update the model in `api/prisma/schema.prisma` so it matches exactly:

```prisma
model PushToken {
  id            String       @id @default(uuid()) @db.Uuid
  userId        String       @db.Uuid @map("user_id")
  expoPushToken String       @unique @map("expo_push_token")
  platform      PushPlatform
  deviceInfo    Json?        @map("device_info")
  createdAt     DateTime     @default(now()) @map("created_at")
  lastUsedAt    DateTime?    @map("last_used_at")
  revokedAt     DateTime?    @map("revoked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("push_tokens")
}
```

The migration generated by `prisma migrate dev` in Task B2 will need a raw-SQL `ALTER ... USING` because Postgres can't auto-cast `text → enum`. After the auto-generated `CREATE TYPE "PushPlatform" ...` statement, append the following inside the same `migration.sql` (or, if Prisma refuses to round-trip, create a sibling migration that runs immediately after):

```sql
ALTER TABLE push_tokens
  ALTER COLUMN platform TYPE "PushPlatform" USING platform::"PushPlatform";
```

> Note: M0a's existing `platform` values are already exactly `'ios'` or `'android'` (validated by M0a's Zod schema), so the cast is a straight one-to-one — no data backfill or scrubbing required. If the column has any other historical value, the cast will throw and you should fail fast and clean the row before re-running.

- [x] **Step 5: Generate Prisma client**

```bash
pnpm --filter @expyrico/api exec prisma generate
```
Expected: `Generated Prisma Client` output.

- [x] **Step 6: Commit**

```bash
git add api/prisma/schema.prisma
git commit -m "feat(api): add products, product_edits, records, push_logs to Prisma schema"
```

---

### Task B2: Create migration with trigram index

**Files:**
- Create: `api/prisma/migrations/<timestamp>_m1_expyrico/migration.sql`

- [x] **Step 1: Create the migration files via Prisma**

```bash
pnpm --filter @expyrico/api exec prisma migrate dev --name m1_pantry --create-only
```
Expected: a new directory under `api/prisma/migrations/` ending in `_m1_expyrico/`.

- [x] **Step 2: Append the `pg_trgm` extension + index + `PushPlatform` cast to the generated `migration.sql`**

At the bottom of the new `migration.sql`, append:

```sql
-- Enable pg_trgm (no-op if M0a already enabled it)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on name + brand for fuzzy search
CREATE INDEX IF NOT EXISTS products_name_brand_trgm
  ON products
  USING GIN ((coalesce(name, '') || ' ' || coalesce(brand, '')) gin_trgm_ops);

-- D27: convert push_tokens.platform from text → PushPlatform enum.
-- Prisma can't auto-cast text→enum, so we do it explicitly here.
-- (M0a's existing values 'ios'/'android' are already valid enum strings,
-- so the cast is a straightforward one-to-one.)
ALTER TABLE push_tokens
  ALTER COLUMN platform TYPE "PushPlatform" USING platform::"PushPlatform";
```

> If `prisma migrate dev --create-only` already emitted its own `ALTER TABLE push_tokens ALTER COLUMN platform TYPE "PushPlatform"` (without the `USING` clause), replace that line with the version above — Postgres rejects the no-USING variant when converting from `text`.

- [x] **Step 3: Apply the migration**

```bash
pnpm --filter @expyrico/api exec prisma migrate dev
```
Expected: `Database is now in sync with your schema.`

- [x] **Step 4: Verify tables in psql**

```bash
psql "$(grep DATABASE_URL api/.env | cut -d= -f2-)" -c "\dt"
```
Expected output includes: `products`, `product_edits`, `records`, `push_logs`, `push_tokens`.

- [x] **Step 5: Verify the trigram index exists**

```bash
psql "$(grep DATABASE_URL api/.env | cut -d= -f2-)" -c "\di products_name_brand_trgm"
```
Expected: one row, `gin` index.

- [x] **Step 6: Update test setup to truncate new tables**

In `api/tests/helpers/setup.ts`, replace the `tables` array (children first, parents last):

```ts
const tables = [
  'admin_audit_log',
  'totp_challenges',
  'password_resets',
  'email_tokens',
  'push_logs',
  'push_tokens',
  'sessions',
  'auth_credentials',
  'product_edits',
  'records',
  'products',
  'users',
];
```

- [x] **Step 7: Run the existing test suite to confirm nothing broke**

```bash
pnpm --filter @expyrico/api test
```
Expected: all M0a/M0b tests still pass.

- [x] **Step 8: Commit**

```bash
git add api/prisma/migrations api/tests/helpers/setup.ts
git commit -m "feat(api): m1 migration with pg_trgm index + truncate list"
```

---

### Task B3: Extend test factories

**Files:**
- Modify: `api/tests/helpers/factories.ts`

- [x] **Step 1: Append helpers to `api/tests/helpers/factories.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../../src/db.js';

export async function makeProduct(overrides: Partial<{
  barcode: string;
  qrPayload: string;
  name: string;
  brand: string;
  source: 'off' | 'upcitemdb' | 'user';
  sourceId: string;
  defaultShelfLifeDays: number;
  createdByUserId: string;
}> = {}) {
  const prisma = getPrisma();
  return prisma.product.create({
    data: {
      barcode: overrides.barcode ?? `bc-${randomUUID()}`,
      qrPayload: overrides.qrPayload ?? null,
      name: overrides.name ?? 'Test Product',
      brand: overrides.brand ?? 'TestBrand',
      source: overrides.source ?? 'user',
      sourceId: overrides.sourceId ?? null,
      defaultShelfLifeDays: overrides.defaultShelfLifeDays ?? null,
      createdByUserId: overrides.createdByUserId ?? null,
    },
  });
}

export async function makeRecord(userId: string, overrides: Partial<{
  productId: string | null;
  customName: string;
  expiryDate: Date;
  quantity: number;
  unit: string;
  status: 'active' | 'consumed' | 'discarded' | 'expired';
  clientId: string;
  notifyAt: string[];
}> = {}) {
  const prisma = getPrisma();
  return prisma.record.create({
    data: {
      userId,
      productId: overrides.productId ?? null,
      customName: overrides.customName ?? 'Manual item',
      expiryDate: overrides.expiryDate ?? new Date(Date.now() + 7 * 24 * 3600 * 1000),
      quantity: overrides.quantity ?? 1,
      unit: overrides.unit ?? 'pcs',
      status: overrides.status ?? 'active',
      clientId: overrides.clientId ?? randomUUID(),
      notifyAt: overrides.notifyAt ?? [],
    },
  });
}
```

> Note: the existing M0a `factories.ts` already exports `makeUser`. Append, don't replace.

- [x] **Step 2: Commit**

```bash
git add api/tests/helpers/factories.ts
git commit -m "test(api): add product + record factories"
```

---

## Phase C — HTTP helpers, circuit breaker, and external product clients

### Task C1: `undici` HTTP helper with timeout

**Files:**
- Create: `api/src/lib/http.ts`

- [x] **Step 1: Write `api/src/lib/http.ts`**

```ts
import { request } from 'undici';

export interface HttpJsonOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function getJson<T>(url: string, opts: HttpJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await request(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...(opts.headers ?? {}) },
      signal: controller.signal,
    });
    if (res.statusCode >= 500) {
      throw new HttpError(res.statusCode, `upstream ${res.statusCode}`);
    }
    if (res.statusCode === 404) {
      throw new HttpError(404, 'not found');
    }
    if (res.statusCode >= 400) {
      throw new HttpError(res.statusCode, `client error ${res.statusCode}`);
    }
    return (await res.body.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/lib/http.ts
git commit -m "feat(api): undici JSON helper with timeout"
```

---

### Task C2: `opossum` breaker factory

**Files:**
- Create: `api/src/lib/breaker.ts`
- Create: `api/tests/unit/breaker.test.ts`

- [x] **Step 1: Write the failing test `api/tests/unit/breaker.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeBreaker } from '../../src/lib/breaker.js';

describe('makeBreaker', () => {
  it('opens after consecutive failures', async () => {
    let calls = 0;
    const breaker = makeBreaker(async () => {
      calls += 1;
      throw new Error('boom');
    }, { name: 'test', timeout: 100, errorThresholdPercentage: 50, resetTimeout: 1000, volumeThreshold: 2 });

    await expect(breaker.fire()).rejects.toThrow();
    await expect(breaker.fire()).rejects.toThrow();
    // After threshold, breaker is open and short-circuits without calling fn
    await expect(breaker.fire()).rejects.toThrow();
    expect(breaker.opened).toBe(true);
  });

  it('returns value on success', async () => {
    const breaker = makeBreaker(async (n: number) => n * 2, {
      name: 'mul', timeout: 100, errorThresholdPercentage: 50, resetTimeout: 1000, volumeThreshold: 2,
    });
    await expect(breaker.fire(3)).resolves.toBe(6);
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/breaker.test.ts
```
Expected: FAIL — module not found.

- [x] **Step 3: Write `api/src/lib/breaker.ts`**

```ts
import CircuitBreaker from 'opossum';
import { logger } from '../logger.js';

export interface BreakerOpts {
  name: string;
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold: number;
}

export function makeBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  opts: BreakerOpts,
): CircuitBreaker<TArgs, TResult> {
  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    volumeThreshold: opts.volumeThreshold,
    name: opts.name,
  });
  breaker.on('open', () => logger.warn({ breaker: opts.name }, 'circuit opened'));
  breaker.on('halfOpen', () => logger.info({ breaker: opts.name }, 'circuit half-open'));
  breaker.on('close', () => logger.info({ breaker: opts.name }, 'circuit closed'));
  return breaker;
}
```

- [x] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/breaker.test.ts
```
Expected: 2 passed.

- [x] **Step 5: Commit**

```bash
git add api/src/lib/breaker.ts api/tests/unit/breaker.test.ts
git commit -m "feat(api): opossum circuit breaker factory"
```

---

### Task C2a: Breaker registry (D11)

**Files:**
- Create: `api/src/services/external/breakers.ts`
- Create: `api/tests/unit/breakers-registry.test.ts`

- [x] **Step 1: Write the failing test `api/tests/unit/breakers-registry.test.ts`**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import CircuitBreaker from 'opossum';
import {
  register,
  getBreaker,
  getAllBreakers,
} from '../../src/services/external/breakers.js';

// The registry is process-global; reset it by re-importing/registering for each test.
function freshBreaker(name: string) {
  return new CircuitBreaker(async () => name, { timeout: 100, name });
}

describe('breakers registry', () => {
  it('register + getBreaker round-trip', () => {
    const b = freshBreaker('alpha');
    register('alpha', b);
    expect(getBreaker('alpha')).toBe(b);
  });

  it('getBreaker throws when name missing', () => {
    expect(() => getBreaker('not-registered-xyz')).toThrow(/not registered/);
  });

  it('getAllBreakers lists every registered breaker', () => {
    const b1 = freshBreaker('beta');
    const b2 = freshBreaker('gamma');
    register('beta', b1);
    register('gamma', b2);
    const names = getAllBreakers().map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(['beta', 'gamma']));
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/breakers-registry.test.ts
```

- [x] **Step 3: Write `api/src/services/external/breakers.ts`**

```ts
import type CircuitBreaker from 'opossum';

const registry = new Map<string, CircuitBreaker>();

export function register(name: string, breaker: CircuitBreaker): void {
  registry.set(name, breaker);
}

export function getBreaker(name: string): CircuitBreaker {
  const b = registry.get(name);
  if (!b) throw new Error(`Breaker not registered: ${name}`);
  return b;
}

export function getAllBreakers(): { name: string; breaker: CircuitBreaker }[] {
  return Array.from(registry.entries()).map(([name, breaker]) => ({ name, breaker }));
}
```

> M2 and future health-check endpoints iterate `getAllBreakers()` to surface circuit state. Each external client (OFF, UPCitemdb, Expo Push) MUST call `register(...)` immediately after creating its breaker.

- [x] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/breakers-registry.test.ts
```
Expected: 3 passed.

- [x] **Step 5: Commit**

```bash
git add api/src/services/external/breakers.ts api/tests/unit/breakers-registry.test.ts
git commit -m "feat(api): external service circuit-breaker registry"
```

---

### Task C3: Product mappers (OFF/UPCitemdb → internal shape)

**Files:**
- Create: `api/src/services/products/mappers.ts`
- Create: `api/tests/unit/product-mappers.test.ts`
- Create: `api/tests/helpers/fixtures/off-cola.json`
- Create: `api/tests/helpers/fixtures/upcitemdb-soap.json`

- [x] **Step 1: Save the OFF fixture `api/tests/helpers/fixtures/off-cola.json`**

```json
{
  "status": 1,
  "code": "5449000000996",
  "product": {
    "product_name": "Coca-Cola",
    "brands": "Coca-Cola, The Coca-Cola Company",
    "categories": "Beverages,Sodas,Carbonated drinks",
    "image_url": "https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.jpg"
  }
}
```

- [x] **Step 2: Save the UPCitemdb fixture `api/tests/helpers/fixtures/upcitemdb-soap.json`**

```json
{
  "code": "OK",
  "total": 1,
  "items": [
    {
      "ean": "0012345678905",
      "title": "Lemon Dish Soap 16oz",
      "brand": "SudsCo",
      "category": "Household > Cleaning",
      "images": ["https://example.com/soap.jpg"]
    }
  ]
}
```

- [x] **Step 3: Write the failing test `api/tests/unit/product-mappers.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapOffProduct, mapUpcitemdbProduct } from '../../src/services/products/mappers.js';

const off = JSON.parse(readFileSync(resolve('api/tests/helpers/fixtures/off-cola.json'), 'utf8'));
const upc = JSON.parse(readFileSync(resolve('api/tests/helpers/fixtures/upcitemdb-soap.json'), 'utf8'));

describe('product mappers', () => {
  it('maps an OFF product', () => {
    const mapped = mapOffProduct('5449000000996', off);
    expect(mapped).not.toBeNull();
    expect(mapped!.barcode).toBe('5449000000996');
    expect(mapped!.name).toBe('Coca-Cola');
    expect(mapped!.brand).toBe('Coca-Cola');
    expect(mapped!.source).toBe('off');
    expect(mapped!.sourceId).toBe('5449000000996');
    expect(mapped!.imageUrl).toContain('openfoodfacts');
  });

  it('returns null when OFF status != 1', () => {
    expect(mapOffProduct('x', { status: 0 })).toBeNull();
  });

  it('maps a UPCitemdb item', () => {
    const mapped = mapUpcitemdbProduct('0012345678905', upc);
    expect(mapped).not.toBeNull();
    expect(mapped!.name).toBe('Lemon Dish Soap 16oz');
    expect(mapped!.brand).toBe('SudsCo');
    expect(mapped!.source).toBe('upcitemdb');
    expect(mapped!.imageUrl).toBe('https://example.com/soap.jpg');
  });

  it('returns null when UPCitemdb items array empty', () => {
    expect(mapUpcitemdbProduct('x', { code: 'OK', total: 0, items: [] })).toBeNull();
  });
});
```

- [x] **Step 4: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/product-mappers.test.ts
```

- [x] **Step 5: Write `api/src/services/products/mappers.ts`**

```ts
export interface ExternalProductData {
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: 'off' | 'upcitemdb';
  sourceId: string;
}

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    brands?: string;
    categories?: string;
    image_url?: string;
  };
}

export function mapOffProduct(barcode: string, raw: unknown): ExternalProductData | null {
  const r = raw as OffResponse;
  if (!r || r.status !== 1 || !r.product) return null;
  const name = r.product.product_name?.trim();
  if (!name) return null;
  const brand = r.product.brands?.split(',')[0]?.trim() || null;
  const category = r.product.categories?.split(',')[0]?.trim() || null;
  return {
    barcode,
    name,
    brand,
    category,
    imageUrl: r.product.image_url ?? null,
    source: 'off',
    sourceId: barcode,
  };
}

interface UpcResponse {
  code?: string;
  items?: Array<{
    ean?: string;
    upc?: string;
    title?: string;
    brand?: string;
    category?: string;
    images?: string[];
  }>;
}

export function mapUpcitemdbProduct(barcode: string, raw: unknown): ExternalProductData | null {
  const r = raw as UpcResponse;
  const item = r?.items?.[0];
  if (!item || !item.title) return null;
  return {
    barcode,
    name: item.title.trim(),
    brand: item.brand?.trim() || null,
    category: item.category?.split('>').pop()?.trim() || null,
    imageUrl: item.images?.[0] ?? null,
    source: 'upcitemdb',
    sourceId: item.ean ?? item.upc ?? barcode,
  };
}
```

- [x] **Step 6: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/product-mappers.test.ts
```
Expected: 4 passed.

- [x] **Step 7: Commit**

```bash
git add api/src/services/products/mappers.ts api/tests/unit/product-mappers.test.ts api/tests/helpers/fixtures
git commit -m "feat(api): map OFF/UPCitemdb responses to internal product shape"
```

---

### Task C4: OFF client with breaker

**Files:**
- Create: `api/src/services/products/off-client.ts`
- Modify: `api/src/services/external/breakers.ts` (register call site)

- [x] **Step 1: Write `api/src/services/products/off-client.ts`**

```ts
import { getJson, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { mapOffProduct, type ExternalProductData } from './mappers.js';

const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

async function fetchOff(barcode: string): Promise<ExternalProductData | null> {
  try {
    const raw = await getJson<unknown>(OFF_URL(barcode), {
      timeoutMs: 1500,
      headers: { 'user-agent': 'PantryApp/1.0 (+self-hosted)' },
    });
    return mapOffProduct(barcode, raw);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

export const offBreaker = makeBreaker(fetchOff, {
  name: 'off',
  timeout: 2000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

// Fallback: when the breaker is open, return null so caller can fall through.
offBreaker.fallback(() => null);

// D11: register in the global breaker registry for health/observability.
register('off', offBreaker);

export async function lookupOff(barcode: string): Promise<ExternalProductData | null> {
  return offBreaker.fire(barcode);
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/services/products/off-client.ts
git commit -m "feat(api): Open Food Facts client with circuit breaker"
```

---

### Task C5: UPCitemdb client with breaker

**Files:**
- Create: `api/src/services/products/upcitemdb-client.ts`
- Modify: `api/src/services/external/breakers.ts` (register call site)

- [x] **Step 1: Write `api/src/services/products/upcitemdb-client.ts`**

```ts
import { getJson, HttpError } from '../../lib/http.js';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';
import { mapUpcitemdbProduct, type ExternalProductData } from './mappers.js';

const UPC_URL = (barcode: string) =>
  `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;

async function fetchUpc(barcode: string): Promise<ExternalProductData | null> {
  try {
    const raw = await getJson<unknown>(UPC_URL(barcode), { timeoutMs: 2000 });
    return mapUpcitemdbProduct(barcode, raw);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

export const upcBreaker = makeBreaker(fetchUpc, {
  name: 'upcitemdb',
  timeout: 2500,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

upcBreaker.fallback(() => null);

// D11: register in the global breaker registry.
register('upcitemdb', upcBreaker);

export async function lookupUpcitemdb(barcode: string): Promise<ExternalProductData | null> {
  return upcBreaker.fire(barcode);
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/services/products/upcitemdb-client.ts
git commit -m "feat(api): UPCitemdb client with circuit breaker"
```

---

### Task C6: Lookup service (cache → OFF → UPCitemdb → null)

**Files:**
- Create: `api/src/services/products/lookup.ts`

- [x] **Step 1: Write `api/src/services/products/lookup.ts`**

```ts
import type { Product } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { lookupOff } from './off-client.js';
import { lookupUpcitemdb } from './upcitemdb-client.js';
import type { ExternalProductData } from './mappers.js';
import { logger } from '../../logger.js';

export interface LookupInput {
  barcode?: string;
  qr?: string;
}

export async function lookupProduct(input: LookupInput): Promise<Product | null> {
  const prisma = getPrisma();

  // 1. Local cache (exact match on barcode or qr_payload)
  if (input.barcode) {
    const cached = await prisma.product.findUnique({ where: { barcode: input.barcode } });
    if (cached) return cached;
  }
  if (input.qr) {
    const cached = await prisma.product.findUnique({ where: { qrPayload: input.qr } });
    if (cached) return cached;
  }

  // QR payloads aren't queryable on OFF/UPC — only barcodes go external.
  if (!input.barcode) return null;

  // 2. Open Food Facts
  const fromOff = await safe(() => lookupOff(input.barcode!), 'off');
  if (fromOff) return persistExternal(fromOff);

  // 3. UPCitemdb fallback
  const fromUpc = await safe(() => lookupUpcitemdb(input.barcode!), 'upcitemdb');
  if (fromUpc) return persistExternal(fromUpc);

  // 4. Nothing matched
  return null;
}

async function safe<T>(fn: () => Promise<T | null>, label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err, source: label }, 'product lookup upstream error');
    return null;
  }
}

async function persistExternal(data: ExternalProductData): Promise<Product> {
  const prisma = getPrisma();
  return prisma.product.upsert({
    where: { barcode: data.barcode },
    create: {
      barcode: data.barcode,
      name: data.name,
      brand: data.brand,
      category: data.category,
      imageUrl: data.imageUrl,
      source: data.source,
      sourceId: data.sourceId,
      isCommunityEligible: true, // barcode-sourced (OFF/UPCitemdb) → eligible for community ratings
    },
    update: {
      // Only refresh fields if the existing row is also from an external source
      // (don't overwrite user-created products).
      name: data.name,
      brand: data.brand,
      category: data.category,
      imageUrl: data.imageUrl,
    },
  });
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/services/products/lookup.ts
git commit -m "feat(api): product lookup hierarchy (cache → OFF → UPC → null)"
```

---

## Phase D — Product HTTP routes

All routes mount under `/v1/products`. Every handler requires auth via `app.requireAuth`.

### Task D1: Common product serializer

**Files:**
- Create: `api/src/services/products/serializer.ts`

- [x] **Step 1: Write `api/src/services/products/serializer.ts`**

```ts
import type { Product } from '@prisma/client';
import type { Product as ApiProduct } from '@expyrico/shared';

export function toApiProduct(p: Product): ApiProduct {
  return {
    id: p.id,
    barcode: p.barcode,
    qrPayload: p.qrPayload,
    name: p.name,
    brand: p.brand,
    category: p.category,
    imageUrl: p.imageUrl,
    defaultShelfLifeDays: p.defaultShelfLifeDays,
    source: p.source,
    sourceId: p.sourceId,
    isCommunityEligible: p.isCommunityEligible,
    buyAgainCount: p.buyAgainCount,
    buyAgainOnSaleCount: p.buyAgainOnSaleCount,
    wontBuyCount: p.wontBuyCount,
    ratingCount: p.ratingCount,
    reviewCount: p.reviewCount,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/services/products/serializer.ts
git commit -m "feat(api): product serializer"
```

---

### Task D2: `POST /v1/products/lookup`

**Files:**
- Create: `api/src/routes/products/lookup.ts`
- Create: `api/src/routes/products/index.ts`
- Create: `api/tests/integration/products-lookup.test.ts`
- Modify: `api/src/server.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/products-lookup.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function authHeaders(role: 'user' | 'admin' = 'user') {
  const u = await makeUser({ role, emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { authorization: `Bearer ${token}` };
}

describe('POST /v1/products/lookup', () => {
  it('returns cached product on barcode hit', async () => {
    const app = await buildServer();
    const headers = await authHeaders();
    await makeProduct({ barcode: '5449000000996', name: 'Coke', source: 'off' });
    const res = await app.inject({
      method: 'POST', url: '/v1/products/lookup',
      headers, payload: { barcode: '5449000000996' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().product.name).toBe('Coke');
    await app.close();
  });

  it('returns 404 when nothing found and externals all miss', async () => {
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue(null),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'POST', url: '/v1/products/lookup',
      headers, payload: { barcode: '0000000000000' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('not_found');
    await app.close();
    vi.doUnmock('../../src/services/products/off-client.js');
    vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST', url: '/v1/products/lookup',
      payload: { barcode: '5449000000996' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects payload with neither barcode nor qr', async () => {
    const app = await buildServer();
    const headers = await authHeaders();
    const res = await app.inject({
      method: 'POST', url: '/v1/products/lookup', headers, payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-lookup.test.ts
```

- [x] **Step 3: Write `api/src/routes/products/lookup.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import {
  productLookupRequestSchema,
  productLookupResponseSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { lookupProduct } from '../../services/products/lookup.js';
import { toApiProduct } from '../../services/products/serializer.js';
import { productLookupQueue } from '../../queues/index.js';

export async function lookupRoute(app: FastifyInstance) {
  app.post('/lookup', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = productLookupRequestSchema.parse(req.body);
    const product = await lookupProduct({
      barcode: input.barcode,
      qr: input.qr,
    });
    if (!product) {
      // Synchronous path (local cache → OFF → UPCitemdb) missed. For a barcode,
      // enqueue a slow background backfill (spec §4.3) so a later request can hit
      // local cache. jobId dedupes concurrent misses for the same barcode.
      if (input.barcode) {
        await productLookupQueue().add(
          'backfill',
          { barcode: input.barcode, requestedByUserId: req.user!.id },
          { jobId: `lookup:${input.barcode}`, removeOnComplete: true, removeOnFail: 100 },
        );
      }
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Product not found',
      });
    }
    return reply.send(
      productLookupResponseSchema.parse({ product: toApiProduct(product) }),
    );
  });
}
```

- [x] **Step 4: Write `api/src/routes/products/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { lookupRoute } from './lookup.js';

export async function productRoutes(app: FastifyInstance) {
  await app.register(lookupRoute);
}
```

- [x] **Step 5: Mount in `api/src/server.ts`**

Add the import near the other route imports:
```ts
import { productRoutes } from './routes/products/index.js';
```
Add registration after the existing `authRoutes` registration:
```ts
await app.register(productRoutes, { prefix: '/v1/products' });
```

- [x] **Step 6: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-lookup.test.ts
```
Expected: 4 passed.

- [x] **Step 7: Commit**

```bash
git add api/src/routes/products api/src/server.ts api/tests/integration/products-lookup.test.ts
git commit -m "feat(api): POST /v1/products/lookup"
```

---

### Task D3: `GET /v1/products/search` (pg_trgm)

**Files:**
- Create: `api/src/services/products/search.ts`
- Create: `api/src/routes/products/search.ts`
- Create: `api/tests/integration/products-search.test.ts`
- Modify: `api/src/routes/products/index.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/products-search.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function headers() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { authorization: `Bearer ${token}` };
}

describe('GET /v1/products/search', () => {
  it('returns fuzzy matches above similarity 0.3', async () => {
    const app = await buildServer();
    const h = await headers();
    await makeProduct({ name: 'Coca-Cola Classic', brand: 'Coca-Cola' });
    await makeProduct({ name: 'Pepsi Max', brand: 'Pepsi' });
    const res = await app.inject({
      method: 'GET', url: '/v1/products/search?q=coca', headers: h,
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].name).toContain('Coca');
    await app.close();
  });

  it('rejects empty q', async () => {
    const app = await buildServer();
    const h = await headers();
    const res = await app.inject({ method: 'GET', url: '/v1/products/search?q=', headers: h });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('respects limit cap of 50', async () => {
    const app = await buildServer();
    const h = await headers();
    const res = await app.inject({
      method: 'GET', url: '/v1/products/search?q=x&limit=500', headers: h,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-search.test.ts
```

- [x] **Step 3: Write `api/src/services/products/search.ts`**

```ts
import type { Product } from '@prisma/client';
import { getPrisma } from '../../db.js';

export async function searchProducts(q: string, limit: number): Promise<Product[]> {
  const prisma = getPrisma();
  // pg_trgm similarity on concatenated name + brand, threshold 0.3.
  return prisma.$queryRaw<Product[]>`
    SELECT *
    FROM products
    WHERE status = 'active'
      AND similarity(coalesce(name, '') || ' ' || coalesce(brand, ''), ${q}) > 0.3
    ORDER BY similarity(coalesce(name, '') || ' ' || coalesce(brand, ''), ${q}) DESC,
             review_count DESC
    LIMIT ${limit}
  `;
}
```

- [x] **Step 4: Write `api/src/routes/products/search.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productSearchResultSchema } from '@expyrico/shared';
import { searchProducts } from '../../services/products/search.js';
import { toApiProduct } from '../../services/products/serializer.js';

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function searchRoute(app: FastifyInstance) {
  app.get('/search', { onRequest: app.requireAuth }, async (req, reply) => {
    const { q, limit } = querySchema.parse(req.query);
    const items = await searchProducts(q, limit);
    return reply.send(
      productSearchResultSchema.parse({ items: items.map(toApiProduct) }),
    );
  });
}
```

- [x] **Step 5: Mount in `api/src/routes/products/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { lookupRoute } from './lookup.js';
import { searchRoute } from './search.js';

export async function productRoutes(app: FastifyInstance) {
  await app.register(lookupRoute);
  await app.register(searchRoute);
}
```

- [x] **Step 6: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-search.test.ts
```
Expected: 3 passed.

- [x] **Step 7: Commit**

```bash
git add api/src/services/products/search.ts api/src/routes/products
git commit -m "feat(api): GET /v1/products/search with pg_trgm"
```

---

### Task D4: `GET /v1/products/:id`

**Files:**
- Create: `api/src/routes/products/get.ts`
- Create: `api/tests/integration/products-get.test.ts`
- Modify: `api/src/routes/products/index.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/products-get.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function headers() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { authorization: `Bearer ${token}` };
}

describe('GET /v1/products/:id', () => {
  it('returns the product with empty topReviews in M1', async () => {
    const app = await buildServer();
    const h = await headers();
    const p = await makeProduct({ name: 'Yogurt' });
    const res = await app.inject({ method: 'GET', url: `/v1/products/${p.id}`, headers: h });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(p.id);
    expect(body.topReviews).toEqual([]);
    await app.close();
  });

  it('404 on unknown id', async () => {
    const app = await buildServer();
    const h = await headers();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/00000000-0000-0000-0000-000000000000',
      headers: h,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-get.test.ts
```

- [x] **Step 3: Write `api/src/routes/products/get.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productWithReviewsSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiProduct } from '../../services/products/serializer.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function getProductRoute(app: FastifyInstance) {
  app.get('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const product = await getPrisma().product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError({
        status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found',
      });
    }
    return reply.send(
      productWithReviewsSchema.parse({
        ...toApiProduct(product),
        topReviews: [], // populated in M2
      }),
    );
  });
}
```

- [x] **Step 4: Mount in `api/src/routes/products/index.ts`**

Add import and registration so the file reads:
```ts
import type { FastifyInstance } from 'fastify';
import { lookupRoute } from './lookup.js';
import { searchRoute } from './search.js';
import { getProductRoute } from './get.js';

export async function productRoutes(app: FastifyInstance) {
  await app.register(lookupRoute);
  await app.register(searchRoute);
  await app.register(getProductRoute);
}
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-get.test.ts
```

- [x] **Step 6: Commit**

```bash
git add api/src/routes/products/get.ts api/src/routes/products/index.ts api/tests/integration/products-get.test.ts
git commit -m "feat(api): GET /v1/products/:id (topReviews stub for M1)"
```

---

### Task D5: `POST /v1/products` (manual create)

**Files:**
- Create: `api/src/routes/products/create.ts`
- Create: `api/tests/integration/products-create.test.ts`
- Modify: `api/src/routes/products/index.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/products-create.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authedUser() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/products', () => {
  it('creates a user-sourced product', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const res = await app.inject({
      method: 'POST', url: '/v1/products', headers,
      payload: { name: 'Homemade Jam', brand: 'Mom', defaultShelfLifeDays: 60 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.source).toBe('user');
    expect(body.name).toBe('Homemade Jam');
    const row = await getPrisma().product.findUnique({ where: { id: body.id } });
    expect(row?.createdByUserId).toBe(user.id);
    await app.close();
  });

  it('409 when barcode already exists', async () => {
    const app = await buildServer();
    const { headers } = await authedUser();
    await app.inject({
      method: 'POST', url: '/v1/products', headers,
      payload: { barcode: '1234567890123', name: 'A' },
    });
    const res = await app.inject({
      method: 'POST', url: '/v1/products', headers,
      payload: { barcode: '1234567890123', name: 'B' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('conflict');
    await app.close();
  });

  it('400 on empty name', async () => {
    const app = await buildServer();
    const { headers } = await authedUser();
    const res = await app.inject({
      method: 'POST', url: '/v1/products', headers, payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-create.test.ts
```

- [x] **Step 3: Write `api/src/routes/products/create.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { productCreateRequestSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiProduct } from '../../services/products/serializer.js';

export async function createProductRoute(app: FastifyInstance) {
  app.post('/', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = productCreateRequestSchema.parse(req.body);
    try {
      const product = await getPrisma().product.create({
        data: {
          barcode: input.barcode ?? null,
          qrPayload: input.qrPayload ?? null,
          name: input.name,
          brand: input.brand ?? null,
          category: input.category ?? null,
          imageUrl: input.imageUrl ?? null,
          defaultShelfLifeDays: input.defaultShelfLifeDays ?? null,
          source: 'user',
          sourceId: null,
          // Community ratings are barcode-only (spec §2.3/§2.6): a user-created
          // product is eligible only if it carries a scanned barcode/QR. Purely
          // manual entries (loose produce, wet-market items) stay personal-notes-only.
          isCommunityEligible: Boolean(input.barcode ?? input.qrPayload),
          createdByUserId: req.user!.id,
        },
      });
      return reply.status(201).send(toApiProduct(product));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError({
          status: 409, code: ERROR_CODES.CONFLICT,
          title: 'Product already exists for that barcode or QR payload',
        });
      }
      throw err;
    }
  });
}
```

- [x] **Step 4: Mount in `api/src/routes/products/index.ts`**

Append:
```ts
import { createProductRoute } from './create.js';
// ...
  await app.register(createProductRoute);
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-create.test.ts
```

- [x] **Step 6: Commit**

```bash
git add api/src/routes/products/create.ts api/src/routes/products/index.ts api/tests/integration/products-create.test.ts
git commit -m "feat(api): POST /v1/products (manual user-sourced)"
```

---

### Task D6: `PATCH /v1/products/:id` → product_edits

**Files:**
- Create: `api/src/routes/products/patch.ts`
- Create: `api/tests/integration/products-patch.test.ts`
- Modify: `api/src/routes/products/index.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/products-patch.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('PATCH /v1/products/:id', () => {
  it('creates a pending product_edits row, does NOT mutate the product', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const p = await makeProduct({ name: 'Old Name' });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/products/${p.id}`, headers,
      payload: { name: 'New Name', brand: 'Acme' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('pending');

    const fresh = await getPrisma().product.findUnique({ where: { id: p.id } });
    expect(fresh?.name).toBe('Old Name'); // unchanged

    const edits = await getPrisma().productEdit.findMany({ where: { productId: p.id } });
    expect(edits).toHaveLength(1);
    expect(edits[0]!.submittedBy).toBe(user.id);
    expect(edits[0]!.status).toBe('pending');
    expect((edits[0]!.proposed as { name?: string }).name).toBe('New Name');
    await app.close();
  });

  it('404 on unknown product', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/products/00000000-0000-0000-0000-000000000000',
      headers,
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('400 on empty patch', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const p = await makeProduct({});
    const res = await app.inject({
      method: 'PATCH', url: `/v1/products/${p.id}`, headers, payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-patch.test.ts
```

- [x] **Step 3: Write `api/src/routes/products/patch.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productPatchRequestSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function patchProductRoute(app: FastifyInstance) {
  app.patch('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const input = productPatchRequestSchema.parse(req.body);
    if (Object.keys(input).length === 0) {
      throw new AppError({
        status: 400, code: ERROR_CODES.VALIDATION, title: 'Patch payload is empty',
      });
    }
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError({
        status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found',
      });
    }
    const edit = await prisma.productEdit.create({
      data: {
        productId: id,
        submittedBy: req.user!.id,
        proposed: input,
      },
    });
    return reply.status(202).send({
      editId: edit.id,
      status: edit.status,
      productId: id,
    });
  });
}
```

- [x] **Step 4: Mount in `api/src/routes/products/index.ts`**

```ts
import { patchProductRoute } from './patch.js';
// ...
  await app.register(patchProductRoute);
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/products-patch.test.ts
```

- [x] **Step 6: Commit**

```bash
git add api/src/routes/products/patch.ts api/src/routes/products/index.ts api/tests/integration/products-patch.test.ts
git commit -m "feat(api): PATCH /v1/products/:id queues product_edits row"
```

---

## Phase E — Idempotency middleware

### Task E1: Redis-backed Idempotency-Key plugin

**Files:**
- Create: `api/src/plugins/idempotency.ts`
- Create: `api/tests/integration/idempotency.test.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/idempotency.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getRedis } from '../../src/redis.js';

describe('idempotency plugin', () => {
  it('replays the cached response on a duplicate key within TTL', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post('/test-idem', { config: { idempotent: true } }, async (_req, reply) => {
      calls += 1;
      return reply.status(201).send({ count: calls });
    });
    const headers = { 'idempotency-key': 'abc-123' };
    const r1 = await app.inject({ method: 'POST', url: '/test-idem', headers });
    const r2 = await app.inject({ method: 'POST', url: '/test-idem', headers });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.body).toBe(r2.body);
    expect(calls).toBe(1);
    await app.close();
  });

  it('400 when Idempotency-Key is missing on a required route', async () => {
    const app = await buildServer();
    app.post('/test-idem-required', { config: { idempotent: 'required' } }, async (_req, reply) =>
      reply.send({ ok: true }),
    );
    const res = await app.inject({ method: 'POST', url: '/test-idem-required' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    await app.close();
  });

  it('different keys do not collide', async () => {
    const app = await buildServer();
    let calls = 0;
    app.post('/x', { config: { idempotent: true } }, async (_req, reply) => {
      calls += 1;
      return reply.send({ calls });
    });
    await app.inject({ method: 'POST', url: '/x', headers: { 'idempotency-key': 'a' } });
    await app.inject({ method: 'POST', url: '/x', headers: { 'idempotency-key': 'b' } });
    expect(calls).toBe(2);
    await app.close();
  });

  it('uses redis key with TTL', async () => {
    const app = await buildServer();
    app.post('/x', { config: { idempotent: true } }, async (_req, reply) => reply.send({}));
    await app.inject({ method: 'POST', url: '/x', headers: { 'idempotency-key': 'ttltest' } });
    const ttl = await getRedis().ttl('idem:/x:ttltest');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86_400);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/idempotency.test.ts
```

- [x] **Step 3: Write `api/src/plugins/idempotency.ts`**

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { getRedis } from '../redis.js';
import { AppError } from '../errors.js';
import { ERROR_CODES } from '@expyrico/shared';

declare module 'fastify' {
  interface FastifyContextConfig {
    idempotent?: boolean | 'required';
  }
}

const TTL_SECONDS = 24 * 60 * 60;

function redisKey(url: string, key: string): string {
  // strip query string
  const path = url.split('?')[0] ?? url;
  return `idem:${path}:${key}`;
}

interface CachedResponse {
  status: number;
  body: string;
  contentType: string | undefined;
}

export const idempotencyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const cfg = req.routeOptions.config?.idempotent;
    if (!cfg) return;
    const key = req.headers['idempotency-key'];
    const keyStr = Array.isArray(key) ? key[0] : key;
    if (!keyStr) {
      if (cfg === 'required') {
        throw new AppError({
          status: 400, code: ERROR_CODES.VALIDATION,
          title: 'Idempotency-Key header is required',
        });
      }
      return;
    }
    const redis = getRedis();
    const cached = await redis.get(redisKey(req.url, keyStr));
    if (cached) {
      const parsed = JSON.parse(cached) as CachedResponse;
      if (parsed.contentType) void reply.type(parsed.contentType);
      void reply.status(parsed.status).send(parsed.body);
      return reply;
    }
  });

  app.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload) => {
    const cfg = req.routeOptions.config?.idempotent;
    if (!cfg) return payload;
    const key = req.headers['idempotency-key'];
    const keyStr = Array.isArray(key) ? key[0] : key;
    if (!keyStr) return payload;
    if (reply.statusCode >= 500) return payload; // don't cache errors
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const cached: CachedResponse = {
      status: reply.statusCode,
      body,
      contentType: reply.getHeader('content-type')?.toString(),
    };
    await getRedis().setex(redisKey(req.url, keyStr), TTL_SECONDS, JSON.stringify(cached));
    return payload;
  });
});
```

- [x] **Step 4: Register in `api/src/server.ts`**

After `await app.register(authPlugin);` add:
```ts
import { idempotencyPlugin } from './plugins/idempotency.js';
// ...
await app.register(idempotencyPlugin);
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/idempotency.test.ts
```
Expected: 4 passed.

- [x] **Step 6: Commit**

```bash
git add api/src/plugins/idempotency.ts api/src/server.ts api/tests/integration/idempotency.test.ts
git commit -m "feat(api): Redis-backed Idempotency-Key middleware"
```

---

## Phase F — BullMQ queues + notify-at computation

### Task F1: Queue registry

**Files:**
- Create: `api/src/queues/index.ts`
- Create: `api/src/queues/product-lookup.ts`
- Create: `api/src/queues/notification-schedule.ts`
- Create: `api/src/queues/notification-send.ts`

- [x] **Step 1: Write `api/src/queues/product-lookup.ts`**

```ts
import { Queue } from 'bullmq';
import { getQueueConnection } from './index.js';

export interface ProductLookupJob {
  barcode: string;
  requestedByUserId: string;
}

export const PRODUCT_LOOKUP_QUEUE = 'product-lookup';

let _q: Queue<ProductLookupJob> | undefined;
export function productLookupQueue(): Queue<ProductLookupJob> {
  if (!_q) {
    _q = new Queue<ProductLookupJob>(PRODUCT_LOOKUP_QUEUE, { connection: getQueueConnection() });
  }
  return _q;
}
```

- [x] **Step 2: Write `api/src/queues/notification-schedule.ts`**

```ts
import { Queue } from 'bullmq';
import { getQueueConnection } from './index.js';

export interface NotificationScheduleJob {
  recordId: string;
}

export const NOTIFICATION_SCHEDULE_QUEUE = 'notification-schedule';

let _q: Queue<NotificationScheduleJob> | undefined;
export function notificationScheduleQueue(): Queue<NotificationScheduleJob> {
  if (!_q) {
    _q = new Queue<NotificationScheduleJob>(NOTIFICATION_SCHEDULE_QUEUE, { connection: getQueueConnection() });
  }
  return _q;
}
```

- [x] **Step 3: Write `api/src/queues/notification-send.ts`**

```ts
import { Queue } from 'bullmq';
import { getQueueConnection } from './index.js';

export interface NotificationSendJob {
  recordId: string;
  userId: string;
  fireAt: string;        // ISO timestamp, for tracking
  offsetDays: number;    // 3, 1, 0 etc.
  templateKey: string;   // written to push_logs.templateKey (NOT NULL); e.g. 'expiry_reminder'
}

export const NOTIFICATION_SEND_QUEUE = 'notification-send';

let _q: Queue<NotificationSendJob> | undefined;
export function notificationSendQueue(): Queue<NotificationSendJob> {
  if (!_q) {
    _q = new Queue<NotificationSendJob>(NOTIFICATION_SEND_QUEUE, { connection: getQueueConnection() });
  }
  return _q;
}
```

- [x] **Step 4: Write `api/src/queues/index.ts` (registry — D10)**

```ts
import type { ConnectionOptions, Queue } from 'bullmq';
import { getRedis } from '../redis.js';
import {
  PRODUCT_LOOKUP_QUEUE,
  productLookupQueue,
} from './product-lookup.js';
import {
  NOTIFICATION_SCHEDULE_QUEUE,
  notificationScheduleQueue,
} from './notification-schedule.js';
import {
  NOTIFICATION_SEND_QUEUE,
  notificationSendQueue,
} from './notification-send.js';

export * from './product-lookup.js';
export * from './notification-schedule.js';
export * from './notification-send.js';

// Canonical contract: returns a RAW ConnectionOptions. Callers wrap it as
// `{ connection: getQueueConnection() }` when constructing a Queue/Worker.
// Downstream milestones rely on this shape — do not re-wrap it here.
export function getQueueConnection(): ConnectionOptions {
  return getRedis();
}

export function getAllQueues(): { name: string; queue: Queue }[] {
  return [
    { name: PRODUCT_LOOKUP_QUEUE, queue: productLookupQueue() },
    { name: NOTIFICATION_SCHEDULE_QUEUE, queue: notificationScheduleQueue() },
    { name: NOTIFICATION_SEND_QUEUE, queue: notificationSendQueue() },
  ];
}
```

> Path is `api/src/queues/` (NOT `api/src/services/queues/`). M2 will extend `getAllQueues()` with its own queues.
>
> The individual queue files import `getQueueConnection` from this `index.ts` and only call it lazily inside their factory functions (never at module top level), so the import cycle is safe under ESM — `getQueueConnection` is fully defined before any factory runs.

- [x] **Step 5: Write unit test `api/tests/unit/queue-registry.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  getAllQueues,
  getQueueConnection,
  PRODUCT_LOOKUP_QUEUE,
  NOTIFICATION_SCHEDULE_QUEUE,
  NOTIFICATION_SEND_QUEUE,
} from '../../src/queues/index.js';

describe('queue registry', () => {
  it('getAllQueues returns the three M1 queues by name', () => {
    const names = getAllQueues().map((q) => q.name).sort();
    expect(names).toEqual(
      [PRODUCT_LOOKUP_QUEUE, NOTIFICATION_SCHEDULE_QUEUE, NOTIFICATION_SEND_QUEUE].sort(),
    );
  });

  it('getQueueConnection returns a raw ConnectionOptions (not a wrapper)', () => {
    const out = getQueueConnection();
    // Raw connection options object, NOT `{ connection: ... }`.
    expect(out).not.toHaveProperty('connection');
    expect(out).toBeTypeOf('object');
  });
});
```

- [x] **Step 6: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/queue-registry.test.ts
```
Expected: 2 passed.

- [x] **Step 7: Commit**

```bash
git add api/src/queues api/tests/unit/queue-registry.test.ts
git commit -m "feat(api): BullMQ queue definitions + registry for M1"
```

---

### Task F2: `notify-at` computation

**Files:**
- Create: `api/src/services/records/notify-at.ts`
- Create: `api/tests/unit/notify-at.test.ts`

- [x] **Step 1: Write the failing test `api/tests/unit/notify-at.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { computeNotifyAt, DEFAULT_OFFSETS_DAYS, resolveOffsetsForUser } from '../../src/services/records/notify-at.js';

describe('resolveOffsetsForUser', () => {
  it('returns the default offsets when prefs is null', () => {
    expect(resolveOffsetsForUser(null)).toEqual([7, 3, 1, 0]);
  });
  it('returns the default offsets when offsetsDays is missing/malformed', () => {
    expect(resolveOffsetsForUser({})).toEqual([7, 3, 1, 0]);
    expect(resolveOffsetsForUser({ offsetsDays: 'nope' })).toEqual([7, 3, 1, 0]);
  });
  it('returns the stored offsetsDays when valid', () => {
    expect(resolveOffsetsForUser({ offsetsDays: [14, 3] })).toEqual([14, 3]);
  });
});

describe('computeNotifyAt', () => {
  it('returns timestamps for the default 3/1/0 offsets at 09:00 user-local UTC', () => {
    const expiry = new Date('2026-01-15');
    const out = computeNotifyAt(expiry);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('2026-01-12T09:00:00.000Z'); // 3d before
    expect(out[1]).toBe('2026-01-14T09:00:00.000Z'); // 1d before
    expect(out[2]).toBe('2026-01-15T09:00:00.000Z'); // day of
  });

  it('filters past timestamps relative to now', () => {
    const expiry = new Date('2026-01-15');
    const now = new Date('2026-01-14T12:00:00Z');
    const out = computeNotifyAt(expiry, undefined, now);
    expect(out).toEqual(['2026-01-15T09:00:00.000Z']);
  });

  it('uses custom offsets when provided', () => {
    const expiry = new Date('2026-06-01');
    const out = computeNotifyAt(expiry, [14, 3]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('2026-05-18T09:00:00.000Z');
    expect(out[1]).toBe('2026-05-29T09:00:00.000Z');
  });

  it('deduplicates and sorts ascending', () => {
    const expiry = new Date('2026-06-01');
    const out = computeNotifyAt(expiry, [3, 3, 1]);
    expect(out).toEqual([
      '2026-05-29T09:00:00.000Z',
      '2026-05-31T09:00:00.000Z',
    ]);
  });

  it('exports DEFAULT_OFFSETS_DAYS = [7,3,1,0]', () => {
    expect(DEFAULT_OFFSETS_DAYS).toEqual([7, 3, 1, 0]);
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/notify-at.test.ts
```

- [x] **Step 3: Write `api/src/services/records/notify-at.ts`**

```ts
export const DEFAULT_OFFSETS_DAYS = [7, 3, 1, 0];

/**
 * Given a UTC expiry date (date-only) and a list of offsets in days,
 * return the absolute notification timestamps at 09:00 UTC, deduplicated,
 * sorted ascending, with past timestamps removed.
 */
export function computeNotifyAt(
  expiryDate: Date,
  offsetsDays: number[] = DEFAULT_OFFSETS_DAYS,
  now: Date = new Date(),
): string[] {
  const out = new Set<string>();
  for (const offset of offsetsDays) {
    const ts = new Date(expiryDate.getTime());
    ts.setUTCDate(ts.getUTCDate() - offset);
    ts.setUTCHours(9, 0, 0, 0);
    if (ts.getTime() > now.getTime()) {
      out.add(ts.toISOString());
    }
  }
  return [...out].sort();
}

/**
 * Resolve the offsets to use for a user when the request did not specify any.
 * Reads `users.notificationPreferences.offsetsDays`, falling back to the
 * default [7,3,1,0] when the column is null or malformed. An explicit
 * per-request `notificationOffsetsDays` (passed by the caller) takes
 * precedence over this and should be applied before calling here.
 */
export function resolveOffsetsForUser(
  prefs: unknown,
): number[] {
  if (prefs && typeof prefs === 'object') {
    const offs = (prefs as { offsetsDays?: unknown }).offsetsDays;
    if (Array.isArray(offs) && offs.every((n) => typeof n === 'number')) {
      return offs as number[];
    }
  }
  return DEFAULT_OFFSETS_DAYS;
}
```

- [x] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/notify-at.test.ts
```
Expected: 8 passed (5 `computeNotifyAt` + 3 `resolveOffsetsForUser`).

- [x] **Step 5: Commit**

```bash
git add api/src/services/records/notify-at.ts api/tests/unit/notify-at.test.ts
git commit -m "feat(api): notify-at computation with offsets"
```

---

## Phase G — Records HTTP routes

### Task G1: Record serializer + repository

**Files:**
- Create: `api/src/services/records/repository.ts`

- [x] **Step 1: Write `api/src/services/records/repository.ts`**

```ts
import type { Record as PrismaRecord } from '@prisma/client';
import type { Record as ApiRecord } from '@expyrico/shared';

export function toApiRecord(r: PrismaRecord): ApiRecord {
  return {
    id: r.id,
    clientId: r.clientId,
    userId: r.userId,
    productId: r.productId,
    customName: r.customName,
    category: r.category,
    expiryDate: r.expiryDate.toISOString().slice(0, 10),
    purchaseDate: r.purchaseDate ? r.purchaseDate.toISOString().slice(0, 10) : null,
    quantity: Number(r.quantity),
    unit: r.unit,
    price: r.price !== null ? Number(r.price) : null,
    store: r.store,
    notes: r.notes,
    photoUrl: r.photoUrl,
    status: r.status,
    notifyAt: Array.isArray(r.notifyAt) ? (r.notifyAt as string[]) : [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    consumedAt: r.consumedAt ? r.consumedAt.toISOString() : null,
  };
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/services/records/repository.ts
git commit -m "feat(api): record serializer"
```

---

### Task G2: `POST /v1/records` (idempotent create)

**Files:**
- Create: `api/src/routes/records/create.ts`
- Create: `api/src/routes/records/index.ts`
- Create: `api/tests/integration/records-crud.test.ts`
- Modify: `api/src/server.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/records-crud.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/records', () => {
  it('creates a record, computes notify_at, returns 201', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const p = await makeProduct({ name: 'Milk' });
    const clientId = randomUUID();
    const res = await app.inject({
      method: 'POST', url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: {
        clientId,
        productId: p.id,
        expiryDate: '2099-12-31',
        quantity: 2,
        unit: 'L',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.userId).toBe(user.id);
    expect(body.productId).toBe(p.id);
    expect(body.notifyAt.length).toBe(3); // default offsets all in future
    expect(body.clientId).toBe(clientId);
    await app.close();
  });

  it('replays response on duplicate Idempotency-Key', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const clientId = randomUUID();
    const payload = {
      clientId, customName: 'Bread',
      expiryDate: '2099-12-31', quantity: 1, unit: 'pcs',
    };
    const r1 = await app.inject({
      method: 'POST', url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload,
    });
    const r2 = await app.inject({
      method: 'POST', url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload,
    });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.json().id).toBe(r2.json().id);
    const rows = await getPrisma().record.findMany({ where: { clientId } });
    expect(rows).toHaveLength(1);
    await app.close();
  });

  it('400 when Idempotency-Key header is missing', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'POST', url: '/v1/records', headers,
      payload: {
        clientId: randomUUID(), customName: 'X',
        expiryDate: '2099-12-31', quantity: 1, unit: 'pcs',
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('400 when neither productId nor customName given', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const clientId = randomUUID();
    const res = await app.inject({
      method: 'POST', url: '/v1/records',
      headers: { ...headers, 'idempotency-key': clientId },
      payload: { clientId, expiryDate: '2099-12-31', quantity: 1, unit: 'pcs' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts
```

- [x] **Step 3: Write `api/src/routes/records/create.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { recordCreateSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../queues/index.js';
import { maybeActivateReferral } from '../../services/referral/activation.js';

export async function createRecordRoute(app: FastifyInstance) {
  app.post('/', {
    onRequest: app.requireAuth,
    config: { idempotent: 'required' },
  }, async (req, reply) => {
    const input = recordCreateSchema.parse(req.body);
    const userId = req.user!.id;
    // Explicit per-request offsets win; otherwise fall back to the user's
    // notificationPreferences.offsetsDays (default [7,3,1,0] when null).
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    const offsets =
      input.notificationOffsetsDays ?? resolveOffsetsForUser(user?.notificationPreferences);
    const notifyAt = computeNotifyAt(new Date(input.expiryDate), offsets);

    // Item limit (spec §2.17): free accounts cap at 50 ACTIVE records. At the
    // cap the add flow is read-only; existing records still editable + reminders
    // still fire. Counting active records keeps used/discarded items from blocking.
    const ITEM_LIMIT = 50;
    const activeCount = await getPrisma().record.count({
      where: { userId, status: 'active' },
    });
    if (activeCount >= ITEM_LIMIT) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.ITEM_LIMIT_REACHED,
        title: `Item limit of ${ITEM_LIMIT} reached`,
      });
    }

    try {
      const row = await getPrisma().record.create({
        data: {
          userId,
          clientId: input.clientId,
          productId: input.productId ?? null,
          customName: input.customName ?? null,
          category: input.category ?? null,
          expiryDate: new Date(input.expiryDate),
          purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
          quantity: input.quantity,
          unit: input.unit,
          price: input.price ?? null,
          store: input.store ?? null,
          notes: input.notes ?? null,
          photoUrl: input.photoUrl ?? null,
          notifyAt,
        },
      });
      await notificationScheduleQueue().add('schedule', { recordId: row.id }, {
        jobId: `schedule:${row.id}`,
        removeOnComplete: true,
        removeOnFail: 100,
      });
      // Passive referral activation (spec §2.14, M7): when this user's lifetime
      // record count reaches 5, mark their referral activated. No rewards in v1.x.
      await maybeActivateReferral(userId);
      return reply.status(201).send(toApiRecord(row));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // client_id collision – fetch and return existing
        const existing = await getPrisma().record.findUnique({
          where: { clientId: input.clientId },
        });
        if (existing && existing.userId === userId) {
          return reply.status(201).send(toApiRecord(existing));
        }
        throw new AppError({
          status: 409, code: ERROR_CODES.CONFLICT,
          title: 'client_id already used by another user',
        });
      }
      throw err;
    }
  });
}
```

- [x] **Step 4: Write `api/src/routes/records/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { createRecordRoute } from './create.js';

export async function recordRoutes(app: FastifyInstance) {
  await app.register(createRecordRoute);
}
```

- [x] **Step 5: Mount in `api/src/server.ts`**

Add:
```ts
import { recordRoutes } from './routes/records/index.js';
// ...
await app.register(recordRoutes, { prefix: '/v1/records' });
```

- [x] **Step 6: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts
```

- [x] **Step 7: Commit**

```bash
git add api/src/routes/records api/src/server.ts api/tests/integration/records-crud.test.ts
git commit -m "feat(api): POST /v1/records (idempotent, enqueues schedule job)"
```

---

### Task G3: `GET /v1/records` (cursor pagination)

**Files:**
- Create: `api/src/routes/records/list.ts`
- Modify: `api/src/routes/records/index.ts`
- Modify: `api/tests/integration/records-crud.test.ts`

- [x] **Step 1: Append test cases to `records-crud.test.ts`**

```ts
describe('GET /v1/records', () => {
  it('lists active records sorted by expiry ascending', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const prisma = getPrisma();
    await prisma.record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'Late',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    await prisma.record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'Soon',
        expiryDate: new Date('2027-01-01'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'GET', url: '/v1/records?status=active&sort=expiry&limit=10', headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].customName).toBe('Soon');
    expect(body.items[1].customName).toBe('Late');
    expect(body.nextCursor).toBeNull();
    await app.close();
  });

  it('paginates via cursor', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const prisma = getPrisma();
    for (let i = 0; i < 5; i++) {
      await prisma.record.create({
        data: {
          userId: user.id, clientId: randomUUID(), customName: `R${i}`,
          expiryDate: new Date(`2027-01-0${i + 1}`),
          quantity: 1, unit: 'pcs', notifyAt: [],
        },
      });
    }
    const r1 = await app.inject({
      method: 'GET', url: '/v1/records?limit=2', headers,
    });
    expect(r1.json().items).toHaveLength(2);
    const cursor = r1.json().nextCursor;
    expect(cursor).toBeTruthy();
    const r2 = await app.inject({
      method: 'GET', url: `/v1/records?limit=2&cursor=${encodeURIComponent(cursor)}`, headers,
    });
    expect(r2.json().items).toHaveLength(2);
    expect(r2.json().items[0].customName).not.toBe(r1.json().items[0].customName);
    await app.close();
  });

  it('only returns the caller\'s records', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const other = await makeUser({});
    await getPrisma().record.create({
      data: {
        userId: other.id, clientId: randomUUID(), customName: 'Theirs',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'Mine',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({ method: 'GET', url: '/v1/records', headers });
    const names = res.json().items.map((r: { customName: string }) => r.customName);
    expect(names).toContain('Mine');
    expect(names).not.toContain('Theirs');
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts -t "GET /v1/records"
```

- [x] **Step 3: Write `api/src/routes/records/list.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordListResponseSchema, recordStatusSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiRecord } from '../../services/records/repository.js';

const querySchema = z.object({
  status: recordStatusSchema.optional(),
  sort: z.enum(['expiry', 'created']).default('expiry'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface Cursor {
  expiryDate: string;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

function decodeCursor(s: string): Cursor | null {
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor;
  } catch {
    return null;
  }
}

export async function listRecordsRoute(app: FastifyInstance) {
  app.get('/', { onRequest: app.requireAuth }, async (req, reply) => {
    const q = querySchema.parse(req.query);
    const userId = req.user!.id;
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;

    const rows = await getPrisma().record.findMany({
      where: {
        userId,
        ...(q.status ? { status: q.status } : {}),
        ...(cursor
          ? {
              OR: [
                { expiryDate: { gt: new Date(cursor.expiryDate) } },
                {
                  expiryDate: new Date(cursor.expiryDate),
                  id: { gt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy:
        q.sort === 'expiry'
          ? [{ expiryDate: 'asc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }],
      take: q.limit + 1,
    });

    const hasMore = rows.length > q.limit;
    const items = hasMore ? rows.slice(0, q.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ expiryDate: last.expiryDate.toISOString(), id: last.id })
        : null;

    return reply.send(
      recordListResponseSchema.parse({
        items: items.map(toApiRecord),
        nextCursor,
      }),
    );
  });
}
```

- [x] **Step 4: Register in `api/src/routes/records/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { createRecordRoute } from './create.js';
import { listRecordsRoute } from './list.js';

export async function recordRoutes(app: FastifyInstance) {
  await app.register(listRecordsRoute);
  await app.register(createRecordRoute);
}
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts -t "GET /v1/records"
```

- [x] **Step 6: Commit**

```bash
git add api/src/routes/records/list.ts api/src/routes/records/index.ts api/tests/integration/records-crud.test.ts
git commit -m "feat(api): GET /v1/records with cursor pagination"
```

---

### Task G4: `PATCH /v1/records/:id`

**Files:**
- Create: `api/src/routes/records/patch.ts`
- Modify: `api/src/routes/records/index.ts`
- Modify: `api/tests/integration/records-crud.test.ts`

- [x] **Step 1: Append test cases**

```ts
describe('PATCH /v1/records/:id', () => {
  it('updates fields and recomputes notify_at when expiryDate changes', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const row = await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/records/${row.id}`, headers,
      payload: { expiryDate: '2099-06-01', quantity: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().quantity).toBe(5);
    expect(res.json().expiryDate).toBe('2099-06-01');
    expect(res.json().notifyAt.length).toBe(3);
    await app.close();
  });

  it('sets consumedAt when status flips to consumed', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const row = await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/records/${row.id}`, headers,
      payload: { status: 'consumed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('consumed');
    expect(res.json().consumedAt).not.toBeNull();
    await app.close();
  });

  it('404 on other user\'s record', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const other = await makeUser({});
    const row = await getPrisma().record.create({
      data: {
        userId: other.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'PATCH', url: `/v1/records/${row.id}`, headers,
      payload: { quantity: 2 },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts -t "PATCH /v1/records"
```

- [x] **Step 3: Write `api/src/routes/records/patch.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordPatchSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiRecord } from '../../services/records/repository.js';
import { computeNotifyAt, resolveOffsetsForUser } from '../../services/records/notify-at.js';
import { notificationScheduleQueue } from '../../queues/index.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function patchRecordRoute(app: FastifyInstance) {
  app.patch('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const input = recordPatchSchema.parse(req.body);
    const userId = req.user!.id;
    const prisma = getPrisma();
    const existing = await prisma.record.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError({
        status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found',
      });
    }

    const expiryChanged =
      input.expiryDate !== undefined && input.expiryDate !== existing.expiryDate.toISOString().slice(0, 10);
    const offsetsChanged = input.notificationOffsetsDays !== undefined;
    const reschedule = expiryChanged || offsetsChanged;

    const nextExpiry = input.expiryDate ? new Date(input.expiryDate) : existing.expiryDate;
    let nextNotifyAt: string[];
    if (reschedule) {
      // Explicit per-request offsets win; otherwise fall back to the user's
      // notificationPreferences.offsetsDays (default [7,3,1,0] when null).
      let offsets = input.notificationOffsetsDays;
      if (offsets === undefined) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { notificationPreferences: true },
        });
        offsets = resolveOffsetsForUser(user?.notificationPreferences);
      }
      nextNotifyAt = computeNotifyAt(nextExpiry, offsets);
    } else {
      nextNotifyAt = existing.notifyAt as string[];
    }

    const updated = await prisma.record.update({
      where: { id },
      data: {
        ...(input.customName !== undefined ? { customName: input.customName } : {}),
        ...(input.expiryDate !== undefined ? { expiryDate: new Date(input.expiryDate) } : {}),
        ...(input.purchaseDate !== undefined
          ? { purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null }
          : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.status === 'consumed' ? { consumedAt: new Date() } : {}),
        ...(reschedule ? { notifyAt: nextNotifyAt } : {}),
      },
    });

    if (reschedule) {
      await notificationScheduleQueue().add('schedule', { recordId: id }, {
        jobId: `schedule:${id}`,
        removeOnComplete: true,
        removeOnFail: 100,
      });
    }

    return reply.send(toApiRecord(updated));
  });
}
```

- [x] **Step 4: Register in `api/src/routes/records/index.ts`**

```ts
import { patchRecordRoute } from './patch.js';
// ...
  await app.register(patchRecordRoute);
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts -t "PATCH /v1/records"
```

- [x] **Step 6: Commit**

```bash
git add api/src/routes/records/patch.ts api/src/routes/records/index.ts api/tests/integration/records-crud.test.ts
git commit -m "feat(api): PATCH /v1/records/:id (re-schedules notifications)"
```

---

### Task G5: `DELETE /v1/records/:id`

**Files:**
- Create: `api/src/routes/records/delete.ts`
- Modify: `api/src/routes/records/index.ts`
- Modify: `api/tests/integration/records-crud.test.ts`

- [x] **Step 1: Append tests**

```ts
describe('DELETE /v1/records/:id', () => {
  it('hard-deletes the record and cancels scheduled jobs', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const row = await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'DELETE', url: `/v1/records/${row.id}`, headers,
    });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().record.findUnique({ where: { id: row.id } });
    expect(after).toBeNull();
    await app.close();
  });

  it('404 on other user\'s record', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const other = await makeUser({});
    const row = await getPrisma().record.create({
      data: {
        userId: other.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'DELETE', url: `/v1/records/${row.id}`, headers,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts -t "DELETE /v1/records"
```

- [x] **Step 3: Write `api/src/routes/records/delete.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { notificationSendQueue, notificationScheduleQueue } from '../../queues/index.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function deleteRecordRoute(app: FastifyInstance) {
  app.delete('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const userId = req.user!.id;
    const existing = await getPrisma().record.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError({
        status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found',
      });
    }
    await getPrisma().record.delete({ where: { id } });

    // Cancel pending notifications for this record
    const sendQ = notificationSendQueue();
    const scheduleQ = notificationScheduleQueue();
    const jobs = await sendQ.getJobs(['delayed', 'waiting']);
    await Promise.all(
      jobs.filter((j) => j.data?.recordId === id).map((j) => j.remove()),
    );
    const scheduleJob = await scheduleQ.getJob(`schedule:${id}`);
    if (scheduleJob) await scheduleJob.remove();

    return reply.status(204).send();
  });
}
```

- [x] **Step 4: Register in `api/src/routes/records/index.ts`**

```ts
import { deleteRecordRoute } from './delete.js';
// ...
  await app.register(deleteRecordRoute);
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-crud.test.ts -t "DELETE /v1/records"
```

- [x] **Step 6: Commit**

```bash
git add api/src/routes/records/delete.ts api/src/routes/records/index.ts api/tests/integration/records-crud.test.ts
git commit -m "feat(api): DELETE /v1/records/:id cancels pending notifications"
```

---

### Task G6: `POST /v1/records/sync` (batch endpoint, LWW)

**Files:**
- Create: `api/src/services/records/sync.ts`
- Create: `api/src/routes/records/sync.ts`
- Create: `api/tests/integration/records-sync.test.ts`
- Modify: `api/src/routes/records/index.ts`

- [x] **Step 1: Write the failing test `api/tests/integration/records-sync.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/records/sync', () => {
  it('upserts batched records and returns server changes since `since`', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    // server-side record the client doesn't know about
    await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'ServerOnly',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });

    const clientId = randomUUID();
    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync', headers,
      payload: {
        since: null,
        upserts: [
          {
            clientId, customName: 'FromMobile',
            expiryDate: '2099-12-31', quantity: 2, unit: 'pcs',
            updatedAt: new Date().toISOString(),
          },
        ],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.serverTime).toBeTruthy();
    const names = body.changes.map((r: { customName: string }) => r.customName);
    expect(names).toContain('ServerOnly');
    expect(names).toContain('FromMobile');
    await app.close();
  });

  it('last-write-wins on client_id collision (newer updatedAt overwrites)', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const clientId = randomUUID();
    await getPrisma().record.create({
      data: {
        userId: user.id, clientId, customName: 'Old',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
        updatedAt: new Date('2020-01-01'),
      },
    });
    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync', headers,
      payload: {
        since: null,
        upserts: [
          {
            clientId, customName: 'New',
            expiryDate: '2099-12-31', quantity: 1, unit: 'pcs',
            updatedAt: new Date().toISOString(),
          },
        ],
        deletes: [],
      },
    });
    expect(res.statusCode).toBe(200);
    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('New');
    await app.close();
  });

  it('older client updatedAt is ignored', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const clientId = randomUUID();
    await getPrisma().record.create({
      data: {
        userId: user.id, clientId, customName: 'Server',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    await app.inject({
      method: 'POST', url: '/v1/records/sync', headers,
      payload: {
        since: null,
        upserts: [
          {
            clientId, customName: 'Stale',
            expiryDate: '2099-12-31', quantity: 1, unit: 'pcs',
            updatedAt: new Date('2020-01-01').toISOString(),
          },
        ],
        deletes: [],
      },
    });
    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('Server');
    await app.close();
  });

  it('honors deletes array', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const row = await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'POST', url: '/v1/records/sync', headers,
      payload: { since: null, upserts: [], deletes: [row.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deletedIds).toContain(row.id);
    expect(await getPrisma().record.findUnique({ where: { id: row.id } })).toBeNull();
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-sync.test.ts
```

- [x] **Step 3: Write `api/src/services/records/sync.ts`**

> Note: this batch endpoint receives the delta cursor as `since` inside the POST body (`recordSyncBatchSchema`), not as a `?since=` query param. Spec §6.3 mentions `?since=` for the GET delta-pull style; M1 deliberately keeps the cursor in the batch body because push + pull happen in one round-trip.

```ts
import type { Record as PrismaRecord } from '@prisma/client';
import type { RecordSyncBatch } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { computeNotifyAt, resolveOffsetsForUser } from './notify-at.js';

export interface SyncOutcome {
  changes: PrismaRecord[];
  deletedIds: string[];
  serverTime: Date;
}

export async function syncRecords(userId: string, batch: RecordSyncBatch): Promise<SyncOutcome> {
  const prisma = getPrisma();
  const serverTime = new Date();
  const deletedIds: string[] = [];

  // Resolve the user's default notification offsets once for the whole batch.
  // A per-upsert `notificationOffsetsDays` (when present) still wins below.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const userOffsets = resolveOffsetsForUser(user?.notificationPreferences);

  // 1. Apply deletes (only the caller's records)
  if (batch.deletes.length > 0) {
    const owned = await prisma.record.findMany({
      where: { id: { in: batch.deletes }, userId },
      select: { id: true },
    });
    const ownedIds = owned.map((r) => r.id);
    if (ownedIds.length > 0) {
      await prisma.record.deleteMany({ where: { id: { in: ownedIds } } });
      deletedIds.push(...ownedIds);
    }
  }

  // 2. Apply upserts with last-write-wins on (clientId, updatedAt)
  for (const u of batch.upserts) {
    const existing = await prisma.record.findUnique({ where: { clientId: u.clientId } });
    const clientUpdatedAt = new Date(u.updatedAt);
    if (existing && existing.userId !== userId) continue; // ignore foreign client_id
    if (existing && existing.updatedAt >= clientUpdatedAt) continue; // server is newer
    const offsets = u.notificationOffsetsDays ?? userOffsets;
    const notifyAt = computeNotifyAt(new Date(u.expiryDate), offsets);
    await prisma.record.upsert({
      where: { clientId: u.clientId },
      create: {
        userId,
        clientId: u.clientId,
        productId: u.productId ?? null,
        customName: u.customName ?? null,
        expiryDate: new Date(u.expiryDate),
        purchaseDate: u.purchaseDate ? new Date(u.purchaseDate) : null,
        quantity: u.quantity,
        unit: u.unit,
        notes: u.notes ?? null,
        photoUrl: u.photoUrl ?? null,
        status: u.status ?? 'active',
        notifyAt,
      },
      update: {
        productId: u.productId ?? null,
        customName: u.customName ?? null,
        expiryDate: new Date(u.expiryDate),
        purchaseDate: u.purchaseDate ? new Date(u.purchaseDate) : null,
        quantity: u.quantity,
        unit: u.unit,
        notes: u.notes ?? null,
        photoUrl: u.photoUrl ?? null,
        status: u.status ?? existing?.status ?? 'active',
        notifyAt,
      },
    });
  }

  // 3. Return server-side changes since `since`
  const sinceDate = batch.since ? new Date(batch.since) : new Date(0);
  const changes = await prisma.record.findMany({
    where: { userId, updatedAt: { gt: sinceDate } },
    orderBy: { updatedAt: 'asc' },
    take: 1000,
  });

  return { changes, deletedIds, serverTime };
}
```

- [x] **Step 4: Write `api/src/routes/records/sync.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { recordSyncBatchSchema, recordSyncResponseSchema } from '@expyrico/shared';
import { syncRecords } from '../../services/records/sync.js';
import { toApiRecord } from '../../services/records/repository.js';

export async function syncRecordsRoute(app: FastifyInstance) {
  app.post('/sync', { onRequest: app.requireAuth }, async (req, reply) => {
    const batch = recordSyncBatchSchema.parse(req.body);
    const result = await syncRecords(req.user!.id, batch);
    return reply.send(
      recordSyncResponseSchema.parse({
        serverTime: result.serverTime.toISOString(),
        changes: result.changes.map(toApiRecord),
        deletedIds: result.deletedIds,
      }),
    );
  });
}
```

- [x] **Step 5: Register in `api/src/routes/records/index.ts`**

```ts
import { syncRecordsRoute } from './sync.js';
// ...
  await app.register(syncRecordsRoute);
```

- [x] **Step 6: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/records-sync.test.ts
```

- [x] **Step 7: Commit**

```bash
git add api/src/services/records/sync.ts api/src/routes/records/sync.ts api/src/routes/records/index.ts api/tests/integration/records-sync.test.ts
git commit -m "feat(api): POST /v1/records/sync (batch LWW)"
```

---

## Phase H — Push tokens

### Task H1: Push token repository

**Files:**
- Create: `api/src/services/push/repository.ts`

- [x] **Step 1: Write `api/src/services/push/repository.ts`**

```ts
import type { PushToken } from '@prisma/client';
import { getPrisma } from '../../db.js';

export async function upsertPushToken(input: {
  userId: string;
  expoPushToken: string;
  platform: 'ios' | 'android';
  deviceInfo?: Record<string, unknown> | undefined;
}): Promise<PushToken> {
  return getPrisma().pushToken.upsert({
    where: { expoPushToken: input.expoPushToken },
    create: {
      userId: input.userId,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
      deviceInfo: (input.deviceInfo ?? null) as never,
    },
    update: {
      userId: input.userId,
      platform: input.platform,
      deviceInfo: (input.deviceInfo ?? null) as never,
      lastUsedAt: new Date(),
      revokedAt: null,
    },
  });
}

export async function revokePushToken(userId: string, id: string): Promise<boolean> {
  const found = await getPrisma().pushToken.findFirst({ where: { id, userId } });
  if (!found) return false;
  await getPrisma().pushToken.update({ where: { id }, data: { revokedAt: new Date() } });
  return true;
}

export async function activeTokensForUser(userId: string): Promise<PushToken[]> {
  return getPrisma().pushToken.findMany({ where: { userId, revokedAt: null } });
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/services/push/repository.ts
git commit -m "feat(api): push token repository"
```

---

### Task H2: `POST /v1/me/push-token` + `DELETE /v1/me/push-token/:id`

**Files:**
- Create: `api/src/routes/me/push-token.ts`
- Create: `api/tests/integration/push-token.test.ts`
- Modify: `api/src/server.ts` (and create `api/src/routes/me/index.ts` if M0b hasn't already)

- [x] **Step 1: Write the failing test `api/tests/integration/push-token.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('push token routes', () => {
  it('upserts a push token', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const res = await app.inject({
      method: 'POST', url: '/v1/me/push-token', headers,
      payload: {
        expoPushToken: 'ExponentPushToken[xxxxx]',
        platform: 'ios',
        deviceInfo: { model: 'iPhone15' },
      },
    });
    expect(res.statusCode).toBe(201);
    const rows = await getPrisma().pushToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.platform).toBe('ios');
    await app.close();
  });

  it('upsert is idempotent on token value', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const payload = { expoPushToken: 'ExponentPushToken[same]', platform: 'android' };
    await app.inject({ method: 'POST', url: '/v1/me/push-token', headers, payload });
    await app.inject({ method: 'POST', url: '/v1/me/push-token', headers, payload });
    const rows = await getPrisma().pushToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    await app.close();
  });

  it('revokes a token by id', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const created = await app.inject({
      method: 'POST', url: '/v1/me/push-token', headers,
      payload: { expoPushToken: 'ExponentPushToken[revoke]', platform: 'android' },
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'DELETE', url: `/v1/me/push-token/${id}`, headers,
    });
    expect(res.statusCode).toBe(204);
    const row = await getPrisma().pushToken.findUnique({ where: { id } });
    expect(row?.revokedAt).not.toBeNull();
    await app.close();
  });

  it('rejects invalid token format', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'POST', url: '/v1/me/push-token', headers,
      payload: { expoPushToken: 'not-a-token', platform: 'ios' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/push-token.test.ts
```

- [x] **Step 3: Write `api/src/routes/me/push-token.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pushTokenRegisterSchema, pushTokenSchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { upsertPushToken, revokePushToken } from '../../services/push/repository.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function pushTokenRoutes(app: FastifyInstance) {
  app.post('/push-token', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = pushTokenRegisterSchema.parse(req.body);
    const row = await upsertPushToken({
      userId: req.user!.id,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
      deviceInfo: input.deviceInfo,
    });
    return reply.status(201).send(
      pushTokenSchema.parse({
        id: row.id,
        expoPushToken: row.expoPushToken,
        platform: row.platform,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      }),
    );
  });

  app.delete('/push-token/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const ok = await revokePushToken(req.user!.id, id);
    if (!ok) {
      throw new AppError({
        status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Push token not found',
      });
    }
    return reply.status(204).send();
  });
}
```

- [x] **Step 4: Mount in `api/src/server.ts`**

Canonical composition: a single `meScope` sub-app registered once under `prefix: '/v1/me'`, with `pushTokenRoutes` (and later `countrySuggestionRoute`) registered inside it (child routes use no prefix). If `api/src/routes/me/index.ts` already exists from M0b, add `pushTokenRoutes` to that sub-app instead of creating a new one.

```ts
import { pushTokenRoutes } from './routes/me/push-token.js';
// ...
await app.register(
  async (meScope) => {
    await meScope.register(pushTokenRoutes);
    // country-suggestion route is registered here in Task H3
  },
  { prefix: '/v1/me' },
);
```

- [x] **Step 5: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/push-token.test.ts
```

- [x] **Step 6: Commit**

```bash
git add api/src/routes/me/push-token.ts api/src/server.ts api/tests/integration/push-token.test.ts
git commit -m "feat(api): push token register + revoke routes"
```

---

### Task H3: `GET /v1/me/country-suggestion` (D28)

**Files:**
- Create: `api/src/routes/me/country-suggestion.ts`
- Modify: `api/src/server.ts` (mount the route)
- Create: `api/tests/integration/country-suggestion.test.ts`
- Modify: `packages/shared/src/schemas/user.ts` (add `countrySuggestionSchema`)

- [ ] **Step 1: Add Zod schema in `@expyrico/shared`**

```ts
// packages/shared/src/schemas/user.ts (append)
export const countrySuggestionSchema = z.object({
  country: z.string().length(2).nullable(),
});
export type CountrySuggestion = z.infer<typeof countrySuggestionSchema>;
```

- [ ] **Step 2: Write the failing integration test**

```ts
// api/tests/integration/country-suggestion.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp, signInAs } from '../helpers/app.js';
import { makeUser } from '../helpers/factories.js';

vi.mock('../../src/services/users/country-detect.js', () => ({
  detectCountryFromIp: vi.fn(async (ip: string) => (ip === '127.0.0.1' ? 'US' : null)),
}));

describe('GET /v1/me/country-suggestion', () => {
  const ctx = buildTestApp();
  beforeAll(() => ctx.start());
  afterAll(() => ctx.stop());

  it('returns the detected country code for a request IP', async () => {
    const u = await makeUser({});
    const headers = await signInAs(ctx.app, u);
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/me/country-suggestion', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ country: 'US' });
  });

  it('returns null when detection fails', async () => {
    const u = await makeUser({});
    const headers = await signInAs(ctx.app, u);
    // simulate a non-detectable IP by overriding the mock for this call
    const mod = await import('../../src/services/users/country-detect.js');
    (mod.detectCountryFromIp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/me/country-suggestion', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ country: null });
  });
});
```

- [ ] **Step 3: Run, verify FAIL** — `pnpm --filter @expyrico/api test country-suggestion`

- [ ] **Step 4: Implement the route**

```ts
// api/src/routes/me/country-suggestion.ts
import type { FastifyInstance } from 'fastify';
import { countrySuggestionSchema } from '@expyrico/shared';
import { detectCountryFromIp } from '../../services/users/country-detect.js';

export async function countrySuggestionRoute(app: FastifyInstance) {
  app.get(
    '/country-suggestion',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const country = await detectCountryFromIp(req.ip);
      return countrySuggestionSchema.parse({ country });
    },
  );
}
```

- [ ] **Step 5: Wire into the `/v1/me` mount**

In `api/src/server.ts`, add the import alongside the other route imports and register the route inside the same `meScope` sub-app created in Task H2 (do NOT add a second `/v1/me` registration):
```ts
import { countrySuggestionRoute } from './routes/me/country-suggestion.js';
// ...
await app.register(
  async (meScope) => {
    await meScope.register(pushTokenRoutes);
    await meScope.register(countrySuggestionRoute);
  },
  { prefix: '/v1/me' },
);
```

- [ ] **Step 6: Re-run, verify PASS** — `pnpm --filter @expyrico/api test country-suggestion`

- [ ] **Step 7: Commit**

```bash
git add api/src/routes/me/country-suggestion.ts api/src/server.ts \
  api/tests/integration/country-suggestion.test.ts \
  packages/shared/src/schemas/user.ts
git commit -m "feat(api): GET /v1/me/country-suggestion (D28)"
```

### Task H4: Mobile — show country suggestion on first profile open (D28)

**Files:**
- Modify: `apps/mobile/src/api/me.ts` (add `useCountrySuggestion` hook)
- Modify: `apps/mobile/app/(app)/(tabs)/profile.tsx` (consume + pre-fill)

- [ ] **Step 1: Add the hook**

```ts
// apps/mobile/src/api/me.ts (append)
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { CountrySuggestion } from '@expyrico/shared';

export function useCountrySuggestion(enabled: boolean) {
  return useQuery({
    queryKey: ['me', 'country-suggestion'],
    queryFn: () => apiClient.get<CountrySuggestion>('/me/country-suggestion'),
    enabled,
    staleTime: Infinity,
  });
}
```

- [ ] **Step 2: Profile screen consumes the hook**

In `apps/mobile/app/(app)/(tabs)/profile.tsx`, when the loaded user's `country` is null, call `useCountrySuggestion(user.country === null)` and pre-fill the country field with `data?.country ?? ''`. User can override before saving via the existing `PATCH /me` form.

- [ ] **Step 3: RNTL test** — mock the hook to return `{ country: 'US' }` and assert the country input renders `US` as the initial value when the user's country is null.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/api/me.ts apps/mobile/app/\(app\)/\(tabs\)/profile.tsx
git commit -m "feat(mobile): show country suggestion on profile when missing (D28)"
```

---

## Phase H2 — Item limit, duplicate, usage (2026-06-08 revision)

Backend support for the 50-item cap (§2.17), the duplicate action (§2.2), and the usage endpoint that drives the mobile read-only/CTA state. The create-route cap check is already wired in Task G2.

### Task H2.1: Add `ITEM_LIMIT_REACHED` error code to shared

**Files:**
- Modify: `packages/shared/src/errors.ts` (the `ERROR_CODES` map)

- [ ] Add `ITEM_LIMIT_REACHED: 'item_limit_reached'` to `ERROR_CODES`. (Stable snake_case identifier, per spec §6.8.) Export `ITEM_LIMIT = 50` as a shared constant so mobile + api agree.
- [ ] `pnpm --filter @expyrico/shared typecheck` → exit 0. Commit.

### Task H2.2: `GET /v1/me/usage`

**Files:**
- Create: `api/src/routes/me/usage.ts` (registered inside the `meScope` sub-app)
- Create: `api/tests/integration/me-usage.test.ts`

- [ ] **Test first:** a user with N active records gets `{ itemCount: N, itemLimit: 50, readOnly: N >= 50 }`. Seed 50 active records → `readOnly: true`. Consumed/discarded records do not count toward `itemCount`.
- [ ] **Implement:** count `record` where `{ userId, status: 'active' }`; return the shape above. Add `meUsageResponseSchema` to `packages/shared` (`{ itemCount, itemLimit, readOnly }`, all camelCase).
- [ ] Run, verify pass. Commit.

### Task H2.3: `POST /v1/records/:id/duplicate`

**Files:**
- Create: `api/src/routes/records/duplicate.ts`
- Create: `api/tests/integration/records-duplicate.test.ts`
- Modify: `api/src/routes/records/index.ts`

- [ ] **Test first:** duplicating a record copies `productId`, `customName`, `category`, `quantity`, `unit`, `price`, `store`, `notes`, `photoUrl` but **omits `expiryDate`** — the response requires the client to supply a new expiry (return `422 expiry_required` if the body has no `expiryDate`, or accept `{ expiryDate }` in the body and use it). One-per-user ownership enforced (404 on another user's record). Duplicate also counts against the 50-item cap (409 at the limit).
- [ ] **Implement:** load the source record (scoped to `req.user.id`), build a create payload from it minus `expiryDate`, require `expiryDate` from the request body, generate a fresh `clientId`, run the same cap check + `computeNotifyAt` + schedule enqueue as Task G2. Return `201` with `toApiRecord`.
- [ ] Mount in `records/index.ts`. Run, verify pass. Commit.

> **Note — `maybeActivateReferral`:** Task G2 imports `maybeActivateReferral` from `api/src/services/referral/activation.js`. That module is **owned by M7** (referral milestone). Until M7 lands, ship a no-op stub at that path (`export async function maybeActivateReferral(_userId: string): Promise<void> {}`) so M1 compiles; M7 replaces the body with the real passive-activation logic (mark `referrals.activated_at` when the referee's lifetime item count reaches 5).

---

## Phase I — Workers (BullMQ)

### Task I1: Add `expo-server-sdk` dep + Expo Push wrapper

**Files:**
- Modify: `api/package.json` (add `expo-server-sdk`)
- Create: `api/src/services/push/expo-push.ts`

- [x] **Step 1: Install dependency**

```bash
pnpm --filter @expyrico/api add expo-server-sdk
```
Expected: `expo-server-sdk` appears in `api/package.json`.

- [x] **Step 2: Write `api/src/services/push/expo-push.ts`**

```ts
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { makeBreaker } from '../../lib/breaker.js';
import { register } from '../external/breakers.js';

const expo = new Expo();

async function sendChunk(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  return expo.sendPushNotificationsAsync(messages);
}

export const expoPushBreaker = makeBreaker(sendChunk, {
  name: 'expo-push',
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

// D11: register in the global breaker registry.
register('expo-push', expoPushBreaker);

export async function sendPush(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const valid = messages.filter((m) => Expo.isExpoPushToken(m.to as string));
  if (valid.length === 0) return [];
  return expoPushBreaker.fire(valid);
}

export { Expo };
```

- [x] **Step 3: Commit**

```bash
git add api/package.json api/src/services/push/expo-push.ts
git commit -m "feat(api): Expo push wrapper with circuit breaker"
```

---

### Task I2: `notification-schedule` worker

**Files:**
- Create: `api/src/workers/notification-schedule.ts`
- Create: `api/tests/unit/worker-notification-schedule.test.ts`

- [x] **Step 1: Write the failing test `api/tests/unit/worker-notification-schedule.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const addMock = vi.fn();
const removeMock = vi.fn();
const getJobsMock = vi.fn().mockResolvedValue([]);

vi.mock('../../src/queues/index.js', () => ({
  notificationSendQueue: () => ({
    add: addMock, getJobs: getJobsMock, getJob: vi.fn().mockResolvedValue(null),
  }),
}));

import { processScheduleJob } from '../../src/workers/notification-schedule.js';
import { getPrisma } from '../../src/db.js';
import { makeUser, makeRecord } from '../helpers/factories.js';

describe('notification-schedule worker', () => {
  beforeEach(() => {
    addMock.mockReset();
    removeMock.mockReset();
    getJobsMock.mockReset().mockResolvedValue([]);
  });

  it('enqueues one notification-send per notify_at timestamp', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, {
      expiryDate: new Date('2099-12-31'),
      notifyAt: [
        '2099-12-24T09:00:00.000Z',
        '2099-12-30T09:00:00.000Z',
        '2099-12-31T09:00:00.000Z',
      ],
    });
    await processScheduleJob({ recordId: r.id });
    expect(addMock).toHaveBeenCalledTimes(3);
    const call0 = addMock.mock.calls[0]![1];
    expect(call0.userId).toBe(u.id);
    expect(call0.recordId).toBe(r.id);
    expect(call0.templateKey).toBe('expiry_reminder'); // default template threaded to send job
  });

  it('cancels existing delayed jobs for the record before re-enqueuing', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, { notifyAt: ['2099-12-31T09:00:00.000Z'] });
    const stale = { data: { recordId: r.id }, remove: removeMock };
    getJobsMock.mockResolvedValue([stale, { data: { recordId: 'other' }, remove: vi.fn() }]);
    await processScheduleJob({ recordId: r.id });
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('no-op when record has empty notify_at', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, { notifyAt: [] });
    await processScheduleJob({ recordId: r.id });
    expect(addMock).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/worker-notification-schedule.test.ts
```

- [x] **Step 3: Write `api/src/workers/notification-schedule.ts`**

```ts
import { Worker } from 'bullmq';
import { getPrisma } from '../db.js';
import {
  NOTIFICATION_SCHEDULE_QUEUE,
  notificationSendQueue,
  getQueueConnection,
  type NotificationScheduleJob,
} from '../queues/index.js';
import { logger } from '../logger.js';

// Default notification template written into every send job. push_logs.templateKey
// is NOT NULL, so the send job must always carry one. M2 may vary this per-record.
const DEFAULT_TEMPLATE_KEY = 'expiry_reminder';

export async function processScheduleJob(data: NotificationScheduleJob): Promise<void> {
  const prisma = getPrisma();
  const record = await prisma.record.findUnique({ where: { id: data.recordId } });
  if (!record || record.status !== 'active') return;

  const sendQ = notificationSendQueue();
  // Remove any previously enqueued send jobs for this record
  const pending = await sendQ.getJobs(['delayed', 'waiting', 'paused']);
  for (const job of pending) {
    if (job.data?.recordId === data.recordId) {
      await job.remove();
    }
  }

  const notifyAt = (record.notifyAt as string[]) ?? [];
  const now = Date.now();
  for (const isoTs of notifyAt) {
    const fireAt = new Date(isoTs).getTime();
    const delay = Math.max(0, fireAt - now);
    const expiryMs = record.expiryDate.getTime();
    const offsetDays = Math.round((expiryMs - fireAt) / (24 * 3600 * 1000));
    await sendQ.add(
      'send',
      {
        recordId: record.id,
        userId: record.userId,
        fireAt: isoTs,
        offsetDays,
        templateKey: DEFAULT_TEMPLATE_KEY,
      },
      {
        delay,
        jobId: `send:${record.id}:${isoTs}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }
}

export function startScheduleWorker(): Worker<NotificationScheduleJob> {
  const worker = new Worker<NotificationScheduleJob>(
    NOTIFICATION_SCHEDULE_QUEUE,
    async (job) => processScheduleJob(job.data),
    { connection: getQueueConnection(), concurrency: 8 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ err, jobId: job?.id }, 'notification-schedule worker failed'),
  );
  return worker;
}
```

- [x] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/worker-notification-schedule.test.ts
```

- [x] **Step 5: Commit**

```bash
git add api/src/workers/notification-schedule.ts api/tests/unit/worker-notification-schedule.test.ts
git commit -m "feat(api): notification-schedule worker"
```

---

### Task I3: `notification-send` worker

**Files:**
- Create: `api/src/workers/notification-send.ts`
- Create: `api/tests/unit/worker-notification-send.test.ts`

- [x] **Step 1: Write the failing test `api/tests/unit/worker-notification-send.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const sendPushMock = vi.fn();
vi.mock('../../src/services/push/expo-push.ts', () => ({
  sendPush: sendPushMock,
  Expo: { isExpoPushToken: () => true },
}));

import { processSendJob } from '../../src/workers/notification-send.js';
import { getPrisma } from '../../src/db.js';
import { makeUser, makeRecord } from '../helpers/factories.js';

describe('notification-send worker', () => {
  beforeEach(() => sendPushMock.mockReset());

  it('sends a push per active token and writes a push_logs row each (templateKey persisted)', async () => {
    sendPushMock.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
    const u = await makeUser({});
    const r = await makeRecord(u.id, { customName: 'Yogurt', expiryDate: new Date('2099-12-31') });
    await getPrisma().pushToken.create({
      data: { userId: u.id, expoPushToken: 'ExponentPushToken[a]', platform: 'ios' },
    });
    await getPrisma().pushToken.create({
      data: { userId: u.id, expoPushToken: 'ExponentPushToken[b]', platform: 'android' },
    });
    await processSendJob({
      recordId: r.id, userId: u.id,
      fireAt: '2099-12-30T09:00:00.000Z', offsetDays: 1,
      templateKey: 'expiry.warning_1d',
    });
    expect(sendPushMock).toHaveBeenCalledTimes(1); // one chunk of two messages
    const logs = await getPrisma().pushLog.findMany({ where: { userId: u.id } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]!.status).toBe('sent');
    expect(logs[0]!.templateKey).toBe('expiry.warning_1d');
  });

  it('writes a failed log when the chunk returns an error ticket', async () => {
    sendPushMock.mockResolvedValue([{ status: 'error', message: 'DeviceNotRegistered' }]);
    const u = await makeUser({});
    const r = await makeRecord(u.id, { customName: 'X' });
    await getPrisma().pushToken.create({
      data: { userId: u.id, expoPushToken: 'ExponentPushToken[err]', platform: 'ios' },
    });
    await processSendJob({
      recordId: r.id, userId: u.id,
      fireAt: '2099-12-31T09:00:00.000Z', offsetDays: 0,
      templateKey: 'expiry.today',
    });
    const logs = await getPrisma().pushLog.findMany({ where: { userId: u.id } });
    expect(logs[0]!.status).toBe('failed');
    expect(logs[0]!.errorMessage).toContain('DeviceNotRegistered');
    expect(logs[0]!.templateKey).toBe('expiry.today');
  });

  it('skips when record has been deleted or is not active', async () => {
    const u = await makeUser({});
    const r = await makeRecord(u.id, { status: 'consumed' });
    await processSendJob({
      recordId: r.id, userId: u.id,
      fireAt: '2099-12-31T09:00:00.000Z', offsetDays: 0,
      templateKey: 'expiry.today',
    });
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/worker-notification-send.test.ts
```

- [x] **Step 3: Write `api/src/workers/notification-send.ts`**

```ts
import { Worker } from 'bullmq';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { getPrisma } from '../db.js';
import {
  NOTIFICATION_SEND_QUEUE,
  getQueueConnection,
  type NotificationSendJob,
} from '../queues/index.js';
import { sendPush } from '../services/push/expo-push.js';
import { activeTokensForUser } from '../services/push/repository.js';
import { logger } from '../logger.js';

function bodyFor(offsetDays: number, name: string): string {
  if (offsetDays >= 7) return `${name} expires in ${offsetDays} days`;
  if (offsetDays > 1) return `${name} expires in ${offsetDays} days`;
  if (offsetDays === 1) return `${name} expires tomorrow`;
  return `${name} expires today`;
}

export async function processSendJob(data: NotificationSendJob): Promise<void> {
  const prisma = getPrisma();
  const record = await prisma.record.findUnique({
    where: { id: data.recordId },
    include: { product: true },
  });
  if (!record || record.status !== 'active') return;

  const name = record.customName ?? record.product?.name ?? 'Item';
  const tokens = await activeTokensForUser(data.userId);
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.expoPushToken,
    sound: 'default',
    title: 'Expyrico',
    body: bodyFor(data.offsetDays, name),
    data: { recordId: record.id, type: 'expiry' },
  }));

  let tickets: Array<{ status?: string; id?: string; message?: string }> = [];
  try {
    tickets = (await sendPush(messages)) as typeof tickets;
  } catch (err) {
    logger.warn({ err, recordId: record.id }, 'expo push send failed (circuit?)');
    for (const t of tokens) {
      await prisma.pushLog.create({
        data: {
          userId: data.userId,
          recordId: record.id,
          templateKey: data.templateKey,
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'send failed',
        },
      });
    }
    throw err; // let BullMQ retry per attempts config
  }

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]!;
    await prisma.pushLog.create({
      data: {
        userId: data.userId,
        recordId: record.id,
        expoTicketId: ticket.id ?? null,
        templateKey: data.templateKey,
        status: ticket.status === 'ok' ? 'sent' : 'failed',
        errorMessage: ticket.status === 'ok' ? null : ticket.message ?? 'unknown',
      },
    });
  }
}

export function startSendWorker(): Worker<NotificationSendJob> {
  const worker = new Worker<NotificationSendJob>(
    NOTIFICATION_SEND_QUEUE,
    async (job) => processSendJob(job.data),
    { connection: getQueueConnection(), concurrency: 4 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ err, jobId: job?.id }, 'notification-send worker failed'),
  );
  return worker;
}
```

- [x] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/worker-notification-send.test.ts
```

- [x] **Step 5: Commit**

```bash
git add api/src/workers/notification-send.ts api/tests/unit/worker-notification-send.test.ts
git commit -m "feat(api): notification-send worker with push_logs"
```

---

### Task I4: `product-lookup` background worker

**Files:**
- Create: `api/src/workers/product-lookup.ts`

- [x] **Step 1: Write `api/src/workers/product-lookup.ts`**

```ts
import { Worker } from 'bullmq';
import { lookupProduct } from '../services/products/lookup.js';
import { PRODUCT_LOOKUP_QUEUE, getQueueConnection, type ProductLookupJob } from '../queues/index.js';
import { logger } from '../logger.js';

/**
 * Background backfill of a barcode that missed the synchronous lookup path.
 * Uses the same lookup service but the worker can afford a longer effective
 * timeout (BullMQ retries) and wider retry budget than the HTTP path.
 */
export function startProductLookupWorker(): Worker<ProductLookupJob> {
  const worker = new Worker<ProductLookupJob>(
    PRODUCT_LOOKUP_QUEUE,
    async (job) => {
      const product = await lookupProduct({ barcode: job.data.barcode });
      if (product) {
        logger.info({ barcode: job.data.barcode, productId: product.id }, 'product backfill hit');
      } else {
        logger.info({ barcode: job.data.barcode }, 'product backfill miss');
      }
    },
    { connection: getQueueConnection(), concurrency: 2 },
  );
  worker.on('failed', (job, err) =>
    logger.warn({ err, jobId: job?.id, barcode: job?.data.barcode }, 'product-lookup retry'),
  );
  return worker;
}
```

- [x] **Step 2: Commit**

```bash
git add api/src/workers/product-lookup.ts
git commit -m "feat(api): product-lookup background worker"
```

---

### Task I5: Worker runner + server boot wiring

**Files:**
- Create: `api/src/workers/runner.ts`
- Modify: `api/src/server.ts`

- [x] **Step 1: Write `api/src/workers/runner.ts`**

```ts
import type { Worker } from 'bullmq';
import { startScheduleWorker } from './notification-schedule.js';
import { startSendWorker } from './notification-send.js';
import { startProductLookupWorker } from './product-lookup.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

let _workers: Worker[] | null = null;

export function startWorkers(): Worker[] {
  if (_workers) return _workers;
  // Skip in test env unless explicitly requested
  if (getConfig().env === 'test' && process.env.RUN_WORKERS !== '1') {
    logger.info('workers disabled in test env');
    return [];
  }
  _workers = [startScheduleWorker(), startSendWorker(), startProductLookupWorker()];
  logger.info({ count: _workers.length }, 'workers started');
  return _workers;
}

export async function stopWorkers(): Promise<void> {
  if (!_workers) return;
  await Promise.all(_workers.map((w) => w.close()));
  _workers = null;
}
```

- [x] **Step 2: Boot workers when the API starts (only in `dev`/`production`)**

In `api/src/server.ts`, find the bottom block that calls `app.listen({...})` (after `if (import.meta.url === ...)`). Add immediately before `await app.listen(...)`:
```ts
import { startWorkers, stopWorkers } from './workers/runner.js';
// ...
startWorkers();
app.addHook('onClose', async () => { await stopWorkers(); });
```

- [x] **Step 3: Verify the API still boots**

```bash
pnpm --filter @expyrico/api typecheck
```

- [x] **Step 4: Commit**

```bash
git add api/src/workers/runner.ts api/src/server.ts
git commit -m "feat(api): wire BullMQ workers into server boot"
```

---

## Phase J — Mobile: dependencies + WatermelonDB

(Mobile track — deferred; see Execution order header.)

### Task J1: Install mobile deps

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install at the mobile workspace**

```bash
pnpm --filter @expyrico/mobile add \
  @nozbe/watermelondb \
  @nozbe/with-observables \
  expo-camera \
  expo-notifications \
  expo-device \
  expo-constants \
  @react-native-ml-kit/text-recognition \
  @react-native-community/netinfo \
  uuid
pnpm --filter @expyrico/mobile add -D @types/uuid
```
Expected: all packages installed; no peer-dep errors. WatermelonDB requires a Babel plugin step.

- [ ] **Step 2: Add the WatermelonDB decorator Babel plugin**

Edit `apps/mobile/babel.config.js` (created in M0c) and add `@babel/plugin-proposal-decorators` (legacy mode) to its `plugins` array:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  };
};
```

Install the plugin:
```bash
pnpm --filter @expyrico/mobile add -D @babel/plugin-proposal-decorators
```

- [ ] **Step 3: Verify mobile typecheck still passes**

```bash
pnpm --filter @expyrico/mobile typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/babel.config.js pnpm-lock.yaml
git commit -m "chore(mobile): add scan/OCR/notifications/Watermelon deps"
```

---

### Task J2: WatermelonDB schema + models

**Files:**
- Create: `apps/mobile/src/db/schema.ts`
- Create: `apps/mobile/src/db/migrations.ts`
- Create: `apps/mobile/src/db/models/Record.ts`
- Create: `apps/mobile/src/db/models/ProductCache.ts`
- Create: `apps/mobile/src/db/index.ts`

- [ ] **Step 1: Write `apps/mobile/src/db/schema.ts`**

```ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'records',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'client_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'custom_name', type: 'string', isOptional: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'expiry_date', type: 'string' },          // ISO yyyy-mm-dd
        { name: 'purchase_date', type: 'string', isOptional: true },
        { name: 'quantity', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'price', type: 'number', isOptional: true },
        { name: 'store', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'notify_at_json', type: 'string' },       // JSON array of ISO ts
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'consumed_at', type: 'number', isOptional: true },
        { name: 'pending_sync', type: 'boolean', isIndexed: true },
        { name: 'pending_delete', type: 'boolean', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'products_cache',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'brand', type: 'string', isOptional: true },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'default_shelf_life_days', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
```

- [ ] **Step 2: Write `apps/mobile/src/db/migrations.ts`**

```ts
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [],
});
```

- [ ] **Step 3: Write `apps/mobile/src/db/models/Record.ts`**

```ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class RecordModel extends Model {
  static table = 'records';

  @field('server_id') serverId!: string | null;
  @field('client_id') clientId!: string;
  @field('product_id') productId!: string | null;
  @field('custom_name') customName!: string | null;
  @field('category') category!: string | null;
  @field('expiry_date') expiryDate!: string;
  @field('purchase_date') purchaseDate!: string | null;
  @field('quantity') quantity!: number;
  @field('unit') unit!: string;
  @field('price') price!: number | null;
  @field('store') store!: string | null;
  @field('notes') notes!: string | null;
  @field('photo_url') photoUrl!: string | null;
  @field('status') status!: string;
  @field('notify_at_json') notifyAtJson!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('consumed_at') consumedAt!: Date | null;
  @field('pending_sync') pendingSync!: boolean;
  @field('pending_delete') pendingDelete!: boolean;
}
```

- [ ] **Step 4: Write `apps/mobile/src/db/models/ProductCache.ts`**

```ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class ProductCacheModel extends Model {
  static table = 'products_cache';

  @field('server_id') serverId!: string;
  @field('barcode') barcode!: string | null;
  @field('name') name!: string;
  @field('brand') brand!: string | null;
  @field('image_url') imageUrl!: string | null;
  @field('default_shelf_life_days') defaultShelfLifeDays!: number | null;
  @readonly @date('updated_at') updatedAt!: Date;
}
```

- [ ] **Step 5: Write `apps/mobile/src/db/index.ts`**

```ts
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema.js';
import { migrations } from './migrations.js';
import { RecordModel } from './models/Record.js';
import { ProductCacheModel } from './models/ProductCache.js';

const adapter = new SQLiteAdapter({
  schema: mySchema,
  migrations,
  jsi: true,
  dbName: 'pantry',
  onSetUpError: (err) => {
    // eslint-disable-next-line no-console
    console.error('watermelon setup error', err);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [RecordModel, ProductCacheModel],
});

export { RecordModel, ProductCacheModel };
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @expyrico/mobile typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/db
git commit -m "feat(mobile): WatermelonDB schema + models for records + products cache"
```

---

## Phase K — Mobile: sync engine

### Task K1: Sync engine (push + pull)

**Files:**
- Create: `apps/mobile/src/db/sync.ts`

- [ ] **Step 1: Write `apps/mobile/src/db/sync.ts`**

```ts
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database, RecordModel } from './index.js';
import { apiClient } from '../api/client.js';
import type { RecordSyncResponse, RecordSyncBatch } from '@expyrico/shared';

const LAST_SYNC_KEY = 'pantry.lastSyncAt';

let syncing = false;

export async function runSync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    await pushPending();
    await pullSince();
  } finally {
    syncing = false;
  }
}

async function pushPending(): Promise<void> {
  const recordsCol = database.get<RecordModel>('records');
  const dirty = await recordsCol.query(Q.where('pending_sync', true)).fetch();
  const deletes = await recordsCol.query(Q.where('pending_delete', true)).fetch();

  for (const rec of dirty) {
    const clientId = rec.clientId || uuidv4();
    if (!rec.serverId) {
      // CREATE — POST /v1/records
      const res = await apiClient.post<{ id: string }>('/records', {
        clientId,
        productId: rec.productId,
        customName: rec.customName,
        expiryDate: rec.expiryDate,
        purchaseDate: rec.purchaseDate,
        quantity: rec.quantity,
        unit: rec.unit,
        notes: rec.notes,
        photoUrl: rec.photoUrl,
      }, { headers: { 'Idempotency-Key': clientId } });
      const remoteId = res.id;
      await database.write(async () => {
        await rec.update((r) => {
          r.serverId = remoteId;
          r.clientId = clientId;
          r.pendingSync = false;
        });
      });
    } else {
      // UPDATE — PATCH /v1/records/:id
      await apiClient.patch(`/records/${rec.serverId}`, {
        customName: rec.customName,
        expiryDate: rec.expiryDate,
        purchaseDate: rec.purchaseDate,
        quantity: rec.quantity,
        unit: rec.unit,
        notes: rec.notes,
        photoUrl: rec.photoUrl,
        status: rec.status,
      });
      await database.write(async () => {
        await rec.update((r) => { r.pendingSync = false; });
      });
    }
  }

  for (const rec of deletes) {
    if (rec.serverId) {
      await apiClient.delete(`/records/${rec.serverId}`);
    }
    await database.write(async () => { await rec.destroyPermanently(); });
  }
}

async function pullSince(): Promise<void> {
  const since = await loadLastSync();
  const body: RecordSyncBatch = {
    since: since ? since.toISOString() : null,
    upserts: [],
    deletes: [],
  };
  const res = await apiClient.post<RecordSyncResponse>('/records/sync', body);
  const { changes, deletedIds, serverTime } = res;
  const recordsCol = database.get<RecordModel>('records');

  await database.write(async () => {
    for (const ch of changes) {
      const existing = await recordsCol.query(Q.where('server_id', ch.id)).fetch();
      const hit = existing[0];
      if (hit) {
        await hit.update((r) => {
          r.clientId = ch.clientId;
          r.productId = ch.productId;
          r.customName = ch.customName;
          r.expiryDate = ch.expiryDate;
          r.purchaseDate = ch.purchaseDate;
          r.quantity = ch.quantity;
          r.unit = ch.unit;
          r.notes = ch.notes;
          r.photoUrl = ch.photoUrl;
          r.status = ch.status;
          r.notifyAtJson = JSON.stringify(ch.notifyAt);
          r.pendingSync = false;
          r.pendingDelete = false;
        });
      } else {
        await recordsCol.create((r) => {
          r.serverId = ch.id;
          r.clientId = ch.clientId;
          r.productId = ch.productId;
          r.customName = ch.customName;
          r.expiryDate = ch.expiryDate;
          r.purchaseDate = ch.purchaseDate;
          r.quantity = ch.quantity;
          r.unit = ch.unit;
          r.notes = ch.notes;
          r.photoUrl = ch.photoUrl;
          r.status = ch.status;
          r.notifyAtJson = JSON.stringify(ch.notifyAt);
          r.pendingSync = false;
          r.pendingDelete = false;
        });
      }
    }
    for (const id of deletedIds) {
      const existing = await recordsCol.query(Q.where('server_id', id)).fetch();
      for (const e of existing) await e.destroyPermanently();
    }
  });

  await saveLastSync(new Date(serverTime));
}

async function loadLastSync(): Promise<Date | null> {
  // Secure storage from M0c
  const { getItem } = await import('../auth/secureStorage.js');
  const raw = await getItem(LAST_SYNC_KEY);
  return raw ? new Date(raw) : null;
}

async function saveLastSync(d: Date): Promise<void> {
  const { setItem } = await import('../auth/secureStorage.js');
  await setItem(LAST_SYNC_KEY, d.toISOString());
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/db/sync.ts
git commit -m "feat(mobile): WatermelonDB sync engine (push + pull, LWW server-side)"
```

---

### Task K2: Sync triggers (AppState + NetInfo + interval)

**Files:**
- Create: `apps/mobile/src/db/triggers.ts`

- [ ] **Step 1: Write `apps/mobile/src/db/triggers.ts`**

```ts
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { runSync } from './sync.js';

const FIVE_MIN_MS = 5 * 60 * 1000;

let started = false;
let interval: ReturnType<typeof setInterval> | null = null;
let lastNetState = true;

export function startSyncTriggers(): void {
  if (started) return;
  started = true;

  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') void runSync();
  });

  NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (isOnline && !lastNetState) void runSync();
    lastNetState = isOnline;
  });

  interval = setInterval(() => {
    if (AppState.currentState === 'active') void runSync();
  }, FIVE_MIN_MS);

  // Initial sync on startup
  void runSync();
}

export function stopSyncTriggers(): void {
  if (interval) clearInterval(interval);
  interval = null;
  started = false;
}

/**
 * Call after every local write to schedule a quick sync.
 */
export function triggerSyncSoon(): void {
  void runSync();
}
```

- [ ] **Step 2: Mount triggers in the app root**

Edit `apps/mobile/app/_layout.tsx` (created in M0c). Inside the root effect, after the existing auth/theme setup, add:
```ts
import { startSyncTriggers } from '../src/db/triggers.js';
// inside the root useEffect:
startSyncTriggers();
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/triggers.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): sync triggers (foreground, reconnect, 5min interval)"
```

---

## Phase L — Mobile: TanStack Query hooks + groupRecords helper

### Task L1: Product API hooks

**Files:**
- Create: `apps/mobile/src/api/products.ts`

- [ ] **Step 1: Write `apps/mobile/src/api/products.ts`**

```ts
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  Product,
  ProductLookupResponse,
  ProductSearchResult,
  ProductWithReviews,
} from '@expyrico/shared';
import { apiClient } from './client.js';

export function useProductLookup() {
  return useMutation({
    mutationFn: async (input: { barcode?: string; qr?: string }) => {
      const data = await apiClient.post<ProductLookupResponse>(
        '/products/lookup',
        input,
      );
      return data.product;
    },
  });
}

export function useProductSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['products', 'search', q],
    enabled: enabled && q.length > 0,
    queryFn: async () => {
      const data = await apiClient.get<ProductSearchResult>(
        `/products/search?q=${encodeURIComponent(q)}`,
      );
      return data.items;
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['products', id],
    enabled: Boolean(id),
    queryFn: async () => {
      return await apiClient.get<ProductWithReviews>(`/products/${id}`);
    },
  });
}

export function useCreateProduct() {
  return useMutation({
    mutationFn: async (input: {
      barcode?: string | null;
      qrPayload?: string | null;
      name: string;
      brand?: string | null;
      defaultShelfLifeDays?: number | null;
    }) => {
      return await apiClient.post<Product>('/products', input);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/api/products.ts
git commit -m "feat(mobile): TanStack Query hooks for products"
```

---

### Task L2: Records local-DB hooks

**Files:**
- Create: `apps/mobile/src/api/records.ts`

- [ ] **Step 1: Write `apps/mobile/src/api/records.ts`**

```ts
import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { v4 as uuidv4 } from 'uuid';
import { database, RecordModel } from '../db/index.js';
import { triggerSyncSoon } from '../db/triggers.js';

export interface LocalRecord {
  id: string;          // watermelon id
  serverId: string | null;
  clientId: string;
  productId: string | null;
  customName: string | null;
  expiryDate: string;
  quantity: number;
  unit: string;
  notes: string | null;
  photoUrl: string | null;
  status: string;
  notifyAt: string[];
}

function toLocal(r: RecordModel): LocalRecord {
  let notifyAt: string[] = [];
  try { notifyAt = JSON.parse(r.notifyAtJson) as string[]; } catch { notifyAt = []; }
  return {
    id: r.id,
    serverId: r.serverId,
    clientId: r.clientId,
    productId: r.productId,
    customName: r.customName,
    expiryDate: r.expiryDate,
    quantity: r.quantity,
    unit: r.unit,
    notes: r.notes,
    photoUrl: r.photoUrl,
    status: r.status,
    notifyAt,
  };
}

export function useActiveRecords(): LocalRecord[] {
  const [rows, setRows] = useState<LocalRecord[]>([]);
  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const sub = col
      .query(Q.where('status', 'active'), Q.where('pending_delete', false))
      .observe()
      .subscribe((res) => setRows(res.map(toLocal)));
    return () => sub.unsubscribe();
  }, []);
  return rows;
}

export function useRecord(id: string | undefined): LocalRecord | null {
  const [row, setRow] = useState<LocalRecord | null>(null);
  useEffect(() => {
    if (!id) { setRow(null); return; }
    const col = database.get<RecordModel>('records');
    const sub = col.findAndObserve(id).subscribe(
      (r) => setRow(toLocal(r)),
      () => setRow(null),
    );
    return () => sub.unsubscribe();
  }, [id]);
  return row;
}

export async function createLocalRecord(input: {
  productId?: string | null;
  customName?: string | null;
  expiryDate: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  photoUrl?: string | null;
}): Promise<string> {
  const clientId = uuidv4();
  const col = database.get<RecordModel>('records');
  let newId = '';
  await database.write(async () => {
    const created = await col.create((r) => {
      r.serverId = null;
      r.clientId = clientId;
      r.productId = input.productId ?? null;
      r.customName = input.customName ?? null;
      r.expiryDate = input.expiryDate;
      r.purchaseDate = null;
      r.quantity = input.quantity;
      r.unit = input.unit;
      r.notes = input.notes ?? null;
      r.photoUrl = input.photoUrl ?? null;
      r.status = 'active';
      r.notifyAtJson = '[]';
      r.consumedAt = null;
      r.pendingSync = true;
      r.pendingDelete = false;
    });
    newId = created.id;
  });
  triggerSyncSoon();
  return newId;
}

export async function patchLocalRecord(
  id: string,
  patch: Partial<Pick<LocalRecord, 'customName' | 'expiryDate' | 'quantity' | 'unit' | 'notes' | 'status'>>,
): Promise<void> {
  const col = database.get<RecordModel>('records');
  await database.write(async () => {
    const rec = await col.find(id);
    await rec.update((r) => {
      if (patch.customName !== undefined) r.customName = patch.customName;
      if (patch.expiryDate !== undefined) r.expiryDate = patch.expiryDate;
      if (patch.quantity !== undefined) r.quantity = patch.quantity;
      if (patch.unit !== undefined) r.unit = patch.unit;
      if (patch.notes !== undefined) r.notes = patch.notes;
      if (patch.status !== undefined) r.status = patch.status;
      r.pendingSync = true;
    });
  });
  triggerSyncSoon();
}

export async function deleteLocalRecord(id: string): Promise<void> {
  const col = database.get<RecordModel>('records');
  await database.write(async () => {
    const rec = await col.find(id);
    await rec.update((r) => { r.pendingDelete = true; });
  });
  triggerSyncSoon();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/api/records.ts
git commit -m "feat(mobile): WatermelonDB-backed record hooks"
```

---

### Task L3: `groupRecords` helper

**Files:**
- Create: `apps/mobile/src/features/records/groupRecords.ts`
- Create: `apps/mobile/src/tests/groupRecords.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/tests/groupRecords.test.ts
import { describe, expect, it } from 'vitest';
import { groupRecords } from '../features/records/groupRecords.js';

const r = (id: string, expiryDate: string) => ({
  id, clientId: id, serverId: null, productId: null, customName: id,
  expiryDate, quantity: 1, unit: 'pcs', notes: null, photoUrl: null,
  status: 'active', notifyAt: [],
});

describe('groupRecords', () => {
  it('groups into expired, today, this week, later', () => {
    const today = new Date('2026-05-24T12:00:00Z');
    const groups = groupRecords(
      [
        r('a', '2026-05-20'), // expired
        r('b', '2026-05-24'), // today
        r('c', '2026-05-28'), // this week
        r('d', '2026-06-30'), // later
      ],
      today,
    );
    expect(groups.expired.map((x) => x.id)).toEqual(['a']);
    expect(groups.today.map((x) => x.id)).toEqual(['b']);
    expect(groups.thisWeek.map((x) => x.id)).toEqual(['c']);
    expect(groups.later.map((x) => x.id)).toEqual(['d']);
  });

  it('sorts within each group by expiry ascending', () => {
    const today = new Date('2026-05-24T12:00:00Z');
    const groups = groupRecords(
      [
        r('b', '2026-06-30'),
        r('a', '2026-05-30'),
      ],
      today,
    );
    expect(groups.thisWeek.length + groups.later.length).toBe(2);
    expect(groups.thisWeek[0]?.id).toBe('a');
    expect(groups.later[0]?.id).toBe('b');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/groupRecords.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/features/records/groupRecords.ts`**

```ts
import type { LocalRecord } from '../../api/records.js';

export interface GroupedRecords {
  expired: LocalRecord[];
  today: LocalRecord[];
  thisWeek: LocalRecord[];
  later: LocalRecord[];
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function groupRecords(rows: LocalRecord[], now: Date = new Date()): GroupedRecords {
  const today = startOfDayUtc(now);
  const oneDay = 24 * 60 * 60 * 1000;
  const weekEnd = new Date(today.getTime() + 7 * oneDay);

  const groups: GroupedRecords = { expired: [], today: [], thisWeek: [], later: [] };

  for (const r of rows) {
    const exp = startOfDayUtc(new Date(`${r.expiryDate}T00:00:00Z`));
    if (exp.getTime() < today.getTime()) groups.expired.push(r);
    else if (exp.getTime() === today.getTime()) groups.today.push(r);
    else if (exp.getTime() <= weekEnd.getTime()) groups.thisWeek.push(r);
    else groups.later.push(r);
  }

  const byExp = (a: LocalRecord, b: LocalRecord) => a.expiryDate.localeCompare(b.expiryDate);
  groups.expired.sort(byExp);
  groups.today.sort(byExp);
  groups.thisWeek.sort(byExp);
  groups.later.sort(byExp);
  return groups;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/groupRecords.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/records/groupRecords.ts apps/mobile/src/tests/groupRecords.test.ts
git commit -m "feat(mobile): groupRecords (expired / today / week / later)"
```

---

### Task L4: `expiryStatus` helper (green / amber / red)

**Files:**
- Create: `apps/mobile/src/features/records/expiryStatus.ts`
- Create: `apps/mobile/src/tests/expiryStatus.test.ts`

A small pure helper that maps a record's expiry date to a traffic-light status, consumed by `RecordCard`, the dashboard summary header, and the record detail screen. The amber band is the user's configurable "expiring soon" threshold (`expiring_soon_threshold_days`, default 7 — spec §2.16). Thresholds (canonical):

- **red** — expired or expires today (`expiryDate <= today`)
- **amber** — expires within the threshold (1…thresholdDays days out; default 7)
- **green** — beyond the threshold

- [ ] **Step 1: Write the failing test `apps/mobile/src/tests/expiryStatus.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { expiryStatus } from '../features/records/expiryStatus.js';

const now = new Date('2026-05-24T12:00:00Z');

describe('expiryStatus (default threshold 7)', () => {
  it('red when already expired', () => {
    expect(expiryStatus('2026-05-20', now)).toBe('red');
  });
  it('red when expires today', () => {
    expect(expiryStatus('2026-05-24', now)).toBe('red');
  });
  it('amber when 1 day out', () => {
    expect(expiryStatus('2026-05-25', now)).toBe('amber');
  });
  it('amber when exactly 7 days out', () => {
    expect(expiryStatus('2026-05-31', now)).toBe('amber');
  });
  it('green when 8 days out', () => {
    expect(expiryStatus('2026-06-01', now)).toBe('green');
  });
  it('honors a custom threshold of 3', () => {
    expect(expiryStatus('2026-05-27', now, 3)).toBe('amber');
    expect(expiryStatus('2026-05-28', now, 3)).toBe('green');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/expiryStatus.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/features/records/expiryStatus.ts`**

```ts
export type ExpiryStatus = 'green' | 'amber' | 'red';

export const DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS = 7;

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Map an ISO date-only expiry (YYYY-MM-DD) to a traffic-light status.
 * - red:   expired or expires today (expiry <= today)
 * - amber: expires within the "expiring soon" threshold (1…thresholdDays out)
 * - green: beyond the threshold
 * thresholdDays comes from the user's expiring_soon_threshold_days (default 7).
 */
export function expiryStatus(
  expiryDate: string,
  now: Date = new Date(),
  thresholdDays: number = DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
): ExpiryStatus {
  const today = startOfDayUtc(now);
  const exp = startOfDayUtc(new Date(`${expiryDate}T00:00:00Z`));
  const days = Math.round((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'red';
  if (days <= thresholdDays) return 'amber';
  return 'green';
}

/** Maps a status to the matching theme color token name. */
export const EXPIRY_STATUS_TOKEN: Record<ExpiryStatus, 'success' | 'warning' | 'danger'> = {
  green: 'success',
  amber: 'warning',
  red: 'danger',
};
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/expiryStatus.test.ts
```
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/records/expiryStatus.ts apps/mobile/src/tests/expiryStatus.test.ts
git commit -m "feat(mobile): expiryStatus helper (green/amber/red)"
```

---

## Phase M — Mobile: OCR + scan

### Task M1: `parseExpiryString` helper with 15+ format tests

**Files:**
- Create: `apps/mobile/src/features/expiry/parseExpiryString.ts`
- Create: `apps/mobile/src/tests/parseExpiryString.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/tests/parseExpiryString.test.ts
import { describe, expect, it } from 'vitest';
import { parseExpiryString } from '../features/expiry/parseExpiryString.js';

const cases: Array<[string, string]> = [
  ['31/12/2026', '2026-12-31'],
  ['31-12-2026', '2026-12-31'],
  ['31.12.2026', '2026-12-31'],
  ['12/2026', '2026-12-31'],
  ['12-2026', '2026-12-31'],
  ['EXP 31 DEC 2026', '2026-12-31'],
  ['Best before 31 Dec 2026', '2026-12-31'],
  ['BB 31/12/26', '2026-12-31'],
  ['2026-12-31', '2026-12-31'],
  ['2026/12/31', '2026-12-31'],
  ['31 December 2026', '2026-12-31'],
  ['Exp: 12/26', '2026-12-31'],
  ['use by 01 Jan 2027', '2027-01-01'],
  ['MFG 01/01/26 EXP 01/01/27', '2027-01-01'], // picks the later (EXP/use-by) date
  ['best-before 15.06.2026', '2026-06-15'],
  ['  31 / 12 / 2026  ', '2026-12-31'],
];

describe('parseExpiryString', () => {
  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} → ${expected}`, () => {
      expect(parseExpiryString(input)).toBe(expected);
    });
  }

  it('returns null for unparseable text', () => {
    expect(parseExpiryString('hello world')).toBeNull();
    expect(parseExpiryString('')).toBeNull();
    expect(parseExpiryString('99/99/9999')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/parseExpiryString.test.ts
```

- [ ] **Step 3: Write `apps/mobile/src/features/expiry/parseExpiryString.ts`**

```ts
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12,
};

function normYear(y: number): number {
  if (y < 100) return y < 50 ? 2000 + y : 1900 + y;
  return y;
}

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < 1 || d > dim) return null;
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

interface Match { iso: string; isExpiryMarker: boolean }

function pushIfValid(out: Match[], iso: string | null, isExpiryMarker: boolean): void {
  if (iso) out.push({ iso, isExpiryMarker });
}

export function parseExpiryString(input: string): string | null {
  if (!input) return null;
  // Normalize spaces around separators
  const text = ' ' + input.toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  const matches: Match[] = [];

  const expiryHints = /(exp|expir|best before|best-before|bb|use by)/;

  // 1. dd[sep]mm[sep]yyyy (or yy)
  for (const m of text.matchAll(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = normYear(Number(m[3]));
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, d), expiryHints.test(ctx));
  }

  // 2. yyyy[sep]mm[sep]dd
  for (const m of text.matchAll(/(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/g)) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, d), expiryHints.test(ctx));
  }

  // 3. dd <MonthName> yyyy
  for (const m of text.matchAll(/(\d{1,2})\s+([a-z]{3,9})\s+(\d{2,4})/g)) {
    const mo = MONTHS[m[2]!];
    if (!mo) continue;
    const d = Number(m[1]);
    const y = normYear(Number(m[3]));
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, d), expiryHints.test(ctx));
  }

  // 4. mm[sep]yyyy (month/year, last day of month)
  for (const m of text.matchAll(/(?:^|[^\d])(\d{1,2})\s*[\/\-.]\s*(\d{4})(?:[^\d]|$)/g)) {
    const mo = Number(m[1]);
    const y = Number(m[2]);
    if (mo < 1 || mo > 12) continue;
    const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, lastDay), expiryHints.test(ctx));
  }

  // 5. mm/yy (month/year, last day of month)
  for (const m of text.matchAll(/(?:^|[^\d])(\d{1,2})\s*[\/\-.]\s*(\d{2})(?:[^\d]|$)/g)) {
    const mo = Number(m[1]);
    const y = normYear(Number(m[2]));
    if (mo < 1 || mo > 12) continue;
    const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const ctx = text.slice(Math.max(0, m.index! - 20), m.index!);
    pushIfValid(matches, toIso(y, mo, lastDay), expiryHints.test(ctx));
  }

  if (matches.length === 0) return null;

  // Prefer matches near an expiry hint; among them, prefer the latest date.
  const marked = matches.filter((m) => m.isExpiryMarker);
  const pool = marked.length > 0 ? marked : matches;
  pool.sort((a, b) => b.iso.localeCompare(a.iso));
  return pool[0]!.iso;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/parseExpiryString.test.ts
```
Expected: all 19 tests pass (16 format cases + 3 negatives).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/expiry/parseExpiryString.ts apps/mobile/src/tests/parseExpiryString.test.ts
git commit -m "feat(mobile): parseExpiryString covers 15+ date formats"
```

---

### Task M2: Scan permission gate + soft pre-prompt

**Files:**
- Create: `apps/mobile/src/features/scan/usePermission.ts`
- Create: `apps/mobile/src/features/scan/PrePromptModal.tsx`

- [ ] **Step 1: Write `apps/mobile/src/features/scan/usePermission.ts`**

```ts
import { useCallback, useState } from 'react';
import { getCameraPermissionsAsync, requestCameraPermissionsAsync } from 'expo-camera';

export type PermissionState = 'unknown' | 'granted' | 'denied';

export function useCameraPermission() {
  const [state, setState] = useState<PermissionState>('unknown');

  const request = useCallback(async (): Promise<PermissionState> => {
    const { status } = await requestCameraPermissionsAsync();
    const next: PermissionState = status === 'granted' ? 'granted' : 'denied';
    setState(next);
    return next;
  }, []);

  const check = useCallback(async (): Promise<PermissionState> => {
    const { status } = await getCameraPermissionsAsync();
    const next: PermissionState = status === 'granted' ? 'granted' : 'denied';
    setState(next);
    return next;
  }, []);

  return { state, request, check };
}
```

- [ ] **Step 2: Write `apps/mobile/src/features/scan/PrePromptModal.tsx`**

```tsx
import { Modal, View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/useTheme.js';

interface Props {
  visible: boolean;
  onAllow: () => void;
  onCancel: () => void;
}

export function PrePromptModal({ visible, onAllow, onCancel }: Props) {
  const theme = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{ backgroundColor: theme.colors.bgElevated, padding: theme.spacing.xl, borderRadius: theme.radii.lg }}>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: theme.spacing.md }}>
            Camera access
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            Expyrico needs your camera to scan barcodes and QR codes on your items. We don't store images.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md }}>
            <Pressable onPress={onCancel} testID="pre-prompt-cancel">
              <Text style={{ color: theme.colors.textMuted }}>Not now</Text>
            </Pressable>
            <Pressable onPress={onAllow} testID="pre-prompt-allow">
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/scan
git commit -m "feat(mobile): camera permission hook + pre-prompt modal"
```

---

### Task M3: `ScanCamera` (combined barcode + QR)

**Files:**
- Create: `apps/mobile/src/features/scan/ScanCamera.tsx`
- Create: `apps/mobile/src/tests/ScanCamera.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/tests/ScanCamera.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react-native';
import { ScanCamera } from '../features/scan/ScanCamera.js';

vi.mock('expo-camera', () => ({
  CameraView: ({ children, onBarcodeScanned }: any) => {
    (globalThis as any).__triggerScan = onBarcodeScanned;
    return <>{children}</>;
  },
}));

describe('ScanCamera', () => {
  it('invokes onScan with barcode + type', () => {
    const onScan = vi.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__triggerScan?.({ type: 'ean13', data: '5449000000996' });
    expect(onScan).toHaveBeenCalledWith({ kind: 'barcode', value: '5449000000996' });
  });

  it('invokes onScan with qr kind', () => {
    const onScan = vi.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__triggerScan?.({ type: 'qr', data: 'https://x.example' });
    expect(onScan).toHaveBeenCalledWith({ kind: 'qr', value: 'https://x.example' });
  });

  it('debounces duplicate scans', () => {
    const onScan = vi.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__triggerScan?.({ type: 'qr', data: 'x' });
    (globalThis as any).__triggerScan?.({ type: 'qr', data: 'x' });
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/ScanCamera.test.tsx
```

- [ ] **Step 3: Write `apps/mobile/src/features/scan/ScanCamera.tsx`**

```tsx
import { useRef } from 'react';
import { CameraView } from 'expo-camera';

export interface ScanResult {
  kind: 'barcode' | 'qr';
  value: string;
}

interface Props {
  onScan: (r: ScanResult) => void;
}

// expo-camera's built-in scanner handles all of these in one CameraView.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] as const;

export function ScanCamera({ onScan }: Props) {
  const lastValue = useRef<string | null>(null);

  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES as unknown as string[] }}
      onBarcodeScanned={({ type, data }: { type: string; data: string }) => {
        if (lastValue.current === data) return;
        lastValue.current = data;
        setTimeout(() => { lastValue.current = null; }, 2000);
        const kind = type === 'qr' ? 'qr' : 'barcode';
        onScan({ kind, value: data });
      }}
    />
  );
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/ScanCamera.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/scan/ScanCamera.tsx apps/mobile/src/tests/ScanCamera.test.tsx
git commit -m "feat(mobile): combined barcode+QR scanner camera component"
```

---

### Task M4: OCR camera component

**Files:**
- Create: `apps/mobile/src/features/expiry/OcrCamera.tsx`

- [ ] **Step 1: Write `apps/mobile/src/features/expiry/OcrCamera.tsx`**

```tsx
import { useRef, useState } from 'react';
import { CameraView } from 'expo-camera';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parseExpiryString } from './parseExpiryString.js';
import { useTheme } from '../../theme/useTheme.js';

interface Props {
  onParsed: (isoDate: string) => void;
  onCancel: () => void;
}

export function OcrCamera({ onParsed, onCancel }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setError(null);
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      const ocr = await TextRecognition.recognize(photo.uri);
      const iso = parseExpiryString(ocr.text);
      if (iso) onParsed(iso);
      else setError('Could not read a date. Try again or enter manually.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
        <Pressable
          onPress={capture}
          testID="ocr-capture"
          style={{
            backgroundColor: theme.colors.primary,
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            alignItems: 'center',
          }}
        >
          {busy ? <ActivityIndicator color={theme.colors.primaryFg} /> :
            <Text style={{ color: theme.colors.primaryFg, fontWeight: '700' }}>Scan date</Text>}
        </Pressable>
        <Pressable onPress={onCancel} testID="ocr-cancel">
          <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/features/expiry/OcrCamera.tsx
git commit -m "feat(mobile): on-device OCR camera component"
```

---

## Phase N — Mobile: record UI components

### Task N1: `AddRecordForm`

**Files:**
- Create: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Create: `apps/mobile/src/tests/AddRecordForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/tests/AddRecordForm.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AddRecordForm } from '../features/records/AddRecordForm.js';

vi.mock('../api/records.js', () => ({
  createLocalRecord: vi.fn().mockResolvedValue('local-id-1'),
}));

vi.mock('../theme/useTheme.js', () => ({
  useTheme: () => ({
    colors: { bg: '#000', text: '#fff', textMuted: '#999', primary: '#a855f7', primaryFg: '#fff', danger: '#f00', border: '#333' },
    spacing: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24 },
    radii: { md: 8, lg: 12 },
  }),
}));

describe('AddRecordForm', () => {
  it('shows a validation error when expiry is empty', async () => {
    const { getByTestId, findByText } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={vi.fn()} />,
    );
    fireEvent.press(getByTestId('add-record-save'));
    expect(await findByText(/expiry/i)).toBeTruthy();
  });

  it('calls createLocalRecord with productId + expiry and invokes onSaved', async () => {
    const onSaved = vi.fn();
    const { getByTestId } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={onSaved} />,
    );
    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2099-12-31');
    fireEvent.changeText(getByTestId('add-record-quantity'), '3');
    fireEvent.press(getByTestId('add-record-save'));
    const { createLocalRecord } = await import('../api/records.js');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'p-1', expiryDate: '2099-12-31', quantity: 3, unit: 'pcs',
    }));
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/AddRecordForm.test.tsx
```

- [ ] **Step 3: Write `apps/mobile/src/features/records/AddRecordForm.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { createLocalRecord } from '../../api/records.js';
import { useTheme } from '../../theme/useTheme.js';

interface Props {
  productId?: string | null;
  productName?: string | null;
  customName?: string | null;
  onSaved: (localId: string) => void;
  onOpenOcr?: () => void;
}

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export function AddRecordForm({ productId, productName, customName, onSaved, onOpenOcr }: Props) {
  const theme = useTheme();
  const [expiry, setExpiry] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [showMore, setShowMore] = useState(false); // price/store accordion (spec §2.2)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!isoRe.test(expiry)) {
      setError('Expiry date is required (YYYY-MM-DD)');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Quantity must be a non-negative number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const localId = await createLocalRecord({
        productId: productId ?? null,
        customName: productId ? null : (customName ?? productName ?? 'Item'),
        category: category || null,
        expiryDate: expiry,
        quantity: qty,
        unit,
        price: price ? Number(price) : null,
        store: store || null,
        notes: notes || null,
      });
      onSaved(localId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  } as const;

  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {productName ? (
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>
          {productName}
        </Text>
      ) : null}
      <Text style={{ color: theme.colors.textMuted }}>Expiry date</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <TextInput
          testID="add-record-expiry-input"
          style={[input, { flex: 1 }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textMuted}
          value={expiry}
          onChangeText={setExpiry}
          autoCapitalize="none"
        />
        {onOpenOcr ? (
          <Pressable
            testID="add-record-ocr"
            onPress={onOpenOcr}
            style={{ paddingHorizontal: theme.spacing.lg, justifyContent: 'center', borderRadius: theme.radii.md, backgroundColor: theme.colors.primary }}
          >
            <Text style={{ color: theme.colors.primaryFg }}>Scan date</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={{ color: theme.colors.textMuted }}>Quantity</Text>
      <TextInput
        testID="add-record-quantity"
        style={input}
        value={quantity}
        keyboardType="numeric"
        onChangeText={setQuantity}
      />

      <Text style={{ color: theme.colors.textMuted }}>Unit</Text>
      <TextInput
        testID="add-record-unit"
        style={input}
        value={unit}
        onChangeText={setUnit}
      />

      <Text style={{ color: theme.colors.textMuted }}>Category (optional)</Text>
      <TextInput
        testID="add-record-category"
        style={input}
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Dairy"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={{ color: theme.colors.textMuted }}>Notes (optional)</Text>
      <TextInput
        testID="add-record-notes"
        style={input}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {/* Accordion: price + store are hidden by default (spec §2.2) */}
      <Pressable testID="add-record-more-toggle" onPress={() => setShowMore((v) => !v)}>
        <Text style={{ color: theme.colors.primary }}>
          {showMore ? '− Less details' : '+ More details (price, store)'}
        </Text>
      </Pressable>
      {showMore ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textMuted }}>Price (optional)</Text>
          <TextInput
            testID="add-record-price"
            style={input}
            value={price}
            keyboardType="numeric"
            onChangeText={setPrice}
          />
          <Text style={{ color: theme.colors.textMuted }}>Store (optional)</Text>
          <TextInput
            testID="add-record-store"
            style={input}
            value={store}
            onChangeText={setStore}
          />
        </View>
      ) : null}

      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}

      <Pressable
        testID="add-record-save"
        disabled={busy}
        onPress={save}
        style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.lg, borderRadius: theme.radii.md, alignItems: 'center' }}
      >
        <Text style={{ color: theme.colors.primaryFg, fontWeight: '700' }}>
          {busy ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @expyrico/mobile exec vitest run src/tests/AddRecordForm.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/records/AddRecordForm.tsx apps/mobile/src/tests/AddRecordForm.test.tsx
git commit -m "feat(mobile): AddRecordForm with validation + local-first save"
```

---

### Task N2: `RecordCard` + `RecordList`

**Files:**
- Create: `apps/mobile/src/features/records/RecordCard.tsx`
- Create: `apps/mobile/src/features/records/RecordList.tsx`

- [ ] **Step 1: Write `apps/mobile/src/features/records/RecordCard.tsx`**

```tsx
import { Pressable, Text, View } from 'react-native';
import type { LocalRecord } from '../../api/records.js';
import { useTheme } from '../../theme/useTheme.js';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from './expiryStatus.js';

interface Props {
  record: LocalRecord;
  onPress: () => void;
}

export function RecordCard({ record, onPress }: Props) {
  const theme = useTheme();
  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  return (
    <Pressable
      onPress={onPress}
      testID={`record-card-${record.id}`}
      style={{
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.bgElevated,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View
            testID={`record-expiry-status-${status}`}
            accessibilityLabel={`expiry status ${status}`}
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }}
          />
          <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 16 }}>
            {record.customName ?? 'Item'}
          </Text>
        </View>
        <Text style={{ color: theme.colors.textMuted }}>
          {record.quantity} {record.unit}
        </Text>
      </View>
      <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
        Expires {record.expiryDate}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/src/features/records/RecordList.tsx`**

```tsx
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveRecords } from '../../api/records.js';
import { groupRecords } from './groupRecords.js';
import { RecordCard } from './RecordCard.js';
import { useTheme } from '../../theme/useTheme.js';

const SECTION_TITLES: Record<keyof ReturnType<typeof groupRecords>, string> = {
  expired: 'Expired',
  today: 'Expires today',
  thisWeek: 'Expires this week',
  later: 'Later',
};

export function RecordList() {
  const records = useActiveRecords();
  const router = useRouter();
  const theme = useTheme();
  const groups = groupRecords(records);
  const sections: Array<keyof typeof SECTION_TITLES> = ['expired', 'today', 'thisWeek', 'later'];

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
      {sections.map((key) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <View key={key} style={{ marginBottom: theme.spacing.lg }}>
            <Text
              testID={`record-section-${key}`}
              style={{
                color: theme.colors.textMuted,
                textTransform: 'uppercase',
                fontSize: 12,
                marginBottom: theme.spacing.sm,
              }}
            >
              {SECTION_TITLES[key]}
            </Text>
            {items.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                onPress={() => router.push(`/record/${r.id}`)}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/records/RecordCard.tsx apps/mobile/src/features/records/RecordList.tsx
git commit -m "feat(mobile): RecordCard + grouped RecordList"
```

---

## Phase O — Mobile: screens (scan, add, home, detail, product)

### Task O1: Scan screen

**Files:**
- Create: `apps/mobile/app/(app)/scan.tsx`

- [ ] **Step 1: Write `apps/mobile/app/(app)/scan.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScanCamera, type ScanResult } from '../../src/features/scan/ScanCamera.js';
import { useCameraPermission } from '../../src/features/scan/usePermission.js';
import { PrePromptModal } from '../../src/features/scan/PrePromptModal.js';
import { useProductLookup } from '../../src/api/products.js';
import { useTheme } from '../../src/theme/useTheme.js';

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, request, check } = useCameraPermission();
  const lookup = useProductLookup();
  const [prePrompt, setPrePrompt] = useState(true);

  useEffect(() => { void check(); }, [check]);

  const handleScan = async (r: ScanResult) => {
    try {
      const product = await lookup.mutateAsync(
        r.kind === 'barcode' ? { barcode: r.value } : { qr: r.value },
      );
      if (product) router.replace(`/product/${product.id}`);
      else router.replace({ pathname: '/product/new', params: { barcode: r.kind === 'barcode' ? r.value : '', qr: r.kind === 'qr' ? r.value : '' } });
    } catch {
      // 404 = no product
      router.replace({ pathname: '/product/new', params: { barcode: r.kind === 'barcode' ? r.value : '', qr: r.kind === 'qr' ? r.value : '' } });
    }
  };

  if (state === 'unknown') {
    return (
      <PrePromptModal
        visible={prePrompt}
        onCancel={() => { setPrePrompt(false); router.back(); }}
        onAllow={async () => { setPrePrompt(false); await request(); }}
      />
    );
  }
  if (state === 'denied') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <Text style={{ color: theme.colors.text }}>Camera permission denied.</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScanCamera onScan={handleScan} />
      {lookup.isPending ? (
        <View style={{ position: 'absolute', top: 40, alignSelf: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/scan.tsx
git commit -m "feat(mobile): scan screen (permission gate + lookup + routing)"
```

---

### Task O2: Home tab — grouped record list

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`

- [ ] **Step 1: Replace the file with the grouped list + FAB**

```tsx
import { View, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { RecordList } from '../../../src/features/records/RecordList.js';
import { useTheme } from '../../../src/theme/useTheme.js';

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <RecordList />
      <Pressable
        testID="home-fab-add"
        onPress={() => router.push('/scan')}
        style={{
          position: 'absolute',
          right: theme.spacing.xl,
          bottom: theme.spacing.xxl,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radii.pill,
          width: 56,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.primaryFg, fontSize: 28, lineHeight: 28 }}>+</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(tabs\)/home.tsx
git commit -m "feat(mobile): home tab with grouped records + FAB to scan"
```

---

### Task O3: Record detail screen

**Files:**
- Create: `apps/mobile/app/(app)/record/[id].tsx`

- [ ] **Step 1: Write `apps/mobile/app/(app)/record/[id].tsx`**

```tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRecord, patchLocalRecord, deleteLocalRecord } from '../../../src/api/records.js';
import { useTheme } from '../../../src/theme/useTheme.js';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../../../src/features/records/expiryStatus.js';

export default function RecordDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useRecord(id);

  if (!record) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <Text style={{ color: theme.colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  const mark = async (status: 'consumed' | 'discarded') => {
    await patchLocalRecord(record.id, { status });
    router.back();
  };

  const remove = async () => {
    await deleteLocalRecord(record.id);
    router.back();
  };

  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.bg }}>
      <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '700' }}>
        {record.customName ?? 'Item'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          testID={`record-expiry-status-${status}`}
          accessibilityLabel={`expiry status ${status}`}
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }}
        />
        <Text style={{ color: statusColor }}>Expires {record.expiryDate}</Text>
      </View>
      <Text style={{ color: theme.colors.textMuted }}>{record.quantity} {record.unit}</Text>
      {record.notes ? (
        <Text style={{ color: theme.colors.text, marginTop: theme.spacing.md }}>{record.notes}</Text>
      ) : null}

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
        <Pressable
          testID="record-mark-consumed"
          onPress={() => mark('consumed')}
          style={{ backgroundColor: theme.colors.success, padding: theme.spacing.lg, borderRadius: theme.radii.md, alignItems: 'center' }}
        >
          <Text style={{ color: theme.colors.textInverse, fontWeight: '700' }}>Mark as consumed</Text>
        </Pressable>
        <Pressable
          testID="record-mark-discarded"
          onPress={() => mark('discarded')}
          style={{ backgroundColor: theme.colors.warning, padding: theme.spacing.lg, borderRadius: theme.radii.md, alignItems: 'center' }}
        >
          <Text style={{ color: theme.colors.textInverse, fontWeight: '700' }}>Discard</Text>
        </Pressable>
        <Pressable
          testID="record-delete"
          onPress={remove}
          style={{ borderColor: theme.colors.danger, borderWidth: 1, padding: theme.spacing.lg, borderRadius: theme.radii.md, alignItems: 'center' }}
        >
          <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/record
git commit -m "feat(mobile): record detail with consume/discard/delete actions"
```

---

### Task O4: Product detail screen (M2 stub for reviews)

**Files:**
- Create: `apps/mobile/app/(app)/product/[id].tsx`

- [ ] **Step 1: Write `apps/mobile/app/(app)/product/[id].tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProduct } from '../../../src/api/products.js';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm.js';
import { OcrCamera } from '../../../src/features/expiry/OcrCamera.js';
import { useTheme } from '../../../src/theme/useTheme.js';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken.js';

export default function ProductDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useProduct(id);
  const [showOcr, setShowOcr] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <Text style={{ color: theme.colors.textMuted }}>Loading product…</Text>
      </View>
    );
  }

  if (showOcr) {
    return (
      <OcrCamera
        onCancel={() => setShowOcr(false)}
        onParsed={(iso) => { setPrefillDate(iso); setShowOcr(false); }}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {data.imageUrl ? (
        <Image source={{ uri: data.imageUrl }} style={{ width: '100%', height: 200 }} />
      ) : null}
      <View style={{ padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '700' }}>{data.name}</Text>
        {data.brand ? (
          <Text style={{ color: theme.colors.textMuted }}>{data.brand}</Text>
        ) : null}
        {data.defaultShelfLifeDays ? (
          <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
            Default shelf life: {data.defaultShelfLifeDays} days
          </Text>
        ) : null}
        <View style={{ marginTop: theme.spacing.lg, padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: theme.colors.bgElevated }}>
          <Text style={{ color: theme.colors.textMuted }}>Reviews available in M2</Text>
        </View>
      </View>
      <AddRecordForm
        productId={data.id}
        productName={data.name}
        onOpenOcr={() => setShowOcr(true)}
        onSaved={async (localId) => {
          await ensurePushTokenRegistered();
          router.replace('/home');
        }}
      />
      {prefillDate ? (
        <Text testID="ocr-prefill-hint" style={{ color: theme.colors.textMuted, paddingHorizontal: theme.spacing.lg }}>
          Scanned date: {prefillDate} (enter above)
        </Text>
      ) : null}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/product
git commit -m "feat(mobile): product detail with add-record form + OCR + M2 reviews stub"
```

---

### Task O5: Manual product create screen (fallback when scan misses)

**Files:**
- Create: `apps/mobile/app/(app)/product/new.tsx`

The scan screen routes here when `POST /v1/products/lookup` returns 404, passing `barcode` and/or `qr` as query params.

- [ ] **Step 1: Write `apps/mobile/app/(app)/product/new.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateProduct } from '../../../src/api/products.js';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm.js';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken.js';
import { useTheme } from '../../../src/theme/useTheme.js';

export default function NewProductScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ barcode?: string; qr?: string }>();
  const createProduct = useCreateProduct();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      const product = await createProduct.mutateAsync({
        barcode: params.barcode || null,
        qrPayload: params.qr || null,
        name: name.trim(),
        brand: brand.trim() || null,
      });
      setProductId(product.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const input = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  } as const;

  if (productId) {
    return (
      <AddRecordForm
        productId={productId}
        productName={name}
        onSaved={async () => {
          await ensurePushTokenRegistered();
          router.replace('/home');
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.bg }}>
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>New product</Text>
      {params.barcode ? (
        <Text style={{ color: theme.colors.textMuted }}>Barcode: {params.barcode}</Text>
      ) : null}
      {params.qr ? (
        <Text style={{ color: theme.colors.textMuted }}>QR: {params.qr}</Text>
      ) : null}
      <Text style={{ color: theme.colors.textMuted }}>Name</Text>
      <TextInput testID="new-product-name" style={input} value={name} onChangeText={setName} />
      <Text style={{ color: theme.colors.textMuted }}>Brand (optional)</Text>
      <TextInput testID="new-product-brand" style={input} value={brand} onChangeText={setBrand} />
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Pressable
        testID="new-product-create"
        onPress={submit}
        disabled={createProduct.isPending}
        style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.lg, borderRadius: theme.radii.md, alignItems: 'center' }}
      >
        <Text style={{ color: theme.colors.primaryFg, fontWeight: '700' }}>
          {createProduct.isPending ? 'Creating…' : 'Continue'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/product/new.tsx
git commit -m "feat(mobile): manual product create screen for scan-miss flow"
```

---

## Phase P — Mobile: push token registration

### Task P1: Register Expo push token after first record save

**Files:**
- Create: `apps/mobile/src/features/push/registerPushToken.ts`
- Create: `apps/mobile/src/api/push.ts`

- [ ] **Step 1: Write `apps/mobile/src/api/push.ts`**

```ts
import { apiClient } from './client.js';
import type { PushToken, PushTokenRegister } from '@expyrico/shared';

export async function registerPushTokenApi(input: PushTokenRegister): Promise<PushToken> {
  return await apiClient.post<PushToken>('/me/push-token', input);
}
```

- [ ] **Step 2: Write `apps/mobile/src/features/push/registerPushToken.ts`**

```ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { getItem, setItem } from '../../auth/secureStorage.js';
import { registerPushTokenApi } from '../../api/push.js';

const FLAG_KEY = 'pantry.pushRegisteredV1';

export async function ensurePushTokenRegistered(): Promise<void> {
  if (!Device.isDevice) return;
  if (await getItem(FLAG_KEY)) return;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  await registerPushTokenApi({
    expoPushToken: tokenData.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceInfo: { model: Device.modelName ?? null, os: Platform.Version },
  });
  await setItem(FLAG_KEY, '1');
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/api/push.ts apps/mobile/src/features/push/registerPushToken.ts
git commit -m "feat(mobile): register Expo push token after first record save"
```

---

## Phase Q — Mobile: Maestro E2E

### Task Q1: Scan-and-save flow

**Files:**
- Create: `apps/mobile/src/tests/e2e/scan-and-save.yaml`

- [ ] **Step 1: Write the Maestro flow**

```yaml
# apps/mobile/src/tests/e2e/scan-and-save.yaml
# Prereq: a signed-in user from a previous auth flow.
appId: com.expyrico.app
---
- launchApp
- assertVisible: "Home"
- tapOn:
    id: "home-fab-add"
- assertVisible: "Camera access"
- tapOn:
    id: "pre-prompt-allow"
# Maestro injects a fake barcode via deep link when running on CI emulators.
- openLink: "expyrico://test/mock-scan?barcode=5449000000996"
- assertVisible: "Coca-Cola"
- inputText: "2099-12-31"
    selector:
      id: "add-record-expiry-input"
- tapOn:
    id: "add-record-save"
- assertVisible: "Expires 2099-12-31"
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/tests/e2e/scan-and-save.yaml
git commit -m "test(mobile): Maestro e2e for scan-and-save"
```

---

## Phase Z — Final verification

### Task Z1: Full API suite

- [ ] **Step 1: Generate Prisma client**

```bash
pnpm --filter @expyrico/api exec prisma generate
```

- [ ] **Step 2: Apply migrations against the test DB**

```bash
DATABASE_URL="$(grep DATABASE_URL api/.env.test | cut -d= -f2-)" \
  pnpm --filter @expyrico/api exec prisma migrate deploy
```

- [ ] **Step 3: Run all API tests**

```bash
pnpm --filter @expyrico/api test
```
Expected (M1 additions on top of M0a/M0b):

- `unit/notify-at.test.ts` — 5 tests
- `unit/product-mappers.test.ts` — 4 tests
- `unit/breaker.test.ts` — 2 tests
- `unit/worker-notification-schedule.test.ts` — 3 tests
- `unit/worker-notification-send.test.ts` — 3 tests
- `integration/idempotency.test.ts` — 4 tests
- `integration/products-lookup.test.ts` — 4 tests
- `integration/products-search.test.ts` — 3 tests
- `integration/products-get.test.ts` — 2 tests
- `integration/products-create.test.ts` — 3 tests
- `integration/products-patch.test.ts` — 3 tests
- `integration/records-crud.test.ts` — 4 (create) + 3 (list) + 3 (patch) + 2 (delete) = 12 tests
- `integration/records-sync.test.ts` — 4 tests
- `integration/push-token.test.ts` — 4 tests

- [ ] **Step 4: Typecheck the whole repo**

```bash
pnpm typecheck
```
Expected: every workspace exits 0.

### Task Z2: Mobile checks

- [ ] **Step 1: Vitest mobile suite**

```bash
pnpm --filter @expyrico/mobile exec vitest run
```
Expected: passes for `parseExpiryString.test.ts` (19), `groupRecords.test.ts` (2), `expiryStatus.test.ts` (6), `AddRecordForm.test.tsx` (2), `ScanCamera.test.tsx` (3).

- [ ] **Step 2: Mobile typecheck**

```bash
pnpm --filter @expyrico/mobile typecheck
```

- [ ] **Step 3: Prettier**

```bash
pnpm exec prettier --check .
```
If it fails: `pnpm exec prettier --write .` and re-check.

### Task Z3: Tag the milestone

- [ ] **Step 1: Confirm clean tree**

```bash
git status
git log --oneline -50
```

- [ ] **Step 2: Tag**

```bash
git tag m1-complete
```

---

## Self-review checklist

Run this against the spec before declaring M1 done.

- [ ] **Spec §2.2 (records)** — `records` table created; required fields (expiry + name/product) enforced via Zod `.refine` on `recordCreateSchema`; status lifecycle covered by `recordStatusSchema` + PATCH route.
- [ ] **Spec §2.3 (scanning)** — One scan flow in `ScanCamera` uses `expo-camera`'s `CameraView` built-in scanner (`onBarcodeScanned`) accepting both `qr` and EAN/UPC barcode types; `POST /products/lookup` walks cache → OFF → UPCitemdb → null (Task C6) and enqueues a `product-lookup` backfill job on miss; manual-create fallback wired in Scan screen routing.
- [ ] **Spec §2.4 (expiry capture)** — Manual date input in `AddRecordForm`; OCR via `@react-native-ml-kit/text-recognition` in `OcrCamera`; `parseExpiryString` covers 15+ formats.
- [ ] **Spec §2.5 (notifications)** — Default offsets `[7, 3, 1, 0]` (7d / 3d / 1d / day-of) in `notify-at.ts`; per-user override via `users.notificationPreferences.offsetsDays` resolved by `resolveOffsetsForUser` in record create/patch + sync; per-record `notify_at` jsonb; BullMQ schedule + send workers thread `templateKey` (NOT NULL on `push_logs`) end-to-end; Expo Push via `expo-server-sdk` with breaker.
- [ ] **Spec §2.11 (offline-first)** — All reads via WatermelonDB (`useActiveRecords`, `useRecord`); writes go to WatermelonDB then sync via `Idempotency-Key`; LWW on user data in `syncRecords`; triggers cover foreground, network reconnect, post-write, 5min interval.
- [ ] **Spec §4.3 (background jobs)** — `product-lookup`, `notification-schedule`, `notification-send` queues + workers all present, registered in `api/src/workers/runner.ts`; `product-lookup` actually enqueued on lookup miss; `getQueueConnection()` returns raw `ConnectionOptions` wrapped as `{ connection: getQueueConnection() }` at every construction site; `opossum` circuit breaker on OFF / UPCitemdb / Expo Push.
- [ ] **Spec §5 (data model)** — `products`, `product_edits`, `records`, `push_tokens`, `push_logs`, `notificationPreferences` on `User` all in Prisma; pg_trgm GIN index on `(name, brand)`.
- [ ] **Spec §6.2 (products endpoints)** — `POST /lookup`, `GET /search`, `GET /:id` (with `topReviews: []` stub), `POST /`, `PATCH /:id` (→ `product_edits` row) all implemented + tested.
- [ ] **Spec §6.3 (records endpoints)** — `GET /`, `POST /` (idempotent), `PATCH /:id`, `DELETE /:id`, `POST /sync` all implemented + tested.
- [ ] **Spec §6.6 (profile push tokens)** — `POST /me/push-token`, `DELETE /me/push-token/:id` implemented + tested; both register inside a single `meScope` sub-app mounted once at `prefix: '/v1/me'` (no duplicate `/v1/me` registration).
- [ ] **Spec §6.8 (cross-cutting)** — RFC 7807 errors reused from M0a; `Idempotency-Key` middleware (Task E1) plus required on `POST /records`; auth via `app.requireAuth` from M0a.
- [ ] **Spec §7 (mobile)** — WatermelonDB models + adapter, sync engine, scan + OCR, AddRecordForm, RecordList grouped, RecordCard (with green/amber/red expiry-status indicator from `expiryStatus`), scan screen, product detail (M2 reviews stub), record detail (with expiry-status indicator), manual-create screen (Task O5), FAB on home, push token registration after first save.

### Placeholder scan

- [ ] No "TBD", "add validation", "see task N", or "implement later" appears in the plan.
- [ ] Every TDD task has actual test code AND actual implementation code in `Step` blocks.
- [ ] Every commit step lists the exact files to add.

### Type consistency

- [ ] `productCreateRequestSchema` (D5) matches the Prisma `Product` write columns.
- [ ] `recordCreateSchema` `clientId` aligns with `records.client_id @unique` and is what the mobile sync engine sends as `Idempotency-Key`.
- [ ] `notify_at` is `string[]` in API output (Zod), `Json` in Prisma, and a JSON-encoded string column in WatermelonDB (`notify_at_json`) — conversions happen in `toApiRecord` and `pullSince`.
- [ ] `RecordStatus` enum values match across Prisma (`active|consumed|discarded|expired`), `recordStatusSchema`, the mobile model `status` field, and the home-tab grouping.
- [ ] `PushPlatform` enum matches `pushTokenRegisterSchema.platform`.
- [ ] `ProductSource` enum matches the mapper outputs (`off`, `upcitemdb`) and the manual-create source (`user`).

---

## Handoff to M2

M2 will:

1. Add `reviews` and `review_votes` tables (already specced).
2. Replace the `topReviews: []` stub in `GET /v1/products/:id` with a real top-N reviews list ordered by Wilson helpfulness score.
3. Populate `products.buy_again_count`, `buy_again_on_sale_count`, `wont_buy_count`, `rating_count`, `review_count` denormalized columns (three-option ratings) via the `rating-recalc` BullMQ worker, plus the per-country rollup (spec §5).
4. Add the Browse tab search results screen and the product detail reviews list on mobile.
5. Add `POST /reports` and the profanity-filter `moderation-flag` worker.

All M1 surfaces — records CRUD, scan flow, OCR, notifications, sync engine — should remain green throughout M2.

**Canonical contracts M2 inherits from M1** (see "Validation amendments — 2026-05-26"):

- **`getQueueConnection()` returns a raw `ConnectionOptions`** (NOT `{ connection: ... }`). M2 queues/workers construct as `new Queue(name, { connection: getQueueConnection() })` / `new Worker(name, processor, { connection: getQueueConnection() })` — matching the existing M1 sites, no double-wrap.
- **Worker registry is `api/src/workers/runner.ts`** (`startWorkers()` / `stopWorkers()`). M2's `rating-recalc` and `moderation-flag` workers go under `api/src/workers/` and register in `runner.ts`. There is no `api/src/queues/workers.ts`.
- **`NotificationSendJob.templateKey`** is required and persisted to `push_logs.templateKey`; the schedule worker sets `'expiry_reminder'` by default. M2 may add new template keys but must always set one.
- **`/v1/me` is a single `meScope` sub-app**; M2 registers any new profile routes inside it rather than adding another `/v1/me` registration.
- **Notification offsets** resolve through `resolveOffsetsForUser(user.notificationPreferences)`; reuse it wherever M2 recomputes `notify_at`. The default reminder schedule is `[7, 3, 1, 0]` (7 days before, 3 days before, 1 day before, on the expiry day).
- **Three-option product ratings.** The `products` table exposes denormalized columns `buy_again_count`, `buy_again_on_sale_count`, `wont_buy_count`, `rating_count`, `review_count` (all `int`), plus `is_community_eligible boolean`; the API serializes them in camelCase. M1 only ships the columns + field names (all default `0` / `false`); M2's `rating-recalc` worker writes them from the three-option ratings. There is no `rating_avg` / `rating_count`-as-avg, and no taste/value columns.
- **Expiry-status helper.** `apps/mobile/src/features/records/expiryStatus.ts` exports `expiryStatus(expiryDate, now, thresholdDays): 'green' | 'amber' | 'red'` (red = expired or today, amber = within the user's expiring-soon threshold (default 7), green = beyond) plus `EXPIRY_STATUS_TOKEN` mapping to theme tokens; reuse it for any M2 surface that shows expiry urgency.

---

## Mobile UI additions — 2026-06-08 revision (Track B)

The schema/API/helper contracts above are fully specced; these Track-B screen behaviors follow `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` (§2.16–§2.18) and the mockup (`2026-05-24-expyrico-mockup-design.md`, screens 7/15/16/26). Build them when the Mobile track resumes:

1. **Home dashboard header (§2.16).** Above the grouped list, render a summary count header: total + Good/Expiring-soon/Expired chips computed via `expiryStatus(record.expiryDate, now, user.expiringSoonThresholdDays)`. Add an "X of 50" item-count pill (from `GET /v1/me/usage`).
2. **Category filter (§2.16).** A chip row / filter control that narrows the list by `record.category`; passes `?category=` to `GET /v1/records`.
3. **RecordCard / detail status bar.** Left-edge accent bar colored by `EXPIRY_STATUS_TOKEN` (Sage/Honey/Red theme tokens).
4. **Record detail actions (§2.2).** Buttons: "Mark used" (`status: consumed`), "Mark thrown away" (`status: discarded`), "Duplicate" (calls `POST /v1/records/:id/duplicate`, then routes to the expiry picker for the new date), "Delete".
5. **Manual-entry auto-suggest (§2.2).** The name field on `AddRecordForm`/manual-create queries `GET /v1/products/search` (debounced) and shows OFF suggestions; selecting one links the record to that product (community-eligible), otherwise it stays a personal-notes-only manual record.
6. **Read-only / item-limit mode (§2.17).** When `GET /v1/me/usage` returns `readOnly: true`, disable the add flow (FAB shows a lock badge) and surface an upgrade-prompt CTA; existing records remain editable and reminders keep firing. A `POST /v1/records` `409 item_limit_reached` also triggers the CTA.
7. **Settings additions (§2.18).** Expiring-soon threshold control (writes `expiringSoonThresholdDays` via `PATCH /v1/me`), notification interval prefs, and a "Contact us" entry (`POST /feedback` or mailto). (Referral screen + share live in M7.)
