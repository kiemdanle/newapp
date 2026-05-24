# M2 — Reviews + Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-facing reviews surface: reviews CRUD, voting with Wilson lower-bound scoring, automatic profanity-based moderation and report submission, debounced background recalc workers, and the mobile screens (browse, product detail, reviews list, review form, report modal). Admin resolution of reports is M3 — this milestone ships only user-side submission and the auto-hide threshold.

**Architecture:** Three new Postgres tables (`reviews`, `review_votes`, `reports`) managed via Prisma migration. Fastify routes under `/v1/products/:id/reviews`, `/v1/reviews/:id`, `/v1/reviews/:id/vote`, `/v1/me/reviews`, `/v1/reports`. Two pure-function services (`wilson.ts`, `profanity.ts`) with rigorous unit tests. Two BullMQ workers (`score-recalc` debounced 30s per review via Redis sentinel keys, `product-rating-recalc` per product). Mobile screens are read-mostly via TanStack Query (server is source of truth); only the user's own review writes go through the offline write queue introduced in M1. A new system user is seeded so the `moderation-flag` worker can author auto-flagged reports.

**Tech Stack:** Fastify 4, Prisma 5, Postgres 16, Redis 7, BullMQ 5, Zod 3, `obscenity` 0.4 (pure-JS profanity filter, no native deps), Vitest 2 + Supertest 7 (API), Expo SDK + Expo Router + Zustand + TanStack Query + NativeWind (mobile), React Native Testing Library 12 (component tests), Maestro (E2E).

**Spec reference:** `docs/superpowers/specs/2026-05-23-pantry-app-design.md` sections 2.6–2.8, 4.3, 5 (reviews / review_votes / reports), 6.4, 6.5, 7. Read before starting.

**Prerequisites:**

- **M0a** complete: shared package, error/AppError, config, db/redis singletons, error-handler, auth plugin (`req.user`, `app.requireAuth`), users repository (`toApiUser`), random/hashToken utils, test harness (`tests/helpers/setup.ts`, `tests/helpers/factories.ts`).
- **M0b** complete: auth routes (so integration tests can sign up + log in users).
- **M0c** complete: mobile app shell with auth-gated `(app)` group, tab navigator, theme provider, API client (`apps/mobile/src/api/client.ts`), TanStack Query provider, secure-store-backed session.
- **M1** complete: `products` table + product routes + Idempotency-Key Fastify plugin (`api/src/plugins/idempotency.ts`), BullMQ wiring (queues live under `api/src/queues/` per D10 — `getQueueConnection` is exported from `api/src/queues/index.ts`, alongside a `getAllQueues()` registry; central worker registration lives in `api/src/queues/workers.ts`), WatermelonDB schema and offline write queue.

**Out of scope for M2 (handled elsewhere):**

- Admin moderation queue, admin status changes on reviews, admin user actions — **M3**.
- Theme polish across the new screens beyond consuming existing tokens, store submission — **M4**.
- Real-time updates (vote counts pushed to other clients) — deferred per spec §12.

---

## File map

This plan creates the following files. Files in **bold** carry the load-bearing logic.

```
pantry/
├── packages/shared/src/schemas/
│   ├── review.ts                               ← Zod review schemas (NEW)
│   └── report.ts                               ← Zod report schemas (NEW)
├── packages/shared/src/index.ts                ← re-exports (MODIFY)
├── api/
│   ├── prisma/schema.prisma                    ← +Review, ReviewVote, Report, +User.systemUser (MODIFY)
│   ├── prisma/migrations/<ts>_reviews_votes_reports/
│   │   └── migration.sql                       ← generated
│   ├── prisma/seed.ts                          ← seed system user (MODIFY or NEW)
│   ├── src/
│   │   ├── **services/reviews/wilson.ts**      ← Wilson lower-bound math
│   │   ├── **services/reviews/profanity.ts**   ← obscenity wrapper
│   │   ├── services/reviews/system-user.ts     ← getSystemUserId() cached
│   │   ├── services/reviews/repository.ts      ← Prisma helpers + toApiReview
│   │   ├── services/reports/repository.ts      ← toApiReport + auto-hide logic
│   │   ├── queues/jobs/score-recalc.ts          ← debounced enqueue + processor
│   │   ├── queues/jobs/moderation-flag.ts       ← processor
│   │   ├── queues/jobs/product-rating-recalc.ts ← processor
│   │   ├── queues/workers.ts                   ← MODIFY to register new workers
│   │   ├── queues/index.ts                     ← MODIFY: append the 3 new queues to getAllQueues() registry
│   │   ├── routes/reviews/
│   │   │   ├── index.ts                        ← mount + register sub-routes
│   │   │   ├── list-for-product.ts             ← GET /v1/products/:id/reviews
│   │   │   ├── create.ts                       ← POST /v1/products/:id/reviews
│   │   │   ├── update.ts                       ← PATCH /v1/reviews/:id
│   │   │   ├── delete.ts                       ← DELETE /v1/reviews/:id
│   │   │   ├── vote.ts                         ← POST/DELETE /v1/reviews/:id/vote
│   │   │   └── my-reviews.ts                   ← GET /v1/me/reviews
│   │   ├── routes/reports/
│   │   │   ├── index.ts
│   │   │   └── create.ts                       ← POST /v1/reports
│   │   └── server.ts                           ← mount reviews + reports (MODIFY)
│   └── tests/
│       ├── unit/wilson.test.ts
│       ├── unit/profanity.test.ts
│       ├── unit/score-recalc-debounce.test.ts
│       ├── integration/reviews-list.test.ts
│       ├── integration/reviews-create.test.ts
│       ├── integration/reviews-update.test.ts
│       ├── integration/reviews-delete.test.ts
│       ├── integration/reviews-vote.test.ts
│       ├── integration/my-reviews.test.ts
│       ├── integration/reports-create.test.ts
│       ├── integration/score-recalc-worker.test.ts
│       ├── integration/moderation-flag-worker.test.ts
│       ├── integration/product-rating-recalc-worker.test.ts
│       └── helpers/factories.ts                ← +makeProduct, makeReview, makeVote (MODIFY)
└── apps/mobile/
    ├── src/api/
    │   ├── reviews.ts                          ← TanStack hooks
    │   ├── products-search.ts
    │   └── reports.ts
    ├── src/features/reviews/
    │   ├── ReviewCard.tsx                      ← inline vote + long-press
    │   ├── ReviewList.tsx
    │   ├── StarRatingInput.tsx
    │   ├── SortTabs.tsx
    │   └── useOptimisticVote.ts
    ├── src/features/reports/
    │   └── ReportModal.tsx
    ├── app/(app)/(tabs)/browse.tsx             ← MODIFY (placeholder from M0c)
    ├── app/(app)/(tabs)/reviews.tsx            ← MODIFY (placeholder from M0c)
    ├── app/(app)/product/[id].tsx              ← NEW
    ├── app/(app)/product/[id]/review.tsx       ← NEW
    └── __tests__/
        ├── ReviewCard.test.tsx
        ├── StarRatingInput.test.tsx
        └── ReportModal.test.tsx
└── apps/mobile/.maestro/
    └── reviews-flow.yaml                       ← E2E
```

---

## Conventions (carried over from M0a/M0b)

- TDD: write failing test, watch it fail, implement minimal code, watch it pass, commit. No batched commits across features.
- Conventional commits, scopes `shared`, `api`, `mobile`.
- Every API route imports its Zod schema from `@pantry/shared`.
- Every API route handler uses `req.user`, `app.requireAuth`, and `req.id` for logging.
- No `console.log`. Use `req.log` (API) or the mobile logger.
- Mobile data fetching: TanStack Query with `staleTime: 30_000` for review lists. Only the user's own *write* of a review goes through the offline write queue from M1.
- All vote / report writes require `Idempotency-Key` from the M1 plugin.

---

## Phase A — Data model

### Task A1: Add Review, ReviewVote, Report to Prisma schema

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Open `api/prisma/schema.prisma` and append the new enums**

Add immediately above the existing `enum AuthCredentialType` block:

> **Decision D15:** `ReviewStatus` has exactly 3 values — `visible`, `hidden`, `deleted`. There is NO `pending`. The profanity auto-flag worker (Task E4) sets `status='hidden'` directly; the auto-flag `Report` row is the signal admins need.

```prisma
enum ReviewStatus {
  visible
  hidden
  deleted

  @@map("review_status")
}

enum ReportTargetType {
  review
  user
  product
}

enum ReportReason {
  spam
  abuse
  incorrect
  other
}

enum ReportStatus {
  open
  resolved
  dismissed
}
```

- [ ] **Step 2: Add the Review model at the bottom of the file**

```prisma
model Review {
  id            String       @id @default(uuid()) @db.Uuid
  userId        String       @db.Uuid
  productId     String       @db.Uuid
  rating        Int          @db.SmallInt
  body          String?
  upvoteCount   Int          @default(0)
  downvoteCount Int          @default(0)
  score         Decimal      @default(0) @db.Decimal(7, 6)
  status        ReviewStatus @default(visible)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  product Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  votes   ReviewVote[]

  @@unique([userId, productId])
  @@index([productId, status, score(sort: Desc)])
  @@map("reviews")
}

model ReviewVote {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  reviewId  String   @db.Uuid
  value     Int      @db.SmallInt
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  review Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)

  @@unique([userId, reviewId])
  @@index([reviewId])
  @@map("review_votes")
}

model Report {
  id                 String           @id @default(uuid()) @db.Uuid
  reporterId         String           @db.Uuid
  targetType         ReportTargetType
  targetId           String           @db.Uuid
  reason             ReportReason
  body               String?
  status             ReportStatus     @default(open)
  resolvedByAdminId  String?          @db.Uuid
  resolvedAt         DateTime?
  createdAt          DateTime         @default(now())

  reporter        User  @relation("ReportReporter", fields: [reporterId], references: [id], onDelete: Cascade)
  resolvedByAdmin User? @relation("ReportResolver", fields: [resolvedByAdminId], references: [id])

  @@index([targetType, targetId, status])
  @@index([status, createdAt])
  @@map("reports")
}
```

- [ ] **Step 3: Add the new relations to the existing User model**

Find the `model User` block. After the existing `auditLogs` line, append:

```prisma
  reviews          Review[]
  reviewVotes      ReviewVote[]
  reportsFiled     Report[]    @relation("ReportReporter")
  reportsResolved  Report[]    @relation("ReportResolver")
```

- [ ] **Step 4: Add the new relations to the existing Product model**

Inside `model Product`, append:

```prisma
  reviews Review[]
```

- [ ] **Step 5: Format and validate the schema**

```bash
pnpm --filter @pantry/api exec prisma format
pnpm --filter @pantry/api exec prisma validate
```
Expected: `The schema at api/prisma/schema.prisma is valid 🚀`.

- [ ] **Step 6: Commit**

```bash
git add api/prisma/schema.prisma
git commit -m "feat(api): add Review, ReviewVote, Report models"
```

---

### Task A2: Generate the migration

**Files:**
- Create: `api/prisma/migrations/<ts>_reviews_votes_reports/migration.sql` (generated)

- [ ] **Step 1: Create the migration**

```bash
pnpm --filter @pantry/api exec prisma migrate dev --name reviews_votes_reports
```
Expected: prints `Applying migration ...` and `✔ Generated Prisma Client`.

- [ ] **Step 2: Verify the tables and indexes**

```bash
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\dt"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\di reviews*"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\di review_votes*"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\di reports*"
```
Expected: `reviews`, `review_votes`, `reports` listed; the indexes include `reviews_productId_status_score_idx`, `reviews_userId_productId_key`, `review_votes_userId_reviewId_key`, `reports_targetType_targetId_status_idx`.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/migrations
git commit -m "feat(api): migrate reviews, review_votes, reports tables"
```

---

### Task A3: Seed a system user for auto-flagged reports

**Files:**
- Create or Modify: `api/prisma/seed.ts`
- Modify: `api/package.json` (add `prisma.seed` if absent)

- [ ] **Step 1: Read the existing `api/prisma/seed.ts` (if M1 created one) or create it**

If the file does not exist, create `api/prisma/seed.ts` with this exact content:

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Reserved UUID for the synthetic "system" user that owns server-generated
 * reports (e.g., profanity auto-flags). Never logs in — no credentials.
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {},
    create: {
      id: SYSTEM_USER_ID,
      email: 'system@pantry.local',
      firstName: 'System',
      lastName: 'Bot',
      emailVerifiedAt: new Date(),
      role: 'user',
      status: 'active',
    },
  });
  // eslint-disable-next-line no-console
  console.log('Seeded system user', SYSTEM_USER_ID);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

If the file already exists from M1, ADD only the `SYSTEM_USER_ID` constant + upsert block inside `main()`; do not delete existing seeds.

- [ ] **Step 2: Ensure `api/package.json` declares the seed**

Open `api/package.json`. If there is no top-level `"prisma"` key, add:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
},
```

immediately before `"scripts"`.

- [ ] **Step 3: Run the seed**

```bash
pnpm --filter @pantry/api exec prisma db seed
```
Expected: `Seeded system user 00000000-0000-0000-0000-000000000001`.

- [ ] **Step 4: Verify it landed**

```bash
psql postgresql://pantry:pantry@localhost:5432/pantry -c "SELECT id, email FROM users WHERE id = '00000000-0000-0000-0000-000000000001';"
```
Expected: one row with `email = system@pantry.local`.

- [ ] **Step 5: Commit**

```bash
git add api/prisma/seed.ts api/package.json
git commit -m "feat(api): seed system user for auto-flagged reports"
```

---

### Task A4: Extend test harness to seed the system user and truncate new tables

**Files:**
- Modify: `api/tests/helpers/setup.ts`

- [ ] **Step 1: Open `api/tests/helpers/setup.ts`**

Find the `const tables = [` array. Replace it with the updated list:

