#!/usr/bin/env bash
#
# Nightly Pantry backup. Run as root via the cron installed by the app role
# at 03:17 UTC.
#
# One backup "generation" = { db.dump, media-manifest.json, media.tar },
# captured under a media-mutation freeze so the three pieces are mutually
# consistent (nothing referenced in the DB dump changed on disk between the
# manifest and the tar, and nothing was mutating while either was captured).
# Quarantine is deliberately never included — it holds no referenced media by
# definition.
#
# Two publish drivers, both push the whole generation directory:
#
#   1. age + rclone (default)
#        tar the generation dir | age -r "$BACKUP_AGE_RECIPIENT" \
#          > /var/backups/pantry/daily/<YYYY-MM-DD>.tar.age
#        rclone copy <file> "$BACKUP_RCLONE_REMOTE/daily/"
#        Rotation: 7 daily, 4 weekly (Sunday), 3 monthly (1st)
#
#   2. restic (Hetzner Storage Box, etc.)
#        Activated when RESTIC_REPOSITORY is exported (e.g. by sourcing
#        /etc/pantry/secrets/backup.env). Runs:
#            restic backup <generation-dir> --tag pantry --tag date:<...>
#            restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune
#
# Required env (sourced from /etc/pantry/secrets/backup.env if present, else
# /etc/pantry/secrets/api.env):
#
#   always:
#     DATABASE_URL                — Postgres connection string for pg_dump
#     REDIS_URL                   — for the media-mutation freeze
#     MEDIA_ROOT                  — must match the running api.env's MEDIA_ROOT
#     PANTRY_API_DIR              — default /opt/pantry/current/api (compiled
#                                    dist/scripts/media-{freeze,manifest}-cli.js
#                                    and backup-signal-cli.js live here)
#
#   age + rclone driver:
#     BACKUP_AGE_RECIPIENT        — age public key (or read from /etc/pantry/secrets/age.pub)
#     BACKUP_RCLONE_REMOTE        — e.g. b2:pantry-backups
#     BACKUP_LOCAL_DIR            — default /var/backups/pantry
#
#   restic driver:
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
: "${MEDIA_ROOT:?MEDIA_ROOT is required (must match the running api.env)}"
PANTRY_API_DIR="${PANTRY_API_DIR:-/opt/pantry/current/api}"
FREEZE_CLI="$PANTRY_API_DIR/dist/scripts/media-freeze-cli.js"
MANIFEST_CLI="$PANTRY_API_DIR/dist/scripts/media-manifest-cli.js"
SIGNAL_CLI="$PANTRY_API_DIR/dist/scripts/backup-signal-cli.js"
FREEZE_DRAIN_TIMEOUT_MS="${BACKUP_FREEZE_DRAIN_TIMEOUT_MS:-60000}"

# Defer-backups guard: if neither driver is configured, exit cleanly so the
# nightly cron does not fail. Wire one of the two before production traffic:
#   restic mode   → set RESTIC_REPOSITORY + RESTIC_PASSWORD_FILE in /etc/pantry/secrets/backup.env
#   age + rclone  → set BACKUP_RCLONE_REMOTE in env (and rclone config) and place /etc/pantry/secrets/age.pub
if [[ -z "${RESTIC_REPOSITORY:-}" && -z "${BACKUP_RCLONE_REMOTE:-}" ]]; then
    log "no backup driver configured (RESTIC_REPOSITORY and BACKUP_RCLONE_REMOTE both empty) — skipping"
    exit 0
fi

TODAY=$(date -u +%F)        # YYYY-MM-DD
DOW=$(date -u +%u)          # 1..7 (Mon=1, Sun=7)
DOM=$(date -u +%d)          # 01..31

LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pantry}"
mkdir -p "$LOCAL_DIR/daily" "$LOCAL_DIR/weekly" "$LOCAL_DIR/monthly" "$LOCAL_DIR/work"

GEN_DIR=$(mktemp -d "$LOCAL_DIR/work/gen-${TODAY}-XXXXXX")
VERIFY_DIR=""
FREEZE_ACQUIRED=0
SUCCEEDED=0

on_exit() {
    local code=$?
    if [[ "$FREEZE_ACQUIRED" == "1" ]]; then
        log "releasing media freeze"
        node "$FREEZE_CLI" release >>"$LOG_FILE" 2>&1 || log "WARNING: failed to release media freeze — it will self-expire"
    fi
    rm -rf "$GEN_DIR" "$VERIFY_DIR"
    if [[ "$SUCCEEDED" == "1" ]]; then
        node "$SIGNAL_CLI" success >>"$LOG_FILE" 2>&1 || log "WARNING: failed to record backup success signal"
    elif [[ "$code" != "0" ]]; then
        node "$SIGNAL_CLI" failure >>"$LOG_FILE" 2>&1 || log "WARNING: failed to record backup failure signal"
    fi
    exit "$code"
}
trap on_exit EXIT

