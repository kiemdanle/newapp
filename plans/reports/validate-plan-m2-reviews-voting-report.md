# M2 Reviews + Voting — Plan Validation Report

Plan: `docs/superpowers/plans/2026-05-24-m2-reviews-and-voting.md`
Spec: `docs/superpowers/specs/2026-05-23-pantry-app-design.md` (§2.6–2.8, 4.3, 5, 6.4, 6.5, 7)
Mode: greenfield (no source) — validated internal consistency + spec fidelity + CONSUMES/PROVIDES contracts.

Status: DONE_WITH_CONCERNS — spec coverage solid, but 4 CONSUMES contract breaks vs M1/M0a will fail compile/tests as written.

---

## 1. CONSUMES list (verbatim from M2) vs actual M1/M0a PROVIDES

### M1 claims (M2 plan line 18, verbatim):
> "M1 complete: `products` table + product routes + Idempotency-Key Fastify plugin (`api/src/plugins/idempotency.ts`), BullMQ wiring (queues live under `api/src/queues/` per D10 — `getQueueConnection` is exported from `api/src/queues/index.ts`, alongside a `getAllQueues()` registry; central worker registration lives in `api/src/queues/workers.ts`), WatermelonDB schema and offline write queue."

Cross-check vs M1 actual:
- `api/src/plugins/idempotency.ts` — **MATCH** (M1 Task E1, line 2247). Plugin uses `config.idempotent: boolean|'required'` + lowercase `idempotency-key` header. M2's vote route opt-in `config: { idempotent: 'required' }` is correct.
- `api/src/queues/index.ts` exports `getQueueConnection` + `getAllQueues()` — **MATCH** (M1 Task F1, lines 2444–2454).
- **BUG — `getQueueConnection()` shape mismatch.** M1 (line 2444): `getQueueConnection(): { connection: ConnectionOptions }` — returns a WRAPPER `{ connection }`. M2 every worker/queue does `new Queue(NAME, { connection: getQueueConnection() })` (e.g. lines 1183, 1234, 1342, 1389, 1435, 1479) and the score-recalc-worker test line 2946. That double-wraps to `{ connection: { connection: ... } }`. Must be `connection: getQueueConnection().connection` OR change M1's helper to return `ConnectionOptions`. As written → BullMQ connection failure.
- **BUG — central worker registration path.** M2 claims `api/src/queues/workers.ts` (line 18, Task E5 line 1505). M1 actually ships the runner at **`api/src/workers/runner.ts`** (M1 line 4422–4444) with `startWorkers()`/`stopWorkers()` already defined. M2 Task E5 would create a SECOND, conflicting registry at the wrong path; M1's three workers would not be merged. Path + file are wrong.
- `getAllQueues()` registry append (Task E0) — registry exists, append is sound IF connection shape fixed.
- `products` table + product routes + `products/search` + `GET /products/:id` topReviews stub — **MATCH** (M1 lines 226–229, 1796–1804, 1852 `topReviews: [] // populated in M2`). M2 Task F8 (D20) correctly fills the stub.
- WatermelonDB schema + offline write queue — **MATCH** (M1 Phase J). M2 correctly states only user's own review writes go through it; reads server-sourced.

### M0a claims (M2 line 15, verbatim):
> "M0a complete: shared package, error/AppError, config, db/redis singletons, error-handler, auth plugin (`req.user`, `app.requireAuth`), users repository (`toApiUser`), random/hashToken utils, test harness (`tests/helpers/setup.ts`, `tests/helpers/factories.ts`)."

Cross-check vs M0a actual:
- `app.requireAuth`, `req.user` — **MATCH** (M0a line 3173, 3193).
- `toApiUser` — **MATCH** (M0a line 3112). Projects `avatarUrl`, `emailVerified`.
- `tests/helpers/setup.ts` + `factories.ts` (`makeUser`, `getPrisma`) — **MATCH** (M0a lines 1960, 2038).
- `User.status` enum `active` (used by seed + setup re-seed) — **MATCH** (M0a line ~1733 `status UserStatus @default(active)`).
- `issueAccessToken` — **CONTRACT MISMATCH (test bug).** M0a (line 2587, 2679): `issueAccessToken({sub,role})` returns **`{ token, expiresIn }`** (object). Every M2 integration test does `Bearer ${await issueAccessToken(...)}` treating the return as a string (lines 1767, 2005, 2188, 2301, 2358, 2381, 2502, 2687, etc.). Header becomes `Bearer [object Object]` → all authed tests 401. Must be `(await issueAccessToken(...)).token`.

