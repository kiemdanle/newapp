#!/usr/bin/env bash
#
# Restore an encrypted Pantry backup into the configured DATABASE_URL.
#
# Usage:
#   ./restore.sh <YYYY-MM-DD> [daily|weekly|monthly]   # age + rclone driver
#   ./restore.sh restic <snapshot_id>                  # restic driver
#
# Reads /etc/pantry/secrets/api.env and (if present) /etc/pantry/secrets/backup.env.
# DESTRUCTIVE: pg_restore --clean --if-exists drops and re-creates schema in
# the target DB. Refuses to run without an interactive confirmation unless
# RESTORE_NONINTERACTIVE=1 is exported.

set -euo pipefail

LOG_FILE=/var/log/pantry/restore.log
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG_FILE" >&2
}

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

: "${DATABASE_URL:?DATABASE_URL is required}"

confirm_destructive() {
    if [[ "${RESTORE_NONINTERACTIVE:-0}" == "1" ]]; then
        return 0
    fi
    if [[ ! -t 0 ]]; then
        log "ERROR: refusing to run non-interactively without RESTORE_NONINTERACTIVE=1"
        exit 1
    fi
    printf 'About to pg_restore --clean --if-exists into %s. Type RESTORE to continue: ' "$DATABASE_URL" >&2
    read -r answer
    if [[ "$answer" != "RESTORE" ]]; then
        log "aborted by operator"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Driver: restic
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "restic" ]]; then
    SNAPSHOT_ID="${2:?snapshot_id required (or 'latest')}"
    : "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
    : "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"
    if ! command -v restic >/dev/null 2>&1; then
        log "ERROR: restic is not installed"
        exit 1
    fi

    confirm_destructive

    log "fetching restic snapshot $SNAPSHOT_ID"
    TMP_DUMP=$(mktemp --suffix=.dump)
    trap 'rm -f "$TMP_DUMP"' EXIT
    restic dump "$SNAPSHOT_ID" "/pantry-*.dump" > "$TMP_DUMP"

    log "restoring into $DATABASE_URL"
    pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" "$TMP_DUMP"
    log "restore complete"
    exit 0
fi

# ---------------------------------------------------------------------------
# Driver: age + rclone
# ---------------------------------------------------------------------------
DATE="${1:?date YYYY-MM-DD is required (or pass 'restic <snapshot_id>')}"
TIER="${2:-daily}"

case "$TIER" in
    daily|weekly|monthly) ;;
    *) log "ERROR: tier must be daily|weekly|monthly"; exit 2 ;;
esac

AGE_IDENTITY_FILE="${AGE_IDENTITY_FILE:-$SECRETS_DIR/age.key}"
if [[ ! -r "$AGE_IDENTITY_FILE" ]]; then
    log "ERROR: cannot read age private key at $AGE_IDENTITY_FILE"
    exit 1
fi

LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pantry}"
SRC_LOCAL="$LOCAL_DIR/$TIER/${DATE}.dump.age"
SRC_REMOTE="${BACKUP_RCLONE_REMOTE:-}/${TIER}/${DATE}.dump.age"

TMP_DUMP=$(mktemp --suffix=.dump)
TMP_ENC=$(mktemp --suffix=.age)
trap 'rm -f "$TMP_DUMP" "$TMP_ENC"' EXIT

confirm_destructive

if [[ -f "$SRC_LOCAL" ]]; then
    log "decrypting local $SRC_LOCAL"
    age -d -i "$AGE_IDENTITY_FILE" -o "$TMP_DUMP" "$SRC_LOCAL"
else
    : "${BACKUP_RCLONE_REMOTE:?BACKUP_RCLONE_REMOTE is required (or place a local copy at $SRC_LOCAL)}"
    RCLONE_CONF="${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}"
    log "fetching $SRC_REMOTE"
    rclone copyto "$SRC_REMOTE" "$TMP_ENC" --config "$RCLONE_CONF"
    log "decrypting"
    age -d -i "$AGE_IDENTITY_FILE" -o "$TMP_DUMP" "$TMP_ENC"
fi

log "restoring into $DATABASE_URL"
pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" "$TMP_DUMP"
log "restore complete"
