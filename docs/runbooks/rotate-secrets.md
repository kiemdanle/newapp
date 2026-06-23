# Rotate secrets runbook

**Cadence:** annual + on any suspected compromise.

**Inventory** (in `/etc/pantry/.env.production`):

- `JWT_ACCESS_SECRET` (HS256 signing key for access tokens)
- `DATABASE_URL` password (the `pantry_app` Postgres role)
- `REDIS_URL` (full URL incl. password: `redis://[:password@]localhost:6379`)
- `BACKUP_AGE_RECIPIENT` (age public recipient string for encrypting backups)
- B2 application key (used by `rclone` to upload backups; lives in `~/.config/rclone/rclone.conf` for the `pantry` user, NOT in `.env.production`)
- `SMTP_PASSWORD`
- `EXPO_ACCESS_TOKEN` (push delivery)
- `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_APPLE_PRIVATE_KEY`

All edits to `/etc/pantry/.env.production` are followed by `systemctl restart pantry-api pantry-admin` (these `Type=simple` units have no `ExecReload`, so a `reload` would be a silent no-op; restart sends SIGTERM and lets the process drain within `TimeoutStopSec=30`).

## JWT signing key

1. Generate: `openssl rand -base64 64`
2. Set the new value as `JWT_ACCESS_SECRET` in `/etc/pantry/.env.production`
3. `systemctl restart pantry-api pantry-admin`
4. **All sessions are forced to re-authenticate.** This is a hard cutover in v1.

> **Future enhancement:** implement a previous-key grace period (e.g., `JWT_ACCESS_SECRET_PREVIOUS` accepted on verify only) for zero-downtime JWT rotation. For v1, all sessions are forced to re-auth after rotation.

## Postgres `pantry_app` password

1. Generate new password: `openssl rand -base64 32`
2. Update Postgres:
   ```sql
   ALTER ROLE pantry_app WITH PASSWORD '<new>';
   ```
3. Update `DATABASE_URL` in `.env.production`
4. `systemctl restart pantry-api pantry-admin`
5. Verify: `curl https://api.pantry.example/health/ready` returns `db: true`

## Redis password

1. Generate: `openssl rand -base64 32`
2. Edit `/etc/redis/redis.conf` → `requirepass <new>`
3. Edit `/etc/pantry/.env.production` → `REDIS_URL=redis://:<new>@localhost:6379`
4. `systemctl restart redis-server pantry-api`
5. Verify: `curl https://api.pantry.example/health/ready` returns `redis: true`

## Backblaze B2 application key (used by rclone)

1. In the Backblaze B2 console, create a new application key scoped to the `pantry-backups` bucket (RW)
2. Update the credentials in `~/.config/rclone/rclone.conf` under the `[b2]` remote section:
   ```ini
   [b2]
   type = b2
   account = <new-key-id>
   key = <new-application-key>
   ```
3. Test: `rclone lsf b2:pantry-backups/`
4. Trigger a manual backup: `sudo -u pantry /opt/pantry/current/infra/scripts/backup.sh`
5. Confirm a new file lands at `b2:pantry-backups/daily/$(date -u +%Y-%m-%d).age`
6. Revoke the old application key in the B2 console

## age backup recipient

1. Generate new keypair on a workstation: `age-keygen -o pantry-age-$(date +%Y%m%d).key`
2. The output file contains both the secret key and the public recipient (`# public key: age1...`).
3. Update `BACKUP_AGE_RECIPIENT` in `/etc/pantry/.env.production` to the new `age1...` recipient string
4. `systemctl restart pantry-api`
5. Store the new private key in 1Password under "Pantry Backups → Age key (current)". Move the previous one to "Age key (N-1)". Keep two generations so that historic backups under the old recipient can still be decrypted during a restore drill.
6. After the next quarterly restore drill passes with the new key, the old generation may be archived but never deleted while any backups encrypted under it still exist.

## SMTP password

1. Rotate at the SMTP provider (e.g., Postmark / SES)
2. Update `SMTP_PASSWORD`, restart
3. Send a test verification email to your own address

## Expo access token

1. https://expo.dev/accounts/<org>/settings/access-tokens → revoke old, create new
2. Update `EXPO_ACCESS_TOKEN`, reload
3. Trigger a test push from `/admin/system/push-logs → send test`

## OAuth client secrets

1. Google Cloud Console → APIs & Services → Credentials → rotate
2. Apple Developer → Keys → revoke key, generate new, download .p8
3. Update `OAUTH_GOOGLE_CLIENT_SECRET` and `OAUTH_APPLE_PRIVATE_KEY`
4. Reload services
5. Test sign-in from a clean device

## Verify after each rotation

```bash
curl -fsS https://api.pantry.example/health/ready
# Expected: {"status":"ok","db":true,"redis":true}
sudo journalctl -u pantry-api --since "2 minutes ago" | grep -i error
# Expected: no auth/connection errors
```

## Record the rotation

Append to `docs/runbooks/secret-rotation-log.md`:

```
| YYYY-MM-DD | <operator> | <secret name> | reason |
```
