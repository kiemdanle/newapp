# M7 — Referral Tracking (Passive) + App Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Requirement revision — 2026-06-08 (Expyrico → passive)

Canonical contract: `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` (2026-06-08 revision §2.14). **This revision reshapes M7 from "rewards" to PASSIVE tracking. Read it before the reward-era body below — where they conflict, this block wins.**

1. **No rewards/points/badges in v1.x.** Referral is **passive**: store the attribution and the activation flag only. **Do NOT implement** points (`points_ledger`, `points_balance`, `awardPoints`), the badge catalog/evaluator (`badges`, `user_badges`, `badges.ts`), the velocity cap, or any reward surface. Those phases are **deferred to V2** (kept in this file as the V2 design — clearly marked, not built in v1.x).
2. **Activation condition = referee adds 5 items.** A referral becomes **`activated`** when the referee's lifetime record count reaches **5** (not "email verified + first record"). Add `referrals.activated_at timestamptz` (null until then). The conversion hook M1 calls (`maybeActivateReferral(userId)`, wired in M1 Task G2) sets `activated_at` once the count hits 5 — and awards nothing.
3. **What v1.x M7 ships:** `users.referral_code` (unique, generated), the optional `referralCode` field on `POST /v1/auth/register` (attribution capture → `referrals` row + `users.referred_by_user_id`), the `maybeActivateReferral` activation check, `GET /v1/me/referral` (`{ code, shareUrl, activatedCount }`), the mobile Invite screen + native share sheet, best-effort deep-link code capture, and a light admin overview (attribution + activation counts + abuse signals). **No points/badge columns, endpoints, or UI.**
4. **Data-model delta:** keep `referrals` (+ `activated_at`) and the `users.referral_code` / `referred_by_user_id` columns. **Drop from v1.x:** `points_ledger`, `badges`, `user_badges`, `users.points_balance`. (Phases B-pure-badges, C, the points helper in D, and F3 points/badges routes are V2.)
5. **`GET /v1/me/points` and `GET /v1/badges` are deferred to V2** — do not build. `GET /v1/me/referrals` becomes `GET /v1/me/referral` returning `{ code, shareUrl, activatedCount }`.

> Phases below frequently say "award points / badges". Under this revision, treat every points/badge step as **V2-deferred** and implement only the code-generation, attribution, activation-flag, read, share, and admin-overview steps. A V2 milestone will re-enable the reward machinery (the schema is left intact in this file as its design).

---

**Goal (v1.x, passive):** Ship referral **attribution + activation tracking** with no rewards. New users sign up carrying a referral **code**: typed in manually, or pre-filled from a code captured from an inbound link (best-effort, post-install) — there is **no auto-deep-link install-attribution claim** (see Red Team Review fix 3). When a referred user reaches the activation milestone (**adds 5 items**, via the direct create path OR the offline-sync ingest path), the referral is marked `activated` — **no points or badges are awarded in v1.x** (deferred to V2). A native share sheet lets users invite friends over WhatsApp/Telegram/SMS/etc. with the referral code (plus the URL as plain text). Mobile gets an Invite screen showing the code + activation count; admin gets a light referrals overview with abuse flags (high-velocity + IP clustering).

**Architecture (v1.x):** One new Postgres table (`referrals`, including `activated_at`) plus two additive columns on `users` (`referral_code`, `referred_by_user_id` + FK self-relation), via a single Prisma migration. A pure-function `referral-code.ts` generator (short, URL-safe, collision-checked) with unit tests. A `referral-service.ts` exposing `maybeActivateReferral(userId)` — idempotent (one activation per referred user), called from both M1 record-persist paths. Attribution capture on `POST /v1/auth/register` (optional `referralCode`). Fastify routes: `GET /v1/me/referral`. Mobile: an Invite screen using the OS share sheet and the M0c `DeepLinkHandler` extended to best-effort capture an inbound `?code=`. Admin: a Server-Component overview page. **The points ledger, `awardPoints` helper, badge catalog + evaluator, and velocity cap described in the reward-era sections below are V2 — not built in v1.x.**

**Tech Stack:** Fastify 4, Prisma 5, Postgres 16, Redis 7 (idempotency plugin only — no new queue), Zod 3, Vitest 2 + Supertest 7 (API), Expo SDK + Expo Router + Zustand + TanStack Query + NativeWind + `expo-sharing` + `expo-secure-store` (mobile), React Native Testing Library 12 (component tests), Maestro (mobile E2E), Next.js 15 + Playwright (admin).

**Spec reference:** `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` §2.14 (referral tracking — passive) and §13 M7. Read before starting.

---

## Execution order — backend-first (2026-05-26)

This greenfield project is re-sequenced to build the **Backend + Admin** track in full first, then the **Mobile** track. This header only records execution order — phase numbering, contents, and order below are unchanged.

**Track A — Backend + Admin (build now):**
- Phase A — Data model
- Phase B — Referral code generator (pure)
- Phase C — Badge evaluator (pure)
- Phase D — Repository + conversion service
- Phase E — Register extension (attribution)
- Phase F — Conversion hook + read routes
- Phase G — Admin overview endpoint
- Phase I — Admin overview page
- Phase J — E2E (admin Playwright portion only, Task J2)
- Phase K — Final verification (run the API + admin portions with this track; mobile checks run with Track B)

**Track B — Mobile (DEFERRED):**
- Phase H — Mobile: deep-link capture + Invite screen
- Phase J — E2E (mobile Maestro portion, Task J1)

**Rule:** Do NOT implement Track B phases until the entire Backend + Admin track is complete and the Mobile track begins.

---

## Validation amendments — 2026-05-26

- **Referral points + badges are PERSONAL ONLY in v1.x.** A user's points balance and earned badges are displayed only on their OWN profile / referral screen (via the self-scoped `GET /v1/me/referrals`). There is **no public referral leaderboard** and no cross-user ranking in v1.x. The admin `GET /v1/admin/referrals/overview` endpoint is `app.requireAdmin`-gated abuse monitoring for human reviewers — it is NOT user-facing and is not a leaderboard. A future milestone may add a leaderboard purely additively (Handoff item 1); M7 ships none. (No leaderboard endpoint/screen existed in the plan; this records the scope decision explicitly.)

---

## Red Team Review — 2026-05-26

A review of an earlier draft surfaced four real gaps; all are now fixed in the plan below. Plain-language summary:

1. **Anti-abuse is no longer toothless.** The old plan claimed self-referral was "structurally impossible" — but that only stops a user referring *themselves*; one person with two accounts could still farm points and badges, and the admin flag only lit up for accounts with *zero* conversions (never for farmers). Fixes: (a) a **velocity cap** — at most **10 converted referrals per referrer per UTC day** (further conversions still mark the referral converted but award **no** points/badges and write a `velocity_capped` ledger note); (b) **IP/device clustering** signals surfaced on the admin overview (count of referred users sharing a signup IP); (c) the admin **abuseFlag now fires on clustering OR high-velocity conversions**, not only on zero-conversion accounts. The self-referral CHECK constraint stays as a backstop.

2. **Conversion now actually fires for offline-first users.** The old plan hooked conversion only on the direct `POST /v1/records/create` handler. But in an offline-first app the first record usually arrives via the **`POST /v1/records/sync`** batch path (a different handler), so conversion would silently never run for most real users. Fix: the conversion check is hooked on **both** the direct-create path **and** the sync-ingest path (the shared persistence point in `api/src/services/records/sync.ts`). We also reconciled the email-verified field name — the actual M0a/M0b column is **`emailVerifiedAt`** (a nullable timestamp); `makeUser({ emailVerified: true })` is just a factory option that sets it. And a **reconciliation sweep** (idempotent re-check) lets a pending referral that missed its trigger still convert later.

3. **App-share is scoped to a copyable CODE — no fake deep-link claim.** Auto-opening an `https` invite link from a WhatsApp/Telegram chat *before install* requires universal/app-link infrastructure (iOS AASA file, Android `assetlinks.json`, and a served web `/invite` page) that **no plan provisions**, and `publicWebBaseUrl` points at an unserved domain. Rather than provision all of that for v1.x, M7 **scopes the share to a copyable referral CODE** that the invited user types in at sign-up. The share message still includes the URL as plain text (harmless if tapped → falls back to manual code entry), but **nothing claims auto-deep-link install attribution**. Tests assert the real behavior (code captured/entered → attribution), not just that a URL string is present. Provisioning true universal links is a documented future addition (see Handoff).

4. **Points integrity is enforced by one helper + an invariant.** All point mutations now go through a single **`awardPoints(userId, delta, reason, refId, tx)`** helper that writes the `points_ledger` row **and** increments `points_balance` in the same transaction — no more ad-hoc dual writes that could drift. An invariant test asserts `sum(points_ledger.delta) == points_balance` for every user. We also **dropped the unused `PointsReason` values** (`referral_signup`, `badge_bonus`): M7 only ever writes `referral_converted` (plus a `velocity_capped` note), so the enum now reflects exactly what is written; other reasons are added later when a feature actually needs them.

**Prerequisites:** Per the backend-first execution order, prereqs split by track. Track A (backend phases A–G + admin phase I + final-verif K) does NOT depend on M0c — they touch only `api/`, `packages/shared`, and `apps/admin/`. M0c is required only when Track B (mobile phase H + Maestro J1) begins.

**Track A (backend + admin, build now) prerequisites:**

- **M0a** complete: shared package (`@expyrico/shared` Zod plumbing, `ERROR_CODES`, `AppError`, error-handler), config, db/redis singletons, auth plugin (`req.user`, `app.requireAuth`), users repository (`toApiUser`, camelCase), `issueAccessToken` → string, random/hashToken utils, test harness (`tests/helpers/setup.ts`, `tests/helpers/factories.ts` with `makeUser`).
- **M0b** complete: auth routes — in particular `POST /v1/auth/register` (`api/src/routes/auth/register.ts`, schema `registerSchema` in `@expyrico/shared`) and the email-verification-before-signin gate. **This plan EXTENDS `registerSchema` + the register handler to accept an optional `referralCode`** — the change is purely additive (the field is optional, absence keeps v1 behavior identical), so it does not break existing M0b tests.
- **M1** backend phases complete: `products`/`records` tables and **both** record-persist paths — the direct create path (`api/src/routes/records/create.ts`) AND the offline-sync ingest path (`api/src/services/records/sync.ts`, behind `POST /v1/records/sync`). M7 hooks the conversion check into **both** (the first record often arrives via sync in an offline-first app). Idempotency-Key Fastify plugin (`api/src/plugins/idempotency.ts`) available. BullMQ runner at `api/src/workers/runner.ts` exists but is **not** required here.
- **M3** complete: admin Next.js app — `serverAdminApi`/`browserAdminApi` (`apps/admin/src/lib/admin-api.ts`), `writeAuditLog({...})`, `app.requireAdmin`, the M0d/M3 admin page-stub conventions. M7 adds one admin overview page + its backing admin endpoints.

**Track B (mobile, deferred) — additional prerequisite:**

- **M0c** complete: mobile shell — auth-gated `(app)` tabs, profile/settings screen, API client (`apps/mobile/src/api/client.ts`), TanStack Query provider, secure-store-backed session, `useTheme()` + theme system (4 themes), and the **`DeepLinkHandler`** (handles `expyrico://` links + Expo Linking). M7 REUSES `DeepLinkHandler` to capture an inbound referral code on first launch (before sign-up) and persist it to expo-secure-store.

**Out of scope for M7 (handled elsewhere / deferred):**

- **Real-money rewards / cash payouts / payments** — referral rewards are in-app points + badges only. No Stripe/Polar/payment integration.
- **Multi-tier referral chains** — only the **direct** referrer of a converted user earns. No grandparent / cascading payouts.
- **Points spending / marketplace / redemption** — points are reputation/cosmetic only in v1.x. Forward note: a future milestone may surface a referral leaderboard and gate cosmetic profile flair on `points_balance` / badges; M7 ships only the balance, ledger, and badge catalog so that future feature is purely additive (no schema reversal).
- **Public referral leaderboard** — points and badges are shown on the user's own profile only (no cross-user ranking) in v1.x.
- **Fraud / abuse ML** — anti-abuse in M7 is rule-based only (reject self-referral, one conversion per referred user, code must belong to an active user, plus a per-referrer-per-day **velocity cap** on rewarded conversions). The admin overview merely *surfaces* abuse signals — high-velocity (`velocity_capped` notes), signup-IP clustering, and mass-zero-conversion — for a human; it does not auto-act.
- **Universal / app-link install attribution** — M7 does NOT provision iOS AASA, Android `assetlinks.json`, or a served `/invite` web page, so tapping an `https` invite link pre-install does not auto-open the app or auto-attach a code. Referral attribution is via a **copyable code** entered at sign-up (with best-effort post-install deep-link capture for already-installed users). Provisioning true universal links is deferred (Handoff item 6).
- **Deals / giveaways awarding points** — points are referral-driven only. The M5 deals and M6 giveaway features do not write to `points_ledger`.

