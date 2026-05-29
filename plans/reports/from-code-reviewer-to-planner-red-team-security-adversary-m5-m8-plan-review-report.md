# Red-Team Security Review — M5–M8 Plans (Security Adversary lens)

Reviewer: code-reviewer (hostile). Date: 2026-05-26.
Scope: M5 deal-sharing, M6 giveaway, M7 referral, M8 household plans (greenfield — evidence = plan file:line).
Method: Fact Checker — each "missing check" claim verified by quoting the route's described logic or proving absence.

---

## Finding 1: New POST/vote routes are NOT rate-limited — referral farming, deal spam, claim flooding all uncapped per-route

- **Severity:** Critical
- **Location:** Spec §525 (rate-limit defaults); M5 `create.ts` (m5:1126-1163), `vote.ts` (m5:1659-1695); M6 claims (m6:1058-1075), ratings (m6:1100-1117); M7 register (m7:1139-1199); M8 invites-accept (m8:979-983).
- **Flaw:** The spec defines rate limits as GLOBAL defaults ("60/min per user, 30/min per IP", `/auth/*` 10/min) enforced at nginx/Redis (spec:220, spec:525). NONE of the four plans add a tighter per-route limit on the new abuse-prone mutations. A grep of all four plans for "rate" returns ZERO hits about applying limits to the new routes — only migration/queue noise. The only documented per-route opt-in pattern is `config: { idempotent: 'required' }`; there is no `config: { rateLimit: ... }` anywhere.
- **Attack scenario:**
  - M7: An attacker scripts 60 throwaway-account registrations/min/user-token boundary (registration is under `/v1/auth/*` so it gets the 10/min IP cap — but conversion farming runs through `POST /v1/records`, a normal 60/min user route). 60 fake "first records"/min across rotated accounts = unbounded +50-point farming. See Finding 2 for the self-referral mechanics this enables.
  - M5: 60 deals/min/user floods the feed; the Wilson feed is the product's core surface.
  - M6: 60 claims/min lets one user blanket-claim every open giveaway, denying real recipients.
- **Evidence (proven-absent):** m5:1129 shows the only create config is `{ idempotent: 'required' }`; no rateLimit. Same at m5:1662 (vote), m6 task F2/F4 implementation bullets list `onRequest:[app.requireAuth]` + idempotent only. No plan references spec:525.
- **Suggested fix:** Add explicit per-route Fastify rate-limit config to every new POST (deals create/vote, giveaway create/claim/rate, household invite-accept), tighter than the 60/min global (e.g. 10/min/user for create, 30/min for vote). State the limit in each route task so it is testable.

---

## Finding 2: M7 referral self-referral via second account is fully enabled — the "structurally impossible" claim is false

