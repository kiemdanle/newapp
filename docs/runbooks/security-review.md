# Security review checklist

Run before first launch, then quarterly. Every item has a command + expected output. Tick only after the command passes.

## TLS / nginx

- [ ] **HSTS header present**
  ```bash
  curl -sI https://api.pantry.example/health | grep -i strict-transport-security
  # Expected: strict-transport-security: max-age=31536000; includeSubDomains; preload
  ```

- [ ] **TLS 1.2+ only (TLS 1.0/1.1 disabled)**
  ```bash
  nmap --script ssl-enum-ciphers -p 443 api.pantry.example | grep -E 'TLSv1\.[01]'
  # Expected: no output (no TLS 1.0/1.1 lines)
  ```

- [ ] **Request body size cap enforced (1 MB default; 5 MB on avatar upload route)**
  ```bash
  head -c 6000000 /dev/urandom | base64 | curl -sI -X POST https://api.pantry.example/v1/auth/login \
    -H "Content-Type: application/json" --data-binary @-
  # Expected: 413 Payload Too Large
  ```

- [ ] **Rate limit fires on /v1/auth/***`
  ```bash
  for i in $(seq 1 15); do curl -sI -X POST https://api.pantry.example/v1/auth/login \
    -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"x"}'; done | grep -c '429'
  # Expected: at least 5 (default limit is 10/min/IP per spec §6.8)
  ```

## Postgres

- [ ] **Localhost only**
  ```bash
  ssh pantry@prod-host "sudo ss -tlnp | grep ':5432'"
  # Expected: only 127.0.0.1:5432, no 0.0.0.0:5432
  ```

- [ ] **App user has no superuser**
  ```bash
  ssh pantry@prod-host "sudo -u postgres psql -At -c \"SELECT rolsuper FROM pg_roles WHERE rolname='pantry_app';\""
  # Expected: f
  ```

- [ ] **Read-only role exists for ad-hoc queries**
  ```bash
  ssh pantry@prod-host "sudo -u postgres psql -At -c \"SELECT 1 FROM pg_roles WHERE rolname='pantry_ro';\""
  # Expected: 1
  ```

## ufw + fail2ban

- [ ] **ufw allows only 22, 80, 443**
  ```bash
  ssh pantry@prod-host "sudo ufw status numbered"
  # Expected: lines for 22, 80, 443 ALLOW; everything else default deny
  ```

- [ ] **fail2ban active on ssh**
  ```bash
  ssh pantry@prod-host "sudo fail2ban-client status sshd"
  # Expected: Currently banned: <some int>, Total banned: <some int>
  ```

## Secrets

- [ ] **`/etc/pantry/.env.production` is mode 600 owned by pantry**
  ```bash
  ssh pantry@prod-host "stat -c '%a %U:%G' /etc/pantry/.env.production"
  # Expected: 600 pantry:pantry
  ```

- [ ] **No secrets in logs (grep the journal for env var values)**
  ```bash
  # Pick one safe sentinel from the env file, e.g., first 8 chars of JWT key
  ssh pantry@prod-host "sudo journalctl -u pantry-api --since '1 day ago' | grep -F '<sentinel>' | head"
  # Expected: empty output
  ```

## Admin

- [ ] **Admin nginx vhost enforces IP allowlist**
  ```bash
  curl -sI https://admin.pantry.example/login
  # Expected from a non-allowlisted IP: 403
  # Expected from an allowlisted IP: 200
  ```

- [ ] **TOTP required for admin accounts**
  ```bash
  curl -s -X POST https://api.pantry.example/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@pantry.example","password":"<correct>"}' | jq .requiresTotp
  # Expected: true (login response uses camelCase `requiresTotp` per the API contract)
  ```

- [ ] **Admin audit log is append-only (no UPDATE/DELETE grants)**
  ```bash
  ssh pantry@prod-host "sudo -u postgres psql -d pantry -At -c \"
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

- [ ] **Renovate bot is enabled and producing PRs**
  Check https://github.com/pantry-org/pantry/pulls?q=is%3Apr+author%3Arenovate
  Expected: at least one PR in the last 30 days

## Mobile

- [ ] **App talks only to api.pantry.example**
  ```bash
  grep -RIn 'http://\|https://' apps/mobile/src | grep -v 'api.pantry.example\|expo.dev\|openfoodfacts\|upcitemdb'
  # Expected: empty
  ```

- [ ] **Tokens stored in expo-secure-store, not AsyncStorage**
  ```bash
  grep -RIn 'AsyncStorage' apps/mobile/src/auth
  # Expected: empty
  ```

## Sign-off

- Reviewer: _______
- Date: _______
- Outstanding items: _______