---

## File map

This plan creates the following files. Files in **bold** carry the load-bearing logic.

```
expyrico/
├── packages/shared/src/schemas/
│   └── referral.ts                              ← Zod referral / points / badge schemas (NEW)
├── packages/shared/src/schemas/auth.ts          ← MODIFY: registerSchema += optional referralCode
├── packages/shared/src/schemas/error.ts         ← MODIFY: + referral error codes
├── packages/shared/src/index.ts                 ← MODIFY: re-export referral schemas
├── api/
│   ├── prisma/schema.prisma                     ← MODIFY: +Referral, PointsLedger, Badge, UserBadge; User += referralCode/pointsBalance/referredByUserId
│   ├── prisma/migrations/<ts>_referrals_points_badges/
│   │   └── migration.sql                        ← generated (+ CHECK + partial-unique tweaks)
│   ├── prisma/seed.ts                            ← MODIFY: seed badge catalog
│   ├── src/
│   │   ├── **services/referrals/referral-code.ts**  ← short URL-safe code generator + collision check
│   │   ├── **services/referrals/badges.ts**         ← pure threshold evaluator (newly-earned badge keys)
│   │   ├── **services/referrals/referral-service.ts**← convertReferral() — single idempotent transaction
│   │   ├── services/referrals/repository.ts         ← toApiReferralSummary / toApiPointsEntry / toApiBadge
│   │   ├── routes/referrals/
│   │   │   ├── index.ts                          ← mount + register sub-routes
│   │   │   ├── my-referrals.ts                    ← GET /v1/me/referrals
│   │   │   ├── my-points.ts                       ← GET /v1/me/points (paginated ledger)
│   │   │   └── badges-catalog.ts                  ← GET /v1/badges
│   │   ├── routes/auth/register.ts               ← MODIFY: attach referralCode (pending referral + referred_by)
│   │   ├── routes/records/create.ts              ← MODIFY (M1 path): fire convertReferral() after direct create
│   │   ├── services/records/sync.ts              ← MODIFY (M1 path): fire convertReferral() after sync ingest
│   │   ├── routes/admin/referrals.ts             ← GET /v1/admin/referrals/overview (admin)
│   │   └── server.ts                             ← MODIFY: mount referrals routes
│   └── tests/
│       ├── unit/referral-code.test.ts
│       ├── unit/badges.test.ts
│       ├── integration/register-referral.test.ts
│       ├── integration/referral-conversion.test.ts
│       ├── integration/my-referrals.test.ts
│       ├── integration/my-points.test.ts
│       ├── integration/badges-catalog.test.ts
│       ├── integration/admin-referrals-overview.test.ts
│       └── helpers/factories.ts                  ← MODIFY: + makeReferral, seedBadges helper
└── apps/mobile/
    ├── src/api/referrals.ts                      ← TanStack hooks (referrals, points, badges)
    ├── src/referral/pendingReferralStore.ts      ← capture/persist inbound code (expo-secure-store)
    ├── src/features/referral/
    │   ├── InviteShareButton.tsx                 ← opens native share sheet w/ invite message + deep link
    │   ├── ReferralCodeCard.tsx                  ← shows code + share URL
    │   └── PointsBadgesPanel.tsx                 ← points balance + earned/locked badges
    ├── src/components/DeepLinkHandler.tsx        ← MODIFY (M0c): capture ?code= on first launch
    ├── app/(app)/invite.tsx                      ← NEW Invite screen
    ├── app/(app)/(tabs)/settings.tsx             ← MODIFY (M0c): mount PointsBadgesPanel + link to Invite
    ├── app/(auth)/register.tsx                   ← MODIFY (M0c): pre-fill captured referralCode
    └── __tests__/
        ├── InviteShareButton.test.tsx
        ├── ReferralCodeCard.test.tsx
        └── PointsBadgesPanel.test.tsx
└── apps/mobile/.maestro/
    └── invite-flow.yaml                          ← E2E (open Invite, tap Share)
└── apps/admin/
    ├── src/app/(dashboard)/referrals/page.tsx    ← MODIFY (M0d stub): referrals/points overview
    └── e2e/referrals-overview.spec.ts            ← Playwright
```

---

## Conventions (carried over from M0a/M0b)

- TDD: write failing test, watch it fail, implement minimal code, watch it pass, commit. No batched commits across features.
- Conventional commits, scopes `shared`, `api`, `mobile`, `admin`. No plan/finding references in code comments, test names, or migration filenames — explain the *why* (invariant, race, anti-abuse rule), not the origin.
- Wire contract is **camelCase**; DB columns are **snake_case** via Prisma `@map`; error `code` strings are **snake_case**.
- Every API route imports its Zod schema from `@expyrico/shared`.
- Every API route handler uses `req.user`, `app.requireAuth`, and `req.id` for logging. No `console.log` — use `req.log` (API) or the mobile logger.
- Points are an **append-only ledger**: `users.points_balance` is the denormalized running sum of `points_ledger.delta`. The ONLY code path that mutates points is the `awardPoints(userId, delta, reason, refId, tx)` helper, which writes the ledger row and increments the balance in the same transaction. Invariant (test-enforced): for every user, `sum(points_ledger.delta) == points_balance`.
- Conversion (`convertReferral`) is **idempotent** — guarded by the `referrals.referred_user_id` unique constraint and a `status='pending' → 'converted'` conditional update; re-invocation is a no-op. Points/badges are additionally gated by a **per-referrer-per-UTC-day velocity cap**; conversions past the cap still mark the referral converted but award no points/badges (and write a zero-delta `velocity_capped` ledger note).
- Admin mutating actions are audit-logged via `writeAuditLog({...})`. The overview is read-only, so it logs only a view event if M3 convention requires (otherwise no log).

---

## Phase A — Data model

### Task A1: Add Referral, PointsLedger, Badge, UserBadge + User columns to Prisma schema

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Add the new enums** above the existing enum blocks

```prisma
enum ReferralStatus {
  pending
  converted

  @@map("referral_status")
}

enum PointsReason {
  referral_converted
  velocity_capped

  @@map("points_reason")
}
```

> **Decision D1b (enum scope):** the enum carries only what M7 actually writes — `referral_converted` (the +50 award) and `velocity_capped` (a zero-delta audit note when a conversion is suppressed by the per-day cap). Earlier drafts pre-declared `referral_signup` / `badge_bonus` that nothing wrote; they are dropped to keep the enum truthful and are added later when a feature needs them (a Prisma enum addition is a clean non-breaking migration).

> **Decision D1:** `ReferralStatus` has exactly two values — `pending` (referred user signed up, milestone not yet reached) and `converted` (milestone reached, points awarded). There is no `expired` value in v1.x.

- [ ] **Step 2: Add the new models at the bottom of the file**

```prisma
model Referral {
  id             String         @id @default(uuid()) @db.Uuid
  referrerUserId String         @map("referrer_user_id") @db.Uuid
  referredUserId String         @unique @map("referred_user_id") @db.Uuid
  referralCode   String         @map("referral_code")
  status         ReferralStatus @default(pending)
  // Signup IP of the referred user, captured at register time. Used only for the
  // admin clustering heuristic (how many referred users share one IP). Nullable.
  signupIp       String?        @map("signup_ip")
  convertedAt    DateTime?      @map("converted_at")
  createdAt      DateTime       @default(now()) @map("created_at")

  referrer User @relation("ReferralsMade", fields: [referrerUserId], references: [id], onDelete: Cascade)
  referred User @relation("ReferralReceived", fields: [referredUserId], references: [id], onDelete: Cascade)

  @@index([referrerUserId, status])
  @@index([referrerUserId, signupIp])
  @@map("referrals")
}

model PointsLedger {
  id        String       @id @default(uuid()) @db.Uuid
  userId    String       @map("user_id") @db.Uuid
  delta     Int
  reason    PointsReason
  refId     String?      @map("ref_id") @db.Uuid
  createdAt DateTime     @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@map("points_ledger")
}

model Badge {
  id          String      @id @default(uuid()) @db.Uuid
  key         String      @unique
  name        String
  description String
  threshold   Int
  createdAt   DateTime    @default(now()) @map("created_at")

  userBadges UserBadge[]

  @@map("badges")
}

model UserBadge {
  id       String   @id @default(uuid()) @db.Uuid
  userId   String   @map("user_id") @db.Uuid
  badgeId  String   @map("badge_id") @db.Uuid
  earnedAt DateTime @default(now()) @map("earned_at")

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge Badge @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([userId, badgeId])
  @@index([userId])
  @@map("user_badges")
}
```

- [ ] **Step 3: Add the new columns + relations to the existing User model**

Inside `model User`, append:

```prisma
  referralCode      String?      @unique @map("referral_code")
  pointsBalance     Int          @default(0) @map("points_balance")
  referredByUserId  String?      @map("referred_by_user_id") @db.Uuid

  referredBy        User?        @relation("UserReferredBy", fields: [referredByUserId], references: [id])
  referredUsers     User[]       @relation("UserReferredBy")
  referralsMade     Referral[]   @relation("ReferralsMade")
  referralReceived  Referral?    @relation("ReferralReceived")
  pointsLedger      PointsLedger[]
  badges            UserBadge[]
```

> **Decision D2:** `users.referral_code` is nullable + unique. It is `NULL` for legacy users and gets backfilled lazily (Task D1 assigns one on first `GET /v1/me/referrals` if absent), so the M7 migration does not need to backfill 10k rows up front. New signups get a code in the register handler (Task F2).

- [ ] **Step 4: Format and validate**

```bash
pnpm --filter @expyrico/api exec prisma format
pnpm --filter @expyrico/api exec prisma validate
```
Expected: `The schema at api/prisma/schema.prisma is valid 🚀`.

- [ ] **Step 5: Commit**

```bash
git add api/prisma/schema.prisma
git commit -m "feat(api): add referral, points ledger, badge models + user columns"
```

---

### Task A2: Generate the migration

**Files:**
- Create: `api/prisma/migrations/<ts>_referrals_points_badges/migration.sql` (generated)

- [ ] **Step 1: Create the migration**

```bash
pnpm --filter @expyrico/api exec prisma migrate dev --name referrals_points_badges
```
Expected: prints `Applying migration ...` and `✔ Generated Prisma Client`.

- [ ] **Step 1b: Append a self-referral guard CHECK constraint**

Prisma cannot emit a cross-column CHECK from the schema, so add to the generated `migration.sql` (a referral row must never point its referrer at its own referred user):

```sql
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_no_self_referral_check"
  CHECK ("referrer_user_id" <> "referred_user_id");
```

Re-run `prisma migrate dev` if the file was edited after generation.

- [ ] **Step 2: Verify the tables and indexes**

```bash
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "\dt"
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "\di referrals*"
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "\d users" | grep -E "referral_code|points_balance|referred_by_user_id"
```
Expected: `referrals`, `points_ledger`, `badges`, `user_badges` listed; `referrals_referred_user_id_key` unique index present; the three new `users` columns present.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/migrations
git commit -m "feat(api): migrate referrals, points_ledger, badges, user_badges"
```

---

### Task A3: Seed the badge catalog

**Files:**
- Modify: `api/prisma/seed.ts`

- [ ] **Step 1: Add a badge-catalog upsert block inside `main()`**

Append (do not delete existing seeds — e.g. the M2 system user):

```ts
const BADGE_CATALOG = [
  { key: 'first_referral', name: 'First Referral', description: 'Referred your first friend.', threshold: 1 },
  { key: 'bronze',         name: 'Bronze Referrer', description: 'Converted 5 referrals.',     threshold: 5 },
  { key: 'silver',         name: 'Silver Referrer', description: 'Converted 10 referrals.',    threshold: 10 },
  { key: 'gold',           name: 'Gold Referrer',   description: 'Converted 25 referrals.',    threshold: 25 },
] as const;

