# Expyrico — Mobile Mockup Prototype Design

**Date:** 2026-05-24
**Status:** Approved (pending user review of this document)
**Topic:** Static, clickable HTML prototype of the Expyrico mobile UI, covering every screen and flow described in the implementation plans (M0c–M4)

> **2026-06-08 revision:** App renamed to **Expyrico**; default theme recolored to the Expyrico brand palette (§4); rating model is three-option (no stars); reminder default `[7,3,1,0]`; new Dashboard/item-limit/referral/contact screens. The word "pantry" below is the generic feature noun.

---

## 1. Overview

A static, browser-viewable prototype of the entire Expyrico mobile experience. Every screen is a self-contained HTML page rendered inside a fixed iPhone 15 Pro device frame. The user opens a single URL, lands on a navigation hub, and clicks through to any screen.

The prototype is **non-functional** — no real backend, no real auth, no real scanning. It exists so design decisions can be reviewed, screens can be compared at full fidelity, and downstream implementation work has a concrete visual reference.

**Source of truth:** all visual decisions trace back to `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` and the implementation plans in `docs/superpowers/plans/` (M0c mobile shell, M1 personal pantry, M2 reviews + ratings, M4 polish + launch).

---

## 2. Scope

### In scope

- Hi-fi mockups of all 28 screens listed in section 6
- Expyrico-theme styling on every screen (light variant — not dark mode)
- A working Theme Picker that renders all four shipped themes (Expyrico, Bento Grid, Soft Clay, Material You) as live preview cards on the *home screen miniature*. Other screens render only in the Expyrico theme.
- A nav hub that lists all screens with thumbnails and routes to each
- A push-notification lock-screen preview as a distinct mockup screen
- Real-looking content: realistic product names, brands, dates, avatars, ratings

### Out of scope

- Functional auth, scanning, sync, or persistence — clicks may navigate but no state is saved
- Admin dashboard (web-only per main spec section 8)
- Internationalized copy (English only, per main spec section 12)
- Pixel-perfect cross-browser parity — Chromium-based browsers are the target
- Mobile-Safari WebKit fidelity testing — the prototype is for viewing on a desktop browser
- Animation beyond the 200ms cross-fade on theme switch and basic hover/active states

---

## 3. Output and delivery

The prototype is built as plain HTML/CSS/JS files served by the visual companion server already running for this brainstorming session.

- All files live under `.superpowers/brainstorm/<session-dir>/content/` (gitignored — `.superpowers/` is already in `.gitignore`)
- The server serves the *newest* file at `http://localhost:52271/`. Individual files are accessible at `http://localhost:52271/files/<filename>`
- The nav hub (`00-nav-hub.html`) is the durable entry point. To make the hub the active landing page, we `touch` it so it becomes the newest file. The hub uses `/files/<screen-file>` URLs to navigate the browser to each screen, and every screen links back to the hub at `/files/00-nav-hub.html`
- No build step, no framework — vanilla HTML, CSS variables, minimal JS for theme switching and click navigation

### File naming

- `00-nav-hub.html` — entry point with thumbnails of every screen
- `01-welcome.html`, `02-sign-up.html`, ... `28-contact.html` — one file per screen, numbered for stable ordering
- `_shared.css` — design tokens (color, type, spacing, radii, shadows) for all four themes
- `_frame.css` — iPhone 15 Pro device frame, status bar, home indicator
- `_components.css` — buttons, cards, inputs, FAB, tab bar, list rows
- `_themes.js` — theme switcher logic for the theme picker preview

---

## 4. Visual language — Expyrico (light)

The default and dominant theme, built on the Expyrico brand palette.