### Other CONSUMES not in the verbatim block but imported by M2:
- **BUG — `getSetting` / `SETTING_KEYS` / `api/src/services/settings/service.js`.** M2 reports repository (line 1034–1035) `import { getSetting, SETTING_KEYS } from '../settings/service.js'`. **Neither M0a nor M1 ships this** — it is an M3 module. M2's runtime `try/catch` fallback (line 1042) handles a throwing call, but the **static import of a non-existent module is a TypeScript/ESM compile failure**, not a caught runtime error. Either inline the default `{ autoHideReportThreshold: 3 }` with no import, or guard via dynamic `import()`.
- `buildServer` (M2 tests) — **MATCH** (M0a line 1337 `export async function buildServer()`).
- `AppError`, `ERROR_CODES` — MATCH; M2 adds `REVIEW_ALREADY_EXISTS`, `REPORT_TARGET_NOT_FOUND`; uses existing `NOT_FOUND`, `FORBIDDEN`, `VALIDATION`.

---

## 2. PROVIDES manifest (for M3)

- Tables: `reviews`, `review_votes`, `reports` (Prisma `Review`/`ReviewVote`/`Report`, snake_case `@@map`).
- Enums: `ReviewStatus` = `visible|hidden|deleted` (no `pending`, per D15); `ReportTargetType` = `review|user|product`; `ReportReason` = `spam|abuse|incorrect|other`; `ReportStatus` = `open|resolved|dismissed`.
- Reports rows with `status='open'`, `resolvedByAdminId`/`resolvedAt` nullable columns — M3 moderation queue resolves these (sets resolved/dismissed).
- Auto-flag system Report rows authored by `SYSTEM_USER_ID = 00000000-0000-0000-0000-000000000001` (seeded `api/prisma/seed.ts`, re-seeded per test). M3 dedicated lane consumes these.
- Auto-hidden content: reviews → `status='hidden'`; products → `status='pending'`. M3 re-publishes/un-pends.
- Queues: `score-recalc` (debounced), `moderation-flag`, `product-rating-recalc` — appended to `getAllQueues()` for M3 admin queue-health dashboard.
- Services: `wilsonLowerBound(up,down,z=1.96)`, `containsProfanity()`, `toApiReview`, `toApiReport`, `maybeAutoHide`, `SYSTEM_USER_ID`.
- Shared Zod: review/report schemas + types; `productWithReviewsSchema.topReviews` now populated.
- Mobile: `newIdempotencyKey()` (`apps/mobile/src/lib/idempotency.ts`, D19 — M2 owns it, M0c does not ship).

---

## 3. Spec coverage / gaps

| Spec | Covered? | Where |
|---|---|---|
| §2.6 one review per (user,product), editable, soft-delete | YES | `@@unique([userId,productId])`, PATCH/DELETE own-only, status=deleted |
| §2.6 sort Wilson default + newest + highest | YES | `reviewSortSchema` score/new/rating; list orderBy |
| §2.7 up/downvote, one per (user,review), changeable/removable | YES | upsert + DELETE, `@@unique([userId,reviewId])` |
| §2.7 denormalized counts + score recalc debounced | YES | denorm cols + `enqueueScoreRecalc` 30s Redis NX |
| §2.8 profanity auto-flag on new review | YES | create + update run `containsProfanity`, enqueue moderation-flag |
| §2.8 report review/user/product | YES | `reportTargetTypeSchema`, `targetExists` covers all 3 |
| §2.8 reports >3 auto-hide | YES (PARTIAL) | `maybeAutoHide` count `> threshold` (strict `>`, default 3 → 4th report hides). Matches spec ">3". |
| §4.3 score-recalc + moderation-flag jobs | YES | E1/E4 |
| §5 tables + indexes | YES | A1/A2 |
| §6.4 / §6.5 endpoints | YES | F1–F12, G1–G2 |
| §7 mobile surface | YES | I/J/K/L |