for (const b of BADGE_CATALOG) {
  await prisma.badge.upsert({
    where: { key: b.key },
    update: { name: b.name, description: b.description, threshold: b.threshold },
    create: b,
  });
}
// eslint-disable-next-line no-console
console.log('Seeded badge catalog', BADGE_CATALOG.length);
```

> **Decision D3:** Badge thresholds are evaluated against **converted referral count** (not points balance). first_referral=1, bronze=5, silver=10, gold=25. Points (e.g. +50 per conversion) are a separate spendable-later resource; badges are the milestone markers.

- [ ] **Step 2: Run the seed**

```bash
pnpm --filter @expyrico/api exec prisma db seed
```
Expected: `Seeded badge catalog 4`.

- [ ] **Step 3: Verify it landed**

```bash
psql postgresql://expyrico:expyrico@localhost:5432/expyrico -c "SELECT key, threshold FROM badges ORDER BY threshold;"
```
Expected: four rows, thresholds 1, 5, 10, 25.

- [ ] **Step 4: Commit**

```bash
git add api/prisma/seed.ts
git commit -m "feat(api): seed referral badge catalog"
```

---

### Task A4: Extend test harness — truncate new tables, reseed badges

**Files:**
- Modify: `api/tests/helpers/setup.ts`

- [ ] **Step 1: Add the new tables to the truncate list**

Find the `const tables = [` array. Add these entries above `'users'` (keep existing entries in place):

```ts
  'user_badges',
  'points_ledger',
  'referrals',
  // badges is a static catalog — re-seeded in beforeEach, not truncated to users-level
```

> Truncate `referrals`, `points_ledger`, `user_badges` per test. Do NOT truncate `badges` to empty without re-seeding — the catalog must exist for conversion tests.

- [ ] **Step 2: Re-seed the badge catalog inside `beforeEach`** (after `flushdb()`)

```ts
  // Re-seed the badge catalog (always present in production via prisma db seed)
  const BADGE_CATALOG = [
    { key: 'first_referral', name: 'First Referral', description: 'Referred your first friend.', threshold: 1 },
    { key: 'bronze',         name: 'Bronze Referrer', description: 'Converted 5 referrals.',     threshold: 5 },
    { key: 'silver',         name: 'Silver Referrer', description: 'Converted 10 referrals.',    threshold: 10 },
    { key: 'gold',           name: 'Gold Referrer',   description: 'Converted 25 referrals.',    threshold: 25 },
  ];
  for (const b of BADGE_CATALOG) {
    await prisma.badge.upsert({ where: { key: b.key }, update: {}, create: b });
  }
```

(If `badges` is in the truncate list at all, ensure it is truncated BEFORE this upsert; simplest is to leave it out of the list and rely on the upsert.)

- [ ] **Step 3: Run the existing suite to confirm nothing broke**

```bash
pnpm --filter @expyrico/api test
```
Expected: all previously-passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add api/tests/helpers/setup.ts
git commit -m "test(api): truncate referral tables and reseed badge catalog per test"
```

---

### Task A5: Test factories for referrals + a seedBadges helper

**Files:**
- Modify: `api/tests/helpers/factories.ts`

- [ ] **Step 1: Append factories**

```ts
import type { Referral } from '@prisma/client';

export async function makeReferral(overrides: {
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  status?: 'pending' | 'converted';
}): Promise<Referral> {
  const prisma = getPrisma();
  return prisma.referral.create({
    data: {
      referrerUserId: overrides.referrerUserId,
      referredUserId: overrides.referredUserId,
      referralCode: overrides.referralCode,
      status: overrides.status ?? 'pending',
    },
  });
}

/** Returns a user that already has a referral_code set (skips lazy backfill). */
export async function makeUserWithCode(code: string): Promise<{ id: string; referralCode: string }> {
  const prisma = getPrisma();
  const u = await makeUser({ emailVerified: true });
  await prisma.user.update({ where: { id: u.id }, data: { referralCode: code } });
  return { id: u.id, referralCode: code };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/tests/helpers/factories.ts
git commit -m "test(api): add makeReferral and makeUserWithCode factories"
```

---

### Task A6: Zod schemas + error codes in `@expyrico/shared`

**Files:**
- Create: `packages/shared/src/schemas/referral.ts`
- Modify: `packages/shared/src/schemas/auth.ts`
- Modify: `packages/shared/src/schemas/error.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/referral.ts`**

```ts
import { z } from 'zod';

export const referralStatusSchema = z.enum(['pending', 'converted']);
export type ReferralStatus = z.infer<typeof referralStatusSchema>;

export const pointsReasonSchema = z.enum(['referral_converted', 'velocity_capped']);
export type PointsReason = z.infer<typeof pointsReasonSchema>;

/** Codes are short + URL-safe: A–Z, 2–9 (no 0/O/1/I to avoid confusion), length 8. */
export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{8}$/, 'invalid referral code');
export type ReferralCode = z.infer<typeof referralCodeSchema>;

export const badgeSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  threshold: z.number().int().positive(),
  /** Present on /v1/me/referrals: whether the caller has earned it. */
  earned: z.boolean().optional(),
  earnedAt: z.string().datetime().nullable().optional(),
});
export type Badge = z.infer<typeof badgeSchema>;

export const referredUserSchema = z.object({
  referredUserId: z.string().uuid(),
  firstName: z.string(),
  status: referralStatusSchema,
  convertedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ReferredUser = z.infer<typeof referredUserSchema>;

/** GET /v1/me/referrals */
export const referralSummarySchema = z.object({
  referralCode: referralCodeSchema,
  shareUrl: z.string().url(),
  pointsBalance: z.number().int().nonnegative(),
  referredCount: z.number().int().nonnegative(),
  convertedCount: z.number().int().nonnegative(),
  referred: z.array(referredUserSchema),
  badges: z.array(badgeSchema),
});
export type ReferralSummary = z.infer<typeof referralSummarySchema>;

/** GET /v1/me/points */
export const pointsEntrySchema = z.object({
  id: z.string().uuid(),
  delta: z.number().int(),
  reason: pointsReasonSchema,
  refId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type PointsEntry = z.infer<typeof pointsEntrySchema>;

export const pointsPageSchema = z.object({
  balance: z.number().int().nonnegative(),
  items: z.array(pointsEntrySchema),
  cursor: z.string().nullable(),
});
export type PointsPage = z.infer<typeof pointsPageSchema>;

export const pointsListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PointsListQuery = z.infer<typeof pointsListQuerySchema>;

/** GET /v1/admin/referrals/overview */
export const adminReferralRowSchema = z.object({
  referrerUserId: z.string().uuid(),
  firstName: z.string(),
  email: z.string(),
  referralCode: referralCodeSchema.nullable(),
  referredCount: z.number().int().nonnegative(),
  convertedCount: z.number().int().nonnegative(),
  pointsBalance: z.number().int().nonnegative(),
  /** Largest number of this referrer's referred users sharing one signup IP (clustering signal). */
  maxSameIpReferred: z.number().int().nonnegative(),
  /** True on any UTC day where this referrer hit/exceeded the velocity cap of converted referrals. */
  hitVelocityCap: z.boolean(),
  /**
   * Heuristic flag for human review. Fires when ANY of:
   *  - clustering: maxSameIpReferred >= ABUSE_MIN_SAME_IP, OR
   *  - high velocity: hitVelocityCap true, OR
   *  - mass-zero-conversion: referredCount >= ABUSE_MIN_REFERRALS && convertedCount === 0.
   */
  abuseFlag: z.boolean(),
});
export type AdminReferralRow = z.infer<typeof adminReferralRowSchema>;

export const adminReferralOverviewSchema = z.object({
  totalReferrals: z.number().int().nonnegative(),
  totalConverted: z.number().int().nonnegative(),
  topReferrers: z.array(adminReferralRowSchema),
});
export type AdminReferralOverview = z.infer<typeof adminReferralOverviewSchema>;
```

- [ ] **Step 2: Extend `registerSchema` in `packages/shared/src/schemas/auth.ts`** (ADDITIVE, OPTIONAL)

Find the `registerSchema` object. Add ONE optional field; do not change any existing field:

```ts
  // Optional referral attribution — absent for organic signups (v1 behavior unchanged).
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z2-9]{8}$/)
    .optional(),
```

> The field is `.optional()`, so every existing M0b register test (which sends no `referralCode`) still passes unchanged.

- [ ] **Step 3: Add new error codes to `packages/shared/src/schemas/error.ts`**

Inside the `ERROR_CODES` object, add before the closing brace:

```ts
  REFERRAL_CODE_NOT_FOUND: 'referral_code_not_found',
  SELF_REFERRAL_NOT_ALLOWED: 'self_referral_not_allowed',
  REFERRAL_ALREADY_ATTRIBUTED: 'referral_already_attributed',
```

- [ ] **Step 4: Re-export from `packages/shared/src/index.ts`**

```ts
export * from './schemas/referral.js';
```

- [ ] **Step 5: Typecheck the shared package**

```bash
pnpm --filter @expyrico/shared typecheck
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): referral/points/badge schemas + optional register referralCode"
```

---

## Phase B — Referral code generator (pure)

### Task B1: Write code-generator unit tests (failing)

**Files:**
- Create: `api/tests/unit/referral-code.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/referral-code.test.ts
import { describe, expect, it } from 'vitest';
import { generateReferralCode } from '../../src/services/referrals/referral-code.js';

describe('generateReferralCode', () => {
  it('produces an 8-char URL-safe code', () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('excludes ambiguous characters 0, O, 1, I', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateReferralCode()).not.toMatch(/[01OI]/);
    }
  });

  it('is overwhelmingly unique across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) seen.add(generateReferralCode());
    // 32^8 keyspace — 1000 draws should virtually never collide
    expect(seen.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/referral-code.test.ts
```
Expected: FAIL — module not found.

---

### Task B2: Implement the generator + DB-collision wrapper

**Files:**
- Create: `api/src/services/referrals/referral-code.ts`

- [ ] **Step 1: Write `api/src/services/referrals/referral-code.ts`**

```ts
import { randomInt } from 'node:crypto';
import { getPrisma } from '../../db.js';

// 32-char alphabet: A–Z minus O/I, plus 2–9 (no 0/1) — avoids visual ambiguity.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateReferralCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a code guaranteed not to collide with an existing user's referral_code.
 * Retries on the astronomically unlikely collision (32^8 keyspace).
 */
export async function generateUniqueReferralCode(maxAttempts = 5): Promise<string> {
  const prisma = getPrisma();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateReferralCode();
    const existing = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error('failed to generate a unique referral code');
}
```

- [ ] **Step 2: Run, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/referral-code.test.ts
```
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/referrals/referral-code.ts api/tests/unit/referral-code.test.ts
git commit -m "feat(api): referral code generator with collision-safe wrapper"
```

---

## Phase C — Badge evaluator (pure)

### Task C1: Write badge-evaluator unit tests (failing)

**Files:**
- Create: `api/tests/unit/badges.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/badges.test.ts
import { describe, expect, it } from 'vitest';
import { newlyEarnedBadgeKeys } from '../../src/services/referrals/badges.js';

const CATALOG = [
  { key: 'first_referral', threshold: 1 },
  { key: 'bronze', threshold: 5 },
  { key: 'silver', threshold: 10 },
  { key: 'gold', threshold: 25 },
];

describe('newlyEarnedBadgeKeys', () => {
  it('awards first_referral on the 1st conversion', () => {
    expect(newlyEarnedBadgeKeys(CATALOG, 0, 1, [])).toEqual(['first_referral']);
  });

  it('awards nothing when no threshold is freshly crossed', () => {
    expect(newlyEarnedBadgeKeys(CATALOG, 1, 2, ['first_referral'])).toEqual([]);
  });

  it('awards bronze when crossing 5', () => {
    expect(newlyEarnedBadgeKeys(CATALOG, 4, 5, ['first_referral'])).toEqual(['bronze']);
  });

  it('never re-awards an already-earned badge', () => {
    expect(newlyEarnedBadgeKeys(CATALOG, 9, 10, ['first_referral', 'bronze', 'silver'])).toEqual([]);
  });

  it('can award multiple at once on a big jump', () => {
    expect(newlyEarnedBadgeKeys(CATALOG, 0, 10, [])).toEqual(['first_referral', 'bronze', 'silver']);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/badges.test.ts
```
Expected: FAIL — module not found.

---

### Task C2: Implement the evaluator

**Files:**
- Create: `api/src/services/referrals/badges.ts`

- [ ] **Step 1: Write `api/src/services/referrals/badges.ts`**

```ts
export interface BadgeThreshold {
  key: string;
  threshold: number;
}

/**
 * Given the catalog, the previous converted-referral count, the new count, and
 * the keys the user already holds, return the keys to award now (threshold
 * freshly reached and not already earned). Deterministic + order-stable.
 */
export function newlyEarnedBadgeKeys(
  catalog: BadgeThreshold[],
  previousCount: number,
  newCount: number,
  alreadyEarned: string[],
): string[] {
  const earned = new Set(alreadyEarned);
  return catalog
    .filter((b) => b.threshold > previousCount && b.threshold <= newCount && !earned.has(b.key))
    .sort((a, b) => a.threshold - b.threshold)
    .map((b) => b.key);
}
```

- [ ] **Step 2: Run, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/unit/badges.test.ts
```
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/referrals/badges.ts api/tests/unit/badges.test.ts
git commit -m "feat(api): badge threshold evaluator with unit tests"
```

---

## Phase D — Repository + conversion service

### Task D1: Repository helpers + lazy code backfill

**Files:**
- Create: `api/src/services/referrals/repository.ts`

- [ ] **Step 1: Write `api/src/services/referrals/repository.ts`**

```ts
import type { Badge, PointsLedger, Prisma, Referral, User } from '@prisma/client';
import type { Badge as ApiBadge, PointsEntry, PointsReason, ReferredUser } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { getConfig } from '../../config.js';
import { generateUniqueReferralCode } from './referral-code.js';

/**
 * The ONLY path that mutates points. Writes a ledger row AND increments the
 * denormalized balance inside the SAME transaction, so the invariant
 * `sum(points_ledger.delta) == points_balance` always holds. `delta` may be 0
 * (e.g. a `velocity_capped` audit note) or — in a future spend feature — negative.
 * MUST be called with a transaction client `tx` so it composes atomically with
 * the surrounding conversion.
 */
export async function awardPoints(
  tx: Prisma.TransactionClient,
  userId: string,
  delta: number,
  reason: PointsReason,
  refId: string | null,
): Promise<void> {
  await tx.pointsLedger.create({ data: { userId, delta, reason, refId } });
  if (delta !== 0) {
    await tx.user.update({ where: { id: userId }, data: { pointsBalance: { increment: delta } } });
  }
}

/** Build the public invite URL for a code. NOTE: this is a plain-text share URL, NOT an
 *  auto-deep-link — v1.x does not provision universal/app links (see Red Team Review fix 3);
 *  the invited user copies/enters the CODE at sign-up. */
export function shareUrlForCode(code: string): string {
  const base = getConfig().publicWebBaseUrl.replace(/\/$/, '');
  return `${base}/invite?code=${code}`;
}

/** Returns the user's referral_code, generating + persisting one if absent (lazy backfill). */
export async function ensureReferralCode(userId: string): Promise<string> {
  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (user.referralCode) return user.referralCode;
  const code = await generateUniqueReferralCode();
  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  return code;
}

export function toApiPointsEntry(e: PointsLedger): PointsEntry {
  return {
    id: e.id,
    delta: e.delta,
    reason: e.reason,
    refId: e.refId,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toApiBadge(b: Badge, earnedAt?: Date | null): ApiBadge {
  return {
    id: b.id,
    key: b.key,
    name: b.name,
    description: b.description,
    threshold: b.threshold,
    earned: earnedAt != null,
    earnedAt: earnedAt ? earnedAt.toISOString() : null,
  };
}

export function toApiReferredUser(
  r: Referral & { referred: Pick<User, 'firstName'> },
): ReferredUser {
  return {
    referredUserId: r.referredUserId,
    firstName: r.referred.firstName,
    status: r.status,
    convertedAt: r.convertedAt ? r.convertedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}
```

> **Decision D4:** `getConfig().publicWebBaseUrl` is the base for the **plain-text** share URL (e.g. `https://expyrico.app`). If M0a's config does not already expose it, add it there as part of this task (env `PUBLIC_WEB_BASE_URL`, default `https://expyrico.app`). The share message includes both the **code** (the load-bearing part — the invited user enters it at sign-up) and this URL as readable text. **This is NOT a universal/app link** — v1.x provisions no AASA / `assetlinks.json` / served `/invite` page (see Red Team Review fix 3), so the URL does not auto-open the app or auto-attribute installs; attribution comes from the code. If the domain is unserved a tapped link simply 404s in a browser, which is acceptable for v1.x. Provisioning real universal links is a documented future addition (Handoff item 6).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @expyrico/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/referrals/repository.ts
git commit -m "feat(api): referral repository helpers + lazy code backfill"
```

---

### Task D2: Conversion service — failing integration test

**Files:**
- Create: `api/tests/integration/referral-conversion.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/referral-conversion.test.ts
import { describe, expect, it } from 'vitest';
import { convertReferral, POINTS_PER_CONVERSION, MAX_CONVERSIONS_PER_DAY } from '../../src/services/referrals/referral-service.js';
import { getPrisma } from '../../src/db.js';
import { makeUser, makeReferral, makeUserWithCode } from '../helpers/factories.js';

describe('convertReferral', () => {
  it('awards points, writes ledger, marks converted, and grants first_referral', async () => {
    const prisma = getPrisma();
    const referrer = await makeUserWithCode('REFERAA2');
    const referred = await makeUser({ emailVerified: true });
    await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'REFERAA2' });

    await convertReferral(referred.id);

    const r = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(r.status).toBe('converted');
    const u = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    expect(u.pointsBalance).toBe(POINTS_PER_CONVERSION);
    const ledger = await prisma.pointsLedger.findMany({ where: { userId: referrer.id } });
    expect(ledger.length).toBe(1);
    expect(ledger[0]!.reason).toBe('referral_converted');
    const badges = await prisma.userBadge.findMany({ where: { userId: referrer.id } });
    expect(badges.length).toBe(1); // first_referral
  });

  it('is idempotent — second call is a no-op (no double points)', async () => {
    const prisma = getPrisma();
    const referrer = await makeUserWithCode('REFERAA3');
    const referred = await makeUser({ emailVerified: true });
    await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'REFERAA3' });

    await convertReferral(referred.id);
    await convertReferral(referred.id);

    const u = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    expect(u.pointsBalance).toBe(POINTS_PER_CONVERSION);
    const ledger = await prisma.pointsLedger.findMany({ where: { userId: referrer.id } });
    expect(ledger.length).toBe(1);
  });

  it('does nothing when the user has no pending referral', async () => {
    const referred = await makeUser({ emailVerified: true });
    await expect(convertReferral(referred.id)).resolves.toBeUndefined();
  });

  it('awards bronze on the 5th conversion', async () => {
    const prisma = getPrisma();
    const referrer = await makeUserWithCode('BRONZEA2');
    // Pre-seed 4 already-converted referrals + 4 badge rows would be heavy;
    // instead drive 5 fresh conversions through distinct referred users.
    for (let i = 0; i < 5; i += 1) {
      const referred = await makeUser({ emailVerified: true });
      await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'BRONZEA2' });
      await convertReferral(referred.id);
    }
    const badges = await prisma.userBadge.findMany({
      where: { userId: referrer.id },
      include: { badge: true },
    });
    const keys = badges.map((b) => b.badge.key).sort();
    expect(keys).toContain('first_referral');
    expect(keys).toContain('bronze');
  });

  it('stops awarding points once the per-day velocity cap is exceeded', async () => {
    const prisma = getPrisma();
    const referrer = await makeUserWithCode('VELOCAP2');
    // Drive MAX_CONVERSIONS_PER_DAY + 2 conversions in one day.
    for (let i = 0; i < MAX_CONVERSIONS_PER_DAY + 2; i += 1) {
      const referred = await makeUser({ emailVerified: true });
      await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'VELOCAP2' });
      await convertReferral(referred.id);
    }
    const u = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    // Only the first MAX_CONVERSIONS_PER_DAY conversions earn points.
    expect(u.pointsBalance).toBe(MAX_CONVERSIONS_PER_DAY * POINTS_PER_CONVERSION);
    // All referrals still flipped to converted (so they never retry).
    const converted = await prisma.referral.count({ where: { referrerUserId: referrer.id, status: 'converted' } });
    expect(converted).toBe(MAX_CONVERSIONS_PER_DAY + 2);
    // The 2 over-cap conversions wrote zero-delta velocity_capped notes.
    const capped = await prisma.pointsLedger.count({ where: { userId: referrer.id, reason: 'velocity_capped' } });
    expect(capped).toBe(2);
  });

  it('keeps the points invariant: sum(ledger.delta) === pointsBalance', async () => {
    const prisma = getPrisma();
    const referrer = await makeUserWithCode('INVARI23');
    for (let i = 0; i < 3; i += 1) {
      const referred = await makeUser({ emailVerified: true });
      await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'INVARI23' });
      await convertReferral(referred.id);
    }
    const agg = await prisma.pointsLedger.aggregate({ where: { userId: referrer.id }, _sum: { delta: true } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    expect(u.pointsBalance).toBe(agg._sum.delta ?? 0);
  });
});
```

> The velocity + invariant tests import `MAX_CONVERSIONS_PER_DAY` and `POINTS_PER_CONVERSION` from `referral-service.ts` (add them to the import at the top of this test file).

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/referral-conversion.test.ts
```
Expected: FAIL — module not found.

