# Red-Team Scope/Complexity Review — M5–M8 Plans

Reviewer lens: YAGNI enforcer / scope-complexity critic. Target: implementation
complexity only (NOT user-approved features). Scale context: single VPS, 10k users,
v1.x add-on. Evidence = plan file:line. Hostile by design.

---

## Finding 1: Debounced BullMQ workers for score/reputation recalc are gold-plating at 10k users

**Severity:** High

**Location:**
- M5 `2026-05-26-m5-deal-sharing.md:624-723` (`deal-score-recalc` queue + worker + Redis NX sentinel + 30s delayed job + debounce unit test C2 + worker e2e test E1 lines 1826-1906)
- M6 `2026-05-26-m6-blessing-giveaway.md:833-989` (`reputation-recalc` queue + worker + debounce + E0/E1/E2/E3 + worker e2e G1)

**Over-engineering:** Each milestone stands up a full async pipeline — a dedicated BullMQ queue, a `getXQueue()` singleton, a Redis `SET …NX EX 30` sentinel, a 30s *delayed* job, registration in `getAllQueues()` + `runner.ts`, a debounce unit test, and a worker integration test — purely to recompute a Wilson lower bound (2 integer counts) or two `AVG(stars)` aggregates. At 10k users a deal vote or a transaction rating is a sub-millisecond aggregate over a tiny, indexed child table. The debounce exists to "collapse bursts," but a single deal getting >1 vote inside any 30s window is rare at this scale, and even a hot deal recomputing synchronously on each vote is a trivial `GROUP BY` on `deal_votes(dealId)`. The worker adds a moving part (queue liveness, delayed-job visibility, removeOnComplete tuning, two extra test files per milestone) for a computation that fits inline in the vote/rating handler.

**Simpler alternative:** Recompute synchronously inside the vote/rating route after the upsert — same `groupBy` the processor already runs (M5:686-701, M6:916-937), write counts+score on the same row, done. No queue, no Redis key, no delayed job, no `runner.ts`/`getAllQueues()` edits, no debounce/worker tests. If a future hot-path profile ever shows contention, *then* introduce the debounce — it is a clean additive change (the recompute fn is already pure). Net deletion per milestone: 1 job module, 1 queue registration, 1 worker registration, 2 test files.

**Evidence:** M5:626 ("debounced enqueue … mirroring M2's `score-recalc`") and M6:857 explicitly state the only rationale is "mirror M2." Mirroring an existing pattern is not a load-bearing requirement; the spec asks for a helpfulness score, not for async recompute. The recompute body (M5:683-702) is ~15 lines and already self-contained.

**Suggested fix:** Drop the worker from M5 and M6. Call the pure recompute inline post-write. Keep `wilsonLowerBound` reuse. If the planner wants to preserve async for parity with M2, document it as an *explicit deferred optimization* rather than shipping it in v1.x.

---

## Finding 2: M6 `GiveawayClaimStatus` over-models the claim lifecycle with unused states

**Severity:** Medium

**Location:** `2026-05-26-m6-blessing-giveaway.md:146-153` (`GiveawayClaimStatus { requested, selected, rejected, withdrawn }`), schema `2026-05-26-m6-blessing-giveaway.md:205-219`, Zod `2026-05-26-m6-blessing-giveaway.md:430`.

**Over-engineering:** Four claim states, but the approved flow is "list → claim → pick → mutual rating, no chat." `withdrawn` is never produced by any route in the plan — there is no `DELETE /claims/:id` or withdraw endpoint in the file map (`2026-05-26-m6-blessing-giveaway.md:70-81`) or in the Phase F tasks (F4 only does POST+GET claims, F5 does select/complete). It is a speculative state for a feature (claimer rescinds) the user did not ask for. `rejected` is real (set on non-selected claims), `selected` is real, `requested` is the default. So the enum carries a dead value that must be handled in every exhaustive switch, serializer, and test forever.

**Simpler alternative:** Ship `requested | selected | rejected` only. Add `withdrawn` in the milestone that actually builds claim withdrawal (adding an enum value is a trivial additive migration, exactly the pattern the plans already use for `ReportTargetType`).

**Evidence:** No route, test case, or handler in M6 ever writes `withdrawn` (grep the Phase F task descriptions, `2026-05-26-m6-blessing-giveaway.md:1058-1117`). Self-review checklist (`:1304-1316`) does not mention it either.

**Suggested fix:** Remove `withdrawn` from the Prisma enum and `claimStatusSchema` until a withdraw flow exists.

---