- **Severity:** Critical
- **Location:** M7 register handler (m7:1153-1199), anti-abuse note (m7:1199); conversion service (m7:980-1033); first-record hook (m7:1520-1534).
- **Flaw:** The plan claims (m7:1199) "self-referral is structurally impossible at register time (the new user does not yet exist, so its id cannot equal the referrer's)". This defends only against a row where `referrer_user_id == referred_user_id` — i.e. the DB CHECK `referrals_no_self_referral_check` (m7:250-253). It does NOT defend against the real attack: **one human, two accounts.** User A registers normally, gets code `ABCD2345`. User A creates account B using A's code, verifies B's email, creates one record as B. `convertReferral(B)` fires (m7:1527) → A earns +50 points + badges. Nothing in the plan checks device, IP, payment instrument, or any shared-identity signal. There is no cap on conversions per referrer per time window. The badge ladder (1/5/10/25, m7:303) is farmable to Gold with 25 throwaway accounts.
- **Attack scenario:** Scripted: register A → loop {register B_i with A's code, hit email-verify, POST one record} 25×. A reaches Gold + 1250 points. Forward note (m7:25) says points will gate cosmetic flair / leaderboards — so this is not purely cosmetic; it corrupts a future ranked surface seeded from this ledger.
- **Evidence:** m7:26 explicitly scopes anti-abuse to "reject self-referral, one conversion per referred user, code must belong to an active user" — none of which stop multi-account farming. The admin overview only *surfaces* "many signups, zero conversions" (m7:1700) — but a farmer's signups DO convert, so `abuseFlag` (converted==0) never trips for the actual attack.
- **Suggested fix:** (a) Add a velocity cap: max N conversions per referrer per rolling window, anything above queues for manual review instead of auto-awarding. (b) Make `abuseFlag` also fire on high conversion rate from a single IP/device fingerprint, not just zero-conversion. (c) Consider delaying/escrowing points until referred-user retention (e.g. active 7 days) so single-record throwaways do not pay out. These are product decisions — surface to the user rather than silently choosing.

---

## Finding 3: M6 giveaway completion + rating require NO recipient confirmation of handoff — fake completions farm reputation

- **Severity:** High
- **Location:** M6 complete (m6:1086 "Complete (giver only): transitions claimed → completed"), ratings (m6:1100-1117), reputation worker (m6:910-938).
- **Flaw:** `complete` is giver-only and unilateral — the recipient is never asked to confirm they received anything. After completion BOTH parties may rate (m6:1107), and each rating enqueues `enqueueReputationRecalc(rateeUserId)` (m6:1111) which writes denormalized `giverRatingAvg`/`recipientRatingAvg`/`transactionCount` (m6:930-937). No physical handoff is verified anywhere in the flow. The rating is gated only on `status==='completed'`, which the giver controls alone.
- **Attack scenario:** Collusion ring: User A lists a giveaway, User B (A's second account) claims, A selects B, A marks complete, A rates B 5★ and B rates A 5★. Repeat. Both accounts farm `transactionCount` and 5★ averages with zero real goods exchanged. Reputation is the trust signal future recipients/givers rely on — a farmed 5★/50-transaction profile is a setup for a later scam (build trust, then defraud a real user).
- **Evidence:** m6:1086 — complete has no recipient-side gate; m6:1107 — rating allowed for both parties immediately on `completed`; no "recipient confirms receipt" transition exists in the state machine (m6:653-658: `open→claimed→completed`, nothing for recipient acknowledgement).
- **Suggested fix:** Either (a) require a recipient-side `confirm-received` action before `completed` (two-phase), or (b) accept the reputation system is low-trust and rate-limit/velocity-cap reputation gain + dampen averages below a transaction-count floor. At minimum flag same-IP/same-device giver↔recipient pairs to admin. Note this overlaps Finding 2's multi-account root cause.

---

## Finding 4: M6 retaliatory / pre-handoff ratings and PII in pickup notes are unmitigated

- **Severity:** High
- **Location:** M6 ratings (m6:1100-1117); claim schema `pickupNote` (m6:511, m6:436); giveaway `locationText` (m6:435); claim PII exposure (m6:1065-1069).
- **Flaw (two coupled issues):**
  1. **Pre-handoff / retaliatory rating:** A rating is permitted the instant `status==='completed'` (m6:1107), with no cooldown and no requirement that the *other* party rated first. The giver can mark complete then immediately 1★ the recipient out of spite (e.g. recipient was slow), and the recipient has no recourse — the giver already controls the `completed` transition. There is no mutual-blind ("both submit before either is revealed") mechanism, so the second rater can retaliate based on the first.
  2. **PII exposure:** `pickupNote` (free text up to 500 chars, m6:436) and `locationText` (m6:435) are user-authored coordination data. The giver's claim-list endpoint returns every claimer's `pickupNote` (m6:1069 "list claims ... with claimer include") plus `claimer` projection. A claimer typically writes "I'm at 14 Elm St, call me 555-1234, home after 6". That note is visible to the giver — who is an unverified stranger — before any selection, for ALL claimants. A malicious "giver" can post a fake giveaway purely to harvest claimants' addresses/phone numbers.
- **Attack scenario:** Attacker lists "Free baby formula, must collect today", receives 30 claims each containing a home address + phone + availability window, harvests them, never hands anything over (or cancels). Zero friction; the data is delivered by the API.
- **Evidence:** m6:1069 — giver claim list includes pickupNote for all claims; m6:436 — pickupNote is plain free text, only length-validated, no PII scrubbing/redaction; m6:1107 — no rating ordering/cooldown guard.
- **Suggested fix:** (a) Withhold a claimant's `pickupNote` from the giver until that claimant is *selected* (reveal contact only on mutual commitment). (b) Add a rating cooldown + blind-mutual reveal (neither rating visible until both submitted or a window elapses). (c) Warn users in UI not to put contact info in notes; consider structured fields with explicit consent. These touch product/UX — surface to user.

---

## Finding 5: M8 household invite is bearer-token style and the accept route is unauthenticated-input-trusting — anyone with a leaked code joins; `invitedEmail` is decorative

- **Severity:** High
- **Location:** M8 design decision 6 (m8:51), invites-accept (m8:981), invite schema (m8:221-235), conventions (m8:151).
- **Flaw:** Accept is `POST /v1/households/invites/accept {code}` and the plan states plainly (m8:51) "anyone with the code can accept; this matches 'share a link'" and `invitedEmail` is "optional metadata only (not enforced)". The code is a 24-char base64url (m8:649) — strong against guessing — but it grants household membership, which per decision 3 (m8:39-44) gives **full create/edit/consume/delete on every shared record in that household**. The code travels in a `pantry://household/invite?code=` deep link (m8:979) and is echoed in API responses (m8:948 `inviteUrl`). Deep links leak readily: shared screenshots, chat history, clipboard managers, referrer headers if the universal-link host ever renders it, push-notification previews. A leaked invite link = silent full access to a family's shared pantry data (locations, consumption habits) by a stranger, with the invite then marked `accepted` and bound to the attacker.
- **Attack scenario:** A household owner pastes the invite link into a group chat to reach one cousin. Anyone in that chat (or anyone who later sees the screenshot) opens it and is joined as a `member` — they can now read all shared records and add/delete items. The legitimate invitee may find the invite already consumed (single-use accept flips to `accepted`, m8:981), causing a confusing failure while the attacker is in.
- **Evidence:** m8:51 explicitly states no email gating and "anyone with the code can accept"; m8:981 accept logic validates only `status==='pending'` + not expired, never that `req.user`'s email matches `invitedEmail`. This is a documented design choice, not an oversight — but the security trade-off (link = bearer credential to PII) is not acknowledged.
- **Suggested fix:** Surface the trade-off to the user as a decision. Options: (a) when `invitedEmail` is set, require the accepting user's verified email to match (turn the decorative field into a gate); (b) require owner approval of a join request rather than auto-join on code; (c) short expiry (already 14d — tighten to hours) + single-use (already) + owner notification on accept (already planned via push) so the owner can immediately revoke/remove. At minimum document that the invite link is a bearer credential.

---

## Finding 6: M8 record patch can move a record INTO a household the caller belongs to but exfiltrate via cross-household reassignment, and personal→household leak of other users' data is under-specified

- **Severity:** High
- **Location:** M8 record patch (m8:91 MODIFY routes/records/patch.ts, m8:1047 perms), record schema `householdId` patch (m8:308-314), decision 3 (m8:39-44).
- **Flaw:** `recordPatchSchema` allows `householdId` (m8:311-314) and the comment (m8:314) says "the caller must belong to both the source (if any) and the target household" — but this enforcement lives only in prose ("enforced server-side"), and the patch route task (m8:92 "enforce member permission") does not spell out the *source* check. Two concrete gaps:
  1. **Personal→household leak (own data, but consider shared visibility):** A member can reassign a personal record into a household, instantly exposing it to all other members. That is intended, but there is no check that the record being moved is *the caller's own* personal record — if patch authorization is "is the caller a member of the target household" alone, a member could potentially PATCH another member's already-shared record's `householdId` to a DIFFERENT household they belong to, exfiltrating a shared item out of household X into household Y (where X's other members lose it and Y's members gain it). The "belong to both source and target" rule is stated but the test matrix (m8:105 records-household-scope.test.ts) is described only as "scope + create + patch perms" without an explicit cross-household-reassign-by-non-creator case.
  2. **IDOR on patch target:** The plan never states patch verifies the caller may edit *this specific record* (creator OR member of the record's current household) before honoring a `householdId` change. Decision 3 grants any member edit rights on household records, but a record currently `household_id = NULL` belongs only to its `user_id` (m8:35, m8:44 "Personal records remain private to user_id"). If patch only checks target-household membership, member M of household Y could PATCH victim V's personal record (household_id NULL) — an IDOR — if the record id is known/guessable.
- **Attack scenario:** Member M of households X and Y issues `PATCH /v1/records/{sharedRecordInX} {householdId: Y}`. If only target-membership is checked, the item silently leaves X (other X members lose pantry data) and appears in Y. Or `PATCH /v1/records/{victimPersonalRecord} {householdId: Y}` pulls a stranger's private record into M's household.
- **Evidence:** m8:314 asserts the rule in prose; m8:92 route task does not enumerate the source-ownership/edit-permission check; the integration test description (m8:105) lacks an explicit non-creator-cross-household-reassign negative case. Compare M5 which *explicitly* codes `existing.userId !== req.user!.id → 403` (m5:1415) — M8 patch has no equivalent explicit guard in the plan text.
- **Suggested fix:** In the patch task, explicitly require: caller may edit the record iff (record.householdId IS NULL AND record.userId == caller) OR (caller is a member of record.householdId). AND when changing householdId, caller must be a member of BOTH the current and the target household. Add negative tests for personal-record IDOR and cross-household reassignment by a non-creator member.

---

## Finding 7: M5 deal create accepts arbitrary photoUrl / storeName — stored-XSS and SSRF surface with no host allowlist

- **Severity:** Medium
- **Location:** M5 deal schemas (m5:392-449), create route (m5:1126-1163), API contract.
- **Flaw:** `photoUrl` is validated only as `z.string().url()` (m5:409, m5:446) and `storeName` as trimmed 1–120 chars (m5:394) — no host allowlist, no scheme restriction beyond URL shape, no requirement that photoUrl point at the app's own upload bucket. The plan's note (m5:1181) says the client SHOULD upload via the avatar multipart pattern first then pass the resulting URL — but the server does not ENFORCE that; it accepts any URL the client sends. `storeName`/`note` are free text rendered in the feed card (m5 DealCard) and the admin moderation/report preview (m5:92 ReportPreview).
- **Attack scenario:**
  1. **SSRF/abuse:** Attacker sets `photoUrl` to `http://169.254.169.254/...` or an internal host. Any server-side or admin-side fetch/thumbnailing of that URL (e.g. an image proxy, link-preview, or the admin moderation page eagerly loading the image) becomes an SSRF probe. Even client-only rendering turns the feed into an attacker-controlled-URL beacon (deanonymizing viewers' IPs to attacker's server, tracking).
  2. **Stored content injection:** `storeName`/`note` flow to the React Native feed and the Next.js admin. RN is largely XSS-safe by default, but the **admin** Next.js report/moderation preview (m5:92) renders attacker text — if any `dangerouslySetInnerHTML` or markdown rendering is used there, it is stored XSS hitting an admin session (CSRF token, audit-log powers).
- **Evidence:** m5:409 `photoUrl: z.string().url().nullable()` — no `.refine` host check; m5:446 create accepts same; m5:1181 confirms enforcement is advisory ("the create route accepts the resulting photoUrl"), not mandatory. No allowlist anywhere in the plan.
- **Suggested fix:** (a) Reject `photoUrl` values whose host is not the app's own asset/CDN domain (or drop the field entirely and require the multipart upload path so the server mints the URL). (b) Ensure any server/admin image fetch uses an SSRF-safe fetcher (block private IP ranges, no redirects to internal hosts). (c) Confirm admin previews escape `storeName`/`note` (no raw HTML). Mirror this on M6 `photoUrl`/`title`/`description` (m6:445, m6:433-434) which has the identical pattern.

---

## Finding 8: M8 invite-revoke and member-remove lack idempotency-key coverage parity / race on accept vs revoke

- **Severity:** Medium
- **Location:** M8 conventions (m8:151), invites-accept (m8:981), invites-revoke (m8:983), members-remove (m8:1047).
- **Flaw:** The conventions claim (m8:151) idempotency is required on "invites accept/create/revoke, members remove". Good — but the accept and revoke paths both mutate the same `household_invites` row by `status`, and the accept logic (m8:981) is described as: look up by code → check `status==='pending'` → in a transaction upsert membership + set `accepted`. There is no stated row lock (`SELECT ... FOR UPDATE`) on the invite during accept. A concurrent `accept` (attacker) and `revoke` (owner realizing the link leaked) can interleave: both read `status==='pending'`, accept commits the membership + flips to `accepted`, revoke's `UPDATE ... status='revoked'` then clobbers status to `revoked` while the `household_members` row already exists — leaving a joined member with a `revoked` invite the owner believes blocked them. Conversely two parallel accepts of the same code (race) both pass the `pending` check; the `@@unique(householdId,userId)` (m8:447) saves the *same* user but two *different* users both joining via a single-use code is not prevented by that unique constraint.
- **Attack scenario:** Leaked single-use code shared in a chat; two strangers tap simultaneously. Both reads see `pending`; both transactions insert distinct `household_members` rows (different userIds, so the unique constraint does not collide); invite flips to `accepted` once. Result: TWO unintended members from a "single-use" invite. Owner's later revoke does nothing (already accepted).
- **Evidence:** m8:981 accept logic has no `FOR UPDATE`/conditional `updateMany(where status=pending)` guard described — unlike M7's conversion which explicitly uses a conditional `updateMany(where status='pending')` to win the race (m7:986-990). M8 accept is described as plain read-check-write.
- **Suggested fix:** Make accept atomic: `updateMany({ where: { code, status: 'pending', expiresAt: { gt: now } }, data: { status: 'accepted', acceptedByUserId, acceptedAt } })` and only insert the membership if `count === 1` (mirror M7's proven pattern at m7:986-990). This closes both the double-accept and the accept/revoke race.

---

## Cross-cutting verified-OK (no praise, just to scope the findings)

- M5 vote correctly blocks self-vote (m5:1671 `deal.userId === req.user!.id → 403`) and requires idempotency (m5:1662). The DELETE vote at m5:1688 omits `idempotent` config — minor, delete is naturally idempotent.
- M5 hidden/deleted deals are owner-gated on GET (m5:1295) — correct, no IDOR there.
- M6 `raterRole` is server-inferred, never client-trusted (m6:532, m6:743) — correct.
- M7 conversion idempotency via conditional `updateMany` (m7:986-990) is sound.
- M8 `assertMember`/`assertOwner` helpers (m8:715-731) are correctly applied per route in the task descriptions.

---

## Unresolved questions

1. Is there a server-side or admin-side image fetch of `photoUrl` (proxy/thumbnail/preview)? Determines whether Finding 7 SSRF is live or client-only.
2. Does the admin Next.js report/moderation preview render `storeName`/`note`/`title` as raw HTML/markdown anywhere? Determines Finding 7 stored-XSS severity (Medium→High if yes).
3. Are the spec:525 global rate limits actually wired in M0 (nginx + a Fastify global plugin), or only specified? If only nginx, per-user limits are bypassable by token rotation and Finding 1 worsens.
4. Findings 2, 3, 5 involve product/abuse-policy trade-offs (velocity caps, handoff confirmation, invite bearer-credential model) — these are user decisions per repo rule review-audit-self-decision §3; flagging, not prescribing.
