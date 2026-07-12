# Expyrico — Design Guidelines

These guidelines cover the Expyrico brand palette and the theme system shared
across mobile and admin. Colors are mandated; shape, elevation, spacing, and
typography may vary by theme variant, but the palette must be preserved.

> There is **no "Aurora" theme**. The default and brand theme is **Expyrico**.
> Do not introduce alternate brand palettes.

## Mandated palette

The palette is defined in `packages/theme/src/palette.ts` and mandated by the
project instructions. Every theme variant must resolve its colors to these
values.

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

### Variants

`ThemeId = expyrico | expyricoDark | bento | clay | material`.

- All four **light** variants (`expyrico`, `bento`, `clay`, `material`) share the
  same `expyricoColors`. They differ only in radii, shadows, typography,
  typeRamp, elevation, and animation — that is, shape and feel, not color.
- Only **`expyricoDark`** swaps the color set. It is the single dark variant.

This is the key mental model: switching between the light variants changes the
"physical" character of the UI (rounded vs sharp, soft vs flat, type rhythm)
while keeping the exact same Expyrico colors. Dark mode is the one place colors
change.

## Mobile theming runtime

- `store.ts` (zustand) holds a `ThemePreference` of `'system' | ThemeId`,
  persisted to SecureStore. Any non-`system` preference is synced to the server.
- `ThemeProvider` resolves `'system'` via `useColorScheme` and applies a 200ms
  cross-fade on theme changes.
- `settings/theme.tsx` renders a preview-card grid for picking a variant.
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

## Theme-related known issues

- `packages/theme/src/palette.ts` is **untracked in git** while every variant and
  `index.ts` imports `./palette.js`. A clean build of `@expyrico/theme` fails
  until it is committed. This is the highest-priority theming fix (see
  `project-roadmap.md`).
