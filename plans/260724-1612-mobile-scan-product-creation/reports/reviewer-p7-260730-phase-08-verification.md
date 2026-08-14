# Phase 8 verification gate — end-to-end rollout readiness

Reviewer: reviewer-p7 · Date: 2026-07-30 · Branch: `feature/mobile-scan-product-creation` · Tip: `8cf0d5e`

Status: **PARTIAL — BLOCKED on a live production credential issue found mid-run (see B1).**

Constraints honoured throughout: production (ports 4000/4001, `pantry` DB, live nginx/redis/systemd) never
written to; all verification on disposable databases and a private Redis index; clean-clone work in a
`git archive` export at the tip. No source files modified.

---

> **UPDATE 2026-08-06.** B1 is **RESOLVED** — the user reverted the `pantry_app` password to the old value
> (true rotation deferred to deployment, tracked in #43). Re-tested read-only: **3/3 AUTHENTICATES** at
> 2026-08-06T10:11:52Z. The three previously-blocked gates have now run; see §7.
>
> **However, a separate and larger problem surfaced on re-check: production has been DOWN for ~6 days.** See
> §8. It is unrelated to B1 and was not caused by any commit in this plan.

## B1 — RESOLVED (was: production risk): `pantry_app` password rotated without updating either env file

Not a code defect and not caused by any commit — an operational state I hit while running the suite matrix.

Evidence:

| Check | Result |
|---|---|
| `DATABASE_URL` line in `/opt/newapp/api/.env` vs `/etc/pantry/secrets/api.env` | **byte-identical** (sha `f3b846a798cd`) |
| That password vs what I recorded hours earlier | **unchanged** (sha `bb416e4cc5dd984a`) |
| Authenticating with it now | **REJECTED 3/3** — `FATAL: password authentication failed for user "pantry_app"`, via both connection URL and `PGPASSWORD` |
| `pantry_app` role | exists, `canlogin=true`, no expiry — a valid password exists, just not in either file |
| `/etc/pantry/secrets/api.env` mtime | `2026-07-22 03:02` — not touched today |
| Production now | `/health` → 200, surviving on **one idle** `pantry_app` connection opened `14:14:09` |
| `pantry-api` unit | active, pid 1600852, started 02:51:50, `EnvironmentFile=/etc/pantry/secrets/api.env` (the stale one) |

Impact: production is up only because an existing pooled connection predates the rotation. Any restart,
redeploy, `systemctl reload`, or pool expansion fails authentication → full outage. It will look healthy right
until a deploy triggers it — and a deploy is exactly what this phase precedes.

I made no change: credential reconciliation is user-owned (#43), I cannot read the new value, and both
possible directions (update the env files vs. reset the role password) are operator decisions.

This also blocks every DB-dependent gate below.

---

## 1. Clean-clone verification — PASS

`git archive` of the tip into `/tmp/p8clean`, then `pnpm install --frozen-lockfile` from scratch (exit 0).

| Gate | Result |
|---|---|
| `packages/shared` build / typecheck / test | PASS / PASS / PASS (88/88) |
| `api` db:generate / typecheck / build | PASS / PASS / PASS |
| `api` prisma validate | PASS **with** `DATABASE_URL` set; fails without it (see F1) |
| `apps/admin` typecheck / lint / build | PASS / PASS / PASS |
| `apps/mobile` typecheck / lint | PASS / PASS |
| **API boots from the clean build** | PASS — `dist/server.js` on 127.0.0.1:4123, **zero** error-level log lines |
| Route smoke on the clean-clone build | `/health` 200 · `/health/ready` 200 · `/health/operational` 200 · `/.well-known/assetlinks.json` 200 · `/v1/products/lookup-v2` 401 · `/v1/admin/products/pending` 401 · `/v1/products/drafts` 401 |

The 401s are the correct result — auth is enforced on every protected route. This is the guard that caught the
unbootable-HEAD incident, and the branch passes it end to end.

**F1 (MODERATE) — `prisma validate` cannot pass on a fresh clone without env.** The phase-08 spec lists it as a
bare gate command, but it resolves `env("DATABASE_URL")` and exits 1 with `P1012` when unset. CI must export a
`DATABASE_URL` (even a dummy) for that step, or the gate fails for a reason unrelated to schema validity.

**F2 (USER-GATED, not a gap) — the live `.env` lacks 5 required keys.** The clean-clone boot initially failed
config validation on `MEDIA_ROOT`, `MEDIA_PUBLIC_BASE_URL`, `RECAPTCHA_PROJECT_ID`,
`RECAPTCHA_SITE_KEY_ANDROID`, `RECAPTCHA_SITE_KEY_IOS`. All five are present in `api/.env.example` and
documented in `infra/README.md` as required `api.env` keys; all five are **absent from this box's live
`.env`**. Boot succeeds once supplied. This is the phase's own "provision before API startup" requirement — a
deployment prerequisite the operator must complete, alongside B1.

---

## 2. Full suite matrix

| Workspace | Result | Notes |
|---|---|---|
| `api` full vitest | **925/925 pass, 109/109 files**, exit 0, 232.8s | own DB + private Redis index |
| `packages/shared` | **88/88**, 5 files | |
| `apps/mobile` jest | **302/302**, 61 suites, 16 snapshots | matches the documented 302 baseline exactly |
| `apps/admin` unit (vitest) | **35/35**, 7 files | |
| Vendored-dist drift guard | exit 0 — "vendored dist matches a fresh build" | |
| `apps/admin` e2e (Playwright, 26) | **BLOCKED** (B1) | needs DB |
| `restore-cutover-simulation.test.sh` | **BLOCKED** (B1) | needs DB; was 19 PASS / exit 0 earlier today at `77b3e57` |
| `media-manifest-verify-db-refs-simulation.test.sh` | **BLOCKED** (B1) | needs DB |
| `api lint` | not a gate — script is `echo skip` | reported, not pretended |

**Honest note on an earlier API sample.** My first full-suite sample showed 29 failures across
`product-edits`, `products-draft-lifecycle`, `products-schema` (`Error: Revision not found`). Those three files
then passed **94/94 in isolation**, and a second full-suite sample was **925/925 green**. Cause was my own
overlapping background run sharing the scratch database — `tests/helpers/setup.ts` truncates ~30 tables before
every test, so two concurrent runs against one DB corrupt each other. Not a regression, and not attributable to
any commit. Recording the mechanism because it is the same hazard the per-run DB isolation rule exists for.

---

## 3. Secrets assertion — 1 genuine failure

Compared every key present in both `api/.env` and `api/.env.example`, asserting secret-bearing keys differ.
Values never printed.

| Key | Verdict |
|---|---|
| **`JWT_ACCESS_SECRET`** | **FAIL — production value is identical to the committed `.env.example` placeholder** (34 chars). Anyone with the repo can forge access tokens for this box. |
| `DATABASE_URL`, `TOTP_ENCRYPTION_KEY`, `APPLE_KEY_ID`, `FIREBASE_CREDENTIAL_MODE` | ok — differ from example |
| `REDIS_URL` | matched, but **not a secret** — no embedded credential, host/port/db only. False positive from the keyword heuristic. |
| `REFRESH_TOKEN_TTL_DAYS` | matched, but **not a secret** — numeric TTL. False positive from the `TOKEN` keyword. |
| `GOOGLE_APPLICATION_CREDENTIALS` | **escapes the gate entirely** — present in `.env`, absent from `.env.example`, so no comparison is possible. It holds a path, not a secret, but the coverage hole is real. |

Reporting 1 genuine failure rather than 3, because inflating a security count on keyword matches would be
misleading. Recommend the assertion ship as a CI check with an explicit secret-key allowlist rather than a
name-pattern heuristic, and that every secret-bearing key be represented in `.env.example`.

---

## 4. Deferred-migration dry check — PASS

`api/prisma/deferred-migrations/20260730040000_classify_report_hidden_products`, tested against a scratch DB
with every case wrapped in `BEGIN … ROLLBACK`. Never applied to any real database; the directory remains
outside `api/prisma/migrations/` (verified after the run).

| Preflight condition | Expected | Got |
|---|---|---|
| `product_creation.mode` ≠ `off` | ABORT | ABORT ✓ |
| pending row has `submitted_at` | ABORT | ABORT ✓ |
| pending row has `moderated_at` | ABORT | ABORT ✓ |
| pending row has `version > 1` | ABORT | ABORT ✓ |
| pending row has `product_photos` | ABORT | ABORT ✓ |
| clean legacy pending row (happy path) | APPLY | APPLY ✓ — row becomes `report_hidden` |

Post-rollback the scratch DB held 0 product rows, confirming nothing persisted. The 6th condition (non-legacy
`product_edits`) is present in the SQL but **untested** here — seeding it needs more fixture scaffolding than
the rolled-back method gave cheaply; calling that out rather than implying full coverage.

Two of my first-pass results were initially wrong (`submitted_at` and `product_photos` appeared not to abort)
— both were my own seed statements failing FK and check constraints, not preflight defects. Corrected seeds
show both abort correctly. Noting it because the first table would have been a false accusation.

The README's execution procedure (`git mv` back, review, `psql -f`, then `prisma migrate resolve --applied`,
never `migrate deploy`) matches the file's own header and the gating rationale.

---

## 5. Static / contract audit — PASS

| Check | Result |
|---|---|
| `git diff --check` | clean |
| Private keys / AWS keys in tracked files | none |
| Bearer token in a URL or query string | 0 hits |
| nginx `alias` outside the public tree | 0 real directives (all 5 grep hits are comment lines; the only directive is `{{ media_root }}/public/$uri`) |
| Report auto-hide writing creator `pending` | 0 hits |
| Direct `process.env` outside `config.ts` | 1 — `workers/runner.ts:18`, a test-only `RUN_WORKERS` guard behind `getConfig().env === 'test'`. Acceptable; noted for completeness. |
| Private media route auth | `requireAuth` on `/:productId/photos/:photoId/:variant` |

---

## 6. Whole-plan acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Barcode local/external/miss/unavailable; QR local miss conclusive | VERIFIED | `products-lookup.test.ts`, `lookup.test.ts`; my own I5 probe drove the `off`-mode path with both providers stubbed |
| 2 | Scanner never routes errors/outages into creation | VERIFIED | `temporarily_unavailable` path in `products-draft-lifecycle.test.ts`; mobile `lookup-v2` state machine (#29, reviewer-p5) |
| 3 | Creator can create/resume one draft per identifier, identifier immutable | VERIFIED | `products-draft-lifecycle.test.ts`; my M1 route-level concurrency probe (`[201,409,409,409]`, cap respected) |
| 4 | Others cannot enumerate private metadata/media; report-hidden distinct | VERIFIED | `products-visibility.test.ts`, `products-private-media.test.ts`, `products-report-autohide.test.ts` |
| 5 | No submission bypass via REST / record PATCH / duplication / offline sync | VERIFIED | Phase 7 review: `Product.status='pending'` written in exactly one place, always behind a server assessment; `product-use-authorization.test.ts`, `records-sync.test.ts` |
| 6 | 0–5 ordered photos with independent progress/retry/remove/reorder/cover | VERIFIED | `products-photo-routes.test.ts`, `products-photos.test.ts`; mobile editor (#38) |
| 7 | Upload validation, containment, quotas, version guards, cleanup survive fault/concurrency | VERIFIED | `product-media-*` suites; my I1/I2 atomic-quota and C1 sweep-race repros |
| 8 | Submission idempotent → `pending` → continues into `AddRecordForm` | VERIFIED (API) / USER-GATED (device leg) | `products-draft-lifecycle.test.ts` submit + idempotency; the on-device continuation needs the physical run |
| 9 | Admin approve/request-changes/correct/reorder/merge/rebase/supersede with atomic audit | VERIFIED | `admin-product-moderation.test.ts`, `admin-product-merge.test.ts`, `product-edits.test.ts`, `audit-log.test.ts`; reviewer-p6 sign-off |
| 10 | Revisions work while creation is `off`; request-changes resumable | VERIFIED | My own mode matrix: `POST /products/:id/edit` → 201 and admin moderation → 200 under `off` |
| 11 | Prepared intents recover process death; caches/parent-bound delivery prevent leakage | VERIFIED | `product-media-outbox-crash.test.ts`, `product-media-publication.test.ts`; my I7 poller drain with BullMQ absent |
| 12 | Nginx exposes only approved public media; backup/restore staging + paired cutover; quarantine excluded | VERIFIED (logic) / USER-GATED (real host) | My disposable-nginx probes (symlink 404, dotfile 404, traversal 404/400, headers present, 413) and 6-scenario cutover fault injection. A real systemd-host drill remains user-gated |
| 13 | Abuse assessment server-side; quotas protect VPS capacity | VERIFIED | `product-creation-assessment.test.ts` (mutation-tested request-shape guard), `product-creation-abuse.test.ts`, my I1/I2 probes |
| 14 | Full shared/API/mobile/admin checks pass; Android device passes; iOS reported truthfully | **PARTIAL** | shared 88/88, API 925/925, mobile 302/302, admin unit 35/35 green (§2); admin e2e **25/26** with one deterministic failure, `suspend-user` (§7a); Android device + iOS USER-GATED |

Summary: **12 VERIFIED, 2 PARTIAL** (#8's device leg and #14's e2e + device legs). No criterion is
unverifiable for reasons internal to the code; both partials are environmental or user-gated, not defects.

Both simulation harnesses that were blocked by B1 have now run green (§7), so criterion 12's in-session half
is fully closed.

### USER-GATED items (cannot be closed in-session, by design)

- Android physical-device flow; iOS build (known external toolchain limitation — to be reported truthfully, not
  asserted).
- reCAPTCHA site-key provisioning in Google Cloud + a real token mint.
- Live infra apply: Redis `noeviction`, CDN vhost + certbot, systemd timers, the UMask-pinned unit.
- First real backup + restore drill on real paths.
- Credential reconciliation (B1) and rotation (#43).
- The 5 missing `.env` keys (F2) and `JWT_ACCESS_SECRET` (§3).

---

## 7. Final gate results (2026-08-06, after B1 was resolved)

| Gate | Result |
|---|---|
| `restore-cutover-simulation.test.sh` | **19 PASS, exit 0** |
| `media-manifest-verify-db-refs-simulation.test.sh` | **3 PASS, exit 0** — matching manifest exits 0; incomplete manifest exits non-zero; foreign-key manifest exits non-zero |
| `apps/admin` e2e (Playwright, 26) | **FINAL: 25/26** on a quiet box — one deterministic failure, `suspend-user` (see §7a) |

### §7a — Admin e2e: three samples, and the one real failure

Final run on the restored, quiet box (load 3.48): **25 passed / 1 failed of 26**, 3.8 min. The only failure is
`suspend-user.spec.ts:13`.

| Sample | Box state | Result | Failures |
|---|---|---|---|
| A | load 15.11 (crash-loop) | 21/26 | login:7, merge-product:14, moderate-report:13, product-moderation:128, **suspend-user** |
| B | load 15.11 (crash-loop) | 16/26 | product-moderation:163/201/236/252/265/274/300/309/320, **suspend-user** |
| C | load 3.48 (restored) | **25/26** | **suspend-user** |

Everything except `suspend-user` was load-induced and is now proven so: those failures are disjoint between A
and B and all pass in C. That half of my earlier caution resolves cleanly.

**`suspend-user` is a genuine, deterministic failure — 3/3 across a 4× load range — and I am correcting my own
earlier framing of it.** In the previous revision I attributed it to the documented margin story. That is no
longer defensible: the failure is not a timeout on a slow path, it is a value that never changes.

```
Expected: "suspended"
Received: "active"
Timeout 60000ms exceeded while waiting on the predicate
```

The spec polls `GET /v1/admin/users/:id` for a full 60 s, re-clicking `Suspend` each iteration, and the status
never leaves `active`. The mock is not at fault — `mock-admin-handlers.ts` implements
`PATCH /v1/admin/users/:id` and does mutate `user.status`. The UI does render a `Suspend` button
(`users/[id]/user-actions.tsx:55`) calling `patchUserAction(id, { status: 'suspended' })` behind a
`window.confirm`, which the spec accepts via a dialog handler. So the UI → server-action → API path is not
firing in this environment.

Two things follow. First, the spec's own comment — "both failures' page snapshots already showed
'Reactivate'/'suspended', proving the suspend action itself always succeeds; only the margins were too tight"
— does not match what I observe. Second, **#44's R11 fix did not make this spec pass**; widening the timeout
changed a fast failure into a slow one.

I am deliberately *not* classifying it further. From this evidence I cannot separate a test defect (locator,
dialog, or hydration timing) from a real defect in the suspend action, and guessing would be worse than
scoping it honestly. It needs one focused debugging pass — trace is at
`test-results/suspend-user-.../trace.zip`. Scope is admin e2e only; no other suite touches this path.

<details><summary>Superseded first-pass reasoning (kept for audit)</summary>

Before the box was restored I recorded the following, which samples A and B alone supported:

**Admin e2e cannot be given a trustworthy verdict while the box is in its current state, and I am not
reporting the failures as regressions.** Two full 26-test runs produced *disjoint* failure sets:

- Run A — 21 passed / 5 failed: `login:7`, `merge-product:14`, `moderate-report:13`,
  `product-moderation:128`, `suspend-user`.
- Run B — 16 passed / 10 failed: `product-moderation:163,201,236,252,265,274,300,309,320`, `suspend-user`.
- Intersection: **`suspend-user` only.** Every other failure passed in the other run.

All failures are timeouts, and the mechanism is measurable: 1-minute load average **15.11** (5-min 11.64),
well into the ≳10 regime where this box's timing-sensitive suites are known to trip. A concrete, ongoing
contributor is the production crash-loop in §8 — `pantry-api` has restarted **101,885** times, roughly once
every 5 seconds for ~6 days, each cycle paying Node startup cost. An earlier run taken while the box was even
more degraded scored 1/26, which is how far this moves.

`suspend-user` is the exception: it failed in **both** runs, and its own spec comments already document this
exact history ("the margins were too tight for this box's load"), mitigated with `test.slow()` and a 60 s
`toPass` poll. It is still tripping *with* those widened margins at load 15. Honest attribution: consistent
with the documented margin story rather than a new defect, but it is no longer covered by the existing
mitigation and warrants a look once the box is quiet.

Recommendation: re-run this gate once §8 is fixed. A green 26/26 on a quiet box is cheap; a verdict taken at
load 15 is not worth recording.

</details>

That re-run has now happened and is reported above: the load half resolved, the `suspend-user` half did not.

## 8. Production outage (discovered 2026-08-06, unrelated to this plan)

`pantry-api` and `pantry-admin` have been crash-looping for ~6 days (`NRestarts` 101,885 and climbing; ports
4000/4001 dead). Root cause reproduced, not inferred: running the unit's own `ExecStart` with its own
`EnvironmentFile` yields `Error: Cannot find module '/opt/newapp/api/dist/server.js'` — **`api/dist/` had been
removed**. `dist/` is gitignored, so production runs the build artifact directly out of this repo checkout.
Onset ≈ 2026-07-31, the day after this branch's last verified-healthy observation.

**A naive `pnpm --dir api build` is unsafe here.** The checkout sits on `feature/mobile-scan-product-creation`,
**78 commits ahead of `main`**, and systemd retries every 5 s — so the moment `dist/server.js` appears,
production starts running unreleased code without a release decision. As of this writing a
**feature-branch-built `dist/` is staged in the production path** (created 2026-08-06 10:25:32; confirmed to
contain the Phase 7 symbol `getOperationalHealthStatus`). It is not serving only because config validation
still fails on the 5 unprovisioned env keys from F2. Escalated; left in place rather than deleted, because
removing a teammate's deliberate fix would be worse than leaving a non-serving artifact. I disclosed to the
lead that I cannot fully rule out my own isolated-export build as its cause.

Safe restoration is a release decision, not an incident reflex: pick the intended production revision (`main`
or the last released tag), build from that in a separate checkout, provision the F2 keys, then restart.

### §8a — Closing addendum (2026-08-10)

**Restoration outcome — RESOLVED.** Production was restored from `main` (`ac2a486`) on 2026-08-10 by explicit
user decision, executed by the team lead: a scratch export of `ac2a486`, clean builds, and an atomic swap into
the production paths, which also replaced the hazardous staged feature-branch artifact. Verified independently
at the time of writing: `pantry-api` **active**, `/health` **200**; `pantry-admin` **active**, `:4001` **307**;
`NRestarts` static at 153,512 (loop stopped). I re-checked that no unreleased code shipped — the Phase 7
symbol `getOperationalHealthStatus` is absent from the deployed `dist/` entirely, consistent with a `main`
build. Total outage ≈ 2026-07-31 → 2026-08-10.

**Staged-dist attribution — RESOLVED, not mine.** The feature-branch `dist/` staged at 10:25:32 on 2026-08-06
was dev-2's, self-disclosed: a `pnpm build` run to satisfy the manifest harness, without knowing production
runs its artifact out of this same checkout. My isolated-export discipline held; the 84-second timestamp
proximity to my own export build was coincidence. Recording this because I raised the possibility against
myself in the original escalation, and the record should not be left ambiguous.

**Final admin e2e number — 25/26.** Independently reproduced: my quiet-box run (§7a, load 3.48) and dev-2's
isolated run agree exactly. My two load-15 samples (21/26 and 16/26) are correctly classified as
environmental, caused by the crash loop documented above.

*One attribution point remains open.* The accepted team position is that the single failure is dev-1's
documented and accepted `suspend-user` margin. My evidence does not support a margin explanation and I am
recording that rather than silently conceding it: the failure is `Expected "suspended" / Received "active"`
after a full 60 s poll with a re-click each iteration — a value that never changes, not a deadline that is
narrowly missed, and it reproduced identically at load 15 and load 3.5. A margin failure would show the status
flipping late or the page snapshot showing "Reactivate"; neither occurred in my runs. This does not block the
plan and I am not re-opening it as a finding — but whoever next touches the admin console should spend one
pass on the trace (`apps/admin/test-results/suspend-user-.../trace.zip`) before treating the spec as green,
because if it is not a margin then #44's widened timeout has masked rather than fixed it.

**Standing recommendation — stop running production from the dev checkout.** `ExecStart` still points at
`/opt/newapp/api/dist/server.js`, inside the working tree that agents build, clean, and switch branches in.
That single fact is what made this incident class possible, and it remains true after the restore: any
`pnpm --dir api build` on the feature branch still re-stages unreleased code into the production path, and any
`dist/` removal still takes production down. A separate, immutable release directory (`/opt/expyrico/releases/<sha>`
with a `current` symlink, `ExecStart` pointing at `current`) eliminates all three failure modes seen here —
the 6-day outage, the accidental feature-branch staging, and the crash-loop load that made the e2e gate
unreadable. Strongly recommended before general rollout.

## Recommended order

1. **B1** — reconcile the DB credential. Production is exposed *now*, independent of this branch.
2. **`JWT_ACCESS_SECRET`** — replace the placeholder on this box; it is a token-forgery vector.
3. **F2** — provision the 5 documented keys before any deploy, or the API will not start.
4. Re-run the three blocked gates (admin e2e, both simulation harnesses) once the DB is reachable.
5. F1 — give CI a dummy `DATABASE_URL` for the `prisma validate` step.
6. Ship the secrets assertion as a CI check with an explicit allowlist, and add
   `GOOGLE_APPLICATION_CREDENTIALS` to `.env.example` so nothing escapes it.

## Unresolved questions

1. B1 direction — update both env files to the new password, or reset the role password to the current env
   value? The first is correct if rotation was intentional; the second only if it was accidental.
2. Was `/etc/pantry/secrets/api.env` meant to be updated by the rotation, and is anything else on the box
   (backup cron, admin app) authenticating with the same credential?
3. Deferred-migration condition 6 (non-legacy `product_edits`) — worth a fixture so the abort matrix is
   complete, or accepted as covered by inspection?
