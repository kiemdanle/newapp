# Uptime monitoring runbook

Goal: be paged within 5 minutes of `/health` failing.

## Provider

**UptimeRobot** (free tier covers our two monitors at 5-min interval).

## Monitors

1. **API liveness** — HTTPS GET `https://api.pantry.example/health` every 5 min, expect 200
2. **API readiness** — HTTPS GET `https://api.pantry.example/health/ready` every 5 min, expect 200 AND `db:true` AND `redis:true` (use "keyword exists" check)
3. **Admin landing** — HTTPS GET `https://admin.pantry.example/login` every 5 min, expect 200

## Alert contacts

### Primary: email

Add `ops@pantry.example` (forwards to operator personal email + on-call phone via Gmail filter).

### Secondary: choose one of Telegram or Discord

**Telegram (recommended for a one-operator service):**

1. Open Telegram, message `@BotFather`, run `/newbot`, name it `PantryAlertBot`
2. Save the bot token
3. Create a private channel `Pantry Alerts`, add the bot as admin
4. Get the channel ID:
   ```bash
   curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[].channel_post.chat.id'
   ```
5. In UptimeRobot → My Settings → Alert Contacts → Add → Telegram
   - Chat ID: `<from step 4>`
   - Token: `<from step 2>`
6. Test by toggling a monitor off and back on

**Discord (alternative):**

1. In your Discord server: Server Settings → Integrations → Webhooks → New Webhook → `#pantry-alerts`
2. Copy webhook URL
3. UptimeRobot → Alert Contacts → Add → Webhook
   - URL: `<webhook URL>?wait=true`
   - POST value: `{"content":"*alertTypeFriendlyName*: *monitorFriendlyName* — *alertDetails*"}`
   - Content-Type: `application/json`
4. Test by toggling a monitor

## Escalation

| Time since alert | Action                                                          |
|------------------|-----------------------------------------------------------------|
| 0 min            | Email + Telegram fire                                           |
| 10 min           | UptimeRobot re-sends if still down                              |
| 30 min           | Operator SMS via fallback (UptimeRobot Pro, or self-hosted cron) |

## On-call rotation

Single operator for now. Future: add a secondary, rotate weekly via Google Calendar.

## False-positive handling

- Two consecutive 5-min failures = real
- Single transient failure (network blip) = log only

Configure in UptimeRobot → Monitor → Advanced Settings → "Alert after N occurrences" = 2.

## Maintenance windows

Schedule planned maintenance windows in UptimeRobot to suppress alerts:
UptimeRobot → Maintenance Windows → Add → set start/end UTC.

## Quarterly drill

Once per quarter:

1. Disable the API briefly (`sudo systemctl stop pantry-api`)
2. Confirm alert lands within 5 minutes on every channel
3. Re-enable: `sudo systemctl start pantry-api`
4. Confirm UptimeRobot status returns to "up"

Log the drill in `docs/runbooks/uptime-drill-log.md`.
