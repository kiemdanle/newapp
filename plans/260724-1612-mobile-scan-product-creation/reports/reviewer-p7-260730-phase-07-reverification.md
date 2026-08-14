# Phase 7 re-verification — API (#30) and infra (#33) remediation

Reviewer: reviewer-p7 · Date: 2026-07-30 · Branch: `feature/mobile-scan-product-creation`

Re-verifies dev-3's remediation of `reviewer-p7-260730-phase-07-api-review.md` (1 CRITICAL, 8 IMPORTANT,
13 MODERATE) and `reviewer-p7-260730-phase-07-infra-review.md` (2 CRITICAL, 6 IMPORTANT, 14 MODERATE).

Commits re-verified — #30: `be2f9a4`, `08b1394`, `d4b5741`, `e952e73`, `7785806`, `5c89362`.
#33: `3dda8c4`, `49b198f`, `b2790bf`, `2c48579`, `385358d`, `ad7ff9c`, `651f6bd`, `77b3e57`.

Method, to the bar published before dev-3 committed:
1. Every original repro re-run at the fixed tip, from a `git archive` export pinned at `77b3e57` with
   `packages/shared` rebuilt from the export's own source.
2. dev-3's new regression tests overlaid on a second export pinned at the **pre-fix** commit (`7561dcf`) and
   confirmed to FAIL there.
3. Hunted what the fixes *introduced*, not only what they closed.

Disposable resources only: own databases (`pantry_p7rv`, `pantry_p7pre`, `p7live*` — all dropped), private
Redis indexes 8 and 9 (flushed), disposable nginx on port 18444 with its own prefix (stopped, port released).
Live nginx (pid 1570565, predates this session), Redis, systemd, and ports 4000/4001 untouched. No source
modified; all scratch files removed.

## Verdict

**#30 API — CLEAN.** All 9 findings re-verified closed, plus M1/M5/M8/M10/M11. Two residuals, neither a
re-opened defect (**R1** documentation, **R2** a red CI gate).

**#33 infra — CLEAN on every finding, but blocked by one NEW CRITICAL the remediation introduced (R3): the
live production database password is committed to the repository.**

---

## R3 — CRITICAL (new, introduced by `3dda8c4`): live production DB credential committed

`infra/scripts/restore-cutover-simulation.test.sh:34`

```bash
DB_URL_BASE="${SIM_DB_URL_BASE:-postgresql://pantry_app:<REDACTED>@127.0.0.1:5432}"
```

The embedded password is byte-identical to the live `pantry_app` password in `api/.env` — verified by
comparing SHA-256 digests without printing either value (both `bb416e4cc5dd984a…`). The file is tracked, and
`git log -S` attributes its introduction to `3dda8c4`, part of this remediation. It is the only tracked file
in the repository containing that secret (swept the whole tree against every long value in `api/.env`; the
other matches are non-secret config such as domains and project IDs).

This violates three separate project rules simultaneously:

- `CLAUDE.md` Security Mandates — "NEVER commit .env files, API keys, tokens, or credentials"
- `.claude/rules/development-rules.md` — "Never commit secrets, dotenv files, tokens, private keys, database
  credentials, or personal data"
- `plan.md` global constraint — "No `.env`, credentials, media files, absolute local paths, or raw uploads
  enter git/logs"

The `${SIM_DB_URL_BASE:-…}` override already exists and works — I ran both simulation harnesses passing
`SIM_DB_URL_BASE` explicitly, so the default is not needed for the harness to function.

**Required:** remove the default (make `SIM_DB_URL_BASE` mandatory, `: "${SIM_DB_URL_BASE:?…}"`), **and treat
the credential as compromised and rotate it** — it is in git history, so deleting the line is not sufficient.
Rotation touches `api/.env`, the deploy pipeline, and `/etc/pantry/secrets/*`, so this needs an operator
decision rather than a code fix alone.

---

## #30 API — finding-by-finding

