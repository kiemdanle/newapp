# Assets checklist

Required assets before store submission.

## iOS

- [ ] App icon — 1024×1024 PNG, no transparency, no rounded corners (`assets/icon.png`)
- [ ] Splash screen — 1242×2436 PNG (`assets/splash.png`)
- [ ] App Store screenshots (see `ios-submission.md` for device sizes)
- [ ] App Store feature graphic / promotional art (optional)

## Android

- [ ] App icon — 512×512 PNG, 32-bit, no alpha
- [ ] Feature graphic — 1024×500 PNG/JPG
- [ ] Phone screenshots — at least 2, 16:9 or 9:16
- [ ] 7-inch tablet screenshots (optional)
- [ ] 10-inch tablet screenshots (optional)

## Adaptive icons

- [ ] Android adaptive icon foreground (`assets/adaptive-icon.png`)
- [ ] Android adaptive icon background color (set in `app.config.ts`)

## In-app

- [ ] Onboarding illustrations (optional)
- [ ] Empty-state illustrations (optional)

## Verification

```bash
cd apps/mobile
npx expo-doctor
```

Expected: no asset-related warnings.
