# Revoke all sessions runbook

**When to use:** credential compromise of the JWT signing key, suspected mass account takeover, or an emergency where you need every user to re-authenticate immediately.

**Side effect:** every active user is signed out across all devices. Push notification tokens remain valid (they don't expire by the same mechanism).

**Estimated time:** 5 minutes.

## 1. Mark every session revoked (DB)

```bash
ssh pantry@prod-host
sudo -u postgres psql -d pantry <<'SQL'
BEGIN;
UPDATE sessions
SET revoked_at = NOW()
WHERE revoked_at IS NULL;
SELECT count(*) AS revoked FROM sessions WHERE revoked_at >= NOW() - INTERVAL '1 minute';
COMMIT;
SQL
```

Expected: the printed `revoked` count is in the ballpark of active sessions. This invalidates every refresh-token row.

## 2. Force-rotate the JWT signing key

The access token (15 min lifetime) is signed with the key in `JWT_ACCESS_SECRET`. After step 1, refresh fails immediately, but a stolen access token is still valid until expiry. Rotating the signing key kills active access tokens too.

```bash
# Generate a new key
NEW=$(openssl rand -base64 64 | tr -d '\n')
# Edit the env file
sudo -i
nano /etc/pantry/.env.production
# Set: JWT_ACCESS_SECRET=<NEW>
# Save, exit
systemctl restart pantry-api pantry-admin
```

All access tokens signed under the old key fail verification immediately and every client must re-authenticate.

> **Future enhancement:** implement a previous-key grace mechanism (e.g., `JWT_ACCESS_SECRET_PREVIOUS`) for zero-downtime JWT rotation. Not in v1.

## 3. Verify

```bash
# Existing token must now fail:
curl -i https://api.pantry.example/v1/auth/me -H "Authorization: Bearer <old-token>"
# Expected: 401 Unauthorized

# New sign-in must work:
curl -i https://api.pantry.example/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"appreview@pantry.example","password":"<demo>"}'
# Expected: 200 with new tokens
```

## 4. Communicate

Post to status page and in-app banner. Use the admin UI or PATCH the feature flag directly with the Zod-validated body shape:

```bash
curl -X PATCH https://admin.pantry.example/api/feature-flags \
  -H "Content-Type: application/json" \
  -d '{ "maintenanceBanner": "For security reasons we have signed everyone out. Please sign in again. Your data is unaffected." }'
```

Set `maintenanceBanner: null` to clear.

## 5. Audit

Append to `admin_audit_log` via the admin UI (auto-logged when an admin runs the maintenance action) **or** insert manually:

```sql
INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, diff, ip)
VALUES ('<your-admin-uuid>', 'sessions.revoke_all', 'system', 'all',
        '{"reason":"<short-reason>"}'::jsonb, '127.0.0.1');
```
