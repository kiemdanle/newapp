# Red Team Review — M5–M8 (Adjudication + Consistency Sweep)

**Date:** 2026-05-26
**Scope:** The four new milestone plans `2026-05-26-m5-deal-sharing.md`, `-m6-blessing-giveaway.md`, `-m7-referral-and-app-sharing.md`, `-m8-household-sharing.md`.
**Method:** 4 hostile reviewers (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic), each attacking all four plans with plan file:line evidence (greenfield — no code to grep). 35 raw findings → evidence filter (all passed) → dedup → 15 adjudicated. All 15 accepted; applied per user decisions.
**Reviewer reports:** `...-red-team-security-adversary-m5-m8-plan-review-report.md`, `...-failure-mode-analyst-...`, `...-assumption-destroyer-...`, `...-scope-complexity-critic-...`.

## User decisions
- Apply all 15 accepted findings.
- Referral anti-abuse: **velocity cap + abuseFlag fix** (no payment escrow; points cosmetic).
- Household invite: **owner-approval join requests** (leaked link ≠ access).
- M7 points: **keep append-only ledger + balance** (single `awardPoints` helper + invariant); drop unused enum values.

## Findings & dispositions

| # | Sev | Finding | Disposition | Applied to |
|---|-----|---------|-------------|-----------|
| 1 | Critical | Debounced recalc workers (deal-score, reputation) drop last event + over-built | Accept | M5, M6 — **workers removed**, synchronous in-txn recompute |
| 2 | Critical | M8 household scope-change/dissolve break sync (leak + silent loss) | Accept | M8 — re-filter echoed changes by current visibility; scope-change = explicit conflict |
| 3 | Critical | Postgres `ALTER TYPE ADD VALUE` used in adding txn | Accept | M5, M6 — enum add in own migration |
| 4 | Critical | M7 referral point-farming; abuseFlag only trips on zero conversions | Accept (velocity cap) | M7 — per-day cap, IP/device clustering, fixed flag |
| 5 | High | New mutation/vote routes lack per-route rate limits | Accept | M5, M6 |
| 6 | High | M8 record PATCH cross-household reassignment IDOR | Accept | M8 — explicit edit-permission predicate + negative tests |
| 7 | High | M8 invite = bearer credential to household PII | Accept (owner-approval) | M8 — request→owner-approve model |
| 8 | High | M8 invite accept race admits two members | Accept | M8 — atomic conditional approve, single-use |
| 9 | High | M7 conversion never fires for offline-first first record + field mismatch | Accept | M7 — hooks create AND sync paths; field reconciled; reconciliation sweep |
| 10 | High | M7 app-share assumes universal-link infra planned nowhere | Accept (code-scope) | M7 — scoped to copyable referral CODE; universal links = future |
| 11 | High | M6 reputation farmable: unilateral completion, no handoff confirm, retaliatory + PII-leaking ratings/claims; non-atomic push (stuck giveaway) | Accept | M6 — two-phase handoff (recipient confirm-received), pickup-note privacy, blind mutual ratings, transactional outbox + auto-expiry, counterparty-weighted reputation |
| 12 | High | M5+M6 both edit runner.ts/getAllQueues → silent non-registration | Accept (dissolved) | Resolved by #1 (workers removed → no registry edits) |
| 13 | High | M8 multi-household sync seq-scan + no local eviction | Accept | M8 — composite sync-cursor index + WatermelonDB purge on leave/dissolve |
| 14 | Medium | M5/M6 photoUrl SSRF + storeName/note stored-XSS | Accept | M5, M6 — CDN host allowlist, no server-side fetch, escaped admin preview |
| 15 | Medium | Cleanup bundle (selectedClaimId, currency, points helper/enum, FK dissolve, computed expiry, dead enum, admin API task, test merge) | Accept | M5–M8 distributed |

**Rejected:** none (all evidence-backed).

## Whole-Plan Consistency Sweep
- Files reread/grepped: M5, M6, M7, M8 (+ cross-checked M1/M2/M3 unaffected).
- Decision deltas checked: worker removal, enum-migration split, M6 `selectedClaimId`→derived, M8 invite→owner-approval, M7 enum trim, photoUrl restriction, rate limits.
- Reconciled stale references: 0 outstanding — removed-worker mentions are explicit "synchronous now" notes; no milestone re-registers a deleted queue; M3 queue-health unaffected; M8 invite model fully owner-approval (no `acceptedBy`/"anyone with code" survivors); M7 enum carries only written values.
- **Unresolved contradictions: 0.**

## Residual notes (not blockers)
- M7 self-flag: exact `POST /v1/records` + `/records/sync` payload shapes must be reconciled with M1's real contracts at wiring time.
- Universal/app-links deferred (M7 share is code-entry based for now); revisit if auto-open-from-chat is desired.
- Referral points are cosmetic; if they ever become spendable, the ledger is already forward-compatible.
