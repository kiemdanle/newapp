# Expyrico — Deployment Guide

The reference deployment is a single self-hosted Ubuntu VPS provisioned with
Ansible and served through nginx. Both services (API and admin) run as systemd
units under `/opt/pantry`. Releases are cut by a GitHub Actions pipeline that
ships a tarball and runs an ordered deploy script on the host.

> Legacy naming: the install root, systemd units, and Ansible play still use the
> `pantry` name. The packages are `@expyrico/*`.

## Topology

```
Internet
  -> nginx (2 vhosts: api, admin; TLS via certbot; rate-limit zones)
       -> pantry-api.service    (Fastify, 127.0.0.1:4000)
       -> pantry-admin.service  (Next.js standalone, 127.0.0.1:4001)
  -> PostgreSQL (local)
  -> Redis (local)
```

## Provisioning (Ansible)

`infra/site.yml` (play "Provision Pantry VPS", host group `linhkienkts`,
`become: true`) asserts Ubuntu 22.04 or 24.04 and runs roles in order:

```
common  -> postgres -> redis -> nodejs -> secrets -> app -> nginx -> certbot
```

- **common**: base packages + logrotate.
- **postgres**: PostgreSQL + `pg_hba` template.
- **redis**: Redis + `redis.conf`.
- **nodejs**: Node runtime.
- **secrets**: writes environment/secret material to the host.
- **app**: systemd units, sudoers, deploy key, backup cron (see below).
- **nginx**: two vhosts + shared rate-limit config.
- **certbot**: Let's Encrypt via webroot + `reload-nginx.sh`.

Templates: `ansible.cfg`, `group_vars/all.example.yml`, `inventory.example.ini`.
Copy the `.example` files and fill them in for a real inventory.

### app role details

- systemd units `pantry-api.service` (:4000) and `pantry-admin.service` (:4001),
  `Type=simple`.
- Restart-only sudoers: `NOPASSWD` limited to restart/start/stop of the two
  units, validated with `visudo`.
- GitHub Actions deploy key added to `authorized_keys`.
- Nightly backup cron at **03:17 UTC**.
- Manual UptimeRobot reminder (monitoring is not auto-provisioned).

## nginx

Two vhosts proxy to the local ports. Shared rate-limit zones live in
`/etc/nginx/conf.d/pantry-shared.conf` (`pantry_global` 30r/m, `pantry_auth`
10r/m). Optional admin IP allowlist. TLS is sequence-aware: HTTP-only until certs
exist, then HTTPS.

- **API vhost**: allows only `/`, `/v1/*`, `/health`, `/health/ready`, and ACME;
  everything else returns 404.
- **Admin vhost**: sets `X-Frame-Options: DENY`.
- Both vhosts set HSTS, `X-Content-Type-Options: nosniff`, and
  `Referrer-Policy: no-referrer`.

> **Gap**: there is **no Content-Security-Policy** anywhere — not in nginx, not
> in the admin app, not beyond helmet's default in the API. Adding a hand-tuned
> CSP is tracked in the roadmap.

## Release pipeline (GitHub Actions)

Workflows in `.github/workflows/`:

- **ci.yml**: mobile typecheck / lint / tests plus a11y, WCAG-contrast, snapshot,
  and touch-target checks. The nightly Maestro E2E job is currently TODO /
  commented out.
- **audit.yml**: weekly `pnpm audit`; opens a labeled GitHub issue on findings.
- **deploy.yml**: triggers on push to `main` (concurrency group `deploy-prod`,
  no-cancel). Three jobs:
  1. **test** — Postgres 16 + Redis 7 services; runs Prisma + typecheck + test.
  2. **build** — `prisma generate` + `pnpm -r build` + tar the release.
  3. **deploy** — SSH/scp the tarball to `/opt/pantry/releases/$SHA`, run
     `deploy-remote.sh`, then `gh release create`.

## On-host deploy (`infra/scripts/deploy-remote.sh`)

Ordered, atomic release with rollback:

1. Full install (including dev deps — the Prisma CLI is a devDependency).
2. `prisma migrate deploy`.
3. `pnpm prune --prod`.
4. Atomic `ln -sfn` to point `current` at the new release.
5. `systemctl restart` both units.
6. Smoke test `/health/ready` (5x with backoff).
7. On failure, roll back to the previous release.
8. Keep the last 5 releases.

Backup/restore: `infra/scripts/backup.sh` and `restore.sh` are present;
`certbot` reloads via `reload-nginx.sh`.

> **Verified bug (high priority)**: `deploy-remote.sh` (lines ~57-59) runs the
> Prisma steps filtered on the wrong package name:
>
> ```sh
> pnpm --filter @pantry/api exec prisma generate
> pnpm --filter @pantry/api exec prisma migrate deploy
> ```
>
> The actual package is `@expyrico/api`, so these filters match nothing and the
> migrate step no-ops or fails during release. `deploy.yml` uses the correct
> `@expyrico/api`. Fix the filter to `@expyrico/api` before relying on
> auto-migration during deploy.

## Environment variables (API)

The API validates all of these via zod in `src/config.ts` and fails fast if a
critical var is missing or malformed.

| Var | Notes |
| --- | --- |
| `NODE_ENV` | environment |
| `PORT` | default 4000 |
| `HOST` | default 127.0.0.1 |
| `LOG_LEVEL` | pino level |
| `DATABASE_URL` | PostgreSQL |
| `REDIS_URL` | Redis |
| `JWT_ACCESS_SECRET` | >= 32 chars |
| `JWT_ACCESS_TTL_SECONDS` | default 900 |
| `JWT_ISSUER`, `JWT_AUDIENCE` | token claims |
| `REFRESH_TOKEN_TTL_DAYS` | default 30 |
| `RATE_LIMIT_ENABLED` | toggle rate limiting |
| `RATE_LIMIT_PER_USER_PER_MIN` | default 60 |
| `RATE_LIMIT_PER_IP_PER_MIN` | default 30 |
| `RATE_LIMIT_AUTH_PER_IP_PER_MIN` | default 10 |
| `TOTP_ENCRYPTION_KEY` | 32-byte base64 |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` | Apple OAuth |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` | passkeys |
| `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER?`, `SMTP_PASS?`, `SMTP_FROM` | email |
| `APP_DEEP_LINK` | password-reset deep link base |
| `ADMIN_URL` | CORS allowlist + links |
| `COUNTRY_DETECT_PRIMARY`, `COUNTRY_DETECT_FALLBACK` | geo detection |

### Admin environment variables

Validated in `src/lib/env.ts` (cached, fail-fast): `API_BASE_URL`,
`COOKIE_SECURE`, `COOKIE_DOMAIN`, `NODE_ENV`. Cookies are `SameSite=Lax`, with
`Secure`/`Domain` driven by `COOKIE_SECURE`/`COOKIE_DOMAIN`.

Never commit `.env*` files, secrets, or keys. Secrets are delivered to the host
by the Ansible `secrets` role.

## Mobile build and distribution

Expo Go and EAS are not used. Builds are local Gradle + adb.

```bash
pnpm mobile:apk   # assembleRelease; pins JAVA_HOME to Android Studio JBR
```

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
`applicationId com.expyrico.app`, versionCode 1, versionName 0.0.1. Kotlin is
pinned to 2.0.21 via expo-build-properties (needed for react-native-passkey
coroutines metadata). The app points at `https://api.linhkienkts.com`.

> **Verified bug**: the release build type uses `signingConfigs.debug`
> (`android/app/build.gradle`, line ~37), so release APKs are signed with the
> debug key. This is fine for sideload testing but blocks Play Store
> distribution. A production keystore is required before store submission.

> **Verified issue**: deep-link scheme mismatch. `app.config.ts` scheme is
> `Expyrico`, the Android manifest registers `expyrico`, but `parseAuthDeepLink`
> only accepts the `pantry:` protocol and SecureStore keys are `pantry.*`.
> Password-reset deep links therefore depend on the backend emitting `pantry:`
> links. Align these before changing the scheme.

## Health checks

The API exposes `/health` and `/health/ready`. The deploy script smoke-tests
`/health/ready` after restart; nginx allows both through on the API vhost.