- **Background:** Warm White `#FAFAF8` main surface; Stone `#F0F0ED` for section backgrounds and dividers; optional very-soft Mint Mist `#D6F0E6` wash on hero panels
- **Cards:** Warm White `#FAFAF8` fill, 1px Stone `#F0F0ED` border, soft outer shadow (`0 8px 24px rgba(44, 44, 40, 0.06)`)
- **Primary:** Fresh Sage `#4BAE8A` (logo, headers, active states, primary buttons); **Primary Dark** Deep Sage `#3A8F6F` (pressed states, text on light bg); **Primary Light** Mint Mist `#D6F0E6` (soft panels, success highlights)
- **Accent / CTA:** Honey `#F5A623` (CTAs, badges, highlights); **Accent Light** Soft Butter `#FEEFC3` (expiring-soon status background)
- **Destructive / Expired:** Alert Red `#E0442A` (status + destructive only, never branding)
- **Text:** Almost Black `#2C2C28` (primary); Pebble `#8C8C85` (secondary text + icons)
- **Type:** Inter for body, Space Grotesk for display headings; system-ui fallback
- **Radii:** 20px on cards, 14px on pills, 999px on FAB and avatars
- **Shadows:** soft, neutral-tinted (`rgba(44,44,40,…)`) to match the warm-white palette

### Dashboard status colors (used on item cards)

- **Good** (> threshold): Fresh Sage `#4BAE8A`
- **Expiring soon** (≤ threshold, default 7 days): Honey `#F5A623`, with a Soft Butter `#FEEFC3` tile background
- **Expired** (past expiry): Alert Red `#E0442A`

These render as a left-edge accent bar on each item card (4px wide, full card height) so the status signal survives even though items are grouped by category, not status.

---

## 5. Phone frame and chrome

Every screen is centered inside a fixed iPhone 15 Pro frame on a neutral off-white backdrop.

- **Logical dimensions:** 393 × 852 pt (iPhone 15 Pro spec)
- **Bezel:** 12px black bezel, 55px corner radius, subtle 1px highlight on the inner edge
- **Drop shadow:** soft outer shadow under the device for visual lift
- **Dynamic Island:** rendered at the top (a 125 × 35 px black pill, centered, ~12px from the top); content respects the safe area below it
- **Status bar:** 9:41, full signal, 100% battery — all in dark text on the light Expyrico background
- **Home indicator:** 134px horizontal pill at the bottom, dark on light

Each screen file embeds the frame using shared CSS classes (`.device`, `.screen`, `.status-bar`, `.home-indicator`).

### Per-screen chrome

- Top-right of every screen: a small `← All screens` link, positioned outside the device frame, that navigates back to `00-nav-hub.html`
- The screen filename and human-readable title shown in the page `<title>` and a small caption below the device frame

---

## 6. Screen inventory (28 screens)

Numbered for file order; grouped for the nav hub.

### Onboarding & Auth (6)
1. **Welcome** — full-bleed light gradient, app name + tagline, illustration of a tilted carton with a date label, two CTAs ("Get started" → sign-up, "I have an account" → sign-in)
2. **Sign-up** — email, password, confirm password, terms checkbox, primary "Create account" button. Below: "or sign up with" row of Google / Apple / Passkey buttons. The Passkey button routes to a passwordless flow (skips password fields → goes straight to verify-email)
3. **Sign-in** — email, password, "Forgot password?" inline link, "Sign in" primary button, Google / Apple / Passkey row, "Don't have an account? Sign up" footer
4. **Verify-email** — "Check your inbox" message, the user's email shown as a chip, "Resend" button (with 60s cooldown countdown shown), "Change email" text link
5. **Forgot-password** — single email field, "Send reset link" button, success state shown inline after submit
6. **Reset-password** — new password + confirm password fields (only reachable from the email deep link), success state with "Sign in" button

