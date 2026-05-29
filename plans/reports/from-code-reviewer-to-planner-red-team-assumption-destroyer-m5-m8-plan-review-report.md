# Red-Team Assumption Destroyer — M5–M8 Plan Review

Reviewer lens: hostile skeptic. Target: unstated dependencies, false "will just work" claims, integration/scale assumptions across milestones. Greenfield — no v1 code exists, so evidence = plan file:line + the v1 contract supplied in the brief. v1 claims are unverifiable against code; several findings below are *exactly* about plans betting on v1 shapes they never pinned.

---

## Finding 1: `ALTER TYPE ... ADD VALUE` cannot run inside Prisma's migration transaction (both M5 and M6)
**Severity: Critical**
**Location:** M5 `2026-05-26-m5-deal-sharing.md:233` ("an `ALTER TYPE ... ADD VALUE 'deal'`"); M6 `2026-05-26-m6-blessing-giveaway.md:298` ("`ALTER TYPE ... ADD VALUE 'giveaway';` — verify it is present").

**Assumption:** Adding an enum value to `ReportTargetType` is a routine Prisma-generated migration that applies in the same `prisma migrate dev` run as the new tables, and the only action item is "verify it is present."

**Why it may break:** Before Postgres 12, `ALTER TYPE ... ADD VALUE` was *forbidden inside a transaction block*. Prisma applies each migration file inside a transaction (and `migrate deploy` wraps the run). On the supported Postgres 16 the value can be added in a txn, BUT the newly added enum label **cannot be USED in the same transaction that adds it** — Postgres rejects `ERROR: unsafe use of new value "deal" of enum type`. The M5/M6 migrations only ADD the value (no use), so the migration itself survives — but the plans never state the real landmine: **any test or seed that both adds AND references the value in one txn fails**, and if a future combined migration tries to insert a `'deal'` report in the same file it dies. Neither plan calls this out; M6:298 reduces it to "verify it is present," masking a known Postgres footgun. More dangerous: the test harness re-applies migrations against `pantry_test`; if anyone consolidates these enum additions into a data migration, it breaks non-obviously.

**Evidence:** M5:233, M6:298 both treat the enum-add as inert. No mention of the in-transaction-use restriction anywhere in either plan. Postgres SQLSTATE 55P04 / "unsafe use of new value".