## Finding 3: M6 stores `selectedClaimId` on the giveaway AND a `selected` status on the claim — redundant denormalization needing cross-row invariant maintenance

**Severity:** Medium

**Location:** `2026-05-26-m6-blessing-giveaway.md:189` (`Giveaway.selectedClaimId`), plus `GiveawayClaim.status='selected'` (`:210`). Rating role inference (`2026-05-26-m6-blessing-giveaway.md:743-751`) resolves the recipient by joining the selected claim.

**Over-engineering:** The "who was selected" fact is stored twice: once as `giveaways.selected_claim_id` and once as the claim row whose `status='selected'`. The select transaction (F5, `:1086-1090`) must keep both in sync atomically, and the ratings route (F6, `:1111`) "loads giveaway + its selected claim to resolve selectedRecipientId" — meaning it already derives the recipient from the claim, so `selectedClaimId` is a redundant pointer that adds an invariant (exactly one claim per giveaway has `status='selected'` AND it equals `selectedClaimId`) the code must never violate.

**Simpler alternative:** Keep ONE source of truth. Either (a) drop `selectedClaimId` and derive the selected claim via `where: { giveawayId, status: 'selected' }`, or (b) keep `selectedClaimId` and don't bother with a distinct claim `status='selected'` (non-picked → `rejected`, picked → identified by the FK). Option (a) is cleaner because the claim status enum is already the natural carrier. Removes a column, removes a sync obligation in the select transaction.

**Evidence:** `2026-05-26-m6-blessing-giveaway.md:1111` ("load giveaway + its selected claim") shows the recipient is already resolved through the claim, making the giveaway-level pointer redundant for the only consumer that needs it.

**Suggested fix:** Drop `selectedClaimId` from the `Giveaway` model; resolve the recipient from the `status='selected'` claim. If a giveaway-level pointer is preferred for query convenience, drop the `selected` claim status instead — but not both.

---

## Finding 4: M7 ships three unused `PointsReason` enum values and a `points_signup`-style forward scaffold the milestone never writes

**Severity:** Medium

**Location:** `2026-05-26-m7-referral-and-app-sharing.md:125-131` (`PointsReason { referral_signup, referral_converted, badge_bonus }`), confirmed unused at `:2242` ("M7 only writes `referral_converted`; the other two reasons exist for forward use").

**Over-engineering:** The enum carries `referral_signup` and `badge_bonus`, neither of which any M7 code path writes (the conversion service writes only `referral_converted`, `2026-05-26-m7-referral-and-app-sharing.md:999`). This is textbook premature scaffolding "for forward use." Enum values are cheap to *add* later (additive migration — the plan demonstrates this repeatedly) but not free now: they appear in the Zod `pointsReasonSchema` (`:447`), must be handled in any reason-rendering UI, and invite the next dev to wire them speculatively.

**Simpler alternative:** Ship `PointsReason { referral_converted }` only. Add `referral_signup` / `badge_bonus` in the milestone that grants those points. The plan's own handoff (`:2270-2272`) already frames these as future additive work — so don't pre-bake the enum.

**Evidence:** `2026-05-26-m7-referral-and-app-sharing.md:2242` explicitly admits "M7 only writes `referral_converted`; the other two reasons exist for forward use."

**Suggested fix:** Reduce `PointsReason` to the one value M7 writes.

---

## Finding 5: M7 has both a denormalized `users.points_balance` AND an append-only `points_ledger` for a non-spendable, cosmetic v1.x score

**Severity:** Medium

**Location:** `2026-05-26-m7-referral-and-app-sharing.md:155-167` (`PointsLedger` table), `:202-203` (`users.points_balance`), conversion writes both in one tx (`:995-1006`), out-of-scope confirms points are non-spendable (`:25`, `:2259`).

**Over-engineering:** A full append-only ledger plus a denormalized running-sum column is double-entry-grade bookkeeping for a number that, per the plan's own scope, is "reputation/cosmetic only in v1.x" with "no spending / marketplace / redemption" (`2026-05-26-m7-referral-and-app-sharing.md:25`). The ledger's value is auditability of debits/credits — but there are no debits in v1.x (every entry is `+50` from one reason). So the ledger is, today, just a log of conversions, which the `referrals` table (status=`converted`, `convertedAt`) already records. The `GET /v1/me/points` paginated ledger endpoint (`:1329-1361`) + its schema + tests (`:1420-1463`) exist to page through rows that are 1:1 with converted referrals.

