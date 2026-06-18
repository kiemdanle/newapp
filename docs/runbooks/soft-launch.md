# Soft launch checklist

A 14-day staged launch to keep blast radius small while real users exercise the system.

## T-7 days: pre-launch

- [ ] All M0–M4 plans complete; `git tag m4-complete` set
- [ ] Most recent restore drill PASSED within the last 30 days (see `restore-drill.md`)
- [ ] `infra/scripts/backup.sh` is on a daily cron under `pantry`, last 7 backups present in S3
- [ ] `infra/scripts/restore.sh` tested in the drill
- [ ] Every runbook in `docs/runbooks/` reviewed end-to-end by the operator
- [ ] Security review checklist (`security-review.md`) green
- [ ] Status page live at `https://status.pantry.example` with all monitors green
- [ ] UptimeRobot monitors firing; quarterly drill scheduled
- [ ] Privacy policy + terms live at the URLs given in `ios-submission.md` / `android-submission.md`
- [ ] Demo App Review account `appreview@pantry.example` provisioned, password in 1Password
- [ ] Apple Sign In and Google Sign In tested end-to-end on TestFlight build
- [ ] Push notification delivered end-to-end on TestFlight build
- [ ] Manual a11y checklist passed on TestFlight + Play Internal builds
- [ ] CI green on `main`

## T-1 day

- [ ] Tag release: `git tag v1.0.0 && git push --tags`
- [ ] Submit iOS build for App Review (`eas submit --profile production --platform ios`)
- [ ] Promote Android internal → closed testing for the beta cohort
- [ ] Pre-write the launch announcement (in-app banner + Telegram channel + Twitter post)

## Launch day

### Morning

- [ ] Confirm App Store status: "Ready for Sale" (or "Pending Developer Release" if you scheduled it)
- [ ] Promote Android closed → production rollout 10%
- [ ] Smoke test from a fresh device with a fresh account:
  - [ ] Sign up via email + password → email arrives → verify → home
  - [ ] Sign up via Google → home
  - [ ] Sign up via Apple → home
  - [ ] Scan a barcode → lookup hits OFF → save record → home shows it
  - [ ] Review a product → submit → review visible
  - [ ] Vote on someone else's review → count increments
  - [ ] Switch theme: expyrico → bento → clay → material → back to expyrico
  - [ ] Sign out → sign back in
- [ ] Watch `/admin/system/api-errors` — should stay near zero
- [ ] Watch `/admin/system/queue-health` — depth should stay near zero
- [ ] Watch `journalctl -u pantry-api -f` for unusual error patterns
- [ ] Post launch announcement

### Afternoon

- [ ] Spot-check sign-up funnel: how many users completed verification?
  ```sql
  SELECT
    count(*) FILTER (WHERE created_at::date = current_date) AS signups_today,
    count(*) FILTER (WHERE email_verified_at::date = current_date) AS verified_today
  FROM users;
  ```
- [ ] Spot-check scan funnel: how many records created today?
  ```sql
  SELECT count(*) FROM records WHERE created_at::date = current_date;
  ```
- [ ] Bump Android rollout to 50% if no anomalies

### Evening

- [ ] Daily summary in #incidents: signups, scans, reviews, errors
- [ ] Bump Android to 100% if all green for 6 hours

## Day +1

- [ ] Manual spot-check of three random accounts: profile, records, reviews look sane
- [ ] Backup ran overnight: `rclone lsf b2:pantry-backups/daily/ | grep $(date +%Y-%m-%d)`
- [ ] Review yesterday's logs end-to-end for anything unusual
- [ ] Resolve any TestFlight feedback received

## Day +7

- [ ] Cohort analytics: % of D1 signups returning at D7 (use `users.last_seen_at`)
- [ ] Review-volume sanity: any spammers? Run `/admin/reports?status=open`
- [ ] Push delivery success rate: `/admin/system/push-logs` → success / total > 95%
- [ ] Operator self-survey: any runbook gaps discovered? Update them.
- [ ] If all green: scale comms (post to Hacker News, ProductHunt, etc.)

## Day +30

- [ ] Run quarterly restore drill earlier if not already scheduled
- [ ] Review aggregate metrics, plan v1.1
- [ ] Postmortem of the launch in `docs/postmortems/2026-MM-DD-launch.md` — even if uneventful, what went right is worth recording
