# M6 — Blessing / Giveaway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the free-local-pickup giveaway flow end-to-end: a giver lists an item, users claim it with a pickup note, the giver selects one recipient (others auto-rejected), the two parties confirm the handoff from both sides, and both leave a mutual transaction rating. Ratings roll up into denormalized per-user reputation (giver/recipient averages + transaction count) recomputed **synchronously** when a rating is written. Coordination is by pickup note + push notifications — there is NO in-app chat. This milestone ships the API, the mobile feed/detail/create/manage/rating screens, and admin moderation (a giveaway moderation page + giveaway support in the existing report queue).

**Architecture:** Three new Postgres tables (`giveaways`, `giveaway_claims`, `transaction_ratings`) plus a notification outbox table and denormalized reputation columns on `users`, managed via Prisma migrations. The `reports.target_type` enum gains a `giveaway` value in its OWN migration (Postgres requires `ALTER TYPE ... ADD VALUE` to commit before the new label is usable). The admin queue renders giveaway reports generically; auto-hide reuses the M2 `maybeAutoHide` path. Fastify routes under `/v1/giveaways`, `/v1/giveaways/:id/claims`, `/v1/giveaways/:id/{select,hand-off,confirm-received,cancel,ratings}`, and `/v1/users/:id/reputation`. State transitions (`open → claimed → handed_off → completed`, plus `open|claimed|handed_off → cancelled`) are enforced server-side inside transactions; a `claimed` giveaway auto-expires back to `open` after a timeout. Reputation averages are recomputed **inline in the same transaction** that writes a rating — an indexed aggregate over `transaction_ratings`, weighted by distinct counterparties to resist farming — so there is NO `reputation-recalc` queue or worker. Push notifications for select/handoff/complete are written to a transactional outbox in the same transaction as the state change and dispatched onto M1's existing `notification-send` queue by a sweep (with six new template keys, incl. `giveaway_handed_off`). Mobile is **online-only** TanStack Query (giveaways are NOT routed through the M1 records offline write queue); create/claim/select/hand-off/confirm/rate are online-only mutations. Per-route rate limits guard create, claim, and rating endpoints. Photo upload reuses the `POST /v1/me/avatar` multipart pattern. Admin reuses `serverAdminApi`/`browserAdminApi` + `writeAuditLog` + CSRF.

**Tech Stack:** Fastify 4, Prisma 5, Postgres 16, Redis 7, BullMQ 5, Zod 3, Vitest 2 + Supertest 7 (API), Expo SDK + Expo Router + Zustand + TanStack Query + NativeWind (mobile), React Native Testing Library 12 (component tests), Maestro (E2E), Next.js 15 + Playwright (admin).

**Spec reference:** `docs/superpowers/specs/2026-05-23-pantry-app-design.md` §2.13 (blessing/giveaway), §2.11 (offline policy — giveaways are online-only like reviews), §13 M6. Read before starting.

**Prerequisites (complete & merged):** Per the backend-first execution order, prereqs split by track. Track A (backend phases A–G + admin phase I) does NOT depend on M0c — they touch only `api/`, `packages/shared`, and `apps/admin/`. M0c is required only when Track B (mobile phase H) begins.

**Track A (backend + admin, build now) prerequisites:**

- **M0a** — shared package, error/`AppError`, config, db/redis singletons, error-handler, auth plugin (`req.user`, `app.requireAuth`, `app.requireAdmin`), users repository (`toApiUser`), `issueAccessToken`→string, random/hashToken utils, test harness (`tests/helpers/setup.ts`, `tests/helpers/factories.ts`).
- **M0b** — auth routes (so integration tests can sign up + log in users), `POST /v1/me/avatar` multipart upload pattern.
- **M1** backend phases — `products` table + `GET /v1/products/:id`; `records` table (user-owned pantry items, status `active|consumed|discarded|expired`); the Idempotency-Key Fastify plugin (`api/src/plugins/idempotency.ts`, route opt-in, Redis 24h); BullMQ wiring under `api/src/queues/` (`getQueueConnection()`→raw `ConnectionOptions`, `getAllQueues()` registry); canonical worker runner `api/src/workers/runner.ts` (`startWorkers()`/`stopWorkers()`); the `notification-send` queue/worker + `push_logs(templateKey)` Expo Push pipeline.
- **M2** backend phases — `reports(reporter_id, target_type enum, target_id, reason, body?, status)` + `POST /v1/reports` + `maybeAutoHide` (auto-hide at `> 3` non-dismissed reports) + admin report queue.
- **M3** — admin Next.js app, `serverAdminApi`/`browserAdminApi`, `writeAuditLog({...})`, CSRF protection.

**Track B (mobile, deferred) — additional prerequisite:**

- **M0c** — mobile app shell with auth-gated `(app)` group, tab navigator, theme provider (`useTheme()`), API client (`apps/mobile/src/api/client.ts`: bearer + 401 refresh + RFC7807), TanStack Query provider, secure-store session.

**Out of scope for M6 (handled elsewhere or excluded):**

- In-app chat / messaging — coordination is pickup note + push only.
- Shipping / postage — local pickup only.
- Giveaway-driven points / rewards — points are referral-only (**M7**). Reputation here is a **separate** rating system from M7 referral points.
- Payments of any kind.
- Real-time push of claim counts to other clients — deferred per spec §12.

---

## Red Team Review — 2026-05-26

This plan was reviewed for flow integrity, abuse, privacy, and over-engineering. The following changes were folded in (plain-language summary; the phases below already reflect them):

1. **Reputation recompute is now synchronous, not a background worker.** When a rating is written, the ratee's giver/recipient averages and transaction count are recomputed inline in the same DB transaction (an indexed aggregate, sub-millisecond at this scale). The whole `reputation-recalc` BullMQ queue + worker + debounce sentinel is removed — it added moving parts and eventual-consistency windows for no benefit. Push notifications still use M1's existing `notification-send` queue.

2. **Two-phase handoff.** Completion is no longer a single giver-only button. The recipient must `confirm-received` and the giver must `mark-handed-off`; ratings only unlock once BOTH parties have acknowledged the handoff. New states: `open → claimed → handed_off → completed`, plus `open|claimed|handed_off → cancelled`. A `claimed` giveaway auto-expires back to `open` after a timeout so it can't be stuck forever.

3. **Push is not lost on a crash.** The select/complete/handoff push notifications are written to a transactional outbox row in the SAME DB transaction as the state change, then a sweep dispatches them onto the notification queue. A reconciliation sweep also re-fires anything stuck, so a process crash right after commit cannot silently drop a notification.

4. **Pickup-note privacy.** Free-text pickup notes are PII. The giver does NOT see other claimants' `pickupNote` before selecting — pre-selection the giver sees only a redacted claimant projection (name, reputation, claim time). The full `pickupNote` is revealed only for the claim that gets selected.

5. **Blind mutual ratings.** Neither party sees the other's rating (stars or comment) until both have submitted or a rating window closes. This curbs retaliatory tit-for-tat ratings.

6. **Anti-farming reputation.** Reputation gain is dampened so two colluding accounts can't cheaply farm a 5★ average: averages are weighted by DISTINCT counterparties, so repeated transactions between the same pair contribute with diminishing weight.

7. **Per-route rate limits** on giveaway create, claim, and rating endpoints to blunt claim-flooding and listing spam.

8. **Source-of-truth + dead-code cleanups.** The selected recipient is derived from the claim with `status='selected'` (single source of truth); `selectedClaimId` is dropped. The unused `withdrawn` claim status is removed (no withdraw flow in scope).

9. **Postgres enum-add safety.** Adding the `giveaway` value to `ReportTargetType` is its own migration; the new label is never referenced in the transaction that adds it.

---

## Validation amendments — 2026-05-26

**Country-scoped giveaway feed.** Giveaways are free LOCAL pickup, so a giveaway listed in one country is useless to a viewer in another. The feed is therefore scoped to the viewer's country, reusing the EXISTING `users.country` column (ISO-3166 alpha-2, derived from IP at signup per spec §2.9 — available in v1). This is a purely ADDITIVE feed-scoping change and does NOT disturb the already-applied red-team fixes (two-phase handoff, pickup-note privacy, blind ratings, synchronous reputation, transactional outbox).

