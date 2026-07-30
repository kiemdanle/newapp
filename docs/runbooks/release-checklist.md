# Release checklist

Use this checklist for a production deploy or a distributable Android APK. It is
an operator checklist, not a configured `pnpm release:gate` command.

## Automated checks

- [ ] Run the relevant workspace checks first; for a full repository check use:
  ```bash
  pnpm typecheck
  pnpm lint
  pnpm test
  ```
- [ ] For mobile changes, run `pnpm --filter @expyrico/mobile test`; contrast,
  snapshot, and touch-target suites are selected by Jest arguments in CI.
- [ ] Treat `pnpm --filter @expyrico/mobile test:e2e` as a local Maestro command,
  not a CI release gate: the Maestro workflow is currently commented out.
- [ ] For server deploys, confirm the deploy workflow's test job passes. Do not
  rely on automated Prisma migration until the known `@pantry/api` filter defect
  in `infra/scripts/deploy-remote.sh` is fixed.

## Manual checks

- [ ] Test sign-in, expiry record creation, scan, and a notification on a device.
- [ ] Confirm the deployed API readiness endpoint and admin sign-in page respond.
- [ ] Review the release APK signing method before any store submission: the
  current release build uses the debug signing configuration and is unsuitable
  for Play Store distribution.
- [ ] Review [security-review.md](security-review.md) after security or
  infrastructure changes.
- [ ] Run and record a restore drill on the operational cadence.
- [ ] Update legal documents when actual data practices or terms change.

## Sign-off

- Engineer: _______
- Reviewer: _______
- Version or deploy SHA: _______
- Date (UTC): _______
