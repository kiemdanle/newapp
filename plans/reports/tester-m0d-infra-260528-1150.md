# M0d Infra — Independent Validation Report

- **Date:** 2026-05-28 11:50 +07
- **Branch:** `m0d-infra` @ `60c1fb6` (tag `m0d-infra-authored`)
- **Worktree:** `/Users/lekiemdan/newapp` (single worktree on `m0d-infra`)
- **Reviewer:** tester (independent re-run, read-only)
- **Toolchain:** ansible 2.20.6, ansible-lint 26.4.0, yamllint 1.38.0, shellcheck 0.11.0; collections `community.general` 12.6.1, `community.postgresql` 4.2.0; brew ansible
- **systemd-analyze:** unavailable on macOS (skipped, see §5)

---

## Verdict

**DONE_WITH_CONCERNS — file authoring PASSES all 10 standard checks and all 4 amendment audits. No regressions. Two non-blocking concerns are listed in §6; one tooling caveat is documented in §1.**

No pre-apply blockers. Merge is safe. Live VPS apply requires the documented manual prerequisites (rclone config, age recipient, deploy SSH key in repo secrets, secrets files placed by operator).

---

## 1. Standard checks (10/10 PASS)

| # | Check | Cmd | Exit | Notes |
|---|-------|-----|------|-------|
| 1 | git status | clean wrt branch | OK | only docs/ unrelated mods + untracked plans/.claude (none under `infra/` or `.github/`) |
| 2 | commit count | `git log --oneline main..HEAD \| wc -l` | 5 | matches dev-1 self-report |
| 3 | conventional commits | `git log --oneline main..HEAD` | OK | all `feat(infra): …` one-per-phase J→N |
| 4 | infra file count | `find infra -type f \| wc -l` | 31 | matches |
| 5 | deploy workflow | `ls .github/workflows/deploy.yml` | exists | 5462 bytes |
| 6 | ansible syntax | `ansible-playbook --syntax-check -i inventory.example.ini site.yml` | 0 | clean |
| 7 | ansible-lint production | `ansible-lint --profile production infra/` | 0 | **see caveat ↓** |
| 8 | yamllint deploy.yml | `yamllint .github/workflows/deploy.yml` | 0 | 1 warning: line 4 `on:` truthy (cosmetic, GH Actions canonical) |
| 9 | bash -n | 4 scripts (`backup.sh`, `restore.sh`, `deploy-remote.sh`, `reload-nginx.sh`) | 0 each | clean |
| 10 | shellcheck | same 4 scripts | 0 | zero findings |

**ansible-lint caveat (worth noting in dev-1 docs):** brew installs `ansible-lint` and `ansible` into separate Cellars. With a fresh shell, `ansible-lint` runs against its own libexec python which does NOT see the community collections that ship with brew `ansible`. Re-run with `ANSIBLE_COLLECTIONS_PATH=/opt/homebrew/Cellar/ansible/13.7.0/libexec/lib/python3.14/site-packages ansible-lint --profile production infra/` → `Passed: 0 failure(s), 0 warning(s) in 22 files processed of 32 encountered`. Without that env var the lint reports a fatal "couldn't resolve module/action 'community.general.timezone'" — false positive driven by collection visibility. Recommend pinning this in `infra/README.md` "Validation" section.

---

## 2. Amendment audits (4/4 PASS)

### A1 — Migrate before prune (PASS)

`infra/scripts/deploy-remote.sh` ordering (load-bearing path):
- L48 `[1/7] pnpm install --frozen-lockfile (full, dev included)`
- L53 `[2/7] pnpm --filter @pantry/api exec prisma migrate deploy`
- L57 `[3/7] pnpm prune --prod`
- L66 `[5/7] sudo systemctl restart pantry-api pantry-admin`

`.github/workflows/deploy.yml` does **not** contain `pnpm prune`; the workflow `scp`s the release tarball and delegates to `deploy-remote.sh` (line 159). Comment at L152-153 explicitly cites the load-bearing order. Test job (L54, L60) runs full install + migrate against `pantry_test` DB; build job (L82) installs full and builds. No `prune` step in the workflow → no risk of out-of-order execution. PASS.

### A2 — Restart, never reload (PASS)