- A nullable `country char(2)` column is added to `giveaways`, stamped at create time from the giver's `users.country`.
- `GET /v1/giveaways` filters to `giveaways.country = <viewer's users.country>`, preserving the existing `status` filter and cursor pagination.
- **No-country fallback (global fallback):** when the viewer has no `users.country` (null), the feed is NOT country-filtered — it returns giveaways across all countries (global view) rather than an empty list. Giveaways whose own `country` is null are likewise globally visible (visible to every viewer regardless of the viewer's country), since they cannot be confined to a region.
- The feed index becomes `(country, status, created_at desc)` to serve the scoped query; `country` is exposed on the giveaway API response.

---

## Execution order — backend-first (2026-05-26)

This milestone is split across the project's two build tracks. The **Backend + Admin track (Track A)** is built and deployed before any mobile work; the **Mobile track (Track B)** begins only after the entire Track A across all milestones is complete (starting with M0c).

**Track A — Backend + Admin (build now):**
- Phase A — Data model
- Phase B — Giveaway state machine (pure)
- Phase C — Rating role inference (pure)
- Phase D — Repositories + notification templates + outbox
- Phase E — Synchronous reputation recompute
- Phase F — Giveaway HTTP routes
- Phase G — Reputation end-to-end + reports
- Phase I — Admin moderation (admin web — built in the backend-first track)

**Track B — Mobile (DEFERRED — do NOT implement until the Mobile track begins):**
- Phase H — Mobile screens (online-only TanStack Query)

The **Final verification** phase splits accordingly: API + admin checks run in Track A; mobile checks run in Track B. (Note: Phase I follows Phase H in file order, but in Track A you build Phase I and skip Phase H until Track B.)

---

## Conventions (carried over from M0a/M1/M2)

- TDD: write failing test, watch it fail, implement minimal code, watch it pass, commit. No batched commits across features.
- Conventional commits, scopes `shared`, `api`, `mobile`, `admin`.
- Wire contract is **camelCase**; DB columns are **snake_case** via Prisma `@map`; error `code` strings are **snake_case**.
- Every API route imports its Zod schema from `@pantry/shared`.
- Every API route handler uses `req.user`, `app.requireAuth` (or `app.requireAdmin`), and `req.id` for logging. No `console.log` — use `req.log` (API) / mobile logger.
- Create/claim/select/hand-off/confirm/rating POSTs require `Idempotency-Key` from the M1 plugin (`config: { idempotent: 'required' }`).
- Mobile giveaways are **online-only** TanStack Query (`staleTime: 30_000` for feeds); writes are online-only TanStack mutations — server is source of truth — and are NOT routed through the M1 offline write queue (spec §2.11 amended for giveaways, same as reviews).
- Reputation averages are recomputed SYNCHRONOUSLY inside the same transaction that writes a rating (indexed aggregate over `transaction_ratings`). There is no reputation worker or queue.
- Per-route rate limits are applied to `POST /v1/giveaways`, `POST /v1/giveaways/:id/claims`, and `POST /v1/giveaways/:id/ratings` (config + a test in the relevant phase).
- Outbound select/hand-off/confirm/complete pushes are enqueued via a transactional outbox written in the same transaction as the state change, then swept onto M1's `notification-send` queue — pushes are never lost on a crash after commit.

---

## File map

This plan creates the following files. Files in **bold** carry the load-bearing logic.

```
pantry/
├── packages/shared/src/schemas/
│   ├── giveaway.ts                             ← Zod giveaway + claim schemas (NEW)
│   └── reputation.ts                           ← Zod reputation + transaction-rating schemas (NEW)
├── packages/shared/src/index.ts                ← re-exports (MODIFY)
├── packages/shared/src/schemas/report.ts       ← +'giveaway' to reportTargetTypeSchema (MODIFY)
├── packages/shared/src/schemas/error.ts        ← +giveaway error codes (MODIFY)
├── api/
│   ├── prisma/schema.prisma                    ← +Giveaway, GiveawayClaim, TransactionRating, NotificationOutbox; +User reputation cols; +ReportTargetType.giveaway (MODIFY)
│   ├── prisma/migrations/<ts>_giveaways/
│   │   └── migration.sql                       ← generated + stars CHECK (NO enum value here)
│   ├── prisma/migrations/<ts2>_report_target_giveaway/
│   │   └── migration.sql                       ← ALTER TYPE "ReportTargetType" ADD VALUE 'giveaway' (own migration)
│   ├── src/
│   │   ├── **services/giveaways/state-machine.ts** ← allowed status transitions incl. handed_off (pure)
│   │   ├── services/giveaways/repository.ts    ← toApiGiveaway / toApiClaim (redacts pickupNote pre-selection)
│   │   ├── **services/giveaways/ratings.ts**   ← role inference + mutual-rating guard (pure helpers)
│   │   ├── **services/reputation/recompute.ts** ← synchronous, counterparty-weighted reputation recompute (in-txn)
│   │   ├── services/reputation/repository.ts   ← toApiReputation
│   │   ├── services/notifications/outbox.ts    ← write outbox row in-txn + sweep onto notification-send queue
│   │   ├── notifications/giveaway-templates.ts ← 5 template-key constants + payload builders
│   │   ├── routes/giveaways/
│   │   │   ├── index.ts                        ← mount + register sub-routes
│   │   │   ├── list-feed.ts                    ← GET /v1/giveaways
│   │   │   ├── get.ts                          ← GET /v1/giveaways/:id
│   │   │   ├── create.ts                       ← POST /v1/giveaways (idempotent, rate-limited)
│   │   │   ├── update.ts                       ← PATCH /v1/giveaways/:id (own)
│   │   │   ├── cancel.ts                       ← POST /v1/giveaways/:id/cancel (own)
│   │   │   ├── claims.ts                       ← POST (rate-limited) + GET /v1/giveaways/:id/claims (giver sees redacted notes)
│   │   │   ├── select.ts                       ← POST /v1/giveaways/:id/select (giver)
│   │   │   ├── hand-off.ts                     ← POST /v1/giveaways/:id/hand-off (giver: claimed → handed_off)
│   │   │   ├── confirm-received.ts             ← POST /v1/giveaways/:id/confirm-received (recipient: → completed)
│   │   │   └── ratings.ts                      ← POST /v1/giveaways/:id/ratings (both parties, rate-limited, blind)
│   │   ├── routes/users/reputation.ts          ← GET /v1/users/:id/reputation
│   │   └── server.ts                           ← mount giveaways + reputation route (MODIFY)
│   └── tests/
│       ├── unit/giveaway-state-machine.test.ts
│       ├── unit/giveaway-ratings.test.ts
│       ├── unit/reputation-recompute.test.ts
│       ├── integration/giveaways-feed.test.ts
│       ├── integration/giveaways-create.test.ts
│       ├── integration/giveaways-update-cancel.test.ts
│       ├── integration/giveaways-claims.test.ts
│       ├── integration/giveaways-select-handoff-complete.test.ts
│       ├── integration/giveaways-ratings.test.ts
│       ├── integration/giveaways-rate-limit.test.ts
│       ├── integration/user-reputation.test.ts
│       ├── integration/reports-giveaway.test.ts
│       └── helpers/factories.ts                ← +makeGiveaway, makeClaim, makeTransactionRating (MODIFY)
└── apps/mobile/
    ├── src/api/
    │   ├── giveaways.ts                         ← TanStack hooks (feed/detail/create/claim/select/hand-off/confirm/rate)
    │   └── reputation.ts                        ← reputation query hook
    ├── src/features/giveaways/
    │   ├── GiveawayCard.tsx                     ← feed row
    │   ├── GiveawayStatusBadge.tsx
    │   ├── ClaimButton.tsx                      ← claim + pickup-note sheet
    │   ├── ClaimList.tsx                        ← giver: see claims + select
    │   └── TransactionRatingForm.tsx            ← mutual rating (stars + comment)
    ├── app/(app)/(tabs)/giveaways.tsx           ← MODIFY (placeholder from M0c): feed
    ├── app/(app)/giveaway/[id].tsx              ← NEW: detail (claim / status)
    ├── app/(app)/giveaway/new.tsx               ← NEW: create form (optional start-from-record)
    ├── app/(app)/giveaway/[id]/manage.tsx       ← NEW: giver claims + select + complete
    ├── app/(app)/giveaway/mine.tsx              ← NEW: "My giveaways" + "My claims" tabs
    ├── app/(app)/giveaway/[id]/rate.tsx         ← NEW: post-completion mutual rating
    └── __tests__/
        ├── GiveawayCard.test.tsx
        ├── ClaimButton.test.tsx
        └── TransactionRatingForm.test.tsx
└── apps/mobile/.maestro/
│   └── giveaway-flow.yaml                       ← E2E (list → claim → select → complete → rate)
└── apps/admin/
    ├── app/giveaways/page.tsx                   ← moderation list (hide/cancel, audit-logged)
    ├── app/giveaways/actions.ts                 ← server actions (cancel/hide) + writeAuditLog
    └── __tests__/giveaways-moderation.spec.ts   ← Playwright
```

---

## Phase A — Data model

### Task A1: Add Giveaway, GiveawayClaim, TransactionRating + reputation columns to Prisma schema

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Append the new enums** (above the existing `enum ReportTargetType` block)

```prisma
enum GiveawayStatus {
  open
  claimed
  handed_off
  completed
  cancelled

  @@map("giveaway_status")
}

enum GiveawayClaimStatus {
  requested
  selected
  rejected

  @@map("giveaway_claim_status")
}

enum TransactionRaterRole {
  giver
  recipient

  @@map("transaction_rater_role")
}
```

> `handed_off` is the two-phase-handoff midpoint: the giver marks the item handed off; the recipient must `confirm-received` before the giveaway reaches `completed` and ratings unlock. The `withdrawn` claim status is intentionally absent — there is no withdraw flow in scope.

- [ ] **Step 2: Add `giveaway` to the existing `ReportTargetType` enum**

Find `enum ReportTargetType { ... }` (M2) and add the new value:

```prisma
enum ReportTargetType {
  review
  user
  product
  giveaway
}
```

> The Prisma model change above is fine, but the resulting `ALTER TYPE ... ADD VALUE 'giveaway'` MUST be applied in its own migration that references nothing using the new label (see Task A2b). Postgres forbids using a newly added enum value in the same transaction that adds it.

- [ ] **Step 3: Add the three new models at the bottom of the file**

```prisma
model Giveaway {
  id              String         @id @default(uuid()) @db.Uuid
  giverUserId     String         @map("giver_user_id") @db.Uuid
  productId       String?        @map("product_id") @db.Uuid
  recordId        String?        @map("record_id") @db.Uuid
  title           String
  description     String?
  photoUrl        String?        @map("photo_url")
  locationText    String         @map("location_text")
  country         String?        @db.Char(2)
  status          GiveawayStatus @default(open)
  claimExpiresAt  DateTime?      @map("claim_expires_at")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  handedOffAt     DateTime?      @map("handed_off_at")
  confirmedAt     DateTime?      @map("confirmed_at")
  completedAt     DateTime?      @map("completed_at")

  giver   User            @relation("GiveawayGiver", fields: [giverUserId], references: [id], onDelete: Cascade)
  product Product?        @relation(fields: [productId], references: [id])
  record  Record?         @relation(fields: [recordId], references: [id])
  claims  GiveawayClaim[]
  ratings TransactionRating[]

  @@index([country, status, createdAt(sort: Desc)])
  @@index([giverUserId, status])
  @@index([status, claimExpiresAt])
  @@map("giveaways")
}

model GiveawayClaim {
  id              String              @id @default(uuid()) @db.Uuid
  giveawayId      String              @map("giveaway_id") @db.Uuid
  claimerUserId   String              @map("claimer_user_id") @db.Uuid
  pickupNote      String?             @map("pickup_note")
  status          GiveawayClaimStatus @default(requested)
  createdAt       DateTime            @default(now()) @map("created_at")

  giveaway Giveaway @relation(fields: [giveawayId], references: [id], onDelete: Cascade)
  claimer  User     @relation("GiveawayClaimer", fields: [claimerUserId], references: [id], onDelete: Cascade)

  @@unique([giveawayId, claimerUserId])
  @@index([giveawayId, status])
  @@map("giveaway_claims")
}

model TransactionRating {
  id          String               @id @default(uuid()) @db.Uuid
  giveawayId  String               @map("giveaway_id") @db.Uuid
  raterUserId String               @map("rater_user_id") @db.Uuid
  rateeUserId String               @map("ratee_user_id") @db.Uuid
  raterRole   TransactionRaterRole @map("rater_role")
  stars       Int                  @db.SmallInt
  comment     String?
  revealedAt  DateTime?            @map("revealed_at")
  createdAt   DateTime             @default(now()) @map("created_at")

  giveaway Giveaway @relation(fields: [giveawayId], references: [id], onDelete: Cascade)
  rater    User     @relation("RatingRater", fields: [raterUserId], references: [id], onDelete: Cascade)
  ratee    User     @relation("RatingRatee", fields: [rateeUserId], references: [id], onDelete: Cascade)

  @@unique([giveawayId, raterUserId])
  @@index([rateeUserId])
  @@map("transaction_ratings")
}

model NotificationOutbox {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  templateKey String    @map("template_key")
  payload     Json
  dispatchedAt DateTime? @map("dispatched_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([dispatchedAt, createdAt])
  @@map("notification_outbox")
}
```

> **Single source of truth for the selected recipient.** There is intentionally NO `selectedClaimId` column on `Giveaway`. The selected recipient is derived from the one `GiveawayClaim` whose `status='selected'`. A partial unique index (added in the migration) enforces at most one selected claim per giveaway: `CREATE UNIQUE INDEX giveaway_claims_one_selected ON giveaway_claims (giveaway_id) WHERE status = 'selected';`. Ratings resolve `selectedRecipientId` by reading that claim.

> `revealedAt` supports **blind ratings**: a rating is hidden from the counterparty (and from public reputation reads of the raw row) until BOTH parties have submitted or the reveal window closes; the recompute counts all submitted ratings, but the row's stars/comment are only exposed once `revealedAt` is set.

> **Country-scoped feed.** `country char(2)` (nullable) holds the giveaway's pickup country, stamped at create time from the giver's `users.country` (ISO-3166 alpha-2, set at signup per spec §2.9). The feed index is `(country, status, created_at desc)` so `GET /v1/giveaways` can serve the viewer's country efficiently. Nullable because a giver may have no `country` on their user row; such giveaways are globally visible (see the no-country fallback in Task F1).

- [ ] **Step 4: Add reputation columns + relations to the existing `User` model**

Inside `model User`, append:

```prisma
  giverRatingAvg     Decimal? @map("giver_rating_avg") @db.Decimal(3, 2)
  recipientRatingAvg Decimal? @map("recipient_rating_avg") @db.Decimal(3, 2)
  transactionCount   Int      @default(0) @map("transaction_count")

  giveaways       Giveaway[]          @relation("GiveawayGiver")
  giveawayClaims  GiveawayClaim[]     @relation("GiveawayClaimer")
  ratingsGiven    TransactionRating[] @relation("RatingRater")
  ratingsReceived TransactionRating[] @relation("RatingRatee")
```

- [ ] **Step 5: Add the relation to the existing `Product` and `Record` models**

Inside `model Product`, append `giveaways Giveaway[]`. Inside `model Record`, append `giveaways Giveaway[]`.

- [ ] **Step 6: Format and validate**

```bash
pnpm --filter @pantry/api exec prisma format
pnpm --filter @pantry/api exec prisma validate
```
Expected: `The schema at api/prisma/schema.prisma is valid 🚀`.

- [ ] **Step 7: Commit**

```bash
git add api/prisma/schema.prisma
git commit -m "feat(api): add Giveaway, GiveawayClaim, TransactionRating models + reputation columns"
```

---

### Task A2: Generate the migration

**Files:**
- Create: `api/prisma/migrations/<ts>_giveaways/migration.sql` (generated)

> **Two migrations, not one.** The `ALTER TYPE "ReportTargetType" ADD VALUE 'giveaway'` MUST live in its own migration (Task A2b) and be applied BEFORE any migration/seed/code references the new label, because Postgres cannot use a freshly added enum value inside the transaction that added it. The giveaways table migration below must NOT reference `'giveaway'`.

- [ ] **Step 1: Create the giveaways tables migration**

Temporarily edit the schema to NOT yet add `giveaway` to `ReportTargetType` (keep the three new enums, the three tables, `NotificationOutbox`, and the User columns), then:

```bash
pnpm --filter @pantry/api exec prisma migrate dev --name giveaways
```
Expected: prints `Applying migration ...` and `✔ Generated Prisma Client`. Verify the generated SQL contains NO `ALTER TYPE "ReportTargetType" ADD VALUE`.

- [ ] **Step 1b: Add a 1–5 CHECK constraint for `transaction_ratings.stars` and the one-selected-claim partial unique index**

Prisma does not emit value-range CHECK constraints or partial unique indexes. Append to the generated `migration.sql`:

```sql
ALTER TABLE "transaction_ratings"
  ADD CONSTRAINT "transaction_ratings_stars_check" CHECK ("stars" BETWEEN 1 AND 5);

CREATE UNIQUE INDEX "giveaway_claims_one_selected"
  ON "giveaway_claims" ("giveaway_id") WHERE "status" = 'selected';
```

Re-run `prisma migrate dev` if the file was edited after generation.

- [ ] **Step 2: Verify the tables, columns, and indexes**

```bash
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\dt giveaway*"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\dt transaction_ratings notification_outbox"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND (column_name LIKE '%rating%' OR column_name='transaction_count');"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\d+ giveaway_claims"
```
Expected: `giveaways`, `giveaway_claims`, `transaction_ratings`, `notification_outbox` listed; `users` has `giver_rating_avg`, `recipient_rating_avg`, `transaction_count`; `giveaway_claims_one_selected` partial unique index present.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/migrations
git commit -m "feat(api): migrate giveaways, claims, transaction_ratings, notification outbox"
```

---

### Task A2b: Separate migration for the `ReportTargetType.giveaway` enum value

**Files:**
- Create: `api/prisma/migrations/<ts2>_report_target_giveaway/migration.sql`

> Postgres requires `ALTER TYPE ... ADD VALUE` to be committed in its OWN transaction before the value is used. Keep this isolated from the giveaways tables migration AND from any migration/seed that references `'giveaway'`.

- [ ] **Step 1: Re-add `giveaway` to `ReportTargetType` in `schema.prisma`** (reverting the temporary removal from Task A2), then generate:

```bash
pnpm --filter @pantry/api exec prisma migrate dev --name report_target_giveaway
```
Expected: the generated `migration.sql` contains exactly `ALTER TYPE "ReportTargetType" ADD VALUE 'giveaway';` and nothing that uses the value.

- [ ] **Step 2: Verify**

```bash
psql postgresql://pantry:pantry@localhost:5432/pantry -c "SELECT enum_range(NULL::\"ReportTargetType\");"
```
Expected: includes `giveaway`.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add giveaway value to report target enum in its own migration"
```

---

### Task A3: Test factories for giveaways, claims, ratings

**Files:**
- Modify: `api/tests/helpers/factories.ts`

- [ ] **Step 1: Append factories**

```ts
import type { Giveaway, GiveawayClaim, TransactionRating } from '@prisma/client';

export async function makeGiveaway(overrides: {
  giverUserId: string;
  productId?: string;
  recordId?: string;
  title?: string;
  description?: string;
  locationText?: string;
  status?: 'open' | 'claimed' | 'handed_off' | 'completed' | 'cancelled';
}): Promise<Giveaway> {
  const prisma = getPrisma();
  return prisma.giveaway.create({
    data: {
      giverUserId: overrides.giverUserId,
      productId: overrides.productId ?? null,
      recordId: overrides.recordId ?? null,
      title: overrides.title ?? 'Free pasta, best before next week',
      description: overrides.description ?? null,
      locationText: overrides.locationText ?? 'Near Central Station',
      status: overrides.status ?? 'open',
    },
  });
}

export async function makeClaim(overrides: {
  giveawayId: string;
  claimerUserId: string;
  pickupNote?: string;
  status?: 'requested' | 'selected' | 'rejected';
}): Promise<GiveawayClaim> {
  const prisma = getPrisma();
  return prisma.giveawayClaim.create({
    data: {
      giveawayId: overrides.giveawayId,
      claimerUserId: overrides.claimerUserId,
      pickupNote: overrides.pickupNote ?? 'Can pick up after 6pm.',
      status: overrides.status ?? 'requested',
    },
  });
}

export async function makeTransactionRating(overrides: {
  giveawayId: string;
  raterUserId: string;
  rateeUserId: string;
  raterRole: 'giver' | 'recipient';
  stars?: number;
  comment?: string;
}): Promise<TransactionRating> {
  const prisma = getPrisma();
  return prisma.transactionRating.create({
    data: {
      giveawayId: overrides.giveawayId,
      raterUserId: overrides.raterUserId,
      rateeUserId: overrides.rateeUserId,
      raterRole: overrides.raterRole,
      stars: overrides.stars ?? 5,
      comment: overrides.comment ?? null,
    },
  });
}
```

- [ ] **Step 2: Add the new tables to the truncate list in `tests/helpers/setup.ts`**

Add `'notification_outbox'`, `'transaction_ratings'`, `'giveaway_claims'`, `'giveaways'` to the top of the `tables` array (before any FK-referenced tables, after `reports`).

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add api/tests/helpers/factories.ts api/tests/helpers/setup.ts
git commit -m "test(api): add giveaway/claim/rating factories and truncation"
```

---

### Task A4: Zod schemas in `@pantry/shared`

**Files:**
- Create: `packages/shared/src/schemas/giveaway.ts`
- Create: `packages/shared/src/schemas/reputation.ts`
- Modify: `packages/shared/src/schemas/report.ts`
- Modify: `packages/shared/src/schemas/error.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/giveaway.ts`**

```ts
import { z } from 'zod';

export const giveawayStatusSchema = z.enum(['open', 'claimed', 'handed_off', 'completed', 'cancelled']);
export type GiveawayStatus = z.infer<typeof giveawayStatusSchema>;

export const claimStatusSchema = z.enum(['requested', 'selected', 'rejected']);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

const titleField = z.string().trim().min(3).max(120);
const descField = z.string().trim().max(2000).optional();
const locationField = z.string().trim().min(2).max(160);
const noteField = z.string().trim().max(500).optional();

export const giveawaySchema = z.object({
  id: z.string().uuid(),
  giverUserId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  recordId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  locationText: z.string(),
  /** ISO-3166 alpha-2 pickup country, stamped from the giver's users.country at create; null when the giver has no country. */
  country: z.string().length(2).nullable(),
  status: giveawayStatusSchema,
  /** Derived from the claim with status='selected'; null until a recipient is picked. */
  selectedRecipientId: z.string().uuid().nullable(),
  claimExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  handedOffAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  claimCount: z.number().int().nonnegative().optional(),
  /** Present when the caller is authenticated and has claimed this giveaway. */
  myClaim: z
    .object({ id: z.string().uuid(), status: claimStatusSchema, pickupNote: z.string().nullable() })
    .nullable()
    .optional(),
  giver: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      avatarUrl: z.string().url().nullable(),
      giverRatingAvg: z.number().nullable(),
      transactionCount: z.number().int().nonnegative(),
    })
    .optional(),
});
export type Giveaway = z.infer<typeof giveawaySchema>;

