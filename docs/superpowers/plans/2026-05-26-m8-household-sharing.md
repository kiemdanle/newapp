# M8 — Household Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-owner private pantry into a shared one. A household groups members who share a pantry; records can belong to a household (full shared pantry — members add/edit/consume shared records); roles are owner/member; membership is managed via invites with shareable codes/deep links. This is the heaviest milestone of the v1.x line because it **changes the records ownership model**: it adds a forward, additive migration to the already-shipped `records` table, splits the offline conflict policy (personal records stay last-write-wins, household records become server-authoritative), and threads household scoping through the records API, the WatermelonDB schema, and the sync engine.

**Architecture:** Three new Postgres tables (`households`, `household_members`, `household_invites`) via a Prisma migration, plus an **additive migration on the existing `records` table** that adds a nullable `household_id uuid?` FK. `records.household_id = NULL` keeps the v1 private-to-`user_id` behavior intact; a non-null `household_id` makes the record shared among that household's members. `user_id` is retained as the creator/attribution. New Fastify routes mount under `/v1/households` (CRUD, invites, members) plus household-scoping extensions to the existing `/v1/records` routes (`?scope`, optional `householdId` on create, member-permission enforcement on patch). The `/v1/records/sync` delta endpoint is extended to (a) pull household records the caller can see, (b) apply **server-wins** for household records, and (c) keep **last-write-wins** for personal records. Mobile gains a household settings screen (create / join via invite link / members / leave / dissolve), a Personal/Household pantry scope toggle on home, household assignment on the record form, and shared-record attribution; the WatermelonDB schema gains `household_id` and the sync engine learns the split conflict policy. Invite acceptance reuses the M0c deep-link handler. Admin gains an audit-logged household management page.

**Tech Stack:** Fastify 4, Prisma 5, Postgres 16, Redis 7, Zod 3, BullMQ 5 (reused for any deferred work — no new queues required), Vitest 2 + Supertest 7 (API, real test Postgres), Expo SDK + Expo Router + Zustand + TanStack Query + NativeWind + WatermelonDB (mobile), React Native Testing Library 12, Maestro (mobile E2E), Next.js 15 + Playwright (admin).

**Spec reference:** `docs/superpowers/specs/2026-05-23-pantry-app-design.md` sections 2.2 (records — being extended from private/single-owner), 2.11 (offline-first + conflict policy: "last-write-wins on user-owned data; server wins on shared data"), 2.15 (household sharing), 5 (data model), 6.3 (records endpoints), 7 (mobile). Read §2.11 and §2.15 before starting.

**Prerequisites — complete & merged.** This milestone runs **after v1 (M0–M4) ships** and performs a **forward, additive migration on the live `records` table** (no data loss: existing rows get `household_id = NULL` and remain private). Per the backend-first execution order, prereqs split by track. Track A (backend phases A–E + admin phase H + Phase Z) does NOT depend on M0c — they touch only `api/`, `packages/shared`, and `apps/admin/`. M0c is required only when Track B (mobile phases F–G) begins.

**Track A (backend + admin, build now) prerequisites:**

- **M0a / M0b** — `@pantry/shared` (Zod), `api/src/server.ts`, `config.ts`, `db.ts`, `redis.ts`, `errors.ts` (`AppError` + RFC 7807), `app.requireAuth` + `req.user`, `issueAccessToken` (→ bare string), `app.requireAdmin`, users repository + `toApiUser` (camelCase), idempotency plugin (`api/src/plugins/idempotency.ts`), test harness (`tests/helpers/setup.ts`, `factories.ts`).
- **M1** backend — `records` table (single-owner private), records routes (`GET/POST/PATCH/DELETE /v1/records`, `POST /v1/records/sync` idempotent on `client_id`, last-write-wins), `notify-at` helper + `notification-schedule` / `notification-send` workers, BullMQ runner (`api/src/workers/runner.ts`), product catalog.
- **M3** — admin app (Next.js 15), `serverAdminApi` / `browserAdminApi`, `writeAuditLog({...})` (for the household management page).

**Track B (mobile, deferred) — additional prerequisite:**

- **M0c** — mobile shell with auth-gated `(app)` tabs (incl. home/pantry), `useTheme()`, API client (bearer + 401 refresh + RFC 7807), WatermelonDB schema + sync engine + offline write queue (records), **deep-link handler** (reused for household invite links), theme provider.

**Out of scope for M8 (stated explicitly):**

- Per-record granular permissions beyond view / edit / consume (no "read-only member", no per-item ACLs).
- Roles beyond `owner` / `member`.
- Household-level chat / messaging.
- Merging two households into one.
- Shared deals / giveaways across a household — deals (M5) and blessings (M6) stay per-user.
- Payments / billing for households.

---

## Execution order — backend-first (2026-05-26)

This greenfield project is re-sequenced to build the **Backend + Admin** track in full first, then the **Mobile** track. This header only records execution order — phase numbering, contents, and order below are unchanged.

**Track A — Backend + Admin (build now):**
- Phase A — Shared Zod schemas
- Phase B — Database schema + forward records migration
- Phase C — Households service + HTTP routes
- Phase D — Records household scoping
- Phase E — Sync conflict policy (server-side)
- Phase H — Admin: household management
- Phase Z — Final verification (run the API + admin portions with this track; mobile checks run with Track B)

**Track B — Mobile (DEFERRED):**
- Phase F — Mobile: WatermelonDB + sync engine
- Phase G — Mobile: households UI

**Rule:** Do NOT implement Track B phases until the entire Backend + Admin track is complete and the Mobile track begins.

---

## Validation amendments — 2026-05-26

These amendments are additive on top of the Red Team fixes below; all earlier fixes (sync re-filtering, scope-change conflict, household-row locks, owner-approval invites, the cross-household IDOR predicate, the `[householdId, updatedAt]` scale index, and local purge) remain intact and unchanged.

1. **Shared-record expiry reminders fan out to ALL current household members (per-member offsets).** A record assigned to a household (`household_id` set) is shared by the whole household, so its expiry reminder push must reach **every current member**, not just the creator. Each member is reminded according to **their own** `notificationPreferences.offsetsDays` (default `[3,1,0]`) — there is no single shared schedule. This is a **fan-out of the existing M1 `notification-send` pipeline**, not a new queue: when a household record is created, or its expiry/household assignment changes, the API schedules an expiry notification for each current member of that household using that member's offsets. **Personal records (`household_id` null) are unchanged** — they keep today's single-owner scheduling. Multiple-household membership is supported (decision 2): a user in N households receives shared-record reminders across all of them — this is consistent, not restricted.

2. **Membership changes reschedule reminders.** When a user **joins** a household (owner approval, Task C4), the API schedules that new member into the upcoming reminders of the household's active (non-consumed, future-expiry) records, using the new member's own offsets. When a user **leaves** (self-leave / owner-remove, Task C5) or the **household dissolves** (Task C5 / admin H0), the API cancels/skips that user's pending household-record reminders. This stays consistent with the household-row lock and the FK-`SetNull` revert already in the plan: reminder (re)scheduling happens inside the same locked transaction as the membership/record write, so it cannot interleave with a concurrent dissolve or record write.

3. **Per-route rate limits on household writes (added 2026-05-27).** Beyond the global limiter (60/min/user, 30/min/IP), three M8 write endpoints carry tighter per-route caps to blunt enumeration and spam, matching the M5/M6 pattern. (a) `POST /v1/households/invites/request` — **10/min/user AND 30/min/IP**: the `{ code }` body is an enumeration target, and a per-IP cap is required because per-user caps don't constrain an attacker rotating compromised or freshly-registered accounts. (b) `POST /v1/households` — **10/min/user**: matches M5 deal-create / M6 giveaway-create. (c) `POST /v1/households/:id/invites` — **10/min/user**: same create-cap pattern. All other household writes (rename, approve, revoke, member-remove, dissolve) inherit only the global limiter — each requires pre-existing membership or owner status, so high-frequency abuse is not the dominant threat. The capped route tasks each gain an `it('rate-limits ... past N/min', …)` integration test asserting `429` past the cap, mirroring `deals-vote.test.ts` from M5.

---

## Red Team Review — 2026-05-26

A red-team pass found correctness and security gaps in the first draft. The following fixes are now baked into the relevant phases. Plain-language summary:

1. **Sync must re-filter every echoed record by the caller's CURRENT visibility.** Earlier, the sync delta could echo a record back to a person who no longer has access (e.g. after a household dissolves and a record reverts to its creator's personal pantry, a former co-member could still receive it). The delta now re-checks membership at request time and drops any record the caller can no longer see.

2. **A scope change is an explicit conflict, never a silent overwrite.** When a record's `household_id` changes between what the client last saw and the server's current state (personal → household, or household → personal), the server flags it to the client as a conflict so a legitimate offline personal-era edit is not silently discarded. `notify_at` is recomputed whenever a record moves into or out of a household.

3. **Household row locking serializes dissolve/remove against concurrent record writes.** A record edit could previously interleave with a dissolve and resurrect a deleted household's id (FK violation) or land a write mid-dissolve. Both the dissolve/member-remove path and the record-write path now take a lock on the household row so they cannot interleave.

4. **Record PATCH now has an explicit cross-household permission predicate.** Setting or clearing a record's `householdId` is gated by a coded check: the caller may only do so if they can write the record in its CURRENT scope AND are a member of the target household. You cannot pull another user's personal record or another household's record into your own.

5. **Invites are now OWNER-APPROVAL join requests, not instant membership.** A leaked invite link no longer grants access. The link lets a user REQUEST to join; the household owner must APPROVE before membership is granted. Approval is atomic and single-use.

6. **Scale + local cleanup.** A composite index now serves the membership-scoped sync cursor (`household_id IN (...) AND updated_at > since`) so the delta does not seq-scan at scale. When a user leaves a household or it dissolves, the device purges that household's local WatermelonDB rows so stale shared rows do not linger forever.

7. **Cleanups.** Full dissolve relies on the FK `onDelete: SetNull` to revert records (no redundant imperative null-out); only partial member-remove imperatively nulls (the FK cannot express it). Invite/request expiry is computed from `expiresAt > now()` (no write-on-read status flip). The admin households API (`GET/DELETE /v1/admin/households`) is now a proper API task with `requireAdmin` + an integration test instead of being smuggled into a UI task.

---

## Key design decisions

These are locked decisions for this milestone. Code comments explain the *why* (invariant / policy), never the milestone or decision label.

1. **Records ownership stays attributive.** `records.user_id` always points to the **creator** (NOT NULL, unchanged). `records.household_id` is the new nullable sharing dimension. A record is *personal* iff `household_id IS NULL`; otherwise it is *shared* among that household's members. `user_id` survives a household dissolve (see decision 5) so attribution is never lost.

2. **A user may belong to multiple households (allow).** `household_members` has `@@unique([householdId, userId])` but no global "one household per user" constraint. The spec does not forbid it and the data model supports it cleanly; the mobile scope toggle lists each household the user belongs to. (If product later wants single-household, that is a new constraint, not a schema change here.)

3. **Permissions.**
   - **Member** (owner or member): view + create + edit + consume/discard household records of that household.
   - **Owner only**: invite members, revoke invites, remove members, rename the household, dissolve the household.
   - **Self-leave**: any member may remove *themselves* (`DELETE /v1/households/:id/members/:userId` where `userId === req.user.id`). The owner cannot leave without first dissolving or transferring — owner self-leave is rejected with `household_owner_cannot_leave` (transfer is out of scope; dissolve instead).
   - **Personal records** (`household_id IS NULL`) remain private to `user_id` regardless of any household membership.

4. **Conflict policy split (the load-bearing change).** Spec §2.11: last-write-wins on user-owned data, **server wins on shared data**. Household records are shared, so:
   - **Personal records** (`household_id IS NULL`): unchanged **last-write-wins** — newer client `updatedAt` overwrites the server row (M1 behavior preserved verbatim).
   - **Household records** (`household_id` set): **server-authoritative**. On a sync upsert collision, the server's row always wins; the client's mutation is **rejected and the server version is echoed back** in `changes` so the client overwrites its local copy. A client may still *create* a brand-new household record offline (it has no server counterpart yet) and *edit* one optimistically, but on conflict the server copy is canonical. The delta pull returns every household record the caller can currently see (membership-scoped), so a member who lost a race re-converges to the server state. (Spelled out fully in Phase F.)

5. **Dissolve reverts shared records to creator-private (chosen).** `DELETE /v1/households/:id` deletes the `households` row; the `records.household_id` FK is declared `onDelete: SetNull`, so the database itself reverts every member's record to `household_id = NULL` (each item reverts to private, owned by its original `user_id` creator — **items are not lost**). `household_members` and `household_invites` cascade-delete. Rationale: deleting shared items would destroy a member's pantry contents they may still hold; reverting to creator-private is the least-surprising, non-destructive outcome and preserves attribution. This is a business decision — do not silently change it. **The full-dissolve revert relies on the FK, not an imperative `updateMany`** (the FK already expresses "household gone → null its records"); only *partial member-remove* nulls imperatively, since the FK cannot express "this one member's records only" (see decision 8 and Task C5).

