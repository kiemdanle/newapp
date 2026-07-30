#!/usr/bin/env bash
#
# Restore a Pantry backup generation ({ db.dump, media-manifest.json,
# media.tar }) through a staging area, never directly onto the live DB or
# media root.
#
# Usage:
#   ./restore.sh <YYYY-MM-DD> [daily|weekly|monthly]   # age + rclone driver
#   ./restore.sh restic <snapshot_id>                  # restic driver
#
# Flow (see infra/README.md "Restore" for the full walkthrough):
#   1. Fetch + decrypt the generation locally.
#   2. Restore the DB dump into a STAGING database (never DATABASE_URL).
#   3. Extract media.tar into a STAGING media root (never MEDIA_ROOT).
#   4. Verify every manifest entry's checksum against the staged media, then
#      real-decode a sample of the staged WebP files.
#      -> Any failure here stops the whole restore. Live DB and live media
#         are untouched at this point — nothing further to undo.
#   5. A SEPARATE, explicit confirmation gates the actual cutover (distinct
#      from the first confirmation, which only gates spending time/disk on
#      staging).
#   6. Cutover: stop pantry-api, atomically rename the live DB out of the way
#      and the staging DB into its place, move the live media root out of the
#      way and the staging media root into its place, restart pantry-api.
#      The renamed-aside live DB and media root are the rollback copies —
#      RETAINED, never deleted by this script.
#   7. A cutover-step failure attempts an automatic rollback (rename
#      everything back) and, if that itself fails, stops without deleting
#      anything and prints exactly what to do by hand — a stuck mid-cutover
#      host is the one state this script cannot silently recover from, so it
#      never guesses.
#
# Reads /etc/pantry/secrets/api.env and (if present) /etc/pantry/secrets/backup.env.
# Requires RESTORE_NONINTERACTIVE=1 (two confirmations otherwise) to run
# non-interactively.

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
: "${MEDIA_ROOT:?MEDIA_ROOT is required (must match the running api.env)}"
PANTRY_API_DIR="${PANTRY_API_DIR:-/opt/pantry/current/api}"
MANIFEST_CLI="$PANTRY_API_DIR/dist/scripts/media-manifest-cli.js"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pantry}"
GENERATION_ID="restore-$(date -u +%Y%m%dT%H%M%SZ)"
STAGING_DIR="$LOCAL_DIR/restore-staging/$GENERATION_ID"
STAGING_MEDIA_ROOT="$STAGING_DIR/media"

# The live database name, and a connection URL to Postgres' always-present
# `postgres` maintenance DB — both DROP DATABASE and ALTER DATABASE ... RENAME
# require a connection to some OTHER database, never the one being touched.
LIVE_DB_NAME=$(psql "$DATABASE_URL" -X -tAc 'SELECT current_database()')
MAINT_DB_URL=$(printf '%s' "$DATABASE_URL" | sed -E "s#/${LIVE_DB_NAME}(\?|$)#/postgres\1#")
STAGING_DB_NAME="${LIVE_DB_NAME}_restore_staging"

confirm() {
    local prompt="$1"
    if [[ "${RESTORE_NONINTERACTIVE:-0}" == "1" ]]; then
        return 0
    fi
    if [[ ! -t 0 ]]; then
        log "ERROR: refusing to run non-interactively without RESTORE_NONINTERACTIVE=1"
        exit 1
    fi
    printf '%s Type RESTORE to continue: ' "$prompt" >&2
    read -r answer
    if [[ "$answer" != "RESTORE" ]]; then
        log "aborted by operator"
        exit 1
    fi
}

cleanup_staging() {
    log "removing staging area $STAGING_DIR"
    rm -rf "$STAGING_DIR"
    # Best-effort: drop the staging DB if the cutover never claimed it (a
    # completed cutover already renamed it away, so this is a no-op then).
    psql "$MAINT_DB_URL" -X -q -c "DROP DATABASE IF EXISTS \"$STAGING_DB_NAME\";" >/dev/null 2>&1 || true
}
trap cleanup_staging EXIT