export const giveawayCreateSchema = z.object({
  title: titleField,
  description: descField,
  locationText: locationField,
  photoUrl: z.string().url().optional(),
  productId: z.string().uuid().optional(),
  recordId: z.string().uuid().optional(),
});
export type GiveawayCreate = z.infer<typeof giveawayCreateSchema>;

export const giveawayPatchSchema = z
  .object({
    title: titleField.optional(),
    description: descField,
    locationText: locationField.optional(),
    photoUrl: z.string().url().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'at least one field required',
  });
export type GiveawayPatch = z.infer<typeof giveawayPatchSchema>;

export const claimSchema = z.object({
  id: z.string().uuid(),
  giveawayId: z.string().uuid(),
  claimerUserId: z.string().uuid(),
  pickupNote: z.string().nullable(),
  status: claimStatusSchema,
  createdAt: z.string().datetime(),
  claimer: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      avatarUrl: z.string().url().nullable(),
      recipientRatingAvg: z.number().nullable(),
      transactionCount: z.number().int().nonnegative(),
    })
    .optional(),
});
export type Claim = z.infer<typeof claimSchema>;

export const claimCreateSchema = z.object({ pickupNote: noteField });
export type ClaimCreate = z.infer<typeof claimCreateSchema>;

export const selectClaimSchema = z.object({ claimId: z.string().uuid() });
export type SelectClaim = z.infer<typeof selectClaimSchema>;

