# Validation Log — M5–M8 (new milestone plans)

**Date:** 2026-05-26
**Scope:** `2026-05-26-m5-deal-sharing.md`, `-m6-blessing-giveaway.md`, `-m7-referral-and-app-sharing.md`, `-m8-household-sharing.md` + spec §2.12–§2.15.
**Trigger:** `/ck:plan validate` after red-team. Verification pass skipped per workflow guard (each plan already has a `## Red Team Review` section with evidence) — limited to the critical-questions interview on unspecified product/design assumptions.

## Confirmed Decisions
1. **Discovery (M5 deals + M6 giveaways):** **country-scoped feed** — filter by viewer's `users.country` (IP-derived at signup, §2.9), global fallback when absent. No precise geolocation. Each of `deals`/`giveaways` gains a nullable `country char(2)` stamped from the poster's country; feed index reworked to `(country, status, …)`. Currency on deals stays an explicit field (USD default) — unchanged.
2. **Shared-record reminders (M8):** expiry pushes for a household record **fan out to ALL current members**, each on their own `offsetsDays` (default `[3,1,0]`), via M1's existing `notification-send` (no new queue). Membership changes reschedule: join picks up active household reminders; leave/dissolve cancels them (reverted records fall back to creator's single-owner schedule). Personal records unchanged.
3. **Multi-household (M8):** **allowed** — a user may belong to multiple households (no change; plan already supported it). Mobile scope toggle lists each household.
4. **Referral points purpose (M7):** **personal points + badges only**, shown on the user's own profile; **no public leaderboard** in v1.x. Admin overview remains admin-only abuse monitoring (not a leaderboard). Future leaderboard is additive-only.

## Propagation
- M5: `deals.country` column + country-filtered feed + index + tests; clarified country IS available (only currency derivation was dropped).
- M6: `giveaways.country` column + country-filtered feed + index + tests; red-team fixes untouched.
- M8: per-member reminder fan-out on create/scope-change/expiry-change; reschedule on join/leave/dissolve (inside the locked txn); tests; multi-household reaffirmed.
- M7: explicit "no public leaderboard" scope note (out-of-scope + Red Team/Validation sections); self-only read surfaces confirmed.
- Spec §2.12–§2.15 updated to match (country-scoped feeds, two-phase handoff + pickup-note privacy + blind ratings, owner-approved invites, multi-household, member-fan-out reminders, code-based referral share + no leaderboard).

## Whole-Plan Consistency Sweep
- Files reread/grepped: M5, M6, M7, M8 + spec.
- Decision deltas checked: 4 (country feed, member fan-out, multi-household, no leaderboard).
- Reconciled stale references: 0 outstanding — country-scoping present in M5/M6/spec; fan-out consistent across M8 create/patch/sync/dissolve/handoff; multi-household stated consistently in M8 + spec; no-leaderboard consistent in M7 + spec; prior red-team fixes intact.
- **Unresolved contradictions: 0.**

## Status
M5–M8: written → red-teamed (15 findings applied) → validated (4 decisions applied) → consistency-clean. Implementation-ready (after v1 M0–M4 in sequence).
