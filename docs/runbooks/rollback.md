# Deploy rollback runbook

**When to use:** the latest deploy is causing user-visible errors, elevated 5xx, or failing smoke tests.

**RTO target:** < 5 minutes from decision to "rollback complete".

## Prerequisites

- SSH access to the prod host as `pantry` (key in 1Password)
- Knowledge of the previous good SHA — find via GitHub Actions runs on `main` filtered to "success"

## 1. Identify the last good SHA (30 seconds)

Open the repository Actions page, filtered to successful `main` deploys. Note the SHA from the deploy job that was green before the bad one.

Alternatively on the host:

```bash
ssh pantry@prod-host
ls -1 /opt/pantry/releases/ | sort | tail -5
readlink /opt/pantry/current
```

The directory above the current symlink target is your rollback target.

## 2. Swap the symlink (10 seconds)

```bash
LAST_GOOD=<sha>
ln -sfn /opt/pantry/releases/$LAST_GOOD /opt/pantry/current
```

## 3. Restart services (10 seconds)

```bash
sudo systemctl restart pantry-api pantry-admin
```

`systemctl restart` sends `SIGTERM` to each unit; the units stop with `TimeoutStopSec=30`, giving the in-flight handler in `api/src/server.ts` its graceful drain window before SIGKILL. Active requests complete; new requests use the rolled-back binary. (`reload` is a no-op for these `Type=simple` units — they have no `ExecReload`.)

## 4. Smoke test (30 seconds)

```bash
curl -fsS https://api.linhkienkts.com/health/ready
# Expected: {"status":"ok","db":true,"redis":true}

curl -fsS https://api.linhkienkts.com/v1/products/search?q=milk -H "Authorization: Bearer <test-token>"
# Expected: 200 with results array
```

## 5. Watch error rate (5 minutes)

Tail logs:

```bash
sudo journalctl -u pantry-api -f --since "1 minute ago" | grep -E '"level":(40|50)'
```

Expected: error rate drops back to baseline within 60 seconds. If not, you rolled back to a SHA that's also broken — try one further back.

## 6. Announce

- Post in #incidents: "Rolled back Expyrico services to <sha>. Smoke tests green."
- Open a ticket to investigate root cause of the bad deploy. Block re-deploy of the bad SHA.

---

## Prisma migration rollback

**Prisma does not auto-rollback.** A migration that ran successfully is now in `_prisma_migrations`. Reverting to a previous SHA without reverting the schema means the old code may read columns that don't exist (rare, since we additive-only) or — worse — be missing columns that already do exist (common).

### Decision tree

1. **Was the bad deploy migration-additive only (new columns/tables, no destructive changes)?**
   The old code ignores the new columns. Safe to symlink-rollback only. The next deploy will simply not need to re-apply.

2. **Did the bad deploy drop or rename a column the old code reads?**
   Restore from the most recent backup (or from a logical backup snapshot taken pre-migration). See "Restore subset" below.

3. **Did the bad deploy modify data (a backfill went wrong)?**
   You have two options:
   - **Forward fix:** write a corrective migration and re-deploy. Preferred for small blast radius.
   - **PITR-like restore:** restore the most recent pre-incident backup into a parallel schema, write a SQL diff to copy corrected rows back. See below.

### Data recovery

Do not improvise a partial restore against production. The supported restore
script performs a destructive complete restore into its target database. Restore
a selected backup into a scratch database first, inspect and prepare a reviewed
repair plan, then make a separate, narrowly reviewed production change. See
[restore-drill.md](restore-drill.md) for the current driver, filename, and
confirmation behavior.

## 7. Postmortem

Within 48 hours, write a postmortem in `docs/postmortems/YYYY-MM-DD-<short-name>.md`. Use the template in `docs/runbooks/incident-response.md`.