### Main app (4 tabs)
7. **Home (Dashboard)** — bottom tab "Home" active. **Summary count header**: total items + breakdown chips (Good / Expiring soon / Expired). Pantry list grouped by category. Within each category, items sort by soonest expiry. Each item card: product image thumbnail, name + brand, expiry date with status color (left-edge bar: Sage/Honey/Red). FAB centered above the tab bar. Header: "Your pantry" + **category filter** icon. An "X of 50" item-count pill sits in the header.
8. **Browse** — bottom tab "Browse" active. Search field at top. Below: horizontally-scrolling category chips. Below chips: "Top-rated" section (3-4 product cards, each showing the 3-option aggregate) and "Recently added" section. Tapping a product → product detail
9. **Reviews** — bottom tab "Reviews" active. List of "my ratings" cards: product thumbnail + name, the user's three-option rating shown as a colored pill (Will buy again / On sale only / Won't buy), comment excerpt (2 lines clamped) when present, helpful/not-helpful totals (only if the rating has a comment), overflow menu (Edit / Delete)
10. **Profile** — bottom tab "Profile" active. Top: avatar, display name, country flag + name. Stats row of three cards: "X of 50 items," "Y ratings," "Z helpful votes received." Below: list of links (Settings, Notifications, Theme, Referral, Account, About, Sign out)

### Pantry flow (6)
11. **FAB action sheet** — sheet from bottom with two large options: "Scan barcode or QR" (camera icon) and "Add manually" (pencil icon). Cancel at the bottom. Layered over Home
12. **Scan** — full-screen camera viewfinder mockup. Center: rounded rectangle reticle. Top: "Point at a barcode or QR code" + close button. Bottom: torch toggle. (Static rendering — no live camera)
13. **Scan result — found** — product image, name, brand, category, the three-option community aggregate (e.g. "65% / 20% / 15%"). CTAs: "Add to pantry" (primary), "Wrong product?" (text link)
14. **Expiry capture** — two top tabs: "Pick a date" (default, shows wheel-style date picker with quick chips: Today, +3d, +1wk, +1mo, "Use shelf-life hint" if present) and "Scan the date" (shows a banner "Detected 2026-08-14 — confirm or adjust" over the same picker). Optional fields collapsed below the picker
15. **Manual entry** — fields: name (required, **auto-suggest from Open Food Facts**), category, expiry (required), quantity, notes. **Accordion "More details"** reveals price + store. "Save" button. Used both for "Add manually" and "Scan returned nothing." Manual items are personal-notes-only (no community rating)
16. **Record detail** — full screen. Product image, name, brand, category. Expiry date with status color, "Edit" button. Quantity, notes, and (if set) price + store. Four action buttons: "Mark used," "Mark thrown away," "Duplicate," "Delete"

### Product & reviews (3)
17. **Product detail** — hero with product image, name, brand, category chip. **Three-option aggregate** bar: "65% will buy again / 20% on sale only / 15% won't (43 ratings)", country-scoped. "Rate this product" primary button. Reviews section header with sort tabs ("Most helpful" default, "Newest"). List of `ReviewCard`s: author avatar + name + country flag, the rater's three-option pill, comment, timestamp, Helpful/Not-helpful counts (**only on cards that have a comment**), overflow menu ("Report")
18. **Rate a product (modal)** — bottom sheet (~85% height). **Three large radio options** at top: "Will buy again" / "Will buy again on sale" / "Will not buy again". Optional multi-line comment field below. "Cancel" + "Submit" buttons. Edit mode shows a "Delete" button at the bottom
19. **Report (modal)** — bottom sheet (~55% height). "Report this review" title. Radio list: Spam / Abuse / Incorrect info / Other. If "Other" selected: free-text body field appears. "Cancel" + "Submit" buttons

### Settings (4)
20. **Settings index** — list grouped into Preferences (Theme, Notifications, Expiring-soon threshold, Language [disabled]), Account (Email, Password, Linked accounts, Country, **Item count "X of 50"**), Referral (View/share my code), Data (Export my data [placeholder], Delete account), Support (**Contact us**), About (Version, Terms, Privacy, OSS licenses). Footer: "Sign out" red text full-width
21. **Theme picker** — four large vertically-stacked preview cards. Each card renders a miniature home screen in that theme (Expyrico Sage/Warm-White, Bento tiles, Clay 3D depth, MD3 chips). Selected card has a Fresh Sage ring. Tapping a card cross-fades the *page chrome and the settings screen behind* over 200ms. "Save" button at the bottom. **This is the centerpiece of the prototype.**
22. **Notifications settings** — master "Push notifications" toggle. Default reminder schedule: **four checkboxes (7 days before, 3 days before, 1 day before, on expiry day)**. Quiet hours start/end pickers. "Test notification" button at the bottom
23. **Account** — same content as Account section of Settings index, promoted to its own screen for the deep-link case. Linked-accounts toggles are **visual only** with note: "At least one credential must remain linked"