# ---------------------------------------------------------------------------
# 1. Freeze: block new media mutations, drain in-flight ones. A backup that
#    can't drain within the timeout aborts rather than capturing a possibly
#    -inconsistent snapshot — the freeze self-expires on its own TTL either
#    way, so this never wedges the live system.
# ---------------------------------------------------------------------------
log "acquiring media freeze (drain timeout ${FREEZE_DRAIN_TIMEOUT_MS}ms)"
FREEZE_RESULT=$(node "$FREEZE_CLI" acquire "$FREEZE_DRAIN_TIMEOUT_MS")
FREEZE_ACQUIRED=1
log "freeze result: $FREEZE_RESULT"
if ! printf '%s' "$FREEZE_RESULT" | grep -q '"drained":true'; then
    log "ERROR: media freeze did not drain within the timeout — aborting backup without capturing anything"
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Capture, still under freeze: DB dump, media manifest, media snapshot.
# ---------------------------------------------------------------------------
log "dumping database"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$GEN_DIR/db.dump"

log "generating referenced-media manifest"
node "$MANIFEST_CLI" generate "$MEDIA_ROOT" "$GEN_DIR/media-manifest.json" >>"$LOG_FILE" 2>&1

log "snapshotting media (private + public, quarantine excluded)"
TAR_ARGS=()
[[ -d "$MEDIA_ROOT/private" ]] && TAR_ARGS+=(private)
[[ -d "$MEDIA_ROOT/public" ]] && TAR_ARGS+=(public)
if [[ ${#TAR_ARGS[@]} -eq 0 ]]; then
    log "WARNING: neither $MEDIA_ROOT/private nor $MEDIA_ROOT/public exist — writing an empty media.tar"
    tar -cf "$GEN_DIR/media.tar" --files-from=/dev/null
else
    tar -cf "$GEN_DIR/media.tar" -C "$MEDIA_ROOT" "${TAR_ARGS[@]}"
fi

# ---------------------------------------------------------------------------
# 3. Release freeze — the capture is done; publishing to remote storage can
#    happen without holding the live system's media mutations hostage.
# ---------------------------------------------------------------------------
log "releasing media freeze"
node "$FREEZE_CLI" release >>"$LOG_FILE" 2>&1
FREEZE_ACQUIRED=0

# ---------------------------------------------------------------------------
# 4. Verify every manifest-listed key against the just-captured tar contents
#    (not the live filesystem, which the freeze release above may already
#    let a new upload start changing) — extract to a scratch dir and verify
#    there, so this check proves the tar itself is complete and correct.
# ---------------------------------------------------------------------------
log "verifying media manifest against the captured tar"
VERIFY_DIR=$(mktemp -d "$LOCAL_DIR/work/verify-XXXXXX")
tar -xf "$GEN_DIR/media.tar" -C "$VERIFY_DIR"
if ! node "$MANIFEST_CLI" verify "$VERIFY_DIR" "$GEN_DIR/media-manifest.json" >>"$LOG_FILE" 2>&1; then
    log "ERROR: media manifest verification failed against the captured tar — backup is not consistent, aborting"
    exit 1
fi
rm -rf "$VERIFY_DIR"
log "manifest verification passed — generation is consistent"

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

    log "starting restic backup of generation ${TODAY} → ${RESTIC_REPOSITORY}"
    restic backup "$GEN_DIR" --tag "pantry" --tag "date:${TODAY}"

    log "applying retention 7d/4w/3m"
    restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune

    log "restic backup complete"
    SUCCEEDED=1
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

OUT="$LOCAL_DIR/daily/${TODAY}.tar.age"

log "driver=age+rclone recipient=$(printf '%s' "$BACKUP_AGE_RECIPIENT" | head -c 12)... → $OUT"
tar -cf - -C "$GEN_DIR" . \
    | age -r "$BACKUP_AGE_RECIPIENT" \
    > "$OUT"

# Local copies for weekly / monthly retention
if [[ "$DOW" == "7" ]]; then
    cp -f "$OUT" "$LOCAL_DIR/weekly/${TODAY}.tar.age"
fi
if [[ "$DOM" == "01" ]]; then
    cp -f "$OUT" "$LOCAL_DIR/monthly/${TODAY}.tar.age"
fi

# Push to remote
RCLONE_CONF="${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}"
RCLONE_FLAGS=(--config "$RCLONE_CONF")

log "uploading daily to ${BACKUP_RCLONE_REMOTE}/daily/"
rclone copy "$OUT" "${BACKUP_RCLONE_REMOTE}/daily/" "${RCLONE_FLAGS[@]}"

if [[ "$DOW" == "7" ]]; then
    log "uploading weekly to ${BACKUP_RCLONE_REMOTE}/weekly/"
    rclone copy "$LOCAL_DIR/weekly/${TODAY}.tar.age" "${BACKUP_RCLONE_REMOTE}/weekly/" "${RCLONE_FLAGS[@]}"
fi
if [[ "$DOM" == "01" ]]; then
    log "uploading monthly to ${BACKUP_RCLONE_REMOTE}/monthly/"
    rclone copy "$LOCAL_DIR/monthly/${TODAY}.tar.age" "${BACKUP_RCLONE_REMOTE}/monthly/" "${RCLONE_FLAGS[@]}"
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
    if compgen -G "$LOCAL_DIR/$subdir/*.tar.age" > /dev/null; then
        mapfile -t files < <(ls -1t "$LOCAL_DIR/$subdir"/*.tar.age)
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

SUCCEEDED=1
log "backup complete"
