# Expyrico mobile visual consistency design

## Goal

Unify every mobile route under one responsive Expyrico visual system. The app must follow the device appearance when the user selects System default, while retaining explicit Light and Dark overrides. Existing product flows, navigation, API calls, and security behavior stay unchanged.

## Design contract

- Light mode uses Warm White (`#FAFAF8`) for primary surfaces, Stone (`#F0F0ED`) for dividers and secondary surfaces, Fresh Sage (`#4BAE8A`) for active states, and Mint Mist (`#D6F0E6`) for supportive panels.
- Dark mode changes only semantic neutral surfaces and text contrast. Fresh Sage, Deep Sage, Mint Mist, Honey, Soft Butter, and Alert Red retain their meanings in both modes.
- Honey (`#F5A623`) is reserved for the single primary action on a screen and expiring-soon emphasis. Alert Red (`#E0442A`) is only used for expired and destructive states.
- Shared controls use 48dp minimum tap targets, 8dp minimum separation, system typography, visible pressed/disabled states, and accessibility labels.
- Pages use one shell, one card/list language, and a single icon-led tab treatment. The app will not expose Bento, Clay, Material, or Glass visual variants to users.

## Appearance behavior

The Appearance setting exposes System default, Light, and Dark. System default resolves from the device color scheme immediately; Light and Dark remain persisted manual overrides. `expyrico` and `expyricoDark` are the only selectable visual themes.

## Shared UI primitives

- `Screen`: responsive safe-area shell and consistent vertical rhythm.
- Buttons: Honey filled primary; Sage outlined secondary; compact text/icon tertiary. Each includes loading, disabled, pressed, and accessibility states.
- Form inputs: consistent labels, validation, focus rings, error treatment, and spacing.
- Cards and rows: Warm White/semantic-dark elevated surfaces, 16–22dp radii, restrained shadows, status badge semantics.
- Navigation: icon + label tabs with an active Mint Mist (or dark equivalent) pill; no plain text-only navigation labels.
- State surfaces: branded empty states, retry-capable error states, and non-blocking loading feedback.

## Screen families

### Authentication

Welcome, sign-in, sign-up, forgot/reset password, and both OTP routes use the same brand header, form rhythm, action hierarchy, and recovery controls. OTP is a focused screen: six 48dp+ cells, a time notice, one Honey verify button, an outlined resend control, and a tertiary change-email action. Errors preserve entered input and appear adjacent to the relevant control.

### Pantry and product workflows

Home centers on a Use next hero, concise expiry-priority list, and thumb-zone scan action. Browse, record/product detail, new product, scan, and reviews reuse the same cards, rows, fields, status badges, and empty states.

### Community workflows

Deals, giveaways, claims, ratings, invites, and reports use the same feed cards, primary/secondary action hierarchy, voting and status treatments, and feedback states.

### Account workflows

Profile, household management, settings, passkeys, and appearance use grouped settings rows, common confirmation/error surfaces, and the shared Appearance control.

## Implementation batches

1. Constrain theme selection to System default, Light, and Dark; complete palette tokens and shared primitives.
2. Apply the system to auth routes and OTP controls.
3. Apply it to tabs, home, pantry, scan, product, and review routes.
4. Apply it to deals, giveaways, invitations, reports, profile, household, and settings routes.
5. Remove only obsolete style variants made unused by these changes and refresh affected snapshots.

## Verification

- Unit and route tests cover theme resolution/override, primary control states, OTP behavior, and tab accessibility.
- Snapshot tests are updated only for deliberate visual output changes.
- Lint and TypeScript checks run after each batch.
- Android debug builds install with the local Gradle/ADB workflow. ADB screenshots verify the auth, home, and representative list/detail/settings screens in both light and dark modes.
- Manual checks confirm 48dp actions, readable contrast, keyboard-safe forms, loading/error recovery, Android back behavior, and no use of Alert Red as branding.

## Non-goals

- No API, schema, navigation, authorization, or business-logic redesign.
- No new theme families, custom fonts, visual effects, or speculative components.
