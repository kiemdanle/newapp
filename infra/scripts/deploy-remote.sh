#!/usr/bin/env bash
#
# Run on the VPS as the `pantry` user. Assumes a freshly-rsynced release tree
# at /opt/pantry/releases/<SHA>/ that contains the full repo with api/dist
# and apps/admin/.next/standalone already built.
#
# Usage: deploy-remote.sh <SHA> <API_DOMAIN>
#
# Order is load-bearing (amendment 1 — migrate before prune):
#   1. install all deps (incl. dev — Prisma CLI is a devDependency)
#   2. prisma migrate deploy   ← while Prisma CLI is still on disk
#   3. pnpm prune --prod       ← only AFTER migrate
#   4. atomic symlink flip     ln -sfn <new> /opt/pantry/current
#   5. systemctl restart       (NOT reload — units are Type=simple, amendment 2)
#   6. smoke /health/ready     5x with backoff; rollback on failure
#   7. prune old release dirs

set -euo pipefail

SHA="${1:?sha required}"
API_DOMAIN="${2:?api domain required}"
APP_ROOT=/opt/pantry
NEW="$APP_ROOT/releases/$SHA"
CURRENT="$APP_ROOT/current"
LOG_FILE=/var/log/pantry/deploy.log
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG_FILE" >&2
}

if [[ ! -d "$NEW" ]]; then
    log "ERROR: release dir $NEW not found"
    exit 1
fi

# Remember the previous release for rollback
PREV=""
if [[ -L "$CURRENT" ]]; then
    PREV=$(readlink "$CURRENT")
fi
log "deploy start: sha=$SHA prev=${PREV:-<none>}"

# 1. Install the FULL dependency set first (dev included). The Prisma CLI is
#    a devDependency, so migrations must run while it is still installed.
#    Step 3 prunes dev deps. Order is load-bearing: install → migrate → prune.
#    Never run migrate after the prune.
#    NODE_ENV is unset for this step — pnpm 9 honors NODE_ENV=production by
#    skipping devDependencies (silently), which would strip the Prisma CLI
#    and break Step 2. Restored to "production" for the rest of the script
#    so the prune step still does the right thing.
log "[1/7] pnpm install --frozen-lockfile (full, dev included)"
cd "$NEW"
NODE_ENV=development pnpm install --frozen-lockfile

# 2. Run migrations while the Prisma CLI is still present.
log "[2/7] pnpm --filter @pantry/api exec prisma generate && migrate deploy"
pnpm --filter @pantry/api exec prisma generate
pnpm --filter @pantry/api exec prisma migrate deploy

# 3. Prune dev dependencies now that migrations are done.
log "[3/7] pnpm prune --prod"
pnpm prune --prod

# 4. Atomic symlink flip.
log "[4/7] ln -sfn $NEW $CURRENT"
ln -sfn "$NEW" "$CURRENT"

# 5. Restart services. SIGTERM + TimeoutStopSec=30 = documented graceful drain
#    window. The units have no ExecReload, so `reload` is a silent no-op.
log "[5/7] sudo systemctl restart pantry-api.service pantry-admin.service"
sudo /bin/systemctl restart pantry-api.service
sudo /bin/systemctl restart pantry-admin.service

# 6. Smoke test with exponential backoff.
smoke_ready() {
    local i delay url
    url="https://${API_DOMAIN}/health/ready"
    for i in 1 2 3 4 5; do
        delay=$(( i * 2 ))
        if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
            log "smoke ok via $url (attempt $i)"
            return 0
        fi
        log "smoke attempt $i via $url failed; sleeping ${delay}s"
        sleep "$delay"
    done
    return 1
}

# Local smoke as a fallback before TLS / DNS / nginx are fully wired (and
# also catches the case where the unit died during boot but nginx is fine).
smoke_local() {
    local i delay
    for i in 1 2 3 4 5; do
        delay=$(( i * 2 ))
        if curl -fsS --max-time 5 http://127.0.0.1:4000/health/ready >/dev/null 2>&1 \
            && curl -fsS --max-time 5 http://127.0.0.1:4001 >/dev/null 2>&1; then
            log "local smoke ok (attempt $i)"
            return 0
        fi
        log "local smoke attempt $i failed; sleeping ${delay}s"
        sleep "$delay"
    done
    return 1
}

log "[6/7] smoke test"
if ! smoke_ready && ! smoke_local; then
    log "SMOKE FAILED — rolling back"
    if [[ -n "$PREV" && -d "$PREV" ]]; then
        ln -sfn "$PREV" "$CURRENT"
        sudo /bin/systemctl restart pantry-api.service
        sudo /bin/systemctl restart pantry-admin.service
        log "rolled back to $PREV"
    else
        log "no previous release to roll back to"
    fi
    exit 1
fi

# 7. Prune old releases (keep last 5).
log "[7/7] pruning old releases (keep 5)"
cd "$APP_ROOT/releases"
# shellcheck disable=SC2012
ls -1t | tail -n +6 | xargs -r rm -rf

log "deploy complete: $SHA"
