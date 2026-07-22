# Assets checklist

Required assets before store submission (bare React Native).

## iOS

- [ ] App icon — 1024×1024 PNG, no transparency, no rounded corners
- [ ] LaunchScreen storyboard / splash assets under `ios/Expyrico`
- [ ] App Store screenshots (see `ios-submission.md`)

## Android

- [ ] App icon / adaptive icon under `android/app/src/main/res`
- [ ] Feature graphic — 1024×500 PNG/JPG
- [ ] Phone screenshots — at least 2

## In-app

- [ ] Empty-state illustrations (optional)
- [ ] Ionicons font available via `react-native-vector-icons` (Pod/autolink)

## Verification

```bash
cd apps/mobile
pnpm typecheck
pnpm test
```

No Expo doctor — this app is bare React Native.
