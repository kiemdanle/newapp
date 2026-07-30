# Restore drill runbook

**Cadence:** quarterly.
**Purpose:** prove that the configured backup driver produces a usable PostgreSQL
restore without touching production.

The restore script is destructive against its target database. Run the drill on
a scratch database or host only.

## Prerequisites

- A scratch PostgreSQL instance that is not production.
- Access to the operator-managed backup configuration and the age identity when
  using the age+rclone driver.
- The current release's `infra/scripts/restore.sh` and the tools required by the
  selected driver (`pg_restore`, plus `age`/`rclone` or `restic`).
- A target `DATABASE_URL` for the scratch database.

Backups use one of two supported drivers:

| Driver | Source | Restore invocation |
| --- | --- | --- |
| age + rclone | `$BACKUP_RCLONE_REMOTE/<tier>/<YYYY-MM-DD>.dump.age`, or `/var/backups/pantry/<tier>/<YYYY-MM-DD>.dump.age` | `restore.sh YYYY-MM-DD daily` |
| restic | configured `$RESTIC_REPOSITORY` snapshot | `restore.sh restic <snapshot-id-or-latest>` |

The age+rclone filename includes both `.dump` and `.age`; do not use the older
`YYYY-MM-DD.age` form. Tiers are `daily`, `weekly`, and `monthly`.

## Procedure

1. **Choose a recent backup and provision the scratch target.** Set
   `DATABASE_URL` in a scratch-only copy of `api.env`, or otherwise ensure the
   script resolves it to the scratch database. Do not point it at production.
2. **Verify the source exists.** For age+rclone, list the configured remote:
   ```bash
   rclone lsf "$BACKUP_RCLONE_REMOTE/daily/" --files-only
   ```
   Record the selected date and tier. For restic, list snapshots with the
   configured repository credentials.
3. **Run the restore from the release tree.** The script reads
   `/etc/pantry/secrets/api.env` and, when present,
   `/etc/pantry/secrets/backup.env`. It requires an interactive `RESTORE`
   confirmation unless `RESTORE_NONINTERACTIVE=1` is explicitly set.
   ```bash
   sudo /opt/pantry/current/infra/scripts/restore.sh 2026-07-01 daily
   # or
   sudo /opt/pantry/current/infra/scripts/restore.sh restic latest
   ```
4. **Verify the result.** Confirm `pg_restore` exits successfully, then compare
   representative table counts from the backup window with the scratch database
   and inspect a small, non-sensitive sample through SQL or the application.
   Account for rows legitimately written after the backup was created.
5. **Destroy the scratch data and record the drill.** Remove temporary dumps and
   the scratch host/database. Append the date, operator, driver, backup ID,
   pass/fail result, and notes to the operator's drill log.

## Failure handling

- **Source unavailable:** inspect `/var/log/pantry/backup.log`, the selected
  remote/repository configuration, and driver credentials.
- **Age decryption fails:** confirm the correct identity file is available
  (`AGE_IDENTITY_FILE`, default `/etc/pantry/secrets/age.key`) and that it matches
  the selected backup.
- **Restore fails:** retain command output, confirm the target URL is scratch,
  and compare PostgreSQL tool compatibility before retrying.
- **Data is materially incomplete:** treat the backup path as an incident; keep
  the evidence and follow [incident response](incident-response.md).
