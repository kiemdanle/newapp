# Revoke all sessions runbook

**Use when:** a credential compromise, suspected account takeover, or an
incident requires every client to sign in again.

**Effect:** revoking database sessions stops refreshes. Rotating
`JWT_ACCESS_SECRET` also invalidates still-live access tokens.

## 1. Revoke refresh sessions

Run against production only after confirming the target database:

```sql
BEGIN;
UPDATE sessions
SET revoked_at = NOW()
WHERE revoked_at IS NULL;
SELECT count(*) AS revoked
FROM sessions
WHERE revoked_at >= NOW() - INTERVAL '1 minute';
COMMIT;
```

Record the result and incident reference. The schema uses `sessions` and
`revoked_at`; verify the current schema before any manual database change.

## 2. Rotate the access-token signing secret

Follow [rotate-secrets.md](rotate-secrets.md) to replace `JWT_ACCESS_SECRET` in
the operator-managed API environment and restart `pantry-api.service`. This is a
hard cutover: clients holding access tokens signed by the former key must sign in
again.

## 3. Verify and communicate

- Confirm an old access token is rejected by the API and a new sign-in succeeds.
- Check API readiness and recent service logs.
- Notify affected users through the currently configured support/status channel.
- Record the action through the available admin audit mechanism; do not insert
  audit rows manually unless the current schema and access policy explicitly
  permit it.