### Special (5)
24. **Empty home + first-scan tutorial** — Home screen with zero records. Centered illustration, "Your pantry is empty," "Tap + to scan your first item." Tutorial overlay layered on top: dimmed backdrop with a hole cut out around the FAB and a pointer + tooltip
25. **Push notification preview** — iPhone lock screen mockup. Wallpaper, time + date, two stacked notifications: "Expyrico — Milk expires tomorrow" and "Expyrico — 3 items expire today: yogurt, bread, hummus." Tapping deep-links to the item detail. Shows what the actual push copy and grouping look like
26. **Item-limit reached** — Home in read-only mode at the 50-item cap. A pinned banner "You've reached 50 items" with an **upgrade-prompt CTA** ("Upgrade for unlimited"). The FAB shows a lock badge; tapping it opens the upgrade prompt instead of the add sheet. Note: reminders still fire
27. **Referral** — "Invite friends" screen. The user's unique referral code in a large copyable pill, a "Share" button (native share-sheet mockup), and a progress line "Friends activated: 2" (activation = friend adds 5 items). Copy notes rewards are coming in a future version
28. **Contact us** — simple support screen: short intro line, a "Email us" button (mailto link) and a minimal feedback form (subject + message + Send) for bug reports and feedback

### Nav hub (the entry point — separate from the 25)
- **Nav hub (`00-nav-hub.html`)** — page title, sub-line description, 4-column grid (3 on narrower viewports) of small phone-frame thumbnails grouped by section. Click → navigates to the screen file

---

## 7. Theme switcher behavior (centerpiece)

The Theme Picker (screen 21) is the only screen where a click changes anything beyond navigation.

- Four preview cards, each a static miniature of the home screen rendered in that theme's tokens
- Tap a card → the page-level CSS variables update, triggering a 200ms cross-fade across:
  - The phone frame chrome (status bar, tab bar, home indicator color)
  - The Settings index visible behind the modal sheet
- The currently-selected card gets a Fresh Sage ring (`#4BAE8A`, 3px, offset 2px)
- "Save" button at the bottom dismisses the sheet and persists nothing — on next page load, the prototype always boots in the Expyrico theme (this is intentional; the prototype is not stateful)

The four themes ship as four CSS variable bundles in `_shared.css`:

- `[data-theme="expyrico"]` — Warm White surfaces, Fresh Sage primary, Honey accent (default)
- `[data-theme="bento"]` — light flat surface (Warm White / Stone), modular asymmetric tiles, single Honey accent
- `[data-theme="clay"]` — warm Mint Mist / Soft Butter base, chunky 3D drop shadows, no glass, bigger radii (32px on cards)
- `[data-theme="material"]` — Google MD3 dynamic theming seeded from Fresh Sage (`#4BAE8A`), chips and pills, friendlier surfaces

---

## 8. Architecture and isolation

The prototype is small enough to live as flat files but is structured so each screen is independently understandable.

- **Each screen is one HTML file** that includes the three shared CSS files plus optional inline styles for screen-specific layout
- **No JS framework.** Theme switcher is ~30 lines of vanilla JS in `_themes.js`
- **No build step.** Open the URL, view a screen, edit the file, refresh
- **No copy-paste of the device frame.** The frame markup is short enough to repeat per file (a `<div class="device">` wrapper); shared CSS handles all visuals
- **Component vocabulary** in `_components.css`: `.btn-primary`, `.btn-ghost`, `.card`, `.input`, `.tab-bar`, `.tab`, `.fab`, `.list-row`, `.chip`, `.star-rating`, `.review-card`. Used consistently so a future swap of the visual layer (e.g., showing a different theme on every screen) only touches the CSS variables

