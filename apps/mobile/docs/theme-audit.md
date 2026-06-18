# Theme audit

Generated 2026-06-18. Lists every non-tokenized visual value in mobile screen files. Each violation must be replaced with a `useTheme()` token before M4 ships.

## Methodology

Greps for `#[0-9a-fA-F]{3,8}`, `shadow*`, `elevation:`, `borderRadius:<n>`, `fontSize:<n>`, `fontWeight:<n>`. See Phase A Task A1 for exact commands.

## Violations

### apps/mobile/app/(app)/scan.tsx
- Line 77: `backgroundColor: '#000'` → use `tokens.colors.bg` (or add a camera overlay token)
- Line 81: `color="#fff"` → use `tokens.colors.text`

### apps/mobile/app/(app)/record/[id].tsx
- Line 56: `borderRadius: 5` → use `tokens.radii.sm` / 2 or a dedicated status-dot radius

### apps/mobile/app/(app)/settings/theme.tsx
- Line 83: `borderRadius: 6` → use `tokens.radii.sm`

### Typography literals (fontSize / fontWeight)

These should map to a `typeRamp` role instead of raw numbers.

- `apps/mobile/app/(app)/(tabs)/browse.tsx:10` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(app)/(tabs)/home.tsx:27` — `fontSize: 28, lineHeight: 28`
- `apps/mobile/app/(app)/(tabs)/profile.tsx:28` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(app)/(tabs)/profile.tsx:30` — `fontSize: 16, fontWeight: '600'`
- `apps/mobile/app/(app)/(tabs)/reviews.tsx:10` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(app)/product/[id].tsx:51` — `fontSize: 22, fontWeight: '700'`
- `apps/mobile/app/(app)/product/new.tsx:66` — `fontSize: 20, fontWeight: '700'`
- `apps/mobile/app/(app)/product/new.tsx:87` — `fontWeight: '700'`
- `apps/mobile/app/(app)/record/[id].tsx:49` — `fontSize: 22, fontWeight: '700'`
- `apps/mobile/app/(app)/record/[id].tsx:80,94` — `fontWeight: '700'`
- `apps/mobile/app/(app)/record/[id].tsx:107` — `fontWeight: '700'`
- `apps/mobile/app/(app)/settings/add-passkey.tsx:31` — `fontSize: 24, fontWeight: '700'`
- `apps/mobile/app/(app)/settings/index.tsx:46` — `fontSize: 24, fontWeight: '700'`
- `apps/mobile/app/(app)/settings/index.tsx:65` — `fontSize: 16, fontWeight: '600'`
- `apps/mobile/app/(app)/settings/index.tsx:68` — `fontSize: 13`
- `apps/mobile/app/(app)/settings/theme.tsx:14` — `fontSize: 24, fontWeight: '700'`
- `apps/mobile/app/(app)/settings/theme.tsx:72` — `fontSize: 12`
- `apps/mobile/app/(auth)/forgot-password.tsx:42` — `fontSize: 24, fontWeight: '700'`
- `apps/mobile/app/(auth)/forgot-password.tsx:55` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(auth)/reset-password.tsx:44` — `fontSize: 24, fontWeight: '700'`
- `apps/mobile/app/(auth)/reset-password.tsx:55` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(auth)/sign-in.tsx:122` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(auth)/sign-up.tsx:47` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(auth)/verify-email.tsx:41` — `fontSize: 28, fontWeight: '700'`
- `apps/mobile/app/(auth)/welcome.tsx:39` — `fontSize: 40, fontWeight: '800', letterSpacing: -1`
- `apps/mobile/app/(auth)/welcome.tsx:40` — `fontSize: 16`
- `apps/mobile/src/components/Button.tsx:60` — `fontSize: 16, fontWeight: '600'`
- `apps/mobile/src/components/ErrorText.tsx:16` — `fontSize: 14, fontWeight: '500'`
- `apps/mobile/src/components/TextField.tsx:36` — `fontSize: 13, fontWeight: '500'`
- `apps/mobile/src/components/TextField.tsx:37` — `fontSize: 16`
- `apps/mobile/src/components/TextField.tsx:38` — `fontSize: 13`

## Fix order

1. Token expansion (Phase A2-A3) — add `typeRamp` + `elevation` tokens
2. Auth screens (Phase C)
3. Tab screens (Phase D)
4. Detail screens (Phase E)
5. Settings (Phase F)

Each violation is checked off as it's replaced.
