#!/usr/bin/env bash
#
# Functional simulation for restore.sh's cutover/rollback logic (reviewer-p7
# IC1, IC2, II4, II6). Never touches the live database, live media, systemd,
# or /etc/pantry — everything here runs against disposable Postgres databases
# and a disposable temp directory, mirroring the verbatim-transcription
# method reviewer-p7 used to find IC1/IC2 in the first place.
#
# What this proves:
#   - IC2: `cutover_rollback` — extracted verbatim from restore.sh, never
#     hand-duplicated — correctly detects and repairs each of the three
#     reachable post-CUTOVER_STARTED database/media states, and only
#     "restarts" pantry-api (faked in this harness) when the resource it
#     covers actually lands back on a matched pair.
#   - II4: the staging database name is unique per run (GENERATION_ID-suffixed).
#
# IC1 (explicit per-step `if ! step; then …; fi` instead of an `{ … } || { … }`
# group) is a control-flow shape, not a state transition — it's covered by
# static inspection here (grep asserts the buggy pattern is gone) since
# faithfully simulating five real psql/mv failure injections adds much more
# harness complexity than the property being checked warrants; the state
# outcomes IC1 was supposed to prevent are exactly what the IC2 scenarios
# below exercise.
#
# Usage: ./restore-cutover-simulation.test.sh
# Exit 0 = every scenario ended in the correct state. Exit 1 = a scenario
# failed, with the mismatch printed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTORE_SH="$SCRIPT_DIR/restore.sh"

# No default — a prior version of this line hardcoded a real credential
# here (reviewer-p7 R3). Always point this at a disposable, non-production
# Postgres instance.
: "${SIM_DB_URL_BASE:?SIM_DB_URL_BASE is required — a disposable Postgres connection base (e.g. postgresql://user:pass@127.0.0.1:5432), never a production credential}"
DB_URL_BASE="$SIM_DB_URL_BASE"
MAINT_DB_URL="$DB_URL_BASE/postgres"