- `grep -rnE "systemctl reload pantry-" infra/ .github/workflows/` → **rc=1, zero matches**
- `systemctl restart pantry-` present in:
  - `infra/scripts/deploy-remote.sh` L67-68, L108-109 (post-symlink and rollback paths)
  - `infra/roles/app/templates/sudoers-pantry.j2` L8 (NOPASSWD grants)
  - `infra/README.md` L149, L199-200 (operator docs)
- `sudoers-pantry.j2` grants exactly **6** commands: `restart/start/stop` × `pantry-api.service` + `pantry-admin.service`. No wildcards, no broader sudo. `Defaults!/bin/systemctl !requiretty` is acceptable scoping.
- Service units: both `pantry-api.service.j2` and `pantry-admin.service.j2` set `KillSignal=SIGTERM` and `TimeoutStopSec=30`. **Neither has `ExecReload`**. PASS.

### A3 — Postgres password persisted, not re-minted (PASS)

`infra/roles/postgres/tasks/main.yml`:
- L70-72: `stat: path: {{ secrets_dir }}/postgres_password` → `register: postgres_pg_password_stat`
- L74-78: `set_fact` mints via `lookup('password', '/dev/null length=32 chars=ascii_letters,digits')` **only when** `not postgres_pg_password_stat.stat.exists`, `no_log: true`
- L80-87: `copy:` writes minted password to `{{ secrets_dir }}/postgres_password` with `owner: root`, `group: root`, `mode: "0600"` — same `when:` guard, `no_log: true`
- L89-94: `slurp:` reads the file when `stat.exists` is true, registers `postgres_pg_password_slurped`
- L96-99: `set_fact: postgres_pg_password = slurp.content | b64decode | trim` when file present
- L113 onwards: `community.postgresql.postgresql_user` references `postgres_pg_password` (the resolved variable, NOT a fresh `lookup()`)

Thought experiment — playbook run twice on a clean host:
1. **Run 1:** stat → exists=false → mint → write file → set role password.
2. **Run 2:** stat → exists=true → slurp → b64decode → set role password to the SAME value already in the live DB. `postgresql_user` is idempotent; password unchanged. ✅

Comment block L66-78 explicitly contrasts the wrong pattern vs the correct pattern. PASS.

### A5 — UptimeRobot is a reminder, not automation (PASS)

- `grep -rinE "uptimerobot" infra/ .github/workflows/` → matches in `infra/README.md` (4×), `infra/roles/app/tasks/main.yml` (5× incl. comment block + debug task), `infra/roles/nginx/templates/api.vhost.j2` (1× rate-limit comment).
- `grep -rinE "api\.uptimerobot|uri:.*uptimerobot"` → **zero results**. No API call.
- `infra/roles/app/tasks/main.yml` L90-95 is an `ansible.builtin.debug` task that prints the manual instruction. Not a `uri:` call.
- README L249-264: documents manual setup, links `https://api.linhkienkts.com/health`, 5-minute interval, email alert.

PASS.

---

## 3. Deviation audit (10/10 acceptable)