6. **Invites are owner-approval join requests (NOT instant membership).** A leaked invite link must NOT by itself grant access to household pantry data. `POST /v1/households/:id/invites` returns an opaque `code` (URL-safe random) and a deep-link URL (`pantry://household/invite?code=<code>`). `POST /v1/households/invites/request` consumes `{ code }`, validates `status === 'pending'` and `expiresAt > now()`, and records the requesting user as `requestedByUserId` with the invite moving to a `requested` state — **the requester is NOT yet a member**. The household OWNER then approves via `POST /v1/households/:id/invites/:inviteId/approve`, which atomically creates the `household_members` row (role `member`) and marks the invite `accepted`. Approval is **single-use** (one accepted terminal state per invite) and **atomic** (a conditional update guards against two racing approvals both succeeding). `invitedEmail` is optional metadata only; if product later wants email-gating, that is a new check, not a schema change.

7. **No new BullMQ queues.** Member-join push notifications reuse the existing `notification-send` infrastructure with a new `templateKey` (`household_invite_accepted`); the schedule worker is untouched. KISS — household events are synchronous DB writes. **Shared-record expiry reminders also reuse `notification-send`** — they are a *fan-out* of the existing M1 expiry pipeline, scheduling one reminder per current household member (each using that member's own `notificationPreferences.offsetsDays`, default `[3,1,0]`), not a new queue. Personal records (`household_id` null) keep their single-owner schedule unchanged.

8. **Concurrency: household row locking.** Dissolve / member-remove and record-write (create / patch with `householdId`, sync upsert into a household) must serialize on the household. Each of these paths takes `SELECT … FOR UPDATE` (or a Postgres advisory lock keyed on the household id) on the `households` row inside its transaction. This prevents a record write from interleaving with a dissolve and resurrecting a deleted `household_id` (FK violation) or landing mid-dissolve. The lock is held for the duration of the transaction only.

---

## File map

This plan creates / modifies the following. Files in **bold** carry the load-bearing logic.

```
pantry/
├── packages/shared/src/schemas/
│   └── household.ts                                  ← Zod household + invite + member schemas (NEW)
├── packages/shared/src/schemas/record.ts             ← +householdId, +scope query (MODIFY)
├── packages/shared/src/schemas/error.ts              ← +household_* error codes (MODIFY)
├── packages/shared/src/index.ts                      ← re-export household.ts (MODIFY)
├── api/
│   ├── prisma/schema.prisma                          ← +Household, HouseholdMember, HouseholdInvite; Record.householdId; User relations (MODIFY)
│   ├── prisma/migrations/<ts>_m8_household_sharing/
│   │   └── migration.sql                             ← generated + additive records.household_id (NEW)
│   ├── src/
│   │   ├── server.ts                                 ← mount household routes (MODIFY)
│   │   ├── **services/households/repository.ts**     ← toApiHousehold/Member/Invite, membership + permission helpers (NEW)
│   │   ├── **services/households/permissions.ts**    ← assertMember / assertOwner / canEditRecord (NEW)
│   │   ├── services/households/invite-code.ts        ← URL-safe code generator (NEW)
│   │   ├── **services/records/sync.ts**              ← split conflict policy (MODIFY)
│   │   ├── services/records/repository.ts            ← scope filter + householdId on serialize (MODIFY)
│   │   ├── routes/households/
│   │   │   ├── index.ts                              ← mount + register sub-routes (NEW)
│   │   │   ├── create.ts                             ← POST /v1/households (NEW)
│   │   │   ├── mine.ts                               ← GET /v1/households/mine (NEW)
│   │   │   ├── get.ts                                ← GET /v1/households/:id (NEW)
│   │   │   ├── patch.ts                              ← PATCH /v1/households/:id (rename) (NEW)
│   │   │   ├── dissolve.ts                           ← DELETE /v1/households/:id (NEW)
│   │   │   ├── invites-create.ts                     ← POST /v1/households/:id/invites (NEW)
│   │   │   ├── invites-request.ts                    ← POST /v1/households/invites/request (join request, NEW)
│   │   │   ├── invites-approve.ts                    ← POST /v1/households/:id/invites/:inviteId/approve (owner approve, NEW)
│   │   │   ├── invites-revoke.ts                     ← POST /v1/households/:id/invites/:inviteId/revoke (NEW)
│   │   │   ├── members-list.ts                       ← GET /v1/households/:id/members (NEW)
│   │   │   └── members-remove.ts                     ← DELETE /v1/households/:id/members/:userId (NEW)
│   │   ├── routes/admin/households.ts                ← GET/DELETE /v1/admin/households (requireAdmin, NEW)
│   │   ├── routes/records/create.ts                  ← accept optional householdId (MODIFY)
│   │   ├── routes/records/patch.ts                   ← enforce member permission (MODIFY)
│   │   └── routes/records/list.ts                    ← honor ?scope=personal|household|all (MODIFY)
│   └── tests/
│       ├── helpers/factories.ts                      ← +makeHousehold, makeMembership, makeInvite (MODIFY)
│       ├── helpers/setup.ts                          ← truncate new tables (MODIFY)
│       ├── unit/
│       │   ├── invite-code.test.ts                   ← NEW
│       │   └── household-permissions.test.ts         ← NEW
│       └── integration/
│           ├── households-crud.test.ts               ← NEW
│           ├── households-invites.test.ts            ← NEW
│           ├── households-members.test.ts            ← NEW
│           ├── households-dissolve.test.ts           ← NEW
│           ├── records-household-scope.test.ts       ← NEW (scope + create + patch perms incl. cross-household IDOR)
│           ├── records-sync-household.test.ts        ← NEW (server-wins vs LWW + scope-change conflict + visibility re-filter)
│           └── admin-households.test.ts              ← NEW (requireAdmin list + dissolve)
├── apps/mobile/
│   ├── package.json                                  ← (no new deps expected)
│   ├── app/(app)/
│   │   ├── household/index.tsx                       ← household settings screen (NEW)
│   │   ├── household/invite.tsx                      ← deep-link invite accept landing (NEW)
│   │   └── (tabs)/home.tsx                            ← +Personal/Household scope toggle (MODIFY)
│   └── src/
│       ├── db/schema.ts                              ← +household_id column on records (MODIFY)
│       ├── db/migrations.ts                          ← +schema migration step (MODIFY)
│       ├── db/models/Record.ts                       ← +householdId field (MODIFY)
│       ├── **db/sync.ts**                            ← split conflict policy + scope-change conflict + purge-on-leave/dissolve (MODIFY)
│       ├── api/households.ts                         ← TanStack Query hooks (NEW)
│       ├── store/pantryScope.ts                      ← Zustand scope toggle store (NEW)
│       ├── features/households/
│       │   ├── HouseholdSettings.tsx                 ← create/join/members/leave/dissolve (NEW)
│       │   ├── MemberRow.tsx                         ← member + role + remove (NEW)
│       │   ├── InviteShareSheet.tsx                  ← share invite deep link (NEW)
│       │   └── ScopeToggle.tsx                       ← Personal / Household segmented control (NEW)
│       ├── features/records/
│       │   ├── AddRecordForm.tsx                     ← +assign-to-household picker (MODIFY)
│       │   └── RecordCard.tsx                        ← +shared attribution ("added by …") (MODIFY)
│       ├── linking/deepLink.ts                       ← route pantry://household/invite (MODIFY, M0c handler)
│       └── __tests__/
│           ├── ScopeToggle.test.tsx                  ← NEW
│           ├── HouseholdSettings.test.tsx            ← NEW
│           └── sync-household.test.ts                ← NEW (split conflict policy)
│   └── .maestro/
│       └── household-invite-flow.yaml                ← E2E (NEW)
└── apps/admin/
    ├── app/households/page.tsx                       ← list households (NEW)
    ├── app/households/[id]/page.tsx                  ← members + dissolve (NEW)
    ├── lib/households.ts                             ← serverAdminApi calls (NEW)
    └── e2e/households.spec.ts                        ← Playwright (NEW)
```

---

## Conventions (carried over from M0a–M3)

- **TDD where logic exists.** Failing test → run → fail → implement → run → pass → commit. No batched commits across features.
- **Conventional commits.** Scopes: `shared`, `api`, `mobile`, `admin`. No milestone/decision references in commit messages or code comments — describe the change/invariant.
- **Wire contract is camelCase; DB columns are snake_case via Prisma `@map`; error `code` strings are snake_case.** (e.g. wire `householdId`, column `household_id`, error code `household_not_member`.)
- **Every API route imports its Zod schema from `@pantry/shared`** and validates input + output.
- **Every handler uses `req.user`, `app.requireAuth`, and `req.id` for logging.** Owner-only routes additionally assert ownership via `assertOwner`.
- **Idempotency-Key required** on every household write (`POST /v1/households`, invites accept/create/revoke, members remove, record create/patch) via the M1 plugin.
- **RFC 7807** errors via `AppError` from M0a. New error codes (snake_case): `household_not_found`, `household_not_member`, `household_forbidden` (not owner), `household_owner_cannot_leave`, `invite_not_found`, `invite_invalid` (revoked/expired/wrong state), `invite_already_requested` (a pending request already exists for this code), `member_not_found`, `record_household_forbidden`. Sync conflict signalling uses a non-error `conflict` field in the response payload (see Phase E), not an `AppError`.
- **No `console.log`.** Use `req.log` (API), the mobile logger, the admin logger.
- **Test DB:** real Postgres `pantry_test`, truncated before each test by the harness.

---

## Phase A — Shared Zod schemas

### Task A1: Add household Zod schemas

**Files:**
- Create: `packages/shared/src/schemas/household.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/household.ts`**

```ts
import { z } from 'zod';

export const householdRoleSchema = z.enum(['owner', 'member']);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

// Lifecycle: pending (link issued) → requested (a user asked to join, awaiting
// owner approval) → accepted (owner approved; the single terminal success state)
// | revoked. Expiry is computed from expiresAt > now() and is NOT a stored status.
export const householdInviteStatusSchema = z.enum([
  'pending',
  'requested',
  'accepted',
  'revoked',
]);
export type HouseholdInviteStatus = z.infer<typeof householdInviteStatusSchema>;

export const householdMemberSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  userId: z.string().uuid(),
  role: householdRoleSchema,
  joinedAt: z.string().datetime(),
  /** Light projection — first name + avatar only, never email. */
  user: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      avatarUrl: z.string().url().nullable(),
    })
    .optional(),
});
export type HouseholdMember = z.infer<typeof householdMemberSchema>;

export const householdSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerUserId: z.string().uuid(),
  /** Present on detail responses; omitted on list rows. */
  memberCount: z.number().int().nonnegative().optional(),
  myRole: householdRoleSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Household = z.infer<typeof householdSchema>;

export const householdCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type HouseholdCreate = z.infer<typeof householdCreateSchema>;

export const householdPatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type HouseholdPatch = z.infer<typeof householdPatchSchema>;

export const householdInviteSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  code: z.string(),
  invitedEmail: z.string().email().nullable(),
  status: householdInviteStatusSchema,
  /** Set once a user has requested to join via the link; awaiting owner approval. */
  requestedByUserId: z.string().uuid().nullable(),
  requestedByUser: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      avatarUrl: z.string().url().nullable(),
    })
    .nullable()
    .optional(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type HouseholdInvite = z.infer<typeof householdInviteSchema>;

export const householdInviteCreateSchema = z.object({
  invitedEmail: z.string().trim().email().nullable().optional(),
});
export type HouseholdInviteCreate = z.infer<typeof householdInviteCreateSchema>;

export const householdInviteCreateResponseSchema = z.object({
  invite: householdInviteSchema,
  /** Deep link the inviter can share. */
  inviteUrl: z.string(),
});
export type HouseholdInviteCreateResponse = z.infer<
  typeof householdInviteCreateResponseSchema
>;

/** A user submits a join REQUEST by presenting a link code. Does not grant membership. */
export const householdInviteRequestSchema = z.object({
  code: z.string().trim().min(8).max(64),
});
export type HouseholdInviteRequest = z.infer<typeof householdInviteRequestSchema>;

export const householdListResponseSchema = z.object({
  items: z.array(householdSchema),
});
export type HouseholdListResponse = z.infer<typeof householdListResponseSchema>;

export const householdMembersResponseSchema = z.object({
  items: z.array(householdMemberSchema),
});
export type HouseholdMembersResponse = z.infer<
  typeof householdMembersResponseSchema
>;
```

- [ ] **Step 2: Re-export from `packages/shared/src/index.ts`**

Append:
```ts
export * from './schemas/household.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @pantry/shared typecheck
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/household.ts packages/shared/src/index.ts
git commit -m "feat(shared): add household + invite + member Zod schemas"
```

---

### Task A2: Extend record schemas with household scoping

**Files:**
- Modify: `packages/shared/src/schemas/record.ts`
- Modify: `packages/shared/src/schemas/error.ts`

- [ ] **Step 1: Add `householdId` to `recordSchema`**

In `recordSchema` (the response shape), add after `userId`:
```ts
  householdId: z.string().uuid().nullable(),
```

- [ ] **Step 2: Add optional `householdId` to `recordCreateSchema`**

Inside the object passed to `recordCreateSchema` (before the `.refine`), add:
```ts
    householdId: z.string().uuid().nullable().optional(),
```
> A `null`/absent `householdId` keeps the record personal (v1 default). A non-null value assigns it to a household the caller belongs to (enforced server-side in Task D2).

- [ ] **Step 3: Add optional `householdId` to `recordPatchSchema`**

Add to the patch object:
```ts
  householdId: z.string().uuid().nullable().optional(),
```
> Patching `householdId` moves a record between personal and a household (or reassigns); enforced server-side — the caller must belong to both the source (if any) and the target household.

- [ ] **Step 4: Add the scope query schema for `GET /v1/records`**

Append to `record.ts`:
```ts
export const recordScopeSchema = z.enum(['personal', 'household', 'all']).default('all');
export type RecordScope = z.infer<typeof recordScopeSchema>;

export const recordListQuerySchema = z.object({
  scope: recordScopeSchema,
  /** Restrict to a single household (only meaningful with scope=household|all). */
  householdId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type RecordListQuery = z.infer<typeof recordListQuerySchema>;
```
> If M1 already exports a `recordListQuerySchema`, extend it in place (add `scope` + `householdId`) instead of redeclaring.

- [ ] **Step 5: Add household error codes to `error.ts`**

Inside the `ERROR_CODES` object, add:
```ts
  HOUSEHOLD_NOT_FOUND: 'household_not_found',
  HOUSEHOLD_NOT_MEMBER: 'household_not_member',
  HOUSEHOLD_FORBIDDEN: 'household_forbidden',
  HOUSEHOLD_OWNER_CANNOT_LEAVE: 'household_owner_cannot_leave',
  INVITE_NOT_FOUND: 'invite_not_found',
  INVITE_INVALID: 'invite_invalid',
  INVITE_ALREADY_REQUESTED: 'invite_already_requested',
  MEMBER_NOT_FOUND: 'member_not_found',
  RECORD_HOUSEHOLD_FORBIDDEN: 'record_household_forbidden',
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @pantry/shared typecheck
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/schemas/record.ts packages/shared/src/schemas/error.ts
git commit -m "feat(shared): add household scoping to record schemas + error codes"
```

---

## Phase B — Database schema + forward records migration

### Task B1: Add household models + `Record.householdId` to `schema.prisma`

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Add enums above the existing `User` model**

After the last existing enum, append:
```prisma
enum HouseholdRole {
  owner
  member

  @@map("household_role")
}

enum HouseholdInviteStatus {
  pending
  requested
  accepted
  revoked

  @@map("household_invite_status")
}
```

- [ ] **Step 2: Add the new relations to the existing `User` model**

In the `model User` relations section append:
```prisma
  householdsOwned     Household[]         @relation("HouseholdOwner")
  householdMemberships HouseholdMember[]
  invitesCreated      HouseholdInvite[]   @relation("HouseholdInviteCreator")
  invitesRequested    HouseholdInvite[]   @relation("HouseholdInviteRequester")
```

- [ ] **Step 3: Add `householdId` + relation to the existing `Record` model**

Inside `model Record`, add the nullable field (after `userId`):
```prisma
  householdId   String?      @db.Uuid @map("household_id")
```
and in its relations section:
```prisma
  household     Household?   @relation(fields: [householdId], references: [id], onDelete: SetNull)
```
and add two indexes — one for household-scoped list/filter queries, one that serves the membership-scoped **sync cursor** (`household_id IN (...) AND updated_at > since`):
```prisma
  @@index([householdId, status, expiryDate])
  @@index([householdId, updatedAt])
```
> **`onDelete: SetNull` is the mechanism that reverts records on dissolve, not a safety net.** When the `households` row is deleted (Task C5), Postgres sets `records.household_id = NULL` for every affected record, reverting them to creator-private. The dissolve path does NOT also imperatively null them — that would be redundant. Only *partial member-remove* nulls imperatively, because the FK cannot express "this one member's records only".
> **The `[householdId, updatedAt]` index is load-bearing for scale.** The sync delta pulls the union across all the user's households each cycle (`household_id IN (...) AND updated_at > since`); without this index that query seq-scans `records` as the table grows. The existing `@@index([userId, status, expiryDate])` stays for personal-scope queries.

- [ ] **Step 4: Add the new models at the bottom of `schema.prisma`**

```prisma
model Household {
  id          String            @id @default(uuid()) @db.Uuid
  name        String
  ownerUserId String            @db.Uuid @map("owner_user_id")
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  owner   User              @relation("HouseholdOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)
  members HouseholdMember[]
  invites HouseholdInvite[]
  records Record[]

  @@index([ownerUserId])
  @@map("households")
}

model HouseholdMember {
  id          String        @id @default(uuid()) @db.Uuid
  householdId String        @db.Uuid @map("household_id")
  userId      String        @db.Uuid @map("user_id")
  role        HouseholdRole @default(member)
  joinedAt    DateTime      @default(now()) @map("joined_at")

  household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([householdId, userId])
  @@index([userId])
  @@map("household_members")
}

model HouseholdInvite {
  id                String                @id @default(uuid()) @db.Uuid
  householdId       String                @db.Uuid @map("household_id")
  code              String                @unique
  invitedEmail      String?               @map("invited_email")
  createdByUserId   String                @db.Uuid @map("created_by_user_id")
  status            HouseholdInviteStatus @default(pending)
  expiresAt         DateTime              @map("expires_at")
  // Set when a user submits a join REQUEST via the link (status → requested).
  // The owner must approve before membership is granted (status → accepted).
  requestedByUserId String?               @db.Uuid @map("requested_by_user_id")
  requestedAt       DateTime?             @map("requested_at")
  acceptedAt        DateTime?             @map("accepted_at")
  createdAt         DateTime              @default(now()) @map("created_at")

  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  createdBy   User      @relation("HouseholdInviteCreator", fields: [createdByUserId], references: [id], onDelete: Cascade)
  requestedBy User?     @relation("HouseholdInviteRequester", fields: [requestedByUserId], references: [id], onDelete: SetNull)

  @@index([householdId, status])
  @@map("household_invites")
}
```

- [ ] **Step 5: Format + validate**

```bash
pnpm --filter @pantry/api exec prisma format
pnpm --filter @pantry/api exec prisma validate
```
Expected: `The schema at api/prisma/schema.prisma is valid 🚀`.

- [ ] **Step 6: Commit**

```bash
git add api/prisma/schema.prisma
git commit -m "feat(api): add households, household_members, household_invites + record.household_id"
```

---

### Task B2: Generate the forward additive migration

**Files:**
- Create: `api/prisma/migrations/<ts>_m8_household_sharing/migration.sql` (generated)

- [ ] **Step 1: Create the migration**

```bash
pnpm --filter @pantry/api exec prisma migrate dev --name m8_household_sharing
```
Expected: prints `Applying migration ...` and `✔ Generated Prisma Client`.

> **This is the forward, additive migration on the live `records` table.** Prisma emits `ALTER TABLE "records" ADD COLUMN "household_id" UUID;` — nullable, so **every existing row gets `household_id = NULL` and stays private to its `user_id`** (v1 behavior preserved, zero data loss). No backfill, no scrub. The new tables are created fresh. Confirm the generated SQL contains the `ADD COLUMN ... NULL` (no `NOT NULL`, no `DEFAULT` that would imply a rewrite) before applying to production.

- [ ] **Step 2: Verify the tables, the new column, and indexes**

```bash
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\dt"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\d records"
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\di households*"
```
Expected: `households`, `household_members`, `household_invites` listed; `records` has a nullable `household_id uuid` column + both `records_household_id_status_expiry_date_idx` and `records_household_id_updated_at_idx` (the latter serves the membership-scoped sync cursor); `household_members` has the `(household_id, user_id)` unique index; `household_invites.code` is unique.

- [ ] **Step 3: Update test setup to truncate new tables**

In `api/tests/helpers/setup.ts`, add `household_invites`, `household_members`, `households` to the `tables` array **before `records`** (children first; `records.household_id` references `households` so `households` must be truncated after `records` is cleared — but since truncation clears all rows, place the three household tables immediately before `users` and after `records`). Concretely, insert between the existing records/products block and `users`:
```ts
  'household_invites',
  'household_members',
  'households',
```
> Order rule: any table whose FK target appears later in the list must be truncated first. `records.household_id → households` means `records` truncates before `households`; `household_members`/`household_invites` reference `households`, so they truncate before `households` too. Keeping the three household tables together immediately before `users` satisfies this.

- [ ] **Step 4: Run the existing suite to confirm nothing broke**

```bash
pnpm --filter @pantry/api test
```
Expected: all prior M0–M4 tests still pass (records still default to personal).

- [ ] **Step 5: Commit**

```bash
git add api/prisma/migrations api/tests/helpers/setup.ts
git commit -m "feat(api): forward migration adding nullable records.household_id + household tables"
```

---

### Task B3: Extend test factories

**Files:**
- Modify: `api/tests/helpers/factories.ts`

- [ ] **Step 1: Append helpers to `api/tests/helpers/factories.ts`**

```ts
import { randomUUID } from 'node:crypto';
// getPrisma already imported by M1's factories.

export async function makeHousehold(ownerUserId: string, overrides: Partial<{
  name: string;
}> = {}) {
  const prisma = getPrisma();
  const household = await prisma.household.create({
    data: { name: overrides.name ?? 'Test Household', ownerUserId },
  });
  // Owner is always a member with role 'owner'.
  await prisma.householdMember.create({
    data: { householdId: household.id, userId: ownerUserId, role: 'owner' },
  });
  return household;
}

export async function makeMembership(householdId: string, userId: string, overrides: Partial<{
  role: 'owner' | 'member';
}> = {}) {
  const prisma = getPrisma();
  return prisma.householdMember.create({
    data: { householdId, userId, role: overrides.role ?? 'member' },
  });
}

export async function makeInvite(householdId: string, createdByUserId: string, overrides: Partial<{
  code: string;
  invitedEmail: string | null;
  status: 'pending' | 'requested' | 'accepted' | 'revoked';
  requestedByUserId: string | null;
  expiresAt: Date;
}> = {}) {
  const prisma = getPrisma();
  return prisma.householdInvite.create({
    data: {
      householdId,
      createdByUserId,
      code: overrides.code ?? `invite-${randomUUID()}`,
      invitedEmail: overrides.invitedEmail ?? null,
      status: overrides.status ?? 'pending',
      requestedByUserId: overrides.requestedByUserId ?? null,
      requestedAt: overrides.requestedByUserId ? new Date() : null,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
}
```
> The existing `makeRecord(userId, overrides)` from M1 gains a `householdId` override at no schema cost — pass it through if your M1 factory whitelists keys; otherwise add `householdId: overrides.householdId ?? null` to its `data`.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @pantry/api typecheck
git add api/tests/helpers/factories.ts
git commit -m "test(api): add household, membership, invite factories"
```

---

## Phase C — Households service + HTTP routes

All routes mount under `/v1/households`. Every handler requires `app.requireAuth`. Member-scoped routes call `assertMember`; owner-scoped routes call `assertOwner`.

### Task C1: Invite-code generator (unit-tested)

**Files:**
- Create: `api/src/services/households/invite-code.ts`
- Create: `api/tests/unit/invite-code.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/unit/invite-code.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { generateInviteCode } from '../../src/services/households/invite-code.js';

describe('generateInviteCode', () => {
  it('produces URL-safe codes of the expected length', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeGreaterThanOrEqual(16);
  });

  it('is collision-resistant across many draws', () => {
    const set = new Set(Array.from({ length: 5000 }, () => generateInviteCode()));
    expect(set.size).toBe(5000);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/invite-code.test.ts
```

- [ ] **Step 3: Write `api/src/services/households/invite-code.ts`**

```ts
import { randomBytes } from 'node:crypto';

/**
 * Opaque, URL-safe invite code. 18 random bytes → 24 base64url chars;
 * unguessable and safe to embed in a shareable deep link.
 */
export function generateInviteCode(): string {
  return randomBytes(18).toString('base64url');
}
```

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/invite-code.test.ts
git add api/src/services/households/invite-code.ts api/tests/unit/invite-code.test.ts
git commit -m "feat(api): URL-safe household invite-code generator"
```

---

### Task C2: Permissions helpers (unit-tested)

**Files:**
- Create: `api/src/services/households/permissions.ts`
- Create: `api/src/services/households/repository.ts`
- Create: `api/tests/unit/household-permissions.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/unit/household-permissions.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { roleAllowsManage, canEditRecordHousehold } from '../../src/services/households/permissions.js';

describe('household permission predicates', () => {
  it('only owner may manage members/household', () => {
    expect(roleAllowsManage('owner')).toBe(true);
    expect(roleAllowsManage('member')).toBe(false);
  });

  it('any member may edit a record in their household', () => {
    // membership present → allowed regardless of role
    expect(canEditRecordHousehold({ isMember: true })).toBe(true);
    expect(canEditRecordHousehold({ isMember: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/household-permissions.test.ts
```

- [ ] **Step 3: Write `api/src/services/households/permissions.ts`**

```ts
import type { HouseholdRole } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

/** Owner-only actions: invite, revoke, remove members, rename, dissolve. */
export function roleAllowsManage(role: HouseholdRole): boolean {
  return role === 'owner';
}

/** Any member (owner or member) may view/create/edit/consume household records. */
export function canEditRecordHousehold(ctx: { isMember: boolean }): boolean {
  return ctx.isMember;
}

/** Returns the caller's membership row or throws household_not_member. */
export async function assertMember(householdId: string, userId: string) {
  const prisma = getPrisma();
  const m = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  if (!m) throw new AppError(403, 'household_not_member', 'Not a member of this household');
  return m;
}

/** Asserts the caller is the owner; throws household_forbidden otherwise. */
export async function assertOwner(householdId: string, userId: string) {
  const m = await assertMember(householdId, userId);
  if (!roleAllowsManage(m.role)) {
    throw new AppError(403, 'household_forbidden', 'Owner permission required');
  }
  return m;
}
```

- [ ] **Step 4: Write `api/src/services/households/repository.ts`** (serializers + membership lookups)

```ts
import type { Household, HouseholdMember, HouseholdInvite, User } from '@prisma/client';
import type {
  Household as ApiHousehold,
  HouseholdMember as ApiMember,
  HouseholdInvite as ApiInvite,
} from '@pantry/shared';

export function toApiHousehold(
  h: Household,
  opts: { memberCount?: number; myRole?: 'owner' | 'member' } = {},
): ApiHousehold {
  return {
    id: h.id,
    name: h.name,
    ownerUserId: h.ownerUserId,
    memberCount: opts.memberCount,
    myRole: opts.myRole,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  };
}

type MemberWithUser = HouseholdMember & {
  user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
};

export function toApiMember(m: MemberWithUser): ApiMember {
  const out: ApiMember = {
    id: m.id,
    householdId: m.householdId,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  };
  if (m.user) {
    out.user = { id: m.user.id, firstName: m.user.firstName, avatarUrl: m.user.avatarUrl };
  }
  return out;
}

export function toApiInvite(i: HouseholdInvite): ApiInvite {
  return {
    id: i.id,
    householdId: i.householdId,
    code: i.code,
    invitedEmail: i.invitedEmail,
    status: i.status,
    requestedByUserId: i.requestedByUserId,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  };
}
```

- [ ] **Step 5: Run, verify PASS; typecheck; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/household-permissions.test.ts
pnpm --filter @pantry/api typecheck
git add api/src/services/households/permissions.ts api/src/services/households/repository.ts api/tests/unit/household-permissions.test.ts
git commit -m "feat(api): household permission predicates + serializers"
```

---

### Task C3: Household CRUD routes (create / mine / get / patch)

**Files:**
- Create: `api/src/routes/households/index.ts`, `create.ts`, `mine.ts`, `get.ts`, `patch.ts`
- Modify: `api/src/server.ts`
- Create: `api/tests/integration/households-crud.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/integration/households-crud.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}`, 'idempotency-key': cryptoRandom() } };
}
function cryptoRandom() { return crypto.randomUUID(); }

describe('households CRUD', () => {
  it('creator becomes owner; appears in GET /mine; owner can rename', async () => {
    const app = await buildServer();
    const { headers } = await authed();

    const created = await app.inject({
      method: 'POST', url: '/v1/households', headers,
      payload: { name: 'Flat 3B' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    expect(created.json().ownerUserId).toBeTruthy();
    expect(created.json().myRole).toBe('owner');

    const mine = await app.inject({ method: 'GET', url: '/v1/households/mine', headers });
    expect(mine.json().items.map((h: { id: string }) => h.id)).toContain(id);

    const renamed = await app.inject({
      method: 'PATCH', url: `/v1/households/${id}`,
      headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
      payload: { name: 'Flat 3C' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe('Flat 3C');
    await app.close();
  });

  it('non-member cannot GET a household detail', async () => {
    const app = await buildServer();
    const owner = await authed();
    const created = await app.inject({
      method: 'POST', url: '/v1/households', headers: owner.headers, payload: { name: 'Private' },
    });
    const id = created.json().id;

    const stranger = await authed();
    const res = await app.inject({ method: 'GET', url: `/v1/households/${id}`, headers: stranger.headers });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('household_not_member');
    await app.close();
  });

  it('non-owner member cannot rename', async () => {
    const app = await buildServer();
    const owner = await authed();
    const id = (await app.inject({
      method: 'POST', url: '/v1/households', headers: owner.headers, payload: { name: 'Shared' },
    })).json().id;
    // (member join exercised in invites test; here just assert owner-gate via stranger)
    const stranger = await authed();
    const res = await app.inject({
      method: 'PATCH', url: `/v1/households/${id}`, headers: stranger.headers, payload: { name: 'Nope' },
    });
    expect([403]).toContain(res.statusCode);
    await app.close();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/households-crud.test.ts
```

- [ ] **Step 3: Write the routes**

`api/src/routes/households/create.ts` — `POST /v1/households`. Validate body with `householdCreateSchema`. In a transaction: create `households` row with `ownerUserId = req.user.id`, then create the owner `household_members` row (role `owner`). Reply `201` with `toApiHousehold(h, { memberCount: 1, myRole: 'owner' })`.

`api/src/routes/households/mine.ts` — `GET /v1/households/mine`. Query `householdMember` where `userId = req.user.id`, include the household; map each to `toApiHousehold(h, { myRole: member.role })`. Reply `{ items }`.

`api/src/routes/households/get.ts` — `GET /v1/households/:id`. `assertMember(id, req.user.id)`, load household + member count, reply `toApiHousehold(h, { memberCount, myRole })`.

`api/src/routes/households/patch.ts` — `PATCH /v1/households/:id`. `assertOwner`, validate `householdPatchSchema`, update `name`, reply `200`.

`api/src/routes/households/index.ts` — registers the four sub-routes (and the invites/members/dissolve routes from later tasks) under no extra prefix; the plugin is mounted at `/v1/households` from `server.ts`.

- [ ] **Step 4: Mount in `server.ts`**

```ts
import { householdRoutes } from './routes/households/index.js';
await app.register(householdRoutes, { prefix: '/v1/households' });
```

- [ ] **Step 5: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/households-crud.test.ts
git add api/src/routes/households api/src/server.ts api/tests/integration/households-crud.test.ts
git commit -m "feat(api): household create/list-mine/get/rename routes"
```

---

### Task C4: Invite routes — owner-approval join requests (create / request / approve / revoke)

> **Security model (decision 6): a leaked link does NOT grant access.** The link lets a user *request* to join; the owner must *approve*. There is no endpoint by which a code alone makes someone a member.

**Files:**
- Create: `api/src/routes/households/invites-create.ts`, `invites-request.ts`, `invites-approve.ts`, `invites-revoke.ts`
- Modify: `api/src/routes/households/index.ts`
- Create: `api/tests/integration/households-invites.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/integration/households-invites.test.ts`**

Cover: (1) owner creates an invite → `201` with a `code` + `inviteUrl` (`pantry://household/invite?code=…`); (2) a second user **requests** to join via `POST /v1/households/invites/request {code}` → `200`, invite `status='requested'`, **the requester is NOT yet a member** (assert `GET /:id/members` does NOT contain them); (3) the OWNER approves via `POST /v1/households/:id/invites/:inviteId/approve` → `200`, now the requester IS a member; (4) a non-owner cannot approve → `household_forbidden`; (5) approving an already-accepted invite → `400 invite_invalid` (single-use); (6) two racing approvals → exactly one succeeds, the other gets `invite_invalid` (atomic conditional update); (7) requesting against an expired invite (`expiresAt <= now()`) → `invite_invalid` (computed, no stored flip); (8) owner revokes a pending/requested invite → status `revoked`, subsequent request/approve → `invite_invalid`; (9) non-owner cannot create an invite → `household_forbidden`; (10) **join picks up existing reminders:** with a household that already has an active shared record (future expiry), after the owner approves a new member, that newly-joined member has an expiry reminder scheduled for the existing record using **the new member's own `notificationPreferences.offsetsDays`** (assert a reminder now exists for the joiner that did not before approval; existing members' reminders unchanged).

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: () => ({ authorization: `Bearer ${token}`, 'idempotency-key': crypto.randomUUID() }) };
}

describe('household invites — owner-approval join requests', () => {
  it('a leaked code alone does NOT grant membership; owner must approve', async () => {
    const app = await buildServer();
    const owner = await authed();
    const id = (await app.inject({ method: 'POST', url: '/v1/households', headers: owner.headers(), payload: { name: 'Home' } })).json().id;

    const inviteRes = await app.inject({ method: 'POST', url: `/v1/households/${id}/invites`, headers: owner.headers(), payload: {} });
    expect(inviteRes.statusCode).toBe(201);
    const { invite, inviteUrl } = inviteRes.json();
    expect(inviteUrl).toContain(invite.code);

    // joiner presents the leaked code → only a REQUEST, not membership
    const joiner = await authed();
    const reqRes = await app.inject({ method: 'POST', url: '/v1/households/invites/request', headers: joiner.headers(), payload: { code: invite.code } });
    expect(reqRes.statusCode).toBe(200);
    expect(reqRes.json().invite.status).toBe('requested');

    const before = await app.inject({ method: 'GET', url: `/v1/households/${id}/members`, headers: owner.headers() });
    expect(before.json().items.map((m: { userId: string }) => m.userId)).not.toContain(joiner.user.id);

    // owner approves → now a member
    const approve = await app.inject({ method: 'POST', url: `/v1/households/${id}/invites/${invite.id}/approve`, headers: owner.headers() });
    expect(approve.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: `/v1/households/${id}/members`, headers: owner.headers() });
    expect(after.json().items.map((m: { userId: string }) => m.userId)).toContain(joiner.user.id);
    await app.close();
  });

  it('approval is single-use (re-approve fails)', async () => {
    const app = await buildServer();
    const owner = await authed();
    const id = (await app.inject({ method: 'POST', url: '/v1/households', headers: owner.headers(), payload: { name: 'Home' } })).json().id;
    const invite = (await app.inject({ method: 'POST', url: `/v1/households/${id}/invites`, headers: owner.headers(), payload: {} })).json().invite;
    const joiner = await authed();
    await app.inject({ method: 'POST', url: '/v1/households/invites/request', headers: joiner.headers(), payload: { code: invite.code } });
    await app.inject({ method: 'POST', url: `/v1/households/${id}/invites/${invite.id}/approve`, headers: owner.headers() });
    const second = await app.inject({ method: 'POST', url: `/v1/households/${id}/invites/${invite.id}/approve`, headers: owner.headers() });
    expect(second.json().code).toBe('invite_invalid');
    await app.close();
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Write the routes**

`invites-create.ts` — `POST /v1/households/:id/invites`. `assertOwner`. Validate `householdInviteCreateSchema`. Create a `household_invites` row with `code = generateInviteCode()`, `createdByUserId = req.user.id`, `status = 'pending'`, `expiresAt = now + 14 days`, optional `invitedEmail`. Reply `201` `{ invite: toApiInvite(row), inviteUrl: \`pantry://household/invite?code=${row.code}\` }`.

`invites-request.ts` — `POST /v1/households/invites/request`. Validate `householdInviteRequestSchema`. Look up the invite by `code`; if missing → `404 invite_not_found`. Validate the invite is joinable: **`status === 'pending'` AND `expiresAt > now()`** — compute expiry from the timestamp, do NOT write any `expired` status. If not joinable (revoked / already requested / already accepted / past expiry) → `400 invite_invalid`. If the requester is already a member of the household → `400 invite_invalid` (nothing to request). Otherwise atomically claim the invite for this requester: `updateMany({ where: { id, status: 'pending' }, data: { status: 'requested', requestedByUserId: req.user.id, requestedAt: now } })`; if `count === 0` (someone else already claimed it) → `400 invite_invalid` / `invite_already_requested`. **This does NOT create a `household_members` row.** Reply `200 { invite: toApiInvite(row) }` (status `requested`).

`invites-approve.ts` — `POST /v1/households/:id/invites/:inviteId/approve`. `assertOwner` on `:id`. Load the invite scoped to `:id`; if missing → `404 invite_not_found`. The approve write must be **atomic and single-use** so two racing approvals cannot both succeed: in a transaction, take the household-row lock (decision 8), then `const claimed = await tx.householdInvite.updateMany({ where: { id: inviteId, householdId: id, status: 'requested' }, data: { status: 'accepted', acceptedAt: now } })`. If `claimed.count === 0` → `400 invite_invalid` (not in a `requested` state — already accepted/revoked/never requested). On success, upsert the `household_members` row for `requestedByUserId` (`role member`, idempotent on the unique `(householdId, userId)`), then fire the existing `notification-send` template `household_invite_accepted`. **Schedule the new member into the household's active records' reminders (decision 7):** still inside the locked transaction, load that household's active records (`householdId = :id`, not consumed/discarded, future `expiryDate`) and schedule an expiry reminder for the newly-joined `requestedByUserId` on each, using **that new member's own `notificationPreferences.offsetsDays`** (default `[3,1,0]`) via the M1 `notify-at` helper — so a member who joins after items were added still gets their reminders. Existing members' schedules are untouched. Reply `200` with the household (`toApiHousehold(h, { memberCount })`).

`invites-revoke.ts` — `POST /v1/households/:id/invites/:inviteId/revoke`. `assertOwner`. Load invite scoped to `:id`; if missing → `404 invite_not_found`; if already `accepted` or `revoked` → `400 invite_invalid` (a `pending` or `requested` invite may be revoked). Set `status='revoked'`. Reply `200`.

- [ ] **Step 4: Register in `index.ts`; run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/households-invites.test.ts
git add api/src/routes/households api/tests/integration/households-invites.test.ts
git commit -m "feat(api): household invite create/request/approve/revoke (owner-approval join)"
```

---

### Task C5: Members routes + dissolve

**Files:**
- Create: `api/src/routes/households/members-list.ts`, `members-remove.ts`, `dissolve.ts`
- Modify: `api/src/routes/households/index.ts`
- Create: `api/tests/integration/households-members.test.ts`, `households-dissolve.test.ts`

- [ ] **Step 1: Write failing tests**

`households-members.test.ts`: (1) `GET /:id/members` lists members with role + light user projection (member-only access); (2) owner removes a member → `204`, member gone, **that member's household records revert to `household_id = NULL`** (so the leaving member keeps nothing shared but the items survive as the creator's personal records); (3) a member removes themselves (`DELETE /:id/members/:ownUserId`) → `204`; (4) owner self-leave → `400 household_owner_cannot_leave`; (5) removing a non-member → `404 member_not_found`; (6) **leave cancels reminders:** when a member who had reminders scheduled for the household's shared records leaves (self-leave or owner-remove), that member's pending household-record reminders are cancelled (assert the leaving member no longer has pending shared-record reminders for this household; remaining members' reminders are untouched, and any record that reverted to the leaver's personal scope keeps a single-owner creator reminder).

`households-dissolve.test.ts`: (1) owner dissolves → `204`; (2) all shared records of all members revert to `household_id = NULL` **via the FK `onDelete: SetNull`** (still owned by their `user_id` creators — **assert the rows still exist**); (3) `household_members` + `household_invites` rows deleted; (4) non-owner dissolve → `403 household_forbidden`; (5) **concurrency:** a dissolve interleaved with a record PATCH that sets `householdId = :id` must not leave a record pointing at a deleted household — after both settle, no record references the dissolved id (FK integrity holds because both paths serialize on the household-row lock; the PATCH either lands before the lock is taken and is then nulled by the cascade, or runs after and finds the household gone → `record_household_forbidden`).

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership, makeRecord } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function tokenFor(userId: string, role = 'user') {
  return { authorization: `Bearer ${await issueAccessToken({ sub: userId, role })}`, 'idempotency-key': crypto.randomUUID() };
}

describe('household dissolve reverts shared records to creator-private', () => {
  it('nulls household_id and keeps rows', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    await makeMembership(hh.id, member.id, { role: 'member' });
    const rec = await makeRecord(member.id, { householdId: hh.id, customName: 'Shared milk' });

    const res = await app.inject({ method: 'DELETE', url: `/v1/households/${hh.id}`, headers: await tokenFor(owner.id) });
    expect(res.statusCode).toBe(204);

    const row = await getPrisma().record.findUnique({ where: { id: rec.id } });
    expect(row).not.toBeNull();           // item survives
    expect(row?.householdId).toBeNull();  // reverted to personal
    expect(row?.userId).toBe(member.id);  // creator attribution preserved
    expect(await getPrisma().household.findUnique({ where: { id: hh.id } })).toBeNull();
    await app.close();
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Write the routes**

`members-list.ts` — `GET /v1/households/:id/members`. `assertMember`. List `household_members` for `:id` including the light user projection. Reply `{ items: members.map(toApiMember) }`.

`members-remove.ts` — `DELETE /v1/households/:id/members/:userId`. Authorize: allowed if `req.user.id === :userId` (self-leave) OR caller is owner. Reject owner self-leave with `400 household_owner_cannot_leave`. If the target is not a member → `404 member_not_found`. In a transaction: **first take the household-row lock** (`SELECT … FROM households WHERE id = :id FOR UPDATE`, or a Postgres advisory lock keyed on `:id`) so this cannot interleave with a concurrent record write or a dissolve. Then imperatively set `records.household_id = NULL` for rows where `householdId = :id AND userId = :userId` (the removed member's shared items revert to that member's personal records — **the FK cannot express "only this member's records", so the imperative null is required here**), then delete the `household_members` row. **Cancel/skip the leaving user's pending household-record reminders (decision 7):** still inside the locked transaction, cancel the leaving `:userId`'s pending expiry reminders for this household's remaining shared records (they are no longer a member, so they must stop receiving shared reminders); the records that reverted to *their own* personal scope fall back to the M1 single-owner (creator = `:userId`) schedule. Other members' reminders for the household's records are unaffected. Reply `204`.

`dissolve.ts` — `DELETE /v1/households/:id`. `assertOwner`. In a transaction: **first take the household-row lock** (`SELECT … FOR UPDATE` / advisory lock on `:id`) so a concurrent record PATCH/sync cannot land mid-dissolve and resurrect a deleted `household_id`. Then `household.delete({ where: { id } })`. **Do NOT imperatively null `records.household_id` first** — the `records.household_id` FK is declared `onDelete: SetNull`, so deleting the household row makes Postgres revert every affected record to `household_id = NULL` in the same statement (items survive, `user_id` creator attribution preserved). The FK cascade also removes `household_members` + `household_invites`. **Reminder teardown on dissolve (decision 7):** because every shared record reverts to its creator's personal scope, cancel the per-member household reminders for all (former) members and let each reverted record fall back to its creator's M1 single-owner schedule — no member should keep receiving a shared reminder for a household that no longer exists. Reply `204`.

> **Why the asymmetry:** full dissolve = "household gone → null *all* its records", which is exactly what the FK `onDelete: SetNull` already does, so dissolve relies on the FK and adds nothing imperative. Partial member-remove = "null only *this one member's* records in a surviving household", which the FK cannot express, so it nulls imperatively. Both paths take the household-row lock so they serialize against concurrent record writes (decision 8) — no row is ever orphaned and no item is deleted (decision 5).

- [ ] **Step 4: Register in `index.ts`; run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/households-members.test.ts tests/integration/households-dissolve.test.ts
git add api/src/routes/households api/tests/integration/households-members.test.ts api/tests/integration/households-dissolve.test.ts
git commit -m "feat(api): household members list/remove + dissolve (revert shared records to private)"
```

---

## Phase D — Records household scoping

### Task D1: `GET /v1/records?scope=` filtering

**Files:**
- Modify: `api/src/routes/records/list.ts`
- Modify: `api/src/services/records/repository.ts`
- Create: `api/tests/integration/records-household-scope.test.ts` (scope cases here; create/patch cases added in D2/D3)

- [ ] **Step 1: Write the failing test (scope section)**

Assert that for a user who owns 1 personal record and is a member of a household with 2 shared records (created by another member):
- `?scope=personal` → only the 1 personal record (no household records).
- `?scope=household` → only the 2 household records (membership-scoped; personal excluded).
- `?scope=all` (default) → all 3.
- A household record created by *another member* IS visible (shared pantry).
- A personal record of *another user* is NOT visible.
- `?scope=household&householdId=<other-household-the-user-is-not-in>` → empty (never leaks).

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement the scoped query**

In the list handler, parse `recordListQuerySchema`. Resolve the caller's household IDs once: `const myHouseholdIds = (await prisma.householdMember.findMany({ where: { userId }, select: { householdId: true } })).map(m => m.householdId);`. Build the Prisma `where`:
- `scope === 'personal'` → `{ userId, householdId: null }`.
- `scope === 'household'` → `{ householdId: { in: query.householdId ? [query.householdId].filter(id => myHouseholdIds.includes(id)) : myHouseholdIds } }`.
- `scope === 'all'` → `OR: [ { userId, householdId: null }, { householdId: { in: myHouseholdIds } } ]`.

> Critical: household records are matched by **`householdId ∈ myHouseholdIds`**, NOT by `userId`. A member sees household items created by anyone in the household. Personal records always require `userId = caller AND householdId = null`. If `householdId` query param names a household the caller isn't in, it is filtered out of the `in` list → no leak.

Serialize with `householdId` included in `toApiRecord`.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/records-household-scope.test.ts
git add api/src/routes/records/list.ts api/src/services/records/repository.ts api/tests/integration/records-household-scope.test.ts
git commit -m "feat(api): scope records list by personal/household/all"
```

---

### Task D2: `POST /v1/records` accepts optional `householdId`

**Files:**
- Modify: `api/src/routes/records/create.ts`

- [ ] **Step 1: Add create cases to `records-household-scope.test.ts`**

Assert: (1) creating a record with `householdId` of a household the caller belongs to → `201`, the row has that `householdId` and `userId = caller`; (2) creating with a `householdId` the caller is NOT in → `403 record_household_forbidden`; (3) creating without `householdId` → personal (`household_id = NULL`), unchanged v1 behavior; (4) **member fan-out:** creating a shared record in a household with N members (e.g. owner + 2 members, each with their own `offsetsDays`) schedules an expiry reminder for **every current member** (assert one scheduled notification per member, each computed from that member's own `notificationPreferences.offsetsDays`, not just the creator's), while a personal record schedules only for the creator (M1 behavior).

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement**

In `create.ts`: after validating `recordCreateSchema`, if `body.householdId` is set, do so inside a transaction that takes the household-row lock (`FOR UPDATE` / advisory lock on `body.householdId` — decision 8, so a concurrent dissolve cannot delete the household between the membership check and the insert and leave an FK-violating row), then call `assertMember(body.householdId, req.user.id)` (throws `household_not_member`; map to `403 record_household_forbidden` for the records surface, or rethrow — both are 403). Persist `householdId` on the new record; `userId` stays `req.user.id` (creator/attribution). Idempotent on `client_id` as in M1.

> **Member fan-out for shared-record reminders (decision 7).** A household record is shared by the whole household, so its expiry reminder must reach **every current member**, not just the creator. When `householdId` is set, after the insert (still inside the locked transaction) resolve the household's current members (`householdMember.findMany({ where: { householdId }, select: { userId } })`) and schedule one expiry notification per member on the existing `notification-send` pipeline, **each using that member's own `notificationPreferences.offsetsDays` (default `[3,1,0]`)** via the M1 `notify-at` helper — not a single shared schedule. A **personal** record (no `householdId`) keeps the M1 single-owner schedule unchanged.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/records-household-scope.test.ts
git add api/src/routes/records/create.ts api/tests/integration/records-household-scope.test.ts
git commit -m "feat(api): records create accepts householdId with membership check"
```

---

### Task D3: `PATCH /v1/records/:id` enforces household-member permission

**Files:**
- Modify: `api/src/routes/records/patch.ts`

- [ ] **Step 1: Add patch cases to `records-household-scope.test.ts`**

Assert: (1) a member edits a household record created by *another* member → `200` (shared pantry: any member may edit/consume); (2) a non-member tries to patch a household record → `404`/`403` (`record_household_forbidden` — never leak existence); (3) the owner of a personal record edits it → `200`; another user patching someone's personal record → `404`; (4) moving a record from personal → household the caller belongs to → `200`, `household_id` set; (5) moving to a household the caller is NOT in → `403 record_household_forbidden`. **Cross-household IDOR negatives (must all fail):** (6) a user tries to set `householdId` on *another user's* personal record (pull it into the caller's household) → `404`/`403`, the source row is untouched; (7) a member of household A tries to PATCH a record of household B (caller not in B) → `404`/`403`, never leaking B's record; (8) a member of household A tries to reassign a household-A record to household B where the caller is NOT a member → `403 record_household_forbidden`, the record stays in A.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement the explicit edit-permission predicate**

The rule, coded (not prose), is: **a caller may PATCH a record — including setting/clearing its `householdId` — only if they may write the record in its CURRENT scope AND (when assigning a household) are a member of the TARGET household.** Implement as an explicit predicate so the IDOR cases above can never slip through:

In `patch.ts`, load the record (404 if it does not exist). Then, inside a transaction that takes the household-row lock (`FOR UPDATE` / advisory lock) on any household the operation touches (current and/or target — decision 8), evaluate:

1. **May the caller write the record in its CURRENT scope?**
   - `record.householdId === null` (personal): require `record.userId === req.user.id`, else `404` (treat as not found — never reveal another user's personal record exists). This forbids pulling another user's personal record into your household (case 6).
   - `record.householdId !== null` (household): require `assertMember(record.householdId, req.user.id)` succeeds (any member may edit/consume), else `404`/`403 record_household_forbidden`. This forbids touching another household's record (cases 7, 8).
2. **If the patch sets/changes `householdId` to a non-null target:** additionally require `assertMember(body.householdId, req.user.id)`, else `403 record_household_forbidden`. You can only move a record into a household you belong to.
3. **If the patch sets `householdId: null`** (un-share back to personal): allowed for any current member that passed (1); the record's `userId` (creator) is unchanged.

Only after both predicates pass does the handler apply the patch. `userId` (creator/attribution) is never reassigned by a PATCH.

> **Reminder fan-out / teardown on scope change (decision 7).** When a PATCH changes the record's `householdId` (the resulting value differs from the prior one), reschedule its expiry reminders inside the same locked transaction: if it moved **into** a household (or to a different household, or its expiry changed while in a household), cancel any prior reminders and schedule one per **current member** of the target household, each using that member's own `notificationPreferences.offsetsDays` (default `[3,1,0]`); if it moved **out** of a household to personal (`householdId: null`), cancel the per-member household reminders and fall back to the M1 single-owner (creator) schedule. A PATCH that only changes a household record's `expiryDate` likewise re-fans-out to all current members.
> `consume`/`discard` are status patches and follow the same predicate — any member may consume a shared item, no one may consume/edit a record outside their write scope.
> The same explicit "writable in current scope" predicate guards the records create path (Task D2) when `householdId` is supplied, and the sync upsert path (Phase E) for household-scoped rows.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/records-household-scope.test.ts
git add api/src/routes/records/patch.ts api/tests/integration/records-household-scope.test.ts
git commit -m "feat(api): records patch enforces household-member permission"
```

---

## Phase E — Sync conflict policy (server-side)

### Task E1: Split conflict policy in `syncRecords`

**Files:**
- Modify: `api/src/services/records/sync.ts`
- Modify: `api/src/routes/records/sync.ts` (delta pull must include household records)
- Create: `api/tests/integration/records-sync-household.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/integration/records-sync-household.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function headersFor(userId: string) {
  return { authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user' })}` };
}

describe('records sync — split conflict policy', () => {
  it('personal records keep last-write-wins (newer client overwrites)', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const clientId = randomUUID();
    await getPrisma().record.create({ data: {
      userId: user.id, householdId: null, clientId, customName: 'Old',
      expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      updatedAt: new Date('2020-01-01'),
    }});
    await app.inject({ method: 'POST', url: '/v1/records/sync', headers: await headersFor(user.id), payload: {
      since: null,
      upserts: [{ clientId, customName: 'New', expiryDate: '2099-12-31', quantity: 1, unit: 'pcs', updatedAt: new Date().toISOString() }],
      deletes: [],
    }});
    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('New'); // LWW: client newer → wins
    await app.close();
  });

  it('household records are server-authoritative (client edit on conflict is rejected, server echoed back)', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    const clientId = randomUUID();
    // server already has a NEWER household record
    await getPrisma().record.create({ data: {
      userId: owner.id, householdId: hh.id, clientId, customName: 'ServerCanonical',
      expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
      updatedAt: new Date(),
    }});
    const res = await app.inject({ method: 'POST', url: '/v1/records/sync', headers: await headersFor(owner.id), payload: {
      since: null,
      upserts: [{ clientId, householdId: hh.id, customName: 'ClientEdit', expiryDate: '2099-12-31', quantity: 9, unit: 'pcs', updatedAt: new Date('2020-01-01').toISOString() }],
      deletes: [],
    }});
    expect(res.statusCode).toBe(200);
    const row = await getPrisma().record.findUnique({ where: { clientId } });
    expect(row?.customName).toBe('ServerCanonical'); // server wins regardless of client updatedAt
    // server version echoed in changes so the client overwrites its local copy
    const echoed = res.json().changes.find((r: { clientId: string }) => r.clientId === clientId);
    expect(echoed?.customName).toBe('ServerCanonical');
    await app.close();
  });

  it('delta pull returns household records created by OTHER members', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    await makeMembership(hh.id, member.id, { role: 'member' });
    await getPrisma().record.create({ data: {
      userId: member.id, householdId: hh.id, clientId: randomUUID(), customName: 'AddedByMember',
      expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
    }});
    const res = await app.inject({ method: 'POST', url: '/v1/records/sync', headers: await headersFor(owner.id), payload: { since: null, upserts: [], deletes: [] }});
    const names = res.json().changes.map((r: { customName: string }) => r.customName);
    expect(names).toContain('AddedByMember');
    await app.close();
  });

  it('delta re-filters by CURRENT visibility: a record that left the household is NOT echoed to a former co-member', async () => {
    const app = await buildServer();
    const creator = await makeUser({ emailVerified: true });
    const other = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(creator.id, { name: 'Home' });
    await makeMembership(hh.id, other.id, { role: 'member' });
    const clientId = randomUUID();
    const rec = await getPrisma().record.create({ data: {
      userId: creator.id, householdId: hh.id, clientId, customName: 'WasShared',
      expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
    }});
    // record reverts to creator-private (e.g. partial member-remove of creator is not it —
    // here simulate the record moving back to personal scope)
    await getPrisma().record.update({ where: { id: rec.id }, data: { householdId: null, updatedAt: new Date() } });
    // `other` is no longer able to see this now-personal record of `creator`
    const res = await app.inject({ method: 'POST', url: '/v1/records/sync', headers: await headersFor(other.id), payload: { since: null, upserts: [], deletes: [] }});
    const ids = res.json().changes.map((r: { clientId: string }) => r.clientId);
    expect(ids).not.toContain(clientId); // re-filtered out by current visibility
    await app.close();
  });

  it('a household_id CHANGE is signalled as a conflict, not a silent overwrite of a personal-era edit', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    const clientId = randomUUID();
    // server has promoted the record personal → household since the client last synced
    await getPrisma().record.create({ data: {
      userId: owner.id, householdId: hh.id, clientId, customName: 'NowShared',
      expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs', notifyAt: [],
    }});
    // client pushes a personal-era edit (householdId still null on its copy)
    const res = await app.inject({ method: 'POST', url: '/v1/records/sync', headers: await headersFor(owner.id), payload: {
      since: null,
      upserts: [{ clientId, householdId: null, customName: 'OfflinePersonalEdit', expiryDate: '2099-12-31', quantity: 3, unit: 'pcs', updatedAt: new Date().toISOString() }],
      deletes: [],
    }});
    expect(res.statusCode).toBe(200);
    // the scope change is reported as a conflict so the edit is not silently dropped
    const conflicts = res.json().conflicts ?? [];
    expect(conflicts.map((c: { clientId: string }) => c.clientId)).toContain(clientId);
    const conflict = conflicts.find((c: { clientId: string }) => c.clientId === clientId);
    expect(conflict.reason).toBe('scope_changed');
    // and the canonical (now-household) server row is echoed back
    const echoed = res.json().changes.find((r: { clientId: string }) => r.clientId === clientId);
    expect(echoed.householdId).toBe(hh.id);
    expect(echoed.customName).toBe('NowShared');
    await app.close();
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement the split policy + scope-change conflict in `syncRecords`**

Resolve the caller's household IDs **once, from membership at request time**: `const myHouseholdIds = …` (as in Task D1). This is the *current* visibility set and is used both to authorize upserts and to re-filter the echoed delta (Step 4). Initialize an empty `conflicts: { clientId, reason }[]` accumulator alongside the existing `changes`.

For each upsert `u` (load `existing` by `clientId`):

- **Scope-change conflict (check FIRST, before applying anything).** Compare the scope the client believes the record is in (`u.householdId ?? null`) against the server's current scope (`existing?.householdId ?? null`). If `existing` is present and the two differ — i.e. the record's `household_id` CHANGED on the server since the client last saw it (personal→household *or* household→personal) — **do not silently overwrite.** Record `conflicts.push({ clientId: u.clientId, reason: 'scope_changed' })`, leave the server row authoritative, and echo the server row in `changes` (Step 4) so the client adopts the new scope. A personal→household promotion therefore never silently discards the client's legitimate personal-era offline edit — the client is told its edit lost and is handed the canonical row to reconcile. (Do not apply the client mutation in this case.)

- Otherwise, decide ownership: a record is *household-scoped* if either `existing.householdId` OR `u.householdId` is set.
  - **Personal path** (no household on either side): unchanged **last-write-wins** — skip if `existing.updatedAt >= clientUpdatedAt`, else write. Foreign `client_id` (existing row owned by another user) is ignored as in M1.
  - **Household path** (`existing.householdId` or `u.householdId` set, AND scope unchanged):
    - The caller must be a current member of the relevant household (`(existing?.householdId ?? u.householdId) ∈ myHouseholdIds`), else skip the upsert (do not write, do not error the whole batch). This is the same explicit write-scope predicate as Task D3.
    - Take the household-row lock for the relevant household (decision 8) so the upsert cannot interleave with a dissolve/remove and resurrect a deleted `household_id`.
    - **Server wins:** if an `existing` server row is present, **do NOT apply the client's mutation** — leave the server row as-is. (No `updatedAt` comparison; the server copy is canonical.) Echo it in `changes`.
    - If there is **no** `existing` row, this is a brand-new offline-created household record → insert it (there is no server counterpart to lose).
  - **`notify_at` recompute + member fan-out on scope move (decision 7).** Whenever an applied write moves a record *into* a household or *out of* a household (the resulting `household_id` differs from the prior value), recompute `notify_at` with the M1 `notify-at` helper for the new scope rather than carrying over the client-sent array — a record's notification schedule must reflect its current ownership, not a stale personal-era schedule (or vice-versa). For a record now **in** a household, fan out: schedule one expiry reminder per **current member** of that household, each using that member's own `notificationPreferences.offsetsDays` (default `[3,1,0]`); a brand-new offline-created household record likewise fans out to all current members on insert. For a record reverted **to personal**, fall back to the M1 single-owner (creator) schedule and cancel the per-member household reminders.

Apply the same current-membership guard to `deletes`: a caller may delete a personal record they own (M1) or a household record only if currently a member of its household; deletes that don't match are skipped (not errored).

- [ ] **Step 4: Re-filter the echoed delta by CURRENT visibility in `sync.ts` route / `syncRecords` `changes`**

The `changes` array returned to the client is **always filtered through the caller's CURRENT visibility** (`myHouseholdIds` resolved at request time), never through possibly-stale ownership captured earlier in the request. Concretely, every record that would be echoed — whether from the `since` delta scan or from a server-wins / scope-change echo — must satisfy the same predicate as `GET /v1/records?scope=all`:

- personal: `userId === caller AND householdId === null`, **or**
- household: `householdId ∈ myHouseholdIds`.

Any record failing this is dropped from `changes`. This closes the dissolve/revert leak: if a record left a household (reverted to its creator's personal pantry) it is NOT echoed to a former co-member who no longer has access, even if it changed since `since`.

Build the `since` pull `where` exactly like the Task D1 `scope=all` filter, plus the `updatedAt > since` cursor when `since` is provided, and rely on the new `[householdId, updatedAt]` index (Task B1) so the membership-scoped cursor does not seq-scan. The response shape gains a `conflicts: { clientId, reason }[]` array (default `[]`); `changes` keeps its existing shape. This guarantees a member who lost a server-wins race or a scope change re-converges to the canonical server state on the same round-trip, household items added by other members propagate, and no record is ever echoed to someone who can no longer see it.

- [ ] **Step 5: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/records-sync-household.test.ts
git add api/src/services/records/sync.ts api/src/routes/records/sync.ts api/tests/integration/records-sync-household.test.ts
git commit -m "feat(api): split sync conflict policy + scope-change conflict + current-visibility re-filter"
```

---

## Phase F — Mobile: WatermelonDB + sync engine

(Mobile track — deferred; see Execution order header.)

### Task F1: Add `household_id` to the WatermelonDB schema + model

**Files:**
- Modify: `apps/mobile/src/db/schema.ts`
- Modify: `apps/mobile/src/db/migrations.ts`
- Modify: `apps/mobile/src/db/models/Record.ts`

- [ ] **Step 1: Bump the schema version + add the column**

In `schema.ts`, increment `version` and add to the `records` table columns:
```ts
{ name: 'household_id', type: 'string', isOptional: true },
```

- [ ] **Step 2: Add a WatermelonDB migration step**

In `migrations.ts`, add a migration to the new schema version using `addColumns` for `records.household_id` (string, optional). WatermelonDB migrations are additive and run on existing installs without wiping local data.

- [ ] **Step 3: Expose the field on the model**

In `models/Record.ts` add:
```ts
@field('household_id') householdId!: string | null;
```

- [ ] **Step 4: Typecheck; commit**

```bash
pnpm --filter @pantry/mobile typecheck
git add apps/mobile/src/db/schema.ts apps/mobile/src/db/migrations.ts apps/mobile/src/db/models/Record.ts
git commit -m "feat(mobile): add household_id to WatermelonDB records schema"
```

---

### Task F2: Split conflict policy + scope-change + local purge in the mobile sync engine

**Files:**
- Modify: `apps/mobile/src/db/sync.ts`
- Create: `apps/mobile/src/__tests__/sync-household.test.ts`

- [ ] **Step 1: Write the failing test `apps/mobile/src/__tests__/sync-household.test.ts`**

Test the pure apply/merge logic (extract a pure `applyServerChange(local, server)` helper if not already present so it is unit-testable without a live DB):
- A personal local record (`householdId == null`) with a newer local `updatedAt` than the server change is **kept** (LWW: local push will win on the next sync; the engine does not clobber an unsynced newer local edit).
- A household local record (`householdId != null`) is **always overwritten** by the incoming server change (server-authoritative) even if the local `updatedAt` is newer.
- A server change for a household the device just joined is **inserted** locally.
- **Scope-change honored:** when the server response lists a `conflicts` entry with `reason === 'scope_changed'` for a local record, the engine overwrites the local row from the echoed server `changes` entry (adopting the new `householdId`) and surfaces the dropped local edit (do not silently lose it — at minimum mark it so the UI can notify; do not re-push it).
- **Purge:** given a set of household ids the device no longer belongs to, the local-purge helper deletes exactly the local records whose `householdId` is in that set and leaves personal + still-joined-household rows intact.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement the split apply policy + scope-change + purge**

In the pull/apply path:
- For incoming server changes where the record **is household-scoped** (`server.householdId != null`): unconditionally upsert the local row from the server payload (server wins) — do not preserve local edits.
- For **personal** records (`server.householdId == null`): keep the existing M1 last-write-wins merge (local-newer edits are preserved and pushed on the next cycle).
- **Honor the `conflicts` array** the server now returns: for each `{ clientId, reason: 'scope_changed' }`, force-overwrite the local row from the matching echoed `changes` entry (the record's scope changed server-side) and surface the discarded local edit to the user instead of silently dropping it.

In the push path: still push all locally-changed records (personal + household). For household records, the server may reject the local edit and echo back its canonical version in the same response's `changes`; the apply step above then overwrites the local copy. No special client gating beyond honoring the server echo + conflicts.

**Local eviction on leave / dissolve.** Add a `purgeHouseholdRecords(householdIds: string[])` helper that deletes local WatermelonDB records whose `householdId ∈ householdIds`. Wire it into the leave/dissolve client handling (Task G1: the `useRemoveMember` self-leave and `useDissolveHousehold` mutations call it on success for the affected household id), so stale shared rows do not linger on-device forever after the user loses access. Personal records and records of still-joined households are untouched. (Server-side those records reverted to their creator's private pantry, so they correctly disappear for this device.)

Sync triggers (foreground / reconnect / post-write / 5-min interval) are unchanged from M1.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/mobile exec vitest run src/__tests__/sync-household.test.ts
git add apps/mobile/src/db/sync.ts apps/mobile/src/__tests__/sync-household.test.ts
git commit -m "feat(mobile): server-wins apply + scope-change conflict + local purge on leave/dissolve"
```

---

## Phase G — Mobile: households UI

### Task G1: Households TanStack Query hooks

**Files:**
- Create: `apps/mobile/src/api/households.ts`

- [ ] **Step 1: Write the hooks**

`useMyHouseholds()` (`GET /v1/households/mine`), `useHousehold(id)` (`GET /v1/households/:id`), `useHouseholdMembers(id)`, mutations `useCreateHousehold`, `useRenameHousehold`, `useCreateInvite`, `useRequestJoin` (`POST /v1/households/invites/request` — submits a join REQUEST from a code; does NOT grant membership), `useApproveInvite` (`POST /v1/households/:id/invites/:inviteId/approve` — owner-only), `useRevokeInvite`, `useRemoveMember`, `useDissolveHousehold`. All writes attach an `Idempotency-Key` (reuse the M2 idempotency helper). Invalidate `['households']` / `['householdMembers', id]` and `['records']` on success (records change scope after dissolve/leave). **`useRemoveMember` (self-leave) and `useDissolveHousehold` additionally call `purgeHouseholdRecords([householdId])` (Task F2) in `onSuccess`** to evict the now-inaccessible shared rows from the local WatermelonDB before the records query refetches. These writes are **online-only** TanStack mutations (households are shared, server-authoritative) — they do NOT route through the offline records write queue.

- [ ] **Step 2: Typecheck; commit**

```bash
pnpm --filter @pantry/mobile typecheck
git add apps/mobile/src/api/households.ts
git commit -m "feat(mobile): household TanStack Query hooks"
```

---

### Task G2: Pantry scope toggle (store + component)

**Files:**
- Create: `apps/mobile/src/store/pantryScope.ts`
- Create: `apps/mobile/src/features/households/ScopeToggle.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`
- Create: `apps/mobile/src/__tests__/ScopeToggle.test.tsx`

- [ ] **Step 1: Write the failing component test `ScopeToggle.test.tsx`**

Render `ScopeToggle`; assert it shows "Personal" + each household the user belongs to; tapping a segment updates the Zustand store (`pantryScope`) and triggers the home record query to refilter (`scope=personal` vs `scope=household&householdId=<id>`). When the user has no households, only "Personal" shows and the toggle is collapsed/hidden.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement**

`store/pantryScope.ts` — Zustand store holding `{ scope: 'personal' | 'household', householdId: string | null }` with a setter. `ScopeToggle.tsx` — a NativeWind segmented control fed by `useMyHouseholds()`; selecting drives the store. `home.tsx` — read the scope store and pass `scope`/`householdId` into the records local-DB query so the home list reflects the active scope; show shared attribution on household rows.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/mobile exec vitest run src/__tests__/ScopeToggle.test.tsx
git add apps/mobile/src/store/pantryScope.ts apps/mobile/src/features/households/ScopeToggle.tsx apps/mobile/app/\(app\)/\(tabs\)/home.tsx apps/mobile/src/__tests__/ScopeToggle.test.tsx
git commit -m "feat(mobile): pantry scope toggle (personal/household) on home"
```

---

### Task G3: Household settings screen + member rows + invite share

**Files:**
- Create: `apps/mobile/app/(app)/household/index.tsx`
- Create: `apps/mobile/src/features/households/HouseholdSettings.tsx`, `MemberRow.tsx`, `InviteShareSheet.tsx`
- Create: `apps/mobile/src/__tests__/HouseholdSettings.test.tsx`

- [ ] **Step 1: Write the failing component test `HouseholdSettings.test.tsx`**

Assert the screen: lets a user **create** a household; for an owned household shows the members list with roles, a **rename** field, an **invite** button (opens `InviteShareSheet` with the deep link via the native share sheet), a **pending join-requests** list with per-request **approve** (owner only — calls `useApproveInvite`), per-member **remove** (owner only), a **leave** action (members), and a **dissolve** action (owner, with confirm). A plain member sees members + leave but not rename/invite/approve/remove/dissolve. Buttons call the corresponding hooks from Task G1.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement**

`HouseholdSettings.tsx` composes the create form (when the user has no household selected), the members list (`MemberRow`), an owner-only **pending requests** section (invites in `requested` state, each with an Approve button calling `useApproveInvite`), owner-only controls gated on `myRole === 'owner'`, and the `InviteShareSheet` (uses Expo `Share` with the `inviteUrl` from `useCreateInvite`). `index.tsx` is the route wrapper. Use `useTheme()` tokens; no `console.log`.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/mobile exec vitest run src/__tests__/HouseholdSettings.test.tsx
git add apps/mobile/app/\(app\)/household apps/mobile/src/features/households apps/mobile/src/__tests__/HouseholdSettings.test.tsx
git commit -m "feat(mobile): household settings screen (create/join/members/leave/dissolve/invite)"
```

---

### Task G4: Invite join-request via deep link + record-form household picker + attribution

**Files:**
- Modify: `apps/mobile/src/linking/deepLink.ts` (M0c handler)
- Create: `apps/mobile/app/(app)/household/invite.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/src/features/records/RecordCard.tsx`

- [ ] **Step 1: Route the invite deep link**

In the M0c deep-link handler, map `pantry://household/invite?code=<code>` to the `household/invite` route, passing `code` as a param. `invite.tsx` reads the code, calls `useRequestJoin({ code })`, and shows a **"request sent — waiting for the household owner to approve"** state on success (the user is NOT yet a member; opening the link never grants access on its own), or an error (`invite_invalid` / `invite_not_found`). The owner approves from their Household settings screen (the pending request appears in the members/requests list); once approved, the requester's next `useMyHouseholds()` refetch shows the joined household. If unauthenticated, route through the existing auth gate first, preserving the code.

- [ ] **Step 2: Household picker on the record form**

In `AddRecordForm.tsx` add an optional "Pantry" picker fed by `useMyHouseholds()`: default "Personal" (sends no `householdId` → personal record), or a household (sends `householdId`). The chosen value flows into the create/patch payload.

- [ ] **Step 3: Shared attribution on the card**

In `RecordCard.tsx`, when `record.householdId != null` and the record's `userId !== currentUser.id`, show a small "added by {firstName}" label (resolve the name from the cached household members list). Personal records show no attribution.

- [ ] **Step 4: Typecheck; commit**

```bash
pnpm --filter @pantry/mobile typecheck
git add apps/mobile/src/linking/deepLink.ts apps/mobile/app/\(app\)/household/invite.tsx apps/mobile/src/features/records/AddRecordForm.tsx apps/mobile/src/features/records/RecordCard.tsx
git commit -m "feat(mobile): invite deep-link join-request + record household picker + shared attribution"
```

---

### Task G5: Maestro E2E — invite flow

**Files:**
- Create: `apps/mobile/.maestro/household-invite-flow.yaml`

- [ ] **Step 1: Write the Maestro spec**

Flow: launch → open Household settings → create "Home" → open invite share → (capture the deep link) → as the second user, simulate opening `pantry://household/invite?code=<code>` → assert **"request sent / awaiting approval"** state (NOT yet joined) → as the owner, open Household settings → approve the pending request → as the requester, assert joined-state → return home → toggle scope to "Household" → assert a shared record is visible.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/.maestro/household-invite-flow.yaml
git commit -m "test(mobile): Maestro household invite E2E flow"
```

---

## Phase H — Admin: household management

### Task H0: Admin households API (`requireAdmin` + integration test)

> The admin endpoints are a real API surface with their own auth gate and integration test — not an untested add-on to the UI task. Both routes are `app.requireAdmin`-gated.

**Files:**
- Create: `api/src/routes/admin/households.ts`
- Modify: `api/src/server.ts` (mount under `/v1/admin/households`)
- Create: `api/tests/integration/admin-households.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/integration/admin-households.test.ts`**

Cover: (1) a non-admin user calling `GET /v1/admin/households` → `403`/`401` (the `requireAdmin` gate); (2) an admin lists households → `200` with `{ items }` (name, ownerUserId, memberCount, createdAt); (3) an admin dissolves via `DELETE /v1/admin/households/:id` → `204`, the household row is gone, **its shared records reverted to `household_id = NULL` and survive** (assert rows exist with creator `user_id`), and a `writeAuditLog` entry (`household_dissolved`) was written; (4) a non-admin dissolve → `403`. Reuse the M3 admin-auth helper in the harness.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement**

`routes/admin/households.ts` — two `app.requireAdmin`-gated routes registered under the `/v1/admin/households` prefix in `server.ts`:
- `GET /v1/admin/households` — list all households with `memberCount` + owner, mapped via `toApiHousehold`.
- `DELETE /v1/admin/households/:id` — **call the exact same dissolve service helper used by the user-facing dissolve** (Task C5: take the household-row lock, then `household.delete` so the FK `onDelete: SetNull` reverts records to creator-private). After it succeeds, `writeAuditLog({ action: 'household_dissolved', targetId: id, actorId: req.user.id })`. Reply `204`.

> Single source of truth: the admin dissolve and the user dissolve are the same transactional helper — do not reimplement the revert-to-private logic in the admin route.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/admin-households.test.ts
git add api/src/routes/admin/households.ts api/src/server.ts api/tests/integration/admin-households.test.ts
git commit -m "feat(api): admin households list + audit-logged dissolve (requireAdmin)"
```

---

### Task H1: Household list + detail pages (audit-logged dissolve)

**Files:**
- Create: `apps/admin/app/households/page.tsx`, `apps/admin/app/households/[id]/page.tsx`
- Create: `apps/admin/lib/households.ts`
- Create: `apps/admin/e2e/households.spec.ts`

- [ ] **Step 1: Write the Playwright failing test `apps/admin/e2e/households.spec.ts`**

Assert an admin can: see the households list (name, owner, member count, created date); open a detail page showing members + roles; dissolve a household (with confirm) → it disappears from the list and an audit-log entry is written. (Admin uses `app.requireAdmin`-gated API; reuse M3 admin auth in the test harness.)

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement**

`lib/households.ts` — `serverAdminApi` / `browserAdminApi` calls against the **Task H0 endpoints** (`GET /v1/admin/households`, `DELETE /v1/admin/households/:id`); no new API logic here — H0 already implements the audit-logged, lock-protected, FK-revert dissolve. `page.tsx` renders the list (server component via `serverAdminApi`); `[id]/page.tsx` renders members + a dissolve button (client action via `browserAdminApi`).

> The dissolve behavior (revert shared records to creator-private) lives in the shared service helper called by both the user dissolve (C5) and the admin endpoint (H0) — the admin UI just calls H0.

- [ ] **Step 4: Run, verify PASS; commit**

```bash
pnpm --filter @pantry/admin exec playwright test households.spec.ts
git add apps/admin/app/households apps/admin/lib/households.ts apps/admin/e2e/households.spec.ts
git commit -m "feat(admin): household management page with audit-logged dissolve"
```

---

## Phase Z — Final verification

### Task Z1: Full API suite

- [ ] **Step 1: Generate Prisma client + apply migrations to the test DB**

```bash
pnpm --filter @pantry/api exec prisma generate
DATABASE_URL="$(grep DATABASE_URL api/.env.test | cut -d= -f2-)" \
  pnpm --filter @pantry/api exec prisma migrate deploy
```

- [ ] **Step 2: Run all API tests**

```bash
pnpm --filter @pantry/api test
```
Expected (M8 additions on top of M0–M4):
- `unit/invite-code.test.ts` — 2 tests
- `unit/household-permissions.test.ts` — 2 tests
- `integration/households-crud.test.ts` — 3 tests
- `integration/households-invites.test.ts` — 2+ tests (incl. join picks up existing records' reminders)
- `integration/households-members.test.ts` — 6 tests (incl. leave cancels the leaver's shared-record reminders)
- `integration/households-dissolve.test.ts` — 1+ tests
- `integration/records-household-scope.test.ts` — scope + create (incl. member fan-out) + patch (≈ 13 assertions across cases)
- `integration/records-sync-household.test.ts` — 3 tests
- All prior M0–M4 records/sync tests remain green (personal path unchanged).

- [ ] **Step 3: Typecheck the whole repo**

```bash
pnpm typecheck
```
Expected: every workspace exits 0.

### Task Z2: Mobile + admin checks

- [ ] **Step 1: Mobile vitest + typecheck**

```bash
pnpm --filter @pantry/mobile exec vitest run
pnpm --filter @pantry/mobile typecheck
```
Expected: `sync-household.test.ts`, `ScopeToggle.test.tsx`, `HouseholdSettings.test.tsx` pass; all prior mobile tests stay green.

- [ ] **Step 2: Admin Playwright + typecheck**

```bash
pnpm --filter @pantry/admin exec playwright test
pnpm --filter @pantry/admin typecheck
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
git log --oneline -60
```

- [ ] **Step 2: Tag**

```bash
git tag m8-complete
```

---

## Self-review checklist

Run this against the spec before declaring M8 done.

- [ ] **Spec §2.2 (records, extended)** — `records.household_id` added as nullable FK; `household_id IS NULL` keeps the v1 private-to-`user_id` behavior; non-null shares the record among the household's members; `user_id` retained as creator/attribution.
- [ ] **Spec §2.11 (offline-first + conflict policy)** — Split policy implemented: personal records keep **last-write-wins**, household records are **server-authoritative (server wins)** on both API (`syncRecords`) and mobile (`sync.ts` apply); sync triggers unchanged.
- [ ] **Sync re-filtering by CURRENT visibility** — Every echoed record in `changes` is re-filtered through the caller's membership resolved at request time; a record that left a household (reverted to creator-private) is NOT echoed to a former co-member.
- [ ] **Scope-change is an explicit conflict** — A `household_id` CHANGE between client-believed and server-current scope is reported in `conflicts: [{ clientId, reason: 'scope_changed' }]` and the canonical server row echoed — never a silent overwrite of a personal-era offline edit. `notify_at` recomputed when a record moves into/out of a household.
- [ ] **Shared-record reminders fan out to ALL current members** — A household record (`household_id` set) schedules an expiry reminder for **every** current member via the reused `notification-send` pipeline (no new queue), **each using that member's own `notificationPreferences.offsetsDays`** (default `[3,1,0]`); personal records keep the single-owner schedule. Membership changes reschedule: a member **joining** picks up the household's active records' upcoming reminders (their own offsets); a member **leaving** / **dissolve** cancels/skips that user's pending household-record reminders (reverted records fall back to the creator's single-owner schedule). Multi-household membership is supported (reminders across all of a user's households). Reschedule happens inside the same locked transaction as the membership/record write.
- [ ] **Concurrency locks** — Dissolve, member-remove, and household-scoped record writes (create/patch/sync upsert) take the household-row lock (`FOR UPDATE` / advisory) so they serialize; no write can resurrect a deleted `household_id` (no FK violation).
- [ ] **Spec §2.15 (household sharing)** — Households group members; records can belong to a household (full shared pantry: any member adds/edits/consumes); roles `owner`/`member`; membership via **owner-approval join requests** (link → request → owner approve; a leaked link alone grants nothing); revoke supported; shared household records server-authoritative.
- [ ] **Spec §5 (data model)** — `households`, `household_members` (unique `householdId,userId`), `household_invites` (unique `code`, `requestedByUserId`) in Prisma + migration; `records.household_id` + both indexes (`[householdId,status,expiryDate]` and the sync-cursor `[householdId,updatedAt]`); forward additive migration verified (existing rows → `NULL`, zero data loss).
- [ ] **Spec §6.3 (records endpoints, extended)** — `GET /v1/records?scope=personal|household|all` membership-scoped (household by `householdId ∈ myHouseholdIds`, never by `userId`); `POST` accepts optional `householdId` with membership check; `PATCH` enforces the **explicit cross-household edit predicate** (writable in current scope AND member of target) incl. move/reassign; cross-household IDOR negatives covered; never leaks foreign records.
- [ ] **Households endpoints** — `POST /v1/households` (creator → owner), `GET /v1/households/mine`, `GET /:id` (members), `PATCH /:id` (owner rename), `DELETE /:id` (owner dissolve → FK `SetNull` reverts shared records to creator-private, items survive), `POST /:id/invites` (owner → code + deep link), `POST /invites/request` (join request, not membership), `POST /:id/invites/:inviteId/approve` (owner, atomic single-use), `POST /:id/invites/:inviteId/revoke` (owner), `GET /:id/members`, `DELETE /:id/members/:userId` (owner removes / member self-leaves; owner self-leave rejected). All writes idempotent.
- [ ] **Permissions** — owner-only manage (invite/approve/revoke/remove/rename/dissolve) via `assertOwner`; any member view/create/edit/consume via `assertMember`; personal records private regardless of membership; multi-household membership allowed.
- [ ] **Scale + local purge** — Sync cursor served by `[householdId, updatedAt]` index (no seq scan); device purges local WatermelonDB rows of a household on leave/dissolve so stale shared rows do not linger.
- [ ] **Spec §7 (mobile)** — household settings screen (create / join-request / pending-request approval / members / leave / dissolve / invite share), Personal/Household scope toggle on home, record-form household picker, shared attribution on cards, invite join-request via M0c deep link, WatermelonDB `household_id` + split-policy sync + scope-change conflict handling.
- [ ] **Admin** — proper `requireAdmin` API task (H0: `GET/DELETE /v1/admin/households` + integration test) reusing the shared revert-to-private dissolve helper; audit-logged; UI (H1) consumes it.

### Placeholder scan

- [ ] No "TBD", "add validation", "see task N", or "implement later" appears in the plan.
- [ ] Every TDD task has actual test code AND actual implementation guidance in `Step` blocks.
- [ ] Every commit step lists the exact files to add.

### Type / contract consistency

- [ ] Wire `householdId` (camelCase) ↔ column `household_id` (snake_case via `@map`) ↔ error codes snake_case (`household_not_member`, `record_household_forbidden`, …).
- [ ] `HouseholdRole` enum matches across Prisma (`owner|member`), `householdRoleSchema`, the API serializer, and the mobile `myRole` gate.
- [ ] `HouseholdInviteStatus` matches Prisma (`pending|requested|accepted|revoked`) and `householdInviteStatusSchema`; expiry is computed from `expiresAt > now()`, never a stored `expired` status.
- [ ] `records.household_id` is `String?` in Prisma, `householdId: string | null` in the wire `recordSchema` + WatermelonDB model, and the sync engine reads it to pick the conflict policy branch.
- [ ] Dissolve relies on the FK `onDelete: SetNull` to revert records (no imperative null-out); only partial member-remove nulls imperatively. Neither path can leave an orphaned/FK-violating row because both take the household-row lock (decisions 5 + 8).

---

## Handoff to maintenance

M8 closes the v1.x social/growth line. After this milestone:

- The records ownership model is dual-mode: personal (`household_id NULL`, LWW) and household-shared (`household_id` set, server-wins). Any future feature touching records must respect this split conflict policy and the membership-scoped read filter (`householdId ∈ myHouseholdIds`).
- **Sync invariants (load-bearing):** the delta `changes` array is ALWAYS re-filtered through the caller's CURRENT membership (resolved at request time) — never echo a record the caller can no longer see. A `household_id` change is surfaced as an explicit `conflicts: [{ clientId, reason: 'scope_changed' }]` entry, never a silent overwrite; the client adopts the echoed canonical row and surfaces the dropped local edit. `notify_at` is recomputed when a record changes scope.
- **Concurrency invariant:** dissolve, member-remove, and any household-scoped record write serialize on the `households` row lock (`FOR UPDATE` / advisory lock). Future household-mutating paths must take the same lock to preserve FK integrity.
- **Shared-record reminders fan out per-member:** a household record's expiry reminder is scheduled for **every current member** (reusing the M1 `notification-send` queue — no new queue), each on **their own `notificationPreferences.offsetsDays`** (default `[3,1,0]`), never a single shared schedule; personal records keep the single-owner schedule. Reminders are (re)scheduled inside the same locked transaction as the triggering write: record create/scope-change/expiry-change fans out to all current members; a member **joining** is scheduled into the household's active records' reminders (their own offsets); a member **leaving** or a **dissolve** cancels that user's pending household-record reminders (reverted records fall back to the creator's single-owner schedule). Multi-household membership is supported — a user in N households receives shared reminders across all of them. Any future code that adds/removes members or moves records across scope MUST keep this fan-out/teardown consistent.
- **Invites are owner-approval:** a link issues a *join request* (`status: requested`, `requestedByUserId`); the owner *approves* atomically (single-use conditional update) to create membership. A leaked link never grants access. There is no "code → instant member" path.
- **Local cleanup:** the device calls `purgeHouseholdRecords(...)` on leave/dissolve to evict now-inaccessible shared rows from WatermelonDB.
- Reusable contracts: `assertMember` / `assertOwner` and the explicit cross-household write predicate (`api/src/services/households/permissions.ts`) gate any future household-scoped surface; `generateInviteCode` is the canonical opaque-code generator; the FK-`SetNull` revert-to-creator-private dissolve helper is the single source of truth (user dissolve C5 + admin dissolve H0 both call it).
- Out-of-scope items deferred intentionally (not bugs): owner transfer, per-record granular ACLs, roles beyond owner/member, household chat, merging households, household-scoped deals/giveaways. Each would be a new milestone, not a patch here.
- All prior surfaces (M1 records CRUD/scan/OCR/notifications, M2 reviews, M5 deals, M6 blessings, M7 referrals) remain green — household sharing is additive to records only.
