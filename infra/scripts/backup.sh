#!/usr/bin/env bash
#
# Nightly Pantry backup. Run as root via the cron installed by the app role
# at 03:17 UTC.
#
# Two drivers:
#
#   1. age + rclone (default)
#        pg_dump -Fc pantry | age -r "$BACKUP_AGE_RECIPIENT" \
#          > /var/backups/pantry/daily/<YYYY-MM-DD>.dump.age
#        rclone copy <file> "$BACKUP_RCLONE_REMOTE/daily/"
#        Rotation: 7 daily, 4 weekly (Sunday), 3 monthly (1st)
#
#   2. restic (Hetzner Storage Box, etc.)
#        Activated when RESTIC_REPOSITORY is exported (e.g. by sourcing
#        /etc/pantry/secrets/backup.env). Runs:
#            pg_dump -Fc pantry | restic backup --stdin --stdin-filename ...
#            restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune
#
# Required env (sourced from /etc/pantry/secrets/backup.env if present, else
# /etc/pantry/secrets/api.env):
#
#   age + rclone driver:
#     DATABASE_URL                — Postgres connection string for pg_dump
#     BACKUP_AGE_RECIPIENT        — age public key (or read from /etc/pantry/secrets/age.pub)
#     BACKUP_RCLONE_REMOTE        — e.g. b2:pantry-backups
#     BACKUP_LOCAL_DIR            — default /var/backups/pantry
#
#   restic driver:
#     DATABASE_URL                — same
#     RESTIC_REPOSITORY           — e.g. sftp:u1234@u1234.your-storagebox.de:/pantry
#     RESTIC_PASSWORD_FILE        — path to file with the restic password
#     (plus any provider-specific env, e.g. AWS_*, B2_*, etc.)

set -euo pipefail

LOG_FILE=/var/log/pantry/backup.log
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG_FILE" >&2
}

# Source env files, last-write wins.
SECRETS_DIR=/etc/pantry/secrets
for envfile in "$SECRETS_DIR/api.env" "$SECRETS_DIR/backup.env"; do
    if [[ -r "$envfile" ]]; then
        # shellcheck source=/dev/null
        set -a
        # shellcheck disable=SC1090
        source "$envfile"
        set +a
    fi
done

: "${DATABASE_URL:?DATABASE_URL is required (in /etc/pantry/secrets/api.env or backup.env)}"

# Defer-backups guard: if neither driver is configured, exit cleanly so the
# nightly cron does not fail. Wire one of the two before production traffic:
#   restic mode   → set RESTIC_REPOSITORY + RESTIC_PASSWORD_FILE in /etc/pantry/secrets/backup.env
#   age + rclone  → set BACKUP_RCLONE_REMOTE in env (and rclone config) and place /etc/pantry/secrets/age.pub
if [[ -z "${RESTIC_REPOSITORY:-}" && -z "${BACKUP_RCLONE_REMOTE:-}" ]]; then
    log "no backup driver configured (RESTIC_REPOSITORY and BACKUP_RCLONE_REMOTE both empty) — skipping"
    exit 0
fi

# Backup filename: a stable timestamp in UTC.
TODAY=$(date -u +%F)        # YYYY-MM-DD
DOW=$(date -u +%u)          # 1..7 (Mon=1, Sun=7)
DOM=$(date -u +%d)          # 01..31

LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pantry}"
mkdir -p "$LOCAL_DIR/daily" "$LOCAL_DIR/weekly" "$LOCAL_DIR/monthly"

# ---------------------------------------------------------------------------
# Driver: restic — activated when RESTIC_REPOSITORY is set.
# ---------------------------------------------------------------------------
if [[ -n "${RESTIC_REPOSITORY:-}" ]]; then
    log "driver=restic repo=${RESTIC_REPOSITORY}"
    : "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"
    if ! command -v restic >/dev/null 2>&1; then
        log "ERROR: restic is not installed"
        exit 1
    fi

    log "starting restic backup of pantry → ${RESTIC_REPOSITORY}"
    pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
        | restic backup --stdin \
            --stdin-filename "pantry-${TODAY}.dump" \
            --tag "pantry" --tag "date:${TODAY}"

    log "applying retention 7d/4w/3m"
    restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune

    log "restic backup complete"
    exit 0
