# Expyrico — Design Guidelines

These guidelines cover the Expyrico brand palette and the theme system shared
across mobile and admin. The package currently provides the Expyrico light and
dark themes; use semantic tokens rather than hard-coded colors.

> There is **no "Aurora" theme**. The default and brand theme is **Expyrico**.
> Do not introduce alternate brand palettes.

## Mandated palette

The palette is defined in the tracked source file `packages/theme/src/palette.ts`
and mandated by project instructions. The dark theme derives its semantic colors
from this brand palette where appropriate.

| Token | Name | Hex | Usage |
| --- | --- | --- | --- |
| primary | Fresh Sage | `#4BAE8A` | Logo, headers, active state, "Good" status |
| primaryDark | Deep Sage | `#3A8F6F` | Pressed state, text on light |
| primaryLight | Mint Mist | `#D6F0E6` | Soft panels, success |
| bg / cards | Warm White | `#FAFAF8` | Background and cards |
| accent | Honey | `#F5A623` | CTAs, badges, "Expiring soon" status |
| accentLight | Soft Butter | `#FEEFC3` | Expiring-soon background |
| neutralLight | Stone | `#F0F0ED` | Section backgrounds, dividers |
| neutralMid | Pebble | `#8C8C85` | Secondary text and icons |
| neutralDark | Almost Black | `#2C2C28` | Primary text |
| destructive | Alert Red | `#E0442A` | Expired / destructive ONLY — never branding |

### Color rules

- Do not use Alert Red for branding, emphasis, or decoration. It is reserved for
  the expired/destructive state only.
- Status color mapping is semantic: Fresh Sage = Good, Honey = Expiring soon,
  Alert Red = Expired.
- Do not introduce a second brand palette. Variants may alter shape, elevation,
  spacing, and typography, but colors must resolve to the palette above.

## Theme system (`@expyrico/theme`)

The package has no runtime dependencies. `tokens.ts` defines the Theme contract:

- `ColorTokens`
- `radii`
- `shadows`
- elevation (both `clay` and `md3` scales)
- `typography`
- MD3 `typeRamp` (displayLarge ... labelSmall)
- `spacing`
- `animation`

`palette.ts` holds the mandated palette. `index.ts` exports a `themes` record and
a `themeList`.

### Available themes

`ThemeId = 'expyrico' | 'expyricoDark'`.

- **`expyrico`** is the default light theme.
- **`expyricoDark`** is the dark theme. It preserves the semantic brand/status
  mapping while using dark-surface tokens for readability.

Do not document or offer legacy `bento`, `clay`, or `material` variants: they
are not in the current theme source or mobile preference validation.

## Mobile theming runtime

- `store.ts` (zustand) holds a `ThemePreference` of `'system' | ThemeId`,
  persisted to SecureStore. Any non-`system` preference is synced to the server.
- `ThemeProvider` resolves `'system'` via `useColorScheme` and applies a 200ms
  cross-fade on theme changes.
- The settings theme screen exposes the supported Expyrico light/dark choices.
- Styling combines nativewind + tailwind with runtime `@expyrico/theme` tokens.
  Use tokens rather than hard-coded colors so variant/dark switching works.

> Reminder: mobile consumes a **vendored built copy** of `@expyrico/theme` under
> `apps/mobile/local-packages/@expyrico/theme/dist`. When the palette or tokens
> change in `packages/theme`, rebuild and refresh the vendored copy or mobile
> renders stale tokens.

## Admin theming

- Tailwind 3.4 with shadcn/ui-style components (`components/ui/*`: Radix + CVA +
  tailwind-merge).
- The Expyrico palette is implemented as HSL CSS variables in `globals.css`.
- Fonts: **Outfit** (display), **Inter** (body), **JetBrains Mono** (mono).

## Accessibility

- Mobile ships a11y tooling: eslint-plugin-react-native-a11y and wcag-contrast
  checks, plus touch-target checks in CI.
- A global font-scale cap of **1.5x** is enforced so large system font settings
  do not break layouts.
- Because Alert Red is reserved for a single semantic state, do not rely on color
  alone to convey status — pair status colors with text or icons.
- Full WCAG conformance requires manual testing with assistive technologies and
  expert review beyond the automated contrast checks.

## Theme maintenance

`packages/theme/src/palette.ts` is tracked source. When palette or token changes
are made, rebuild the package and refresh the vendored mobile `dist` copy before
relying on the result in the mobile app.
