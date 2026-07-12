# Expyrico Colour Palette

This palette is the required colour scheme for the Expyrico app and website. Do not introduce alternate brand palettes for app themes. Interface style variants may change shape, spacing, typography, or elevation, but their colour tokens must resolve to this palette.

## Brand Colours

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| Primary | Fresh Sage | `#4BAE8A` | Logo, headers, active states |
| Primary Dark | Deep Sage | `#3A8F6F` | Pressed states, text on light backgrounds |
| Primary Light | Mint Mist | `#D6F0E6` | Soft panels, success highlights |
| Secondary | Warm White | `#FAFAF8` | Main background, cards |
| Accent | Honey | `#F5A623` | CTAs, badges, highlights |
| Accent Light | Soft Butter | `#FEEFC3` | Expiring-soon status background |
| Neutral Light | Stone | `#F0F0ED` | Section backgrounds, dividers |
| Neutral Mid | Pebble | `#8C8C85` | Secondary text, icons |
| Neutral Dark | Almost Black | `#2C2C28` | Primary text |

## Reserved Status Colours

| Status | Hex | Rule |
| --- | --- | --- |
| Good | `#4BAE8A` | Reuses Fresh Sage |
| Expiring soon | `#F5A623` | Reuses Honey |
| Expired | `#E0442A` | Status only, never branding |

## Implementation Rules

- Use `packages/theme/src/palette.ts` as the source of truth for runtime app tokens.
- Use `apps/mobile/src/theme/tailwind-tokens.cjs` as the static NativeWind baseline.
- Use `apps/admin/src/app/globals.css` for website CSS variables.
- Primary CTAs use Honey with Almost Black text.
- Fresh Sage is for logo, headers, active states, and secondary filled actions.
- Alert Red must only communicate expired/destructive status. Do not use it for decoration, branding, or primary actions.
- Do not add purple, grey-card, or alternate Material dynamic colours to auth, splash, onboarding, or settings screens.