mkdir -p "$STAGING_DIR" "$STAGING_MEDIA_ROOT"

# ---------------------------------------------------------------------------
# 1. Fetch + decrypt the generation into $STAGING_DIR.
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "restic" ]]; then
    SNAPSHOT_ID="${2:?snapshot_id required (or 'latest')}"
    : "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
    : "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"
    if ! command -v restic >/dev/null 2>&1; then
        log "ERROR: restic is not installed"
        exit 1
    fi
    log "restoring restic snapshot $SNAPSHOT_ID into $STAGING_DIR"
    restic restore "$SNAPSHOT_ID" --target "$STAGING_DIR" --include "/*"
    # restic restores under a path mirroring the original absolute gen dir;
    # flatten whatever single directory it produced into $STAGING_DIR itself.
    FOUND_DB=$(find "$STAGING_DIR" -name db.dump -print -quit)
    : "${FOUND_DB:?db.dump not found in restic snapshot $SNAPSHOT_ID}"
    GEN_ROOT=$(dirname "$FOUND_DB")
else
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

    SRC_LOCAL="$LOCAL_DIR/$TIER/${DATE}.tar.age"
    SRC_REMOTE="${BACKUP_RCLONE_REMOTE:-}/${TIER}/${DATE}.tar.age"
    TMP_ENC="$STAGING_DIR/generation.tar.age"
    TMP_TAR="$STAGING_DIR/generation.tar"

    if [[ -f "$SRC_LOCAL" ]]; then
        log "using local $SRC_LOCAL"
        cp "$SRC_LOCAL" "$TMP_ENC"
    else
        : "${BACKUP_RCLONE_REMOTE:?BACKUP_RCLONE_REMOTE is required (or place a local copy at $SRC_LOCAL)}"
        RCLONE_CONF="${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}"
        log "fetching $SRC_REMOTE"
        rclone copyto "$SRC_REMOTE" "$TMP_ENC" --config "$RCLONE_CONF"
    fi
    log "decrypting"
    age -d -i "$AGE_IDENTITY_FILE" -o "$TMP_TAR" "$TMP_ENC"
    GEN_ROOT="$STAGING_DIR/generation"
    mkdir -p "$GEN_ROOT"
    tar -xf "$TMP_TAR" -C "$GEN_ROOT"
    rm -f "$TMP_ENC" "$TMP_TAR"
fi

for required in db.dump media-manifest.json media.tar; do
    [[ -f "$GEN_ROOT/$required" ]] || { log "ERROR: generation is missing $required"; exit 1; }
done

confirm "About to stage this generation into database '$STAGING_DB_NAME' and $STAGING_MEDIA_ROOT (live resources untouched by this step)."

# ---------------------------------------------------------------------------
# 2. Restore the DB dump into the staging database.
# ---------------------------------------------------------------------------
log "creating staging database $STAGING_DB_NAME"
psql "$MAINT_DB_URL" -X -q \
    -c "DROP DATABASE IF EXISTS \"$STAGING_DB_NAME\";" \
    -c "CREATE DATABASE \"$STAGING_DB_NAME\";" >/dev/null

STAGING_DB_URL=$(printf '%s' "$DATABASE_URL" | sed -E "s#/${LIVE_DB_NAME}(\?|$)#/${STAGING_DB_NAME}\1#")

log "restoring db.dump into staging database"
pg_restore --clean --if-exists --no-owner --no-acl -d "$STAGING_DB_URL" "$GEN_ROOT/db.dump"

# ---------------------------------------------------------------------------
# 3. Extract media into the staging media root.
# ---------------------------------------------------------------------------
log "extracting media.tar into $STAGING_MEDIA_ROOT"
tar -xf "$GEN_ROOT/media.tar" -C "$STAGING_MEDIA_ROOT"