---

### Task D3: Implement the conversion service

**Files:**
- Create: `api/src/services/referrals/referral-service.ts`

- [ ] **Step 1: Write `api/src/services/referrals/referral-service.ts`**

```ts
import type { Prisma } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { newlyEarnedBadgeKeys } from './badges.js';
import { awardPoints } from './repository.js';

/** Points awarded to the referrer per converted referral. */
export const POINTS_PER_CONVERSION = 50;

/**
 * Velocity cap: maximum CONVERTED referrals per referrer per UTC day that earn
 * points + badges. Beyond this, the referral still flips to `converted` (so it
 * never re-fires), but NO points/badges are awarded and a zero-delta
 * `velocity_capped` ledger note is written for the admin audit trail. This is
 * the primary defense against one human farming many fake accounts in a burst.
 */
export const MAX_CONVERSIONS_PER_DAY = 10;

/** Start of the current UTC day, used for the per-day velocity window. */
function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Fire a referral conversion for `referredUserId`, if a pending referral exists.
 *
 * One transaction: mark the referral converted (conditional update on status,
 * which makes the whole operation idempotent). Then, UNLESS the referrer already
 * hit the per-UTC-day velocity cap, award POINTS_PER_CONVERSION via the shared
 * `awardPoints` helper (ledger + balance, atomic) and evaluate/grant any
 * newly-earned badges against the referrer's converted-referral count. When the
 * cap is hit, write a zero-delta `velocity_capped` note instead and skip badges.
 *
 * Safe to call from BOTH the direct first-record path AND the offline-sync
 * ingest path on every record persisted — it short-circuits if there's nothing
 * pending, so only the user's first qualifying record does real work.
 */
export async function convertReferral(referredUserId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const referral = await tx.referral.findUnique({ where: { referredUserId } });
    if (!referral || referral.status !== 'pending') return; // idempotent no-op

    const updated = await tx.referral.updateMany({
      where: { id: referral.id, status: 'pending' },
      data: { status: 'converted', convertedAt: new Date() },
    });
    if (updated.count === 0) return; // lost the race — another tx converted it

    const referrerId = referral.referrerUserId;

    // Velocity cap: how many of this referrer's referrals already converted TODAY
    // (UTC), excluding the row we just flipped. If at/over the cap, suppress reward.
    const convertedToday = await tx.referral.count({
      where: {
        referrerUserId: referrerId,
        status: 'converted',
        convertedAt: { gte: startOfUtcDay() },
        id: { not: referral.id },
      },
    });
    if (convertedToday >= MAX_CONVERSIONS_PER_DAY) {
      // Audit note only — no points, no badges. Keeps the invariant intact (delta 0).
      await awardPoints(tx, referrerId, 0, 'velocity_capped', referral.id);
      return;
    }

    // Award points via the single helper (ledger row + balance, same tx).
    await awardPoints(tx, referrerId, POINTS_PER_CONVERSION, 'referral_converted', referral.id);

    // Evaluate badges against converted-referral count.
    const convertedCount = await tx.referral.count({
      where: { referrerUserId: referrerId, status: 'converted' },
    });
    const catalog = await tx.badge.findMany({ select: { id: true, key: true, threshold: true } });
    const owned = await tx.userBadge.findMany({
      where: { userId: referrerId },
      include: { badge: { select: { key: true } } },
    });
    const ownedKeys = owned.map((b) => b.badge.key);
    const toAward = newlyEarnedBadgeKeys(
      catalog.map((c) => ({ key: c.key, threshold: c.threshold })),
      convertedCount - 1,
      convertedCount,
      ownedKeys,
    );
    if (toAward.length > 0) {
      const byKey = new Map(catalog.map((c) => [c.key, c.id]));
      const rows: Prisma.UserBadgeCreateManyInput[] = toAward.map((key) => ({
        userId: referrerId,
        badgeId: byKey.get(key)!,
      }));
      await tx.userBadge.createMany({ data: rows, skipDuplicates: true });
    }
  });
}
```

