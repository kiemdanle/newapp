# Incident response runbook

A lightweight playbook for a one-operator service. Use it the moment you suspect impact.

## Severity definitions

| Sev | Definition                                                            | Response time |
|-----|-----------------------------------------------------------------------|---------------|
| S1  | Total outage. /health failing. Data loss confirmed or suspected.      | Immediate     |
| S2  | Partial outage. Sign-in broken, scan broken, or push notifications stopped. | < 1 hour      |
| S3  | Single feature degraded. UI bug. Slow but functional.                  | Same day      |
| S4  | Cosmetic / single-user.                                                | Backlog       |

## Phases

### 1. Declare

- Post in #incidents Slack/Discord with `[INC YYYY-MM-DD-NN] S<n>: <one-line summary>`
- Open a ticket; this is your scratchpad and the seed for the postmortem
- If S1/S2: enable the maintenance banner via `/admin/settings/feature-flags → maintenanceBanner = "We are investigating an issue. Updates at status.pantry.example."` (string value; set `null` to clear). The PATCH body shape is `{ "maintenanceBanner": "..." }`, Zod-validated against M3's `feature_flags` seed.

### 2. Triage (first 15 min)

- What changed recently? Check the latest deploy SHA: `readlink /opt/pantry/current`
- Is `/health/ready` returning ok?
- Are DB and Redis up? `systemctl status postgresql redis-server`
- Tail logs: `sudo journalctl -u pantry-api -f --since "10 minutes ago"`
- Check `/admin/system/queue-health` and `/admin/system/api-errors`
- If recent deploy + symptoms started right after: ROLLBACK first, investigate second (see `rollback.md`)

### 3. Comms

**Internal:** keep #incidents updated every 15 min until resolved. Format: `[INC ...] status update — what we know, what we are doing, ETA`.

**External:**

- Update the status page (Statuspage-lite at `https://status.pantry.example`). Post: investigating → identified → monitoring → resolved.
- For S1/S2 with > 30 min impact, email affected users from the operator inbox using this template:

  ```
  Subject: Pantry — service disruption update

  Hi,

  Between <start UTC> and <end UTC>, Pantry was <briefly degraded / unavailable / unable to deliver push notifications>.
  We have identified the cause as <one sentence, plain language> and the service has been restored.

  Your data is safe. <If true: No records or reviews were lost.>

  We are sorry for the disruption.

  — The Pantry team
  ```

### 4. Mitigate

- Apply the smallest change that restores service. Roll back > patch > config > restart > escalate.
- Do not chase root cause during mitigation. Capture clues; analyze afterwards.

### 5. Resolve

- Confirm: smoke tests pass, error rate normal for 10 consecutive minutes, queue depth healthy
- Update status page to "resolved"
- Disable maintenance banner

### 6. Postmortem (within 48h)

Save as `docs/postmortems/YYYY-MM-DD-<slug>.md`:

```markdown
# Postmortem: <short title>

**Date:** YYYY-MM-DD
**Severity:** S<n>
**Duration:** HH:MM (UTC <start> → UTC <end>)
**Author:** <operator>

## Summary
One paragraph anyone can understand.

## Impact
- Users affected: <number / percentage>
- Features affected: <list>
- Data loss: <none / scope>

## Timeline (UTC)
- HH:MM — first symptom
- HH:MM — incident declared
- HH:MM — root cause identified
- HH:MM — fix applied
- HH:MM — resolved

## Root cause
Plain-language explanation. Include the offending commit/config/query.

## What went well
- ...

## What went poorly
- ...

## Action items
- [ ] <owner> <due date> — <action>
- [ ] <owner> <due date> — <action>
```

Action items go into the backlog with the postmortem URL attached. Review at the next quarterly ops review.