Gaps / notes:
- **Auto-hide threshold IS implemented** (Task D3 `maybeAutoHide`, Task G2 wires it, test G1 "auto-hides after >3 reports"). Uses `count > threshold` with default 3 (4th triggers) — correct reading of spec ">3".
- **System user IS seeded** (Task A3 seed.ts + A4 per-test re-seed + D1 constant). Good.
- §2.8 dismissed reports excluded from auto-hide count (`status in ['open','resolved']`) — reasonable, not spec-mandated, documented.
- **moderation-flag worker integration test (H2) asserts `status === 'pending'`** (line 2999) — but D15 abolished `pending`; worker sets `hidden`. **Test is internally contradictory and will fail** against the worker it tests (worker line 1462 sets `'hidden'`). Also commit msg line 1497 says "sets pending". Bug.
- §2.8 auto-flag worker behavior vs spec §4.3: spec §4.3 says moderation-flag "marks review pending"; M2 deliberately overrides to `hidden` per D15. Defensible design decision but diverges from literal spec wording — acceptable since D15 documents it.
- Reports route does NOT require Idempotency-Key (spec §6.8 only mandates it for POST records + vote). Mobile `useCreateReport` sends one anyway (harmless). OK.

---

## 4. Internal consistency (M2-internal)

- Symbol references flow correctly: wilson → score-recalc; profanity → create/update/moderation-flag; system-user → moderation-flag; reports repo `maybeAutoHide` → reports route + moderation-flag; queues → workers + routes; shared schemas → routes + mobile hooks.
- Prisma names + status enums consistent with spec §5. `Decimal(7,6)` for score (0..1) → `Number()` coercion → Zod `number().min(0).max(1)`. Consistent.
- Wilson math: standard Wilson lower bound, z=1.96 (95% one-sided), returns 0 for n=0, clamps [0,1]. Formula correct. Test "5/5 ≈ 0.2366" matches.
- Debounce: `SET key 1 EX 30 NX` + delayed job `delay=30s` + deterministic `jobId` — coherent; the 3 unit-test assertions hold.
- **Task numbering bug:** there are TWO "Task F8" — F8 DELETE route (line 2225) and F8 "Populate topReviews (D20)" (line 2606). Duplicate ID; harmless but sloppy.
- reports-create test (G1) references `getSetting`/`vi.mocked(getSetting)` (line 2729) with no import and an incomplete test body ("// seed 4 reports..." stub) — that test case is a placeholder, contradicts the plan's own "no placeholder" self-review claim (line 4697).
- Browse screen (K1) `useDebounced` hook uses `require('react')` inline + a dead `typeof window` branch — ugly and lint-hostile but functional.

---

## 5. Top risks / decision points (brutal)

1. **`getQueueConnection()` double-wrap (CONSUMES bug).** M1 returns `{connection}`; M2 passes it as `connection:`. Every queue/worker + 2 worker tests break at runtime. Highest-impact, touches ~8 sites. FIX before Phase E.
2. **`issueAccessToken` returns object, used as string in ~10 integration tests.** All authenticated API tests yield `Bearer [object Object]` → 401, masking real route behavior. FIX: `.token`.
3. **`getSetting`/`SETTING_KEYS` static import from non-existent M3 module.** Compile failure in `reports/repository.ts` despite the runtime try/catch. The catch only saves a throwing call, not a missing module. FIX: inline default or dynamic import.
4. **Wrong worker-registry path (`queues/workers.ts` vs M1's `workers/runner.ts`).** Task E5 creates a duplicate parallel registry; M1 workers won't be merged, and boot wiring already lives in runner.ts. Reconcile to M1's actual file.
5. **moderation-flag H2 test asserts `'pending'`** (abolished by own D15) → guaranteed test failure; the reports-create §settings test is a non-runnable stub. Both contradict the plan's "no placeholders / type consistency" self-review.

Secondary watch items (lower severity):
- `obscenity` false positives (e.g. clean reviews auto-hidden); test covers Scunthorpe/"assistant" but real-world FP rate unmeasured — auto-`hidden` (not soft `pending`) is user-visible punishment for a probabilistic match. Consider softer treatment.
- Auto-hide race: concurrent 4th+5th reports both pass `count>3` and both `update` review to hidden — idempotent (no-op second time), low risk. OK.
- Debounce edge: vote arriving exactly as the 30s job fires + key expiry vs job execution ordering — at-most-30s staleness, acceptable per spec.
- Review write path: spec §2.11 says "my reviews" go through offline write queue (LWW); M2 mobile does direct TanStack mutations (server source of truth) and only mentions the M1 queue in conventions but does NOT actually route review writes through WatermelonDB. Divergence from §2.11 for reviews — plan acknowledges "read-mostly" but the create/update/delete hooks are online-only. Flag for product decision.

---

## Unresolved questions
- Should review writes truly bypass the offline queue (contradicts §2.11 "my reviews" LWW)? Plan implies online-only.
- Should profanity match → hard `hidden` or a softer state given FP risk? D15 chose hidden.