> **Decision D5 (conversion trigger):** conversion fires when the referred user has **(a) verified their email AND (b) created their first pantry record**. Email-verified is a hard signup gate (M0b), so by the time a record can be created the email is already verified — therefore the single observable trigger is **"first record created"**. Critically, a record can be created via TWO handlers: the direct `POST /v1/records/create` AND the offline-sync batch `POST /v1/records/sync` (the shared persistence point is `api/src/services/records/sync.ts`). In an offline-first app the FIRST record very often arrives via sync, so conversion is hooked on **both** (Task F4). `convertReferral` short-circuits if no pending referral exists, so calling it on every persisted record is cheap and correct (only the first one with a pending referral does work).
>
> **Decision D6 (velocity cap value):** `MAX_CONVERSIONS_PER_DAY = 10`. A genuine power-user inviting friends rarely converts >10/day; a farmer scripting fake accounts trivially would. Conversions past the cap still flip to `converted` (so they never retry and never double-spend a later day's budget) but earn nothing. The value is a single constant, made admin-configurable later alongside `POINTS_PER_CONVERSION` (Handoff item 4).

- [ ] **Step 2: Run, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/referral-conversion.test.ts
```
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/referrals/referral-service.ts api/tests/integration/referral-conversion.test.ts
git commit -m "feat(api): idempotent referral conversion (points + badges) service"
```

---

## Phase E — Register extension (attribution)

### Task E1: register-with-referralCode — failing test

**Files:**
- Create: `api/tests/integration/register-referral.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/register-referral.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { makeUserWithCode } from '../helpers/factories.js';

const base = { password: 'sup3rSecret!', firstName: 'Bee', lastName: 'Cee' };

describe('POST /v1/auth/register with referralCode', () => {
  it('attaches a pending referral + sets referred_by when code is valid', async () => {
    const app = await buildServer();
    const referrer = await makeUserWithCode('VALIDAA2');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...base, email: 'new1@example.com', referralCode: 'VALIDAA2' },
    });
    expect(res.statusCode).toBe(201);
    const prisma = getPrisma();
    const created = await prisma.user.findUniqueOrThrow({ where: { email: 'new1@example.com' } });
    expect(created.referredByUserId).toBe(referrer.id);
    const ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: created.id } });
    expect(ref.status).toBe('pending');
    expect(ref.referrerUserId).toBe(referrer.id);
    await app.close();
  });

  it('rejects an unknown code with 404 referral_code_not_found', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...base, email: 'new2@example.com', referralCode: 'NOPEAA22' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('referral_code_not_found');
    await app.close();
  });

  it('registers normally (201) when no referralCode is supplied — v1 behavior', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...base, email: 'organic@example.com' },
    });
    expect(res.statusCode).toBe(201);
    const created = await getPrisma().user.findUniqueOrThrow({ where: { email: 'organic@example.com' } });
    expect(created.referredByUserId).toBeNull();
    await app.close();
  });

  it('assigns the new user their own referral_code at signup', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...base, email: 'haz-code@example.com' },
    });
    const created = await getPrisma().user.findUniqueOrThrow({ where: { email: 'haz-code@example.com' } });
    expect(created.referralCode).toMatch(/^[A-Z2-9]{8}$/);
    await app.close();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/register-referral.test.ts
```
Expected: FAIL — `referred_by` unset / no referral row / no own code.

---

### Task E2: Extend the register handler

**Files:**
- Modify: `api/src/routes/auth/register.ts`

- [ ] **Step 1: Resolve the referral code + assign the new user's own code, inside the existing transaction**

In `register.ts`, after `const input = registerSchema.parse(req.body);` resolve any incoming code:

```ts
import { ERROR_CODES } from '@expyrico/shared';
import { generateUniqueReferralCode } from '../../services/referrals/referral-code.js';

// ... inside the handler, before the user-create transaction:
let referrer: { id: string } | null = null;
if (input.referralCode) {
  referrer = await prisma.user.findFirst({
    where: { referralCode: input.referralCode, status: 'active' },
    select: { id: true },
  });
  if (!referrer) {
    throw new AppError({
      status: 404,
      code: ERROR_CODES.REFERRAL_CODE_NOT_FOUND,
      title: 'Referral code not found',
    });
  }
}

const ownCode = await generateUniqueReferralCode();
```

Then in the `prisma.$transaction` user create, add `referralCode: ownCode` and, when `referrer` is set, `referredByUserId: referrer.id`, and create the pending referral row in the SAME transaction:

```ts
const u = await tx.user.create({
  data: {
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    country,
    referralCode: ownCode,
    referredByUserId: referrer?.id ?? null,
  },
});
await tx.authCredential.create({ data: { userId: u.id, type: 'password' } });
if (referrer) {
  await tx.referral.create({
    data: {
      referrerUserId: referrer.id,
      referredUserId: u.id,
      referralCode: input.referralCode!,
      status: 'pending',
      // Captured for the admin clustering heuristic only. `req.ip` honors
      // Fastify's trustProxy config; null if unavailable.
      signupIp: req.ip ?? null,
    },
  });
}
return u;
```

> **Anti-abuse (layered — not relying on "self-referral is impossible"):** the `referrals_no_self_referral_check` DB constraint and the unknown-code 404 only stop the *trivial* cases. They do NOT stop one human farming with multiple accounts. The real defenses are: (1) the **per-day velocity cap** in `convertReferral` (Task D3) which caps how many conversions earn rewards in a burst; (2) **signup-IP clustering** captured here and surfaced on the admin overview (Task G2); (3) the **broadened `abuseFlag`** that fires on clustering OR high-velocity OR mass-zero-conversion. The `referrals.referred_user_id` unique constraint still guarantees one referral per referred user, and conversion is idempotent.

- [ ] **Step 2: Run, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/register-referral.test.ts
```
Expected: 4 passed. Re-run the M0b register suite to confirm it still passes:

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/register.test.ts
```
Expected: all M0b register tests still pass.

- [ ] **Step 3: Commit**

```bash
git add api/src/routes/auth/register.ts
git commit -m "feat(api): attach referral on register + assign own referral code"
```

---

## Phase F — Conversion hook + read routes

### Task F1: GET /v1/me/referrals — failing test

**Files:**
- Create: `api/tests/integration/my-referrals.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/my-referrals.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeUser, makeUserWithCode, makeReferral } from '../helpers/factories.js';

async function authHeader(userId: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user' })}` };
}

describe('GET /v1/me/referrals', () => {
  it('returns code, share URL, referred list, points, and badge catalog with earned flags', async () => {
    const app = await buildServer();
    const referrer = await makeUserWithCode('SUMMARY2');
    const referred = await makeUser({ emailVerified: true });
    await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'SUMMARY2', status: 'converted' });

    const res = await app.inject({ method: 'GET', url: '/v1/me/referrals', headers: await authHeader(referrer.id) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.referralCode).toBe('SUMMARY2');
    expect(body.shareUrl).toContain('/invite?code=SUMMARY2');
    expect(body.referredCount).toBe(1);
    expect(body.convertedCount).toBe(1);
    expect(Array.isArray(body.badges)).toBe(true);
    expect(body.badges.length).toBe(4); // full catalog with earned flags
    await app.close();
  });

  it('lazily assigns a referral code to a user that has none', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true }); // no code
    const res = await app.inject({ method: 'GET', url: '/v1/me/referrals', headers: await authHeader(u.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json().referralCode).toMatch(/^[A-Z2-9]{8}$/);
    await app.close();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** (route not mounted).

---

### Task F2: Implement the read routes

**Files:**
- Create: `api/src/routes/referrals/my-referrals.ts`
- Create: `api/src/routes/referrals/my-points.ts`
- Create: `api/src/routes/referrals/badges-catalog.ts`
- Create: `api/src/routes/referrals/index.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write `api/src/routes/referrals/my-referrals.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { referralSummarySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import {
  ensureReferralCode,
  shareUrlForCode,
  toApiBadge,
  toApiReferredUser,
} from '../../services/referrals/repository.js';
import { reconcilePendingReferral } from '../../services/referrals/referral-service.js';

export async function myReferralsRoute(app: FastifyInstance) {
  app.get('/me/referrals', { preHandler: app.requireAuth }, async (req) => {
    const userId = req.user.id;
    const prisma = getPrisma();
    const code = await ensureReferralCode(userId);

    // Self-heal a referral that may have missed its conversion trigger.
    try {
      await reconcilePendingReferral(userId);
    } catch (err) {
      req.log.error({ err, userId }, 'referral reconciliation failed');
    }

    const [user, referrals, catalog, owned] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { pointsBalance: true } }),
      prisma.referral.findMany({
        where: { referrerUserId: userId },
        include: { referred: { select: { firstName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.badge.findMany({ orderBy: { threshold: 'asc' } }),
      prisma.userBadge.findMany({ where: { userId } }),
    ]);

    const earnedAt = new Map(owned.map((b) => [b.badgeId, b.earnedAt]));
    return referralSummarySchema.parse({
      referralCode: code,
      shareUrl: shareUrlForCode(code),
      pointsBalance: user.pointsBalance,
      referredCount: referrals.length,
      convertedCount: referrals.filter((r) => r.status === 'converted').length,
      referred: referrals.map(toApiReferredUser),
      badges: catalog.map((b) => toApiBadge(b, earnedAt.get(b.id) ?? null)),
    });
  });
}
```

- [ ] **Step 2: Write `api/src/routes/referrals/my-points.ts`** (paginated ledger)

```ts
import type { FastifyInstance } from 'fastify';
import { pointsListQuerySchema, pointsPageSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiPointsEntry } from '../../services/referrals/repository.js';

export async function myPointsRoute(app: FastifyInstance) {
  app.get('/me/points', { preHandler: app.requireAuth }, async (req) => {
    const userId = req.user.id;
    const query = pointsListQuerySchema.parse(req.query);
    const prisma = getPrisma();

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const rows = await prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { pointsBalance: true } });

    return pointsPageSchema.parse({
      balance: user.pointsBalance,
      items: page.map(toApiPointsEntry),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    });
  });
}
```

- [ ] **Step 3: Write `api/src/routes/referrals/badges-catalog.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { badgeSchema } from '@expyrico/shared';
import { z } from 'zod';
import { getPrisma } from '../../db.js';
import { toApiBadge } from '../../services/referrals/repository.js';

export async function badgesCatalogRoute(app: FastifyInstance) {
  app.get('/badges', { preHandler: app.requireAuth }, async () => {
    const catalog = await getPrisma().badge.findMany({ orderBy: { threshold: 'asc' } });
    return z.array(badgeSchema).parse(catalog.map((b) => toApiBadge(b)));
  });
}
```

- [ ] **Step 4: Write `api/src/routes/referrals/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { myReferralsRoute } from './my-referrals.js';
import { myPointsRoute } from './my-points.js';
import { badgesCatalogRoute } from './badges-catalog.js';

export async function referralsRoutes(app: FastifyInstance) {
  await app.register(myReferralsRoute);
  await app.register(myPointsRoute);
  await app.register(badgesCatalogRoute);
}
```

- [ ] **Step 5: Mount in `api/src/server.ts`** (import + register with prefix `/v1`, after the existing route registrations)

```ts
import { referralsRoutes } from './routes/referrals/index.js';
// ...
await app.register(referralsRoutes, { prefix: '/v1' });
```

- [ ] **Step 6: Run the read-route tests, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/my-referrals.test.ts
```
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add api/src/routes/referrals api/src/server.ts
git commit -m "feat(api): GET /v1/me/referrals, /v1/me/points, /v1/badges"
```

---

### Task F3: GET /v1/me/points + GET /v1/badges — tests

**Files:**
- Create: `api/tests/integration/my-points.test.ts`
- Create: `api/tests/integration/badges-catalog.test.ts`

- [ ] **Step 1: Write `my-points.test.ts`** — assert: empty ledger returns `balance:0, items:[]`; after a conversion the referrer's ledger has one `referral_converted` entry of `delta:50` and `balance:50`; pagination respects `limit` + `cursor`.

```ts
// api/tests/integration/my-points.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { convertReferral } from '../../src/services/referrals/referral-service.js';
import { makeUser, makeUserWithCode, makeReferral } from '../helpers/factories.js';

async function authHeader(userId: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user' })}` };
}

describe('GET /v1/me/points', () => {
  it('returns an empty ledger for a fresh user', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const res = await app.inject({ method: 'GET', url: '/v1/me/points', headers: await authHeader(u.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ balance: 0, items: [], cursor: null });
    await app.close();
  });

  it('shows a +50 referral_converted entry after a conversion', async () => {
    const app = await buildServer();
    const referrer = await makeUserWithCode('POINTSA2');
    const referred = await makeUser({ emailVerified: true });
    await makeReferral({ referrerUserId: referrer.id, referredUserId: referred.id, referralCode: 'POINTSA2' });
    await convertReferral(referred.id);
    const res = await app.inject({ method: 'GET', url: '/v1/me/points', headers: await authHeader(referrer.id) });
    const body = res.json();
    expect(body.balance).toBe(50);
    expect(body.items[0]).toMatchObject({ delta: 50, reason: 'referral_converted' });
    await app.close();
  });
});
```

- [ ] **Step 2: Write `badges-catalog.test.ts`** — assert `GET /v1/badges` returns the 4 seeded badges sorted by threshold and requires auth (401 without token).

```ts
// api/tests/integration/badges-catalog.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeUser } from '../helpers/factories.js';

describe('GET /v1/badges', () => {
  it('returns the seeded catalog sorted by threshold', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/badges',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: u.id, role: 'user' })}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((b: { threshold: number }) => b.threshold)).toEqual([1, 5, 10, 25]);
    await app.close();
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/badges' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 3: Run, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/my-points.test.ts tests/integration/badges-catalog.test.ts
```
Expected: 2 + 2 passed.

- [ ] **Step 4: Commit**

```bash
git add api/tests/integration/my-points.test.ts api/tests/integration/badges-catalog.test.ts
git commit -m "test(api): points ledger and badge catalog read endpoints"
```

---

### Task F4: Wire the conversion hook into BOTH M1 record-persist paths

**Files:**
- Modify: `api/src/routes/records/create.ts` (M1 direct create path)
- Modify: `api/src/services/records/sync.ts` (M1 offline-sync ingest path)

> **Why both:** M1 persists records through TWO handlers — the direct `POST /v1/records/create` AND the offline-sync batch `POST /v1/records/sync` (which calls `syncRecords()` in `api/src/services/records/sync.ts`). In an offline-first app the FIRST record commonly arrives via sync, so hooking only `create` would mean conversion **never fires** for the typical user. Both paths must call `convertReferral`.

- [ ] **Step 1: Call `convertReferral` after a successful direct record create**

In `api/src/routes/records/create.ts`, AFTER the record row is committed (outside/after the create transaction so the conversion runs against committed state), add a best-effort call. The conversion is cheap and idempotent — it short-circuits unless the user has a pending referral and this is effectively their first qualifying record.

```ts
import { convertReferral } from '../../services/referrals/referral-service.js';

// ... after the record is created and the response is prepared:
try {
  await convertReferral(req.user.id);
} catch (err) {
  // Conversion is best-effort; never fail the record create because of it.
  req.log.error({ err, userId: req.user.id }, 'referral conversion failed');
}
```

- [ ] **Step 1b: Call `convertReferral` after the sync-ingest persists a record**

In `api/src/services/records/sync.ts`, after `syncRecords()` has committed the batch and at least one record was upserted for the user, call `convertReferral(userId)` once (the user id is the authenticated caller of `POST /v1/records/sync`). It is idempotent and short-circuits, so calling it on every successful sync is safe. Wrap it so a conversion error never fails the sync response:

```ts
import { convertReferral } from '../referrals/referral-service.js';

// inside/after syncRecords, once the batch is committed and a record was written:
try {
  await convertReferral(userId);
} catch (err) {
  log.error({ err, userId }, 'referral conversion failed (sync path)');
}
```

> Calling `convertReferral` on every record persist (either path) is intentional and safe: after the first conversion the referral is `converted`, so all subsequent calls short-circuit at the `status !== 'pending'` guard with a single indexed lookup. This avoids needing a "first record" sentinel column. The `userId` available inside `sync.ts` — pin it to whatever `syncRecords()` already receives as the authenticated user (adjust the arg name when wiring to match M1's actual `syncRecords` signature).

- [ ] **Step 2: Write end-to-end coverage via BOTH record paths** (add to `api/tests/integration/referral-conversion.test.ts`): create referrer (with code) → register referred with code → mark email verified → referred persists their first record. Cover the **direct create path** AND the **sync ingest path** — each must convert the referral and award 50 points.

> **Field-name reconciliation:** the actual M0a/M0b column is **`emailVerifiedAt`** (a nullable `DateTime`); `makeUser({ emailVerified: true })` is just a factory option that sets `emailVerifiedAt: new Date()` internally (verified in `api/tests/helpers/factories.ts` and `api/prisma/schema.prisma`). There is no `emailVerified` column. The e2e below sets `emailVerifiedAt` directly because it creates the user via the register route (not the factory). Use `emailVerifiedAt` for any direct DB write; use the `emailVerified: true` factory option when constructing via `makeUser`.

```ts
// add to api/tests/integration/referral-conversion.test.ts
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct } from '../helpers/factories.js';

it('converts via the real direct first-record path', async () => {
  const app = await buildServer();
  const referrer = await makeUserWithCode('E2ECODE2');
  // register referred user through the real route so register attribution runs
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: 'e2e-ref@example.com', password: 'sup3rSecret!', firstName: 'E', lastName: 'E', referralCode: 'E2ECODE2' },
  });
  const prisma = getPrisma();
  const referred = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-ref@example.com' } });
  await prisma.user.update({ where: { id: referred.id }, data: { emailVerifiedAt: new Date() } });
  const product = await makeProduct();
  const token = await issueAccessToken({ sub: referred.id, role: 'user' });
  await app.inject({
    method: 'POST',
    url: '/v1/records',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'rec-e2e-1' },
    payload: { productId: product.id, quantity: 1 },
  });
  const ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referred.id } });
  expect(ref.status).toBe('converted');
  const u = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
  expect(u.pointsBalance).toBe(50);
  await app.close();
});