**Simpler alternative:** For v1.x, derive `convertedCount` from `referrals` and compute points as `convertedCount * POINTS_PER_CONVERSION` (or keep just the denormalized `points_balance` column). Skip the `points_ledger` table, the `/v1/me/points` endpoint, the `pointsPage`/`pointsEntry` schemas, and `my-points.test.ts` until points become spendable (the moment a ledger earns its keep). This is a real cut of one table + one endpoint + one schema group + one test file.

**Caveat (do not over-apply):** The user approved "in-app points + badges." This finding does NOT cut points or badges — it questions the *ledger mechanism* behind a number that is currently 1:1 with referral conversions. If the planner judges the ledger a deliberate forward-compat investment, that is a legitimate call — but it should be a *stated* one, not the default, given v1.x has zero debit paths.

**Evidence:** `:25` (no spending in v1.x), `:1534` (every conversion writes exactly one ledger row identical to the referral), `:2270-2271` (spending is explicitly a future milestone).

**Suggested fix:** Either cut `points_ledger` + `/v1/me/points` for v1.x (compute balance from `referrals`), or explicitly document the ledger as accepted forward-compat scaffolding with the trade-off noted.

---

## Finding 6: M8 dissolve/member-remove re-implement record-ownership mutation that duplicates `onDelete: SetNull` already declared on the FK

**Severity:** Medium

**Location:** `2026-05-26-m8-household-sharing.md:410` (`household Household? @relation(... onDelete: SetNull)`) vs the explicit `updateMany({ data: { householdId: null }})` in dissolve (`:1049`) and member-remove (`:1047`).

**Over-engineering:** The `Record.household` relation is declared `onDelete: SetNull` (`:410`), and the plan itself calls this "a safety net only" (`:416`). Yet dissolve manually `updateMany`s `household_id → NULL` before deleting (`:1049`), so the same null-out happens twice conceptually. More importantly, member-remove (`:1047`) nulls `household_id` for the *leaving member's* rows — but at 10k users with multi-household membership allowed (decision 2, `:37`), this is a per-member filtered UPDATE on the shared `records` table on every leave, which is fine, but the plan layers it on top of an FK rule that already covers the dissolve case. Two mechanisms (declarative FK + imperative updateMany) express overlapping intent, and the dissolve case relies on the imperative one while keeping the declarative one "as a net" — meaning a future reader must reason about both.

**Simpler alternative:** Pick one mechanism per case. For *dissolve*: since `onDelete: SetNull` already reverts every record to private when the household row is deleted, the explicit pre-null `updateMany` in dissolve (`:1049`) is redundant — deleting the household triggers SetNull for all its records in one cascade. Keep the explicit `updateMany` ONLY for member-remove (where you null a *subset* — one member's rows — without deleting the household, which the FK can't express). This removes one transaction step from dissolve and collapses the "two mechanisms" confusion.

**Evidence:** `:410` declares `onDelete: SetNull`; `:416` calls it redundant-but-kept; `:1049` does the same null-out imperatively. The member-remove case (`:1047`) is the only one the FK genuinely cannot express.

**Suggested fix:** In dissolve, rely on `onDelete: SetNull` (delete the household; records auto-revert). Keep the imperative null-out only for the partial member-remove case. Verify the test (`:1031-1035`) still passes — it asserts row survival + `householdId NULL`, which SetNull satisfies.

---

## Finding 7: M8 `HouseholdInviteStatus` carries an `expired` state that requires lazy state-flipping instead of a computed check

**Severity:** Medium

**Location:** `2026-05-26-m8-household-sharing.md:174-180` / `:382-389` (`expired` value), accept logic "lazily flip an expired-but-pending row to `expired`" (`:981`).

**Over-engineering:** `expired` is a persisted status that nothing sets at write time — it must be *lazily reconciled* on read (`:981` "lazily flip an expired-but-pending row to `expired`"). Expiry is fully determined by `expiresAt > now()`, a computed predicate. Persisting it as a fourth enum value means: (a) every accept must check-and-maybe-write the status (a write on a read path), (b) the status can be stale (a pending row past `expiresAt` reads as `pending` until someone touches it), and (c) admin/UI must treat `pending`-but-past-expiry the same as `expired`. That's three places to get the invariant right for zero benefit over `status IN (pending,accepted,revoked) AND expiresAt > now()`.

**Simpler alternative:** Drop `expired` from the enum. Invite validity = `status === 'pending' && expiresAt > now()`. The accept route already loads the invite and checks `expiresAt` (`:981`) — just return `invite_invalid` when expired without writing a status. No lazy flip, no stale-status window, no write-on-read.

**Evidence:** `:981` describes the lazy-flip workaround that exists solely because the state is persisted rather than computed. `householdInviteStatusSchema` (`:174-180`) and the Prisma enum (`:382-389`) both carry it.

