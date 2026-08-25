# Security review checklist

Run before first launch, then quarterly. Every item has a command + expected output. Tick only after the command passes.

## TLS / nginx

- [ ] **HSTS header present**
  ```bash
  curl -sI https://api.linhkienkts.com/health | grep -i strict-transport-security
  # Expected: strict-transport-security: max-age=31536000; includeSubDomains; preload
  ```

- [ ] **TLS 1.2+ only (TLS 1.0/1.1 disabled)**
  ```bash
  nmap --script ssl-enum-ciphers -p 443 api.linhkienkts.com | grep -E 'TLSv1\.[01]'
  # Expected: no output (no TLS 1.0/1.1 lines)
  ```

- [ ] **Request body size cap enforced (1 MB default; 5 MB on avatar upload route)**
  ```bash
  head -c 6000000 /dev/urandom | base64 | curl -sI -X POST https://api.linhkienkts.com/v1/auth/login \
    -H "Content-Type: application/json" --data-binary @-
  # Expected: 413 Payload Too Large
  ```

- [ ] **Rate limit fires on auth endpoints**
  ```bash
  for i in $(seq 1 15); do curl -sI -X POST https://api.linhkienkts.com/v1/auth/login \
    -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"x"}'; done | grep -c '429'
  # Expected: responses eventually include 429 at the configured auth limit
  ```

## Postgres

- [ ] **Localhost only**
  ```bash
  ssh pantry@<production-host> "sudo ss -tlnp | grep ':5432'"
  # Expected: only 127.0.0.1:5432, no 0.0.0.0:5432
  ```

- [ ] **App user has no superuser**
  ```bash
  ssh pantry@<production-host> "sudo -u postgres psql -At -c \"SELECT rolsuper FROM pg_roles WHERE rolname='pantry_app';\""
  # Expected: f
  ```

- [ ] **Read-only role exists for ad-hoc queries**
  ```bash
  ssh pantry@<production-host> "sudo -u postgres psql -At -c \"SELECT 1 FROM pg_roles WHERE rolname='pantry_ro';\""
  # Expected: 1
  ```

## ufw + fail2ban

- [ ] **ufw allows only 22, 80, 443**
  ```bash
  ssh pantry@<production-host> "sudo ufw status numbered"
  # Expected: lines for 22, 80, 443 ALLOW; everything else default deny
  ```

- [ ] **fail2ban active on ssh**
  ```bash
  ssh pantry@<production-host> "sudo fail2ban-client status sshd"
  # Expected: Currently banned: <some int>, Total banned: <some int>
  ```

## Secrets

- [ ] **Operator-managed env files are protected**
  ```bash
  ssh pantry@<production-host> "stat -c '%a %U:%G %n' /etc/pantry/secrets/api.env /etc/pantry/secrets/admin.env"
  # Expected: 600 pantry:pantry for both files
  ```

- [ ] **No secrets in logs (grep the journal for env var values)**
  ```bash
  # Pick one safe sentinel from the env file, e.g., first 8 chars of JWT key
  ssh pantry@<production-host> "sudo journalctl -u pantry-api --since '1 day ago' | grep -F '<sentinel>' | head"
  # Expected: empty output
  ```

## Admin

- [ ] **Admin nginx vhost enforces IP allowlist**
  ```bash
  curl -sI https://admin.linhkienkts.com/login
  # Expected from a non-allowlisted IP: 403
  # Expected from an allowlisted IP: 200
  ```

- [ ] **TOTP required for admin accounts**
  ```bash
  curl -s -X POST https://api.linhkienkts.com/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.invalid","password":"<correct>"}' | jq .requiresTotp
  # Expected: true (login response uses camelCase `requiresTotp` per the API contract)
  ```

- [ ] **Admin audit log is append-only (no UPDATE/DELETE grants)**
  ```bash
  ssh pantry@<production-host> "sudo -u postgres psql -d pantry -At -c \"
    SELECT privilege_type FROM information_schema.role_table_grants
    WHERE grantee='pantry_app' AND table_name='admin_audit_log';
  \""
  # Expected: only SELECT, INSERT (no UPDATE, no DELETE)
  ```

## Dependencies

- [ ] **`pnpm audit` shows no high/critical vulnerabilities**
  ```bash
  pnpm audit --audit-level=high
  # Expected: "No known vulnerabilities found"
  ```

- [ ] **Dependency-update process reviewed**
  Confirm the repository's configured dependency-update workflow and recent
  security-alert handling. Do not assume a particular bot or organization URL.

## Mobile

- [ ] **App talks only to api.linhkienkts.com**
  ```bash
  grep -RIn 'http://\|https://' apps/mobile/src | grep -v 'api.linhkienkts.com\|firebase\|openfoodfacts\|upcitemdb'
  # Expected: empty
  ```

- [ ] **Tokens stored in react-native-keychain, not AsyncStorage**
  ```bash
  grep -RIn 'AsyncStorage' apps/mobile/src/auth
  # Expected: empty
  ```

## Sign-off

- Reviewer: _______
- Date: _______
- Outstanding items: _______