it('converts via the offline-sync ingest path (first record arrives via /v1/records/sync)', async () => {
  const app = await buildServer();
  const referrer = await makeUserWithCode('SYNCODE2');
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: 'e2e-sync@example.com', password: 'sup3rSecret!', firstName: 'S', lastName: 'Y', referralCode: 'SYNCODE2' },
  });
  const prisma = getPrisma();
  const referred = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-sync@example.com' } });
  await prisma.user.update({ where: { id: referred.id }, data: { emailVerifiedAt: new Date() } });
  const product = await makeProduct();
  const token = await issueAccessToken({ sub: referred.id, role: 'user' });
  // First record arrives ONLY via the sync batch endpoint — never the direct create.
  await app.inject({
    method: 'POST',
    url: '/v1/records/sync',
    headers: { authorization: `Bearer ${token}` },
    payload: { records: [{ clientId: 'sync-e2e-1', productId: product.id, quantity: 1 }] },
  });
  const ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referred.id } });
  expect(ref.status).toBe('converted');
  const u = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
  expect(u.pointsBalance).toBe(50);
  await app.close();
});
```

> NOTE: The exact `POST /v1/records` and `POST /v1/records/sync` payload + header shapes must match M1's actual contracts (the sync body shape — `records[]`, `clientId`, etc. — comes from M1 Task G6). Adjust payloads/headers to M1's real schemas when wiring; the assertion that matters is **referral converted + 50 points via EITHER path**.

- [ ] **Step 2b: Add an idempotent reconciliation re-check** (`reconcilePendingReferral`) so a pending referral that missed BOTH triggers (e.g. a record persisted before this code shipped, or a transient conversion error) can still convert later.

Add to `api/src/services/referrals/referral-service.ts`:

```ts
import { getPrisma } from '../../db.js';

/**
 * Re-check whether a user with a still-pending referral has, in fact, already
 * met the conversion milestone (>= 1 record persisted). Idempotent: delegates to
 * convertReferral, which no-ops if there is nothing pending. Call on any cheap
 * authenticated touchpoint (e.g. when the user opens the Invite screen → GET
 * /v1/me/referrals) so a missed trigger self-heals without a dedicated worker.
 */
export async function reconcilePendingReferral(referredUserId: string): Promise<void> {
  const prisma = getPrisma();
  const pending = await prisma.referral.findFirst({
    where: { referredUserId, status: 'pending' },
    select: { id: true },
  });
  if (!pending) return;
  const recordCount = await prisma.record.count({ where: { userId: referredUserId } });
  if (recordCount > 0) await convertReferral(referredUserId);
}
```

Wire `reconcilePendingReferral(req.user.id)` (best-effort, try/catch-logged) into the `GET /v1/me/referrals` handler (Task F2) so opening the Invite screen heals a stuck referral. Adjust `prisma.record` / `userId` to M1's actual records model name + owner column when wiring.

- [ ] **Step 3: Run, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/referral-conversion.test.ts
```
Expected: all conversion tests pass including BOTH record-path cases (direct + sync).

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/records/create.ts api/src/services/records/sync.ts api/src/services/referrals/referral-service.ts api/tests/integration/referral-conversion.test.ts
git commit -m "feat(api): fire referral conversion on direct + sync record paths with reconciliation"
```

---

## Phase G — Admin overview endpoint

### Task G1: GET /v1/admin/referrals/overview — failing test

**Files:**
- Create: `api/tests/integration/admin-referrals-overview.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/admin-referrals-overview.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { convertReferral } from '../../src/services/referrals/referral-service.js';
import { makeUser, makeUserWithCode, makeReferral } from '../helpers/factories.js';

describe('GET /v1/admin/referrals/overview', () => {
  it('returns totals + top referrers, flagging zero-conversion mass referrers', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const good = await makeUserWithCode('GOODREF2');
    const r1 = await makeUser({ emailVerified: true });
    await makeReferral({ referrerUserId: good.id, referredUserId: r1.id, referralCode: 'GOODREF2' });
    await convertReferral(r1.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/referrals/overview',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: admin.id, role: 'admin' })}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalReferrals).toBeGreaterThanOrEqual(1);
    expect(body.totalConverted).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.topReferrers)).toBe(true);
    // Each row carries the clustering + velocity signals used by abuseFlag.
    expect(body.topReferrers[0]).toMatchObject({
      maxSameIpReferred: expect.any(Number),
      hitVelocityCap: expect.any(Boolean),
      abuseFlag: expect.any(Boolean),
    });
    await app.close();
  });

  it('flags a referrer whose referred users cluster on one signup IP', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const farmer = await makeUserWithCode('CLUSTER2');
    const prisma = getPrisma();
    // 3 referred users all sharing one signup IP → clustering trips abuseFlag.
    for (let i = 0; i < 3; i += 1) {
      const r = await makeUser({ emailVerified: true });
      const ref = await makeReferral({ referrerUserId: farmer.id, referredUserId: r.id, referralCode: 'CLUSTER2' });
      await prisma.referral.update({ where: { id: ref.id }, data: { signupIp: '203.0.113.7' } });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/referrals/overview',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: admin.id, role: 'admin' })}` },
    });
    const row = res.json().topReferrers.find((r: { referrerUserId: string }) => r.referrerUserId === farmer.id);
    expect(row.maxSameIpReferred).toBeGreaterThanOrEqual(3);
    expect(row.abuseFlag).toBe(true);
    await app.close();
  });

  it('rejects a non-admin with 403', async () => {
    const app = await buildServer();
    const u = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/referrals/overview',
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: u.id, role: 'user' })}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

---

### Task G2: Implement the admin overview route

**Files:**
- Create: `api/src/routes/admin/referrals.ts`
- Modify: `api/src/server.ts` (mount under `/v1/admin`)

- [ ] **Step 1: Write `api/src/routes/admin/referrals.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { adminReferralOverviewSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { MAX_CONVERSIONS_PER_DAY } from '../../services/referrals/referral-service.js';

const ABUSE_MIN_REFERRALS = 5;   // many referrals with zero conversions → review
const ABUSE_MIN_SAME_IP = 3;     // >= this many referred users on one signup IP → review

export async function adminReferralsRoutes(app: FastifyInstance) {
  app.get('/referrals/overview', { preHandler: app.requireAdmin }, async () => {
    const prisma = getPrisma();
    const [totalReferrals, totalConverted, grouped] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: 'converted' } }),
      prisma.referral.groupBy({ by: ['referrerUserId'], _count: { _all: true } }),
    ]);

    const referrerIds = grouped.map((g) => g.referrerUserId);
    const [users, convertedGroups, ipGroups, cappedGroups] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: referrerIds } },
        select: { id: true, firstName: true, email: true, referralCode: true, pointsBalance: true },
      }),
      prisma.referral.groupBy({
        by: ['referrerUserId'],
        where: { status: 'converted' },
        _count: { _all: true },
      }),
      // Clustering: how many referred users share each (referrer, signupIp).
      prisma.referral.groupBy({
        by: ['referrerUserId', 'signupIp'],
        where: { referrerUserId: { in: referrerIds }, signupIp: { not: null } },
        _count: { _all: true },
      }),
      // High velocity: any referrer with a velocity_capped ledger note.
      prisma.pointsLedger.groupBy({
        by: ['userId'],
        where: { userId: { in: referrerIds }, reason: 'velocity_capped' },
        _count: { _all: true },
      }),
    ]);
    const convByUser = new Map(convertedGroups.map((g) => [g.referrerUserId, g._count._all]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const cappedUsers = new Set(cappedGroups.map((g) => g.userId));
    // Largest same-IP cluster per referrer.
    const maxIpByUser = new Map<string, number>();
    for (const g of ipGroups) {
      const cur = maxIpByUser.get(g.referrerUserId) ?? 0;
      if (g._count._all > cur) maxIpByUser.set(g.referrerUserId, g._count._all);
    }

    const topReferrers = grouped
      .map((g) => {
        const u = userById.get(g.referrerUserId)!;
        const referredCount = g._count._all;
        const convertedCount = convByUser.get(g.referrerUserId) ?? 0;
        const maxSameIpReferred = maxIpByUser.get(g.referrerUserId) ?? 0;
        const hitVelocityCap = cappedUsers.has(g.referrerUserId);
        const clustering = maxSameIpReferred >= ABUSE_MIN_SAME_IP;
        const massZeroConversion = referredCount >= ABUSE_MIN_REFERRALS && convertedCount === 0;
        return {
          referrerUserId: g.referrerUserId,
          firstName: u.firstName,
          email: u.email,
          referralCode: u.referralCode,
          referredCount,
          convertedCount,
          pointsBalance: u.pointsBalance,
          maxSameIpReferred,
          hitVelocityCap,
          abuseFlag: clustering || hitVelocityCap || massZeroConversion,
        };
      })
      // Surface flagged accounts and big referrers first.
      .sort(
        (a, b) =>
          Number(b.abuseFlag) - Number(a.abuseFlag) ||
          b.convertedCount - a.convertedCount ||
          b.referredCount - a.referredCount,
      )
      .slice(0, 50);

    return adminReferralOverviewSchema.parse({ totalReferrals, totalConverted, topReferrers });
  });
}
```