fi

# ---------------------------------------------------------------------------
# Driver: age + rclone (default)
# ---------------------------------------------------------------------------
# Recipient: explicit env wins, else read /etc/pantry/secrets/age.pub.
if [[ -z "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    if [[ -r "$SECRETS_DIR/age.pub" ]]; then
        BACKUP_AGE_RECIPIENT=$(cat "$SECRETS_DIR/age.pub")
    fi
fi
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required (or place /etc/pantry/secrets/age.pub)}"
: "${BACKUP_RCLONE_REMOTE:?BACKUP_RCLONE_REMOTE is required}"

OUT="$LOCAL_DIR/daily/${TODAY}.dump.age"

log "driver=age+rclone recipient=$(printf '%s' "$BACKUP_AGE_RECIPIENT" | head -c 12)... → $OUT"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
    | age -r "$BACKUP_AGE_RECIPIENT" \
    > "$OUT"

# Local copies for weekly / monthly retention
if [[ "$DOW" == "7" ]]; then
    cp -f "$OUT" "$LOCAL_DIR/weekly/${TODAY}.dump.age"
fi
if [[ "$DOM" == "01" ]]; then
    cp -f "$OUT" "$LOCAL_DIR/monthly/${TODAY}.dump.age"
fi

# Push to remote
RCLONE_CONF="${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}"
RCLONE_FLAGS=(--config "$RCLONE_CONF")

log "uploading daily to ${BACKUP_RCLONE_REMOTE}/daily/"
rclone copy "$OUT" "${BACKUP_RCLONE_REMOTE}/daily/" "${RCLONE_FLAGS[@]}"

if [[ "$DOW" == "7" ]]; then
    log "uploading weekly to ${BACKUP_RCLONE_REMOTE}/weekly/"
    rclone copy "$LOCAL_DIR/weekly/${TODAY}.dump.age" "${BACKUP_RCLONE_REMOTE}/weekly/" "${RCLONE_FLAGS[@]}"
fi
if [[ "$DOM" == "01" ]]; then
    log "uploading monthly to ${BACKUP_RCLONE_REMOTE}/monthly/"
    rclone copy "$LOCAL_DIR/monthly/${TODAY}.dump.age" "${BACKUP_RCLONE_REMOTE}/monthly/" "${RCLONE_FLAGS[@]}"
fi

# ---------------------------------------------------------------------------
# Rotation: 7 daily / 4 weekly / 3 monthly, both local and remote.
# Newest-first sort + tail-after-keep, so we never delete the freshest copy.
# ---------------------------------------------------------------------------
prune_local_and_remote() {
    local subdir="$1" keep="$2"
    local files=()
    local rfiles=()

    # Local prune: ls newest-first, drop the first $keep, delete the rest.
    if compgen -G "$LOCAL_DIR/$subdir/*.dump.age" > /dev/null; then
        mapfile -t files < <(ls -1t "$LOCAL_DIR/$subdir"/*.dump.age)
        if (( ${#files[@]} > keep )); then
            local f
            for f in "${files[@]:keep}"; do
                log "deleting local $f"
                rm -f "$f"
            done
        fi
    fi

    # Remote prune: rclone lsf, sort newest-first by name (filename is YYYY-MM-DD).
    mapfile -t rfiles < <(rclone lsf "${BACKUP_RCLONE_REMOTE}/${subdir}/" --files-only "${RCLONE_FLAGS[@]}" | sort -r)
    if (( ${#rfiles[@]} > keep )); then
        local f
        for f in "${rfiles[@]:keep}"; do
            log "deleting remote ${BACKUP_RCLONE_REMOTE}/${subdir}/${f}"
            rclone deletefile "${BACKUP_RCLONE_REMOTE}/${subdir}/${f}" "${RCLONE_FLAGS[@]}"
        done
    fi
}

prune_local_and_remote daily 7
prune_local_and_remote weekly 4
prune_local_and_remote monthly 3

log "backup complete"