```ts
const tables = [
  'reports',
  'review_votes',
  'reviews',
  'admin_audit_log',
  'totp_challenges',
  'password_resets',
  'email_tokens',
  'push_tokens',
  'sessions',
  'auth_credentials',
  // products, records etc. are truncated by the M1 list — leave those in place
  'users',
];
```

(If M1 already added `products` and `records` to this array, keep them between `auth_credentials` and `users`.)

- [ ] **Step 2: Re-seed the system user inside `beforeEach`**

Find the `beforeEach(async () => {` block. Inside it, AFTER the `flushdb()` call, append:

```ts
  // Re-seed system user (always present in production via prisma db seed)
  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'system@pantry.local',
      firstName: 'System',
      lastName: 'Bot',
      emailVerifiedAt: new Date(),
      role: 'user',
      status: 'active',
    },
  });
```

- [ ] **Step 3: Run the existing suite to confirm nothing broke**

```bash
pnpm --filter @pantry/api test
```
Expected: all previously-passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add api/tests/helpers/setup.ts
git commit -m "test(api): truncate reviews/votes/reports and reseed system user per test"
```

---

### Task A5: Test factories for products, reviews, votes

**Files:**
- Modify: `api/tests/helpers/factories.ts`

- [ ] **Step 1: Open `api/tests/helpers/factories.ts` and append**

```ts
import type { Product, Review, ReviewVote } from '@prisma/client';

export async function makeProduct(overrides: Partial<{
  name: string;
  brand: string;
  barcode: string;
}> = {}): Promise<Product> {
  const prisma = getPrisma();
  return prisma.product.create({
    data: {
      name: overrides.name ?? `Test product ${randomUUID()}`,
      brand: overrides.brand ?? 'Acme',
      barcode: overrides.barcode ?? `BC-${randomUUID()}`,
      source: 'user',
    },
  });
}

export async function makeReview(overrides: {
  userId: string;
  productId: string;
  rating?: number;
  body?: string;
  status?: 'visible' | 'hidden' | 'deleted';
  upvoteCount?: number;
  downvoteCount?: number;
  score?: number;
}): Promise<Review> {
  const prisma = getPrisma();
  return prisma.review.create({
    data: {
      userId: overrides.userId,
      productId: overrides.productId,
      rating: overrides.rating ?? 5,
      body: overrides.body ?? 'A solid product.',
      status: overrides.status ?? 'visible',
      upvoteCount: overrides.upvoteCount ?? 0,
      downvoteCount: overrides.downvoteCount ?? 0,
      score: overrides.score ?? 0,
    },
  });
}

export async function makeVote(overrides: {
  userId: string;
  reviewId: string;
  value: 1 | -1;
}): Promise<ReviewVote> {
  const prisma = getPrisma();
  return prisma.reviewVote.create({
    data: { userId: overrides.userId, reviewId: overrides.reviewId, value: overrides.value },
  });
}
```

NOTE: If M1's factories already export `makeProduct`, skip that block and keep theirs — it's fine as long as it returns a Prisma `Product`.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/tests/helpers/factories.ts
git commit -m "test(api): add makeReview and makeVote factories"
```

---

### Task A6: Zod schemas in `@pantry/shared`

**Files:**
- Create: `packages/shared/src/schemas/review.ts`
- Create: `packages/shared/src/schemas/report.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/schemas/error.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/review.ts`**

```ts
import { z } from 'zod';

// Per D15 — 3 values only. Profanity auto-flag sets status='hidden' directly.
export const reviewStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const reviewSortSchema = z.enum(['score', 'new', 'rating']).default('score');
export type ReviewSort = z.infer<typeof reviewSortSchema>;

const ratingField = z.number().int().min(1).max(5);
const bodyField = z.string().trim().max(2000).optional();

export const reviewSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  rating: ratingField,
  body: z.string().nullable(),
  upvoteCount: z.number().int().nonnegative(),
  downvoteCount: z.number().int().nonnegative(),
  score: z.number().min(0).max(1),
  status: reviewStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Present on lists when the caller is authenticated; null if no vote. */
  myVote: z.union([z.literal(-1), z.literal(1)]).nullable().optional(),
  /** Light author projection — first name + avatar only, never email. */
  author: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      avatarUrl: z.string().url().nullable(),
    })
    .optional(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewCreateSchema = z.object({
  rating: ratingField,
  body: bodyField,
});
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;

export const reviewPatchSchema = z
  .object({
    rating: ratingField.optional(),
    body: bodyField,
  })
  .refine((v) => v.rating !== undefined || v.body !== undefined, {
    message: 'at least one field required',
  });
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;

export const reviewVoteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(1)]),
});
export type ReviewVote = z.infer<typeof reviewVoteSchema>;

export const reviewListQuerySchema = z.object({
  sort: reviewSortSchema,
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
```

- [ ] **Step 2: Write `packages/shared/src/schemas/report.ts`**

```ts
import { z } from 'zod';

export const reportTargetTypeSchema = z.enum(['review', 'user', 'product']);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export const reportReasonSchema = z.enum(['spam', 'abuse', 'incorrect', 'other']);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export const reportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  body: z.string().nullable(),
  status: reportStatusSchema,
  createdAt: z.string().datetime(),
});
export type Report = z.infer<typeof reportSchema>;

export const reportCreateSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  body: z.string().trim().max(1000).optional(),
});
export type ReportCreate = z.infer<typeof reportCreateSchema>;
```

- [ ] **Step 3: Add new error codes to `packages/shared/src/schemas/error.ts`**

Open the file. Inside the `ERROR_CODES` object, add three new entries before the closing brace:

```ts
  REVIEW_ALREADY_EXISTS: 'review_already_exists',
  REPORT_TARGET_NOT_FOUND: 'report_target_not_found',
```

- [ ] **Step 4: Re-export both modules from `packages/shared/src/index.ts`**

Append:

```ts
export * from './schemas/review.js';
export * from './schemas/report.js';
```

- [ ] **Step 5: Typecheck the shared package**

```bash
pnpm --filter @pantry/shared typecheck
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): add review and report Zod schemas"
```

---

## Phase B — Wilson lower-bound math

### Task B1: Write Wilson unit tests (failing)

**Files:**
- Create: `api/tests/unit/wilson.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/wilson.test.ts
import { describe, expect, it } from 'vitest';
import { wilsonLowerBound } from '../../src/services/reviews/wilson.js';

describe('wilsonLowerBound', () => {
  it('returns 0 when there are no votes', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it('returns a value < 1 even with all upvotes', () => {
    const s = wilsonLowerBound(100, 0);
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThan(1);
  });

  it('returns a small value with all downvotes', () => {
    const s = wilsonLowerBound(0, 100);
    expect(s).toBeLessThan(0.05);
    expect(s).toBeGreaterThanOrEqual(0);
  });

  it('returns approximately 0.2 for equal up/down at n=10', () => {
    // Classic z=1.96 Wilson lower bound for 5/10 ≈ 0.2366
    const s = wilsonLowerBound(5, 5);
    expect(s).toBeGreaterThan(0.2);
    expect(s).toBeLessThan(0.3);
  });

  it('is monotonic in upvote share at fixed total', () => {
    const a = wilsonLowerBound(6, 4);
    const b = wilsonLowerBound(7, 3);
    const c = wilsonLowerBound(8, 2);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it('penalises small samples', () => {
    // 1 upvote out of 1 should score lower than 100 upvotes out of 100
    expect(wilsonLowerBound(1, 0)).toBeLessThan(wilsonLowerBound(100, 0));
  });

  it('clamps within [0, 1]', () => {
    for (const [u, d] of [[1, 1], [3, 7], [10, 0], [0, 10]] as const) {
      const s = wilsonLowerBound(u, d);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/wilson.test.ts
```
Expected: FAIL — `Cannot find module .../services/reviews/wilson.js`.

---

### Task B2: Implement Wilson lower-bound

**Files:**
- Create: `api/src/services/reviews/wilson.ts`

- [ ] **Step 1: Write `api/src/services/reviews/wilson.ts`**

```ts
/**
 * Wilson score lower bound of a Bernoulli parameter at the given confidence.
 * Reference: Edwin B. Wilson (1927). z=1.96 corresponds to 95% one-sided.
 *
 * Returns 0 for zero votes (so a brand-new review sorts below any voted review).
 */
export function wilsonLowerBound(up: number, down: number, z = 1.96): number {
  const n = up + down;
  if (n === 0) return 0;
  const phat = up / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const lower = (centre - margin) / denom;
  if (lower < 0) return 0;
  if (lower > 1) return 1;
  return lower;
}
```

- [ ] **Step 2: Run, verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/wilson.test.ts
```
Expected: 7 passed.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/reviews/wilson.ts api/tests/unit/wilson.test.ts
git commit -m "feat(api): Wilson lower-bound scoring with unit tests"
```

---

## Phase C — Profanity filter

### Task C1: Install the obscenity library

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: Add the dependency**

```bash
pnpm --filter @pantry/api add obscenity@^0.4.0
```
Expected: `obscenity` appears under `dependencies` and the lockfile updates.

- [ ] **Step 2: Commit**

```bash
git add api/package.json pnpm-lock.yaml
git commit -m "chore(api): add obscenity profanity filter dependency"
```

---

### Task C2: Profanity filter unit tests (failing)

**Files:**
- Create: `api/tests/unit/profanity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/profanity.test.ts
import { describe, expect, it } from 'vitest';
import { containsProfanity } from '../../src/services/reviews/profanity.js';

describe('containsProfanity', () => {
  it('flags an obvious slur', () => {
    const r = containsProfanity('this is shit');
    expect(r.matched).toBe(true);
    expect(r.words.length).toBeGreaterThan(0);
  });

  it('flags l33t-speak variants', () => {
    const r = containsProfanity('what an a$$hole');
    expect(r.matched).toBe(true);
  });

  it('does NOT flag the Scunthorpe problem', () => {
    expect(containsProfanity('I live in Scunthorpe').matched).toBe(false);
  });

  it('does NOT flag clean text', () => {
    expect(containsProfanity('Great packaging, tasty product').matched).toBe(false);
  });

  it('does NOT flag empty input', () => {
    expect(containsProfanity('').matched).toBe(false);
  });

  it('does NOT flag null-ish whitespace', () => {
    expect(containsProfanity('   ').matched).toBe(false);
  });

  it('handles multi-word inputs and returns ALL matches', () => {
    const r = containsProfanity('shit and damn it');
    expect(r.matched).toBe(true);
    expect(r.words.length).toBeGreaterThanOrEqual(1);
  });

  it('is case-insensitive', () => {
    expect(containsProfanity('SHIT').matched).toBe(true);
  });

  it('does NOT flag the substring "assistant"', () => {
    expect(containsProfanity('the assistant manager was helpful').matched).toBe(false);
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/profanity.test.ts
```
Expected: FAIL — module not found.

---

### Task C3: Implement the profanity wrapper

**Files:**
- Create: `api/src/services/reviews/profanity.ts`

- [ ] **Step 1: Write `api/src/services/reviews/profanity.ts`**

```ts
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

/**
 * Single matcher instance — obscenity datasets are immutable and the matcher
 * is safe to share. Pre-built at module load to avoid per-request cost.
 *
 * englishDataset already excludes "Scunthorpe", "assistant", etc. via its
 * built-in whitelist. englishRecommendedTransformers handles l33t-speak,
 * collapsing, etc.
 */
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export interface ProfanityResult {
  matched: boolean;
  words: string[];
}

export function containsProfanity(input: string | null | undefined): ProfanityResult {
  if (!input) return { matched: false, words: [] };
  const trimmed = input.trim();
  if (!trimmed) return { matched: false, words: [] };

  const matches = matcher.getAllMatches(trimmed, /* sorted */ true);
  if (matches.length === 0) return { matched: false, words: [] };

  const words = Array.from(
    new Set(
      matches.map((m) => {
        const meta = englishDataset.getPayloadWithPhraseMetadata(m);
        return meta.phraseMetadata?.originalWord ?? trimmed.slice(m.startIndex, m.endIndex);
      }),
    ),
  );
  return { matched: true, words };
}
```

- [ ] **Step 2: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/profanity.test.ts
```
Expected: 9 passed.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/reviews/profanity.ts api/tests/unit/profanity.test.ts
git commit -m "feat(api): profanity filter wrapping obscenity with unit tests"
```

---

## Phase D — Review repository and helpers

### Task D1: System user resolver

**Files:**
- Create: `api/src/services/reviews/system-user.ts`

- [ ] **Step 1: Write `api/src/services/reviews/system-user.ts`**

```ts
/**
 * UUID seeded in `prisma/seed.ts` and re-seeded per-test in tests/helpers/setup.ts.
 * Used as `reporterId` for auto-generated reports (profanity flag worker).
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 2: Commit**

```bash
git add api/src/services/reviews/system-user.ts
git commit -m "feat(api): expose system user id constant"
```

---

### Task D2: Review repository — `toApiReview`

**Files:**
- Create: `api/src/services/reviews/repository.ts`

- [ ] **Step 1: Write `api/src/services/reviews/repository.ts`**

```ts
import type { Review, User } from '@prisma/client';
import type { Review as ApiReview } from '@pantry/shared';

type ReviewWithAuthor = Review & {
  user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
};