> `ABUSE_MIN_SAME_IP = 3` and the `MAX_CONVERSIONS_PER_DAY`-driven `velocity_capped` notes are heuristics for a human reviewer only — the overview never auto-acts (out-of-scope discipline). A future admin mutation to resolve/clear a flag MUST be audit-logged per M3 convention. This endpoint is **admin-only abuse monitoring** (`app.requireAdmin`), NOT a user-facing leaderboard: it is never exposed to end users and exists solely so a human can review abuse signals. A regular user only ever sees their OWN points/badges via `GET /v1/me/referrals` — there is no cross-user ranking in v1.x.

- [ ] **Step 2: Mount in `api/src/server.ts`** under the existing `/v1/admin` registrations:

```ts
import { adminReferralsRoutes } from './routes/admin/referrals.js';
// ...
await app.register(adminReferralsRoutes, { prefix: '/v1/admin' });
```

- [ ] **Step 3: Run, verify PASS**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/admin-referrals-overview.test.ts
```
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/admin/referrals.ts api/src/server.ts
git commit -m "feat(api): admin referrals overview endpoint with abuse heuristic"
```

---

## Phase H — Mobile: deep-link capture + Invite screen

(Mobile track — deferred; see Execution order header.)

### Task H1: Pending-referral store (capture + persist)

**Files:**
- Create: `apps/mobile/src/referral/pendingReferralStore.ts`

- [ ] **Step 1: Write the store**

```ts
// apps/mobile/src/referral/pendingReferralStore.ts
import * as SecureStore from 'expo-secure-store';

const KEY = 'pending_referral_code';
const CODE_RE = /^[A-Z2-9]{8}$/;

/** Persist a captured code (validated + normalized). No-op for invalid input. */
export async function capturePendingReferralCode(raw: string | null | undefined): Promise<void> {
  if (!raw) return;
  const code = raw.trim().toUpperCase();
  if (!CODE_RE.test(code)) return;
  // First-launch capture wins; don't overwrite an already-captured code.
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return;
  await SecureStore.setItemAsync(KEY, code);
}

export async function readPendingReferralCode(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function clearPendingReferralCode(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/src/referral/pendingReferralStore.ts
git commit -m "feat(mobile): persist captured referral code in secure store"
```

---

### Task H2: Extend `DeepLinkHandler` to capture `?code=`

**Files:**
- Modify: `apps/mobile/src/components/DeepLinkHandler.tsx` (M0c)

- [ ] **Step 1: Parse an inbound `invite?code=XXXX` and capture it (best-effort, post-install)**

In the existing URL-handling callback of `DeepLinkHandler` (which already parses `expyrico://` links via Expo Linking), add: when the parsed path is `invite` and there is a `code` query param, call `capturePendingReferralCode(code)`. Do NOT change existing routing behavior — capture is additive and side-effect-only.

> **Scope (Red Team Review fix 3):** this only fires when the app is ALREADY installed and the link opens through it (e.g. a `expyrico://invite?code=…` link, or a future universal link). v1.x provisions **no** universal/app-link infra (no AASA, no `assetlinks.json`, no served `/invite` page), so a fresh user tapping the `https` invite link in WhatsApp/Telegram **before install** will NOT auto-open the app or auto-attach the code — they install from the store and **type the code at sign-up**. This handler is a best-effort convenience for the already-installed case, not the primary attribution mechanism.

```ts
import * as Linking from 'expo-linking';
import { capturePendingReferralCode } from '../referral/pendingReferralStore';

// inside the existing onURL handler, after the existing parse:
const { path, queryParams } = Linking.parse(url);
if (path === 'invite' && typeof queryParams?.code === 'string') {
  void capturePendingReferralCode(queryParams.code);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/src/components/DeepLinkHandler.tsx
git commit -m "feat(mobile): capture inbound referral code from deep link"
```

---

### Task H3: Pre-fill captured code on the register screen

**Files:**
- Modify: `apps/mobile/app/(auth)/register.tsx` (M0c)

- [ ] **Step 1: Read the captured code on mount, pre-fill a (read-only-ish) field, and send it with register**

```ts
import { useEffect, useState } from 'react';
import { readPendingReferralCode, clearPendingReferralCode } from '../../src/referral/pendingReferralStore';

// inside the component:
const [referralCode, setReferralCode] = useState<string | undefined>(undefined);
useEffect(() => {
  void readPendingReferralCode().then((c) => { if (c) setReferralCode(c); });
}, []);

// include `referralCode` in the register mutation payload; on success:
// await clearPendingReferralCode();
```

Render a small "Invited by a friend — code applied: XXXX" hint (and an editable input so a user who typed a code manually can enter/clear it). Pass `referralCode` to the existing register call (the API field is optional).

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/app/\(auth\)/register.tsx
git commit -m "feat(mobile): pre-fill captured referral code at sign-up"
```

---

### Task H4: TanStack hooks for referrals/points/badges

**Files:**
- Create: `apps/mobile/src/api/referrals.ts`

- [ ] **Step 1: Write the hooks** over the M0c `apiClient`

```ts
// apps/mobile/src/api/referrals.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { ReferralSummary, PointsPage } from '@expyrico/shared';
import { apiClient } from './client';

export function useReferralSummary() {
  return useQuery<ReferralSummary>({
    queryKey: ['referrals', 'me'],
    queryFn: () => apiClient.get('/v1/me/referrals'),
    staleTime: 30_000,
  });
}

