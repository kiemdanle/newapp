# Mobile Scan Product Creation and Moderation — Phase Completion Review

**Date**: 2026-08-10 23:47
**Severity**: High (structural production risk exposed, mitigated)
**Component**: api (products), apps/mobile (scan/editor), apps/admin (moderation), infra (media pipeline, restore)
**Status**: Completed with live incident recovery

## What Happened

Eight-phase delivery of creator-private product drafts, secure photo uploads, admin moderation, and resumable mobile editors landed on `feature/mobile-scan-product-creation` across July 30–August 10. Implementation: ~40 commits, 5 review cycles, **25+ critical/important/moderate findings discovered and remediated in-session**. Every phase shipped with findings; every finding was re-verified before closure. One structural incident surfaced during verification: production had been down ~6 days because `api/dist/` existed only in `feature/mobile-scan-product-creation`, not in the production `main` checkout — and a well-intentioned test build by dev-2 nearly staged 78 unreleased commits live.

## The Brutal Truth

This was exhausting because every layer discovered real problems. Phase 1 found five CRITICAL/IMPORTANT findings; Phase 3 found two more CRITICALs (decode concurrency gone unbounded, rejected photo bytes served to any user). Phase 4 rewrote the whole moderation state machine mid-execution. Phase 6's admin e2e — the confidence gate — shipped 4 IMPORTANT + 9 MODERATE findings, then flaked under load in final verification. The frustrating part is that **every single finding was legitimate**. There was no "the tool is too strict" — each one was a real failure mode waiting for production to trigger it. Five review cycles and 40 commits to get here means the plan's own risk surface was underestimated, or execution under pressure just surfaces what waterfall hides. Both sting.

The worst part: discovering at final verification that production had been unhealthy for a week. Not caused by this plan, but surfaced by it. And then learning that production **runs arbitrary build artifacts directly from this dev checkout** — meaning a careless build at the wrong git ref silently stages unreleased code without a release gate.

## Technical Details

**Scale**: 8 phases, 25+ findings across 5 review cycles:
- Phase 1: 1 CRITICAL (admin-reject broken), 5 IMPORTANT (moderation leaks, draft patch nulls, one-edit default wrong, migration B incomplete, schema sealing risk)
- Phase 3: 2 CRITICAL (decode concurrency unbounded, rejected photos leaked), 4 IMPORTANT (intent unfenced, capacity-reserve bypassed, HEIC fixture stripped in build)
- Phase 4: 1 CRITICAL (active-revision lock order deadlock), 7 IMPORTANT (stale rebase race, photo cascades, audit gaps)
- Phase 5: 2 IMPORTANT (pre-session drift in migrations, private-image token auth), 7 MODERATE
- Phase 6: 4 IMPORTANT, 9 MODERATE (conflict affordances, media proxies, approve-spec break)
- Phase 7: 1 CRITICAL (concurrent quota explosion), 8 IMPORTANT (sweeper/outbox races, lock timing), 13 MODERATE

**Process inventions under pressure**:
- Per-agent database isolation + explicit `CREATEDB` scratch roles (discovered shared-DB truncation mid-run)
- Pinned `git archive` exports for clean verification (sidestep mutation from concurrent work)
- Pre-fix-fail test proofs before remediation (reproduce first, then fix once)
- Mutation testing on request-shape guards (catch off-by-one in quota/version logic)
- N/M pinned denominators in reports (raw "925 pass" means nothing without the count)
- Explicit-pathspec commits after four staging-race incidents (`git add <file>` not `git add .`)

**Incidents**:

1. **Pre-session migration drift**: Live `pantry` DB in drift with six pre-Phase-1 hand-authored migrations using `gen_random_uuid()` defaults instead of client-side generation. Reconciliation migration added; verified on scratch DB, then real `pantry_test` (team-lead authorized real `prisma migrate deploy`).

2. **Committed production password**: `pantry_app` DB role password rotated live without updating either `/opt/newapp/api/.env` or `/etc/pantry/secrets/api.env`. Discovered mid-P8 verification. Reverted by user; real rotation deferred to deploy.

3. **Production outage (~Jul 31 – Aug 6)**: `api/dist/` deleted from production checkout (`/opt/newapp/api`); production still running `ExecStart=/opt/newapp/api/dist/server.js`. Root cause **predates this plan** (git archive shows it missing weeks back), but discovery during phase verification surfaced the architectural risk. Worse: dev-2's isolated build of the feature branch (to run media-manifest simulation) staged 78 unreleased Phase 1–7 commits live. Restored Aug 10 via explicit user decision (build from `main`). Near-miss: that feature-branch dist almost started serving because config validation initially failed, masking the 78-commit violation.

## What We Tried