### File map

```
.superpowers/brainstorm/<session>/content/
├── 00-nav-hub.html
├── 01-welcome.html
├── 02-sign-up.html
├── 03-sign-in.html
├── 04-verify-email.html
├── 05-forgot-password.html
├── 06-reset-password.html
├── 07-home.html
├── 08-browse.html
├── 09-reviews.html
├── 10-profile.html
├── 11-fab-sheet.html
├── 12-scan.html
├── 13-scan-result.html
├── 14-expiry-capture.html
├── 15-manual-entry.html
├── 16-record-detail.html
├── 17-product-detail.html
├── 18-write-review.html
├── 19-report-modal.html
├── 20-settings.html
├── 21-theme-picker.html
├── 22-notifications.html
├── 23-account.html
├── 24-empty-home.html
├── 25-push-preview.html
├── 26-item-limit.html
├── 27-referral.html
├── 28-contact.html
├── _shared.css
├── _frame.css
├── _components.css
└── _themes.js
```

---

## 9. Content and data

To make the prototype feel real, all mockups use realistic — but synthetic — content.

- **Product names:** common grocery items (Whole Milk, Greek Yogurt, Sourdough, Hummus, Spinach, Eggs, Olive Oil, Coffee Beans, Almond Butter, Tomato Sauce, etc.)
- **Brands:** generic-sounding fictional brands (Northland Dairy, Greenleaf, Olive Grove, Sunrise Bakery)
- **Dates:** mixed urgencies — some expired, some today/tomorrow, some weeks/months out
- **Avatars:** initials-on-color circles for users (no real photos, no AI-generated likenesses)
- **Country flags:** emoji flags for review authors (🇺🇸 🇫🇷 🇯🇵 🇧🇷 🇰🇷)
- **Ratings:** mixed three-option ratings (will buy again / on sale only / won't), mixed Wilson helpfulness scores on commented reviews
- **Review bodies:** plausible 1-3 sentence reviews

No real product UPCs, no real EANs, no real third-party brands.

---

## 10. Out of scope (deferred)

- Animation polish beyond the theme cross-fade
- Real device-frame fidelity (glare, materials, ProMotion)
- Cross-theme rendering of every screen (only the home miniature renders in all four themes)
- Mobile-viewport responsive testing — the prototype is for desktop browser viewing; the device frame is fixed-size
- Accessibility audit — the prototype is illustrative, not the production app. The real app's accessibility work is covered in M4 Phase F
- Storybook or component documentation — not needed for a static prototype
- Persistence of theme choice across page loads — intentional; see section 7

---

## 11. Acceptance criteria

The prototype is "done" when:

1. All 28 screens render correctly in a Chromium-based browser at desktop viewport
2. The nav hub links to every screen, and every screen links back to the nav hub
3. The Theme Picker (screen 21) successfully cross-fades the page chrome and the Settings screen behind the sheet to match the tapped preview card, across all four themes (per section 7)
4. All visible content matches section 9 (no real third-party brands, no PII, no AI-generated likenesses)
5. The Expyrico theme on every screen visibly demonstrates: Warm White surfaces, Fresh Sage primary + Honey accents, status colors (Sage/Honey/Red) on pantry items, consistent component vocabulary
6. The push notification preview (screen 25) shows realistic copy that aligns with the spec's notification rules

---

## 12. Implementation notes

- The mockup is built directly in the running visual companion session at `http://localhost:52271`, with files persisted under `.superpowers/brainstorm/68898-1779595911/content/`
- Each screen will be presented in the browser as it's built; the user can review and request changes before the full implementation plan kicks in
- The implementation plan (next step after this spec is approved) will sequence screens by section: shared CSS first, then auth, then main tabs, then pantry flow, then product/reviews, then settings, then specials, then the nav hub last (since it depends on every screen existing)