| Finding | Verdict | Evidence at the fixed tip |
|---|---|---|
| **C1** sweep deletes a product that left `draft` mid-sweep | CLEAN | Original mutate-from-spy repro: `sweep={"scanned":1,"deleted":0,"skippedReferenced":1}`, product survives as `pending`. Delete is now `deleteMany` re-checking `status`+`updatedAt` under `SELECT … FOR UPDATE` |
| C1 control (did the fix over-correct?) | CLEAN | Genuinely abandoned draft still collected: `deleted:1` |
| **I1** non-atomic byte quota | CLEAN | 8 concurrent reservations at 100 bytes headroom → **1/8 admitted**, redis total 1000 = cap. Was 8/8 and 1700/1000 |
| **I2** failed uploads unmetered | CLEAN | Failed upload after 7777 streamed bytes charges **7777**; failure before any byte read charges **0** |
| **I3** unfenced cleanup lock | CLEAN | Successor's lock survives run-1's exit (`run-2-token` intact). Token + Lua CAS release + 20s renewal |
| **I4** `.env.test.example` unparseable | CLEAN | All three `RECAPTCHA_*` keys present in both `.env.example` and `.env.test.example` |
| **I5** gate ran after external lookup | CLEAN | mode `off` → `403 feature_disabled` with **lookupOff=0, upcitemdb=0** outbound calls |
| **I6** admin cohort split across call sites | CLEAN | internal-mode admin: eligible=true, PATCH 200, SUBMIT 200. Non-allowlisted user still 403. Under `off`, admin eligible=false and the photo route no longer exempts them — converged, not reopened |
| **I7** no BullMQ-independent poller | CLEAN | `startIndependentOutboxPoller` alone drained a pending cleanup row with no queue/worker/repeatable job: bytes removed, outbox `["completed"]` |
| **I8** empty-name draft reaches pending | CLEAN | `400 validation_error`, row stays `draft`; whitespace-only also rejected; a named draft still submits 200 → `pending` |
| **M1** count-then-create draft cap | CLEAN | Route-level, 4 concurrent `POST /drafts` with 1 slot free → `[201,409,409,409]`, final active drafts = 2 = cap. (`pg_advisory_xact_lock` is taken by the caller, so a direct call to the assert function is the wrong seam — tested at the route) |
| **M5** unpinned assessment request shape | CLEAN + mutation-tested | The new test passes at pre-fix (correct — M5 was a test gap, not a source defect), so I mutation-tested it: swapping `siteKeyFor`'s two branches makes exactly that test fail. Genuine guard |
| M8 / M10 / M11 | CLEAN | Their tests for open-edit states, `delete_public` labelling, and `updatedAt`-based staleness all fail at pre-fix; M11 re-verified directly (31-day-old but recently-edited draft preserved) |
| **M2** no daily-creation counter | accepted, **see R1** | Not re-flagged — the decision stands |
| **M13** fresh token per retry | CLEAN | Contract statement present at `phase-05-mobile-scan-and-draft-editor.md:92` ("tokens are single-use/short-lived") |

**Pre-fix overlay (the load-bearing check):** dev-3's new tests overlaid on an export pinned at `7561dcf`
produce **25 failures** across C1, I1, I2, I3, I5, I6, I8, M1, M8, M10 and II1 — every guard genuinely fails
on the unfixed code.

**Fixed tip:** 174/174 pass across the 9 affected suites (`product-media-cleanup`, `product-creation-abuse`,
`product-creation-mode`, `products-draft-lifecycle`, `product-media-freeze`, `product-operational-health`,
`product-media-outbox`, `product-creation-assessment`, `config`).

### R1 — MODERATE: M2's "documented deliberate non-fix" is not documented anywhere

I was asked to verify the documentation rather than re-flag the finding. The decision itself is reasonable and
I am not re-opening it — but the documentation does not exist. Searched the plan directory, `docs/`, every
commit message in `7561dcf..77b3e57`, and the source comments in `product-creation-quotas.ts` /
`product-drafts.ts`: no mention of the daily-creation-counter rationale, the `pending`-frees-a-slot
consequence, or the delete/recreate cycling tradeoff. A future maintainer reading the quota module cannot
discover that the gap is intentional. One short comment in `assertWithinActiveDraftQuota` would close it.

### R2 — MODERATE: the vendored-dist drift guard is RED at the tip

`node scripts/check-vendored-shared-dist.mjs` exits **1** at `77b3e57`, reporting drift in
`schemas/admin/products.d.ts`, `schemas/admin/system.d.ts`, `schemas/error.d.ts`, `schemas/product.d.ts`,
`schemas/record.d.ts`.

The drift is **not load-bearing**: I compared the whole dist — **0 of 25 runtime `.js` files differ**; only
5 `.d.ts` files do. The cause is intra-line union-member reordering, e.g.

```
- status: "active" | "draft" | "pending" | "changes_required" | "report_hidden" | "merged_into";
+ status: "draft" | "pending" | "changes_required" | "active" | "report_hidden" | "merged_into";
```