**Suggested fix:** Add an explicit note to both A2 tasks: enum value is added in its own migration step that does nothing else; no test/seed may insert a `deal`/`giveaway` report row in the same transaction that introduced the value (fine here because they're separate migrations, but pin it). State that `targetExists`/report-create tests run against an already-migrated DB so the value is committed.

---

## Finding 2: M5/M6 both modify `getAllQueues()` and `runner.ts` — no merge-ordering contract; "do not reorder" is not collision-safe
**Severity: High**
**Location:** M5 `2026-05-26-m5-deal-sharing.md:796-822` (Task C3 appends to `getAllQueues()` + `startWorkers()`); M6 `2026-05-26-m6-blessing-giveaway.md:835-848` (Task E0) and `:976-989` (Task E3); M6 self-review `:1305`.

**Assumption:** Each milestone independently "appends" to `getAllQueues()` and "merges" a worker into `startWorkers()` and they compose cleanly because each says "do not remove/reorder existing entries" (M5:816, M6:981).

**Why it may break:** Both plans assume they are the *only* editor of these two files and both describe the edit as "append the new entry." When M5 and M6 land in either order (or in parallel worktrees, which the team-coordination rules actively encourage), they edit the **same array literal in the same two files** → guaranteed git conflict, and worse, a silent logic problem if one rebases and the "append" lands mid-array. Neither plan declares a dependency on the other, neither states which merges first, and M8's handoff (`m8:1620`) lists M5/M6 as already-green prerequisites — implying a serialization that is never written down. "Don't reorder" guidance does not prevent two appends to the same line from conflicting.

**Evidence:** M5:805 adds `{ name: DEAL_SCORE_RECALC_QUEUE, ... }`; M6:840 adds `{ name: REPUTATION_RECALC_QUEUE, ... }` — same registry array, no sequencing statement in either Prerequisites block. M5 Prerequisites (M5:13-19) do not mention M6; M6 Prerequisites (M6:13-20) do not mention M5.

**Suggested fix:** State an explicit landing order (e.g. M5 before M6) in both Prerequisites, or restructure `getAllQueues()`/`startWorkers()` to a registration-call pattern (`registerQueue(...)` in each job module's own file) so each milestone touches only its own file. Add "expect a trivial conflict in queues/index.ts + runner.ts if landed alongside M6/M5; resolve by keeping both entries."

---

## Finding 3: M6 `reputation-recalc` debounce silently drops the final rating's recompute (off-by-one window race)
**Severity: High**
**Location:** M6 `2026-05-26-m6-blessing-giveaway.md:885-908` (`enqueueReputationRecalc`); same pattern M5 `2026-05-26-m5-deal-sharing.md:665-681`.

**Assumption:** "The first event for a deal within the TTL window enqueues a delayed job; subsequent events within the window are dropped. The TTL key expires before the worker runs, so the next vote after the job fires queues again" (M5:660-663). M6 reuses this verbatim for ratings.

**Why it may break:** The debounce TTL (30s) and the job `delay` (30s) are *equal* (M6:893 + M6:901; M5:668 + M5:674). The Redis NX key and the delayed job are created back-to-back but expire/fire on independent clocks. If a second rating arrives at t=29.9s, it sees the key still present → **dropped**, and no new job is scheduled. The already-scheduled job fires at t≈30s and aggregates — so in the common case the final write is captured because the processor re-aggregates *all* rows at fire time (M6:916 groups over all `transaction_ratings`). That saves the score correctness. BUT the *transactionCount/averages* are only correct if the single job fires *after* the last write commits. For giveaways this is usually fine (2 ratings, far apart). The unstated risk is the **debounce assumes the recompute reads committed state** — yet the enqueue (M6 ratings route F6, `m6:1107-1111`) fires `enqueueReputationRecalc(rateeUserId)` and the rating row is written in the request; if the worker's 30s delay is reduced later, or the rating txn hasn't committed when a (hypothetically) immediate job runs, the aggregate misses a row and `transactionCount` is permanently wrong until the next rating. The plan never states the invariant "delay MUST exceed the rating-write commit latency" nor tests a same-window double-rating.

**Evidence:** M5:668 `EX 30 NX` and M5:674 `delay: 30 * 1000` are coupled with no margin; M6:893/901 identical. M6 worker test (M6:1149) calls the processor inline "skip the 30s delay" — so the *delay-vs-commit* ordering is never exercised by any test.

**Suggested fix:** Document the invariant (job delay ≥ debounce TTL ≥ max write-commit latency) and add a test that enqueues, writes a second rating inside the window, lets the single job run, and asserts the aggregate includes both rows. Or recompute is idempotent-by-full-scan (it is) — then state explicitly that count correctness depends only on the LAST job firing after the LAST commit, and guarantee that by re-enqueuing on every write regardless of the NX key when a job is already past its delay.

---

## Finding 4: M7 hooks conversion into `POST /v1/records` but assumes record-create is the trigger AND that the payload/idempotency shape is reconcilable post-hoc
**Severity: High**
**Location:** M7 `2026-05-26-m7-referral-and-app-sharing.md:1036` (Decision D5), `:1520-1534` (Task F4 hook), `:1544-1572` (e2e test), `:2251` (self-flag "must be reconciled with M1's actual record-create contract").

**Assumption:** "the single observable trigger is 'first record created'" and `convertReferral(req.user.id)` can be dropped into M1's record-create handler after commit; the exact `/v1/records` payload + Idempotency-Key shape "must be reconciled when wiring" — i.e. deferred.

**Why it may break:** Three stacked unstated bets:
1. **M1's record create may not be the path users actually hit first.** M1 ships `POST /v1/records/sync` (offline write queue) as the primary record-creation mechanism for the mobile app — records are the *one* offline-queued entity (M5:24, M6:40, M8:5 all stress records are the offline entity). If the mobile client creates the first record offline and it arrives via `/v1/records/sync`, the conversion hook in `routes/records/create.ts` (M7:1516) **never fires** — the sync path is a different handler. M7 hooks only `create.ts` and never mentions `sync.ts`. For an offline-first app this is the *common* path, not the edge.
2. **"first record" with no sentinel** (M7:1534) means `convertReferral` runs on *every* record create forever. The plan calls this "cheap" (one indexed lookup). With M8 landing later, record creates also carry `householdId` and run through household-permission checks — the conversion call is appended blindly and now fires on shared-record creates by referred users too. Harmless for points, but the assumption "this is their first qualifying record" (M7:1520) is false — it's *any* record, relying entirely on the referral row already being consumed.
3. **The e2e test fabricates `emailVerifiedAt` directly** (M7:1555 `prisma.user.update(... emailVerifiedAt ...)`) — betting the column is named `emailVerifiedAt`. M6/M8 factories use `makeUser({ emailVerified: true })` (boolean-style, e.g. M8:1022). If M0b stored verification as a boolean `emailVerified` or a separate `auth_credentials` row, this update writes a non-existent/!wrong column and the test is silently wrong.

**Evidence:** M7:1516 modifies only `routes/records/create.ts`; no reference to `/v1/records/sync` anywhere in M7 despite M8:17 confirming `POST /v1/records/sync` is the offline path. M7:1555 assumes `emailVerifiedAt` while M8:1022 uses `emailVerified: true`.

**Suggested fix:** Decide and state where conversion fires for offline-created records — either hook `syncRecords` too, or move the trigger to email-verify (M7:1036 admits verify is the real gate but discards it). Reconcile the verification field name against M0b *before* writing the e2e test, not "when wiring." Add a sentinel or accept the "fires on every create" cost explicitly with M8 in mind.

---

## Finding 5: M7 `publicWebBaseUrl` / universal-link + AASA/assetlinks infrastructure is assumed but planned nowhere
**Severity: High**
**Location:** M7 `2026-05-26-m7-referral-and-app-sharing.md:799-803` (`shareUrlForCode` reads `getConfig().publicWebBaseUrl`), `:853` (Decision D4 "if M0a's config does not already expose it, add it"), `:1253` self-flag; share URL `https://pantry.app/invite?code=` (M7:802).

**Assumption:** A web origin (`publicWebBaseUrl`) exists that serves `/invite?code=...`, and tapping that https link on a phone opens the app (universal link / app link) so `DeepLinkHandler` can capture the code "before sign-up" (M7:17).

**Why it may break:** Two distinct gaps:
1. **The captured-before-signup flow requires the https link to launch the app on a fresh install** — that is iOS Universal Links (AASA file at `https://pantry.app/.well-known/apple-app-site-association`) + Android App Links (`assetlinks.json` + verified domain). None of M0a/M0b/M0c as described provide this; M7 only mentions `pantry://` custom-scheme handling (M7:17, M8:51) which a browser will NOT auto-open from an https URL, and which does nothing on first launch before the app is installed. So the headline UX — "capture from an inbound deep link on first launch" (M7:5) — silently degrades to "only works if the app is already installed AND the OS is configured for the custom scheme," which a shared WhatsApp `https://pantry.app/invite?...` link does not satisfy.
2. **`publicWebBaseUrl` defaulting to `https://pantry.app`** (M7:853) bakes a real domain into share messages and admin links with no statement that the domain is owned/served. The share sheet (M7:1927) sends users to a URL that may 404.

The admin overview and `shareUrlForCode` will *typecheck and pass tests* (tests only assert the string contains `/invite?code=` — M7:1253) while the actual link is dead in production. This is the textbook "passes CI, breaks in prod."

**Evidence:** M7:802 hardcodes the host; M7:853 makes config addition conditional/optional; M7:1796 only parses `path === 'invite'` from a `Linking.parse` (custom scheme), never associated-domains config. No file in any of the four file-maps adds AASA/assetlinks or a web `/invite` handler.

**Suggested fix:** Add an explicit out-of-scope or a prerequisite line: "Universal/App Links (AASA + assetlinks + a web `/invite` landing page) are required for inbound https capture and are NOT delivered here — until then, capture works only via the typed code field and the `pantry://` scheme for already-installed apps." Make `publicWebBaseUrl` required config with no prod default, or default to the custom scheme.

---

## Finding 6: M8 "multi-household membership allowed" is asserted but the records/sync model is only validated for the membership-join, not for a user in N households with overlapping records
**Severity: High**
**Location:** M8 `2026-05-26-m8-household-sharing.md:37` (Decision 2 "a user may belong to multiple households"), `:1086-1091` (scope filter uses `householdId ∈ myHouseholdIds`), `:1251-1268` (sync delta pull "every household record the caller can see").

**Assumption:** Because `household_members` has no global one-household-per-user constraint and the read filter uses `householdId ∈ myHouseholdIds`, multi-household "just works" cleanly across records, sync, and UI.

**Why it may break:**
1. **Sync delta pull unbounded by household count.** The `scope=all` pull (M8:1089, reused for sync at M8:1268) returns the union of *every* record across *every* household the user belongs to, every sync cycle, gated only by `updatedAt > since`. For a user in many households this is a fan-out the plan never bounds — and `myHouseholdIds` is recomputed per request (M8:1086 "resolve once at the top" = once per request, not cached). No index is described on `records(household_id, updated_at)` for the sync cursor — the only added index is `@@index([householdId, status, expiryDate])` (M8:414), which does **not** serve the `householdId IN (...) AND updatedAt > since` sync query → sequential scan as records grow. Classic N+1-adjacent / missing-index scale bug that passes tests (tiny data) and degrades in prod.
2. **WatermelonDB has a single `household_id` per local row but the scope toggle (M8:1383) assumes the device can hold records from all the user's households simultaneously.** Fine — but the local sync apply (M8:1335) overwrites household rows server-wins with no per-household partition; if a user *leaves* one household, the plan never says the local store purges that household's rows. Stale shared records linger on-device until... never (no purge step in F2/G hooks). The dissolve/leave invalidates `['records']` query (M8:1361) but that's TanStack cache, not the WatermelonDB local table the home screen reads from (M8:1389 reads the local DB).

**Evidence:** M8:414 is the only new records index and is wrong-shaped for the sync pull at M8:1268. No record-purge-on-leave step in M8 Phase F (M8:1280-1348) or the leave/dissolve hooks (M8:1361). M8:37 asserts multi-household with no scale or local-eviction consideration.

**Suggested fix:** Add `@@index([householdId, updatedAt])` (or include `updatedAt` in the existing index) sized for the sync cursor. Add a local-eviction step: on leave/dissolve success, delete local WatermelonDB records where `household_id` is no longer in the user's membership set. State a soft cap or pagination guarantee for the multi-household sync fan-out.

---

## Finding 7: M5 deal currency defaults "from user country" but `users.country` is ISO-3166, not a currency, and the route assumes a `country` column + a hand-rolled 14-entry map
**Severity: Medium**
**Location:** M5 `2026-05-26-m5-deal-sharing.md:443` (schema comment "server defaults to the user's country currency or 'USD'"), `:1140-1142` + `:1170-1178` (`currencyForCountry`), `:1046` (test asserts currency matches `/^[A-Z]{3}$/`).

**Assumption:** `prisma.user.findUnique(... ).country` exists and yields an ISO-3166 alpha-2 code that maps to a currency via a 14-country lookup; anything unknown falls back to `USD`.

**Why it may break:**
1. **`users.country` is never confirmed to exist or to be alpha-2.** M0a/M0b contract in the brief lists `toApiUser` camelCase but does *not* list a `country` field. M7's register handler (M7:1182) writes `country` into user create — so M7 *introduces* it. M5 (an earlier-numbered milestone) reads `me?.country` (M5:1141) assuming it's already there. If M5 lands before M7 or M0b never added `country`, `me.country` is `undefined` → silently always `USD`. The dependency on a `country` column is unstated in M5 Prerequisites (M5:13-19).
2. **Country→currency is many-to-one and lossy.** The map (M5:1172-1176) folds the entire Eurozone to EUR and omits most countries; a user in an unlisted country (e.g. BR, MX, CN, KR) silently gets USD on a *price* field — a correctness bug for a deals/price feature where currency is load-bearing. The test (M5:1046) only asserts the result is *some* 3-letter code, so the wrong-currency default passes CI.

**Evidence:** M5:1141 `me?.country` with optional chaining (acknowledging it may be absent) then M5:1142 falls back to USD; M5 Prerequisites never list `country`. M7:1182 is where `country` is actually populated.

**Suggested fix:** Either require the client to send `currency` (it's already optional on the wire, M5:446 — make it required), or pin `users.country` as an explicit M5 prerequisite and confirm its format. Document that the currency default is best-effort and unlisted countries get USD, or store a real `currency` preference on the user instead of deriving from country.

---

## Finding 8: M5/M6 assume M3 admin page/route scaffolding and the M2 "generic report-queue renderer" exist as extension points — never verified, and M6 invents new admin API endpoints inline
**Severity: Medium**
**Location:** M5 `2026-05-26-m5-deal-sharing.md:92` ("MODIFY: render `deal` target preview" in `ReportPreview.tsx`), `:19` (assumes "generic report-queue UI that M5 extends"); M6 `2026-05-26-m6-blessing-giveaway.md:1273` ("Modify the existing admin report-queue rendering (M2)"); M8 `2026-05-26-m8-household-sharing.md:1493` ("add a minimal `GET /v1/admin/households` ... to the API if M3's admin surface does not already proxy").

**Assumption:** M2/M3 shipped a *generic, target-type-extensible* report-queue renderer (`ReportPreview.tsx` with a switch the new milestones can add a case to) and a stable `serverAdminApi`/`browserAdminApi` surface that new pages slot into.

**Why it may break:** The brief's v1 contract says M2 has a "generic admin report queue" and M3 has `serverAdminApi`/`browserAdminApi` — but neither plan verifies the *renderer is structured as an extensible switch* vs. hardcoded for `review`/`user`/`product`. M5:92 names a specific file `src/features/reports/ReportPreview.tsx` and assumes a `deal` branch slots in; if M2's renderer isn't componentized that way, M5's "MODIFY" is actually a rewrite. M6:1273 is even vaguer ("the existing admin report-queue rendering"). M8:1493 openly hedges ("if M3's admin surface does not already proxy") — i.e. it doesn't know whether the admin API can list households and proposes inventing two endpoints (`GET`/`DELETE /v1/admin/households`) *inside* the admin-page task, with `app.requireAdmin` assumed. These admin endpoints are real API surface (auth, validation, audit-log) being smuggled into a UI task with no test task of their own.

**Evidence:** M5:92 assumes a `ReportPreview.tsx` extension point not in any verified file list; M6:1273 references "existing" rendering without a file path; M8:1493 conditionally adds `GET/DELETE /v1/admin/households` with no dedicated test task (the only test is the Playwright UI spec M8:1485).

**Suggested fix:** Add a prerequisite check task: "confirm M2's report renderer dispatches on `targetType` (extensible) — if hardcoded, refactor first." Pull M8's admin household endpoints out of the UI task into their own API task with integration tests for `app.requireAdmin` + the revert-to-private dissolve. Pin the exact `serverAdminApi` method shape M5/M6/M8 extend.

---

## Finding 9: M6 rating route depends on resolving `selectedRecipientId` from the selected claim, but `inferRaterRole` and the giveaway model store recipient identity in two unsynchronized places
**Severity: Medium**
**Location:** M6 `2026-05-26-m6-blessing-giveaway.md:1111` ("load giveaway + its selected claim (to resolve `selectedRecipientId`)"), `:743-751` (`inferRaterRole` takes `selectedRecipientId`), schema `selectedClaimId` on Giveaway (M6:189), `selected` status on the claim (M6:1086).

**Assumption:** At rating time the server can reliably resolve "who is the selected recipient" by loading the giveaway's `selectedClaimId` → claim → `claimerUserId`, and that this equals the recipient who was notified/selected.

**Why it may break:** Recipient identity is derived, not stored, and lives across two rows that the select transaction (M6:1090) must keep consistent: `Giveaway.selectedClaimId` and the `GiveawayClaim.status='selected'`. The rating route (M6:1111) reads back through `selectedClaimId`. If select sets `selectedClaimId` but a later cancel/edit path ever nulls status without nulling `selectedClaimId` (or vice versa), `inferRaterRole` resolves a stale/empty recipient → ratings silently 403 or attribute to the wrong ratee, corrupting reputation. The state machine (M6:653-658) governs the *giveaway* status but says nothing about keeping `selectedClaimId` ↔ claim.status invariant. There's no DB-level guarantee (no FK from `selectedClaimId` enforcing the pointed claim is `selected`). The plan never states the invariant "`selectedClaimId` is non-null iff exactly one claim is `selected` and they reference each other."

**Evidence:** M6:189 `selectedClaimId String?` is a bare nullable UUID with no constraint tying it to a `selected` claim; M6:1090 sets both in one txn (good) but no other path is forbidden from desyncing them; M6:744 `inferRaterRole` trusts `selectedRecipientId` derived at read time.

**Suggested fix:** State the invariant explicitly and assert it in the select transaction + a test. Consider denormalizing `selectedRecipientUserId` onto the giveaway at select time (single source of truth for rating role inference) instead of re-deriving through the claim each time, or add a guard in the rating route that the resolved recipient matches a `selected`-status claim.

---

## Finding 10: M8 dissolve/member-remove revert-to-private races the sync engine; "items survive" is tested only single-threaded
**Severity: Medium**
**Location:** M8 `2026-05-26-m8-household-sharing.md:49` (Decision 5), `:1047` (member-remove nulls `household_id`), `:1049` (dissolve `updateMany ... householdId: null` then delete), `:1019-1037` (test asserts rows survive, single-actor).

**Assumption:** Nulling `household_id` before the cascade delete makes dissolve non-destructive and "items survive, attribution preserved" — verified by a test where one owner dissolves and one row is checked.

**Why it may break:** The revert is a server-side `updateMany` that flips potentially many members' shared records to personal. Concurrently, those members' devices are running the server-wins sync (M8:1335) which *unconditionally overwrites local household rows from server state*. The interleaving is unhandled:
1. A member mid-sync may have pushed an edit to a now-being-dissolved record; the dissolve txn and the sync upsert race on the same row. The sync server-wins path (M8:1256 "do NOT apply the client's mutation") protects the server copy, but after dissolve the record is `household_id=NULL` and owned by its creator — a *different* member who edited it offline will, on next pull, see it vanish from their household scope (correct) but their unsynced local edit to it is silently dropped with no echo (the pull only returns records `householdId ∈ myHouseholdIds`, and post-dissolve it's NULL → not in the non-creator's pull → never echoed → local orphan). The plan's re-convergence guarantee (M8:1268) only holds for records still in a shared household.
2. Member-remove (M8:1047) nulls `household_id` only for `userId = :userId` rows — so a removed member's *own-created* shared items revert to them, but items they edited but didn't create stay in the household. Fine per Decision 1, but the removed member's device still has those other-authored rows locally and (per Finding 6) never purges them.

The single-actor test (M8:1020) cannot surface any of this.

**Evidence:** M8:1049 dissolve is a plain `updateMany` + delete in a txn with no coordination with in-flight sync; M8:1268 re-convergence is scoped to `householdId ∈ myHouseholdIds`; the dissolve test (M8:1028-1035) checks one row from the owner's perspective only.

**Suggested fix:** Define the dissolve/leave contract w.r.t. concurrent sync: after revert, do removed-from-scope records get a tombstone/echo so clients can reconcile, or is "local orphan until manual refresh" acceptable? Add a multi-actor test (member has an unsynced edit when owner dissolves). Pair with Finding 6's local-eviction step.

---

## Cross-cutting note (not a numbered finding)
All four plans repeatedly assert "M0b register tests still pass," "M1 behavior preserved verbatim," "reuse M2's `maybeAutoHide`," etc. as *facts*. None can be verified — v1 (M0–M4) does not exist in this repo (greenfield). Every "CONSUMES" line is an unbacked contract. The plans that hedge honestly (M7:2251, M8:1493, M7:853) are better than the ones that assert flatly (M5:18 "the threshold literal stays exactly as M2 shipped it", M6:1170 "Reuse the existing `> 3` literal"). Recommend each plan add a **"v1 contract verification" first task** that greps the real M0–M4 code for each consumed symbol/route/column before any implementation, converting assumptions into checked preconditions.

---

## Unresolved questions
1. Landing order of M5 vs M6 (Finding 2) — who merges first?
2. Is M2's report renderer actually `targetType`-extensible, or hardcoded? (Finding 8)
3. Does `users.country` exist at M5 time and in what format? (Finding 7)
4. What is M0b's email-verification field/shape — `emailVerifiedAt` vs `emailVerified`? (Finding 4)
5. Is any Universal/App-Link infra planned outside these four plans? (Finding 5)
6. Acceptable behavior for local records after leave/dissolve and concurrent sync? (Findings 6, 10)