export const giveawayListQuerySchema = z.object({
  status: giveawayStatusSchema.default('open'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type GiveawayListQuery = z.infer<typeof giveawayListQuerySchema>;
```

- [ ] **Step 2: Write `packages/shared/src/schemas/reputation.ts`**

```ts
import { z } from 'zod';

const starsField = z.number().int().min(1).max(5);

/** raterRole is INFERRED server-side from the giveaway; never sent by the client. */
export const transactionRatingCreateSchema = z.object({
  stars: starsField,
  comment: z.string().trim().max(1000).optional(),
});
export type TransactionRatingCreate = z.infer<typeof transactionRatingCreateSchema>;

export const transactionRatingSchema = z.object({
  id: z.string().uuid(),
  giveawayId: z.string().uuid(),
  raterUserId: z.string().uuid(),
  rateeUserId: z.string().uuid(),
  raterRole: z.enum(['giver', 'recipient']),
  stars: starsField,
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type TransactionRating = z.infer<typeof transactionRatingSchema>;

export const reputationSchema = z.object({
  userId: z.string().uuid(),
  giverRatingAvg: z.number().nullable(),
  recipientRatingAvg: z.number().nullable(),
  transactionCount: z.number().int().nonnegative(),
});
export type Reputation = z.infer<typeof reputationSchema>;
```

- [ ] **Step 3: Add `giveaway` to `reportTargetTypeSchema` in `packages/shared/src/schemas/report.ts`**

```ts
export const reportTargetTypeSchema = z.enum(['review', 'user', 'product', 'giveaway']);
```

- [ ] **Step 4: Add error codes to `packages/shared/src/schemas/error.ts`**

Inside `ERROR_CODES`, add:

```ts
  GIVEAWAY_NOT_OPEN: 'giveaway_not_open',
  GIVEAWAY_INVALID_TRANSITION: 'giveaway_invalid_transition',
  CLAIM_ALREADY_EXISTS: 'claim_already_exists',
  CLAIM_NOT_FOUND: 'claim_not_found',
  HANDOFF_NOT_ALLOWED: 'handoff_not_allowed',
  CONFIRM_NOT_ALLOWED: 'confirm_not_allowed',
  RATING_NOT_READY: 'rating_not_ready',
  RATING_ALREADY_EXISTS: 'rating_already_exists',
  RATING_NOT_ALLOWED: 'rating_not_allowed',
  RATE_LIMITED: 'rate_limited',
```

- [ ] **Step 5: Re-export from `packages/shared/src/index.ts`**

```ts
export * from './schemas/giveaway.js';
export * from './schemas/reputation.js';
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter @pantry/shared typecheck
git add packages/shared/src
git commit -m "feat(shared): add giveaway, claim, reputation schemas + report enum + error codes"
```

---

## Phase B — Giveaway state machine (pure)

### Task B1: State-machine unit tests (failing)

**Files:**
- Create: `api/tests/unit/giveaway-state-machine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/giveaway-state-machine.test.ts
import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition } from '../../src/services/giveaways/state-machine.js';

describe('giveaway state machine', () => {
  it('allows open → claimed (on select)', () => {
    expect(canTransition('open', 'claimed')).toBe(true);
  });
  it('allows claimed → handed_off (giver marks handoff)', () => {
    expect(canTransition('claimed', 'handed_off')).toBe(true);
  });
  it('allows handed_off → completed (recipient confirms received)', () => {
    expect(canTransition('handed_off', 'completed')).toBe(true);
  });
  it('allows claimed → open (auto-expiry timeout)', () => {
    expect(canTransition('claimed', 'open')).toBe(true);
  });
  it('allows cancel from open, claimed, and handed_off', () => {
    expect(canTransition('open', 'cancelled')).toBe(true);
    expect(canTransition('claimed', 'cancelled')).toBe(true);
    expect(canTransition('handed_off', 'cancelled')).toBe(true);
  });
  it('forbids completing without going through handed_off', () => {
    expect(canTransition('open', 'completed')).toBe(false);
    expect(canTransition('claimed', 'completed')).toBe(false);
  });
  it('forbids any transition out of a terminal state', () => {
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'open')).toBe(false);
  });
  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition('claimed', 'completed')).toThrow();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `pnpm --filter @pantry/api exec vitest run tests/unit/giveaway-state-machine.test.ts` (module not found).

---

### Task B2: Implement the state machine

**Files:**
- Create: `api/src/services/giveaways/state-machine.ts`

- [ ] **Step 1: Write the module**

```ts
import { ERROR_CODES } from '@pantry/shared';
import { AppError } from '../../errors.js';

type Status = 'open' | 'claimed' | 'handed_off' | 'completed' | 'cancelled';

// Two-phase handoff: open → claimed (giver selects a recipient) →
// handed_off (giver marks the item handed over) → completed (recipient
// confirms receipt). claimed → open is the auto-expiry timeout so a
// giveaway can't get stuck after a select with no follow-through.
// Cancellation is allowed from any non-terminal state. completed and
// cancelled are terminal.
const ALLOWED: Record<Status, Status[]> = {
  open: ['claimed', 'cancelled'],
  claimed: ['handed_off', 'open', 'cancelled'],
  handed_off: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: Status, to: Status): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.GIVEAWAY_INVALID_TRANSITION,
      title: `Cannot move giveaway from ${from} to ${to}`,
    });
  }
}
```

- [ ] **Step 2: Run, verify PASS** — 8 passed.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/giveaways/state-machine.ts api/tests/unit/giveaway-state-machine.test.ts
git commit -m "feat(api): giveaway state machine with unit tests"
```

---

## Phase C — Rating role inference (pure)

### Task C1: Rating-helper unit tests (failing)

**Files:**
- Create: `api/tests/unit/giveaway-ratings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/giveaway-ratings.test.ts
import { describe, expect, it } from 'vitest';
import { inferRaterRole } from '../../src/services/giveaways/ratings.js';

describe('inferRaterRole', () => {
  const giveaway = { giverUserId: 'g-1', selectedRecipientId: 'r-1' };

  it('returns giver when the rater is the giver', () => {
    expect(inferRaterRole(giveaway, 'g-1')).toEqual({ role: 'giver', rateeUserId: 'r-1' });
  });
  it('returns recipient when the rater is the selected recipient', () => {
    expect(inferRaterRole(giveaway, 'r-1')).toEqual({ role: 'recipient', rateeUserId: 'g-1' });
  });
  it('returns null when the rater is neither party', () => {
    expect(inferRaterRole(giveaway, 'x-9')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

---

### Task C2: Implement the rating helper

**Files:**
- Create: `api/src/services/giveaways/ratings.ts`

- [ ] **Step 1: Write the module**

```ts
interface GiveawayParties {
  giverUserId: string;
  /** The claimer_user_id of the selected claim (null until a recipient is picked). */
  selectedRecipientId: string | null;
}

export interface RaterRole {
  role: 'giver' | 'recipient';
  rateeUserId: string;
}

/**
 * Infers which side of the transaction the rater is on, and who they are rating.
 * Returns null when the caller is neither the giver nor the selected recipient —
 * the route maps that to a 403 (rating_not_allowed).
 */
export function inferRaterRole(g: GiveawayParties, raterUserId: string): RaterRole | null {
  if (raterUserId === g.giverUserId && g.selectedRecipientId) {
    return { role: 'giver', rateeUserId: g.selectedRecipientId };
  }
  if (g.selectedRecipientId && raterUserId === g.selectedRecipientId) {
    return { role: 'recipient', rateeUserId: g.giverUserId };
  }
  return null;
}
```

- [ ] **Step 2: Run, verify PASS** — 3 passed.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/giveaways/ratings.ts api/tests/unit/giveaway-ratings.test.ts
git commit -m "feat(api): transaction-rating role inference with unit tests"
```

---

## Phase D — Repositories + notification templates + outbox

### Task D1: Giveaway + reputation repository helpers

**Files:**
- Create: `api/src/services/giveaways/repository.ts`
- Create: `api/src/services/reputation/repository.ts`

- [ ] **Step 1: Write `api/src/services/giveaways/repository.ts`** with `toApiGiveaway(g, opts)` and `toApiClaim(c, opts)`. Map `Decimal`/`Date` → `Number`/ISO string; pass through `country` (string|null); include the `giver` / `claimer` light projections (firstName, avatarUrl, the relevant rating avg, transactionCount) when the relation is loaded; surface `claimCount`, `selectedRecipientId` (derived from the loaded claim with `status='selected'`, or null), and `myClaim` from `opts`. **Pickup-note privacy:** `toApiClaim` takes a `revealNote` flag — it returns the real `pickupNote` ONLY when the claim is selected OR the viewer is the claimer themselves; otherwise it returns `pickupNote: null`. `toApiGiveaway` never embeds other claimants' notes.

- [ ] **Step 2: Write `api/src/services/reputation/repository.ts`** with `toApiReputation(user)` returning `{ userId, giverRatingAvg, recipientRatingAvg, transactionCount }` (Decimals → Number | null).

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @pantry/api typecheck
git add api/src/services/giveaways/repository.ts api/src/services/reputation/repository.ts
git commit -m "feat(api): giveaway and reputation repository helpers"
```

---

### Task D2: Giveaway notification templates

**Files:**
- Create: `api/src/notifications/giveaway-templates.ts`

> Reuses M1's `notification-send` queue/worker + `push_logs(templateKey)`. This module only declares the six new template keys and builds the enqueue payloads; it does NOT add a new queue.

- [ ] **Step 1: Write the module** exporting the five template-key constants and small payload builders that enqueue onto M1's notification queue:

```ts
// api/src/notifications/giveaway-templates.ts
import { enqueueNotification } from '../queues/jobs/notification-send.js'; // M1

export const GIVEAWAY_TEMPLATE_KEYS = {
  newClaim: 'giveaway_new_claim',
  selected: 'giveaway_selected',
  rejected: 'giveaway_rejected',
  handedOff: 'giveaway_handed_off',
  completed: 'giveaway_completed',
  ratePrompt: 'giveaway_rate_prompt',
} as const;

/**
 * Giver gets pushed when a new claim arrives. The new-claim push is low-stakes
 * (it is not part of the state-machine transaction), so it goes directly onto
 * M1's queue.
 */
export async function notifyNewClaim(giverUserId: string, giveawayId: string, title: string) {
  await enqueueNotification({
    userId: giverUserId,
    templateKey: GIVEAWAY_TEMPLATE_KEYS.newClaim,
    data: { giveawayId, title },
  });
}

// State-machine pushes (selected, rejected, handedOff, completed, ratePrompt)
// are NOT enqueued directly — the select/hand-off/confirm-received routes write
// them via enqueueOutbox(tx, { userId, templateKey, payload }) in the same
// transaction as the state change (Task D3), so they cannot be lost on a crash.
// Provide small payload-builder helpers here (buildSelectedPayload, etc.) that
// return { userId, templateKey, payload } for the routes to hand to enqueueOutbox.
```

If M1's `enqueueNotification` signature differs, adapt the calls to match it (single source of truth is M1's job module). Note this keeps five NEW template keys beyond `newClaim`; `handed_off` replaces the old single-step complete push but `completed` is retained for the confirm step.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @pantry/api typecheck
git add api/src/notifications/giveaway-templates.ts
git commit -m "feat(api): giveaway push notification templates via notification-send"
```

---

### Task D3: Transactional notification outbox helper

**Files:**
- Create: `api/src/services/notifications/outbox.ts`

> A push that is enqueued AFTER a DB commit can be lost if the process crashes in between. To make select/hand-off/confirm/complete pushes durable, the route writes an outbox row inside the SAME `$transaction` as the state change; a sweep then dispatches undispatched rows onto M1's `notification-send` queue. The sweep is idempotent (marks `dispatchedAt`) and re-fires anything left stuck (reconciliation).

- [ ] **Step 1: Write the module** with:
  - `enqueueOutbox(tx, { userId, templateKey, payload })` — inserts a `notification_outbox` row using the passed Prisma transaction client (so it commits atomically with the state change).
  - `dispatchOutbox(limit?)` — selects undispatched rows oldest-first, enqueues each onto M1's `notification-send` queue via `enqueueNotification`, sets `dispatchedAt = now()`. Safe to call repeatedly.
  - `sweepOutbox()` — convenience wrapper for the reconciliation sweep; intended to be invoked best-effort right after each mutating route commits AND from a periodic tick (reuse any existing scheduled-tick mechanism, or a lightweight `setInterval` in the worker process). No new BullMQ queue is introduced.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @pantry/api typecheck
git add api/src/services/notifications/outbox.ts
git commit -m "feat(api): transactional notification outbox + dispatch sweep"
```

---

## Phase E — Synchronous reputation recompute

> There is NO `reputation-recalc` queue or worker. Reputation is recomputed inline in the same transaction that writes a rating. At this scale the aggregate is an indexed scan over `transaction_ratings(ratee_user_id)` and runs sub-millisecond, so the eventual-consistency window and the extra moving parts of a debounced worker buy nothing.

### Task E1: Synchronous, counterparty-weighted reputation recompute

**Files:**
- Create: `api/src/services/reputation/recompute.ts`

- [ ] **Step 1: Write the module** exporting `recomputeReputation(tx, userId)` that takes a Prisma transaction client and recomputes the user's averages + transaction count from `transaction_ratings` where `ratee_user_id = userId`.

  **Anti-farming weighting.** A naive `AVG(stars)` lets two colluding accounts farm a high average by completing many fake handoffs between the same pair. To dampen this, weight each rating by its counterparty so repeated ratings between the same pair contribute with diminishing weight. Concretely, group the user's received ratings by `raterUserId` (the counterparty) and by `raterRole`; within each counterparty take that counterparty's AVERAGE stars (so 50 ratings from one accomplice count as one data point, not fifty); then average those per-counterparty values to get `recipientRatingAvg` (from `giver`-role raters) and `giverRatingAvg` (from `recipient`-role raters). `transactionCount` counts DISTINCT counterparties, not raw rating rows. This makes a collusion ring's marginal benefit per extra fake transaction approach zero.

```ts
// api/src/services/reputation/recompute.ts
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Recompute a user's reputation from ratings RECEIVED, weighted by DISTINCT
 * counterparty so a colluding pair cannot farm an average by repeating
 * transactions. Runs inside the caller's transaction.
 */
export async function recomputeReputation(tx: Tx, userId: string): Promise<void> {
  // Per (counterparty, role) average — collapses many ratings from the same
  // counterparty into a single data point.
  const perCounterparty = await tx.transactionRating.groupBy({
    by: ['raterUserId', 'raterRole'],
    where: { rateeUserId: userId },
    _avg: { stars: true },
  });

  const recipientVals: number[] = []; // received from giver-role raters
  const giverVals: number[] = []; // received from recipient-role raters
  const counterparties = new Set<string>();
  for (const row of perCounterparty) {
    counterparties.add(row.raterUserId);
    const v = Number(row._avg.stars ?? 0);
    if (row.raterRole === 'giver') recipientVals.push(v);
    else if (row.raterRole === 'recipient') giverVals.push(v);
  }
  const mean = (xs: number[]): number | null =>
    xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

  await tx.user.update({
    where: { id: userId },
    data: {
      recipientRatingAvg: mean(recipientVals),
      giverRatingAvg: mean(giverVals),
      transactionCount: counterparties.size,
    },
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @pantry/api typecheck
git add api/src/services/reputation/recompute.ts
git commit -m "feat(api): synchronous counterparty-weighted reputation recompute"
```

---

### Task E2: Reputation recompute unit test

**Files:**
- Create: `api/tests/unit/reputation-recompute.test.ts`

> Integration-style with a transaction client (or a `prisma.$transaction` wrapper) since it touches the DB. Place wherever the suite runs DB-backed unit tests; mirror existing patterns.

- [ ] **Step 1: Write the test.** Seed a user who RECEIVED ratings: (a) one 5★ from a single distinct counterparty as a recipient → `recipientRatingAvg=5.00`, `transactionCount=1`; (b) farming guard: 50 ratings of 5★ from the SAME counterparty still yield `transactionCount=1` and `recipientRatingAvg=5.00` (one data point, not fifty); (c) two distinct counterparties rating 5★ and 3★ → `recipientRatingAvg=4.00`, `transactionCount=2`; (d) giver-role vs recipient-role rows populate `giverRatingAvg` / `recipientRatingAvg` independently.

- [ ] **Step 2: Run, verify PASS. Commit.**

```bash
git add api/tests/unit/reputation-recompute.test.ts
git commit -m "test(api): synchronous reputation recompute incl. anti-farming weighting"
```

---

## Phase F — Giveaway HTTP routes

### Task F1: GET /v1/giveaways (feed) — failing test → implementation

**Files:**
- Create: `api/tests/integration/giveaways-feed.test.ts`
- Create: `api/src/routes/giveaways/list-feed.ts`, `api/src/routes/giveaways/index.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write the failing test.** Cases: default `status=open` returns only open giveaways, ordered `createdAt DESC`, cursor-paginated; cancelled/completed excluded by default; `?status=completed` filters; `claimCount` is populated; an invalid `status` → 400. **Country-scoping cases:** a giveaway created in country `A` (giver's `users.country='A'`) is ABSENT from the feed of a viewer whose `users.country='B'`, and PRESENT for a viewer whose `users.country='A'`. **No-country fallback:** a viewer with `users.country=null` sees giveaways from all countries (global view, not empty); and a giveaway whose own `country` is null appears for every viewer regardless of the viewer's country. The `country` field is present on each returned giveaway.

- [ ] **Step 2: Verify FAIL** (404, route not mounted).

- [ ] **Step 3: Implement `list-feed.ts`** — parse `giveawayListQuerySchema`; build the `where` from `{ status }` plus the country filter described below; `prisma.giveaway.findMany({ where, orderBy: [{ createdAt: 'desc' }], take: limit+1, cursor })` with a `_count.claims` include for `claimCount`; map via `toApiGiveaway`. Public read (no auth required); hydrate `myClaim` only when `req.user` is present.

  **Country scoping + fallback.** Resolve the viewer's `users.country` when `req.user` is present (from `req.user.country` if the auth plugin exposes it, else select it from the user row). Then:
  - Viewer has a country `C` → `where.OR = [{ country: C }, { country: null }]` so the feed shows giveaways pinned to the viewer's country plus globally-visible (null-country) giveaways. (Equivalently `where.country = { in: [C, null] }`.)
  - Viewer has no country (null), or the request is unauthenticated → **global fallback:** apply NO country filter; return giveaways across all countries rather than an empty list. This is the chosen no-country fallback.

  The `(country, status, created_at desc)` index serves the country-scoped query.

- [ ] **Step 4: Mount `giveawaysRoutes` under `/v1` in `server.ts`.** Verify PASS, commit.

```bash
git commit -m "feat(api): GET /v1/giveaways feed with status filter + cursor"
```

---

### Task F2: POST /v1/giveaways (create, idempotent) + GET /v1/giveaways/:id

**Files:**
- Create: `api/tests/integration/giveaways-create.test.ts`
- Create: `api/src/routes/giveaways/create.ts`, `api/src/routes/giveaways/get.ts`
- Modify: `api/src/routes/giveaways/index.ts`

- [ ] **Step 1: Write failing tests.** Create: 201 with `status='open'`; requires auth (401); requires `Idempotency-Key` (400); optional `productId`/`recordId` validated to exist and (for `recordId`) be owned by the caller, else 404/403; body length validation (400). Get: 200 with `giver` projection + `claimCount`; `myClaim` populated for an authenticated claimer; 404 for unknown id.

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement `create.ts`** — `onRequest: [app.requireAuth]`, `config: { idempotent: 'required' }`; apply a per-route rate limit (see below); validate optional `recordId` belongs to `req.user`; `prisma.giveaway.create` with `giverUserId = req.user.id`, `status='open'`, and `country` stamped from the giver's `users.country` (ISO-3166 alpha-2 — read from `req.user.country` if the auth plugin exposes it, else select it from the user row; null when the giver has no country, in which case the giveaway is globally visible per Task F1); return 201 `toApiGiveaway`. Implement `get.ts` — public read with optional `myClaim` hydration.

  **Rate limit:** cap giveaway creation to **10 per user per hour** (config constant `GIVEAWAY_CREATE_RATE = { max: 10, windowSec: 3600 }`), keyed on `req.user.id`. Use the same rate-limiting mechanism the codebase already uses (e.g. `@fastify/rate-limit` per-route `config.rateLimit`, or a Redis token bucket if that is the established pattern); over-limit → 429 `rate_limited`. Add a test that the 11th create within the window returns 429 (covered in Task F8's `giveaways-rate-limit.test.ts`).

- [ ] **Step 4: Register both routes, verify PASS, commit.**

```bash
git commit -m "feat(api): POST /v1/giveaways (idempotent) and GET /v1/giveaways/:id"
```

---

### Task F3: PATCH /v1/giveaways/:id + POST /v1/giveaways/:id/cancel (owner)

**Files:**
- Create: `api/tests/integration/giveaways-update-cancel.test.ts`
- Create: `api/src/routes/giveaways/update.ts`, `api/src/routes/giveaways/cancel.ts`
- Modify: `api/src/routes/giveaways/index.ts`

- [ ] **Step 1: Write failing tests.** Patch: owner edits title/description/location/photo while `status='open'` → 200; non-owner → 403; editing a non-open giveaway → 409 (`giveaway_not_open`); unknown id → 404. Cancel: owner cancels an `open` or `claimed` giveaway → 200 with `status='cancelled'`; transition validated via `assertTransition`; cancelling a `completed`/`cancelled` one → 409 (`giveaway_invalid_transition`); non-owner → 403.

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement.** `update.ts` guards owner + `status==='open'`. `cancel.ts` loads the row, calls `assertTransition(status, 'cancelled')`, sets `status='cancelled'` (no recipient notifications required for cancel in this scope).

- [ ] **Step 4: Register, verify PASS, commit.**

```bash
git commit -m "feat(api): PATCH and cancel for own giveaways with transition guard"
```

---

### Task F4: POST + GET /v1/giveaways/:id/claims

**Files:**
- Create: `api/tests/integration/giveaways-claims.test.ts`
- Create: `api/src/routes/giveaways/claims.ts`
- Modify: `api/src/routes/giveaways/index.ts`

- [ ] **Step 1: Write failing tests.** POST claim (claimer; idempotent): 201 with `status='requested'`; requires auth + `Idempotency-Key`; the giver cannot claim their own giveaway → 403; a second claim by the same user → 409 (`claim_already_exists`, the `@@unique` guard); claiming a non-`open` giveaway → 409 (`giveaway_not_open`); a `notifyNewClaim` push is enqueued to the giver. **Pickup-note privacy:** GET claims (giver only) returns each claim's `claimer` projection but `pickupNote: null` for every NON-selected claim — the giver does NOT see free-text notes before selecting; the selected claim's note IS returned. A claimer reading their own claim (via `myClaim`) always sees their own note. A non-giver → 403.

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement `claims.ts`** — POST: `onRequest: [app.requireAuth]`, `config: { idempotent: 'required' }`; apply a per-route rate limit to blunt claim-flooding (config `CLAIM_RATE = { max: 20, windowSec: 3600 }` keyed on `req.user.id`; over-limit → 429 `rate_limited`); load giveaway, reject if `status!=='open'` or `giverUserId===req.user.id`; `prisma.giveawayClaim.create`; enqueue `notifyNewClaim`; map unique-violation to 409 `claim_already_exists`. GET: require caller is the giver; list claims ordered `createdAt ASC` with `claimer` include, mapping each through `toApiClaim(c, { revealNote: c.status === 'selected' })` so unselected notes are withheld.

- [ ] **Step 4: Register, verify PASS, commit.**

```bash
git commit -m "feat(api): claim create (idempotent) + giver claim list"
```

---

### Task F5: Two-phase handoff — select (giver) → hand-off (giver) → confirm-received (recipient)

**Files:**
- Create: `api/tests/integration/giveaways-select-handoff-complete.test.ts`
- Create: `api/src/routes/giveaways/select.ts`, `api/src/routes/giveaways/hand-off.ts`, `api/src/routes/giveaways/confirm-received.ts`
- Modify: `api/src/routes/giveaways/index.ts`

> Completion is NOT giver-unilateral. The giver selects a recipient, then marks the item handed off; the RECIPIENT must confirm receipt before the giveaway reaches `completed` and ratings unlock. This stops a giver from single-handedly forcing a "completed" transaction the recipient never received. Every push is written to the notification outbox in the SAME transaction as the state change (Task D3), so a crash after commit can't drop it.

- [ ] **Step 1: Write failing tests.**
  - **Select** (`{ claimId }`; giver only): `open → claimed`; marks the chosen claim `selected` and ALL other `requested` claims `rejected` in one `$transaction`; writes `notifySelected` (recipient) + `notifyRejected` (each rejected claimer) to the outbox in-txn; selected recipient is now derivable from the `status='selected'` claim (no `selectedClaimId` column). Non-giver → 403; selecting on a non-`open` giveaway → 409; unknown/other-giveaway `claimId` → 404 (`claim_not_found`).
  - **Hand-off** (giver only): `claimed → handed_off`, sets `handedOffAt`; writes `notifyHandedOff` to the recipient in-txn; calling on a non-`claimed` giveaway → 409 (`handoff_not_allowed`); non-giver → 403.
  - **Confirm-received** (selected recipient only): `handed_off → completed`, sets `confirmedAt` + `completedAt`; writes `notifyCompleted` + `notifyRatePrompt` to BOTH parties in-txn; calling on a non-`handed_off` giveaway → 409 (`confirm_not_allowed`); anyone who is not the selected recipient → 403.
  - **Auto-expiry:** a `claimed` giveaway whose `claimExpiresAt` has passed transitions back to `open` (re-opening the rejected claims is out of scope; document that the giver re-selects). Test the expiry helper directly (`expireStaleClaims()` flips eligible rows and is idempotent).

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement** with `assertTransition` and a single `prisma.$transaction(async (tx) => {...})` per route that performs the row update(s) AND `enqueueOutbox(tx, ...)` together. After commit, best-effort call `dispatchOutbox()` (the reconciliation sweep guarantees delivery even if that call is skipped). `select.ts` also sets `claimExpiresAt = now() + window` so the giveaway can auto-expire if the handoff stalls. Add an `expireStaleClaims()` helper (used by the outbox/periodic tick) that flips `claimed` rows past `claimExpiresAt` back to `open`.

- [ ] **Step 4: Register, verify PASS, commit.**

```bash
git commit -m "feat(api): two-phase handoff (select, hand-off, confirm-received) with outbox notifications"
```

---

### Task F6: POST /v1/giveaways/:id/ratings (mutual, role inferred)

**Files:**
- Create: `api/tests/integration/giveaways-ratings.test.ts`
- Create: `api/src/routes/giveaways/ratings.ts`
- Modify: `api/src/routes/giveaways/index.ts`

- [ ] **Step 1: Write failing tests.** Both giver and recipient may rate ONCE after `status='completed'`: 201 with `raterRole` inferred (`giver` rates recipient, `recipient` rates giver); rating before completion → 409 (`rating_not_ready`); a third party (neither giver nor selected recipient) → 403 (`rating_not_allowed`); a duplicate rating by the same rater → 409 (`rating_already_exists`, the `@@unique` guard); `Idempotency-Key` + auth required.
  - **Synchronous reputation:** after a successful rating, the ratee's `recipientRatingAvg`/`giverRatingAvg`/`transactionCount` are ALREADY updated on the SAME request (no worker, no delay) — assert the user row reflects the new rating immediately. The counterparty-weighting from Phase E applies.
  - **Blind ratings:** a submitted rating is NOT visible to the counterparty until both have rated or the reveal window closes. Assert: after rater A submits, A's stars/comment are hidden from B (rating reads return the counterparty's row only once `revealedAt` is set); once B also submits, BOTH ratings get `revealedAt` set (in the same transaction that writes the second rating) and become visible. If only one party rates before the window closes, that single rating reveals at window expiry.
  - **Rate limit:** a per-route cap (config `RATING_RATE = { max: 30, windowSec: 3600 }` keyed on `req.user.id`); over-limit → 429 `rate_limited`.

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement `ratings.ts`** — `onRequest: [app.requireAuth]`, `config: { idempotent: 'required' }`; apply the rating rate limit; load giveaway + its selected claim (to resolve `selectedRecipientId` from the `status='selected'` claim); require `status==='completed'` else 409 `rating_not_ready`; `inferRaterRole(...)` → 403 `rating_not_allowed` if null. In ONE `prisma.$transaction(async (tx) => {...})`: create the rating (map unique violation → 409 `rating_already_exists`); if the counterparty has now also rated, set `revealedAt = now()` on BOTH rows (mutual reveal); then call `recomputeReputation(tx, rateeUserId)` so the ratee's averages update atomically. Return 201 `toApiTransactionRating` (own row; counterparty's row stays hidden until revealed). A reveal-window sweep (reuse the outbox/periodic tick) reveals a lone rating once its window elapses.

- [ ] **Step 4: Register, verify PASS, commit.**

```bash
git commit -m "feat(api): blind mutual ratings with synchronous reputation recompute"
```

---

### Task F7: GET /v1/users/:id/reputation

**Files:**
- Create: `api/tests/integration/user-reputation.test.ts`
- Create: `api/src/routes/users/reputation.ts`
- Modify: `api/src/server.ts` (or the existing users-routes registrar)

- [ ] **Step 1: Write failing tests.** Returns `{ userId, giverRatingAvg, recipientRatingAvg, transactionCount }` for a user with ratings; nulls + `transactionCount: 0` for a fresh user; unknown user → 404. Public read.

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement** — load the user, 404 if missing, return `toApiReputation`.

- [ ] **Step 4: Register, verify PASS, commit.**

```bash
git commit -m "feat(api): GET /v1/users/:id/reputation"
```

---

### Task F8: Per-route rate-limit integration test

**Files:**
- Create: `api/tests/integration/giveaways-rate-limit.test.ts`

- [ ] **Step 1: Write tests** asserting the per-user caps return 429 `rate_limited` once exceeded: the 11th `POST /v1/giveaways` within the hour, the 21st `POST /v1/giveaways/:id/claims`, and the 31st `POST /v1/giveaways/:id/ratings`. Use the same time/clock or Redis-key reset the rest of the suite uses; reset limiter state in `beforeEach`. Assert in-limit requests still succeed.

- [ ] **Step 2: Verify FAIL, implement the limits in the respective routes (Tasks F2/F4/F6), verify PASS, commit.**

```bash
git commit -m "test(api): per-route rate limits on giveaway create, claim, rating"
```

---

## Phase G — Reputation end-to-end + reports

### Task G1: Rating → synchronous reputation end-to-end test

**Files:**
- Create: `api/tests/integration/giveaways-ratings.test.ts` (extend the Task F6 suite, or a focused case here)

- [ ] **Step 1: Write the test.** Drive the real HTTP flow: giver creates → recipient claims → giver selects → giver hands off → recipient confirms (`completed`) → both submit ratings (giver rates recipient 5, recipient rates giver 4). Assert that IMMEDIATELY after each rating POST returns 201, `GET /v1/users/:id/reputation` for the ratee already reflects it (recipient `recipientRatingAvg=5.00`, `transactionCount=1`; giver `giverRatingAvg=4.00`, `transactionCount=1`) — no worker, no polling, no delay. Also assert blind-rating: the first rater's row is hidden from the counterparty until the second rating reveals both.

- [ ] **Step 2: Run, verify PASS. Commit.**

```bash
git commit -m "test(api): rating drives synchronous reputation end-to-end"
```

---

### Task G2: Reports support for `giveaway` targets

**Files:**
- Create: `api/tests/integration/reports-giveaway.test.ts`
- Modify: `api/src/routes/reports/create.ts` (M2 — extend `targetExists`)
- Modify: `api/src/services/reports/repository.ts` (M2 — extend `maybeAutoHide`)

- [ ] **Step 1: Write failing tests.** `POST /v1/reports` with `targetType='giveaway'`: 201 for an existing giveaway; 404 (`report_target_not_found`) for an unknown giveaway id; `maybeAutoHide('giveaway', id)` cancels the giveaway (`status='cancelled'`) once `> 3` non-dismissed reports accrue, and is a no-op at exactly 3.

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement.** In `targetExists`, add a `giveaway` branch (`prisma.giveaway.findUnique`). In `maybeAutoHide`, add a `giveaway` branch: if the giveaway is in a non-terminal state (`open`, `claimed`, or `handed_off`), set `status='cancelled'` (the giveaway analogue of hiding); terminal states (`completed`, `cancelled`) are no-ops. Reuse the existing `> 3` literal threshold — no settings import.

- [ ] **Step 4: Verify PASS. Commit.**

```bash
git commit -m "feat(api): support giveaway reports + auto-cancel at threshold"
```

---

## Phase H — Mobile screens (online-only TanStack Query)

### Task H1: API hooks

**Files:**
- Create: `apps/mobile/src/api/giveaways.ts`, `apps/mobile/src/api/reputation.ts`

- [ ] **Step 1:** Add TanStack Query hooks over `apps/mobile/src/api/client.ts`: `useGiveawayFeed(status)`, `useGiveaway(id)`, `useMyGiveaways()`, `useMyClaims()`, `useGiveawayClaims(id)` (giver), and mutations `useCreateGiveaway`, `useClaimGiveaway`, `useSelectClaim`, `useHandOffGiveaway`, `useConfirmReceived`, `useRateTransaction`, `useReputation(userId)`. Feeds use `staleTime: 30_000`. Mutations send an `Idempotency-Key` (client UUID) and invalidate the relevant queries on success. NOT routed through the records offline write queue.

- [ ] **Step 2: Typecheck + commit.**

```bash
git commit -m "feat(mobile): giveaway + reputation TanStack Query hooks (online-only)"
```

---

### Task H2: Feed + detail screens

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/giveaways.tsx` (M0c placeholder → feed)
- Create: `apps/mobile/app/(app)/giveaway/[id].tsx`
- Create: `apps/mobile/src/features/giveaways/GiveawayCard.tsx`, `GiveawayStatusBadge.tsx`, `ClaimButton.tsx`
- Create: `apps/mobile/__tests__/GiveawayCard.test.tsx`, `apps/mobile/__tests__/ClaimButton.test.tsx`

- [ ] **Step 1: Write failing RNTL tests** for `GiveawayCard` (renders title, location, status badge, giver reputation) and `ClaimButton` (opens pickup-note sheet, calls the claim mutation, disabled when the caller is the giver or already claimed).

- [ ] **Step 2: Implement** the feed (FlatList over `useGiveawayFeed('open')`, pull-to-refresh, cursor pagination), the detail screen (title/description/photo/location, giver reputation, status; `ClaimButton` for non-givers when `status='open'`; status copy otherwise), and the components. Use `useTheme()` tokens; no hardcoded colors.

- [ ] **Step 3: Run RNTL, verify PASS. Commit.**

```bash
git commit -m "feat(mobile): giveaway feed + detail + claim button"
```

---

### Task H3: Create form (optional start-from-record)

**Files:**
- Create: `apps/mobile/app/(app)/giveaway/new.tsx`

- [ ] **Step 1: Implement** the create form: title, description, location, optional photo (reuse the `POST /v1/me/avatar` multipart upload pattern → `photoUrl`), and an optional "start from a pantry record" picker that prefills title/description from a `record` and stores `recordId`. On successful create, route to the new giveaway's detail. (The "offer to mark that record `discarded` on completion" prompt lives in Task H4, after completion.)

- [ ] **Step 2: Commit.**

```bash
git commit -m "feat(mobile): create giveaway form with optional pantry-record link"
```

---

### Task H4: Manage (giver) + mine (my giveaways / my claims) + rating screens

**Files:**
- Create: `apps/mobile/app/(app)/giveaway/[id]/manage.tsx`, `apps/mobile/app/(app)/giveaway/mine.tsx`, `apps/mobile/app/(app)/giveaway/[id]/rate.tsx`
- Create: `apps/mobile/src/features/giveaways/ClaimList.tsx`, `TransactionRatingForm.tsx`
- Create: `apps/mobile/__tests__/TransactionRatingForm.test.tsx`

- [ ] **Step 1: Write a failing RNTL test** for `TransactionRatingForm` (required 1–5 star input, optional comment, calls `useRateTransaction`).

- [ ] **Step 2: Implement.** `manage.tsx` (giver): `ClaimList` over `useGiveawayClaims(id)` with a Select action per claim. **Pickup-note privacy:** the list shows each claimant's name + reputation + claim time but NOT their free-text note before selection (the API returns `pickupNote: null` for unselected claims); the selected claim's note is shown after selection. Two-phase handoff: when `status='claimed'` show a "Mark handed off" action (`useHandOffGiveaway`); when `status='handed_off'` show waiting-for-recipient copy. The recipient (on their claim/detail view) sees a "Confirm received" action (`useConfirmReceived`) when `status='handed_off'`. On confirm/complete, if the giveaway has a linked `recordId`, prompt the giver to mark that record `discarded`. `mine.tsx`: two tabs — "My giveaways" (`useMyGiveaways`) and "My claims" (`useMyClaims`). `rate.tsx`: mutual rating via `TransactionRatingForm`, shown after completion for both parties; copy notes the rating stays hidden from the other party until they also rate (blind ratings).

- [ ] **Step 3: Run RNTL, verify PASS. Commit.**

```bash
git commit -m "feat(mobile): manage claims, my giveaways/claims, mutual rating screens"
```

---

### Task H5: Maestro E2E

**Files:**
- Create: `apps/mobile/.maestro/giveaway-flow.yaml`

- [ ] **Step 1: Write the flow** — giver creates a giveaway → second user claims with a note → giver selects that claim → giver marks handed off → recipient confirms received (`completed`) → both leave a rating. Assert the status badge updates through `claimed → handed_off → completed` and reputation reflects the rating immediately after rating.

- [ ] **Step 2: Run Maestro against the dev build, verify PASS. Commit.**

```bash
git commit -m "test(mobile): Maestro giveaway end-to-end flow"
```

---

## Phase I — Admin moderation

### Task I1: Giveaway moderation page + giveaway reports in the queue

**Files:**
- Create: `apps/admin/app/giveaways/page.tsx`, `apps/admin/app/giveaways/actions.ts`
- Create: `apps/admin/__tests__/giveaways-moderation.spec.ts`
- Modify: the existing admin report-queue rendering (M2) to render `targetType='giveaway'` rows with a link to the giveaway

- [ ] **Step 1: Write a failing Playwright spec** — an admin can list giveaways, open one, cancel it (audit-logged), and see giveaway-typed reports rendered in the existing report queue.

- [ ] **Step 2: Implement.** `page.tsx` lists giveaways via `serverAdminApi` (server component). `actions.ts` exposes cancel/hide server actions calling the API with CSRF protection and `writeAuditLog({ action: 'giveaway.cancel', targetId, ... })`. Extend the M2 report queue's generic target renderer to handle `giveaway` (label + deep link); auto-cancel already happens server-side via `maybeAutoHide`.

- [ ] **Step 3: Run Playwright, verify PASS. Commit.**

```bash
git commit -m "feat(admin): giveaway moderation page + giveaway reports in queue"
```

---

## Phase J — Final verification

Run the full suite from the repo root. All must pass — do not skip or quarantine failures.

- [ ] **API unit + integration:** `pnpm --filter @pantry/api test` — all green, including the new state-machine, ratings, reputation-recompute, feed, create, claims, select/hand-off/confirm, ratings, rate-limit, user-reputation, and reports-giveaway suites.
- [ ] **Shared typecheck:** `pnpm --filter @pantry/shared typecheck` — exit 0.
- [ ] **API typecheck + lint:** `pnpm --filter @pantry/api typecheck && pnpm --filter @pantry/api lint` — exit 0.
- [ ] **Migrations apply cleanly on a fresh DB:** drop + `prisma migrate deploy` + `prisma db seed` — no errors; both giveaway migrations apply (tables migration, then the SEPARATE `report_target_giveaway` enum migration); `ReportTargetType` includes `giveaway`; `transaction_ratings_stars_check` and the `giveaway_claims_one_selected` partial unique index present.
- [ ] **Mobile component tests:** `pnpm --filter @pantry/mobile test` — `GiveawayCard`, `ClaimButton`, `TransactionRatingForm` pass.
- [ ] **Mobile E2E:** `maestro test apps/mobile/.maestro/giveaway-flow.yaml` — passes against a dev build (full two-phase handoff).
- [ ] **Admin E2E:** `pnpm --filter @pantry/admin test:e2e` — giveaway moderation spec passes.
- [ ] **No reputation worker/queue:** grep confirms there is NO `reputation-recalc` queue, worker, or runner registration; reputation is recomputed only inside the ratings transaction.

---

## Self-review checklist

- [ ] Wire contract is camelCase everywhere; DB columns are snake_case via `@map`; all error `code` strings are snake_case.
- [ ] No `reputation-recalc` queue, worker, debounce sentinel, `getAllQueues()` entry, or `startWorkers()` registration exists. Reputation is recomputed SYNCHRONOUSLY inside the ratings transaction via `recomputeReputation(tx, rateeUserId)`.
- [ ] Reputation is farming-resistant: averages weight by DISTINCT counterparty (per-counterparty mean), and `transactionCount` counts distinct counterparties — repeated ratings between the same pair don't inflate it.
- [ ] Push notifications reuse M1's `notification-send` queue (no new push queue) and are durable: select/hand-off/confirm/complete pushes are written to `notification_outbox` in the SAME transaction as the state change, then dispatched by a sweep (crash-safe). Six template keys: `giveaway_new_claim`, `giveaway_selected`, `giveaway_rejected`, `giveaway_handed_off`, `giveaway_completed`, `giveaway_rate_prompt`.
- [ ] Two-phase handoff: completion is NOT giver-unilateral. States flow `open → claimed → handed_off → completed` (giver selects, giver hands off, recipient confirms); ratings unlock only at `completed`. A `claimed` giveaway auto-expires back to `open` after `claimExpiresAt`.
- [ ] State transitions are enforced server-side via `assertTransition`; multi-row select happens in one `$transaction`; outbox writes happen in-txn.
- [ ] Pickup-note privacy: the giver does NOT see other claimants' free-text `pickupNote` before selection (`toApiClaim` returns `null` for unselected notes); only the selected claim's note is revealed; a claimer always sees their own note.
- [ ] Ratings are blind: a rating's stars/comment are hidden from the counterparty until both rate (or the reveal window closes), gated by `revealedAt`.
- [ ] Per-route rate limits on `POST /v1/giveaways`, `POST /v1/giveaways/:id/claims`, `POST /v1/giveaways/:id/ratings`; over-limit → 429 `rate_limited`; covered by `giveaways-rate-limit.test.ts`.
- [ ] Single source of truth for the selected recipient: derived from the `status='selected'` claim (no `selectedClaimId` column); a partial unique index enforces at most one selected claim per giveaway.
- [ ] Feed is country-scoped: `giveaways.country` (nullable `char(2)`) is stamped at create from the giver's `users.country`; `GET /v1/giveaways` filters to the viewer's country (plus null-country/globally-visible giveaways), preserving the `status` filter + cursor pagination; the `(country, status, created_at desc)` index serves it; `country` is exposed on the API response. No-country fallback: a viewer with no `users.country` (or unauthenticated) gets the global feed, not an empty list. Covered by `giveaways-feed.test.ts` (country A absent from country B's feed; no-country fallback).
- [ ] The `withdrawn` claim status is removed (no withdraw flow in scope).
- [ ] The `ReportTargetType.giveaway` enum value is added in its OWN migration, separate from the tables migration and never referenced in the adding transaction.
- [ ] Create/claim/select/hand-off/confirm/rating POSTs are idempotent (`config: { idempotent: 'required' }`).
- [ ] Mobile giveaways are online-only TanStack Query — NOT routed through the M1 records offline write queue.
- [ ] `recordId` link is validated to be owned by the giver; the "mark record discarded" prompt is offered on completion only.
- [ ] Reports gained the `giveaway` target type; `maybeAutoHide` auto-cancels non-terminal giveaways at the same `> 3` literal threshold (no settings import).
- [ ] Mutual ratings are one-per-rater (`@@unique(giveawayId, raterUserId)`); `raterRole` is inferred server-side and never trusted from the client.
- [ ] No code comment, migration filename, or test name references plan/phase/finding labels.
- [ ] Reputation here is independent of M7 referral points; no points logic added.

---

## Handoff

When all phases are complete and the Final verification block is green:

1. Confirm the worktree is clean: `git status` shows no uncommitted changes.
2. Confirm the branch holds the full vertical (data → state machine → workers → routes → mobile → admin).
3. Use **superpowers:finishing-a-development-branch** to decide merge vs PR. Note for the reviewer: M6 adds four tables (`giveaways`, `giveaway_claims`, `transaction_ratings`, `notification_outbox`) + reputation columns to `users`, one enum value to `ReportTargetType` (in its own migration), NO new BullMQ queue/worker (reputation is recomputed synchronously in the ratings transaction), six push template keys delivered via M1's queue (state-machine pushes through a transactional outbox), and the `/v1/giveaways*` (feed, get, create, update, cancel, claims, select, hand-off, confirm-received, ratings) + `/v1/users/:id/reputation` endpoints. Key safety properties: two-phase handoff (giver select → giver hand-off → recipient confirm), pickup-note privacy, blind mutual ratings, counterparty-weighted (anti-farming) reputation, and per-route rate limits.
4. Docs impact: **minor** — note the new endpoints, the synchronous reputation recompute (no worker), and the notification outbox in `docs/system-architecture.md`; add the giveaway two-phase-handoff flow to `docs/codebase-summary.md`.
5. Downstream: M7 (referral rewards) is independent of this milestone; M8 (household sharing) is unaffected.
