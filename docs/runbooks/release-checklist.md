# Release checklist

Run before every store submission (mobile) or OTA push to `production`. Required as a CI step (`pnpm release:gate`) plus manual verification.

## Automated (CI)

- [ ] `pnpm typecheck` — green across all packages
- [ ] `pnpm lint` — green (includes `eslint-plugin-react-native-a11y`)
- [ ] `pnpm test` — unit + integration green
- [ ] `pnpm test:snapshots` — all per-theme snapshots green
- [ ] Mobile Maestro flows green (sign-in, scan, save record, review, vote, theme-switch)

## Manual

- [ ] Manual screen-reader checklist (`apps/mobile/docs/a11y-manual-checklist.md`) signed off by tester
- [ ] Large-text smoke test on iOS at 200% font scale, no layout breaks beyond documented caps
- [ ] Security review checklist (`security-review.md`) re-run if any infra changed since last release
- [ ] Restore drill PASSED within the last quarter
- [ ] Changelog `CHANGELOG.md` updated for this version
- [ ] Privacy Policy / Terms of Service updated if data practices changed

## Sign-off

- Engineer: _______
- Reviewer: _______
- Version: _______
- Date: _______