The guard's normalizer sorts trimmed lines, which cancels *property* reordering but cannot cancel reordering
*within* a line. So the gate blocks on exactly the noise class it was written to tolerate. Two valid fixes:
re-vendor (`pnpm --dir packages/shared build && rsync -a --delete …`), or harden the normalizer to also sort
union members. Either way the gate must be green before this lands.

---

## #33 infra — finding-by-finding

**IC1 / IC2 — CLEAN.** I re-transcribed the fixed cutover block and `cutover_rollback` verbatim and re-ran my
own fault injection against disposable databases, one failure per run:

| Injected failure | Live DB ends as | Live media ends as | Exit | Verdict |
|---|---|---|---|---|
| none | RESTORED-BACKUP-DB | RESTORED-BACKUP-MEDIA | 0 | full cutover ✓ |
| first `ALTER DATABASE` | ORIGINAL-PRODUCTION-DB | ORIGINAL-PRODUCTION-MEDIA | 1 | full rollback ✓ |
| second `ALTER DATABASE` | ORIGINAL-PRODUCTION-DB | ORIGINAL-PRODUCTION-MEDIA | 1 | full rollback ✓ |
| `mv` live media aside | ORIGINAL-PRODUCTION-DB | ORIGINAL-PRODUCTION-MEDIA | 1 | full rollback ✓ |
| `mv` staged media in | ORIGINAL-PRODUCTION-DB | ORIGINAL-PRODUCTION-MEDIA | 1 | full rollback ✓ |
| post-cutover health check | ORIGINAL-PRODUCTION-DB | ORIGINAL-PRODUCTION-MEDIA | 1 | full rollback ✓ |

Never a mixed pair, in any scenario — versus two silently-mismatched-and-reported-successful outcomes before.
Each step is now an explicit `if ! step; then cutover_rollback; exit 1; fi` rather than an `errexit`-suppressed
`{ … } || { … }` group, and `cutover_rollback` handles all three reachable database states and all three media
states, restarting `pantry-api` only when both landed back on a matched pair.

**Their harness's "fails 5 ways at pre-fix" claim — VERIFIED** on my own export. Running
`restore-cutover-simulation.test.sh` against the pre-fix `restore.sh` (`a057e62`) fails exactly five ways:
the `} || {` group shape is still present; `cutover_rollback` is not called from independent per-step guards;
`after-both-renames` leaves the database unmatched; `neither-db-exists` restarts `pantry-api` despite an
incomplete rollback; and two distinct `GENERATION_ID`s collide on one staging DB name. At the fixed tip the
same harness is 19 PASS / exit 0, and `bash -n` is clean on both scripts (ShellCheck is not installed here).

| Finding | Verdict | Evidence |
|---|---|---|
| **II1** freeze didn't cover sweeps/outbox | CLEAN | Verified during a *live* freeze flag: independent poller deletes nothing across ~30 ticks and drains immediately once released; stale-draft sweep `deleted:0` under freeze, `deleted:1` after release; quarantine sweep also skipped |
| **II2** no DB row-reference cross-check | CLEAN | New `verify-db-refs` does set-equality **both** directions (`missingFromManifest` + `extraInManifest`), wired into `restore.sh:275` with `DATABASE_URL="$STAGING_DB_URL"` — it checks the *staged* database, which is the point |
| **II3** unfenced/unrenewed freeze | CLEAN | `SET … 'NX'` + random token + token-guarded Lua renew/release; `backup.sh` renews on an interval comfortably under the 900s TTL and releases by token in its trap |
| **II4** fixed staging DB name | CLEAN | `STAGING_DB_NAME="${LIVE_DB_NAME}_staging_${GENERATION_ID//-/_}"`; harness asserts two runs don't collide |
| **II5** nginx could read private/quarantine | CLEAN | Redesigned: `private/`+`quarantine/` `0700` (no group/other bits at all), `public/` owner `app_user` group `www-data` mode `02750`, root `0751` (traverse, no listing). The `www-data`→`app_group` membership task is gone. I verified the non-obvious part empirically — setgid genuinely propagates the group to runtime-created subdirectories and files |
| **II6** no post-cutover health gate | CLEAN | `wait_for_healthy()` polls the new unauthenticated liveness route with a bounded timeout; failure triggers the same full rollback (verified in the table above) |
| **IM1** symlink escape | CLEAN | `disable_symlinks on` — `/products/symlinked-private/secret.webp` now **404** (was 200 `SECRET-PRIVATE-BYTES`) |
| **IM2** dotfiles served | CLEAN | `location ~ /\.` deny — `/products/.hidden.webp` now **404** (was 200) |
| **IM3** HSTS/Referrer-Policy dropped | CLEAN | Both now present on real image responses, measured with `curl -sI`, alongside nosniff/Cache-Control/`image/webp` |
| **IM4** `client_max_body_size 0` | CLEAN | Now `1k`; 20 MB POST → **413** (was accepted) |
| Controls | CLEAN | Real public file still 200; traversal (plain and encoded) still 404 |
| **IM5/IM6** rates + alerting path | CLEAN | All three rate thresholds now computed and folded into `overall`; unauthenticated `/health/operational` returns bare `{status}` and 503 on critical |
| **IM7** cross-filesystem `mv` | CLEAN | `STAGING_MEDIA_ROOT="${MEDIA_ROOT}.restore-staging-${GENERATION_ID}"` — a sibling, same filesystem by construction |
| **IM8** regex URL surgery | CLEAN | Structural parsing replaces the `sed -E` substitution |
| **IM9/IM10/IM13** manifest CLI | CLEAN | Missing files collected and reported instead of crashing; `relative(resolve(mediaRoot), path)` replaces the trailing-slash-fragile `slice`; uniform shuffle |
| **IM11** duplicate task / group reload | CLEAN | Both resolved as a side effect of II5's redesign — the no-op task and the `user:` module task are gone, so no nginx restart is needed |
| **IM14** single bypass var | CLEAN | Cutover gate now has its own `RESTORE_CONFIRM_CUTOVER` |

