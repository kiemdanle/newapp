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
# The staging confirmation and the cutover confirmation are gated
# independently: RESTORE_NONINTERACTIVE=1 bypasses only the staging one
# (validate a generation with no risk to live resources); the destructive
# cutover step additionally requires RESTORE_CONFIRM_CUTOVER=1 to run
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
# A sibling of MEDIA_ROOT itself, never nested under $LOCAL_DIR/BACKUP_LOCAL_DIR
# — those are commonly separate filesystems/mounts, and the final cutover
# `mv "$STAGING_MEDIA_ROOT" "$MEDIA_ROOT"` degrades to copy+unlink across a
# filesystem boundary: not atomic, and a mid-copy failure can leave a
# genuinely partial $MEDIA_ROOT that defeats cutover_rollback's `! -d
# "$MEDIA_ROOT"` guard (reviewer-p7 IM7). A sibling directory is always on
# the same filesystem as $MEDIA_ROOT by construction — the exact same
# assumption $ROLLBACK_MEDIA_ROOT below already relies on.
STAGING_MEDIA_ROOT="${MEDIA_ROOT}.restore-staging-${GENERATION_ID}"

# Rebuilds a Postgres connection URL with a different database name, by
# structurally splitting on the authority/path boundary rather than
# textually substituting the old database name wherever it appears
# (reviewer-p7 IM8: the previous `sed -E "s#/${LIVE_DB_NAME}(\?|$)#/…\1#"`
# breaks — silently producing a wrong target — on any URL where the database
# name also happens to appear earlier, e.g. embedded in the username or
# password).
db_url_with_name() {
    local url="$1" new_name="$2"
    if [[ "$url" =~ ^(postgres(ql)?://[^/]+)/[^?]*(\?.*)?$ ]]; then
        printf '%s/%s%s' "${BASH_REMATCH[1]}" "$new_name" "${BASH_REMATCH[3]}"
    else
        log "ERROR: DATABASE_URL is not a recognizable postgres connection string"
        exit 1
    fi
}

# The live database name, and a connection URL to Postgres' always-present
# `postgres` maintenance DB — both DROP DATABASE and ALTER DATABASE ... RENAME
# require a connection to some OTHER database, never the one being touched.
LIVE_DB_NAME=$(psql "$DATABASE_URL" -X -tAc 'SELECT current_database()')
MAINT_DB_URL=$(db_url_with_name "$DATABASE_URL" postgres)
# Uniquified by GENERATION_ID, matching STAGING_DIR — a fixed name meant two
# concurrent restores (or a re-run after an aborted one) could destroy each
# other's staged database via cleanup_staging's unconditional DROP, which is
# also the exact mechanism IC1 row 2 used to destroy a restored database
# (reviewer-p7 II4). Hyphens aren't valid in an unquoted Postgres identifier
# context here, so they're replaced rather than relied on.
STAGING_DB_NAME="${LIVE_DB_NAME}_staging_${GENERATION_ID//-/_}"

# Post-cutover health gate (reviewer-p7 II6): the phase requires retaining
# rollback pointers "until post-cutover health succeeds" and lists a failed
# health check as one of three fault paths that must preserve the prior
# paired generation — previously the script logged "cutover complete"
# immediately after `systemctl start`, with no probe at all. Polls the
# plain, unauthenticated `/health` route (never the admin-gated operational
# health endpoint, which restore.sh has no credential for) so this works the
# same way an external liveness check would.
HEALTH_CHECK_TIMEOUT_SECONDS="${HEALTH_CHECK_TIMEOUT_SECONDS:-30}"
wait_for_healthy() {
    local url="http://${HOST:-127.0.0.1}:${PORT:-4000}/health"
    local deadline=$((SECONDS + HEALTH_CHECK_TIMEOUT_SECONDS))
    log "waiting for $url to report healthy (up to ${HEALTH_CHECK_TIMEOUT_SECONDS}s)"
    while (( SECONDS < deadline )); do
        if curl -fsS -o /dev/null -m 3 "$url"; then
            log "health check passed"
            return 0
        fi
        sleep 1
    done
    log "health check did not pass within ${HEALTH_CHECK_TIMEOUT_SECONDS}s"
    return 1
}

# `gate_var` lets the staging confirmation and the cutover confirmation be
# bypassed independently — RESTORE_NONINTERACTIVE alone used to satisfy
# BOTH confirm() calls, so "run non-interactively to validate a generation"
# and "run non-interactively and actually cut production over to it" were
# the same opt-in, even though only the first is genuinely low-stakes
# (reviewer-p7 IM14). The destructive step now needs its own, separately
# named variable.
confirm() {
    local prompt="$1"
    local gate_var="${2:-RESTORE_NONINTERACTIVE}"
    if [[ "${!gate_var:-0}" == "1" ]]; then
        return 0
    fi
    if [[ ! -t 0 ]]; then
        log "ERROR: refusing to run non-interactively without ${gate_var}=1"
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
    log "removing staging area $STAGING_DIR and $STAGING_MEDIA_ROOT"
    rm -rf "$STAGING_DIR"
    # STAGING_MEDIA_ROOT lives as a sibling of MEDIA_ROOT (reviewer-p7 IM7),
    # not nested under STAGING_DIR, so it needs its own removal. A no-op if
    # a completed cutover already renamed it into place as MEDIA_ROOT, or if
    # cutover_rollback already reclaimed it as a repair-path destination and
    # this run is simply releasing it now that recovery is done.
    rm -rf "$STAGING_MEDIA_ROOT"
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
    # backup.sh backs up a stable, non-randomized absolute path
    # ($LOCAL_DIR/work/generation, reviewer-p7 IM12) every night, so restic
    # always restores it to that exact same absolute path underneath
    # $STAGING_DIR — computed directly rather than `find -name db.dump
    # -print -quit` guessing at an arbitrary match, which a snapshot holding
    # more than one db.dump (any repository shared across hosts/backup runs)
    # made reachable to pick the wrong one entirely (reviewer-p7 II2's own
    # threat scenario).
    GEN_ROOT="$STAGING_DIR$LOCAL_DIR/work/generation"
    [[ -f "$GEN_ROOT/db.dump" ]] || { log "ERROR: db.dump not found at the expected path $GEN_ROOT — restic snapshot $SNAPSHOT_ID does not match this host's stable backup layout"; exit 1; }
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

STAGING_DB_URL=$(db_url_with_name "$DATABASE_URL" "$STAGING_DB_NAME")

log "restoring db.dump into staging database"
pg_restore --clean --if-exists --no-owner --no-acl -d "$STAGING_DB_URL" "$GEN_ROOT/db.dump"

# ---------------------------------------------------------------------------
# 3. Extract media into the staging media root.
# ---------------------------------------------------------------------------
log "extracting media.tar into $STAGING_MEDIA_ROOT"
tar -xf "$GEN_ROOT/media.tar" -C "$STAGING_MEDIA_ROOT"

# ---------------------------------------------------------------------------
# 4. Validate: checksums against the staged media, database references
#    against the staged database, then a real-decode sample. A failure here
#    leaves live DB and live media completely untouched.
# ---------------------------------------------------------------------------
log "verifying media manifest against staged media"
if ! node "$MANIFEST_CLI" verify "$STAGING_MEDIA_ROOT" "$GEN_ROOT/media-manifest.json"; then
    log "ERROR: manifest verification failed against staged media — restore aborted, live resources untouched"
    exit 1
fi

# Cross-checks the manifest's key set against the STAGING database's actual
# referenced keys — the file-checksum check above only ever proves
# manifest -> file; without this, a db.dump paired with a foreign
# manifest+tar (e.g. the restic path's `find -name db.dump -print -quit`
# picking an arbitrary snapshot member) would still validate cleanly
# (reviewer-p7 II2).
log "verifying media manifest against database references in the staged database"
if ! DATABASE_URL="$STAGING_DB_URL" node "$MANIFEST_CLI" verify-db-refs "$GEN_ROOT/media-manifest.json"; then
    log "ERROR: media manifest does not match the staged database's referenced media keys — restore aborted, live resources untouched"
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
#    confirmation and its own bypass variable, separate from the staging one
#    above (reviewer-p7 IM14).
# ---------------------------------------------------------------------------
confirm "Staging validated. About to enter maintenance mode and cut over live DB + media to this generation." RESTORE_CONFIRM_CUTOVER

ROLLBACK_SUFFIX="rollback-$(date -u +%Y%m%dT%H%M%SZ)"
ROLLBACK_DB_NAME="${LIVE_DB_NAME}_${ROLLBACK_SUFFIX}"
ROLLBACK_MEDIA_ROOT="${MEDIA_ROOT}.${ROLLBACK_SUFFIX}"

CUTOVER_STARTED=0

db_exists() {
    psql "$MAINT_DB_URL" -X -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" 2>/dev/null | grep -q 1
}

# Fixed for reviewer-p7 IC2: the original guard —
#   if rollback_exists; then if ! live_exists; then rename rollback -> live
# — is only ever true immediately after the FIRST rename (live -> rollback)
# and before the second. By the time the only reliably-reached failure point
# fires (the final media `mv`, after BOTH database renames already
# succeeded), `$LIVE_DB_NAME` holds the newly-promoted content and
# `$ROLLBACK_DB_NAME` holds the original — the inner condition is false, so
# the database rollback was silently skipped while the media rollback still
# ran, leaving a mismatched pair. Handles all three reachable states
# explicitly instead of assuming which one it's in, and never starts
# pantry-api unless both resources actually ended up back on a matched pair.
cutover_rollback() {
    log "CUTOVER FAILED — attempting automatic rollback"
    local db_ok=1
    local media_ok=1

    if db_exists "$LIVE_DB_NAME" && ! db_exists "$ROLLBACK_DB_NAME"; then
        log "database: live database was never renamed away, nothing to roll back"
    elif ! db_exists "$LIVE_DB_NAME" && db_exists "$ROLLBACK_DB_NAME"; then
        # Only the first rename succeeded; the staging DB is still under its
        # own name (untouched) — undo just the one rename that happened.
        if psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$ROLLBACK_DB_NAME\" RENAME TO \"$LIVE_DB_NAME\";"; then
            log "database rolled back"
        else
            db_ok=0
            log "MANUAL ACTION REQUIRED: rename database \"$ROLLBACK_DB_NAME\" back to \"$LIVE_DB_NAME\" by hand"
        fi
    elif db_exists "$LIVE_DB_NAME" && db_exists "$ROLLBACK_DB_NAME"; then
        # Both renames succeeded — move the newly-promoted content out of the
        # live name FIRST (there is nowhere else for it to go but back under
        # the staging name), then restore the original. Doing this in the
        # other order can't work: $LIVE_DB_NAME is still occupied.
        if psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$LIVE_DB_NAME\" RENAME TO \"$STAGING_DB_NAME\";" \
            && psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$ROLLBACK_DB_NAME\" RENAME TO \"$LIVE_DB_NAME\";"; then
            log "database rolled back (promoted content moved aside as \"$STAGING_DB_NAME\")"
        else
            db_ok=0
            log "MANUAL ACTION REQUIRED: database is in a mixed state — inspect \"$LIVE_DB_NAME\", \"$ROLLBACK_DB_NAME\", \"$STAGING_DB_NAME\" by hand"
        fi
    else
        db_ok=0
        log "MANUAL ACTION REQUIRED: neither database \"$LIVE_DB_NAME\" nor \"$ROLLBACK_DB_NAME\" exists — inspect by hand"
    fi

    if [[ -d "$MEDIA_ROOT" && ! -d "$ROLLBACK_MEDIA_ROOT" ]]; then
        log "media: live media was never moved away, nothing to roll back"
    elif [[ ! -d "$MEDIA_ROOT" && -d "$ROLLBACK_MEDIA_ROOT" ]]; then
        if mv "$ROLLBACK_MEDIA_ROOT" "$MEDIA_ROOT"; then
            log "media rolled back"
        else
            media_ok=0
            log "MANUAL ACTION REQUIRED: move $ROLLBACK_MEDIA_ROOT back to $MEDIA_ROOT by hand"
        fi
    elif [[ -d "$MEDIA_ROOT" && -d "$ROLLBACK_MEDIA_ROOT" ]]; then
        # Mirrors the database branch above — only reachable from a partial
        # (e.g. cross-filesystem) `mv`, but handled the same way rather than
        # guessed at: move the promoted content aside, then restore the
        # original.
        if mv "$MEDIA_ROOT" "$STAGING_MEDIA_ROOT" && mv "$ROLLBACK_MEDIA_ROOT" "$MEDIA_ROOT"; then
            log "media rolled back (promoted content moved aside as $STAGING_MEDIA_ROOT)"
        else
            media_ok=0
            log "MANUAL ACTION REQUIRED: media is in a mixed state — inspect $MEDIA_ROOT, $ROLLBACK_MEDIA_ROOT, $STAGING_MEDIA_ROOT by hand"
        fi
    else
        media_ok=0
        log "MANUAL ACTION REQUIRED: neither $MEDIA_ROOT nor $ROLLBACK_MEDIA_ROOT exists — inspect by hand"
    fi

    if [[ "$db_ok" == "1" && "$media_ok" == "1" ]]; then
        systemctl start pantry-api 2>/dev/null || true
        log "rollback succeeded — database and media are back on the original matched pair; pantry-api restarted"
    else
        log "rollback INCOMPLETE — pantry-api NOT restarted; resolve the manual action(s) above, confirm database and media are a matched pair, then start pantry-api by hand"
    fi
}

log "entering maintenance mode: stopping pantry-api"
systemctl stop pantry-api

CUTOVER_STARTED=1

# Each cutover step is checked explicitly rather than relying on `errexit` to
# abort the group — `set -e` does NOT apply to a command whose exit status is
# itself being tested (e.g. as the left-hand side of `||`, or the condition of
# an `if`), so a `{ …steps… } || { cutover_rollback; exit 1; }` group silently
# ignores every failure except the last command's, letting the cutover half-
# apply while the script still reports success (reviewer-p7 IC1).

log "terminating connections to $LIVE_DB_NAME before rename"
if ! psql "$MAINT_DB_URL" -X -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$LIVE_DB_NAME' AND pid <> pg_backend_pid();" >/dev/null; then
    cutover_rollback
    exit 1
fi

log "renaming live database $LIVE_DB_NAME → $ROLLBACK_DB_NAME"
if ! psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$LIVE_DB_NAME\" RENAME TO \"$ROLLBACK_DB_NAME\";"; then
    cutover_rollback
    exit 1
fi

log "renaming staging database $STAGING_DB_NAME → $LIVE_DB_NAME"
if ! psql "$MAINT_DB_URL" -X -q -c "ALTER DATABASE \"$STAGING_DB_NAME\" RENAME TO \"$LIVE_DB_NAME\";"; then
    cutover_rollback
    exit 1
fi

log "moving live media $MEDIA_ROOT → $ROLLBACK_MEDIA_ROOT"
if ! mv "$MEDIA_ROOT" "$ROLLBACK_MEDIA_ROOT"; then
    cutover_rollback
    exit 1
fi

log "moving staged media $STAGING_MEDIA_ROOT → $MEDIA_ROOT"
if ! mv "$STAGING_MEDIA_ROOT" "$MEDIA_ROOT"; then
    cutover_rollback
    exit 1
fi

log "restarting pantry-api"
systemctl start pantry-api

if ! wait_for_healthy; then
    log "CUTOVER health check failed after restart — attempting automatic rollback"
    cutover_rollback
    exit 1
fi

log "cutover complete. Rollback copies retained: database \"$ROLLBACK_DB_NAME\", media $ROLLBACK_MEDIA_ROOT"
log "restore complete"
