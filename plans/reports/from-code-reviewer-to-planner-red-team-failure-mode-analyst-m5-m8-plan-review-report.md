# Red-Team Failure-Mode Review — M5–M8 Plans

Reviewer lens: FAILURE MODE ANALYST (Murphy's Law). Greenfield plans; evidence = plan file:line. No praise. Concrete event sequences only.

Files reviewed (all in full):
- `plans/2026-05-26-m5-deal-sharing.md`
- `plans/2026-05-26-m6-blessing-giveaway.md`
- `plans/2026-05-26-m7-referral-and-app-sharing.md`
- `plans/2026-05-26-m8-household-sharing.md`

---

## Finding 1: Debounced recalc drops the LAST vote → permanently stale score/counts

**Severity:** High

**Location:** `2026-05-26-m5-deal-sharing.md:665-681` (`enqueueDealScoreRecalc`); identical pattern `2026-05-26-m6-blessing-giveaway.md:885-908` (`enqueueReputationRecalc`).

**Flaw:** The debounce sets a Redis NX key with `EX 30` AND schedules the recalc job with `delay: 30s`. The key TTL and the job delay are the **same 30s**. The recalc reads vote/rating state at **fire time (T+30s)**, but the comment at `:662-664` claims "The TTL key expires before the worker runs, so the next vote after the job fires queues again." There is a race window where a vote lands in the gap between key-expiry and job-execution, and that vote is silently swallowed.

**Failure scenario (event sequence):**
1. T=0: User A upvotes deal D. NX key set (expires T=30). Job scheduled to run at T=30. (`:668`, `:674`)
2. T=29.9: User B upvotes deal D. NX key still present → returns `'debounced'`, no new job scheduled. (`:669`)
3. T=30.0: NX key expires.
4. T=30.0: The single job fires, aggregates `deal_votes` (`:686-696`). Depending on commit visibility/scheduler skew, if B's vote transaction has not yet been committed/visible at the exact aggregation instant, B's vote is excluded from the snapshot.
5. No further votes arrive. No new job is ever queued because nothing re-triggers `enqueueDealScoreRecalc`.
6. Result: `score`, `upvoteCount`, `downvoteCount` permanently understate by one vote until the *next unrelated vote* on D — which may be never for a low-traffic deal.

**Evidence:** Aggregation reads live state at job execution (`:686`), but the only re-trigger is a subsequent `enqueue` call (`:665`). There is no "dirty since last recalc" check — the worker does not re-enqueue itself if votes changed during the delay window. The debounce is **lossy by design** at the tail.

**Suggested fix:** Worker re-arms if work may have been missed: at end of `processDealScoreRecalc`, compare a monotonic "last vote at" marker (or a per-deal version counter incremented on every vote) captured at enqueue time vs. now; if changed, re-enqueue a follow-up recalc. Alternatively, decouple TTL from delay (TTL < delay) so a tail vote always re-arms, and have the worker DELETE the sentinel key as its first action so the window is closed by the worker, not by TTL expiry. Add an explicit test: vote → wait → vote just before fire → assert final counts equal 2.

---

## Finding 2: M5 + M6 both edit `runner.ts` and `queues/index.ts` — merge collision / silent worker non-registration

**Severity:** High

**Location:** M5 `2026-05-26-m5-deal-sharing.md:790-836` (Task C3 modifies `api/src/queues/index.ts` + `api/src/workers/runner.ts`); M6 `2026-05-26-m6-blessing-giveaway.md:836-848` (Task E0 modifies `api/src/queues/index.ts`) + `:976-989` (Task E3 modifies `api/src/workers/runner.ts`). M7 also touches neither queue but M8 (`:7`) says "no new queues."

**Flaw:** Both milestones append to the **same two files** with "MERGE into the existing array — do not remove/reorder" instructions (`:816`, `:981`). If M5 and M6 are implemented on parallel branches (the plans are independent verticals), the merge of `getAllQueues()` and `startWorkers()` is a textual append conflict. The danger is not the git conflict itself but the **silent resolution**: a careless conflict resolution that keeps one side's array literal drops the other worker. A dropped worker registration produces NO error — the queue exists, jobs enqueue and accumulate as `delayed`/`waiting` forever, scores/reputation never recompute, and every integration test that triggers a recalc via the in-process worker still passes if it starts its own worker instance.

**Failure scenario:**
1. M5 branch adds `startDealScoreRecalcWorker()` to `startWorkers()` array.
2. M6 branch adds `startReputationRecalcWorker()` to the same array line region.
3. Merge keeps M6's version of the array (resolver picks "theirs"), silently dropping the deal worker.
4. Production: deal votes enqueue jobs; no consumer; `score` never updates; feed sort by score degrades to all-zeros ordering. No alarm.

**Evidence:** `:816` "Merge into the existing `startWorkers()` array (do not remove/reorder existing entries)" and `:981` identical instruction — both assume the other's entries are already present, which is only true with strict sequential landing.

**Suggested fix:** State an explicit landing order (M5 before M6) in both plans, OR convert worker/queue registration to a self-registration pattern (each job module pushes itself into a registry at import time, runner iterates the registry) so two milestones never edit the same array literal. Add a startup assertion that every queue in `getAllQueues()` has a live worker, failing fast if a registration was dropped.

---

## Finding 3: M8 record `householdId` move mid-sync — server-wins branch keys off stale ownership, can leak or lose a moved record

**Severity:** Critical

**Location:** `2026-05-26-m8-household-sharing.md:1252-1258` (split policy upsert loop) and `:1130-1148` (PATCH move semantics).

**Flaw:** The sync upsert decides the conflict branch by "household-scoped if either the existing server row has a `householdId` OR the incoming `u.householdId` is set" (`:1253-1254`). It picks the membership to check as `existing.householdId ?? u.householdId` (`:1255`). When a record's `household_id` **changes** (personal→household, household→null on dissolve, or household A→household B via PATCH `:1146`), an offline client holding the OLD ownership pushes an upsert under the OLD classification while the server row now has the NEW one. The branch logic uses a single coalesced household id and a single membership check — it never validates that the client was authorized under BOTH the old and new states, and the server-wins/LWW decision is taken on a possibly-mismatched axis.

**Failure scenario (dissolve revert race):**
1. Household H exists; record R has `household_id = H`, `user_id = creator C`. Member M (≠ C) is offline, holding R locally with `householdId = H`.
2. Owner dissolves H (`:1049`): server sets `R.household_id = NULL` (now personal to C), deletes memberships.
3. M comes online and pushes an upsert for R with `householdId = H` and a newer local edit.
4. In the loop: `existing.householdId` is now `NULL`, `u.householdId = H` → branch = "household" (`:1254`). Membership check uses `existing.householdId ?? u.householdId = NULL ?? H = H` (`:1255`). M is no longer a member of H (deleted) → upsert skipped (`:1255`). Good for this case — but R's server row (now personal to C) is then echoed in `changes` to M, leaking C's now-private record to a non-owner M who must overwrite local. The membership-scoped pull (`:1266`) only filters by `householdId ∈ myHouseholdIds`; a record echoed because it matched on the *push* clientId is returned in `changes` regardless of whether M may see C's personal record.

**Failure scenario (personal→household promotion losing data):**
1. R is personal to user U (`household_id = NULL`), edited offline by U → newer local copy.
2. U (online, different device) PATCHes R to `household_id = H` (`:1146`), server row now household-scoped.
3. Offline device syncs the old personal edit: `existing.householdId = H` → branch "household" → **server wins, client mutation dropped** (`:1256`). U's legitimate personal-era edit is silently discarded even though under LWW (the policy for the record *as the client knew it*) it should have won. The user sees their edit vanish with no conflict signal.

**Evidence:** `:1253-1258` classify by coalesced household id; `:1146` allows moving `householdId` across households; `:1264-1268` echo server rows in `changes` keyed on the push, not re-filtered against the caller's *current* visibility for personal records. There is no handling for "the record changed scope since the client last saw it."

**Suggested fix:** (a) On every upsert, after deciding the write, re-filter the echoed `changes` row through the caller's current visibility predicate (personal: `userId === caller`; household: `householdId ∈ myHouseholdIds`) and DROP rows the caller may no longer see — never echo another user's now-personal record. (b) Treat a scope change as a conflict the client must be told about explicitly (return the canonical server row + a `scopeChanged` marker) rather than silently dropping a personal-era edit. (c) Add tests for all three transitions (personal→household, household→null via dissolve, household A→B) with an offline client holding the prior scope.

---

## Finding 4: M8 dissolve vs. concurrent member edit/sync — lost update and orphaned membership check

**Severity:** High

**Location:** `2026-05-26-m8-household-sharing.md:1049` (dissolve transaction) and `:1145` (PATCH household-member permission check is non-transactional with the record write).

**Flaw:** Dissolve runs `records.updateMany({ where: { householdId: id }, data: { householdId: null } })` then `household.delete(...)` in one transaction (`:1049`). A concurrent `PATCH /v1/records/:id` from a member loads the record, calls `assertMember` (`:1145`), then writes — but the membership check and the record write are separate statements with no row lock and no `SELECT ... FOR UPDATE`. The dissolve transaction and the patch can interleave such that the patch passes `assertMember` (membership row still present) and then writes `household_id = H` back onto a record the dissolve just nulled, OR the patch creates a brand-new household record after dissolve has scanned but before it commits.

**Failure scenario:**
1. T0: Member M sends PATCH R setting some field; handler loads R (`household_id = H`), `assertMember(H, M)` passes (`:1145`).
2. T1: Owner dissolves H. Transaction nulls R.household_id, deletes memberships, deletes H (`:1049`), commits.
3. T2: M's patch write commits, setting R.household_id back? — if the patch only updates the edited field it leaves `household_id` as whatever it read into the update payload; if it writes the full row (Prisma `update` with `data` including householdId from input) it can resurrect `household_id = H` pointing at a now-deleted household → FK violation (best case, errors) or a dangling reference if FK deferred. With `onDelete: SetNull` (`:410`) the cascade already ran; re-setting H violates the FK since H is gone.
4. Alternatively M creates a NEW record with `householdId = H` (`:1118`) between the dissolve's `updateMany` scan and the `household.delete` — `assertMember` passed pre-dissolve, the insert lands, then `household.delete` cascade-deletes the membership but the just-inserted record keeps `household_id = H` until `SetNull` fires; ordering of cascade vs. insert is not serialized.

**Evidence:** Dissolve is a transaction (`:1049`) but the records routes' permission check + write are not stated to take any lock or re-validate household existence inside the write transaction (`:1116-1118`, `:1141-1148`). No advisory lock or `SELECT FOR UPDATE` on the household is mentioned anywhere in Phase C/D.

**Suggested fix:** Take a per-household advisory lock (or `SELECT ... FOR UPDATE` on the `households` row) at the start of dissolve AND at the start of any record write that targets a household, so the two serialize. Re-assert household existence + membership inside the write transaction immediately before the write. Add a concurrent test: start a record PATCH, dissolve mid-flight, assert no FK error and a deterministic outcome.

---

## Finding 5: M6 select transaction sets `selectedClaimId` but `notifyNewClaim`/`notifySelected` push enqueue is non-atomic with state — partial failure leaves silent state

**Severity:** High

**Location:** `2026-05-26-m6-blessing-giveaway.md:1086-1090` (select: multi-row update in `$transaction`, "Push enqueues happen AFTER the transaction commits") and `:1069` (claim create + `notifyNewClaim`).

**Flaw:** Push enqueue happens after the DB commit (`:1090`). If the process crashes (or the BullMQ connection is down) between commit and enqueue, the giveaway is `claimed` with a selected recipient and rejected losers, but **no notification is ever sent**. There is no in-record "pending notification" marker and no reconciliation. Coordination in M6 is push-only — "there is NO in-app chat" (`:5`) — so a dropped `notifySelected` means the selected recipient never learns they were chosen; the giver waits for a no-show; the giveaway stalls in `claimed` indefinitely (no auto-expiry — `cancel` is the only exit, `:653-658`).

**Failure scenario:**
1. Giver selects claim X. Transaction commits: giveaway `open→claimed`, X `selected`, others `rejected` (`:1086`).
2. API process is killed (deploy, OOM) before `notifySelected`/`notifyRejected` enqueue (`:1090`).
3. Recipient X gets no push; rejected claimers get no push. Giveaway is stuck `claimed`. No retry path exists.

**Evidence:** `:1090` explicitly orders push AFTER commit with no outbox/retry; the state machine (`:653-658`) has no timeout out of `claimed`; spec note `:28` defers real-time push of claim counts but the select/complete pushes are the only coordination channel.

**Suggested fix:** Use a transactional outbox: write a `pending_notification` row inside the same transaction as the state change, and have a worker drain it (at-least-once). Or make the notification enqueue idempotent and retried by a reconciliation sweep over `claimed` giveaways whose `selectedClaimId` notification was never confirmed. At minimum, document a manual recovery and add an auto-expiry from `claimed`.

---

## Finding 6: M6 rating before reputation-recalc + the debounce can drop a rating → reputation drift

**Severity:** Medium

**Location:** `2026-05-26-m6-blessing-giveaway.md:1107-1111` (rating enqueues `enqueueReputationRecalc(rateeUserId)`); debounce `:885-908`; processor `:910-938`.

**Flaw:** Same tail-drop class as Finding 1, but the consequence is reputation correctness. Two ratings for the same ratee within 30s collapse to one job; the job reads `transactionRating.groupBy` at fire time (`:916`). If the second rating commits after the aggregation snapshot, the average/count is computed over a subset and never recomputed (no re-arm). Because each completed giveaway yields exactly TWO ratings (giver rates recipient, recipient rates giver), and both enqueue against potentially the **same** ratee across two different giveaways finishing close together, the collapse is realistic, not theoretical.

**Failure scenario:**
1. Giveaway G1 completes; recipient rates giver U. `enqueueReputationRecalc(U)` → enqueued, job at T+30.
2. T+10: Giveaway G2 (also U as giver) completes; its recipient rates U. `enqueueReputationRecalc(U)` → debounced (`:896`), no new job.
3. T+30: job aggregates ratings for U. If G2's rating row commit is not yet visible at the snapshot instant, U's `giverRatingAvg`/`transactionCount` reflect only G1.
4. No further activity on U → stale forever.

**Evidence:** `:896` returns `'debounced'` and schedules nothing new; `:916-929` recompute from a point-in-time snapshot; `transactionCount = total` (`:936`) is overwritten wholesale, so an undercount is absolute, not additive.

**Suggested fix:** Same as Finding 1 — worker re-arm on a per-user dirty/version marker, or delete the sentinel at worker start so a late rating re-arms. Add a test: two ratings for one ratee straddling the debounce boundary → final `transactionCount` equals 2.

---

## Finding 7: M7 conversion fires on EVERY record create but is not guarded by the create's idempotency — retry of a non-idempotent path is fine, but a concurrent double-create races the conversion lock

**Severity:** Medium

**Location:** `2026-05-26-m7-referral-and-app-sharing.md:980-1033` (`convertReferral`), `:1036` (decision: called on every record create), and the hook into `routes/records/create.ts` (`:58`, Task F4 referenced).

**Flaw:** `convertReferral` is internally idempotent via the conditional `updateMany(where status='pending')` + `if (updated.count === 0) return` (`:986-990`) — this correctly handles the double-award race for the SAME referral. However, the conversion is hooked into the M1 record-create path which is itself idempotent on `client_id`. If the first-record create is retried with a **fresh** idempotency key (client lost the response and retried with a new key, creating a SECOND record), `convertReferral` runs twice but on the second run the referral is already `converted` → no-op (safe). The real exposure: the conversion runs inside its OWN `$transaction` (`:982`) SEPARATE from the record-create transaction. If the record create commits but the conversion transaction fails (deadlock, timeout) and the error is swallowed or not retried, the milestone is reached (record exists) but conversion never fires and there is **no retry trigger** until the user creates ANOTHER record — and the trigger is "first record," so a user who only ever creates one record never converts their referrer.

**Failure scenario:**
1. Referred user creates their first record. Record-create transaction commits.
2. `convertReferral(referredUserId)` begins its separate transaction; it deadlocks against a concurrent points update on the referrer and throws.
3. The record-create handler either ignores the conversion error (fire-and-forget) or returns 500 after the record already committed.
4. User never creates a second record. Referrer never gets points. Referral stuck `pending` forever.

**Evidence:** Conversion is a distinct `$transaction` (`:982`) not composed with the record write; the trigger is solely "first record" (`:1036`); no sweep/retry for stuck `pending` referrals exists (D1 decision `:134` explicitly has no `expired`/retry state).

**Suggested fix:** Either run `convertReferral` inside the SAME transaction as the record create (so they commit/rollback together), or make conversion fire on every record create unconditionally (it is already a cheap no-op when nothing is pending, per `:1036`) AND add a periodic reconciliation that converts any referral whose referred user has ≥1 record but status is still `pending`. Add a test: record create succeeds, conversion transaction throws → assert a subsequent record create (or sweep) still converts.

---

## Finding 8: M7 points_balance denormalization can drift if any future writer bypasses the ledger transaction; no invariant check

**Severity:** Medium

**Location:** `2026-05-26-m7-referral-and-app-sharing.md:995-1006` (ledger row + `pointsBalance increment` in same tx) and convention `:102`.

**Flaw:** The plan correctly couples the ledger insert and balance increment in one transaction (`:995-1006`) and documents the invariant (`:102`). But `pointsBalance` is a denormalized running sum with NO reconciliation or CHECK that `sum(points_ledger.delta WHERE user_id) == users.points_balance`. The `badge_bonus` reason exists in the enum (`:130`) and `PointsReason` (`:447`) but the conversion service only ever writes `referral_converted` (`:999`); a future or partial implementation that awards `badge_bonus` points outside this exact transaction would drift the balance with no detection. More immediately: the read route `GET /v1/me/points` returns `balance` from `users.points_balance` (`:501-506`) while listing ledger items — if these ever disagree the user sees a balance that doesn't match their visible history, with no self-heal.

**Failure scenario:**
1. A `badge_bonus` award is added later (the enum invites it) but the implementer writes the ledger row and forgets the balance increment (or does it in a second statement that fails).
2. `points_balance` now understates the ledger sum. `GET /v1/me/points` shows balance=50 but ledger rows summing to 100.
3. No alarm, no reconciliation job.

**Evidence:** `:447` and `:130` define `badge_bonus` as a valid reason but no code path writes it; `:102` states the invariant as a convention only, not enforced; `:501-506` reads the denormalized balance independently of the ledger sum returned alongside it.

**Suggested fix:** Add a periodic (or test-time) invariant check `sum(delta) == points_balance` per user. Provide a single `awardPoints(tx, userId, delta, reason, refId)` helper that ALWAYS does both writes, and forbid direct `pointsBalance` mutation elsewhere. If `badge_bonus` is not used in M7, remove it from the enum until needed (avoids inviting an unguarded writer).

---

## Finding 9: M8 invite accept upsert is idempotent on membership but the invite status flip is a lost-update race → one code, two members or stuck invite

**Severity:** Medium

**Location:** `2026-05-26-m8-household-sharing.md:981` (invites-accept: upsert membership + set invite `accepted` in a transaction) and `:51` (anyone with the code can accept).

**Flaw:** The accept handler validates `status === 'pending'` and `expiresAt > now`, then in a transaction upserts the membership and flips the invite to `accepted` (`:981`). The validation read and the status flip are within one transaction, but without `SELECT ... FOR UPDATE` on the invite row, two concurrent accepts of the same shareable code (the code is meant to be shared widely, `:51`) can both pass the `status === 'pending'` check before either flips it. The membership upsert is keyed unique on `(householdId, userId)` so the SAME user accepting twice is safe — but TWO DIFFERENT users racing the same single-use-looking code both become members, while the invite can only record ONE `acceptedByUserId` (`:460-461`). The product intent ("anyone with the code can accept," `:51`) may actually want multi-use — but then the `accepted` terminal status (`:981`) is wrong, because the second accepter flips an already-`accepted` invite or is rejected as `invite_invalid` non-deterministically depending on interleaving.

**Failure scenario:**
1. Invite code shared in a group chat. Users P and Q tap it within the same second.
2. Both transactions read invite `status='pending'` (`:981`).
3. P commits: membership(P) created, invite→accepted, acceptedByUserId=P.
4. Q commits: membership(Q) created, invite→accepted again (overwrites acceptedByUserId=Q) OR Q's pre-read status was pending so it proceeds — Q is now a member but the audit trail says only Q (or only P) accepted. If instead the code is intended single-use, P and Q both joined despite "single" semantics.

**Evidence:** `:51` "anyone with the code can accept (this matches 'share a link')" implies multi-use, but the schema/flow at `:458-461` + `:981` model a single terminal `accepted` + single `acceptedByUserId`, a contradiction. No row lock on the invite read.

**Suggested fix:** Decide the semantics explicitly. If single-use: `SELECT ... FOR UPDATE` the invite row (or a conditional `updateMany(where status='pending')` returning count, like M7's conversion guard at `:986`) so exactly one accept wins; the loser gets `invite_invalid`. If multi-use: drop the `accepted` terminal flip and `acceptedByUserId` single-value semantics; track acceptances via membership rows only, expire by time/`expiresAt`. Either way the current code is racy. Add a concurrent-accept test.

---

## Cross-cutting note (not counted)

`getQueueConnection()` returns raw `ConnectionOptions` (per context); each `getXQueue()`/`startXWorker()` constructs a NEW BullMQ `Queue`/`Worker` with a fresh connection (M5 `:653-657`, `:705-708`; M6 `:878-882`, `:941-944`). With M5+M6 added, connection count grows linearly with queues × (queue + worker). Not a correctness bug, but flag for connection-pool exhaustion under many milestones. No fix required for these plans.

---

## Unresolved questions

1. M8: is the invite code single-use or multi-use? (Finding 9 — schema and prose disagree.)
2. M5/M6: is the debounce tail-drop (Findings 1, 6) an accepted approximation for "eventually consistent score" or a correctness requirement? The score feeds feed-ordering (`:169`), which suggests it matters.
3. M5/M6 landing order — are these branches landed sequentially or in parallel? (Finding 2 severity depends on this.)
4. M7: should conversion be transactionally composed with record-create, or is a reconciliation sweep acceptable? (Finding 7.)
