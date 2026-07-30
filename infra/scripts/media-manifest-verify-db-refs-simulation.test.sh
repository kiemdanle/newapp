#!/usr/bin/env bash
#
# Functional simulation for media-manifest-cli.js's `verify-db-refs` command
# (reviewer-p7 II2). Proves the cross-check restore.sh now runs after staging
# a DB restore actually catches a manifest/database mismatch in both
# directions, not just manifest -> file the way the existing `verify`
# command does.
#
# Requires api/dist to already exist (`pnpm --dir api build`) — this drives
# the real compiled CLI restore.sh invokes in production, not a TS/vitest
# harness around it (media-manifest-cli.ts has no test-safe export surface;
# its `main()` runs unconditionally on import, same as media-freeze-cli.ts).
#
# Never touches the live database — runs against TEST_DATABASE_URL (falls
# back to DATABASE_URL) and always cleans up the rows it creates.
#
# Usage: ./media-manifest-verify-db-refs-simulation.test.sh
# Exit 0 = every scenario matched expectations. Exit 1 = a mismatch, printed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/../../api" && pwd)"
CLI="$API_DIR/dist/scripts/media-manifest-cli.js"
# node -e's require() resolution walks up from the process cwd — run from
# inside the workspace so it finds the hoisted @prisma/client regardless of
# the caller's own cwd.
cd "$API_DIR"

if [[ ! -f "$CLI" ]]; then
    echo "ERROR: $CLI does not exist — run 'pnpm --dir api build' first" >&2
    exit 2
fi

DB_URL="${SIM_DATABASE_URL:-${TEST_DATABASE_URL:-${DATABASE_URL:-}}}"
if [[ -z "$DB_URL" ]]; then
    echo "ERROR: set TEST_DATABASE_URL or DATABASE_URL to a disposable test database" >&2
    exit 2
fi
export DATABASE_URL="$DB_URL"

FAILURES=0
pass() { printf '  PASS: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "=== creating a disposable user/product/photo row ==="
IDS_JSON="$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.create({ data: { email: 'verify-db-refs-sim-'+Date.now()+'@test.local', firstName: 'T', lastName: 'U', role: 'user' } });
  const product = await prisma.product.create({ data: { barcode: 'bc-verify-db-refs-sim-'+Date.now(), name: 'T', source: 'user', createdByUserId: user.id, status: 'draft' } });
  const photo = await prisma.productPhoto.create({ data: { productId: product.id, position: 0, uploadedByUserId: user.id, moderationStatus: 'pending', mimeType: 'image/webp', displayByteSize: 1, displayWidth: 1, displayHeight: 1, thumbnailByteSize: 1, thumbnailWidth: 1, thumbnailHeight: 1, privateStorageKey: 'private/verify-db-refs-sim-key' } });
  console.log(JSON.stringify({ userId: user.id, productId: product.id, photoId: photo.id }));
  await prisma.\$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
")"
USER_ID="$(printf '%s' "$IDS_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).userId')"
PRODUCT_ID="$(printf '%s' "$IDS_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).productId')"
PHOTO_ID="$(printf '%s' "$IDS_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).photoId')"

cleanup_rows() {
    node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.productPhoto.deleteMany({ where: { id: '$PHOTO_ID' } });
  await prisma.product.deleteMany({ where: { id: '$PRODUCT_ID' } });
  await prisma.user.deleteMany({ where: { id: '$USER_ID' } });
  await prisma.\$disconnect();
})().catch(() => process.exit(0));
" >/dev/null 2>&1 || true
}
trap 'cleanup_rows; rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/matching.json" <<'EOF'
{"generatedAt":"2026-01-01T00:00:00Z","entries":[{"key":"private/verify-db-refs-sim-key","variant":"display","path":"x","sha256":"x","bytes":1}]}
EOF
cat > "$WORK_DIR/missing.json" <<'EOF'
{"generatedAt":"2026-01-01T00:00:00Z","entries":[]}
EOF
cat > "$WORK_DIR/extra.json" <<'EOF'
{"generatedAt":"2026-01-01T00:00:00Z","entries":[{"key":"private/verify-db-refs-sim-key","variant":"display","path":"x","sha256":"x","bytes":1},{"key":"private/foreign-key-not-in-db","variant":"display","path":"y","sha256":"y","bytes":1}]}
EOF

echo
echo "=== case: manifest exactly matches the database's referenced keys ==="
if node "$CLI" verify-db-refs "$WORK_DIR/matching.json"; then
    pass "matching manifest exits 0"
else
    fail "matching manifest was rejected (expected exit 0)"
fi

echo
echo "=== case: manifest is missing a key the database references ==="
if ! node "$CLI" verify-db-refs "$WORK_DIR/missing.json"; then
    pass "incomplete manifest exits non-zero"
else
    fail "incomplete manifest was accepted (expected non-zero exit)"
fi

echo
echo "=== case: manifest has a foreign key no live row references (wrong db.dump/manifest pairing) ==="
if ! node "$CLI" verify-db-refs "$WORK_DIR/extra.json"; then
    pass "foreign-key manifest exits non-zero"
else
    fail "foreign-key manifest was accepted (expected non-zero exit)"
fi

echo
if [[ "$FAILURES" -eq 0 ]]; then
    echo "All verify-db-refs simulation scenarios passed."
    exit 0
else
    echo "$FAILURES scenario(s) failed."
    exit 1
fi
