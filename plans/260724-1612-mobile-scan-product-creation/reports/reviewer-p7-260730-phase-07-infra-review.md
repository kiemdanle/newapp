# Phase 7 infra-tail review — freeze, backup/restore, CDN vhost, health endpoint

Reviewer: reviewer-p7 · Date: 2026-07-30 · Branch: `feature/mobile-scan-product-creation`

Scope: `a057e62` (backup-freeze primitive + staged backup/restore), `4087a6d` (media dir provisioning +
CDN vhost), `8520c4c` (operational health endpoint). Companion to
`reviewer-p7-260730-phase-07-api-review.md`, which covered the first four Phase 7 commits. Reviewed at the
commits, not the working tree (dev-3 is concurrently remediating task #30 in `api/src`).

Verification: disposable nginx 1.24 on `127.0.0.1:18443` with its own prefix (never `/etc/nginx`, never the
live service — confirmed live master pid 1570565 untouched and port released); disposable Postgres databases
`p7live*` for the cutover simulation (dropped); no systemd, redis, or live nginx changes.

Counts: **2 CRITICAL, 6 IMPORTANT, 14 MODERATE.**

---

## CRITICAL

### IC1 — `set -e` does not apply inside restore.sh's cutover block, so every failure except the last step is silently ignored and the script reports success

`restore.sh:214-236` wraps the cutover in `{ …five steps… } || { cutover_rollback; exit 1; }`. Under POSIX/bash
semantics, `errexit` is suppressed for every command inside a compound command on the left-hand side of `||`.
The group's exit status is that of its **last** command only. Confirmed on this host (bash 5.2.21):

```
  step 1 ok
  step 2: FAILING NOW
  step 3 STILL RAN (errexit suppressed inside an || left-hand side)
  step 4 ok (group exit status = this command = 0)
handler_ran=0 ; script continued to the end normally      # script exit=0
```

So a failure in `pg_terminate_backend`, either `ALTER DATABASE … RENAME`, or `mv "$MEDIA_ROOT"` does not stop
the cutover, does not trigger `cutover_rollback`, and does not fail the script. I transcribed the cutover block
and `cutover_rollback()` verbatim into a simulation against disposable databases and media dirs, injecting one
failure at a time:

| Injected failure | Live DB ends as | Live media ends as | Script reported |
|---|---|---|---|
| none (baseline) | RESTORED-BACKUP-DB | RESTORED-BACKUP-MEDIA | success ✓ correct |
| `ALTER DATABASE live RENAME` fails | **ORIGINAL-PRODUCTION-DB** | **RESTORED-BACKUP-MEDIA** | **success** |
| `mv $MEDIA_ROOT` aside fails | **RESTORED-BACKUP-DB** | **ORIGINAL-PRODUCTION-MEDIA** | **success** |
| `mv staged media` into place fails | RESTORED-BACKUP-DB | ORIGINAL-PRODUCTION-MEDIA | failure (see IC2) |

Rows 2 and 3 are exactly the state the phase file forbids — "never leave production pointing at unpromoted
bytes" — reached silently, with `systemctl start pantry-api` executed and `cutover complete. Rollback copies
retained: … media /tmp/p7sim/media.rollback-sim` logged even though that rollback media root **does not
exist** in row 3. Row 3 also leaves a stray nested `$MEDIA_ROOT/media/` (the second `mv` landed *inside* the
still-present live root).

Row 2 compounds with the EXIT trap: the second rename also failed silently, so `$STAGING_DB_NAME` still
exists, and `cleanup_staging` then runs `DROP DATABASE IF EXISTS "$STAGING_DB_NAME"` — **destroying the
restored data** while production runs on the original DB paired with restored media. Verified:

```
  before trap — databases: p7live, p7live_restore_staging
  after  trap — databases: p7live
  live db holds: ORIGINAL-PRODUCTION-DB
  live media holds: RESTORED-BACKUP-MEDIA
```

Fix: do not rely on `errexit` inside an `||` group. Either check each step's status explicitly
(`if ! psql …; then cutover_rollback; exit 1; fi`) or set an explicit `CUTOVER_STEP` variable before each step
and use a single `trap … ERR` with `set -E`. Also make the "rollback copies retained" log conditional on those
paths actually existing.

### IC2 — `cutover_rollback`'s database branch is guarded on a condition that is always false after a successful pair of renames

`restore.sh:199-206`:

```bash
if psql … "SELECT 1 … datname='$ROLLBACK_DB_NAME'" | grep -q 1; then
    if ! psql … "SELECT 1 … datname='$LIVE_DB_NAME'" | grep -q 1; then      # <-- never true here
        psql … "ALTER DATABASE \"$ROLLBACK_DB_NAME\" RENAME TO \"$LIVE_DB_NAME\";"
```

By the time the only reliably-reached failure point (the final `mv "$STAGING_MEDIA_ROOT" "$MEDIA_ROOT"`) fires,
both renames have already succeeded, so `$LIVE_DB_NAME` **does** exist — it is the staging database. The inner
guard is therefore false and the database rollback is skipped entirely, while the media branch rolls back
successfully. Verified end state for that scenario:

```
  live db name holds: RESTORED-BACKUP-DB
  live media holds:   ORIGINAL-PRODUCTION-MEDIA
  databases:          p7live, p7live_rollback-sim
```

`cutover_rollback` then calls `systemctl start pantry-api` unconditionally (`restore.sh:208`), starting
production on that mismatched pair, and the script exits 1 with "rollback attempt finished — verify service
health before trusting it".

Fix: the rollback must first rename the newly-promoted DB back out of `$LIVE_DB_NAME` (to `$STAGING_DB_NAME`),
then rename `$ROLLBACK_DB_NAME` back into place; and it must not start `pantry-api` unless both resources were
restored to a matched pair.

---

## IMPORTANT

**II1 — The freeze does not cover the two sweeps that mutate media references, so the backup boundary is not
actually consistent.** Every `withMediaMutationLease` call site at `a057e62` is in `product-photos.ts`,
`product-moderation.ts`, or `product-edits.ts`. Neither `processMediaOutboxOnce`
(`product-media-outbox.ts`) nor `sweepStaleProductDrafts`/`sweepStaleQuarantine`
(`product-media-cleanup.ts`) takes a lease, yet the phase file names "prepared-intent recovery, and
outbox/sweeper cleanup" among the paths freeze must cover. The cleanup job ticks every 60 s, so a backup
reliably overlaps one. Concretely: `pg_dump` (T1) → manifest generate (T2) → `tar` (T3); a stale-draft sweep at
T1.5 deletes product/photo rows, so the manifest at T2 omits keys the dump at T1 still references. Restore-time
`verify` only checks manifest→files (see II2) and passes, and the restored database ends up referencing photos
that are absent from the archive. Fix: route both sweeps through `withMediaMutationLease`, or have them check
`isMediaFreezeActive()` and skip the tick.

**II2 — `verify` never cross-checks database row references; it only checks manifest→file.**
`media-manifest-cli.ts` touches Prisma solely in `collectReferencedKeys()`, called only by `generate`
(`:86`). `verify` (`:104-116`) reads the manifest JSON and checksums files. The phase requires the restore to
"verify checksums/**row references** … before … cutover". As written, a `db.dump` paired with a *foreign*
manifest+tar validates cleanly — and the restic path makes that reachable, since `restic restore` extracts
whatever the snapshot holds and `FOUND_DB=$(find "$STAGING_DIR" -name db.dump -print -quit)` (`restore.sh:118`)
picks an arbitrary one. Fix: after restoring into staging, re-run `collectReferencedKeys()` against the
**staging** database and assert set-equality with the manifest's keys.

**II3 — The freeze flag is unfenced, unrenewed, and offers no mutual exclusion between backup runs.**
`product-media-freeze.ts:53` acquires with `set(FREEZE_KEY,'1','EX',900)` — no `NX`, so a second backup
silently "acquires" a freeze already held and resets its TTL; `:66` releases with an unconditional
`redis.del(FREEZE_KEY)`, so whichever run finishes first unfreezes the other. There is no heartbeat, so a
backup whose capture exceeds the 15-minute TTL silently loses the freeze mid-`tar` while believing it holds it.
This is the same unfenced-lock defect as I3 in the API review. The manifest-vs-tar verification at
`backup.sh:160-168` limits the blast radius to an aborted backup in the common case, but the invariant the
phase actually requires ("no DB-referenced key changes between completed drain and manifest capture") is not
enforced. Fix: `SET … NX` with a unique token, compare-and-delete release, and renew the TTL while the capture
runs.

**II4 — The staging database name is fixed, so any run's EXIT trap drops a concurrent run's staging database.**
`restore.sh:71` sets `STAGING_DB_NAME="${LIVE_DB_NAME}_restore_staging"` while the staging *directory* is
already uniquified via `GENERATION_ID` (`:68`). `cleanup_staging` (`:88`) unconditionally runs
`DROP DATABASE IF EXISTS "$STAGING_DB_NAME"` — including when the script aborts early for an unrelated reason
(missing `db.dump`, failed decrypt, operator declining a confirmation). Two operators restoring concurrently,
or one re-running after an abort, destroy each other's staged data; this is also the mechanism that deletes the
restored database in IC1 row 2. Fix: `STAGING_DB_NAME="${LIVE_DB_NAME}_staging_${GENERATION_ID//-/_}"`.

**II5 — nginx is granted filesystem read access to the private and quarantine trees, not just public.**
`infra/roles/app/tasks/main.yml` creates `{{ media_root }}`, `private/`, `private/products/`, `public/`,
`public/products/`, `quarantine/` all as `owner=app_user group=app_group mode=0750`, then adds `www-data` to
`app_group`. Mode `0750` grants the group `r-x`, so `www-data` can read **every** tree, including
`private/products/` and `quarantine/`. The task's own comment claims the opposite ("Group-readable + nginx
added to the app group is enough without loosening the private tree's permissions"), and the phase file
requires "nginx read permission only on public tree". Nothing leaks today because the CDN vhost aliases only
`public/`, but the filesystem backstop behind that single `location` block is gone. Fix: keep
`private/`+`quarantine/` at `0700` (or a group `www-data` is not in) and give only `public/` a group
`www-data` can read.

**II6 — No post-cutover health check and no rollback on health failure.** `restore.sh:238-242` starts
`pantry-api` and immediately logs "cutover complete". The phase file requires retaining rollback pointers
"until post-cutover health succeeds" and lists "health-check failure" as one of three fault paths that must
each preserve the prior paired generation. That path is entirely unimplemented — there is no probe of
`/health`, no timeout, and no automatic revert. Fix: poll the health endpoint after restart and run the (fixed)
rollback on failure.

---

## MODERATE

**IM1 — A symlink inside `public/products/` escapes the public namespace; `disable_symlinks` is unset.**
Proven against the rendered template on a disposable nginx:
`/products/symlinked-private/secret.webp -> 200 SECRET-PRIVATE-BYTES`. Not a live vulnerability (all path
segments are server-generated UUIDs, so the API never creates a symlink) but this is the one unauthenticated
surface and the plan rates "CDN private leak" Critical-impact. Add `disable_symlinks on;` (or `if_not_owner`).

**IM2 — Dotfiles under `products/` are served.** `/products/.hidden.webp -> 200 DOTFILE-BYTES`; the regex
`^/products/.+\.webp$` matches a leading dot and there is no `location ~ /\.` deny. The phase file asks for
"deny dot/temp/private/quarantine".

**IM3 — HSTS and Referrer-Policy are absent on every actual image response.** nginx's `add_header` in a nested
block replaces the entire inherited set, and the `location ~ ^/products/…` block declares its own. Measured:

```
  Strict-Transport-Security    ** ABSENT **     (present on the catch-all 404)
  Referrer-Policy              ** ABSENT **     (present on the catch-all 404)
  X-Content-Type-Options       nosniff
  Cache-Control                public, max-age=31536000, immutable
```

dev-3 reasoned about this inheritance rule for `Content-Type` but not for the two server-level security
headers. Repeat both inside the location block.

**IM4 — `client_max_body_size 0` means *unlimited*, the opposite of the stated intent.** The comment reads "No
client uploads land here". Measured: a 20 MB POST is accepted (405/404 after the body is read); the same config
with `client_max_body_size 1k` returns 413. Set a small limit.

**IM5 — Three of the eight spec'd alert thresholds are config-only with zero consumers.**
`HEALTH_ASSESSMENT_FAILURE_RATE_PERCENT`, `HEALTH_API_5XX_RATE_PERCENT`,
`HEALTH_UPLOAD_REJECTION_RATE_PERCENT` are parsed into `config.health` (`config.ts:210-212, 379-381`) but
`grep` finds 0 non-config references, and `OperationalHealthPayload.thresholds` omits all three. Task 7's
"assessment provider failures >5%/15m; API 5xx >2%/15m; upload validation rejection >25%/15m" is unimplemented
while the config makes it look shipped.

**IM6 — The health endpoint cannot drive the alerting Task 7 describes.** It is admin-gated (correctly — via
`adminOnlyPlugin`, and the payload leaks no paths or internal state, so the brief's information-leak question
is clean) and always returns 200, even when `status: 'critical'`. Task 7 says "UptimeRobot/systemd checks alert
non-2xx or stale timestamps", but UptimeRobot cannot present an admin bearer token and would never see a
non-2xx. Either add an unauthenticated liveness variant with no detail, or document that alerting must use
keyword monitoring with a credential.

**IM7 — The media cutover `mv` is likely cross-filesystem, and therefore neither atomic nor fast.**
`STAGING_MEDIA_ROOT` lives under `BACKUP_LOCAL_DIR` (default `/var/backups/pantry`) while `MEDIA_ROOT` is
`/var/lib/expyrico/media`. If those are separate filesystems, `mv` degrades to copy+unlink; a mid-copy failure
leaves a partial `$MEDIA_ROOT`, which then defeats `cutover_rollback`'s `! -d "$MEDIA_ROOT"` guard. Stage the
media inside the same filesystem as `MEDIA_ROOT`.

**IM8 — Database URLs are derived by regex substitution on the connection string.**
`restore.sh:65,171` use `sed -E "s#/${LIVE_DB_NAME}(\?|$)#…#"`. This breaks on any URL where the database name
also appears earlier (credentials, host, path) and silently produces a wrong target. Parse the URL properly, or
build the maintenance/staging URLs from discrete components.

**IM9 — One orphaned database reference permanently breaks every backup with an unhandled stack trace.**
`generate` (`media-manifest-cli.ts:86-95`) calls `sha256File` on every referenced key with no per-key error
handling, so a single row pointing at a missing file rejects, `main().catch` prints a stack, exit 2, and
`backup.sh` aborts. Fail-safe in direction but brittle in practice — and the API review's C1 sweep race can
create exactly this state. Collect missing keys into a reported list and decide explicitly.

**IM10 — `path.slice(mediaRoot.length)` breaks if `MEDIA_ROOT` has a trailing slash.**
`media-manifest-cli.ts:93` slices the *unnormalized* argument length off a `resolve()`d path, so
`MEDIA_ROOT=/var/lib/expyrico/media/` yields relative paths off by one character and `verify` then reports every
entry missing. Use `relative(resolve(mediaRoot), path)`.

**IM11 — A duplicate no-op Ansible task, and a group change a reload cannot pick up.** "Ensure the public media
tree is readable by the nginx worker" sets exactly the same `owner/group/mode` the preceding loop already
applied, so it does nothing its name claims. Separately, supplementary group membership is read at process
start, so adding `www-data` to `app_group` needs an nginx **restart**; the role only notifies "Reload nginx",
leaving the CDN 403ing until someone restarts it manually on first apply.

**IM12 — restic driver is under-specified.** `backup.sh` runs `restic forget --keep-daily 7 --keep-weekly 4
--keep-monthly 3 --prune` with no `--tag`/`--host` filter, so it applies retention across every snapshot in the
repository — including other hosts' if the repo is shared. And because `GEN_DIR` is a fresh `mktemp` path each
night, every snapshot has a different root path, which is what forces restore's fragile
`find -name db.dump -print -quit`. Use a stable path and filter `forget` by tag.

**IM13 — `decodeSample` uses a biased shuffle.** `[...entries].sort(() => Math.random() - 0.5)`
(`media-manifest-cli.ts:129`) is not a uniform permutation; the 25-entry sample is systematically skewed toward
the head of the array, which is DB-scan order. Use a Fisher–Yates shuffle so the decode gate actually samples
the archive.

**IM14 — A single env var bypasses both confirmations.** `RESTORE_NONINTERACTIVE=1` (`restore.sh:74-76`) makes
`confirm()` return 0 for both the staging prompt and the cutover prompt, so the "separate, explicit
confirmation gates the actual cutover" property holds only in interactive mode. Consider a distinct variable
for the destructive step.

---

## Verified-good (worth recording so it is not re-litigated)

- **Path traversal against the CDN alias is solidly blocked.** All of `/products/../private/secret.webp`,
  `/products/../../private/secret.webp`, `/products/%2e%2e/private/…`, `/products/..%2fprivate%2fsecret.webp`,
  `/products/%2e%2e%2f%2e%2e%2f…`, `/products/....//private/…` return 404 or 400; `/private/…` and
  `/quarantine/…` return 404; directory requests and non-`.webp` extensions 404. The `alias … $uri`
  construction inside the anchored regex location is safe because nginx normalizes `$uri` before matching.
- **dev-3's two nginx notes check out.** `default_type image/webp` (not `add_header Content-Type`) yields
  exactly one Content-Type header, and omitting `try_files` is correct for `alias` in a regex location.
- **The freeze policy is installed process-wide before workers start** (`server.ts:98` precedes
  `startWorkers()` at `:138`), so in-process workers are covered by the policy that *is* wired.
- **The health endpoint is properly admin-gated and leaks nothing** — registered under `adminRoutes`, which
  registers `adminOnlyPlugin` first; the payload contains byte counts, counts, timestamps and thresholds, no
  filesystem paths or connection details.
- **All four health signal recorders have real callers** (cleanup job, backup signal CLI).
- **Baseline cutover works.** With no injected failure the simulation ends with restored DB + restored media
  and the original pair retained as rollback copies.

---

## Acceptance criteria (phase-07, infra portion)

| Criterion | Status |
|---|---|
| Dedicated CDN exposes only immutable public namespace | Mostly met — traversal-safe and public-only, but IM1/IM2 leak vectors and IM3/IM4 header/body gaps |
| Backup freeze/manifest proves DB/media referential consistency | **Not met** — II1 (sweeps unfrozen), II2 (no row-reference cross-check), II3 (unfenced/expiring freeze) |
| Staging restore/cutover/rollback drill | **Not met** — IC1 and IC2 make several failure paths leave production on a mismatched pair; II6 health-check path absent |
| Concrete health thresholds and alerts documented/tested | Partially met — 5 of 8 thresholds live and reported; IM5/IM6 leave the three rate alerts and the alerting path unimplemented |
| Media directories provisioned with least privilege | **Not met** — II5 grants nginx read on private/quarantine |

## Recommended order

1. IC1, IC2 — restore.sh cutover error handling and rollback guard. Nothing else in this commit set can be
   trusted in a real incident until these are fixed, and they are the difference between a recoverable restore
   and a corrupted production pair.
2. II4, II6 — staging DB naming and the post-cutover health gate (same file, same fix session).
3. II1, II2, II3 — make the backup boundary real: freeze the sweeps, cross-check row references, fence and
   renew the freeze.
4. II5 — per-tree permissions.
5. MODERATEs; IM1–IM4 are four one-line nginx changes worth doing together.

## Unresolved questions

1. Is `BACKUP_LOCAL_DIR` on the same filesystem as `MEDIA_ROOT` on the target host? IM7's severity depends
   entirely on that, and the phase file only mandates same-filesystem for the API/nginx media trees.
2. Which backup driver is actually intended for production — restic or age+rclone? IM12 only matters for
   restic, and shipping both doubles the untested surface.
3. Should the health endpoint gain an unauthenticated liveness variant so UptimeRobot can poll it, or is
   systemd-timer alerting the only intended path? Task 7's wording implies the former; the implementation
   allows neither.
