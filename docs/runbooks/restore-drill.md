# Restore drill runbook

**Cadence:** Quarterly (1st of Jan / Apr / Jul / Oct). Add to operator calendar.

**Purpose:** prove the backup pipeline produces a usable Postgres snapshot. A backup you have never restored is not a backup.

**Estimated time:** 60 minutes operator + 30 min compute.

## Prerequisites

- Scratch VPS available (same provider class as prod, e.g., Hetzner CX22). Provision and tear down per drill — do not keep it standing.
- SSH key for the operator account loaded
- `age` CLI installed locally
- `rclone` installed locally with a working `[b2]` remote configured at `~/.config/rclone/rclone.conf` (read access to `pantry-backups`)
- The `age` recipient private key checked out from 1Password into `~/.config/age/pantry.key` (mode 600)

## Step-by-step

### 1. Provision scratch VPS (5 min)

```bash
# Example: Hetzner Cloud CLI
hcloud server create --type cx22 --image ubuntu-24.04 \
  --name pantry-restore-drill-$(date +%Y%m%d) \
  --ssh-key operator
# Note the assigned IP, export it:
export DRILL_IP=<ip>
```

### 2. Install Postgres on the scratch host (5 min)

```bash
ssh root@$DRILL_IP
apt update && apt install -y postgresql-16 age
systemctl enable --now postgresql
sudo -u postgres psql -c "CREATE ROLE pantry_app LOGIN PASSWORD 'drilldrilldrill';"
sudo -u postgres psql -c "CREATE DATABASE pantry OWNER pantry_app;"
exit
```

### 3. Download the most recent daily backup (5 min)

```bash
# On your laptop
rclone lsf b2:pantry-backups/daily/ | sort | tail -5
# Pick the latest, e.g., 2026-05-23.age
rclone copy b2:pantry-backups/daily/2026-05-23.age /tmp/
mv /tmp/2026-05-23.age ./drill.dump.age
```

### 4. Decrypt locally (1 min)

```bash
age -d -i ~/.config/age/pantry.key -o drill.dump drill.dump.age
ls -lh drill.dump
# Expected: a non-zero-size .dump file in Postgres custom format
```

### 5. Copy to scratch host + restore (10 min)

```bash
scp drill.dump root@$DRILL_IP:/tmp/
ssh root@$DRILL_IP \
  "sudo -u postgres pg_restore -d pantry --clean --if-exists --no-owner --role=pantry_app /tmp/drill.dump"
```

Expected: pg_restore prints object counts; exit code 0. Some "already exists" warnings are normal during `--clean`.

### 6. Verify row counts (10 min)

Capture prod row counts beforehand. From your laptop with prod read-only access:

```bash
ssh pantry@prod-host \
  "sudo -u postgres psql -d pantry -At -c \"SELECT 'users', count(*) FROM users UNION ALL \
                                            SELECT 'records', count(*) FROM records UNION ALL \
                                            SELECT 'reviews', count(*) FROM reviews UNION ALL \
                                            SELECT 'review_votes', count(*) FROM review_votes UNION ALL \
                                            SELECT 'products', count(*) FROM products;\"" \
  > prod-counts.txt
```

Then on the scratch host:

```bash
ssh root@$DRILL_IP \
  "sudo -u postgres psql -d pantry -At -c \"SELECT 'users', count(*) FROM users UNION ALL \
                                            SELECT 'records', count(*) FROM records UNION ALL \
                                            SELECT 'reviews', count(*) FROM reviews UNION ALL \
                                            SELECT 'review_votes', count(*) FROM review_votes UNION ALL \
                                            SELECT 'products', count(*) FROM products;\"" \
  > drill-counts.txt
```

Compare:

```bash
diff prod-counts.txt drill-counts.txt
```

**Pass criteria:** every count matches prod within ±10 rows (allowing for drift between the backup window and the prod read).

### 7. Spot-check application data (5 min)

```bash
ssh root@$DRILL_IP "sudo -u postgres psql -d pantry -c \"SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 3;\""
```

Expect: 3 recent users, no NULL emails, plausible timestamps.

### 8. Tear down scratch VPS (1 min)

```bash
hcloud server delete pantry-restore-drill-$(date +%Y%m%d)
shred -u drill.dump drill.dump.age
```

### 9. Record the drill

Append a line to `docs/runbooks/restore-drill-log.md`:

```
| YYYY-MM-DD | <operator> | <backup file> | PASS/FAIL | notes |
```

## If anything fails

- **Backup file missing in S3:** investigate `backup.sh` logs on prod under `/var/log/pantry/backup.log`. Re-run `infra/scripts/backup.sh` manually.
- **age decryption fails:** the recipient key has rotated and the backup was made under the old key. Recover the old key from 1Password (we keep the previous 2 generations). Schedule a re-encryption pass.
- **pg_restore errors:** capture the full output. Check that scratch Postgres version matches prod (both 16). Re-run with `--verbose`.
- **Row counts differ wildly:** treat this as a P1 incident. The backup pipeline is producing partial dumps. Page on-call.
