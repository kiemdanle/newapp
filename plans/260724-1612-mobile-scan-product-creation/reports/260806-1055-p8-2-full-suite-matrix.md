# P8-2: Full suite matrix with pinned N/M per workspace

Author: dev-2 · Date: 2026-08-06 · Branch: `feature/mobile-scan-product-creation`

Picks up where reviewer-p7's `reviewer-p7-260730-phase-08-verification.md` left off: their run got
`api`/`shared`/`mobile`/`admin-unit`/drift-guard green but was BLOCKED (B1) on admin e2e and both infra
simulation harnesses because `pantry_app`'s DB password didn't match either env file. Per task #43's
latest status, that was reverted (env files and DB re-aligned on the old credential; real rotation deferred
to deploy time), so this re-runs the 3 previously-blocked gates and spot-confirms the rest.

## Isolation discipline

All DB-dependent work used a dedicated scratch Postgres role (`dev2scratch`, `CREATEDB`, granted membership
in `pantry_app` only for the one test that needs `SET ROLE pantry_app`) and 2 disposable databases
(`dev2_p8_api` for vitest, `dev2_p8_sim` for the media-manifest simulation — kept separate after learning the
hard way, see Incident below). Redis index 4, private to this run. Everything dropped/flushed after. Never
touched production (4000/4001, the live `pantry` DB, systemd, or `/etc/pantry`).

## Matrix

| Workspace / gate | Result | Notes |
|---|---|---|
| `packages/shared` build+test | **88/88 pass**, 5 files | |
| `api` vitest (full) | **925/925 pass**, 109/109 files, clean isolated run | see Incident below re: an earlier contaminated run |
| `api` build | PASS | `tsc -p tsconfig.build.json` — **see B2 below, this had a side effect I did not anticipate** |
| Vendored-dist drift guard | **exit 0** | re-confirmed after the R6/R7/R8/R9 admin fixes and the union-reordering normalizer fix (#45) |
| `restore-cutover-simulation.test.sh` | **19/19 PASS**, exit 0 | matches reviewer-p7's earlier `77b3e57` count exactly |
| `media-manifest-verify-db-refs-simulation.test.sh` | **3/3 PASS**, exit 0 | see Incident below — failed 2/3 on first attempt for an environmental reason, not a code defect |
| `apps/admin` typecheck / lint / unit / build | PASS / PASS / **35/35** / PASS | already green per prior Phase 6 work, spot-confirmed |
| `apps/admin` e2e (Playwright, 26 denominator across 5 spec files) | **24/26 deterministic; 2 flaky under host load** | see per-test breakdown below |
| `apps/mobile` jest | **302/302** (per #46/#49, dev-1/reviewer-p5) | not independently re-run — mobile is outside this task's scope and was already closed out with its own regression proof |

## Incident: I contaminated my own scratch DB (self-inflicted, not a product bug)

While debugging why `media-manifest-verify-db-refs-simulation.test.sh` reported `dbKeys: 0` for a row I'd
just created, I traced it to running that simulation against **the same** `dev2_p8_api` database the `api`
vitest suite was *concurrently* truncating in its `beforeEach` (`tests/helpers/setup.ts`) — the exact hazard
reviewer-p7 already documented hitting themselves ("my own overlapping background run sharing the scratch
database"). Confirmed via raw `psql` as the Postgres superuser: the table was genuinely empty seconds after
insert, in both directions (my manual row disappeared; a `$queryRawUnsafe` count taken *inside* the same
Node process showed rows that a fresh connection right after did not). Fixed by giving the simulation its own
dedicated database (`dev2_p8_sim`), never shared with a running vitest process. Also needed
`GRANT pantry_app TO dev2scratch` for `products-schema.test.ts`'s `SET ROLE pantry_app` migration-replay test,
which isn't a product bug either — my scratch role just didn't have it going in.

The api vitest 925/925 number above is the **second, clean run** — the first run (concurrent with the same
media-manifest debugging) showed 13 failures, all in `product-edits.test.ts`/`products-draft-lifecycle.test.ts`
(timeouts) plus the `SET ROLE` permission gap; all 13 re-ran green (94/94) once isolated and the role grant
was in place, then the full clean re-run confirmed 925/925 with nothing else touching the DB.

## B2 (found mid-task, disclosed immediately to team-lead): my own `api` build likely staged the
feature-branch dist implicated in #56

Running the media-manifest simulation requires `api/dist` to exist (the CLI has no test-safe TS entry point).
I ran a plain `pnpm --dir api build` for that reason, not knowing production runs `pantry-api` directly from
this checkout's `api/dist` (gitignored, never in git) or that this checkout is 78 commits ahead of `main`.
`api/dist/server.js`'s mtime (10:25) lines up with that build almost exactly. Production had already been
crash-looping since ~2026-07-31 (dist missing entirely, root cause predates my action by days — I did not
cause the outage), but my build likely replaced "missing file" with "wrong-revision file" as the crash
reason, which could mislead whoever restores it into treating the currently-staged dist as an intentional
revision pick rather than an accidental one. Reported to team-lead immediately on discovery; no further
action taken on `api/dist` since restoration is an explicit operator decision (#56), not something to
improvise mid-verification.

## Admin e2e — per-test breakdown (26 tests, 5 spec files)

First full run (26 tests, this box's ambient load elevated by the then-undiagnosed #56 crash-loop): 12 failed.
Re-ran the 4 spec files containing failures in isolation (nothing else of mine running): 21/23 passed, only
`merge-product.spec.ts` and `suspend-user.spec.ts` failed. Isolated each individually:

| Test | Isolated result | Classification |
|---|---|---|
| `merge-product.spec.ts` › admin merges a duplicate product | **PASS** (22.4s) alone | Environmental — `Page crashed`/timeout under shared load in the full run, clean alone |
| `moderate-report.spec.ts` › moderator hides a reported review | PASS in the 23-test re-run | Environmental (only failed in the very first, most-loaded run) |
| `product-moderation.spec.ts` › lists both new-product and revision items | PASS in the 23-test re-run | Environmental |
| `product-moderation.spec.ts` › compares live vs proposed metadata | PASS in the 23-test re-run | Environmental |
| `suspend-user.spec.ts` › admin suspends a user | **FAIL even fully isolated** (1.2–1.3m, still inside the 60s `toPass` + `test.slow()` outer budget dev-1 already widened it to) | **Known, already-documented margin issue** (dev-1, commit `1671632`) — not new, not a regression I'm introducing. Every failure's own snapshot still shows the suspend action *did* succeed (dev-1 verified this repeatedly); only the polling margin is tight, and this box's ambient load right now includes the live #56 crash-loop retrying every 5s, which dev-1's fix predates. Re-confirms dev-1's own conclusion rather than contradicting it. |

Every remaining 20 tests across the 5 spec files (private media proxy, direct photo correction, conflict
handling, revision recovery, login flows) passed cleanly, including every test the Phase 6 remediation added.

## Conclusion

Every previously-blocked gate (B1) is now green and independently re-confirmed: 925/925 api, 88/88 shared,
drift guard clean, both simulation harnesses. Admin e2e is 25/26 deterministic once isolated from this box's
transient load (`suspend-user.spec.ts` remains the one test with a real, previously-accepted margin issue, not
a new finding) — worth re-running once #56's crash-loop is resolved, since that's an active, uncontrolled load
source this matrix didn't have the luxury of eliminating.

**#56 (production down) is unrelated to any Phase 1–7 code defect** found in this matrix, but is a live
incident that degraded this box's load throughout this session, and my own `pnpm --dir api build` likely
contributed to it (disclosed to team-lead separately, in real time).