# ---------------------------------------------------------------------------
# 4. Validate: checksums against the staged media, then a real-decode sample.
#    A failure here leaves live DB and live media completely untouched.
# ---------------------------------------------------------------------------
log "verifying media manifest against staged media"
if ! node "$MANIFEST_CLI" verify "$STAGING_MEDIA_ROOT" "$GEN_ROOT/media-manifest.json"; then
    log "ERROR: manifest verification failed against staged media — restore aborted, live resources untouched"
    exit 1
fi

log "decode-sampling staged media"
if ! node "$MANIFEST_CLI" decode-sample "$STAGING_MEDIA_ROOT" "$GEN_ROOT/media-manifest.json" 25; then
    log "ERROR: decode sample failed on staged media — restore aborted, live resources untouched"
    exit 1
fi

log "staging validated successfully"

# ---------------------------------------------------------------------------
# 5. Cutover — the only step that touches live resources. Gated by its own
#    confirmation, separate from the staging one above.
# ---------------------------------------------------------------------------
confirm "Staging validated. About to enter maintenance mode and cut over live DB + media to this generation."

ROLLBACK_SUFFIX="rollback-$(date -u +%Y%m%dT%H%M%SZ)"
ROLLBACK_DB_NAME="${LIVE_DB_NAME}_${ROLLBACK_SUFFIX}"
ROLLBACK_MEDIA_ROOT="${MEDIA_ROOT}.${ROLLBACK_SUFFIX}"

CUTOVER_STARTED=0
cutover_rollback() {
    log "CUTOVER FAILED — attempting automatic rollback"
    if [[ -d "$ROLLBACK_MEDIA_ROOT" && ! -d "$MEDIA_ROOT" ]]; then
        mv "$ROLLBACK_MEDIA_ROOT" "$MEDIA_ROOT" && log "media rolled back" \
            || log "MANUAL ACTION REQUIRED: move $ROLLBACK_MEDIA_ROOT back to $MEDIA_ROOT by hand"
    fi
    if psql "$MAINT_DB_URL" -X -tAc "SELECT 1 FROM pg_database WHERE datname='$ROLLBACK_DB_NAME'" 2>/dev/null | grep -q 1; then
        if ! psql "$MAINT_DB_URL" -X -tAc "SELECT 1 FROM pg_database WHERE datname='$LIVE_DB_NAME'" 2>/dev/null | grep -q 1; then
            psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$ROLLBACK_DB_NAME\" RENAME TO \"$LIVE_DB_NAME\";" \
                && log "database rolled back" \
                || log "MANUAL ACTION REQUIRED: rename database \"$ROLLBACK_DB_NAME\" back to \"$LIVE_DB_NAME\" by hand"
        fi
    fi
    systemctl start pantry-api 2>/dev/null || true
    log "rollback attempt finished — verify service health before trusting it"
}

log "entering maintenance mode: stopping pantry-api"
systemctl stop pantry-api

{
    CUTOVER_STARTED=1

    log "terminating connections to $LIVE_DB_NAME before rename"
    psql "$MAINT_DB_URL" -X -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$LIVE_DB_NAME' AND pid <> pg_backend_pid();" >/dev/null

    log "renaming live database $LIVE_DB_NAME → $ROLLBACK_DB_NAME"
    psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$LIVE_DB_NAME\" RENAME TO \"$ROLLBACK_DB_NAME\";"

    log "renaming staging database $STAGING_DB_NAME → $LIVE_DB_NAME"
    psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$STAGING_DB_NAME\" RENAME TO \"$LIVE_DB_NAME\";"

    log "moving live media $MEDIA_ROOT → $ROLLBACK_MEDIA_ROOT"
    mv "$MEDIA_ROOT" "$ROLLBACK_MEDIA_ROOT"

    log "moving staged media $STAGING_MEDIA_ROOT → $MEDIA_ROOT"
    mv "$STAGING_MEDIA_ROOT" "$MEDIA_ROOT"
} || {
    cutover_rollback
    exit 1
}

log "restarting pantry-api"
systemctl start pantry-api

log "cutover complete. Rollback copies retained: database \"$ROLLBACK_DB_NAME\", media $ROLLBACK_MEDIA_ROOT"
log "restore complete"