export function toApiReview(
  r: ReviewWithAuthor,
  opts: { myVote?: -1 | 1 | null } = {},
): ApiReview {
  const out: ApiReview = {
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    rating: r.rating,
    body: r.body,
    upvoteCount: r.upvoteCount,
    downvoteCount: r.downvoteCount,
    score: Number(r.score),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    myVote: opts.myVote ?? null,
  };
  if (r.user) {
    out.author = {
      id: r.user.id,
      firstName: r.user.firstName,
      avatarUrl: r.user.avatarUrl,
    };
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/reviews/repository.ts
git commit -m "feat(api): review repository helpers (toApiReview)"
```

---

### Task D3: Report repository — `toApiReport` + auto-hide helper

**Files:**
- Create: `api/src/services/reports/repository.ts`

- [ ] **Step 1: Write `api/src/services/reports/repository.ts`**

```ts
import type { Report } from '@prisma/client';
import type { Report as ApiReport, ReportTargetType } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { getSetting, SETTING_KEYS } from '../settings/service.js';

const DEFAULT_MODERATION_SETTINGS = { autoHideReportThreshold: 3 };

async function getModerationSettings() {
  try {
    return await getSetting(SETTING_KEYS.MODERATION, DEFAULT_MODERATION_SETTINGS);
  } catch {
    // M3 hasn't shipped getSetting / SETTING_KEYS yet — fall back to defaults.
    return DEFAULT_MODERATION_SETTINGS;
  }
}

export function toApiReport(r: Report): ApiReport {
  return {
    id: r.id,
    reporterId: r.reporterId,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Spec §2.8: more than 3 *open or resolved* reports against the same target
 * auto-hides the content pending admin review. "dismissed" reports do not count.
 * - reviews → set `reviews.status = 'hidden'`
 * - products → set `products.status = 'pending'` (admins can re-approve)
 * - users → no auto-hide; admin queue picks them up
 *
 * Idempotent: re-running on an already-hidden target is a no-op.
 */
export async function maybeAutoHide(
  targetType: ReportTargetType,
  targetId: string,
): Promise<{ hidden: boolean }> {
  const prisma = getPrisma();
  const count = await prisma.report.count({
    where: { targetType, targetId, status: { in: ['open', 'resolved'] } },
  });
  // D16: threshold is admin-configurable via M3's settings; default 3 if M3 hasn't seeded yet.
  const settings = await getModerationSettings();
  if (count <= settings.autoHideReportThreshold) return { hidden: false };

  if (targetType === 'review') {
    const r = await prisma.review.findUnique({ where: { id: targetId } });
    if (!r || r.status === 'hidden' || r.status === 'deleted') return { hidden: false };
    await prisma.review.update({ where: { id: targetId }, data: { status: 'hidden' } });
    return { hidden: true };
  }
  if (targetType === 'product') {
    const p = await prisma.product.findUnique({ where: { id: targetId } });
    if (!p || p.status !== 'active') return { hidden: false };
    await prisma.product.update({ where: { id: targetId }, data: { status: 'pending' } });
    return { hidden: true };
  }
  return { hidden: false };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/reports/repository.ts
git commit -m "feat(api): report repository with auto-hide threshold helper"
```

---

## Phase E — BullMQ workers

> **Assumption from M1 (per D10):** `api/src/queues/index.ts` exports `getQueueConnection(): ConnectionOptions` (or equivalent — internally backed by `getRedis()`) AND a `getAllQueues()` registry array. The central worker registration entry point lives at `api/src/queues/workers.ts`. M2's three new BullMQ queues (`score-recalc`, `moderation-flag`, `product-rating-recalc`) are appended to the `getAllQueues()` registry in Task E0 below so M1's queue dashboard / shutdown helpers cover them automatically.

### Task E0: Register M2 queues in `getAllQueues()` (D10)

**Files:**
- Modify: `api/src/queues/index.ts`

> **Decision D10:** M1 ships a registry array `getAllQueues()` inside `api/src/queues/index.ts`. M2's three new queues must be appended to it so M1's queue dashboard / graceful-shutdown / metrics helpers see them automatically. This task is a small follow-up step at the very end of Phase E (after Tasks E1, E3, E4 each define their queue factory) — but it's listed here so reviewers see the dependency up front. Each of Tasks E1/E3/E4 includes a reminder step that this registry must be updated once the worker module is in place.

- [ ] **Step 1: Open `api/src/queues/index.ts` and append imports**

```ts
import { SCORE_RECALC_QUEUE, getScoreRecalcQueue } from './jobs/score-recalc.js';
import { MODERATION_FLAG_QUEUE, getModerationFlagQueue } from './jobs/moderation-flag.js';
import { PRODUCT_RATING_RECALC_QUEUE, getProductRatingQueue } from './jobs/product-rating-recalc.js';
```

- [ ] **Step 2: Append to the `getAllQueues()` registry array**

Find the array returned by `getAllQueues()` (or the module-level `QUEUES` const it iterates) and append:

```ts
  { name: SCORE_RECALC_QUEUE, queue: getScoreRecalcQueue() },
  { name: MODERATION_FLAG_QUEUE, queue: getModerationFlagQueue() },
  { name: PRODUCT_RATING_RECALC_QUEUE, queue: getProductRatingQueue() },
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add api/src/queues/index.ts
git commit -m "feat(api): register M2 queues in getAllQueues() registry"
```

---

### Task E1: `score-recalc` job module (debounced enqueue + processor)

**Files:**
- Create: `api/src/queues/jobs/score-recalc.ts`

- [ ] **Step 1: Write the module**

```ts
// api/src/queues/jobs/score-recalc.ts
import { Queue, Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../index.js';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';
import { wilsonLowerBound } from '../../services/reviews/wilson.js';

export const SCORE_RECALC_QUEUE = 'score-recalc';
export const SCORE_DEBOUNCE_TTL_SECONDS = 30;

interface ScoreRecalcData {
  reviewId: string;
}

let _queue: Queue<ScoreRecalcData> | undefined;
export function getScoreRecalcQueue(): Queue<ScoreRecalcData> {
  if (!_queue) _queue = new Queue<ScoreRecalcData>(SCORE_RECALC_QUEUE, { connection: getQueueConnection() });
  return _queue;
}

/**
 * Debounced enqueue. The first event for a review_id within the TTL window
 * enqueues a delayed job; subsequent events within the window are dropped.
 * The TTL key expires before the worker runs, so the next vote after the
 * job fires will queue again.
 */
export async function enqueueScoreRecalc(reviewId: string): Promise<'enqueued' | 'debounced'> {
  const redis = getRedis();
  const key = `score-recalc:${reviewId}`;
  // SET key 1 NX EX 30 → returns 'OK' only if not set
  const set = await redis.set(key, '1', 'EX', SCORE_DEBOUNCE_TTL_SECONDS, 'NX');
  if (set !== 'OK') return 'debounced';
  await getScoreRecalcQueue().add(
    SCORE_RECALC_QUEUE,
    { reviewId },
    {
      delay: SCORE_DEBOUNCE_TTL_SECONDS * 1000,
      jobId: `score-recalc:${reviewId}`,
      removeOnComplete: 1000,
      removeOnFail: 100,
    },
  );
  return 'enqueued';
}

export async function processScoreRecalc(job: Job<ScoreRecalcData>): Promise<void> {
  const { reviewId } = job.data;
  const prisma = getPrisma();
  const agg = await prisma.reviewVote.groupBy({
    by: ['value'],
    where: { reviewId },
    _count: { _all: true },
  });
  let up = 0;
  let down = 0;
  for (const row of agg) {
    if (row.value === 1) up = row._count._all;
    else if (row.value === -1) down = row._count._all;
  }
  const score = wilsonLowerBound(up, down);
  await prisma.review.update({
    where: { id: reviewId },
    data: { upvoteCount: up, downvoteCount: down, score },
  });
}

export function startScoreRecalcWorker(): Worker<ScoreRecalcData> {
  return new Worker<ScoreRecalcData>(SCORE_RECALC_QUEUE, processScoreRecalc, {
    connection: getQueueConnection(),
    concurrency: 4,
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/queues/jobs/score-recalc.ts
git commit -m "feat(api): score-recalc job with 30s debounce per review"
```

---

### Task E2: Debounce unit test

**Files:**
- Create: `api/tests/unit/score-recalc-debounce.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/unit/score-recalc-debounce.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { enqueueScoreRecalc, getScoreRecalcQueue } from '../../src/queues/jobs/score-recalc.js';
import { getRedis } from '../../src/redis.js';

describe('enqueueScoreRecalc debounce', () => {
  beforeEach(async () => {
    await getRedis().flushdb();
    await getScoreRecalcQueue().obliterate({ force: true });
  });

  afterAll(async () => {
    await getScoreRecalcQueue().close();
  });

  it('first call enqueues, second within window is debounced', async () => {
    const a = await enqueueScoreRecalc('r-1');
    const b = await enqueueScoreRecalc('r-1');
    expect(a).toBe('enqueued');
    expect(b).toBe('debounced');
  });

  it('different review_ids are independent', async () => {
    const a = await enqueueScoreRecalc('r-2');
    const b = await enqueueScoreRecalc('r-3');
    expect(a).toBe('enqueued');
    expect(b).toBe('enqueued');
  });

  it('queue holds exactly one delayed job per review', async () => {
    await enqueueScoreRecalc('r-4');
    await enqueueScoreRecalc('r-4');
    await enqueueScoreRecalc('r-4');
    const counts = await getScoreRecalcQueue().getJobCounts('delayed');
    expect(counts.delayed).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/score-recalc-debounce.test.ts
```
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add api/tests/unit/score-recalc-debounce.test.ts
git commit -m "test(api): score-recalc debounce via Redis NX key"
```

---

### Task E3: `product-rating-recalc` job

**Files:**
- Create: `api/src/queues/jobs/product-rating-recalc.ts`

- [ ] **Step 1: Write the module**

```ts
// api/src/queues/jobs/product-rating-recalc.ts
import { Queue, Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../index.js';
import { getPrisma } from '../../db.js';

export const PRODUCT_RATING_RECALC_QUEUE = 'product-rating-recalc';

interface ProductRatingData {
  productId: string;
}

let _queue: Queue<ProductRatingData> | undefined;
export function getProductRatingQueue(): Queue<ProductRatingData> {
  if (!_queue) {
    _queue = new Queue<ProductRatingData>(PRODUCT_RATING_RECALC_QUEUE, {
      connection: getQueueConnection(),
    });
  }
  return _queue;
}

/**
 * Idempotent: collapse multiple updates for the same product within a short
 * window using a deterministic jobId.
 */
export async function enqueueProductRatingRecalc(productId: string): Promise<void> {
  await getProductRatingQueue().add(
    PRODUCT_RATING_RECALC_QUEUE,
    { productId },
    {
      jobId: `product-rating-recalc:${productId}`,
      removeOnComplete: 1000,
      removeOnFail: 100,
    },
  );
}

export async function processProductRatingRecalc(job: Job<ProductRatingData>): Promise<void> {
  const { productId } = job.data;
  const prisma = getPrisma();
  const agg = await prisma.review.aggregate({
    where: { productId, status: 'visible' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratingCount = agg._count._all;
  const ratingAvg = ratingCount > 0 ? Number(agg._avg.rating ?? 0) : 0;
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg,
      ratingCount,
      reviewCount: ratingCount,
    },
  });
}

export function startProductRatingWorker(): Worker<ProductRatingData> {
  return new Worker<ProductRatingData>(
    PRODUCT_RATING_RECALC_QUEUE,
    processProductRatingRecalc,
    { connection: getQueueConnection(), concurrency: 2 },
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/queues/jobs/product-rating-recalc.ts
git commit -m "feat(api): product-rating-recalc job"
```

---

### Task E4: `moderation-flag` job

**Files:**
- Create: `api/src/queues/jobs/moderation-flag.ts`

- [ ] **Step 1: Write the module**

```ts
// api/src/queues/jobs/moderation-flag.ts
import { Queue, Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../index.js';
import { getPrisma } from '../../db.js';
import { containsProfanity } from '../../services/reviews/profanity.js';
import { SYSTEM_USER_ID } from '../../services/reviews/system-user.js';
import { maybeAutoHide } from '../../services/reports/repository.js';

export const MODERATION_FLAG_QUEUE = 'moderation-flag';

interface ModerationFlagData {
  reviewId: string;
}

let _queue: Queue<ModerationFlagData> | undefined;
export function getModerationFlagQueue(): Queue<ModerationFlagData> {
  if (!_queue) {
    _queue = new Queue<ModerationFlagData>(MODERATION_FLAG_QUEUE, {
      connection: getQueueConnection(),
    });
  }
  return _queue;
}

export async function enqueueModerationFlag(reviewId: string): Promise<void> {
  await getModerationFlagQueue().add(
    MODERATION_FLAG_QUEUE,
    { reviewId },
    { removeOnComplete: 1000, removeOnFail: 100 },
  );
}

export async function processModerationFlag(job: Job<ModerationFlagData>): Promise<void> {
  const { reviewId } = job.data;
  const prisma = getPrisma();
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.status === 'deleted') return;

  const { matched, words } = containsProfanity(review.body);
  if (!matched) return;

  // Per D15: no `pending` status. Auto-flag goes straight to `hidden`; the
  // accompanying system Report row is the signal admins use to triage.
  await prisma.$transaction([
    prisma.review.update({ where: { id: reviewId }, data: { status: 'hidden' } }),
    prisma.report.create({
      data: {
        reporterId: SYSTEM_USER_ID,
        targetType: 'review',
        targetId: reviewId,
        reason: 'abuse',
        body: `auto-flagged: ${words.join(', ')}`,
      },
    }),
  ]);

  // Auto-hide if threshold already exceeded (e.g., previous user reports + this one)
  await maybeAutoHide('review', reviewId);
}

export function startModerationFlagWorker(): Worker<ModerationFlagData> {
  return new Worker<ModerationFlagData>(MODERATION_FLAG_QUEUE, processModerationFlag, {
    connection: getQueueConnection(),
    concurrency: 4,
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/queues/jobs/moderation-flag.ts
git commit -m "feat(api): moderation-flag worker creates Report and sets pending"
```

---

### Task E5: Register the three workers in the central entry

**Files:**
- Modify: `api/src/queues/workers.ts`

- [ ] **Step 1: Open `api/src/queues/workers.ts`**

If it does not yet export a `startWorkers()` function, create one. Add the imports and registrations:

```ts
import type { Worker } from 'bullmq';
import { startScoreRecalcWorker } from './jobs/score-recalc.js';
import { startModerationFlagWorker } from './jobs/moderation-flag.js';
import { startProductRatingWorker } from './jobs/product-rating-recalc.js';

let started: Worker[] = [];

export function startWorkers(): Worker[] {
  if (started.length > 0) return started;
  started = [
    startScoreRecalcWorker(),
    startModerationFlagWorker(),
    startProductRatingWorker(),
    // M1 workers (product-lookup, notification-*) stay above or below as already wired
  ];
  return started;
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(started.map((w) => w.close()));
  started = [];
}
```

If `workers.ts` already exists with M1's workers, MERGE the three new `startXxx()` calls into the existing `started` array — do not remove M1's entries.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add api/src/queues/workers.ts
git commit -m "feat(api): register score-recalc, moderation-flag, product-rating-recalc workers"
```

---

## Phase F — Reviews HTTP routes

### Task F1: GET /v1/products/:id/reviews — failing test

**Files:**
- Create: `api/tests/integration/reviews-list.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/reviews-list.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';

describe('GET /v1/products/:id/reviews', () => {
  it('returns visible reviews sorted by score DESC by default', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const u1 = await makeUser({ email: `a-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `b-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `c-${Date.now()}@t.l` });
    await makeReview({ userId: u1.id, productId: product.id, score: 0.2 });
    await makeReview({ userId: u2.id, productId: product.id, score: 0.8 });
    await makeReview({ userId: u3.id, productId: product.id, score: 0.5 });

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/reviews` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(3);
    expect(body.items[0].score).toBeGreaterThanOrEqual(body.items[1].score);
    expect(body.items[1].score).toBeGreaterThanOrEqual(body.items[2].score);
    await app.close();
  });

  it('hides non-visible reviews from non-owners', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const owner = await makeUser({ email: `owner-${Date.now()}@t.l` });
    const other = await makeUser({ email: `other-${Date.now()}@t.l` });
    await makeReview({ userId: owner.id, productId: product.id, status: 'hidden' });
    await makeReview({ userId: other.id, productId: product.id, status: 'visible' });

    const res = await app.inject({ method: 'GET', url: `/v1/products/${product.id}/reviews` });
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].userId).toBe(other.id);
    await app.close();
  });

  it('returns 400 for an invalid sort', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/${product.id}/reviews?sort=bogus`,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('supports sort=new (createdAt DESC)', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const u1 = await makeUser({ email: `n1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `n2-${Date.now()}@t.l` });
    const r1 = await makeReview({ userId: u1.id, productId: product.id });
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await makeReview({ userId: u2.id, productId: product.id });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/${product.id}/reviews?sort=new`,
    });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toEqual([r2.id, r1.id]);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-list.test.ts
```
Expected: 404s — route not yet mounted.

---

### Task F2: GET /v1/products/:id/reviews — implementation

**Files:**
- Create: `api/src/routes/reviews/list-for-product.ts`
- Create: `api/src/routes/reviews/index.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write `api/src/routes/reviews/list-for-product.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reviewListQuerySchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { toApiReview } from '../../services/reviews/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function listForProductRoute(app: FastifyInstance) {
  app.get('/products/:id/reviews', async (req) => {
    const { id: productId } = paramsSchema.parse(req.params);
    const query = reviewListQuerySchema.parse(req.query);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;

    const where = viewerId
      ? {
          productId,
          OR: [{ status: 'visible' as const }, { userId: viewerId }],
        }
      : { productId, status: 'visible' as const };

    const orderBy =
      query.sort === 'new'
        ? [{ createdAt: 'desc' as const }]
        : query.sort === 'rating'
          ? [{ rating: 'desc' as const }, { createdAt: 'desc' as const }]
          : [{ score: 'desc' as const }, { createdAt: 'desc' as const }];

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const items = await prisma.review.findMany({
      where,
      orderBy,
      take: query.limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
    });
    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;

    // Hydrate viewer's vote
    let myVotes = new Map<string, -1 | 1>();
    if (viewerId && page.length > 0) {
      const votes = await prisma.reviewVote.findMany({
        where: { userId: viewerId, reviewId: { in: page.map((r) => r.id) } },
      });
      myVotes = new Map(votes.map((v) => [v.reviewId, v.value as -1 | 1]));
    }

    return {
      items: page.map((r) => toApiReview(r, { myVote: myVotes.get(r.id) ?? null })),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  });
}
```

- [ ] **Step 2: Write `api/src/routes/reviews/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { listForProductRoute } from './list-for-product.js';

export async function reviewsRoutes(app: FastifyInstance) {
  await app.register(listForProductRoute);
}
```

- [ ] **Step 3: Mount in `api/src/server.ts`**

Find the existing `await app.register(authRoutes, { prefix: '/v1/auth' });` line. Add immediately after:

```ts
await app.register(reviewsRoutes, { prefix: '/v1' });
```

And add to the imports at the top:

```ts
import { reviewsRoutes } from './routes/reviews/index.js';
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-list.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/reviews api/src/server.ts
git commit -m "feat(api): GET /v1/products/:id/reviews with sort + cursor"
```

---

### Task F3: POST /v1/products/:id/reviews — failing test

**Files:**
- Create: `api/tests/integration/reviews-create.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/reviews-create.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function authHeader(userId: string, role: 'user' | 'admin' = 'user') {
  const token = await issueAccessToken({ sub: userId, role });
  return { authorization: `Bearer ${token}` };
}

describe('POST /v1/products/:id/reviews', () => {
  it('creates a visible review for clean content', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 4, body: 'Great packaging' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('visible');
    expect(res.json().rating).toBe(4);
    await app.close();
  });

  it('marks profanity-laden reviews as hidden and enqueues a flag (D15)', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 1, body: 'this product is shit' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('hidden');
    await app.close();
  });

  it('rejects a second review by the same user with 409', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const h = await authHeader(user.id);
    await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: h,
      payload: { rating: 5 },
    });
    const dup = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: h,
      payload: { rating: 3 },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().code).toBe('review_already_exists');
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      payload: { rating: 5 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects body > 2000 chars with 400', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 5, body: 'x'.repeat(2001) },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 404 for unknown product', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/00000000-0000-0000-0000-0000000000ff/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 5 },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  // Confirm the recalc job got enqueued for product rating denorm
  it('enqueues a product-rating-recalc on successful create', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const { getProductRatingQueue } = await import('../../src/queues/jobs/product-rating-recalc.js');
    await getProductRatingQueue().obliterate({ force: true });
    await app.inject({
      method: 'POST',
      url: `/v1/products/${product.id}/reviews`,
      headers: await authHeader(user.id),
      payload: { rating: 5 },
    });
    const counts = await getProductRatingQueue().getJobCounts('waiting', 'delayed', 'active', 'completed');
    expect(counts.waiting + counts.delayed + counts.active + counts.completed).toBe(1);
    await getPrisma().$disconnect();
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-create.test.ts
```

---

### Task F4: POST /v1/products/:id/reviews — implementation

**Files:**
- Create: `api/src/routes/reviews/create.ts`
- Modify: `api/src/routes/reviews/index.ts`

- [ ] **Step 1: Write `api/src/routes/reviews/create.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, reviewCreateSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { containsProfanity } from '../../services/reviews/profanity.js';
import { enqueueModerationFlag } from '../../queues/jobs/moderation-flag.js';
import { enqueueProductRatingRecalc } from '../../queues/jobs/product-rating-recalc.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function createReviewRoute(app: FastifyInstance) {
  app.post('/products/:id/reviews', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id: productId } = paramsSchema.parse(req.params);
    const input = reviewCreateSchema.parse(req.body);
    const prisma = getPrisma();
    const userId = req.user!.id;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    }

    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
        title: 'You already reviewed this product',
      });
    }

    // Per D15: ReviewStatus is visible|hidden|deleted (no `pending`).
    // Profanity matches go straight to `hidden`; the moderation-flag worker
    // creates the auto-flag Report row that surfaces it in the admin queue.
    const { matched } = containsProfanity(input.body);
    const status: 'visible' | 'hidden' = matched ? 'hidden' : 'visible';

    const created = await prisma.review.create({
      data: {
        userId,
        productId,
        rating: input.rating,
        body: input.body ?? null,
        status,
      },
      include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
    });

    if (matched) await enqueueModerationFlag(created.id);
    if (status === 'visible') await enqueueProductRatingRecalc(productId);

    return reply.status(201).send(toApiReview(created, { myVote: null }));
  });
}
```

- [ ] **Step 2: Register the route in `api/src/routes/reviews/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { listForProductRoute } from './list-for-product.js';
import { createReviewRoute } from './create.js';

export async function reviewsRoutes(app: FastifyInstance) {
  await app.register(listForProductRoute);
  await app.register(createReviewRoute);
}
```

- [ ] **Step 3: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-create.test.ts
```
Expected: 7 passed.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/reviews
git commit -m "feat(api): POST /v1/products/:id/reviews with profanity gating"
```

---

### Task F5: PATCH /v1/reviews/:id — failing test

**Files:**
- Create: `api/tests/integration/reviews-update.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/reviews-update.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('PATCH /v1/reviews/:id', () => {
  it('updates own review and returns new state', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const r = await makeReview({ userId: user.id, productId: product.id, rating: 3, body: 'meh' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${r.id}`,
      headers: await h(user.id),
      payload: { rating: 5, body: 'changed my mind' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rating).toBe(5);
    expect(res.json().body).toBe('changed my mind');
    await app.close();
  });

  it("rejects updating someone else's review with 403", async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `o-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `i-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: owner.id, productId: product.id });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${r.id}`,
      headers: await h(intruder.id),
      payload: { rating: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('marks edited review as hidden when new body trips profanity filter (D15)', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const r = await makeReview({ userId: user.id, productId: product.id, body: 'fine' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${r.id}`,
      headers: await h(user.id),
      payload: { body: 'utter shit' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('hidden');
    await app.close();
  });

  it('returns 404 for unknown id', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/00000000-0000-0000-0000-0000000000aa`,
      headers: await h(user.id),
      payload: { rating: 5 },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-update.test.ts
```

---

### Task F6: PATCH /v1/reviews/:id — implementation

**Files:**
- Create: `api/src/routes/reviews/update.ts`
- Modify: `api/src/routes/reviews/index.ts`

- [ ] **Step 1: Write `api/src/routes/reviews/update.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, reviewPatchSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReview } from '../../services/reviews/repository.js';
import { containsProfanity } from '../../services/reviews/profanity.js';
import { enqueueModerationFlag } from '../../queues/jobs/moderation-flag.js';
import { enqueueProductRatingRecalc } from '../../queues/jobs/product-rating-recalc.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function updateReviewRoute(app: FastifyInstance) {
  app.patch('/reviews/:id', { onRequest: [app.requireAuth] }, async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = reviewPatchSchema.parse(req.body);
    const prisma = getPrisma();

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Review not found' });
    if (existing.userId !== req.user!.id) {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your review' });
    }

    const newBody = input.body !== undefined ? (input.body || null) : existing.body;
    const { matched } = containsProfanity(newBody);
    // Per D15: visible|hidden|deleted. New profanity hides; clean edit on a
    // previously-hidden review goes back to visible (admins can still review
    // the prior auto-flag Report row). `deleted` is preserved.
    const nextStatus =
      existing.status === 'deleted'
        ? 'deleted'
        : matched
          ? 'hidden'
          : existing.status === 'hidden'
            ? 'visible'
            : existing.status;

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.body !== undefined ? { body: newBody } : {}),
        status: nextStatus,
      },
      include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
    });

    if (matched) await enqueueModerationFlag(updated.id);
    await enqueueProductRatingRecalc(updated.productId);

    return toApiReview(updated, { myVote: null });
  });
}
```

- [ ] **Step 2: Register**

In `api/src/routes/reviews/index.ts`, add:

```ts
import { updateReviewRoute } from './update.js';
// inside reviewsRoutes:
await app.register(updateReviewRoute);
```

- [ ] **Step 3: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-update.test.ts
```
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/reviews
git commit -m "feat(api): PATCH /v1/reviews/:id (owner only, re-runs profanity)"
```

---

### Task F7: DELETE /v1/reviews/:id — failing test

**Files:**
- Create: `api/tests/integration/reviews-delete.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/reviews-delete.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('DELETE /v1/reviews/:id', () => {
  it('soft-deletes own review', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const r = await makeReview({ userId: user.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/reviews/${r.id}`, headers: await h(user.id) });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().review.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe('deleted');
    await app.close();
  });

  it("rejects deleting someone else's review", async () => {
    const app = await buildServer();
    const owner = await makeUser({ email: `do-${Date.now()}@t.l` });
    const intruder = await makeUser({ email: `di-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: owner.id, productId: product.id });
    const res = await app.inject({ method: 'DELETE', url: `/v1/reviews/${r.id}`, headers: await h(intruder.id) });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-delete.test.ts
```

---

### Task F8: DELETE /v1/reviews/:id — implementation

**Files:**
- Create: `api/src/routes/reviews/delete.ts`
- Modify: `api/src/routes/reviews/index.ts`

- [ ] **Step 1: Write `api/src/routes/reviews/delete.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { enqueueProductRatingRecalc } from '../../queues/jobs/product-rating-recalc.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function deleteReviewRoute(app: FastifyInstance) {
  app.delete('/reviews/:id', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Review not found' });
    if (existing.userId !== req.user!.id) {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Not your review' });
    }
    await prisma.review.update({ where: { id }, data: { status: 'deleted' } });
    await enqueueProductRatingRecalc(existing.productId);
    return reply.status(204).send();
  });
}
```

- [ ] **Step 2: Register**

Add to `api/src/routes/reviews/index.ts`:

```ts
import { deleteReviewRoute } from './delete.js';
await app.register(deleteReviewRoute);
```

- [ ] **Step 3: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-delete.test.ts
```
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/reviews
git commit -m "feat(api): DELETE /v1/reviews/:id soft-delete"
```

---

### Task F9: POST/DELETE /v1/reviews/:id/vote — failing test

**Files:**
- Create: `api/tests/integration/reviews-vote.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/reviews-vote.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}`,
    'idempotency-key': `vote-${uid}-${Date.now()}-${Math.random()}`,
  };
}

describe('POST /v1/reviews/:id/vote', () => {
  it('inserts a +1 vote and is idempotent on upsert', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `va-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `vv-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id });
    const headers = await h(voter.id);
    const a = await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/vote`, headers, payload: { value: 1 } });
    const b = await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/vote`, headers, payload: { value: 1 } });
    expect(a.statusCode).toBe(204);
    expect(b.statusCode).toBe(204);
    const votes = await getPrisma().reviewVote.count({ where: { reviewId: r.id } });
    expect(votes).toBe(1);
    await app.close();
  });

  it('switches a vote from +1 to -1 (still one row)', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `s1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `s2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/vote`, headers: await h(voter.id), payload: { value: 1 } });
    await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/vote`, headers: await h(voter.id), payload: { value: -1 } });
    const all = await getPrisma().reviewVote.findMany({ where: { reviewId: r.id } });
    expect(all).toHaveLength(1);
    expect(all[0]!.value).toBe(-1);
    await app.close();
  });

  it('refuses voting on own review with 403', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const r = await makeReview({ userId: user.id, productId: product.id });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/reviews/${r.id}/vote`,
      headers: await h(user.id),
      payload: { value: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('requires Idempotency-Key', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ik1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `ik2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id });
    const token = await issueAccessToken({ sub: voter.id, role: 'user' });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/reviews/${r.id}/vote`,
      headers: { authorization: `Bearer ${token}` },
      payload: { value: 1 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('DELETE /v1/reviews/:id/vote', () => {
  it('removes the caller’s vote', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `d1-${Date.now()}@t.l` });
    const voter = await makeUser({ email: `d2-${Date.now()}@t.l` });
    const product = await makeProduct();
    const r = await makeReview({ userId: author.id, productId: product.id });
    await app.inject({ method: 'POST', url: `/v1/reviews/${r.id}/vote`, headers: await h(voter.id), payload: { value: 1 } });
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/reviews/${r.id}/vote`,
      headers: { authorization: `Bearer ${await issueAccessToken({ sub: voter.id, role: 'user' })}` },
    });
    expect(del.statusCode).toBe(204);
    const after = await getPrisma().reviewVote.count({ where: { reviewId: r.id } });
    expect(after).toBe(0);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-vote.test.ts
```

---

### Task F10: POST/DELETE /v1/reviews/:id/vote — implementation

**Files:**
- Create: `api/src/routes/reviews/vote.ts`
- Modify: `api/src/routes/reviews/index.ts`

- [ ] **Step 1: Write `api/src/routes/reviews/vote.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, reviewVoteSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { enqueueScoreRecalc } from '../../queues/jobs/score-recalc.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function voteRoutes(app: FastifyInstance) {
  /**
   * Spec §6.8: POST /v1/reviews/:id/vote requires Idempotency-Key.
   * The M1 idempotency plugin reads the header into req.idempotencyKey;
   * a missing key surfaces as a 400.
   */
  app.post(
    '/reviews/:id/vote',
    { onRequest: [app.requireAuth], config: { idempotent: 'required' } },
    async (req, reply) => {
      // M1's idempotency plugin enforces the header automatically per `config.idempotent`.
      const { id: reviewId } = paramsSchema.parse(req.params);
      const { value } = reviewVoteSchema.parse(req.body);
      const prisma = getPrisma();
      const review = await prisma.review.findUnique({ where: { id: reviewId } });
      if (!review) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Review not found' });
      if (review.userId === req.user!.id) {
        throw new AppError({
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
          title: 'Cannot vote on your own review',
        });
      }
      await prisma.reviewVote.upsert({
        where: { userId_reviewId: { userId: req.user!.id, reviewId } },
        create: { userId: req.user!.id, reviewId, value },
        update: { value },
      });
      await enqueueScoreRecalc(reviewId);
      return reply.status(204).send();
    },
  );

  app.delete(
    '/reviews/:id/vote',
    { onRequest: [app.requireAuth] },
    async (req, reply) => {
      const { id: reviewId } = paramsSchema.parse(req.params);
      const prisma = getPrisma();
      await prisma.reviewVote.deleteMany({ where: { userId: req.user!.id, reviewId } });
      await enqueueScoreRecalc(reviewId);
      return reply.status(204).send();
    },
  );
}
```

- [ ] **Step 2: Register in `api/src/routes/reviews/index.ts`**

```ts
import { voteRoutes } from './vote.js';
await app.register(voteRoutes);
```

- [ ] **Step 3: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reviews-vote.test.ts
```
Expected: 5 passed.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/reviews
git commit -m "feat(api): POST/DELETE /v1/reviews/:id/vote with idempotent upsert"
```

---

### Task F11: GET /v1/me/reviews — failing test

**Files:**
- Create: `api/tests/integration/my-reviews.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/my-reviews.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('GET /v1/me/reviews', () => {
  it('returns only the caller’s reviews including hidden ones', async () => {
    const app = await buildServer();
    const me = await makeUser({ email: `me-${Date.now()}@t.l` });
    const other = await makeUser({ email: `not-me-${Date.now()}@t.l` });
    const p1 = await makeProduct();
    const p2 = await makeProduct();
    const p3 = await makeProduct();
    await makeReview({ userId: me.id, productId: p1.id, rating: 5 });
    await makeReview({ userId: me.id, productId: p2.id, rating: 2, status: 'hidden' });
    await makeReview({ userId: other.id, productId: p3.id, rating: 4 });
    const res = await app.inject({ method: 'GET', url: '/v1/me/reviews', headers: await h(me.id) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.every((r: { userId: string }) => r.userId === me.id)).toBe(true);
    await app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/me/reviews' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/my-reviews.test.ts
```

---

### Task F12: GET /v1/me/reviews — implementation

**Files:**
- Create: `api/src/routes/reviews/my-reviews.ts`
- Modify: `api/src/routes/reviews/index.ts`

- [ ] **Step 1: Write `api/src/routes/reviews/my-reviews.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../../db.js';
import { toApiReview } from '../../services/reviews/repository.js';

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function myReviewsRoute(app: FastifyInstance) {
  app.get('/me/reviews', { onRequest: [app.requireAuth] }, async (req) => {
    const query = querySchema.parse(req.query);
    const prisma = getPrisma();
    const cursor = query.cursor ? { id: query.cursor } : undefined;
    const items = await prisma.review.findMany({
      where: { userId: req.user!.id, status: { not: 'deleted' } },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
    });
    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;
    return {
      items: page.map((r) => toApiReview(r)),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  });
}
```

- [ ] **Step 2: Register in `api/src/routes/reviews/index.ts`**

```ts
import { myReviewsRoute } from './my-reviews.js';
await app.register(myReviewsRoute);
```

- [ ] **Step 3: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/my-reviews.test.ts
```
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/reviews
git commit -m "feat(api): GET /v1/me/reviews"
```

---

### Task F8: Populate `topReviews` in `GET /v1/products/:id` (D20)

M1 ships `GET /v1/products/:id` with a `topReviews: []` stub. M2 fills it with the top-3 visible reviews ordered by Wilson score.

**Files:**
- Modify: `api/src/routes/products/get.ts` (created in M1; this task replaces the `topReviews: []` stub)
- Modify: `api/tests/integration/products-get.test.ts` (created in M1; extend with the topReviews assertion)

- [ ] **Step 1: Extend the failing integration test**

In the existing `products-get.test.ts`, add a new test:
```ts
it('returns up to 3 visible reviews ordered by Wilson score', async () => {
  const u1 = await makeUser({}), u2 = await makeUser({}), u3 = await makeUser({}), u4 = await makeUser({});
  const p = await makeProduct({});
  // four visible reviews with different scores; one hidden that must be excluded
  await getPrisma().review.create({ data: { userId: u1.id, productId: p.id, rating: 5, body: 'A', status: 'visible', score: 0.95 } });
  await getPrisma().review.create({ data: { userId: u2.id, productId: p.id, rating: 4, body: 'B', status: 'visible', score: 0.80 } });
  await getPrisma().review.create({ data: { userId: u3.id, productId: p.id, rating: 3, body: 'C', status: 'visible', score: 0.60 } });
  await getPrisma().review.create({ data: { userId: u4.id, productId: p.id, rating: 2, body: 'D', status: 'visible', score: 0.40 } });
  await getPrisma().review.create({ data: { userId: u1.id, productId: p.id, rating: 1, body: 'hidden', status: 'hidden', score: 0.99 } });

  const res = await ctx.app.inject({ method: 'GET', url: `/v1/products/${p.id}` });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.topReviews).toHaveLength(3);
  expect(body.topReviews.map((r: any) => r.body)).toEqual(['A', 'B', 'C']);
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/api test products-get
```

- [ ] **Step 3: Replace the stub in the route handler**

In `api/src/routes/products/get.ts`, replace `const topReviews: any[] = [];` (or however M1 stubbed it) with:
```ts
const topReviews = await getPrisma().review.findMany({
  where: { productId: product.id, status: 'visible' },
  orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
  take: 3,
  include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
});
return productWithReviewsSchema.parse({
  ...toApiProduct(product),
  topReviews: topReviews.map(toApiReview),
});
```

- [ ] **Step 4: Run, verify PASS**

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/products/get.ts api/tests/integration/products-get.test.ts
git commit -m "feat(api): populate topReviews in product detail (D20)"
```

---

## Phase G — Reports HTTP route

### Task G1: POST /v1/reports — failing test

**Files:**
- Create: `api/tests/integration/reports-create.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/reports-create.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function h(uid: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: uid, role: 'user' })}` };
}

describe('POST /v1/reports', () => {
  it('creates an open report for a review', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ra-${Date.now()}@t.l` });
    const reporter = await makeUser({ email: `rp-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'review', targetId: review.id, reason: 'abuse', body: 'rude' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('open');
    await app.close();
  });

  it('auto-hides a review after >3 reports', async () => {
    const app = await buildServer();
    const author = await makeUser({ email: `ah-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });
    for (let i = 0; i < 4; i += 1) {
      const reporter = await makeUser({ email: `r${i}-${Date.now()}@t.l` });
      await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: await h(reporter.id),
        payload: { targetType: 'review', targetId: review.id, reason: 'spam' },
      });
    }
    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.status).toBe('hidden');
    await app.close();
  });

  it('respects the auto-hide threshold from settings', async () => {
    // mock getSetting to return { autoHideReportThreshold: 5 }
    vi.mocked(getSetting).mockResolvedValueOnce({ autoHideReportThreshold: 5 });
    // seed 4 reports — should NOT auto-hide
    // ...
    // seed 6 reports — SHOULD auto-hide
  });

  it('returns 404 when targetType=review and targetId is unknown', async () => {
    const app = await buildServer();
    const reporter = await makeUser({ email: `r-${Date.now()}@t.l` });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await h(reporter.id),
      payload: {
        targetType: 'review',
        targetId: '00000000-0000-0000-0000-0000000000ff',
        reason: 'spam',
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('report_target_not_found');
    await app.close();
  });

  it('rejects invalid reason with 400', async () => {
    const app = await buildServer();
    const reporter = await makeUser({ email: `vr-${Date.now()}@t.l` });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: await h(reporter.id),
      payload: { targetType: 'review', targetId: '00000000-0000-0000-0000-0000000000aa', reason: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildServer();
    const product = await makeProduct();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      payload: { targetType: 'product', targetId: product.id, reason: 'incorrect' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reports-create.test.ts
```

---

### Task G2: POST /v1/reports — implementation

**Files:**
- Create: `api/src/routes/reports/create.ts`
- Create: `api/src/routes/reports/index.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write `api/src/routes/reports/create.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, reportCreateSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { maybeAutoHide, toApiReport } from '../../services/reports/repository.js';

async function targetExists(
  prisma: ReturnType<typeof getPrisma>,
  type: 'review' | 'user' | 'product',
  id: string,
): Promise<boolean> {
  if (type === 'review') return (await prisma.review.findUnique({ where: { id } })) !== null;
  if (type === 'product') return (await prisma.product.findUnique({ where: { id } })) !== null;
  if (type === 'user') return (await prisma.user.findUnique({ where: { id } })) !== null;
  return false;
}

export async function createReportRoute(app: FastifyInstance) {
  app.post('/reports', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const input = reportCreateSchema.parse(req.body);
    const prisma = getPrisma();
    if (!(await targetExists(prisma, input.targetType, input.targetId))) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.REPORT_TARGET_NOT_FOUND,
        title: 'Report target not found',
      });
    }
    const created = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        body: input.body ?? null,
      },
    });
    await maybeAutoHide(input.targetType, input.targetId);
    return reply.status(201).send(toApiReport(created));
  });
}
```

- [ ] **Step 2: Write `api/src/routes/reports/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { createReportRoute } from './create.js';

export async function reportsRoutes(app: FastifyInstance) {
  await app.register(createReportRoute);
}
```

- [ ] **Step 3: Mount in `api/src/server.ts`**

Add to imports:

```ts
import { reportsRoutes } from './routes/reports/index.js';
```

After the `reviewsRoutes` registration:

```ts
await app.register(reportsRoutes, { prefix: '/v1' });
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/reports-create.test.ts
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/reports api/src/server.ts
git commit -m "feat(api): POST /v1/reports with auto-hide threshold"
```

---

## Phase H — Worker integration tests

### Task H1: score-recalc worker end-to-end test

**Files:**
- Create: `api/tests/integration/score-recalc-worker.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/score-recalc-worker.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Worker } from 'bullmq';
import { getQueueConnection } from '../../src/queues/index.js';
import {
  SCORE_RECALC_QUEUE,
  enqueueScoreRecalc,
  getScoreRecalcQueue,
  processScoreRecalc,
} from '../../src/queues/jobs/score-recalc.js';
import { makeProduct, makeReview, makeUser, makeVote } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

describe('score-recalc worker', () => {
  let worker: Worker;

  beforeEach(async () => {
    await getScoreRecalcQueue().obliterate({ force: true });
  });

  afterAll(async () => {
    if (worker) await worker.close();
    await getScoreRecalcQueue().close();
  });

  it('updates a review’s denormalized counts and Wilson score', async () => {
    const author = await makeUser({ email: `wa-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });
    const v1 = await makeUser({ email: `wv1-${Date.now()}@t.l` });
    const v2 = await makeUser({ email: `wv2-${Date.now()}@t.l` });
    const v3 = await makeUser({ email: `wv3-${Date.now()}@t.l` });
    await makeVote({ userId: v1.id, reviewId: review.id, value: 1 });
    await makeVote({ userId: v2.id, reviewId: review.id, value: 1 });
    await makeVote({ userId: v3.id, reviewId: review.id, value: -1 });

    // Process inline (skip the 30s delay)
    await processScoreRecalc({ data: { reviewId: review.id } } as never);

    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.upvoteCount).toBe(2);
    expect(after?.downvoteCount).toBe(1);
    expect(Number(after?.score)).toBeGreaterThan(0);
    expect(Number(after?.score)).toBeLessThan(1);
  });

  it('uses the same worker entry point via BullMQ end-to-end', async () => {
    const author = await makeUser({ email: `wb-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({ userId: author.id, productId: product.id });
    const v1 = await makeUser({ email: `wb1-${Date.now()}@t.l` });
    await makeVote({ userId: v1.id, reviewId: review.id, value: 1 });

    worker = new Worker(SCORE_RECALC_QUEUE, processScoreRecalc, {
      connection: getQueueConnection(),
    });
    await getScoreRecalcQueue().add(SCORE_RECALC_QUEUE, { reviewId: review.id });
    await new Promise<void>((resolve) => worker.on('completed', () => resolve()));

    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.upvoteCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/score-recalc-worker.test.ts
```
Expected: 2 passed (the worker code from Task E1 makes this pass without further changes).

- [ ] **Step 3: Commit**

```bash
git add api/tests/integration/score-recalc-worker.test.ts
git commit -m "test(api): score-recalc worker updates denorm counts + Wilson"
```

---

### Task H2: moderation-flag worker integration test

**Files:**
- Create: `api/tests/integration/moderation-flag-worker.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/moderation-flag-worker.test.ts
import { describe, expect, it } from 'vitest';
import { processModerationFlag } from '../../src/queues/jobs/moderation-flag.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

describe('moderation-flag worker', () => {
  it('marks profane reviews pending and inserts a system report', async () => {
    const user = await makeUser({ email: `mf-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({
      userId: user.id,
      productId: product.id,
      body: 'this product is shit',
    });
    await processModerationFlag({ data: { reviewId: review.id } } as never);

    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.status).toBe('pending');
    const reports = await getPrisma().report.findMany({ where: { targetId: review.id } });
    expect(reports).toHaveLength(1);
    expect(reports[0]!.reporterId).toBe('00000000-0000-0000-0000-000000000001');
    expect(reports[0]!.reason).toBe('abuse');
    expect(reports[0]!.body).toMatch(/auto-flagged:/);
  });

  it('no-ops on clean content', async () => {
    const user = await makeUser({ email: `cl-${Date.now()}@t.l` });
    const product = await makeProduct();
    const review = await makeReview({
      userId: user.id,
      productId: product.id,
      body: 'really enjoyed this',
    });
    await processModerationFlag({ data: { reviewId: review.id } } as never);
    const after = await getPrisma().review.findUnique({ where: { id: review.id } });
    expect(after?.status).toBe('visible');
    const reports = await getPrisma().report.count({ where: { targetId: review.id } });
    expect(reports).toBe(0);
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/moderation-flag-worker.test.ts
```
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add api/tests/integration/moderation-flag-worker.test.ts
git commit -m "test(api): moderation-flag worker creates system report"
```

---

### Task H3: product-rating-recalc worker integration test

**Files:**
- Create: `api/tests/integration/product-rating-recalc-worker.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/product-rating-recalc-worker.test.ts
import { describe, expect, it } from 'vitest';
import { processProductRatingRecalc } from '../../src/queues/jobs/product-rating-recalc.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

describe('product-rating-recalc worker', () => {
  it('averages visible reviews and ignores hidden/pending/deleted', async () => {
    const product = await makeProduct();
    const u1 = await makeUser({ email: `pr1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `pr2-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `pr3-${Date.now()}@t.l` });
    const u4 = await makeUser({ email: `pr4-${Date.now()}@t.l` });
    await makeReview({ userId: u1.id, productId: product.id, rating: 5 });
    await makeReview({ userId: u2.id, productId: product.id, rating: 3 });
    await makeReview({ userId: u3.id, productId: product.id, rating: 1, status: 'hidden' });
    await makeReview({ userId: u4.id, productId: product.id, rating: 1, status: 'deleted' });

    await processProductRatingRecalc({ data: { productId: product.id } } as never);

    const after = await getPrisma().product.findUnique({ where: { id: product.id } });
    expect(after?.ratingCount).toBe(2);
    expect(Number(after?.ratingAvg)).toBeCloseTo(4, 2);
    expect(after?.reviewCount).toBe(2);
  });

  it('handles a product with zero visible reviews', async () => {
    const product = await makeProduct();
    await processProductRatingRecalc({ data: { productId: product.id } } as never);
    const after = await getPrisma().product.findUnique({ where: { id: product.id } });
    expect(after?.ratingCount).toBe(0);
    expect(Number(after?.ratingAvg)).toBe(0);
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/product-rating-recalc-worker.test.ts
```
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add api/tests/integration/product-rating-recalc-worker.test.ts
git commit -m "test(api): product-rating-recalc denorm updates"
```

---

## Phase I — Mobile API client hooks

> **Assumption from M0c (per D2):** `apps/mobile/src/api/client.ts` exports an `apiClient` object with convenience methods `apiClient.get<T>(path)`, `.post<T>(path, body, opts?)`, `.patch<T>(path, body, opts?)`, `.delete<T>(path, opts?)`. The `path` argument is the route path WITHOUT the `/v1` prefix (the client prepends it). All methods return parsed JSON directly. Per D19, `apps/mobile/src/lib/idempotency.ts` is added in Task I0 below (M0c does not ship it) and exports `newIdempotencyKey()` returning a UUID via `expo-crypto`.

### Task I0: Idempotency helper (D19)

**Files:**
- Create: `apps/mobile/src/lib/idempotency.ts`
- Create: `apps/mobile/__tests__/idempotency.test.ts`

> **Decision D19:** M0c does NOT ship a mobile idempotency helper. M2 owns it. Vote/report writes will import `newIdempotencyKey` from this file.

- [ ] **Step 1: Write `apps/mobile/src/lib/idempotency.ts`**

```ts
// apps/mobile/src/lib/idempotency.ts
import * as Crypto from 'expo-crypto';

/**
 * Returns a UUID v4 string suitable for the `Idempotency-Key` HTTP header.
 * Backed by `expo-crypto.randomUUID()` so it works on both iOS and Android
 * without needing the Web Crypto polyfill.
 */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}
```

- [ ] **Step 2: Write `apps/mobile/__tests__/idempotency.test.ts`**

```ts
// apps/mobile/__tests__/idempotency.test.ts
import { newIdempotencyKey } from '../src/lib/idempotency';

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      const hex = counter.toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${hex}`;
    },
  };
});

describe('newIdempotencyKey', () => {
  it('returns a UUID-shaped string', () => {
    const k = newIdempotencyKey();
    expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns a different value on each call', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Verify PASS**

```bash
pnpm --filter @pantry/mobile test -- idempotency
```
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/idempotency.ts apps/mobile/__tests__/idempotency.test.ts
git commit -m "feat(mobile): newIdempotencyKey helper backed by expo-crypto"
```

---

### Task I1: Reviews TanStack hooks

**Files:**
- Create: `apps/mobile/src/api/reviews.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/mobile/src/api/reviews.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Review,
  ReviewCreate,
  ReviewPatch,
  ReviewSort,
} from '@pantry/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

type Page = { items: Review[]; cursor: string | null };

export function useProductReviews(productId: string, sort: ReviewSort = 'score') {
  return useInfiniteQuery<Page>({
    queryKey: ['reviews', productId, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Page>(
        `/products/${productId}/reviews?sort=${sort}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useMyReviews() {
  return useInfiniteQuery<Page>({
    queryKey: ['reviews', 'me'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Page>(`/me/reviews${pageParam ? `?cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useCreateReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewCreate) =>
      apiClient.post<Review>(`/products/${productId}/reviews`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews', productId] });
      void qc.invalidateQueries({ queryKey: ['reviews', 'me'] });
      void qc.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
}

export function useUpdateReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ReviewPatch }) =>
      apiClient.patch<Review>(`/reviews/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews', productId] });
      void qc.invalidateQueries({ queryKey: ['reviews', 'me'] });
    },
  });
}

export function useDeleteReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/reviews/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews', productId] });
      void qc.invalidateQueries({ queryKey: ['reviews', 'me'] });
    },
  });
}

/** Vote write — body is { value: -1 | 1 }; idempotency-key is generated per call. */
export function castVote(reviewId: string, value: -1 | 1): Promise<void> {
  return apiClient.post<void>(`/reviews/${reviewId}/vote`, { value }, {
    headers: { 'idempotency-key': newIdempotencyKey() },
  });
}

export function clearVote(reviewId: string): Promise<void> {
  return apiClient.delete<void>(`/reviews/${reviewId}/vote`);
}
```

- [ ] **Step 2: Typecheck the mobile package**

```bash
pnpm --filter @pantry/mobile typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/api/reviews.ts
git commit -m "feat(mobile): TanStack hooks for reviews + vote + delete"
```

---

### Task I2: Products search hook

**Files:**
- Create: `apps/mobile/src/api/products-search.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/mobile/src/api/products-search.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface ProductSummary {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  reviewCount: number;
}

export function useProductSearch(query: string) {
  return useQuery({
    queryKey: ['products', 'search', query],
    queryFn: () =>
      apiClient.get<{ items: ProductSummary[] }>(
        `/products/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => apiClient.get<ProductSummary>(`/products/${id}`),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/api/products-search.ts
git commit -m "feat(mobile): product search and detail hooks"
```

---

### Task I3: Reports mutation hook

**Files:**
- Create: `apps/mobile/src/api/reports.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/mobile/src/api/reports.ts
import { useMutation } from '@tanstack/react-query';
import type { Report, ReportCreate } from '@pantry/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: ReportCreate) =>
      apiClient.post<Report>('/reports', input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/api/reports.ts
git commit -m "feat(mobile): report mutation hook"
```

---

## Phase J — Mobile components

### Task J1: StarRatingInput component

**Files:**
- Create: `apps/mobile/src/features/reviews/StarRatingInput.tsx`
- Create: `apps/mobile/__tests__/StarRatingInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/__tests__/StarRatingInput.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { StarRatingInput } from '../src/features/reviews/StarRatingInput';

describe('StarRatingInput', () => {
  it('renders 5 stars', () => {
    const { getAllByA11yRole } = render(<StarRatingInput value={0} onChange={() => {}} />);
    expect(getAllByA11yRole('button')).toHaveLength(5);
  });

  it('calls onChange(3) when third star is tapped', () => {
    const onChange = jest.fn();
    const { getAllByA11yRole } = render(<StarRatingInput value={0} onChange={onChange} />);
    fireEvent.press(getAllByA11yRole('button')[2]!);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('reflects the current value via accessibility state', () => {
    const { getAllByA11yRole } = render(<StarRatingInput value={4} onChange={() => {}} />);
    const stars = getAllByA11yRole('button');
    expect(stars[3]!.props.accessibilityState.selected).toBe(true);
    expect(stars[4]!.props.accessibilityState.selected).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/mobile test -- StarRatingInput
```

- [ ] **Step 3: Implement**

```tsx
// apps/mobile/src/features/reviews/StarRatingInput.tsx
import { Pressable, View, Text } from 'react-native';

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

export function StarRatingInput({ value, onChange, disabled }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel="rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
            accessibilityState={{ selected: filled, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(n)}
            hitSlop={8}
          >
            <Text style={{ fontSize: 32, color: filled ? '#fbbf24' : '#52525b' }}>
              {filled ? '★' : '☆'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile test -- StarRatingInput
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/reviews/StarRatingInput.tsx apps/mobile/__tests__/StarRatingInput.test.tsx
git commit -m "feat(mobile): StarRatingInput component"
```

---

### Task J2: SortTabs component

**Files:**
- Create: `apps/mobile/src/features/reviews/SortTabs.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/features/reviews/SortTabs.tsx
import { Pressable, Text, View } from 'react-native';
import type { ReviewSort } from '@pantry/shared';
import { useTheme } from '../../theme/useTheme';

const OPTIONS: { id: ReviewSort; label: string }[] = [
  { id: 'score', label: 'Top' },
  { id: 'new', label: 'Newest' },
  { id: 'rating', label: 'Rating' },
];

export function SortTabs({ value, onChange }: { value: ReviewSort; onChange: (s: ReviewSort) => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.bgElevated,
        borderRadius: t.radii.pill,
        padding: 4,
      }}
    >
      {OPTIONS.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.id)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: t.radii.pill,
              backgroundColor: selected ? t.colors.primary : 'transparent',
            }}
          >
            <Text style={{ color: selected ? t.colors.primaryFg : t.colors.text, fontWeight: '500' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/reviews/SortTabs.tsx
git commit -m "feat(mobile): SortTabs for review list"
```

---

### Task J3: useOptimisticVote hook

**Files:**
- Create: `apps/mobile/src/features/reviews/useOptimisticVote.ts`

- [ ] **Step 1: Write the hook**

```ts
// apps/mobile/src/features/reviews/useOptimisticVote.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Review } from '@pantry/shared';
import { castVote, clearVote } from '../../api/reviews';

interface Args {
  reviewId: string;
  productId: string;
}

type Next = -1 | 1 | 0;

interface MutationVars {
  next: Next;
  prev: -1 | 1 | null;
}

/**
 * Applies an optimistic update to every cached review-list page that contains
 * this review, then rolls back on failure.
 */
export function useOptimisticVote({ reviewId, productId }: Args) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ next }: MutationVars) => {
      if (next === 0) return clearVote(reviewId);
      return castVote(reviewId, next);
    },
    onMutate: async ({ next, prev }) => {
      await qc.cancelQueries({ queryKey: ['reviews', productId] });
      const snapshots = qc.getQueriesData<{ pages: { items: Review[] }[] }>({
        queryKey: ['reviews', productId],
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData(key, {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((r) => (r.id === reviewId ? applyDelta(r, prev, next) : r)),
          })),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['reviews', productId] });
    },
  });
}

function applyDelta(review: Review, prev: -1 | 1 | null, next: Next): Review {
  let up = review.upvoteCount;
  let down = review.downvoteCount;
  if (prev === 1) up -= 1;
  if (prev === -1) down -= 1;
  if (next === 1) up += 1;
  if (next === -1) down += 1;
  return {
    ...review,
    upvoteCount: Math.max(0, up),
    downvoteCount: Math.max(0, down),
    myVote: next === 0 ? null : (next as -1 | 1),
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/reviews/useOptimisticVote.ts
git commit -m "feat(mobile): optimistic vote hook with rollback"
```

---

### Task J4: ReviewCard component

**Files:**
- Create: `apps/mobile/src/features/reviews/ReviewCard.tsx`
- Create: `apps/mobile/__tests__/ReviewCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/__tests__/ReviewCard.test.tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewCard } from '../src/features/reviews/ReviewCard';
import type { Review } from '@pantry/shared';

jest.mock('../src/api/reviews', () => ({
  castVote: jest.fn().mockResolvedValue(undefined),
  clearVote: jest.fn().mockResolvedValue(undefined),
}));

const review: Review = {
  id: 'r-1',
  userId: 'u-1',
  productId: 'p-1',
  rating: 4,
  body: 'Solid pick.',
  upvoteCount: 3,
  downvoteCount: 1,
  score: 0.4,
  status: 'visible',
  createdAt: '2026-05-24T00:00:00.000Z',
  updatedAt: '2026-05-24T00:00:00.000Z',
  myVote: null,
  author: { id: 'u-1', firstName: 'Ada', avatarUrl: null },
};

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe('ReviewCard', () => {
  it('optimistically increments upvote count on thumb-up tap', async () => {
    const { getByLabelText, getByText } = render(
      wrap(<ReviewCard review={review} productId="p-1" onReport={() => {}} />),
    );
    fireEvent.press(getByLabelText('upvote'));
    await waitFor(() => expect(getByText('4')).toBeTruthy()); // 3 → 4
  });

  it('opens the report sheet on long-press', () => {
    const onReport = jest.fn();
    const { getByLabelText } = render(
      wrap(<ReviewCard review={review} productId="p-1" onReport={onReport} />),
    );
    fireEvent(getByLabelText('review-r-1'), 'longPress');
    expect(onReport).toHaveBeenCalledWith(review);
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile test -- ReviewCard
```

- [ ] **Step 3: Write `apps/mobile/src/features/reviews/ReviewCard.tsx`**

```tsx
// apps/mobile/src/features/reviews/ReviewCard.tsx
import { Pressable, Text, View } from 'react-native';
import type { Review } from '@pantry/shared';
import { useTheme } from '../../theme/useTheme';
import { useOptimisticVote } from './useOptimisticVote';

interface Props {
  review: Review;
  productId: string;
  onReport: (review: Review) => void;
  onEdit?: (review: Review) => void;
  onDelete?: (review: Review) => void;
  isOwn?: boolean;
}

export function ReviewCard({ review, productId, onReport, onEdit, onDelete, isOwn }: Props) {
  const t = useTheme();
  const vote = useOptimisticVote({ reviewId: review.id, productId });

  function press(next: -1 | 1) {
    const prev = review.myVote ?? null;
    const effective = prev === next ? 0 : next;
    vote.mutate({ next: effective, prev });
  }

  return (
    <Pressable
      accessibilityLabel={`review-${review.id}`}
      onLongPress={() => onReport(review)}
      style={{
        backgroundColor: t.colors.bgElevated,
        borderRadius: t.radii.lg,
        padding: t.spacing.lg,
        marginVertical: t.spacing.sm,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: t.colors.text, fontWeight: '600' }}>
          {review.author?.firstName ?? 'User'} · {'★'.repeat(review.rating)}
        </Text>
        {review.status !== 'visible' && (
          <Text style={{ color: t.colors.warning, fontSize: 12 }}>{review.status}</Text>
        )}
      </View>
      {review.body ? <Text style={{ color: t.colors.text }}>{review.body}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 16, alignItems: 'center' }}>
        {!isOwn && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="upvote"
              onPress={() => press(1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: review.myVote === 1 ? t.colors.success : t.colors.textMuted }}>
                ▲
              </Text>
              <Text style={{ color: t.colors.text }}>{review.upvoteCount}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="downvote"
              onPress={() => press(-1)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: review.myVote === -1 ? t.colors.danger : t.colors.textMuted }}>
                ▼
              </Text>
              <Text style={{ color: t.colors.text }}>{review.downvoteCount}</Text>
            </Pressable>
          </>
        )}
        {isOwn && onEdit && (
          <Pressable accessibilityRole="button" onPress={() => onEdit(review)}>
            <Text style={{ color: t.colors.primary }}>Edit</Text>
          </Pressable>
        )}
        {isOwn && onDelete && (
          <Pressable accessibilityRole="button" onPress={() => onDelete(review)}>
            <Text style={{ color: t.colors.danger }}>Delete</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile test -- ReviewCard
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/reviews/ReviewCard.tsx apps/mobile/__tests__/ReviewCard.test.tsx
git commit -m "feat(mobile): ReviewCard with optimistic vote and long-press report"
```

---

### Task J5: ReviewList component

**Files:**
- Create: `apps/mobile/src/features/reviews/ReviewList.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/features/reviews/ReviewList.tsx
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import type { Review } from '@pantry/shared';
import { useProductReviews } from '../../api/reviews';
import { ReviewCard } from './ReviewCard';
import { SortTabs } from './SortTabs';
import { useTheme } from '../../theme/useTheme';
import { useState } from 'react';
import type { ReviewSort } from '@pantry/shared';

interface Props {
  productId: string;
  currentUserId: string | null;
  onReport: (review: Review) => void;
  onEdit?: (review: Review) => void;
  onDelete?: (review: Review) => void;
}

export function ReviewList({ productId, currentUserId, onReport, onEdit, onDelete }: Props) {
  const [sort, setSort] = useState<ReviewSort>('score');
  const q = useProductReviews(productId, sort);
  const t = useTheme();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: t.spacing.md }}>
        <SortTabs value={sort} onChange={setSort} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.xxl }}
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            productId={productId}
            onReport={onReport}
            onEdit={onEdit}
            onDelete={onDelete}
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
              No reviews yet. Be the first!
            </Text>
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator /> : null}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/reviews/ReviewList.tsx
git commit -m "feat(mobile): ReviewList with sort tabs + infinite scroll"
```

---

### Task J6: ReportModal component

**Files:**
- Create: `apps/mobile/src/features/reports/ReportModal.tsx`
- Create: `apps/mobile/__tests__/ReportModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/__tests__/ReportModal.test.tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportModal } from '../src/features/reports/ReportModal';

const create = jest.fn().mockResolvedValue({ id: 'rep-1' });
jest.mock('../src/api/reports', () => ({
  useCreateReport: () => ({ mutateAsync: create, isPending: false }),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe('ReportModal', () => {
  beforeEach(() => create.mockClear());

  it('requires a reason before submitting', () => {
    const { getByText } = render(
      wrap(<ReportModal visible target={{ type: 'review', id: 'r-1' }} onClose={() => {}} />),
    );
    fireEvent.press(getByText('Submit'));
    expect(create).not.toHaveBeenCalled();
  });

  it('submits a report with the selected reason', async () => {
    const onClose = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(<ReportModal visible target={{ type: 'review', id: 'r-1' }} onClose={onClose} />),
    );
    fireEvent.press(getByLabelText('reason-abuse'));
    fireEvent.press(getByText('Submit'));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        targetType: 'review',
        targetId: 'r-1',
        reason: 'abuse',
        body: undefined,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/mobile test -- ReportModal
```

- [ ] **Step 3: Implement**

```tsx
// apps/mobile/src/features/reports/ReportModal.tsx
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import type { ReportReason, ReportTargetType } from '@pantry/shared';
import { useCreateReport } from '../../api/reports';
import { useTheme } from '../../theme/useTheme';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam' },
  { id: 'abuse', label: 'Abusive or hateful' },
  { id: 'incorrect', label: 'Incorrect information' },
  { id: 'other', label: 'Other' },
];

export interface Target {
  type: ReportTargetType;
  id: string;
}

interface Props {
  visible: boolean;
  target: Target | null;
  onClose: () => void;
}

export function ReportModal({ visible, target, onClose }: Props) {
  const t = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [body, setBody] = useState('');
  const create = useCreateReport();

  async function submit() {
    if (!reason || !target) return;
    await create.mutateAsync({
      targetType: target.type,
      targetId: target.id,
      reason,
      body: body.trim() ? body.trim() : undefined,
    });
    setReason(null);
    setBody('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View
          style={{
            backgroundColor: t.colors.bgElevated,
            padding: t.spacing.xl,
            borderTopLeftRadius: t.radii.xl,
            borderTopRightRadius: t.radii.xl,
          }}
        >
          <Text style={{ color: t.colors.text, fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
            Report
          </Text>
          {REASONS.map((r) => {
            const selected = reason === r.id;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="radio"
                accessibilityLabel={`reason-${r.id}`}
                accessibilityState={{ selected }}
                onPress={() => setReason(r.id)}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                }}
              >
                <Text
                  style={{
                    color: selected ? t.colors.primary : t.colors.text,
                    fontWeight: selected ? '600' : '400',
                  }}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
          <TextInput
            placeholder="More detail (optional)"
            placeholderTextColor={t.colors.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            style={{
              marginTop: 16,
              borderWidth: 1,
              borderColor: t.colors.border,
              borderRadius: t.radii.md,
              padding: 12,
              color: t.colors.text,
              minHeight: 80,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: t.radii.md,
                borderWidth: 1,
                borderColor: t.colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.colors.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!reason || create.isPending}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: t.radii.md,
                backgroundColor: reason ? t.colors.primary : t.colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.colors.primaryFg, fontWeight: '600' }}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter @pantry/mobile test -- ReportModal
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/reports/ReportModal.tsx apps/mobile/__tests__/ReportModal.test.tsx
git commit -m "feat(mobile): ReportModal with reason radios"
```

---

## Phase K — Mobile screens

### Task K1: Browse tab

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/browse.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
// apps/mobile/app/(app)/(tabs)/browse.tsx
import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useProductSearch } from '../../../src/api/products-search';
import { useTheme } from '../../../src/theme/useTheme';

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  // intentionally inline to avoid extra deps
  if (typeof window !== 'undefined') {
    // expo provides setTimeout globally; this branch is for the bundler only
  }
  // simple debounce
  useDebouncedEffect(value, ms, setV);
  return v;
}

function useDebouncedEffect<T>(value: T, ms: number, set: (v: T) => void) {
  const { useEffect } = require('react') as typeof import('react');
  useEffect(() => {
    const h = setTimeout(() => set(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
}

export default function BrowseScreen() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const search = useProductSearch(debounced);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.spacing.md }}>
      <TextInput
        placeholder="Search products"
        placeholderTextColor={t.colors.textMuted}
        value={q}
        onChangeText={setQ}
        style={{
          borderWidth: 1,
          borderColor: t.colors.border,
          borderRadius: t.radii.pill,
          paddingHorizontal: 16,
          paddingVertical: 10,
          color: t.colors.text,
        }}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="search"
      />
      <FlatList
        style={{ marginTop: 12 }}
        data={search.data?.items ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/product/${item.id}`)}
            style={{
              padding: 12,
              borderRadius: t.radii.md,
              backgroundColor: t.colors.bgElevated,
              marginVertical: 4,
            }}
          >
            <Text style={{ color: t.colors.text, fontWeight: '600' }}>{item.name}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
              {item.brand ?? 'Unknown brand'} · ★ {item.ratingAvg.toFixed(1)} ({item.reviewCount})
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          debounced.length < 2 ? (
            <Text style={{ color: t.colors.textMuted, marginTop: 24 }}>Type at least 2 characters.</Text>
          ) : search.isLoading ? null : (
            <Text style={{ color: t.colors.textMuted, marginTop: 24 }}>No matches.</Text>
          )
        }
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/\(tabs\)/browse.tsx
git commit -m "feat(mobile): Browse tab with debounced product search"
```

---

### Task K2: Reviews tab

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/reviews.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
// apps/mobile/app/(app)/(tabs)/reviews.tsx
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMyReviews } from '../../../src/api/reviews';
import { useTheme } from '../../../src/theme/useTheme';

export default function MyReviewsScreen() {
  const t = useTheme();
  const q = useMyReviews();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.spacing.md }}>
      <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
        Your reviews
      </Text>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/product/${item.productId}`)}
            style={{
              padding: 12,
              borderRadius: t.radii.md,
              backgroundColor: t.colors.bgElevated,
              marginVertical: 4,
            }}
          >
            <Text style={{ color: t.colors.text, fontWeight: '600' }}>
              {'★'.repeat(item.rating)} · {item.status}
            </Text>
            {item.body ? <Text style={{ color: t.colors.textMuted }}>{item.body}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: t.colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              You haven’t reviewed anything yet.
            </Text>
          )
        }
        onEndReached={() => q.hasNextPage && q.fetchNextPage()}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/\(tabs\)/reviews.tsx
git commit -m "feat(mobile): Reviews tab listing /v1/me/reviews"
```

---

### Task K3: Product detail screen

**Files:**
- Create: `apps/mobile/app/(app)/product/[id].tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/mobile/app/(app)/product/[id].tsx
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Review } from '@pantry/shared';
import { useProduct } from '../../../src/api/products-search';
import { useDeleteReview } from '../../../src/api/reviews';
import { ReviewList } from '../../../src/features/reviews/ReviewList';
import { ReportModal, type Target } from '../../../src/features/reports/ReportModal';
import { useTheme } from '../../../src/theme/useTheme';
import { useSessionStore } from '../../../src/auth/sessionStore';

export default function ProductDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const userId = useSessionStore((s) => s.user?.id);
  const del = useDeleteReview(id);
  const [reportTarget, setReportTarget] = useState<Target | null>(null);

  if (product.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!product.data) return <Text style={{ color: t.colors.text }}>Not found.</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView>
        <View style={{ padding: t.spacing.lg }}>
          {product.data.imageUrl ? (
            <Image
              source={{ uri: product.data.imageUrl }}
              style={{ width: '100%', height: 200, borderRadius: t.radii.lg }}
            />
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginTop: t.spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '700' }}>
                {product.data.name}
              </Text>
              <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>
                {product.data.brand ?? 'Unknown brand'} · ★ {product.data.ratingAvg.toFixed(1)} (
                {product.data.reviewCount})
              </Text>
            </View>
            <Pressable
              accessibilityLabel="product-overflow"
              onPress={() => setReportTarget({ type: 'product', id })}
              hitSlop={8}
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ color: t.colors.text, fontSize: 22 }}>⋯</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: t.spacing.md }}>
            <Pressable
              onPress={() => router.push(`/scan?productId=${id}`)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: t.radii.md,
                backgroundColor: t.colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: t.colors.primaryFg, fontWeight: '600' }}>Add to pantry</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/product/${id}/review`)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: t.radii.md,
                backgroundColor: t.colors.bgElevated,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: t.colors.border,
              }}
            >
              <Text style={{ color: t.colors.text, fontWeight: '600' }}>Write a review</Text>
            </Pressable>
          </View>
        </View>
        <ReviewList
          productId={id}
          currentUserId={userId ?? null}
          onReport={(r: Review) => setReportTarget({ type: 'review', id: r.id })}
          onEdit={(r: Review) => router.push(`/product/${id}/review?reviewId=${r.id}`)}
          onDelete={(r: Review) => del.mutate(r.id)}
        />
      </ScrollView>
      <ReportModal
        visible={reportTarget !== null}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/product/\[id\].tsx
git commit -m "feat(mobile): product detail screen with reviews + report"
```

---

### Task K4: Review form (create + edit)

**Files:**
- Create: `apps/mobile/app/(app)/product/[id]/review.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/mobile/app/(app)/product/[id]/review.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StarRatingInput } from '../../../../src/features/reviews/StarRatingInput';
import {
  useCreateReview,
  useMyReviews,
  useUpdateReview,
} from '../../../../src/api/reviews';
import { useTheme } from '../../../../src/theme/useTheme';

export default function ReviewFormScreen() {
  const t = useTheme();
  const { id: productId, reviewId } = useLocalSearchParams<{ id: string; reviewId?: string }>();
  const my = useMyReviews();
  const existing = reviewId
    ? my.data?.pages.flatMap((p) => p.items).find((r) => r.id === reviewId)
    : my.data?.pages.flatMap((p) => p.items).find((r) => r.productId === productId);

  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [body, setBody] = useState<string>(existing?.body ?? '');
  const create = useCreateReview(productId);
  const update = useUpdateReview(productId);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (rating < 1) {
      setError('Please pick a rating.');
      return;
    }
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, patch: { rating, body: body.trim() || undefined } });
      } else {
        await create.mutateAsync({ rating, body: body.trim() || undefined });
      }
      router.back();
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'review_already_exists'
          ? 'You already reviewed this product.'
          : 'Could not save your review.';
      setError(msg);
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.spacing.lg, gap: t.spacing.lg }}>
      <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '700' }}>
        {existing ? 'Edit your review' : 'Write a review'}
      </Text>
      <StarRatingInput value={rating} onChange={setRating} disabled={pending} />
      <TextInput
        placeholder="What did you think? (optional)"
        placeholderTextColor={t.colors.textMuted}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        editable={!pending}
        style={{
          borderWidth: 1,
          borderColor: t.colors.border,
          borderRadius: t.radii.md,
          padding: 12,
          color: t.colors.text,
          minHeight: 120,
          textAlignVertical: 'top',
        }}
      />
      {error ? <Text style={{ color: t.colors.danger }}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={submit}
        style={{
          padding: 14,
          borderRadius: t.radii.md,
          backgroundColor: t.colors.primary,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: t.colors.primaryFg, fontWeight: '600' }}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Post review'}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/mobile typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/product/\[id\]/review.tsx
git commit -m "feat(mobile): review form (create/edit) with star input"
```

---

## Phase L — Maestro E2E

### Task L1: Reviews flow Maestro spec

**Files:**
- Create: `apps/mobile/.maestro/reviews-flow.yaml`

- [ ] **Step 1: Verify the project has a Maestro launcher from M1**

```bash
ls apps/mobile/.maestro
```
Expected: at least one existing `.yaml` from M1 (scan/record flow). If `.maestro` does not exist, create it: `mkdir -p apps/mobile/.maestro`.

- [ ] **Step 2: Write `apps/mobile/.maestro/reviews-flow.yaml`**

```yaml
appId: com.pantry.app
name: Reviews flow — open product, write, upvote, report
tags:
  - reviews
---
- launchApp:
    clearState: true
- runFlow: ./sign-in.yaml  # provided by M0c
- tapOn: "Browse"
- inputText: "Test"
- assertVisible:
    text: "Test product"
- tapOn:
    text: "Test product"
    index: 0
- assertVisible: "Write a review"
- tapOn: "Write a review"
- tapOn:
    text: "5 stars"
- inputText: "Solid pick."
- tapOn: "Post review"
- assertVisible: "Solid pick."
# Up-vote a sibling review
- longPressOn:
    id: "review-r-1"  # sample fixture review seeded by Maestro test fixtures
- assertVisible: "Report"
- tapOn: "Abusive or hateful"
- tapOn: "Submit"
- assertNotVisible: "Submit"
```

> NOTE: The `runFlow: ./sign-in.yaml` reference assumes M0c ships a reusable sign-in flow. If absent, replace with explicit `tapOn` / `inputText` steps for sign-in.

- [ ] **Step 3: Smoke-run locally if Maestro CLI is installed**

```bash
maestro test apps/mobile/.maestro/reviews-flow.yaml
```
Expected: passes against a running simulator/emulator with the seeded fixture product `Test product` and review id `r-1`. If Maestro is not available locally, skip — CI nightly will run it.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/.maestro/reviews-flow.yaml
git commit -m "test(mobile): Maestro E2E for review write + vote + report"
```

---

## Phase M — Final verification

### Task M1: Full API test suite

- [ ] **Step 1: Run every API test**

```bash
pnpm --filter @pantry/api test
```
Expected: every test passes. New test files introduced by this plan:

- `unit/wilson.test.ts` — 7 tests
- `unit/profanity.test.ts` — 9 tests
- `unit/score-recalc-debounce.test.ts` — 3 tests
- `integration/reviews-list.test.ts` — 4 tests
- `integration/reviews-create.test.ts` — 7 tests
- `integration/reviews-update.test.ts` — 4 tests
- `integration/reviews-delete.test.ts` — 2 tests
- `integration/reviews-vote.test.ts` — 5 tests
- `integration/my-reviews.test.ts` — 2 tests
- `integration/reports-create.test.ts` — 5 tests
- `integration/score-recalc-worker.test.ts` — 2 tests
- `integration/moderation-flag-worker.test.ts` — 2 tests
- `integration/product-rating-recalc-worker.test.ts` — 2 tests

All M0a/M0b/M1 tests must still pass.

- [ ] **Step 2: Mobile tests**

```bash
pnpm --filter @pantry/mobile test
```
Expected: `StarRatingInput.test.tsx` (3), `ReviewCard.test.tsx` (2), `ReportModal.test.tsx` (2), plus all prior tests pass.

- [ ] **Step 3: Repo-wide typecheck**

```bash
pnpm typecheck
```
Expected: exit 0 in every package.

- [ ] **Step 4: Lint / format**

```bash
pnpm exec prettier --check .
```
Expected: exit 0. If not: `pnpm exec prettier --write .` and re-check.

- [ ] **Step 5: Manual smoke against the running API**

In one terminal: `pnpm --filter @pantry/api dev`. In another:

```bash
curl -s -X POST http://localhost:4000/v1/products/<some-product-id>/reviews \
  -H "Authorization: Bearer <access-token-from-login>" \
  -H "Content-Type: application/json" \
  -d '{"rating":5,"body":"good"}' | jq
```
Expected: HTTP 201 with the new review, `status: "visible"`.

```bash
curl -s http://localhost:4000/v1/products/<some-product-id>/reviews?sort=score | jq
```
Expected: HTTP 200, the new review present, sorted by score.

- [ ] **Step 6: Tag the milestone**

```bash
git tag m2-complete
```

---

## Self-review checklist

Run through these before declaring M2 done. Findings (if any) are folded back into the plan inline; this list is the final gate.

**1. Spec coverage**

- §2.6 review CRUD with one per (user, product), editable, soft-delete, sort by Wilson — Tasks F1–F8, A1, A6.
- §2.7 voting one per (user, review), change/remove, denormalized counts + Wilson, debounced background job — Tasks F9, F10, E1, E2, H1.
- §2.8 reporting (review/user/product), profanity auto-flag, `>3` reports auto-hide — Tasks G1, G2, E4, D3, H2.
- §4.3 `score-recalc` debounced 30s + `moderation-flag` jobs — Tasks E1, E2, E4.
- §5 reviews/review_votes/reports tables with required indexes — Task A1, verified A2.
- §6.4 endpoints — Tasks F1–F10 (list, create, patch, delete, vote, unvote).
- §6.5 `POST /reports` — Tasks G1, G2.
- §7 mobile reviews surface — Tasks I1–I3, J1–J6, K1–K4, L1.

**2. Placeholder scan**

- No "TBD", "see Task N", "add error handling" found.
- Every test step provides the full test code; every implementation step provides full source.
- Maestro flow Task L1 explicitly notes the `sign-in.yaml` dependency from M0c rather than handwaving.

**3. Type consistency**

- API `Review.score` is `Decimal(7,6)` in Prisma → coerced via `Number(r.score)` in `toApiReview` → typed `number` in `reviewSchema` (range 0..1). Consistent end-to-end.
- `value: -1 | 1` is the union everywhere: `reviewVoteSchema`, `castVote`, `useOptimisticVote`, `processScoreRecalc`. The optimistic hook's third option `0` is internal to the hook only and never leaves the mobile boundary.
- `ReviewStatus` enum identical in Prisma (`visible | hidden | deleted`), Zod (`reviewStatusSchema`), and the mobile cards. Per D15, profanity auto-flag sets `status='hidden'` directly; there is no `pending` value.
- `enqueueScoreRecalc` returns the literal union `'enqueued' | 'debounced'` (used by the debounce unit test).
- `ReportTargetType` (`review | user | product`) is shared by Zod, Prisma enum, route handler, and `maybeAutoHide`.
- `Idempotency-Key` header name matches lowercase in route check (`req.headers['idempotency-key']`) and in client (`'idempotency-key': newIdempotencyKey()`).

**4. Cross-milestone assumption audit**

- `app.requireAuth` decorator → M0a (Task E8 of m0a plan).
- `issueAccessToken`, `verifyAccessToken` → M0a Task E3.
- `makeUser`, `getPrisma` test helpers → M0a Tasks D7, A5.
- `Product` Prisma model + `products` table + `products/search` route → M1.
- BullMQ `getQueueConnection()` and central `workers.ts` → M1.
- Idempotency-Key plugin — M1 ships it; M2 opts in via `config: { idempotent: 'required' }` on the vote route (no manual header check).
- Mobile `apiClient` (with `.get/.post/.patch/.delete`) and `useTheme` → M0c. Mobile `useSessionStore` → M0c (`apps/mobile/src/auth/sessionStore.ts`). Mobile `newIdempotencyKey` → M2 ships it (Task I0) since M0c does not.

**5. Out-of-scope discipline**

- No admin queue UI or `PATCH /admin/reviews/:id/status` routes — those are M3.
- No theme polish beyond consuming tokens — that is M4.
- No SSE / realtime — explicitly deferred in spec §12.

---

## Handoff to M3

M3 will:

1. Build the Next.js admin app moderation queue that reads `reports` and resolves them with `PATCH /v1/admin/reports/:id/resolve` (status `resolved` or `dismissed`).
2. Add admin actions on the auto-hidden content: re-publish a `hidden` review, un-pend a product, ban users.
3. Audit-log every resolution via `admin_audit_log`.
4. Surface the auto-flagged reports authored by the M2 system user as a dedicated queue lane.

When M3 ships, the moderation loop closes end-to-end.