export function usePointsLedger() {
  return useInfiniteQuery<PointsPage>({
    queryKey: ['points', 'me'],
    queryFn: ({ pageParam }) =>
      apiClient.get(`/v1/me/points${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.cursor ?? undefined,
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/src/api/referrals.ts
git commit -m "feat(mobile): TanStack hooks for referral summary + points ledger"
```

---

### Task H5: Share button + invite UI components (with component tests)

**Files:**
- Create: `apps/mobile/src/features/referral/InviteShareButton.tsx`
- Create: `apps/mobile/src/features/referral/ReferralCodeCard.tsx`
- Create: `apps/mobile/src/features/referral/PointsBadgesPanel.tsx`
- Create: `apps/mobile/__tests__/InviteShareButton.test.tsx`
- Create: `apps/mobile/__tests__/ReferralCodeCard.test.tsx`
- Create: `apps/mobile/__tests__/PointsBadgesPanel.test.tsx`

- [ ] **Step 1: Write failing component tests** asserting: `ReferralCodeCard` renders the code text; `InviteShareButton` calls the OS share API with a message containing the share URL when pressed; `PointsBadgesPanel` renders the points balance and one badge row per catalog entry (earned vs locked styling).

```tsx
// apps/mobile/__tests__/InviteShareButton.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Share } from 'react-native';
import { InviteShareButton } from '../src/features/referral/InviteShareButton';

it('invokes the native share sheet with the referral CODE (the load-bearing part)', () => {
  const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  const { getByText } = render(
    <InviteShareButton shareUrl="https://expyrico.app/invite?code=ABCDEF23" code="ABCDEF23" />,
  );
  fireEvent.press(getByText('Share invite'));
  // The CODE must be present — that is what the invited user enters at sign-up.
  // (The URL is included as readable text but is NOT an auto-deep-link in v1.x.)
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('ABCDEF23') }),
  );
});
```

- [ ] **Step 2: Implement `InviteShareButton.tsx`** using RN `Share.share` (works across WhatsApp/Telegram/SMS via the OS sheet)

```tsx
// apps/mobile/src/features/referral/InviteShareButton.tsx
import { Pressable, Share, Text } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export function InviteShareButton({ shareUrl, code }: { shareUrl: string; code: string }) {
  const t = useTheme();
  async function onShare() {
    // The CODE is the attribution mechanism (entered at sign-up). The URL is
    // included as readable text only — v1.x provisions no universal/app links,
    // so it does NOT auto-open the app or auto-attribute installs.
    await Share.share({
      message: `Join me on Expyrico! Enter my invite code ${code} when you sign up. ${shareUrl}`,
      url: shareUrl, // iOS uses url; Android folds it into message
    });
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onShare}
      style={{ padding: 14, borderRadius: t.radii.md, backgroundColor: t.colors.primary, alignItems: 'center' }}
    >
      <Text style={{ color: t.colors.primaryFg, fontWeight: '600' }}>Share invite</Text>
    </Pressable>
  );
}
```

- [ ] **Step 3: Implement `ReferralCodeCard.tsx`** (shows code + share URL) and `PointsBadgesPanel.tsx` (points balance + badge grid with earned/locked states), consuming `useTheme()` tokens only (no theme polish beyond tokens — that's M4).

- [ ] **Step 4: Run, verify PASS**

```bash
pnpm --filter @expyrico/mobile test -- InviteShareButton ReferralCodeCard PointsBadgesPanel
```
Expected: all component tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/referral apps/mobile/__tests__/InviteShareButton.test.tsx apps/mobile/__tests__/ReferralCodeCard.test.tsx apps/mobile/__tests__/PointsBadgesPanel.test.tsx
git commit -m "feat(mobile): invite share button + referral code card + points/badges panel"
```

---

### Task H6: Invite screen + Settings integration

**Files:**
- Create: `apps/mobile/app/(app)/invite.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/settings.tsx` (M0c)

- [ ] **Step 1: Write `app/(app)/invite.tsx`** — `useReferralSummary()` → render `ReferralCodeCard` + `InviteShareButton` + the referred-friends list with per-friend status (pending/converted).

```tsx
// apps/mobile/app/(app)/invite.tsx
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useReferralSummary } from '../../src/api/referrals';
import { ReferralCodeCard } from '../../src/features/referral/ReferralCodeCard';
import { InviteShareButton } from '../../src/features/referral/InviteShareButton';
import { useTheme } from '../../src/theme/useTheme';

export default function InviteScreen() {
  const t = useTheme();
  const q = useReferralSummary();
  if (q.isPending) return <ActivityIndicator />;
  if (q.isError || !q.data) return <Text>Couldn’t load your invite info.</Text>;
  const s = q.data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}>
      <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '700' }}>Invite friends</Text>
      <ReferralCodeCard code={s.referralCode} shareUrl={s.shareUrl} />
      <InviteShareButton code={s.referralCode} shareUrl={s.shareUrl} />
      <Text style={{ color: t.colors.textMuted }}>
        {s.convertedCount} of {s.referredCount} friends joined · {s.pointsBalance} points
      </Text>
      <View style={{ gap: 8 }}>
        {s.referred.map((r) => (
          <Text key={r.referredUserId} style={{ color: t.colors.text }}>
            {r.firstName} — {r.status === 'converted' ? 'Joined ✅' : 'Pending…'}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: In `settings.tsx`**, mount `PointsBadgesPanel` (driven by `useReferralSummary()`) and add a row/button that routes to `/invite`.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @expyrico/mobile typecheck
git add apps/mobile/app/\(app\)/invite.tsx apps/mobile/app/\(app\)/\(tabs\)/settings.tsx
git commit -m "feat(mobile): invite screen + points/badges in settings"
```

---

## Phase I — Admin overview page

### Task I1: Referrals overview page (Server Component)

**Files:**
- Modify: `apps/admin/src/app/(dashboard)/referrals/page.tsx` (M0d stub)

- [ ] **Step 1: Extend `serverAdminApi`** (`apps/admin/src/lib/admin-api.ts`) with a `referrals.overview()` method calling `GET /v1/admin/referrals/overview` and typed as `AdminReferralOverview` from `@expyrico/shared`.

- [ ] **Step 2: Replace the M0d stub page** with a Server Component that fetches the overview and renders totals + a top-referrers table (firstName, email, code, referred/converted counts, points, an abuse badge when `abuseFlag`).

```tsx
// apps/admin/src/app/(dashboard)/referrals/page.tsx
import { serverAdminApi } from '@/lib/admin-api';

export default async function ReferralsPage() {
  const o = await serverAdminApi.referrals.overview();
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Referrals</h1>
      <div className="flex gap-6">
        <Stat label="Total referrals" value={o.totalReferrals} />
        <Stat label="Converted" value={o.totalConverted} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th>User</th><th>Code</th><th>Referred</th><th>Converted</th><th>Points</th><th>Same-IP</th><th>Velocity</th><th>Flag</th>
          </tr>
        </thead>
        <tbody>
          {o.topReferrers.map((r) => (
            <tr key={r.referrerUserId} className="border-t">
              <td>{r.firstName} <span className="text-muted-foreground">{r.email}</span></td>
              <td>{r.referralCode ?? '—'}</td>
              <td>{r.referredCount}</td>
              <td>{r.convertedCount}</td>
              <td>{r.pointsBalance}</td>
              <td>{r.maxSameIpReferred}</td>
              <td>{r.hitVelocityCap ? <span className="text-amber-600">capped</span> : '—'}</td>
              <td>{r.abuseFlag ? <span className="text-red-600">⚠ review</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
```

> The overview is read-only, so no `writeAuditLog` is required here. If a future task adds an admin mutation (e.g. revoke points / flag-resolve), that mutation MUST be audit-logged per M3 convention.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @expyrico/admin typecheck
git add apps/admin/src/lib/admin-api.ts apps/admin/src/app/\(dashboard\)/referrals/page.tsx
git commit -m "feat(admin): referrals + points overview page"
```

---

## Phase J — E2E

### Task J1: Mobile Maestro invite flow

**Files:**
- Create: `apps/mobile/.maestro/invite-flow.yaml`

- [ ] **Step 1: Write the flow** (sign in via the M0c reusable sign-in flow, open Settings → Invite, assert the code + Share button are visible, tap Share).

```yaml
appId: com.expyrico.app
name: Invite flow — open invite, view code, share
tags:
  - referral
---
- launchApp:
    clearState: true
- runFlow: ./sign-in.yaml  # provided by M0c
- tapOn: "Settings"
- tapOn: "Invite friends"
- assertVisible: "Share invite"
- tapOn: "Share invite"
```

> NOTE: tapping Share opens the OS share sheet — Maestro cannot assert across that system UI, so the flow ends at the tap. If M0c has no `sign-in.yaml`, inline explicit sign-in steps.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/.maestro/invite-flow.yaml
git commit -m "test(mobile): Maestro E2E for invite + share"
```

---

### Task J2: Admin Playwright spec

**Files:**
- Create: `apps/admin/e2e/referrals-overview.spec.ts`

- [ ] **Step 1: Write a spec** that logs in (reusing M0d/M3 auth helper), navigates to `/referrals`, and asserts the "Total referrals" / "Converted" stats and the top-referrers table render.

```ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth'; // from M3

test('referrals overview renders totals + table', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/referrals');
  await expect(page.getByText('Total referrals')).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/e2e/referrals-overview.spec.ts
git commit -m "test(admin): Playwright spec for referrals overview"
```

---

## Phase K — Final verification

### Task K1: Full API test suite

- [ ] **Step 1: Run every API test**

```bash
pnpm --filter @expyrico/api test
```
Expected: every test passes. New test files introduced by this plan:

- `unit/referral-code.test.ts` — 3 tests
- `unit/badges.test.ts` — 5 tests
- `integration/register-referral.test.ts` — 4 tests
- `integration/referral-conversion.test.ts` — 8 tests (incl. velocity cap, points invariant, and BOTH record paths: direct + sync)
- `integration/my-referrals.test.ts` — 2 tests
- `integration/my-points.test.ts` — 2 tests
- `integration/badges-catalog.test.ts` — 2 tests
- `integration/admin-referrals-overview.test.ts` — 3 tests (incl. IP-clustering flag)

All M0a/M0b/M1/M3 tests must still pass — in particular the M0b `register.test.ts` (which sends no `referralCode`).

- [ ] **Step 2: Mobile tests**

```bash
pnpm --filter @expyrico/mobile test
```
Expected: `InviteShareButton.test.tsx`, `ReferralCodeCard.test.tsx`, `PointsBadgesPanel.test.tsx` pass, plus all prior tests.

- [ ] **Step 3: Admin tests**

```bash
pnpm --filter @expyrico/admin test
```
Expected: pass.

- [ ] **Step 4: Repo-wide typecheck**

```bash
pnpm typecheck
```
Expected: exit 0 in every package.

- [ ] **Step 5: Lint / format**

```bash
pnpm exec prettier --check .
```
Expected: exit 0. If not: `pnpm exec prettier --write .` and re-check.

- [ ] **Step 6: Manual smoke against the running API**

In one terminal: `pnpm --filter @expyrico/api dev`. In another, register referrer, grab its code, register a referred user with that code, then hit the read endpoints:

```bash
curl -s http://localhost:4000/v1/me/referrals \
  -H "Authorization: Bearer <referrer-access-token>" | jq
```
Expected: HTTP 200 with `referralCode`, `shareUrl` (`/invite?code=...`), `pointsBalance`, `referred[]`, `badges[]`.

```bash
curl -s http://localhost:4000/v1/me/points \
  -H "Authorization: Bearer <referrer-access-token>" | jq
```
Expected: HTTP 200 with `balance` + ledger `items[]` (after a conversion: one `referral_converted` `+50` entry).

- [ ] **Step 7: Tag the milestone**

```bash
git tag m7-complete
```

---

## Self-review checklist

Run through these before declaring M7 done. Findings (if any) are folded back into the plan inline; this list is the final gate.

**1. Spec coverage**

- §2.14 referral attribution → in-app points + badges (no payments) — Tasks A1–A3, D3, E2, F4 (conversion awards points + badges via `awardPoints`; no payment code anywhere).
- §2.14 native share sheet carrying a referral **code** — Tasks H2 (best-effort post-install capture), H5/H6 (share sheet outbound via RN `Share`, code-first message). No auto-deep-link install-attribution claim; share URL is plain text only (Red Team Review fix 3).
- §13 M7 scope — referral rewards + sharing, layered on v1 M0–M4 contracts.

**2. Placeholder scan**

- No "TBD", "see Task N", "add error handling" found.
- Every test step provides full test code; every implementation step provides full source (or an explicit, contract-pinned MODIFY when extending an M0c/M1/M3 file).
- Maestro + Playwright flows note their M0c/M3 helper dependencies rather than handwaving.

**3. Type consistency**

- Wire camelCase ↔ DB snake_case: `referralCode`/`referral_code`, `pointsBalance`/`points_balance`, `referredByUserId`/`referred_by_user_id`, `referrerUserId`/`referrer_user_id`, `referredUserId`/`referred_user_id`, `convertedAt`/`converted_at`, `refId`/`ref_id`, `earnedAt`/`earned_at` — all mapped via Prisma `@map`.
- Error codes are snake_case strings: `referral_code_not_found`, `self_referral_not_allowed`, `referral_already_attributed`.
- `ReferralStatus` (`pending | converted`) identical in Prisma enum, Zod (`referralStatusSchema`), and the mobile/admin renderers.
- `PointsReason` (`referral_converted | velocity_capped`) identical in Prisma + Zod. The enum now carries ONLY what M7 writes — the unused `referral_signup` / `badge_bonus` values were dropped (added later when a feature needs them; a Prisma enum addition is non-breaking).
- `signupIp` is `String?` (`signup_ip`) on `Referral` — captured at register, used only by the admin clustering heuristic.
- `referralCode` is `string | undefined` (optional) on `registerSchema` — additive; M0b register tests unaffected.
- `pointsBalance` is the denormalized running sum of `points_ledger.delta`, mutated ONLY through the `awardPoints` helper. Invariant `sum(ledger.delta) == points_balance` is asserted in `referral-conversion.test.ts`.
- **Email-verified field name reconciled:** the real column is `emailVerifiedAt` (`DateTime?`); `makeUser({ emailVerified: true })` is a factory option that sets it. No `emailVerified` column exists — direct DB writes use `emailVerifiedAt`.

**4. Cross-milestone assumption audit**

- `app.requireAuth` / `app.requireAdmin`, `issueAccessToken` (→ string), `toApiUser`, `AppError`, `ERROR_CODES`, `getPrisma`, `makeUser` → M0a.
- `POST /v1/auth/register` + `registerSchema` + email-verify gate → M0b. M7's change is additive-optional; M0b tests must still pass.
- `apiClient`, `useTheme`, secure-store session, `DeepLinkHandler`, register screen, settings screen → M0c. `DeepLinkHandler` is REUSED (extended additively) to capture `?code=`.
- `products`/`records` tables + **BOTH** record-persist paths — direct `POST /v1/records/create` AND offline-sync `POST /v1/records/sync` (`api/src/services/records/sync.ts`) — + Idempotency-Key plugin → M1. The conversion hook attaches to **both** paths (Task F4 Steps 1 + 1b), plus a `reconcilePendingReferral` self-heal on `GET /v1/me/referrals`. **The exact `/v1/records` + `/v1/records/sync` payload/header shapes in the F4 e2e tests must be reconciled with M1's actual contracts when wiring** (flagged in Task F4 NOTE).
- `serverAdminApi`, `writeAuditLog`, `app.requireAdmin`, admin page-stub conventions → M0d/M3. Admin page replaces the M0d `/referrals` stub.
- `getConfig().publicWebBaseUrl` — if M0a config lacks it, Task D1 adds it (env `PUBLIC_WEB_BASE_URL`).

**5. Out-of-scope discipline**

- No payment/payout code — points + badges only.
- No multi-tier chains — only the direct referrer earns (conversion reads exactly one `referrals` row by `referred_user_id`).
- No points spending/redemption — read-only balance + ledger + badge catalog shipped; spending is a clean future addition.
- No fraud ML — anti-abuse is rule-based: self-referral CHECK, the per-day velocity cap in `convertReferral`, and the read-only admin `abuseFlag` heuristic (clustering / velocity / mass-zero-conversion). The overview surfaces signals for a human; it never auto-acts.
- Deals/giveaways do not award points — `points_ledger` is written only by `convertReferral` (via `awardPoints`).
- No universal/app-link infra provisioned — share is scoped to a copyable code; auto-deep-link is a documented future addition (Handoff item 6).

---

## Handoff to future milestones

A later milestone may:

1. **Surface a referral leaderboard** (rank users by `convertedCount` / `pointsBalance`) — all data already present; purely additive read endpoint + screen.
2. **Introduce points spending / cosmetic redemption** — `points_ledger` supports negative `delta` (and `awardPoints` already handles it) and additional `PointsReason` values; add the reason value + a spend endpoint with balance-check, no schema reversal.
3. **Add a signup bonus to the referred user** — add a `referral_signup` value to the `PointsReason` enum (a non-breaking enum addition; it was intentionally NOT pre-declared in M7) and write that ledger entry for the referred user at conversion via `awardPoints`.
4. **Make `POINTS_PER_CONVERSION`, `MAX_CONVERSIONS_PER_DAY`, and badge thresholds admin-configurable** via the M3 settings service — replace the constants + seeded thresholds with settings reads, defaulting to the current literals (50; cap 10; 1/5/10/25). M7 hardcodes them, so this is a clean additive change.
5. **Add an admin mutation** (e.g. revoke fraudulent points, resolve an abuse flag) — MUST audit-log via `writeAuditLog` per M3 convention. Revoking points goes through `awardPoints` with a negative `delta` + a new reason value.
6. **Provision true universal / app links** — add an iOS AASA file, Android `assetlinks.json`, and a served `/invite` web page (deep-links into the app if installed, else routes to the store carrying the code). Only then does tapping an `https` invite link pre-install auto-attribute. M7's code-based attribution remains the fallback, so this is purely additive.

Notes for the next milestone:

- The conversion trigger is "first record created" (email-verify is already a hard signup gate). If a richer milestone is desired (e.g. "first record AND email verified within 7 days"), tighten the guard inside `convertReferral` — all callers route through it.