| Deviation | Verdict | Evidence |
|-----------|---------|----------|
| `app_user = pantry` (not `pantryapp`) | OK | `group_vars/all.example.yml:28` `app_user: pantry`; service units User= `{{ app_user }}` (api L8, admin L8); sudoers L8 `{{ app_user }}`; cron user resolved from same var; no `pantryapp` literal anywhere in `infra/`. Consistent. |
| Secrets at `/etc/pantry/secrets/*` | OK | `group_vars/all.example.yml:31-32` defines `config_dir: /etc/pantry`, `secrets_dir: "{{ config_dir }}/secrets"`. All references templated through `{{ secrets_dir }}` (api.env, admin.env, age.key, age.pub, postgres_password). No orphan paths. README §"Required secrets" L84+ matches. |
| Backup cron 03:17 UTC | OK | `infra/roles/app/tasks/main.yml:71-77` `cron: name=pantry-backup hour="3" minute="17" job=…/backup.sh`. Default cron timezone is system; on a default Ubuntu host that's UTC unless changed. The `common.timezone` (Etc/UTC) task in `roles/common/tasks/main.yml` keeps host on UTC, so cron 03:17 = 03:17 UTC. ✅ |
| Concurrency group `deploy-prod` | OK | `.github/workflows/deploy.yml:12-15` `concurrency: group: deploy-prod cancel-in-progress: false`. yamllint clean (only the `on:` truthy warning). |
| backup.sh dual-mode (age+rclone / restic) | OK | both branches `bash -n` clean and `shellcheck` clean (rc=0). Driver gated by `RESTIC_REPOSITORY` env presence. `set -euo pipefail` at top, `:` parameter-expansion guards on required env. |
| restore.sh `RESTORE_NONINTERACTIVE` guard | OK | `infra/scripts/restore.sh:36-50` `confirm_destructive()`. Verified isolation: piped (no tty) without env → `rc=1` "refusing to run non-interactively"; piped with env=1 → bypasses. Logic correct. (Direct `bash infra/scripts/restore.sh` from this host fails earlier at `mkdir /var/log/pantry` due to permissions, which is expected on a non-target machine.) |
| 2-pass nginx HTTP→HTTPS | OK | `nginx/tasks/main.yml:54-62` stats both cert paths first, registers `nginx_*_cert_stat`. Then `template:` task with `vars: { api_tls_enabled: nginx_api_cert_stat.stat.exists }`. The vhost templates (`api.vhost.j2`, `admin.vhost.j2`) wrap the entire HTTPS server block + the `:80 → 301 https://` redirect inside `{% if api_tls_enabled | default(false) %}`. First-apply path: only `:80` listener, ACME challenge dir, `return 503` placeholder. **No `ssl_certificate` directive without cert files on disk.** ✅ |
| logrotate rotate 14 | OK | `infra/roles/common/files/logrotate-pantry`: `/var/log/pantry/*.log { daily; rotate 14; missingok; notifempty; compress; delaycompress; copytruncate; su pantry pantry }`. 14 days exceeds the 7 daily backup retention so deploy logs survive a full backup window. |
| ansible-lint name-casing fixes | OK | sampled `roles/postgres/tasks/main.yml` and `roles/nginx/tasks/main.yml` — every task name starts with capital + verb (`Add PGDG apt key`, `Install nginx`, `Stat API TLS cert`, …). Tasks read naturally; semantics unchanged. |
| `become: true` paired with `become_user` | OK | only `roles/postgres/tasks/main.yml` uses `become_user`. All 5 occurrences (L122, L132, L142, L150, L158) are immediately preceded by `become: true` (L121, L131, L141, L149, L157). 1:1 paired. |

---

## 4. Pre-apply concerns (non-blocking)

### 4a. Deploy SSH key wiring — DOCUMENTED, manual prerequisite

GHA deploy workflow uses `pantry@vps` with key from `secrets.DEPLOY_SSH_KEY`. The public side is authorized via `infra/roles/app/tasks/main.yml:48-59`:

```yaml
- name: Install GitHub Actions deploy authorized_keys
  ...
  content: |
    {{ deploy_ssh_authorized_key }}
  dest: "/home/{{ app_user }}/.ssh/authorized_keys"
  ...
  when: deploy_ssh_authorized_key | length > 0
```