FAILURES=0
pass() { printf '  PASS: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

echo "=== IC1: the buggy '{ …steps… } || { … }' group is gone ==="
if grep -qE '^\} \|\| \{$' "$RESTORE_SH"; then
    fail "restore.sh still contains the '} || {' group shape IC1 flagged"
else
    pass "no '{ …steps… } || { … }' group present"
fi
if grep -c 'cutover_rollback$' "$RESTORE_SH" | grep -qE '^[5-9]|^[1-9][0-9]+$'; then
    pass "cutover_rollback is called from multiple independent per-step guards"
else
    fail "expected cutover_rollback to be called from several independent per-step guards"
fi

# --- Extract the real functions from restore.sh, verbatim, so this harness
# can never silently drift from what actually ships. -------------------------
EXTRACTED="$(mktemp)"
SIM_ROOT="$(mktemp -d)"
cleanup() { rm -f "$EXTRACTED"; rm -rf "$SIM_ROOT"; }
trap cleanup EXIT

awk '/^db_exists\(\) \{/,/^\}/' "$RESTORE_SH" >> "$EXTRACTED"
printf '\n' >> "$EXTRACTED"
awk '/^cutover_rollback\(\) \{/,/^\}/' "$RESTORE_SH" >> "$EXTRACTED"

if [[ ! -s "$EXTRACTED" ]] || ! grep -q '^cutover_rollback() {' "$EXTRACTED"; then
    echo "ERROR: failed to extract db_exists/cutover_rollback from $RESTORE_SH — harness is stale" >&2
    exit 2
fi

db_create() {
    psql "$MAINT_DB_URL" -X -q -c "DROP DATABASE IF EXISTS \"$1\";" -c "CREATE DATABASE \"$1\";" >/dev/null
}
db_drop() {
    psql "$MAINT_DB_URL" -X -q -c "DROP DATABASE IF EXISTS \"$1\";" >/dev/null 2>&1 || true
}
db_present() {
    psql "$MAINT_DB_URL" -X -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" 2>/dev/null | grep -q 1
}

RUN_ID="p7sim_$(date +%s)_$$"

# Runs cutover_rollback against a fresh disposable live/rollback/staging DB
# triple and media triple prepared by $setup, then asserts the end state.
#
#   expect_matched:  1 = both the database and media should be a restored
#                    matched pair afterward (live present, rollback absent;
#                    media present, rollback-media absent).
#                    0 = at least one side is expected to remain unresolved
#                    (a state this harness never actually drives into, kept
#                    for symmetry/documentation — every reachable state IC2
#                    fixes DOES resolve to a matched pair).
#   expect_restart:  1 = pantry-api should have been "restarted" (only true
#                    when both sides resolved); 0 = it must NOT have been.
run_scenario() {
    local name="$1" setup="$2" expect_matched="$3" expect_restart="$4"

    local live="${RUN_ID}_live" rollback="${RUN_ID}_rollback" staging="${RUN_ID}_staging"
    local scenario_dir="$SIM_ROOT/$name"
    local media="$scenario_dir/media" rollback_media="$scenario_dir/media.rollback" staging_media="$scenario_dir/media.staging"
    mkdir -p "$scenario_dir"
    db_drop "$live"; db_drop "$rollback"; db_drop "$staging"
    rm -rf "$media" "$rollback_media" "$staging_media"

    eval "$setup"

    local restart_marker="$scenario_dir/restarted"
    rm -f "$restart_marker"

    (
        MAINT_DB_URL="$MAINT_DB_URL"
        LIVE_DB_NAME="$live"
        ROLLBACK_DB_NAME="$rollback"
        STAGING_DB_NAME="$staging"
        MEDIA_ROOT="$media"
        ROLLBACK_MEDIA_ROOT="$rollback_media"
        STAGING_MEDIA_ROOT="$staging_media"
        export MAINT_DB_URL LIVE_DB_NAME ROLLBACK_DB_NAME STAGING_DB_NAME MEDIA_ROOT ROLLBACK_MEDIA_ROOT STAGING_MEDIA_ROOT
        # shellcheck source=/dev/null
        source "$EXTRACTED"
        systemctl() { if [[ "${2:-}" == "pantry-api" ]]; then touch "$restart_marker"; fi; }
        log() { :; }
        cutover_rollback
    )

    echo "--- scenario: $name ---"
    local live_exists=0 rollback_exists=0
    db_present "$live" && live_exists=1
    db_present "$rollback" && rollback_exists=1
    local db_matched=0
    [[ "$live_exists" == "1" && "$rollback_exists" == "0" ]] && db_matched=1

    local media_matched=0
    [[ -d "$media" && ! -d "$rollback_media" ]] && media_matched=1

    if [[ "$expect_matched" == "1" ]]; then
        if [[ "$db_matched" == "1" ]]; then pass "$name: database restored to a matched pair"; else fail "$name: database NOT a matched pair (live=$live_exists rollback=$rollback_exists)"; fi
        if [[ "$media_matched" == "1" ]]; then pass "$name: media restored to a matched pair"; else fail "$name: media NOT a matched pair"; fi
    fi

    if [[ "$expect_restart" == "1" ]]; then
        if [[ -f "$restart_marker" ]]; then pass "$name: pantry-api restarted"; else fail "$name: pantry-api was NOT restarted (expected it to be, both sides matched)"; fi
    else
        if [[ ! -f "$restart_marker" ]]; then pass "$name: pantry-api correctly NOT restarted on an incomplete rollback"; else fail "$name: pantry-api was restarted despite an incomplete rollback"; fi
    fi

    db_drop "$live"; db_drop "$rollback"; db_drop "$staging"
}

echo
echo "=== IC2: cutover_rollback state detection — database ==="

# Failure before the first rename ran — live untouched, rollback never created.
run_scenario "before-any-rename" '
    db_create "$live"
    mkdir -p "$media"
' 1 1

# Only the first rename (live -> rollback) succeeded; staging is still under
# its own name — the ONE state the original buggy guard handled correctly.
run_scenario "after-first-rename-only" '
    db_create "$rollback"
    db_create "$staging"
    mkdir -p "$media"
' 1 1

# BOTH renames succeeded (live now holds the promoted/staging content,
# rollback holds the original), then a later step failed — IC2's exact
# repro: the buggy guard silently skipped the database rollback here.
run_scenario "after-both-renames" '
    db_create "$live"
    db_create "$rollback"
    mkdir -p "$media"
' 1 1

echo
echo "=== IC2: cutover_rollback state detection — media (mirrors the DB states) ==="

run_scenario "media-untouched" '
    db_create "$live"
    mkdir -p "$media"
' 1 1

run_scenario "media-moved-only" '
    db_create "$live"
    mkdir -p "$rollback_media"
' 1 1

echo
echo "=== IC2: an unrecoverable state never restarts pantry-api ==="

# Neither database name exists — nothing this function can safely guess at.
run_scenario "neither-db-exists" '
    : # nothing created — simulates catastrophic loss of both names
' 0 0

echo
echo "=== II4: staging DB name is unique per invocation ==="
# Reads the real assignment line out of restore.sh (never a hand-copied
# formula) so this actually exercises what the script does today — against
# the pre-fix script (a fixed "${LIVE_DB_NAME}_restore_staging" with no
# GENERATION_ID in it at all), both evaluations below produce the same name
# and this correctly fails.
STAGING_NAME_LINE="$(grep -m1 '^STAGING_DB_NAME=' "$RESTORE_SH")"
LIVE_DB_NAME="live"
GENERATION_ID="restore-20260730T120000Z"
eval "$STAGING_NAME_LINE"
NAME_A="$STAGING_DB_NAME"
GENERATION_ID="restore-20260730T120001Z"
eval "$STAGING_NAME_LINE"
NAME_B="$STAGING_DB_NAME"
if [[ "$NAME_A" != "$NAME_B" ]]; then
    pass "distinct GENERATION_IDs produce distinct staging DB names ($NAME_A vs $NAME_B)"
else
    fail "distinct GENERATION_IDs collided on the same staging DB name ($NAME_A)"
fi

echo
if [[ "$FAILURES" -eq 0 ]]; then
    echo "All cutover/rollback simulation scenarios passed."
    exit 0
else
    echo "$FAILURES scenario(s) failed."
    exit 1
fi