### R4 — MODERATE: the new unauthenticated liveness route does a filesystem walk it cannot use

`/health/operational` calls the full `getOperationalHealth()`, which includes `oldestQuarantineAgeMs()` — a
`readdir` of the quarantine root plus a `stat` per entry — and two Prisma queries, then returns only
`{ status }`. Quarantine age is **not** an input to the `overall` computation
(`product-operational-health.ts:167-178`), so that filesystem walk cannot affect the response. It is reachable
unauthenticated; the global limiter does apply (the `allowList` only exempts `/.well-known/`), so this is
bounded per-IP rather than unbounded, but it is avoidable work on a public endpoint. Cheapest fix: give the
liveness variant a status-only computation, or memoize the payload for a few seconds.

Also worth recording as an accepted tradeoff rather than a defect: the route lets an unauthenticated caller
learn *when* the system is degraded, which is precisely when a disk-pressure attack is most effective. That is
the minimum disclosure needed for external alerting and I agree with the call, but it should be a conscious
one.

### R5 — MODERATE (low): II5's correctness depends on an unpinned umask

The `public/` setgid design gives `www-data` the right *group*, but whether runtime-created files are
group-*readable* depends on the service umask. `pantry-api.service.j2` sets no `UMask=`, so it inherits
systemd's default `0022` and the design works (dirs `2755`, files `0644` — verified by construction). A future
hardening pass adding `UMask=0027` or `0077` — plausible, since the unit already carries other hardening
directives — would silently make every new public photo unreadable by nginx and the CDN would 403 on new
content only. Pin `UMask=0022` explicitly in the unit with a comment pointing at the setgid design.

---

## Summary

| Lane | Findings closed | Residuals |
|---|---|---|
| #30 API | 1 CRITICAL, 8 IMPORTANT, 13 MODERATE — all verified | R1 (undocumented accepted decision), R2 (red drift gate) |
| #33 infra | 2 CRITICAL, 6 IMPORTANT, 14 MODERATE — all verified | **R3 CRITICAL (committed live DB password)**, R4, R5 |

The engineering quality of both remediations is high: the fixes address root causes rather than symptoms
(token-fenced locks reusing the existing lease pattern, an atomic Lua reserve/reconcile pair, explicit per-step
error handling with a three-state rollback), the regression tests genuinely fail on unfixed code, and the two
`.sh` simulation harnesses are a durable addition — they encode the verbatim-transcription method as a
repeatable gate rather than a one-off review artifact.

**Blocking before this lands:** R3 (remove the default *and* rotate the credential) and R2 (drift gate green).
R1, R4 and R5 are follow-ups that do not need to block.

## Unresolved questions

1. R3 rotation scope — the password is in git history. Does rotating `pantry_app` require coordinating
   `api/.env`, `/etc/pantry/secrets/*`, the deploy workflow, and any operator bookmarks in one window, and is
   history rewriting on the table or is rotation alone the accepted mitigation?
2. R2 — re-vendor the dist, or harden the guard's normalizer to sort union members? The second is the more
   durable fix but changes a gate other lanes depend on, so it may belong to whoever owns task #26.