`group_vars/all.example.yml:42` has `deploy_ssh_authorized_key: ""` placeholder. The pre-apply checklist in README L308-309 covers the GH side (`DEPLOY_SSH_KEY`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_HOST`, `API_DOMAIN` repo secrets). The host side (filling `deploy_ssh_authorized_key` in `group_vars/all.yml` before first apply) is implicit in checklist item L296 ("`inventory.ini` and `group_vars/all.yml` are filled in"). **Suggest:** add explicit checklist row "deploy_ssh_authorized_key in group_vars/all.yml = the public half of DEPLOY_SSH_KEY" — cheap clarity for whoever runs first apply.

### 4b. DATABASE_URL vs persisted postgres_password — coherent, requires operator action

The `postgres` role mints/persists the pantry_app password to `/etc/pantry/secrets/postgres_password` and creates the `pantry_app` role with that password. The `secrets` role does NOT mint `api.env`; it only **asserts** the file exists, sets perms, and fails out if missing.

Operator workflow (documented at README L99 + L297):
1. Run playbook once → password is minted and persisted, but role fails at `secrets` step ("api.env is missing").
2. Operator reads `/etc/pantry/secrets/postgres_password`, pastes into `DATABASE_URL=postgresql://pantry_app:<paste>@127.0.0.1:5432/pantry` inside `/etc/pantry/secrets/api.env` and `admin.env`.
3. Re-run playbook → `secrets` role validates files; downstream succeeds.

This is intentional (real secrets out of git, out of Ansible logs). README §"Required secrets" L77-100 documents it cleanly. **No conflict — no hardcoded password collides with the persisted one because no template emits a DATABASE_URL.**

The only echo of `DATABASE_URL` outside operator scope is the **test** job in `.github/workflows/deploy.yml:42` (`postgresql://pantry:pantry@localhost:5432/pantry_test`) — that's the ephemeral CI Postgres service, unrelated to prod. PASS.

### 4c. rclone config / age key — mixed manual + automated, documented

- **age key:** automated via `secrets` role (`stat → age-keygen → grep '# public key:' … > age.pub`, `creates:` guard). Re-applies don't regenerate. ✅
- **rclone config:** manual. Pre-apply checklist L301-303 explicitly lists "An rclone remote is configured at `/root/.config/rclone/rclone.conf`". `backup.sh:109` reads `${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}`. Operator has to run `rclone config` once on the host before the first nightly backup. Documented; not a regression.

---

## 5. systemd unit lint (skipped — macOS limitation)

`systemd-analyze verify` is not available on macOS (Linux-only). Manual inspection of rendered units (placeholders substituted):

- Both units are `Type=simple`, no `ExecReload`, `KillSignal=SIGTERM`, `TimeoutStopSec=30`, `Restart=on-failure`, `RestartSec=5s`.
- Hardening directives present and consistent: `NoNewPrivileges=yes`, `PrivateTmp=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `ReadWritePaths=/var/log/pantry`, `ProtectKernelTunables=yes`, `ProtectKernelModules=yes`, `ProtectControlGroups=yes`.
- `EnvironmentFile=` paths reference `{{ secrets_dir }}/api.env` and `admin.env`. These are absolute once rendered (`/etc/pantry/secrets/...`).
- `ExecStart` paths reference `/usr/bin/node` (absolute) + `{{ app_root }}/current/...` (resolves to `/opt/pantry/current/...`, absolute).
- `WantedBy=multi-user.target` — correct for non-root system services.
- `After=` / `Wants=` ordering: API depends on postgresql + redis-server; admin depends on `pantry-api.service`. Sound.

No syntactic red flags. **Recommend:** dev-1 (or whoever runs the first apply on the Ubuntu host) run `systemd-analyze verify /etc/systemd/system/pantry-api.service /etc/systemd/system/pantry-admin.service` post-deploy — captured here as a follow-up to flag in commit message of next push.

---

## 6. Concerns to surface BEFORE live VPS apply

1. **ansible-lint env var:** add `ANSIBLE_COLLECTIONS_PATH` hint to `infra/README.md` "Validation" block so future contributors don't get tripped up by the brew Cellar split. Not a blocker for THIS apply.
2. **deploy_ssh_authorized_key checklist row:** make explicit in pre-apply checklist that the public half of `DEPLOY_SSH_KEY` GH secret must be filled into `group_vars/all.yml` before first apply (currently implicit).
3. **First-apply two-step:** the README L67-69 and `nginx/tasks/main.yml` header both note that the first apply produces HTTP-only vhosts; the **second** apply (after `certbot` obtains certs) is what activates HTTPS. This is intended and documented but it's a footgun for an operator who only runs the playbook once. Worth a one-liner: "first apply WILL leave admin/api on HTTP+503 placeholder; re-run after certbot succeeds."
4. **systemd-analyze verify:** can't run on macOS. Recommend dev-1 capture the output on the Ubuntu host after first apply and commit a one-line note (or attach to the deploy-completion message). Strict-mode `ProtectSystem=strict` warnings about `ReadWritePaths=/var/log/pantry` should be benign but worth confirming.

None of the above blocks the merge. All 4 amendments are enforced; all 10 standard checks are clean; all 10 deviations are coherent and intentional.

---

## 7. Pre-apply blockers found

**None.**

---

## Unresolved questions

- (For team-lead) is there a downstream task that exercises the second apply path (post-certbot HTTPS render)? If not, who owns running it on first deploy day?
- (For dev-1) confirm the Ubuntu host's `cron` is interpreting `hour: "3"` as UTC (i.e. `common.timezone = Etc/UTC` ran before the cron task on first apply). This is sequencing-dependent: `roles/common` runs before `roles/app` in `site.yml`, so it should be fine — but worth a `crontab -l` check post-apply.
- (For team-lead) Is there a separate task slot for documenting the post-first-apply rerun ("certbot two-step"), or should that go into M0e?