**Suggested fix:** Remove `expired` from `HouseholdInviteStatus`; compute expiry from `expiresAt`. Keep `pending|accepted|revoked`.

---

## Finding 8: Phase/test bloat — M5 splits 7 trivial CRUD endpoints into 7 failing-test tasks + 10 API test files for a feature that reuses M2 wholesale

**Severity:** Low

**Location:** M5 file map `2026-05-26-m5-deal-sharing.md:61-71` (10 API test files), Phase D tasks D1-D10 (`:842-1822`) — one failing-test task per endpoint; M5:2696-2706 enumerates 34 API test assertions across 10 files.

**Over-engineering:** Deal CRUD is standard owner-scoped REST that the plan itself says "replicates the M2 voting/reporting pattern" (`:5`). Splitting feed/create/get/update/delete/vote/report-autohide/worker each into its own task + its own integration file is fine-grained to the point of overhead: `deals-get.test.ts` (3 tests), `deals-update.test.ts` (3), `deals-delete.test.ts` (2) each spin up `buildServer()` per test and re-derive auth helpers. At 10k users / single VPS this is a thin CRUD surface; the granularity inflates the plan and the CI matrix without proportional risk reduction (the logic is a near-copy of M2).

**Simpler alternative:** Consolidate deal CRUD into ~3 test files (`deals-feed`, `deals-crud` covering create/get/update/delete, `deals-vote`) and keep the report-autohide + worker tests separate (those carry real cross-cutting logic). The owner-permission assertions (403 on others' deal) are repeated across update and delete — share a helper. Same coverage, fewer `buildServer()` boots, less plan surface.

**Evidence:** M5:2696-2706 lists 10 API test files for what is, per `:5`, a replication of M2. M6 (`:84-96`) and M7 (`:61-70`) follow the same one-file-per-endpoint pattern.

**Suggested fix:** Merge thin CRUD test files; reserve dedicated files for logic-bearing paths (vote upsert/switch, auto-hide threshold, sync conflict policy). Not blocking — this is plan hygiene, not a correctness risk.

---

## Summary of recommended cuts

| # | Cut | Saves |
|---|-----|-------|
| 1 | Drop M5 + M6 recalc workers; recompute inline | 2 job modules, 2 queue regs, 4 test files |
| 2 | Drop `GiveawayClaimStatus.withdrawn` | dead enum value + switch arms |
| 3 | Drop `Giveaway.selectedClaimId` OR claim `selected` status | 1 column + a cross-row invariant |
| 4 | Reduce `PointsReason` to `referral_converted` | 2 speculative enum values |
| 5 | Cut M7 `points_ledger` + `/v1/me/points` for v1.x (or document as forward-compat) | 1 table, 1 endpoint, 1 schema group, 1 test file |
| 6 | Dissolve relies on `onDelete: SetNull`; imperative null-out only for member-remove | 1 tx step + dual-mechanism confusion |
| 7 | Drop `HouseholdInviteStatus.expired`; compute from `expiresAt` | write-on-read + stale-status window |
| 8 | Merge thin CRUD test files | plan + CI surface |

## DRY-vs-v1 contract reuse (verified positive — no findings)

The plans correctly reuse v1 contracts and do NOT re-implement them:
- M5 reuses M2 `wilsonLowerBound` (`:641`, `:2785`) — not re-derived.
- M5/M6 extend M2 `maybeAutoHide` with a branch + enum value (`:586-606`, M6:1170) — not a generalized rewrite (separate tables were the user's intentional choice; logic is reused).
- M6/M8 reuse M1 `notification-send` queue with new template keys (`:792`, M8:53) — no new push queue.
- M7 extends `registerSchema` additively (`:536-550`) — no auth-flow fork.
- M8 reuses M1 idempotency plugin + sync engine, extending rather than replacing (`:151`, `:1248`).

These are the right calls; the findings above target net-new over-modeling, not reuse.

## Unresolved questions

1. Finding 5 (points ledger): is the ledger a *deliberate* forward-compat investment the user signed off on, or a default reach for "proper" bookkeeping? If the former, keep + document; if the latter, cut for v1.x. Needs planner/user judgment — do not silently cut (review-audit rule 3: ledger touches an approved feature's mechanism).
2. Finding 1 (workers): M2 already shipped a debounced `score-recalc` worker. Is cross-milestone *pattern consistency* a stated requirement? If yes, the workers are justified parity; if "mirror M2" is just convenience, cut them. Confirm before removing.
