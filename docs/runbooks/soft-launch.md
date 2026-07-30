# Soft launch checklist

Use this staged checklist only after the known deploy migration filter, release
signing, deep-link, and security gaps have been assessed for the intended launch.
The repository currently supports local Android Gradle builds; it does not
provide an EAS/TestFlight release workflow.

## Before inviting users

- [ ] Confirm a successful deploy or installed Android build with the target
  backend configuration.
- [ ] Run the applicable checks in [release-checklist.md](release-checklist.md).
- [ ] Complete a recent scratch restore drill and review backup logs.
- [ ] Configure and test an off-host uptime monitor for the deployed API.
- [ ] Verify privacy and terms content against the actual data practices and
  public contact details.
- [ ] Prepare operator communications and a rollback owner.

## Small cohort

- [ ] Start with a limited, consented Android cohort.
- [ ] Test email/password and supported social/passkey sign-in; create, scan, and
  sync an expiry record; exercise a community action; and sign out/in.
- [ ] Confirm push delivery only if the provider credentials and device setup are
  configured for the environment.
- [ ] Monitor API errors, queue health, service logs, and uptime alerts.
- [ ] Do not change the unavailable legacy theme variants: test only `expyrico`
  and `expyricoDark`.

## Expand or pause

- [ ] Expand the cohort only after the observed error rate, queue depth, and
  support volume are acceptable to the operator.
- [ ] Pause invitations and follow [incident-response.md](incident-response.md)
  or [rollback.md](rollback.md) when user-impacting regressions occur.
- [ ] Capture findings and update the relevant runbook after the launch window.
