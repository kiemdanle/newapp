# Rotate secrets runbook

**Cadence:** annually and after suspected compromise.
**Scope:** operator-managed application environment files and backup credentials.

The Ansible `secrets` role does not write application secrets. It requires
`/etc/pantry/secrets/api.env` and `/etc/pantry/secrets/admin.env` to exist,
then enforces `pantry:pantry` ownership and mode `0600`. It creates the backup
age keypair once at `/etc/pantry/secrets/age.key` and `age.pub`.

## Procedure

1. Identify the affected value and its owning provider. Create the replacement
   using that provider's rotation process.
2. Update only the relevant operator-managed env file. Keep its owner and mode:
   ```bash
   sudo chown pantry:pantry /etc/pantry/secrets/api.env /etc/pantry/secrets/admin.env
   sudo chmod 0600 /etc/pantry/secrets/api.env /etc/pantry/secrets/admin.env
   ```
3. Restart the service that reads the changed file:
   ```bash
   sudo systemctl restart pantry-api.service
   sudo systemctl restart pantry-admin.service
   ```
   Restart both when the affected dependency is shared or uncertain. These units
   have no documented `ExecReload` path.
4. Verify the API readiness endpoint and the specific integration using the
   production domains configured for the host. Review recent service logs without
   printing secrets.
5. Revoke the old provider credential only after the replacement works. Record
   the date, operator, scope, and reason in the operator's rotation log.

## JWT access-secret incident

Changing `JWT_ACCESS_SECRET` invalidates access tokens signed with the prior key.
Pair that action with the [revoke all sessions](revoke-all-sessions.md) procedure
when immediate re-authentication is required.

## Backup encryption

The default backup driver uses an age recipient from `BACKUP_AGE_RECIPIENT` or
`/etc/pantry/secrets/age.pub`; restores use the private key (default
`/etc/pantry/secrets/age.key`). Preserve every required private key for retained
backups. Validate a new backup credential through a scratch restore drill before
retiring the old recovery material.
