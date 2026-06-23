# Build and release runbook

End-to-end build and release process for the Pantry mobile app using EAS.

## Prerequisites

- Expo account with access to the `pantry` project
- `EXPO_ACCESS_TOKEN` set in CI and locally for non-interactive builds
- EAS CLI installed: `pnpm add -g eas-cli`
- Apple Developer account (for iOS)
- Google Play Developer account (for Android)

## Local setup

```bash
cd apps/mobile
eas login
```

## Build profiles

Defined in `eas.json`:

- `development` — development client, internal distribution, iOS simulator
- `preview` — internal distribution for device testing
- `production` — store-ready signed build

## Build commands

```bash
# iOS
eas build --profile preview --platform ios
eas build --profile production --platform ios

# Android
eas build --profile preview --platform android
eas build --profile production --platform android
```

## EAS Update channels

- `development` → maps to `development` build
- `preview` → maps to `preview` build
- `production` → maps to `production` build

Publish an update:

```bash
eas update --channel preview --message "Fix theme switch animation"
```

Updates must match the runtime version of the target build. Native code changes require a new build.

## Release flow

1. Merge feature branch to `main`
2. Verify CI green (`pnpm lint`, `pnpm test`, `pnpm test:snapshots`)
3. Tag release: `git tag v1.0.0 && git push --tags`
4. Build production iOS + Android: `eas build --profile production --platform all`
5. Submit to stores: `eas submit --profile production --platform all`
6. Monitor crash-free rate and review feedback for 48h
7. Promote staged rollout to 100%

## Rollback

For critical issues, push a corrective EAS Update to the same channel. If the issue is in native code, build a new version and submit as a patch release. See `docs/runbooks/rollback.md` for server-side rollback.

## Secrets

- `EXPO_ACCESS_TOKEN` — CI only, never commit
- Apple App Store Connect API key — stored in 1Password, uploaded to EAS once
- Google Play service account — `apps/mobile/secrets/play-service-account.json` (gitignored)