- **Incremental test harnesses**: each phase owned focused integration suites, plus regression runs on existing tests (worked — caught seeding/FK issues early)
- **Reviewer-led finding discovery**: assigned reviewers to each phase independently (caught cross-cutting issues Phase authors missed)
- **Remediation + re-verification loop**: fix + second-pass review before closure (every CRITICAL got 2+ re-runs; every IMPORTANT got at least 1)
- **Simulation rigs for infra logic**: restore/cutover/media-manifest validation outside-of-code (caught symlink/traversal/race logic)

## Root Cause Analysis

**Why 25+ findings?** The plan's risk budget assumed phase reviewers would catch most issues. They did — but the *quantity* of issues suggested that either:

1. **Overestimation of review depth**: reading code and tracing one happy path misses concurrency/race/resource-exhaustion branches
2. **Specification precision gap**: plan.md said "fence the intent lease" but showed no locking code; reviewers had to trace to catch it
3. **Production realism**: code that passes unit tests fails under concurrency with shared resources; Phase 3's "concurrency limit" wasn't actually limiting until reviewers ran sharp-counter probes

**Why the production outage?** `api/dist/` is gitignored (correct — artifacts don't ship in git) but production **runs it in-place from the dev checkout** (wrong). Meant as "build once, symlink stable": instead it became "whatever's in the source tree right now, even if 78 commits ahead of release". The real issue: no release artifact store; no "if dist/ is missing, crash loudly with a setup error" guard; no "dist/ must match the running commit hash" assertion.

## Lessons Learned

1. **Concurrency is invisible in unit tests.** A semaphore release + deadline expiry that ships green in isolation (no contention) fails catastrophically under load. Every resource-bounded subsystem needs production-replica load testing, not just unit proofs.

2. **Review cycles are not free.** Each CRITICAL finding reset at least 2 days of downstream work. Planning should explicitly budget 5–7 review cycles and gate production on independent reviewer sign-off, not just "code looks right."

3. **Production artifact storage is infrastructure.** Running build artifacts from the source checkout is not "simple" — it's a landmine. A proper release pipeline stores versioned artifacts with a hash guard and refuses to start if the running version doesn't match the running code.

4. **Migration drift happens silently.** Six pre-Phase-1 migrations drifted because they were hand-authored before Prisma's conventions solidified. Lesson: any migration older than the codebase's Prisma footprint is a candidate for drift. New migrations should use `prisma migrate dev` only.

5. **Secrets in env files are easy to forget about.** The password rotation was an operational oversight (no blame), but the process had no forcing function: no "env files must be updated together" gate, no production health check that validates credentials at startup.

6. **Phase-boundary testing catches integration bugs.** The worst issues (intent fencing, quota bypass, reorder races) only manifested when two phases' commits interacted under pressure. Phases in isolation looked okay. Integrate early and under load.

## Next Steps

1. **Production artifact store** (blocking any release): build on explicit revision + store in `/var/lib/expyrico/releases/`, symlink `current`, validate hash at startup
2. **Rotate `JWT_ACCESS_SECRET`** (found identical to `.env.example` placeholder during P8 secrets audit — token-forgery vector)
3. **Provisioned missing env keys before deploy** (`MEDIA_ROOT`, `MEDIA_PUBLIC_BASE_URL`, 3× reCAPTCHA keys)
4. **Real backup + restore drill** on live paths after artifact store is in place (P8 ran simulations only)
5. **Production outage post-mortem** (when/how/why `api/dist` was deleted — unrelated to this plan but same box)

---

## Acceptance Criteria Status

| Criterion | Status | Evidence |
|---|---|---|
| Barcode/QR conclusiveness | ✅ Verified | lookup-v2 state machine tested; `temporarily_unavailable` distinct from `not_found` |
| Private draft lifecycle + submission | ✅ Verified | `products-draft-lifecycle.test.ts` 15/15; idempotency proven |
| Photo pipeline + VPS media isolation | ✅ Verified (with CRITICAL fixes) | Hostile upload + capacity + reorder tests; decode concurrency bounded after Phase 3 remediation |
| Moderation + active-product revisions | ✅ Verified (with CRITICAL fixes) | Admin mutation audit logged; stale-revision race + lock order fixed |
| Mobile editor + native reCAPTCHA | ✅ Verified (device-partial) | Jest 302/302; Android native build succeeds; iOS external limitation noted |
| Admin console e2e | ⚠️ Partial | 21/26 deterministic (5 environmental flakes under load 15); `suspend-user` margin issue pre-existing |
| Full suite + device proof | ✅ Verified (code-layer) | 925/925 api, 88/88 shared, 302/302 mobile; device legs user-gated |
| Restore + paired cutover | ✅ Verified (simulation) | 19/19 cutover scenarios; 3/3 manifest verifications; real drill user-gated |

---

## Unresolved Questions

1. When was `api/dist` deleted from production, and by whom? (Predates phase execution but surfaced here)
2. Is the production checkout meant to build artifacts in-place (current unsafe behavior) or pull from an artifact store? (Architectural decision needed before next deploy)
3. Should CI gate on "no dist/ commits" given current gitignore, or on "dist/ hash matches running code" if we switch to versioned storage?
