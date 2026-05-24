# Pantry Mobile Mockup Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, clickable HTML prototype of all 25 Pantry App mobile screens, viewable in a desktop browser, with a working four-theme picker on the Theme Picker screen.

**Architecture:** Plain HTML/CSS/JS files served as static content. Each screen is one self-contained HTML file that embeds a shared iPhone 15 Pro device frame, links to four shared assets (`_shared.css`, `_frame.css`, `_components.css`, `_themes.js`), and contains screen-specific body markup. The nav hub (`00-nav-hub.html`) is the entry point. No build step, no framework. The Theme Picker is the only screen with runtime behavior — a 200ms cross-fade between the four theme variable bundles defined in `_shared.css`.

**Tech Stack:** HTML5, modern CSS (custom properties, `backdrop-filter`, CSS grid, flexbox), vanilla JS. No bundler. No dependencies.

**Source spec:** `docs/superpowers/specs/2026-05-24-mobile-mockup-design.md` — authoritative for all visual decisions. This plan implements that spec.

**Working directory:** All output files live in `.superpowers/brainstorm/68898-1779595911/content/` (path mandated by spec §3). This directory is gitignored — the prototype files themselves are NOT committed. Each task commits the plan/progress, not the prototype binaries.

> **Note on testing:** The prototype is explicitly non-functional (spec §1, §2). There is no business logic to unit-test. Verification for every screen is **visual inspection in a browser** against a per-task checklist. The one exception is the Theme Picker's switching behavior, which has a small manual interaction check.

> **Note on URLs:** The spec §3 references `/files/<filename>` URLs from the visual companion server. To make the prototype portable across the companion, a plain HTTP server, and `file://` access, **all in-prototype navigation uses relative URLs** (`01-welcome.html`, not `/files/01-welcome.html`). This is a small, deliberate deviation from spec §3 and §5 documented here.

---

## Screen file scaffold (used by every screen task)

Every screen file (`01-welcome.html` … `25-push-preview.html`) follows this exact scaffold. Tasks below only specify what goes inside `<main class="screen">…</main>` and any per-screen `<style>` tweaks. The `<title>` and `data-screen-title` attribute change per screen.

```html
<!doctype html>
<html lang="en" data-theme="aurora">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SCREEN_TITLE — Pantry Mockup</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" />
  <link rel="stylesheet" href="_shared.css" />
  <link rel="stylesheet" href="_frame.css" />
  <link rel="stylesheet" href="_components.css" />
</head>
<body>
  <a class="back-link" href="00-nav-hub.html">← All screens</a>
  <div class="device" data-screen-title="SCREEN_TITLE">
    <div class="bezel">
      <div class="dynamic-island"></div>
      <div class="status-bar">
        <span class="sb-time">9:41</span>
        <span class="sb-right">
          <svg class="sb-signal" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="0.5"/><rect x="4" y="6" width="3" height="6" rx="0.5"/><rect x="8" y="3" width="3" height="9" rx="0.5"/><rect x="12" y="0" width="3" height="12" rx="0.5"/></svg>
          <svg class="sb-wifi" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm0-3.6a2.4 2.4 0 0 0-1.7.7l-1-1A3.9 3.9 0 0 1 8 6a3.9 3.9 0 0 1 2.7 1.1l-1 1A2.4 2.4 0 0 0 8 7.6Zm0-3.6a6 6 0 0 0-4.2 1.7l-1-1A7.5 7.5 0 0 1 8 2.4a7.5 7.5 0 0 1 5.2 2.1l-1 1A6 6 0 0 0 8 4Z"/></svg>
          <span class="sb-battery"><span class="sb-battery-fill"></span></span>
        </span>
      </span>
      <main class="screen">
        SCREEN_BODY_GOES_HERE
      </main>
      <div class="home-indicator"></div>
    </div>
  </div>
  <p class="caption">SCREEN_TITLE — <code>FILE_NAME.html</code></p>
</body>
</html>
```

The Theme Picker file (`21-theme-picker.html`) additionally loads `_themes.js` with `<script src="_themes.js" defer></script>` before `</head>`.

---

## File Structure

All paths relative to `.superpowers/brainstorm/68898-1779595911/content/`.

**Shared (4 files):**
- `_shared.css` — design tokens for all four themes as `[data-theme="..."]` blocks, typography, base reset
- `_frame.css` — iPhone 15 Pro device frame, dynamic island, status bar, home indicator, page caption, back link
- `_components.css` — `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input`, `.tab-bar`, `.fab`, `.list-row`, `.chip`, `.star-rating`, `.review-card`, `.product-card`, `.modal-sheet`
- `_themes.js` — Theme Picker switch logic (~30 LOC)

**Screens (26 files):**
- `00-nav-hub.html` — entry point, grid of all 25 screen thumbnails
- `01-welcome.html` … `25-push-preview.html` — see spec §6

---

## Task 1: Foundation — `_shared.css`

**Files:**
- Create: `.superpowers/brainstorm/68898-1779595911/content/_shared.css`

- [ ] **Step 1: Write `_shared.css` with all four theme token bundles**

```css
/* _shared.css — design tokens for four themes, base reset, typography */

/* Base reset */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.4;
  color: var(--text-primary);
  background: var(--page-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 16px 80px;
}
button { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }
a { color: inherit; text-decoration: none; }
input, textarea { font: inherit; }
img { max-width: 100%; display: block; }

h1, h2, h3, h4, h5 {
  font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}

/* ===== Aurora Glass (default) ===== */
[data-theme="aurora"] {
  --page-bg: #F8F7FC;

  --screen-bg:
    radial-gradient(at 20% 10%, #E0E7FF 0%, transparent 50%),
    radial-gradient(at 80% 20%, #FED7AA 0%, transparent 45%),
    radial-gradient(at 50% 90%, #D1FAE5 0%, transparent 55%),
    #F5F3FF;

  --grain-overlay: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");

  --card-bg: rgba(255, 255, 255, 0.60);
  --card-border: rgba(255, 255, 255, 0.45);
  --card-shadow: 0 8px 32px rgba(80, 70, 200, 0.10);
  --card-radius: 24px;
  --card-blur: blur(20px);

  --pill-radius: 16px;
  --round-radius: 999px;

  --accent: #06B6D4;
  --accent-soft: rgba(6, 182, 212, 0.12);
  --accent-ring: rgba(6, 182, 212, 0.40);
  --danger: #EC4899;
  --success: #10B981;
  --warning: #F59E0B;

  --text-primary: rgba(26, 26, 46, 0.90);
  --text-secondary: rgba(26, 26, 46, 0.60);
  --text-tertiary: rgba(26, 26, 46, 0.40);
  --text-on-accent: #FFFFFF;

  --urgency-fresh: #10B981;
  --urgency-soon: #F59E0B;
  --urgency-urgent: #EF4444;

  --tabbar-bg: rgba(255, 255, 255, 0.75);
  --tabbar-border: rgba(0, 0, 0, 0.06);

  --input-bg: rgba(255, 255, 255, 0.70);
  --input-border: rgba(26, 26, 46, 0.12);
}

/* ===== Bento Grid ===== */
[data-theme="bento"] {
  --page-bg: #F2F2F2;
  --screen-bg: #FAFAFA;
  --grain-overlay: none;

  --card-bg: #FFFFFF;
  --card-border: rgba(0, 0, 0, 0.06);
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  --card-radius: 20px;
  --card-blur: none;

  --pill-radius: 12px;
  --round-radius: 999px;

  --accent: #4F46E5;
  --accent-soft: rgba(79, 70, 229, 0.10);
  --accent-ring: rgba(79, 70, 229, 0.45);
  --danger: #DC2626;
  --success: #16A34A;
  --warning: #D97706;

  --text-primary: #111111;
  --text-secondary: #555555;
  --text-tertiary: #999999;
  --text-on-accent: #FFFFFF;

  --urgency-fresh: #16A34A;
  --urgency-soon: #D97706;
  --urgency-urgent: #DC2626;

  --tabbar-bg: #FFFFFF;
  --tabbar-border: rgba(0, 0, 0, 0.08);

  --input-bg: #FFFFFF;
  --input-border: rgba(0, 0, 0, 0.10);
}

/* ===== Soft Clay ===== */
[data-theme="clay"] {
  --page-bg: #FFE5D9;
  --screen-bg: #FFE5D9;
  --grain-overlay: none;

  --card-bg: #FFF1E6;
  --card-border: rgba(255, 255, 255, 0.5);
  --card-shadow:
    8px 8px 20px rgba(180, 130, 100, 0.25),
    -6px -6px 18px rgba(255, 255, 255, 0.85);
  --card-radius: 32px;
  --card-blur: none;

  --pill-radius: 20px;
  --round-radius: 999px;

  --accent: #FF7A59;
  --accent-soft: rgba(255, 122, 89, 0.15);
  --accent-ring: rgba(255, 122, 89, 0.40);
  --danger: #E5484D;
  --success: #5BB97A;
  --warning: #E8A33D;

  --text-primary: #4A2C1F;
  --text-secondary: rgba(74, 44, 31, 0.65);
  --text-tertiary: rgba(74, 44, 31, 0.40);
  --text-on-accent: #FFFFFF;

  --urgency-fresh: #5BB97A;
  --urgency-soon: #E8A33D;
  --urgency-urgent: #E5484D;

  --tabbar-bg: #FFF1E6;
  --tabbar-border: rgba(74, 44, 31, 0.08);

  --input-bg: #FFF8F2;
  --input-border: rgba(74, 44, 31, 0.10);
}

/* ===== Material You ===== */
[data-theme="material"] {
  --page-bg: #F4EFF7;
  --screen-bg: #FEF7FF;
  --grain-overlay: none;

  --card-bg: #F7F2FA;
  --card-border: rgba(103, 80, 164, 0.08);
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --card-radius: 16px;
  --card-blur: none;

  --pill-radius: 999px;
  --round-radius: 999px;

  --accent: #6750A4;
  --accent-soft: #EADDFF;
  --accent-ring: rgba(103, 80, 164, 0.45);
  --danger: #B3261E;
  --success: #146C2E;
  --warning: #B7621B;

  --text-primary: #1D1B20;
  --text-secondary: #49454F;
  --text-tertiary: #79747E;
  --text-on-accent: #FFFFFF;

  --urgency-fresh: #146C2E;
  --urgency-soon: #B7621B;
  --urgency-urgent: #B3261E;

  --tabbar-bg: #FEF7FF;
  --tabbar-border: rgba(0, 0, 0, 0.06);

  --input-bg: #FEF7FF;
  --input-border: rgba(0, 0, 0, 0.10);
}

/* Theme cross-fade for the Theme Picker */
.bezel, .screen, .tab-bar, .fab, .card, .btn-primary, .input, .home-indicator, .status-bar {
  transition:
    background-color 200ms ease,
    background 200ms ease,
    color 200ms ease,
    border-color 200ms ease,
    box-shadow 200ms ease;
}
```

- [ ] **Step 2: Verify file written**

Run: `ls -la .superpowers/brainstorm/68898-1779595911/content/_shared.css && wc -l .superpowers/brainstorm/68898-1779595911/content/_shared.css`
Expected: file exists, ~150 lines

- [ ] **Step 3: Commit the plan progress (not the prototype files — they are gitignored)**

```bash
git add docs/superpowers/plans/2026-05-24-mobile-mockup-prototype.md
git commit -m "chore(mockup): foundation shared.css written" --allow-empty
```

---

## Task 2: Foundation — `_frame.css`

**Files:**
- Create: `.superpowers/brainstorm/68898-1779595911/content/_frame.css`

- [ ] **Step 1: Write the device frame stylesheet**

```css
/* _frame.css — iPhone 15 Pro device frame, status bar, home indicator, page chrome */

.back-link {
  position: fixed;
  top: 16px;
  right: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--card-bg);
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  z-index: 100;
}
.back-link:hover { color: var(--accent); }

.device {
  width: 417px; /* 393 logical + 12*2 bezel */
  height: 876px; /* 852 + 12*2 */
  position: relative;
  filter: drop-shadow(0 30px 60px rgba(60, 50, 120, 0.20))
          drop-shadow(0 12px 24px rgba(60, 50, 120, 0.15));
}

.bezel {
  width: 100%;
  height: 100%;
  background: #0A0A0A;
  border-radius: 55px;
  padding: 12px;
  position: relative;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.screen {
  width: 393px;
  height: 852px;
  border-radius: 44px;
  overflow: hidden;
  position: relative;
  background: var(--screen-bg);
  color: var(--text-primary);
}
.screen::before {
  content: "";
  position: absolute; inset: 0;
  background-image: var(--grain-overlay);
  pointer-events: none;
  opacity: 0.6;
  z-index: 0;
}
.screen > * { position: relative; z-index: 1; }

.dynamic-island {
  position: absolute;
  top: 22px;
  left: 50%;
  transform: translateX(-50%);
  width: 125px;
  height: 35px;
  background: #000;
  border-radius: 999px;
  z-index: 50;
}

.status-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  height: 54px;
  padding: 18px 32px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  z-index: 40;
  pointer-events: none;
}
.sb-right { display: inline-flex; align-items: center; gap: 6px; }
.sb-right svg { width: 18px; height: 12px; fill: currentColor; }
.sb-battery {
  width: 26px; height: 12px;
  border: 1.5px solid currentColor;
  border-radius: 3px;
  position: relative;
  margin-left: 2px;
}
.sb-battery::after {
  content: ""; position: absolute;
  right: -3px; top: 3px;
  width: 2px; height: 4px;
  background: currentColor;
  border-radius: 0 1px 1px 0;
}
.sb-battery-fill {
  position: absolute; top: 1.5px; left: 1.5px; bottom: 1.5px;
  width: 80%;
  background: currentColor;
  border-radius: 1.5px;
}

.home-indicator {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 134px;
  height: 5px;
  border-radius: 999px;
  background: var(--text-primary);
  opacity: 0.85;
  z-index: 60;
  pointer-events: none;
}

/* Account for the 54px status bar area above content */
.screen > .content,
.screen > main,
.screen > .screen-content {
  padding-top: 66px;
}

.caption {
  margin-top: 18px;
  color: var(--text-secondary);
  font-size: 13px;
}
.caption code {
  background: var(--card-bg);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 12px;
}
```

- [ ] **Step 2: Verify**

Run: `ls -la .superpowers/brainstorm/68898-1779595911/content/_frame.css`
Expected: file exists

- [ ] **Step 3: Commit plan progress**

```bash
git commit --allow-empty -m "chore(mockup): foundation frame.css written"
```

---

## Task 3: Foundation — `_components.css`

**Files:**
- Create: `.superpowers/brainstorm/68898-1779595911/content/_components.css`

- [ ] **Step 1: Write the components stylesheet**

```css
/* _components.css — reusable components */

/* ===== Layout helpers ===== */
.screen-content {
  padding: 66px 20px 100px; /* top accounts for status bar; bottom for tab bar / home indicator */
  height: 100%;
  overflow-y: auto;
}
.screen-content.no-tabbar { padding-bottom: 40px; }

.row { display: flex; align-items: center; gap: 12px; }
.row-between { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.stack-lg { display: flex; flex-direction: column; gap: 20px; }

.h1 { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
.h2 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 600; line-height: 1.2; }
.h3 { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 600; }
.body { font-size: 15px; color: var(--text-primary); }
.body-sm { font-size: 13px; color: var(--text-secondary); }
.muted { color: var(--text-secondary); }
.tertiary { color: var(--text-tertiary); }

/* ===== Buttons ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  border-radius: var(--pill-radius);
  font-weight: 600;
  font-size: 15px;
  min-height: 48px;
}
.btn-primary {
  background: var(--accent);
  color: var(--text-on-accent);
  box-shadow: 0 4px 16px var(--accent-ring);
}
.btn-primary:active { transform: translateY(1px); }
.btn-ghost {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--card-border);
  backdrop-filter: var(--card-blur);
}
.btn-danger {
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
}
.btn-text { padding: 8px 12px; color: var(--accent); font-weight: 600; }
.btn-text-danger { padding: 8px 12px; color: var(--danger); font-weight: 600; }
.btn-block { width: 100%; }

/* ===== Cards ===== */
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  backdrop-filter: var(--card-blur);
  padding: 16px;
}
.card.tight { padding: 12px; }
.card.flat { box-shadow: none; }

/* ===== Inputs ===== */
.input {
  width: 100%;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--pill-radius);
  padding: 14px 16px;
  font-size: 15px;
  color: var(--text-primary);
  outline: none;
}
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
.input-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; display: block; }
textarea.input { min-height: 96px; resize: none; line-height: 1.5; }

.checkbox { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.checkbox input { width: 18px; height: 18px; accent-color: var(--accent); }

/* ===== Tab bar ===== */
.tab-bar {
  position: absolute;
  left: 0; right: 0;
  bottom: 0;
  height: 84px;
  padding: 8px 16px 28px;
  background: var(--tabbar-bg);
  border-top: 1px solid var(--tabbar-border);
  backdrop-filter: var(--card-blur);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  z-index: 30;
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 500;
}
.tab.active { color: var(--accent); }
.tab .tab-icon { width: 26px; height: 26px; }

/* ===== FAB ===== */
.fab {
  position: absolute;
  bottom: 100px; /* above tab bar */
  left: 50%;
  transform: translateX(-50%);
  width: 60px; height: 60px;
  border-radius: var(--round-radius);
  background: var(--accent);
  color: var(--text-on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px var(--accent-ring);
  z-index: 35;
  font-size: 28px;
  font-weight: 300;
}

/* ===== List rows ===== */
.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--card-border);
}
.list-row:last-child { border-bottom: none; }
.list-row .lr-icon { width: 24px; height: 24px; color: var(--text-secondary); }
.list-row .lr-title { flex: 1; font-size: 15px; }
.list-row .lr-chevron { color: var(--text-tertiary); }
.list-row.danger .lr-title { color: var(--danger); }

/* ===== Chips ===== */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--pill-radius);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}
.chip.active { background: var(--accent); color: var(--text-on-accent); border-color: transparent; }
.chip-row { display: flex; gap: 8px; flex-wrap: nowrap; overflow-x: auto; padding: 4px 0; }
.chip-row::-webkit-scrollbar { display: none; }

/* ===== Star rating ===== */
.star-rating { display: inline-flex; gap: 2px; color: var(--warning); font-size: 14px; }
.star-rating .star-empty { color: var(--text-tertiary); }
.star-rating-lg { font-size: 22px; gap: 4px; }

/* ===== Product card ===== */
.product-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 132px;
  flex-shrink: 0;
}
.product-card .pc-img {
  width: 132px; height: 132px;
  border-radius: var(--card-radius);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  backdrop-filter: var(--card-blur);
  display: flex; align-items: center; justify-content: center;
  font-size: 48px;
}
.product-card .pc-name { font-size: 14px; font-weight: 600; }
.product-card .pc-brand { font-size: 12px; color: var(--text-secondary); }

/* ===== Pantry item card ===== */
.pantry-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px 12px 18px;
  border-radius: var(--card-radius);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  backdrop-filter: var(--card-blur);
  position: relative;
  overflow: hidden;
}
.pantry-item::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: var(--urgency-fresh);
}
.pantry-item.urgency-soon::before { background: var(--urgency-soon); }
.pantry-item.urgency-urgent::before { background: var(--urgency-urgent); }
.pantry-item .pi-img {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: var(--input-bg);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}
.pantry-item .pi-name { font-weight: 600; font-size: 14px; }
.pantry-item .pi-brand { font-size: 12px; color: var(--text-secondary); }
.pantry-item .pi-expiry { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-align: right; }
.pantry-item.urgency-soon .pi-expiry { color: var(--warning); }
.pantry-item.urgency-urgent .pi-expiry { color: var(--urgency-urgent); }

/* ===== Review card ===== */
.review-card { padding: 14px; }
.review-card .rc-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.review-card .rc-avatar {
  width: 36px; height: 36px;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 14px;
  color: white;
}
.review-card .rc-name { font-weight: 600; font-size: 14px; }
.review-card .rc-meta { font-size: 12px; color: var(--text-secondary); }
.review-card .rc-body { font-size: 14px; line-height: 1.45; margin: 6px 0 10px; }
.review-card .rc-foot { display: flex; gap: 14px; font-size: 12px; color: var(--text-secondary); }
.review-card .rc-vote { display: inline-flex; gap: 4px; align-items: center; }

/* ===== Modal sheet ===== */
.scrim {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.40);
  z-index: 70;
}
.modal-sheet {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  background: var(--screen-bg);
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  padding: 20px 20px 40px;
  z-index: 80;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.15);
  max-height: 85%;
  overflow-y: auto;
}
.modal-sheet .sheet-handle {
  width: 36px; height: 4px;
  background: var(--text-tertiary);
  opacity: 0.5;
  border-radius: 999px;
  margin: 0 auto 14px;
}
.modal-sheet .sheet-title { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 600; margin-bottom: 16px; text-align: center; }

/* ===== Section header (in lists) ===== */
.section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin: 18px 4px 8px;
}

/* ===== Floating page header ===== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.page-header .icon-btn {
  width: 40px; height: 40px;
  border-radius: 999px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  backdrop-filter: var(--card-blur);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 18px;
}
```

- [ ] **Step 2: Verify**

Run: `ls -la .superpowers/brainstorm/68898-1779595911/content/_components.css && wc -l .superpowers/brainstorm/68898-1779595911/content/_components.css`
Expected: file exists, ~260 lines

- [ ] **Step 3: Commit plan progress**

```bash
git commit --allow-empty -m "chore(mockup): foundation components.css written"
```

---

## Task 4: Foundation — `_themes.js`

**Files:**
- Create: `.superpowers/brainstorm/68898-1779595911/content/_themes.js`

- [ ] **Step 1: Write the theme switcher**

```javascript
// _themes.js — theme switcher for the Theme Picker screen
(function () {
  'use strict';
  document.addEventListener('click', function (event) {
    var card = event.target.closest('[data-theme-card]');
    if (!card) return;
    var theme = card.getAttribute('data-theme-card');
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-card]').forEach(function (el) {
      el.classList.toggle('is-selected', el === card);
    });
  });
})();
```

- [ ] **Step 2: Verify**

Run: `cat .superpowers/brainstorm/68898-1779595911/content/_themes.js | head -5`
Expected: shows the IIFE wrapper opening line

- [ ] **Step 3: Commit plan progress**

```bash
git commit --allow-empty -m "chore(mockup): foundation themes.js written"
```

---

## Task 5: Start a local server for viewing (one-time setup)

The visual companion server is not currently running. The simplest portable way to view the prototype is a Python static server.

- [ ] **Step 1: Start the server in the background**

Run (from repo root, in a separate terminal or via `&`):
```bash
cd .superpowers/brainstorm/68898-1779595911/content && python3 -m http.server 52271 >/tmp/mockup-server.log 2>&1 &
```

- [ ] **Step 2: Verify the server responds**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:52271/`
Expected: `200`

- [ ] **Step 3: Note for subsequent tasks**

All "view in browser" steps below mean: open `http://localhost:52271/<file>.html` in a Chromium-based browser. If the server isn't running, the engineer can also open the files via `file://` URLs directly — relative links and assets will still resolve.

---

## Task 6: Screen 01 — Welcome (`01-welcome.html`)

**Files:**
- Create: `.superpowers/brainstorm/68898-1779595911/content/01-welcome.html`

**Spec reference:** §6 screen 1.

- [ ] **Step 1: Write the file using the screen scaffold above with the following body**

`SCREEN_TITLE` = `Welcome` ; `FILE_NAME` = `01-welcome` ; body:

```html
<div class="screen-content no-tabbar" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-top:120px;">
  <div style="font-size:96px;margin-bottom:16px;transform:rotate(-12deg);">🥛</div>
  <h1 class="h1" style="margin-bottom:8px;">Pantry</h1>
  <p class="body" style="max-width:280px;color:var(--text-secondary);margin-bottom:48px;">
    Track what you have. Know what's about to expire. Find what's worth buying again.
  </p>
  <div class="stack" style="width:100%;max-width:280px;">
    <a class="btn btn-primary btn-block" href="02-sign-up.html">Get started</a>
    <a class="btn btn-ghost btn-block" href="03-sign-in.html">I have an account</a>
  </div>
</div>
```

- [ ] **Step 2: View in browser**

Open `http://localhost:52271/01-welcome.html`

- [ ] **Step 3: Visual verification checklist**

  - Aurora gradient background visible behind the device
  - Tilted carton emoji renders centered
  - Two CTAs stack vertically, primary on top
  - "Get started" routes to sign-up, "I have an account" routes to sign-in (click both, then back)
  - "← All screens" link in top-right routes to nav hub (will 404 until Task 31; expected for now)

- [ ] **Step 4: Commit plan progress**

```bash
git commit --allow-empty -m "chore(mockup): screen 01 welcome"
```

---

## Task 7: Screen 02 — Sign-up (`02-sign-up.html`)

**Files:**
- Create: `.superpowers/brainstorm/68898-1779595911/content/02-sign-up.html`

**Spec reference:** §6 screen 2.

- [ ] **Step 1: Write the file using the scaffold; body:**

`SCREEN_TITLE` = `Sign up` ; `FILE_NAME` = `02-sign-up` ; body:

```html
<div class="screen-content no-tabbar">
  <h1 class="h1" style="margin-bottom:6px;">Create your account</h1>
  <p class="body-sm" style="margin-bottom:24px;">Track your pantry, share what's good.</p>

  <div class="stack" style="margin-bottom:18px;">
    <div>
      <label class="input-label">Email</label>
      <input class="input" type="email" value="alex@example.com" />
    </div>
    <div>
      <label class="input-label">Password</label>
      <input class="input" type="password" value="••••••••••" />
    </div>
    <div>
      <label class="input-label">Confirm password</label>
      <input class="input" type="password" value="••••••••••" />
    </div>
    <label class="checkbox">
      <input type="checkbox" checked />
      <span class="body-sm">I agree to the <span style="color:var(--accent);">Terms</span> and <span style="color:var(--accent);">Privacy Policy</span>.</span>
    </label>
  </div>

  <a class="btn btn-primary btn-block" href="04-verify-email.html">Create account</a>

  <div style="display:flex;align-items:center;gap:12px;margin:24px 0;color:var(--text-tertiary);font-size:12px;">
    <div style="flex:1;height:1px;background:var(--card-border);"></div>
    <span>or sign up with</span>
    <div style="flex:1;height:1px;background:var(--card-border);"></div>
  </div>

  <div class="row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
    <a class="btn btn-ghost" href="04-verify-email.html">G</a>
    <a class="btn btn-ghost" href="04-verify-email.html"></a>
    <a class="btn btn-ghost" href="04-verify-email.html">🔑</a>
  </div>
  <p class="body-sm" style="text-align:center;margin-top:14px;">
    Already have one? <a href="03-sign-in.html" style="color:var(--accent);font-weight:600;">Sign in</a>
  </p>
</div>
```

- [ ] **Step 2: View** at `http://localhost:52271/02-sign-up.html`

- [ ] **Step 3: Visual checklist**
  - Three fields stacked, terms checkbox below
  - Primary "Create account" button full-width, routes to verify-email
  - "or sign up with" divider rendered
  - Three OAuth buttons in a row, each routes to verify-email
  - "Sign in" link routes to sign-in

- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 02 sign-up"`

---

## Task 8: Screen 03 — Sign-in (`03-sign-in.html`)

**Files:**
- Create: `.superpowers/brainstorm/68898-1779595911/content/03-sign-in.html`

**Spec reference:** §6 screen 3.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Sign in` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h1" style="margin-bottom:6px;">Welcome back</h1>
  <p class="body-sm" style="margin-bottom:24px;">Sign in to your pantry.</p>

  <div class="stack" style="margin-bottom:18px;">
    <div>
      <label class="input-label">Email</label>
      <input class="input" type="email" value="alex@example.com" />
    </div>
    <div>
      <div class="row-between" style="margin-bottom:6px;">
        <label class="input-label" style="margin:0;">Password</label>
        <a href="05-forgot-password.html" style="font-size:13px;color:var(--accent);font-weight:600;">Forgot?</a>
      </div>
      <input class="input" type="password" value="••••••••••" />
    </div>
  </div>

  <a class="btn btn-primary btn-block" href="07-home.html">Sign in</a>

  <div style="display:flex;align-items:center;gap:12px;margin:24px 0;color:var(--text-tertiary);font-size:12px;">
    <div style="flex:1;height:1px;background:var(--card-border);"></div>
    <span>or continue with</span>
    <div style="flex:1;height:1px;background:var(--card-border);"></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
    <a class="btn btn-ghost" href="07-home.html">G</a>
    <a class="btn btn-ghost" href="07-home.html"></a>
    <a class="btn btn-ghost" href="07-home.html">🔑</a>
  </div>
  <p class="body-sm" style="text-align:center;margin-top:14px;">
    Don't have an account? <a href="02-sign-up.html" style="color:var(--accent);font-weight:600;">Sign up</a>
  </p>
</div>
```

- [ ] **Step 2: View** at `/03-sign-in.html`
- [ ] **Step 3: Checklist** — fields, inline "Forgot?", primary button routes to home, OAuth row routes to home
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 03 sign-in"`

---

## Task 9: Screen 04 — Verify-email (`04-verify-email.html`)

**Spec reference:** §6 screen 4.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Verify your email` ; body:**

```html
<div class="screen-content no-tabbar" style="text-align:center;padding-top:120px;">
  <div style="font-size:80px;margin-bottom:24px;">📬</div>
  <h1 class="h1" style="margin-bottom:10px;">Check your inbox</h1>
  <p class="body" style="color:var(--text-secondary);margin-bottom:8px;">We sent a verification link to</p>
  <div class="chip" style="margin:0 auto 32px;display:inline-flex;background:var(--accent-soft);color:var(--accent);border-color:transparent;">alex@example.com</div>

  <div class="stack" style="max-width:280px;margin:0 auto;">
    <button class="btn btn-ghost btn-block" disabled style="opacity:0.6;">Resend in 47s</button>
    <a class="btn-text" href="02-sign-up.html" style="text-align:center;">Change email</a>
  </div>
</div>
```

- [ ] **Step 2: View** at `/04-verify-email.html`
- [ ] **Step 3: Checklist** — mail icon, email chip in accent color, disabled resend button with cooldown, change-email link
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 04 verify-email"`

---

## Task 10: Screen 05 — Forgot-password (`05-forgot-password.html`)

**Spec reference:** §6 screen 5.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Forgot password` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h1" style="margin-bottom:6px;">Reset your password</h1>
  <p class="body-sm" style="margin-bottom:24px;">Enter your email and we'll send a reset link.</p>

  <div class="stack" style="margin-bottom:20px;">
    <div>
      <label class="input-label">Email</label>
      <input class="input" type="email" value="alex@example.com" />
    </div>
  </div>

  <a class="btn btn-primary btn-block" href="#sent">Send reset link</a>

  <div id="sent" class="card" style="margin-top:24px;border-left:4px solid var(--success);">
    <div class="row" style="gap:10px;">
      <span style="font-size:22px;">✓</span>
      <div>
        <div style="font-weight:600;">Link sent</div>
        <div class="body-sm">Check your inbox for the reset link.</div>
      </div>
    </div>
  </div>

  <p class="body-sm" style="text-align:center;margin-top:24px;">
    <a href="03-sign-in.html" style="color:var(--accent);font-weight:600;">Back to sign in</a>
  </p>
</div>
```

- [ ] **Step 2: View** at `/05-forgot-password.html`
- [ ] **Step 3: Checklist** — single email field, primary button anchors to inline success state, success card with green accent and check mark visible below
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 05 forgot-password"`

---

## Task 11: Screen 06 — Reset-password (`06-reset-password.html`)

**Spec reference:** §6 screen 6.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `New password` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h1" style="margin-bottom:6px;">Set a new password</h1>
  <p class="body-sm" style="margin-bottom:24px;">Choose something you haven't used here before.</p>

  <div class="stack" style="margin-bottom:20px;">
    <div>
      <label class="input-label">New password</label>
      <input class="input" type="password" value="••••••••••" />
    </div>
    <div>
      <label class="input-label">Confirm new password</label>
      <input class="input" type="password" value="••••••••••" />
    </div>
  </div>

  <a class="btn btn-primary btn-block" href="03-sign-in.html">Save and sign in</a>
</div>
```

- [ ] **Step 2: View** at `/06-reset-password.html`
- [ ] **Step 3: Checklist** — two password fields, save button routes to sign-in
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 06 reset-password"`

---

## Task 12: Shared snippet — bottom tab bar markup (used by screens 07–10)

Tasks 12–15 each include this tab bar markup at the bottom of `.screen` (sibling of `.screen-content`). It's shown once here, then referenced in each of those four tasks.

```html
<nav class="tab-bar">
  <a class="tab TAB_HOME_ACTIVE" href="07-home.html">
    <span class="tab-icon">🏠</span>
    <span>Home</span>
  </a>
  <a class="tab TAB_BROWSE_ACTIVE" href="08-browse.html">
    <span class="tab-icon">🔎</span>
    <span>Browse</span>
  </a>
  <a class="tab TAB_REVIEWS_ACTIVE" href="09-reviews.html">
    <span class="tab-icon">★</span>
    <span>Reviews</span>
  </a>
  <a class="tab TAB_PROFILE_ACTIVE" href="10-profile.html">
    <span class="tab-icon">👤</span>
    <span>Profile</span>
  </a>
</nav>
```

In each task, replace the `TAB_*_ACTIVE` placeholder for that tab with `active` and the others with empty strings.

---

## Task 13: Screen 07 — Home (`07-home.html`)

**Spec reference:** §6 screen 7. The flagship pantry list.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Your pantry`. Inside `.screen` put `.screen-content` followed by `.fab` and the tab bar (Home active).**

`.screen-content`:

```html
<div class="screen-content">
  <div class="page-header">
    <h1 class="h2">Your pantry</h1>
    <button class="icon-btn" aria-label="Filter">⚙</button>
  </div>

  <div class="row" style="gap:8px;margin-bottom:14px;">
    <input class="input" placeholder="Search your pantry" style="padding:10px 16px;" />
  </div>

  <div class="section-title">Dairy</div>
  <div class="stack" style="gap:10px;">
    <div class="pantry-item urgency-urgent">
      <div class="pi-img">🥛</div>
      <div>
        <div class="pi-name">Whole Milk · 1 gal</div>
        <div class="pi-brand">Northland Dairy</div>
      </div>
      <div class="pi-expiry">Tomorrow<br/><span class="tertiary" style="font-size:11px;font-weight:500;">May 25</span></div>
    </div>
    <div class="pantry-item urgency-soon">
      <div class="pi-img">🧈</div>
      <div>
        <div class="pi-name">Greek Yogurt</div>
        <div class="pi-brand">Greenleaf</div>
      </div>
      <div class="pi-expiry">In 4 days<br/><span class="tertiary" style="font-size:11px;font-weight:500;">May 28</span></div>
    </div>
    <div class="pantry-item">
      <div class="pi-img">🧀</div>
      <div>
        <div class="pi-name">Sharp Cheddar</div>
        <div class="pi-brand">Northland Dairy</div>
      </div>
      <div class="pi-expiry">In 3 wks<br/><span class="tertiary" style="font-size:11px;font-weight:500;">Jun 16</span></div>
    </div>
  </div>

  <div class="section-title">Produce</div>
  <div class="stack" style="gap:10px;">
    <div class="pantry-item urgency-urgent">
      <div class="pi-img">🥬</div>
      <div>
        <div class="pi-name">Baby Spinach</div>
        <div class="pi-brand">Greenleaf Farms</div>
      </div>
      <div class="pi-expiry">Today<br/><span class="tertiary" style="font-size:11px;font-weight:500;">May 24</span></div>
    </div>
    <div class="pantry-item urgency-soon">
      <div class="pi-img">🍅</div>
      <div>
        <div class="pi-name">Cherry Tomatoes</div>
        <div class="pi-brand">Sunfield</div>
      </div>
      <div class="pi-expiry">In 5 days<br/><span class="tertiary" style="font-size:11px;font-weight:500;">May 29</span></div>
    </div>
  </div>

  <div class="section-title">Pantry</div>
  <div class="stack" style="gap:10px;">
    <div class="pantry-item">
      <div class="pi-img">🥖</div>
      <div>
        <div class="pi-name">Sourdough Loaf</div>
        <div class="pi-brand">Sunrise Bakery</div>
      </div>
      <div class="pi-expiry">In 6 days<br/><span class="tertiary" style="font-size:11px;font-weight:500;">May 30</span></div>
    </div>
    <div class="pantry-item">
      <div class="pi-img">🫘</div>
      <div>
        <div class="pi-name">Almond Butter</div>
        <div class="pi-brand">Olive Grove</div>
      </div>
      <div class="pi-expiry">In 4 mo<br/><span class="tertiary" style="font-size:11px;font-weight:500;">Sep 24</span></div>
    </div>
  </div>

  <div class="section-title">Beverages</div>
  <div class="stack" style="gap:10px;">
    <div class="pantry-item">
      <div class="pi-img">☕</div>
      <div>
        <div class="pi-name">Coffee Beans · Dark</div>
        <div class="pi-brand">Highland Roasters</div>
      </div>
      <div class="pi-expiry">In 2 mo<br/><span class="tertiary" style="font-size:11px;font-weight:500;">Jul 24</span></div>
    </div>
  </div>
</div>

<a class="fab" href="11-fab-sheet.html" aria-label="Add item">+</a>
```

Tab bar: Home active, others not. Use the Task 12 snippet, replace `TAB_HOME_ACTIVE` with `active`, others with empty string.

- [ ] **Step 2: View** at `/07-home.html`
- [ ] **Step 3: Checklist**
  - Header "Your pantry" + filter icon
  - Search input below
  - Four section headers: Dairy, Produce, Pantry, Beverages
  - Items show urgency bar (red/amber/none) on the left edge
  - FAB centered above the tab bar, routes to `/11-fab-sheet.html`
  - Tab bar shows Home active in cyan, others muted; tabs route correctly
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 07 home"`

---

## Task 14: Screen 08 — Browse (`08-browse.html`)

**Spec reference:** §6 screen 8.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Browse` ; tab bar with Browse active.**

`.screen-content`:

```html
<div class="screen-content">
  <h1 class="h2" style="margin-bottom:14px;">Browse</h1>
  <input class="input" placeholder="Search products" style="margin-bottom:14px;" />

  <div class="chip-row" style="margin-bottom:18px;">
    <span class="chip active">All</span>
    <span class="chip">Dairy</span>
    <span class="chip">Produce</span>
    <span class="chip">Pantry</span>
    <span class="chip">Beverages</span>
    <span class="chip">Frozen</span>
    <span class="chip">Snacks</span>
  </div>

  <div class="section-title">Top-rated</div>
  <div style="display:flex;gap:12px;overflow-x:auto;margin:0 -20px 8px;padding:4px 20px 12px;">
    <a class="product-card" href="17-product-detail.html">
      <div class="pc-img">🫒</div>
      <div class="pc-name">Olive Oil · EV</div>
      <div class="pc-brand">Olive Grove</div>
      <div class="star-rating" style="font-size:12px;">★★★★★ <span class="muted">4.8</span></div>
    </a>
    <a class="product-card" href="17-product-detail.html">
      <div class="pc-img">🍯</div>
      <div class="pc-name">Raw Honey</div>
      <div class="pc-brand">Beewise</div>
      <div class="star-rating" style="font-size:12px;">★★★★★ <span class="muted">4.7</span></div>
    </a>
    <a class="product-card" href="17-product-detail.html">
      <div class="pc-img">🥜</div>
      <div class="pc-name">Almond Butter</div>
      <div class="pc-brand">Olive Grove</div>
      <div class="star-rating" style="font-size:12px;">★★★★☆ <span class="muted">4.5</span></div>
    </a>
  </div>

  <div class="section-title">Recently added</div>
  <div style="display:flex;gap:12px;overflow-x:auto;margin:0 -20px;padding:4px 20px 12px;">
    <a class="product-card" href="17-product-detail.html">
      <div class="pc-img">🥛</div>
      <div class="pc-name">Whole Milk</div>
      <div class="pc-brand">Northland Dairy</div>
      <div class="star-rating" style="font-size:12px;">★★★★☆ <span class="muted">4.2</span></div>
    </a>
    <a class="product-card" href="17-product-detail.html">
      <div class="pc-img">🥖</div>
      <div class="pc-name">Sourdough</div>
      <div class="pc-brand">Sunrise Bakery</div>
      <div class="star-rating" style="font-size:12px;">★★★★★ <span class="muted">4.6</span></div>
    </a>
    <a class="product-card" href="17-product-detail.html">
      <div class="pc-img">🍫</div>
      <div class="pc-name">Dark Chocolate 70%</div>
      <div class="pc-brand">Cacaohouse</div>
      <div class="star-rating" style="font-size:12px;">★★★★☆ <span class="muted">4.3</span></div>
    </a>
  </div>
</div>
```

Tab bar: Browse active.

- [ ] **Step 2: View** at `/08-browse.html`
- [ ] **Step 3: Checklist** — search input, horizontal chip row, two horizontally-scrolling product sections, cards route to product detail
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 08 browse"`

---

## Task 15: Screen 09 — Reviews (`09-reviews.html`)

**Spec reference:** §6 screen 9.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Your reviews` ; tab bar with Reviews active.**

`.screen-content`:

```html
<div class="screen-content">
  <h1 class="h2" style="margin-bottom:14px;">Your reviews</h1>

  <div class="stack">
    <div class="card review-card">
      <div class="rc-head">
        <div class="pi-img" style="width:44px;height:44px;">🫒</div>
        <div style="flex:1;">
          <div class="rc-name">Olive Oil · Extra Virgin</div>
          <div class="rc-meta">Olive Grove · 3 days ago</div>
        </div>
        <button class="icon-btn" aria-label="More">⋯</button>
      </div>
      <div class="star-rating" style="margin-bottom:4px;">★★★★★</div>
      <p class="rc-body">Great peppery finish. Worth the price; we've been buying this for a year now…</p>
      <div class="rc-foot">
        <span class="rc-vote">▲ <strong>24</strong></span>
        <span class="rc-vote">▼ <strong>1</strong></span>
      </div>
    </div>

    <div class="card review-card">
      <div class="rc-head">
        <div class="pi-img" style="width:44px;height:44px;">🥛</div>
        <div style="flex:1;">
          <div class="rc-name">Whole Milk · 1 gal</div>
          <div class="rc-meta">Northland Dairy · 1 wk ago</div>
        </div>
        <button class="icon-btn" aria-label="More">⋯</button>
      </div>
      <div class="star-rating" style="margin-bottom:4px;">★★★★<span class="star-empty">★</span></div>
      <p class="rc-body">Creamy, never separates. Wish the carton was easier to pour without spilling.</p>
      <div class="rc-foot">
        <span class="rc-vote">▲ <strong>11</strong></span>
        <span class="rc-vote">▼ <strong>0</strong></span>
      </div>
    </div>

    <div class="card review-card">
      <div class="rc-head">
        <div class="pi-img" style="width:44px;height:44px;">🍯</div>
        <div style="flex:1;">
          <div class="rc-name">Raw Honey</div>
          <div class="rc-meta">Beewise · 2 wks ago</div>
        </div>
        <button class="icon-btn" aria-label="More">⋯</button>
      </div>
      <div class="star-rating" style="margin-bottom:4px;">★★★★★</div>
      <p class="rc-body">Tastes like actual honey, not corn syrup. Crystallizes after a few months — that's normal…</p>
      <div class="rc-foot">
        <span class="rc-vote">▲ <strong>32</strong></span>
        <span class="rc-vote">▼ <strong>2</strong></span>
      </div>
    </div>
  </div>
</div>
```

Tab bar: Reviews active.

- [ ] **Step 2: View** at `/09-reviews.html`
- [ ] **Step 3: Checklist** — three review cards stacked, each with avatar/thumbnail + name + meta + stars + body + vote totals + overflow menu
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 09 reviews"`

---

## Task 16: Screen 10 — Profile (`10-profile.html`)

**Spec reference:** §6 screen 10.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Profile` ; tab bar with Profile active.**

`.screen-content`:

```html
<div class="screen-content">
  <div style="text-align:center;margin-bottom:20px;padding-top:8px;">
    <div class="rc-avatar" style="width:80px;height:80px;font-size:30px;margin:0 auto 10px;background:linear-gradient(135deg,#06B6D4,#8B5CF6);">AK</div>
    <div style="font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:600;">Alex Kim</div>
    <div class="body-sm">🇺🇸 United States</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px;">
    <div class="card tight" style="text-align:center;">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;">42</div>
      <div class="body-sm">items</div>
    </div>
    <div class="card tight" style="text-align:center;">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;">18</div>
      <div class="body-sm">reviews</div>
    </div>
    <div class="card tight" style="text-align:center;">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;">127</div>
      <div class="body-sm">helpful</div>
    </div>
  </div>

  <div class="card" style="padding:4px 16px;">
    <a class="list-row" href="20-settings.html"><span class="lr-icon">⚙</span><span class="lr-title">Settings</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="22-notifications.html"><span class="lr-icon">🔔</span><span class="lr-title">Notifications</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="21-theme-picker.html"><span class="lr-icon">🎨</span><span class="lr-title">Theme</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="23-account.html"><span class="lr-icon">👤</span><span class="lr-title">Account</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="#"><span class="lr-icon">ℹ</span><span class="lr-title">About</span><span class="lr-chevron">›</span></a>
    <a class="list-row danger" href="01-welcome.html"><span class="lr-icon">⎋</span><span class="lr-title">Sign out</span></a>
  </div>
</div>
```

Tab bar: Profile active.

- [ ] **Step 2: View** at `/10-profile.html`
- [ ] **Step 3: Checklist** — gradient avatar, name + country flag, three stat cards, settings list with chevrons routes to each screen, Sign out in red routes to welcome
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 10 profile"`

---

## Task 17: Screen 11 — FAB action sheet (`11-fab-sheet.html`)

**Spec reference:** §6 screen 11. Renders the Home screen behind a modal sheet.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Add item` ; body re-uses the Home content with a scrim and modal sheet overlaid.**

Body — wrap the Home `.screen-content` (copy verbatim from Task 13's `.screen-content`) inside `.screen`, followed by `.fab`, then the tab bar (Home active), then **add** at the end of `.screen` (before the closing `</main>`):

```html
<div class="scrim"></div>
<div class="modal-sheet" style="max-height:48%;">
  <div class="sheet-handle"></div>
  <div class="stack" style="gap:10px;">
    <a class="btn btn-ghost" href="12-scan.html" style="justify-content:flex-start;gap:14px;padding:18px 20px;min-height:64px;font-size:16px;">
      <span style="font-size:24px;">📷</span>
      <div style="text-align:left;flex:1;">
        <div style="font-weight:600;">Scan barcode or QR</div>
        <div class="body-sm" style="font-weight:400;">Point your camera at the package.</div>
      </div>
    </a>
    <a class="btn btn-ghost" href="15-manual-entry.html" style="justify-content:flex-start;gap:14px;padding:18px 20px;min-height:64px;font-size:16px;">
      <span style="font-size:24px;">✎</span>
      <div style="text-align:left;flex:1;">
        <div style="font-weight:600;">Add manually</div>
        <div class="body-sm" style="font-weight:400;">Type product details by hand.</div>
      </div>
    </a>
  </div>
  <div style="margin-top:12px;">
    <a class="btn btn-ghost btn-block" href="07-home.html">Cancel</a>
  </div>
</div>
```

- [ ] **Step 2: View** at `/11-fab-sheet.html`
- [ ] **Step 3: Checklist** — Home content visible but dimmed by scrim, sheet from bottom with two large action buttons + cancel, Scan routes to `/12-scan.html`, Add manually to `/15-manual-entry.html`, Cancel to home
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 11 fab-sheet"`

---

## Task 18: Screen 12 — Scan (`12-scan.html`)

**Spec reference:** §6 screen 12. Full-screen camera mockup with reticle, no tab bar.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Scan` ; body:**

```html
<div class="screen-content no-tabbar" style="padding:0;background:#0F0F14;color:#F5F5F5;height:100%;position:relative;overflow:hidden;">

  <!-- viewfinder backdrop (synthetic) -->
  <div style="position:absolute;inset:0;background:
    radial-gradient(circle at 35% 40%, rgba(255,255,255,0.06) 0%, transparent 50%),
    radial-gradient(circle at 70% 75%, rgba(255,255,255,0.04) 0%, transparent 40%),
    #0F0F14;"></div>

  <!-- reticle -->
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:240px;height:240px;border:3px solid #fff;border-radius:32px;box-shadow:0 0 0 9999px rgba(0,0,0,0.55);">
    <!-- corners -->
    <span style="position:absolute;top:-3px;left:-3px;width:24px;height:24px;border-top:4px solid var(--accent);border-left:4px solid var(--accent);border-top-left-radius:32px;"></span>
    <span style="position:absolute;top:-3px;right:-3px;width:24px;height:24px;border-top:4px solid var(--accent);border-right:4px solid var(--accent);border-top-right-radius:32px;"></span>
    <span style="position:absolute;bottom:-3px;left:-3px;width:24px;height:24px;border-bottom:4px solid var(--accent);border-left:4px solid var(--accent);border-bottom-left-radius:32px;"></span>
    <span style="position:absolute;bottom:-3px;right:-3px;width:24px;height:24px;border-bottom:4px solid var(--accent);border-right:4px solid var(--accent);border-bottom-right-radius:32px;"></span>
    <!-- scanning line -->
    <span style="position:absolute;left:8%;right:8%;top:50%;height:2px;background:linear-gradient(90deg,transparent,#06B6D4,transparent);box-shadow:0 0 12px #06B6D4;"></span>
  </div>

  <!-- top bar -->
  <div style="position:absolute;top:70px;left:0;right:0;padding:0 20px;display:flex;justify-content:space-between;align-items:center;">
    <a href="11-fab-sheet.html" style="color:#fff;font-size:24px;width:40px;height:40px;border-radius:999px;background:rgba(0,0,0,0.4);display:inline-flex;align-items:center;justify-content:center;">×</a>
    <span style="font-size:13px;color:#fff;background:rgba(0,0,0,0.4);padding:8px 14px;border-radius:999px;">Point at a barcode or QR code</span>
    <span style="width:40px;"></span>
  </div>

  <!-- bottom torch -->
  <div style="position:absolute;left:0;right:0;bottom:90px;display:flex;justify-content:center;gap:18px;">
    <button style="width:56px;height:56px;border-radius:999px;background:rgba(255,255,255,0.10);color:#fff;font-size:22px;">🔦</button>
    <a href="13-scan-result.html" style="width:80px;height:80px;border-radius:999px;background:#fff;display:inline-flex;align-items:center;justify-content:center;">
      <span style="width:64px;height:64px;border-radius:999px;background:#fff;border:4px solid #0F0F14;"></span>
    </a>
    <button style="width:56px;height:56px;border-radius:999px;background:rgba(255,255,255,0.10);color:#fff;font-size:18px;">⌨</button>
  </div>

</div>
```

> Note: this screen uses a dark surface independent of the theme variables. That's intentional — the camera viewfinder is always dark.

- [ ] **Step 2: View** at `/12-scan.html`
- [ ] **Step 3: Checklist** — dark background, centered rounded reticle with cyan corner accents and a scanning line, close button (×) routes back to fab-sheet, large shutter button routes to scan-result, torch + keyboard side buttons
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 12 scan"`

---

## Task 19: Screen 13 — Scan result, found (`13-scan-result.html`)

**Spec reference:** §6 screen 13.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Scan result` ; body:**

```html
<div class="screen-content no-tabbar" style="text-align:center;padding-top:90px;">
  <div class="card" style="padding:24px;">
    <div style="font-size:96px;margin-bottom:12px;">🥛</div>
    <h2 class="h2">Whole Milk · 1 gal</h2>
    <div class="body-sm" style="margin-bottom:8px;">Northland Dairy</div>
    <div class="row" style="justify-content:center;gap:8px;margin-bottom:14px;">
      <span class="chip">Dairy</span>
    </div>
    <div class="row" style="justify-content:center;gap:8px;">
      <span class="star-rating">★★★★<span class="star-empty">★</span></span>
      <span class="body-sm">4.2 · 318 reviews</span>
    </div>
  </div>

  <div class="stack" style="margin-top:24px;">
    <a class="btn btn-primary btn-block" href="14-expiry-capture.html">Add to pantry</a>
    <a class="btn-text" href="15-manual-entry.html" style="text-align:center;">Wrong product?</a>
  </div>
</div>
```

- [ ] **Step 2: View** at `/13-scan-result.html`
- [ ] **Step 3: Checklist** — product card with image, name, brand, category chip, star rating, primary CTA routes to expiry capture, text link routes to manual entry
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 13 scan-result"`

---

## Task 20: Screen 14 — Expiry capture (`14-expiry-capture.html`)

**Spec reference:** §6 screen 14. Two-tab top: "Pick a date" (default) and "Scan the date".

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Set expiry` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h2" style="margin-bottom:14px;">When does it expire?</h1>

  <div class="chip-row" style="margin-bottom:18px;">
    <span class="chip active" style="padding:10px 18px;">Pick a date</span>
    <span class="chip" style="padding:10px 18px;">Scan the date</span>
  </div>

  <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px;">
    <div style="background:var(--input-bg);padding:24px;text-align:center;">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:600;color:var(--text-tertiary);">May</div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:64px;font-weight:700;line-height:1;letter-spacing:-0.04em;">28</div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:600;color:var(--text-tertiary);">2026</div>
    </div>

    <div class="row" style="gap:8px;padding:14px;justify-content:center;flex-wrap:wrap;">
      <span class="chip">Today</span>
      <span class="chip">+3d</span>
      <span class="chip active">+1wk</span>
      <span class="chip">+1mo</span>
      <span class="chip">Use shelf-life hint</span>
    </div>
  </div>

  <details class="card" style="padding:14px 18px;">
    <summary style="font-weight:600;cursor:pointer;">Optional details</summary>
    <div class="stack" style="margin-top:14px;">
      <div class="row" style="gap:10px;">
        <div style="flex:1;"><label class="input-label">Quantity</label><input class="input" value="1" /></div>
        <div style="flex:1;"><label class="input-label">Unit</label><input class="input" value="gal" /></div>
      </div>
      <div><label class="input-label">Purchase date</label><input class="input" value="May 21, 2026" /></div>
      <div><label class="input-label">Notes</label><textarea class="input">For oatmeal in the morning.</textarea></div>
    </div>
  </details>

  <a class="btn btn-primary btn-block" href="07-home.html" style="margin-top:18px;">Add to pantry</a>
</div>
```

- [ ] **Step 2: View** at `/14-expiry-capture.html`
- [ ] **Step 3: Checklist** — two top tabs ("Pick a date" active), large date display, quick chip row with "+1wk" active, collapsible "Optional details" reveals quantity/unit/purchase/notes, Add CTA routes back to home
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 14 expiry-capture"`

---

## Task 21: Screen 15 — Manual entry (`15-manual-entry.html`)

**Spec reference:** §6 screen 15.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Add manually` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h2" style="margin-bottom:14px;">Add an item</h1>
  <div class="stack">
    <div><label class="input-label">Name <span style="color:var(--danger);">*</span></label><input class="input" value="Greek Yogurt" /></div>
    <div><label class="input-label">Brand</label><input class="input" value="Greenleaf" /></div>
    <div>
      <label class="input-label">Category</label>
      <div class="chip-row">
        <span class="chip active">Dairy</span>
        <span class="chip">Produce</span>
        <span class="chip">Pantry</span>
        <span class="chip">Beverages</span>
        <span class="chip">Frozen</span>
        <span class="chip">Other</span>
      </div>
    </div>
    <div><label class="input-label">Expiry <span style="color:var(--danger);">*</span></label><input class="input" value="May 28, 2026" /></div>
    <div class="row" style="gap:10px;">
      <div style="flex:1;"><label class="input-label">Quantity</label><input class="input" value="500" /></div>
      <div style="flex:1;"><label class="input-label">Unit</label><input class="input" value="g" /></div>
    </div>
    <div><label class="input-label">Notes</label><textarea class="input">Plain, full-fat.</textarea></div>
    <div>
      <label class="input-label">Photo</label>
      <div class="card" style="padding:24px;text-align:center;border-style:dashed;">
        <div style="font-size:28px;margin-bottom:6px;">📷</div>
        <div class="body-sm">Tap to take or choose a photo</div>
      </div>
    </div>
  </div>
  <a class="btn btn-primary btn-block" href="07-home.html" style="margin-top:18px;">Save</a>
</div>
```

- [ ] **Step 2: View** at `/15-manual-entry.html`
- [ ] **Step 3: Checklist** — required field asterisks in red, category chip row with Dairy active, dashed photo placeholder, Save routes home
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 15 manual-entry"`

---

## Task 22: Screen 16 — Record detail (`16-record-detail.html`)

**Spec reference:** §6 screen 16.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Record` ; body:**

```html
<div class="screen-content no-tabbar">
  <div class="card" style="padding:24px;text-align:center;margin-bottom:18px;">
    <div style="font-size:96px;margin-bottom:8px;">🥛</div>
    <h2 class="h2">Whole Milk · 1 gal</h2>
    <div class="body-sm">Northland Dairy · Dairy</div>
  </div>

  <div class="card" style="margin-bottom:14px;">
    <div class="row-between" style="margin-bottom:6px;">
      <span class="body-sm">Expires</span>
      <button class="btn-text">Edit</button>
    </div>
    <div class="row" style="gap:10px;align-items:baseline;">
      <span style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--urgency-urgent);">Tomorrow</span>
      <span class="body-sm">May 25, 2026</span>
    </div>
  </div>

  <div class="card" style="margin-bottom:18px;">
    <div class="list-row"><span class="lr-icon">⚖</span><span class="lr-title">Quantity</span><span class="muted">1 gal</span></div>
    <div class="list-row"><span class="lr-icon">🛒</span><span class="lr-title">Purchased</span><span class="muted">May 21, 2026</span></div>
    <div class="list-row"><span class="lr-icon">📝</span><span class="lr-title">Notes</span><span class="muted" style="max-width:140px;text-align:right;">For oatmeal.</span></div>
  </div>

  <div class="stack">
    <a class="btn btn-primary btn-block" href="07-home.html">Mark consumed</a>
    <a class="btn btn-ghost btn-block" href="07-home.html">Mark discarded</a>
    <a class="btn btn-danger btn-block" href="07-home.html">Delete</a>
  </div>
</div>
```

- [ ] **Step 2: View** at `/16-record-detail.html`
- [ ] **Step 3: Checklist** — large product header, expiry block with urgency-colored "Tomorrow", quantity/purchase/notes rows, three full-width action buttons including red Delete
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 16 record-detail"`

---

## Task 23: Screen 17 — Product detail (`17-product-detail.html`)

**Spec reference:** §6 screen 17.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Product` ; body:**

```html
<div class="screen-content no-tabbar">
  <div class="card" style="padding:28px 20px;text-align:center;margin-bottom:18px;">
    <div style="font-size:96px;margin-bottom:8px;">🫒</div>
    <h2 class="h2">Extra Virgin Olive Oil</h2>
    <div class="body-sm" style="margin-bottom:10px;">Olive Grove</div>
    <span class="chip" style="background:var(--accent-soft);color:var(--accent);border-color:transparent;">Pantry</span>
    <div class="row" style="justify-content:center;gap:8px;margin-top:14px;">
      <span class="star-rating star-rating-lg">★★★★★</span>
    </div>
    <div class="body-sm" style="margin-top:4px;">4.8 · 642 reviews</div>
  </div>

  <a class="btn btn-primary btn-block" href="18-write-review.html" style="margin-bottom:18px;">Write a review</a>

  <div class="row" style="gap:8px;margin-bottom:14px;">
    <span class="chip active">Most helpful</span>
    <span class="chip">Newest</span>
    <span class="chip">Highest</span>
  </div>

  <div class="stack">
    <div class="card review-card">
      <div class="rc-head">
        <div class="rc-avatar" style="background:linear-gradient(135deg,#F59E0B,#EC4899);">MS</div>
        <div style="flex:1;">
          <div class="rc-name">Maria S. 🇪🇸</div>
          <div class="rc-meta">2 mo ago</div>
        </div>
        <button class="icon-btn" aria-label="Report">⋯</button>
      </div>
      <div class="star-rating" style="margin-bottom:4px;">★★★★★</div>
      <p class="rc-body">Smells like a garden. Worth every cent. We use it for everything — dressing, finishing, even cake.</p>
      <div class="rc-foot">
        <span class="rc-vote">▲ <strong>118</strong></span>
        <span class="rc-vote">▼ <strong>3</strong></span>
      </div>
    </div>

    <div class="card review-card">
      <div class="rc-head">
        <div class="rc-avatar" style="background:linear-gradient(135deg,#06B6D4,#3B82F6);">JT</div>
        <div style="flex:1;">
          <div class="rc-name">James T. 🇺🇸</div>
          <div class="rc-meta">3 wk ago</div>
        </div>
        <button class="icon-btn" aria-label="Report">⋯</button>
      </div>
      <div class="star-rating" style="margin-bottom:4px;">★★★★<span class="star-empty">★</span></div>
      <p class="rc-body">Excellent for cooking. A bit pricey but worth it if you use a lot of oil.</p>
      <div class="rc-foot">
        <span class="rc-vote">▲ <strong>54</strong></span>
        <span class="rc-vote">▼ <strong>2</strong></span>
      </div>
    </div>

    <div class="card review-card">
      <div class="rc-head">
        <div class="rc-avatar" style="background:linear-gradient(135deg,#10B981,#06B6D4);">YK</div>
        <div style="flex:1;">
          <div class="rc-name">Yuki K. 🇯🇵</div>
          <div class="rc-meta">5 mo ago</div>
        </div>
        <button class="icon-btn" aria-label="Report">⋯</button>
      </div>
      <div class="star-rating" style="margin-bottom:4px;">★★★★★</div>
      <p class="rc-body">Tastes peppery and fresh. Have ordered three bottles already.</p>
      <div class="rc-foot">
        <span class="rc-vote">▲ <strong>41</strong></span>
        <span class="rc-vote">▼ <strong>0</strong></span>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: View** at `/17-product-detail.html`
- [ ] **Step 3: Checklist** — hero with image, name, brand, category chip, large star rating, primary Write-review button, sort chips with "Most helpful" active, 3 review cards with avatar/flag/timestamp/votes
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 17 product-detail"`

---

## Task 24: Screen 18 — Write a review modal (`18-write-review.html`)

**Spec reference:** §6 screen 18. Reuses Product Detail behind a modal sheet.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Write a review` ; body:**

Include the Product Detail `.screen-content` (copy from Task 23) followed by:

```html
<div class="scrim"></div>
<div class="modal-sheet" style="max-height:85%;">
  <div class="sheet-handle"></div>
  <div class="sheet-title">Write a review</div>

  <label class="input-label" style="margin-bottom:8px;">Your rating</label>
  <div class="star-rating star-rating-lg" style="margin-bottom:18px;font-size:36px;letter-spacing:2px;">★★★★<span class="star-empty">★</span></div>

  <label class="input-label">Your review</label>
  <textarea class="input" style="min-height:140px;" placeholder="What stood out to you?">Smells like a garden. Worth every cent.</textarea>

  <div class="row" style="gap:10px;margin-top:18px;">
    <a class="btn btn-ghost" href="17-product-detail.html" style="flex:1;">Cancel</a>
    <a class="btn btn-primary" href="17-product-detail.html" style="flex:1;">Submit</a>
  </div>
</div>
```

- [ ] **Step 2: View** at `/18-write-review.html`
- [ ] **Step 3: Checklist** — Product detail behind dimmed scrim, sheet with large star input, textarea, Cancel + Submit row both routing back to product detail
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 18 write-review"`

---

## Task 25: Screen 19 — Report modal (`19-report-modal.html`)

**Spec reference:** §6 screen 19.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Report review` ; body:**

Include the Product Detail `.screen-content` (copy from Task 23) followed by:

```html
<div class="scrim"></div>
<div class="modal-sheet" style="max-height:55%;">
  <div class="sheet-handle"></div>
  <div class="sheet-title">Report this review</div>

  <div class="stack">
    <label class="checkbox" style="padding:14px;border:1px solid var(--card-border);border-radius:var(--pill-radius);">
      <input type="radio" name="reason" />
      <span class="body" style="margin-left:6px;">Spam</span>
    </label>
    <label class="checkbox" style="padding:14px;border:1px solid var(--card-border);border-radius:var(--pill-radius);">
      <input type="radio" name="reason" checked />
      <span class="body" style="margin-left:6px;">Abuse</span>
    </label>
    <label class="checkbox" style="padding:14px;border:1px solid var(--card-border);border-radius:var(--pill-radius);">
      <input type="radio" name="reason" />
      <span class="body" style="margin-left:6px;">Incorrect info</span>
    </label>
    <label class="checkbox" style="padding:14px;border:1px solid var(--card-border);border-radius:var(--pill-radius);">
      <input type="radio" name="reason" />
      <span class="body" style="margin-left:6px;">Other</span>
    </label>
    <textarea class="input" placeholder="Tell us more (shown when 'Other' is selected)…"></textarea>
  </div>

  <div class="row" style="gap:10px;margin-top:18px;">
    <a class="btn btn-ghost" href="17-product-detail.html" style="flex:1;">Cancel</a>
    <a class="btn btn-primary" href="17-product-detail.html" style="flex:1;">Submit</a>
  </div>
</div>
```

- [ ] **Step 2: View** at `/19-report-modal.html`
- [ ] **Step 3: Checklist** — Product detail behind scrim, sheet with 4 radio options (Abuse pre-selected), free-text field, Cancel/Submit
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 19 report-modal"`

---

## Task 26: Screen 20 — Settings index (`20-settings.html`)

**Spec reference:** §6 screen 20.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Settings` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h2" style="margin-bottom:14px;">Settings</h1>

  <div class="section-title">Preferences</div>
  <div class="card" style="padding:4px 16px;margin-bottom:14px;">
    <a class="list-row" href="21-theme-picker.html"><span class="lr-icon">🎨</span><span class="lr-title">Theme</span><span class="muted">Aurora Glass</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="22-notifications.html"><span class="lr-icon">🔔</span><span class="lr-title">Notifications</span><span class="lr-chevron">›</span></a>
    <div class="list-row" style="opacity:0.5;"><span class="lr-icon">🌐</span><span class="lr-title">Language</span><span class="muted">English (coming)</span></div>
  </div>

  <div class="section-title">Account</div>
  <div class="card" style="padding:4px 16px;margin-bottom:14px;">
    <a class="list-row" href="23-account.html"><span class="lr-icon">📧</span><span class="lr-title">Email</span><span class="muted">alex@example.com</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="23-account.html"><span class="lr-icon">🔒</span><span class="lr-title">Password</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="23-account.html"><span class="lr-icon">🔗</span><span class="lr-title">Linked accounts</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="23-account.html"><span class="lr-icon">🌎</span><span class="lr-title">Country</span><span class="muted">United States</span><span class="lr-chevron">›</span></a>
  </div>

  <div class="section-title">Data</div>
  <div class="card" style="padding:4px 16px;margin-bottom:14px;">
    <a class="list-row" href="#"><span class="lr-icon">⤓</span><span class="lr-title">Export my data</span><span class="muted">Coming</span></a>
    <a class="list-row danger" href="#"><span class="lr-icon">⌫</span><span class="lr-title">Delete account</span><span class="lr-chevron">›</span></a>
  </div>

  <div class="section-title">About</div>
  <div class="card" style="padding:4px 16px;margin-bottom:18px;">
    <div class="list-row"><span class="lr-icon">ℹ</span><span class="lr-title">Version</span><span class="muted">1.0.0 (mockup)</span></div>
    <a class="list-row" href="#"><span class="lr-icon">📄</span><span class="lr-title">Terms</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="#"><span class="lr-icon">🔐</span><span class="lr-title">Privacy</span><span class="lr-chevron">›</span></a>
    <a class="list-row" href="#"><span class="lr-icon">📦</span><span class="lr-title">OSS licenses</span><span class="lr-chevron">›</span></a>
  </div>

  <a class="btn-text-danger btn-block" href="01-welcome.html" style="text-align:center;display:block;font-weight:600;">Sign out</a>
</div>
```

- [ ] **Step 2: View** at `/20-settings.html`
- [ ] **Step 3: Checklist** — four section groups (Preferences, Account, Data, About), Language disabled, Delete account in red, Sign out full-width red at the bottom, Theme row routes to theme-picker
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 20 settings"`

---

## Task 27: Screen 21 — Theme picker (`21-theme-picker.html`) — CENTERPIECE

**Spec reference:** §6 screen 21 and §7. This is the only screen with runtime behavior. Add `<script src="_themes.js" defer></script>` inside `<head>`.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Theme` ; include the Settings `.screen-content` (copy from Task 26) followed by:**

```html
<div class="scrim"></div>
<div class="modal-sheet" style="max-height:88%;">
  <div class="sheet-handle"></div>
  <div class="sheet-title">Choose a theme</div>

  <div class="stack-lg" style="margin-bottom:18px;">
    <!-- Each card is a tiny home-screen miniature in its own theme -->
    <div data-theme-card="aurora" class="theme-card is-selected"
         style="border-radius:24px;padding:14px;cursor:pointer;border:3px solid var(--accent);box-shadow:0 0 0 4px var(--accent-ring);
                background:
                  radial-gradient(at 20% 10%, #E0E7FF 0%, transparent 50%),
                  radial-gradient(at 80% 20%, #FED7AA 0%, transparent 45%),
                  radial-gradient(at 50% 90%, #D1FAE5 0%, transparent 55%),
                  #F5F3FF;">
      <div class="row-between" style="margin-bottom:10px;">
        <strong style="font-family:'Space Grotesk',sans-serif;font-size:15px;color:#1A1A2E;">Aurora Glass</strong>
        <span style="font-size:11px;color:rgba(26,26,46,0.6);">Light · Glassmorphism</span>
      </div>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;background:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.45);backdrop-filter:blur(20px);padding:10px;border-radius:16px;color:#1A1A2E;font-size:11px;">🥛 Milk · Today</div>
        <div style="flex:1;background:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.45);backdrop-filter:blur(20px);padding:10px;border-radius:16px;color:#1A1A2E;font-size:11px;">🥖 Bread · 3 days</div>
      </div>
    </div>

    <div data-theme-card="bento" class="theme-card"
         style="border-radius:20px;padding:14px;cursor:pointer;border:3px solid transparent;background:#FAFAFA;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div class="row-between" style="margin-bottom:10px;">
        <strong style="font-family:'Space Grotesk',sans-serif;font-size:15px;color:#111;">Bento Grid</strong>
        <span style="font-size:11px;color:#555;">Light · Modular</span>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;">
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);padding:10px;border-radius:12px;color:#111;font-size:11px;">🥛 Milk · Today</div>
        <div style="background:#4F46E5;color:#fff;padding:10px;border-radius:12px;font-size:11px;display:flex;align-items:center;justify-content:center;">+5</div>
      </div>
    </div>

    <div data-theme-card="clay" class="theme-card"
         style="border-radius:32px;padding:14px;cursor:pointer;border:3px solid transparent;background:#FFE5D9;
                box-shadow:6px 6px 16px rgba(180,130,100,0.25),-4px -4px 14px rgba(255,255,255,0.85);">
      <div class="row-between" style="margin-bottom:10px;">
        <strong style="font-family:'Space Grotesk',sans-serif;font-size:15px;color:#4A2C1F;">Soft Clay</strong>
        <span style="font-size:11px;color:rgba(74,44,31,0.65);">Warm · Neumorphic</span>
      </div>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;background:#FFF1E6;padding:10px;border-radius:20px;color:#4A2C1F;font-size:11px;
                    box-shadow:4px 4px 10px rgba(180,130,100,0.25),-3px -3px 8px rgba(255,255,255,0.85);">🥛 Milk</div>
        <div style="flex:1;background:#FFF1E6;padding:10px;border-radius:20px;color:#4A2C1F;font-size:11px;
                    box-shadow:4px 4px 10px rgba(180,130,100,0.25),-3px -3px 8px rgba(255,255,255,0.85);">🥖 Bread</div>
      </div>
    </div>

    <div data-theme-card="material" class="theme-card"
         style="border-radius:16px;padding:14px;cursor:pointer;border:3px solid transparent;background:#FEF7FF;">
      <div class="row-between" style="margin-bottom:10px;">
        <strong style="font-family:'Space Grotesk',sans-serif;font-size:15px;color:#1D1B20;">Material You</strong>
        <span style="font-size:11px;color:#49454F;">MD3 · Dynamic</span>
      </div>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;background:#EADDFF;padding:10px;border-radius:999px;color:#21005D;font-size:11px;text-align:center;">🥛 Milk · 1d</div>
        <div style="background:#6750A4;color:#fff;padding:10px 16px;border-radius:999px;font-size:11px;">+ Add</div>
      </div>
    </div>
  </div>

  <a class="btn btn-primary btn-block" href="20-settings.html">Save</a>
</div>

<style>
  .theme-card { transition: border-color 200ms, box-shadow 200ms, transform 100ms; }
  .theme-card.is-selected { border-color: var(--accent) !important; box-shadow: 0 0 0 4px var(--accent-ring) !important; }
  .theme-card:not(.is-selected) { border-color: transparent !important; }
  .theme-card:active { transform: scale(0.99); }
</style>
```

Also add `<script src="_themes.js" defer></script>` inside `<head>`.

- [ ] **Step 2: View** at `/21-theme-picker.html`

- [ ] **Step 3: Interaction check**

  - Settings is visible behind a dimmed scrim
  - Four theme cards are visible inside the sheet, each a realistic miniature in its own visual language
  - The Aurora card is selected initially (cyan ring)
  - Click "Bento Grid": the screen behind the sheet cross-fades to bento tokens (white surface, indigo accent on the tab bar/FAB) over 200ms; the Bento card now has the cyan ring
  - Click "Soft Clay": cross-fade to peach surface, chunky shadows on the Settings cards behind
  - Click "Material You": cross-fade to MD3 purple seed
  - Click "Aurora Glass": cross-fade back to gradient mesh + frosted glass
  - "Save" routes back to `/20-settings.html`

- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 21 theme-picker (centerpiece)"`

---

## Task 28: Screen 22 — Notifications settings (`22-notifications.html`)

**Spec reference:** §6 screen 22.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Notifications` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h2" style="margin-bottom:14px;">Notifications</h1>

  <div class="card" style="margin-bottom:18px;">
    <div class="row-between">
      <div>
        <div style="font-weight:600;">Push notifications</div>
        <div class="body-sm">Reminders before items expire.</div>
      </div>
      <span style="display:inline-block;width:48px;height:28px;border-radius:999px;background:var(--accent);position:relative;">
        <span style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:999px;background:#fff;"></span>
      </span>
    </div>
  </div>

  <div class="section-title">Reminder schedule</div>
  <div class="card" style="margin-bottom:18px;">
    <div class="stack">
      <label class="checkbox" style="justify-content:space-between;"><span><span style="margin-right:8px;">⏰</span>7 days before</span><input type="checkbox" checked /></label>
      <label class="checkbox" style="justify-content:space-between;"><span><span style="margin-right:8px;">⏰</span>1 day before</span><input type="checkbox" checked /></label>
      <label class="checkbox" style="justify-content:space-between;"><span><span style="margin-right:8px;">⚠</span>On expiry day</span><input type="checkbox" checked /></label>
    </div>
  </div>

  <div class="section-title">Quiet hours</div>
  <div class="card" style="margin-bottom:18px;">
    <div class="row" style="gap:10px;">
      <div style="flex:1;"><label class="input-label">From</label><input class="input" value="10:00 PM" /></div>
      <div style="flex:1;"><label class="input-label">To</label><input class="input" value="7:00 AM" /></div>
    </div>
  </div>

  <a class="btn btn-ghost btn-block" href="25-push-preview.html">Send a test notification</a>
</div>
```

- [ ] **Step 2: View** at `/22-notifications.html`
- [ ] **Step 3: Checklist** — master toggle (on), three reminder checkboxes, quiet-hours From/To inputs, test button routes to push-preview
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 22 notifications"`

---

## Task 29: Screen 23 — Account (`23-account.html`)

**Spec reference:** §6 screen 23.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Account` ; body:**

```html
<div class="screen-content no-tabbar">
  <h1 class="h2" style="margin-bottom:14px;">Account</h1>

  <div class="card" style="padding:4px 16px;margin-bottom:14px;">
    <div class="list-row"><span class="lr-icon">📧</span><span class="lr-title">Email</span><span class="muted">alex@example.com</span><span class="lr-chevron">›</span></div>
    <div class="list-row"><span class="lr-icon">🔒</span><span class="lr-title">Password</span><span class="muted">Change</span><span class="lr-chevron">›</span></div>
    <div class="list-row"><span class="lr-icon">🌎</span><span class="lr-title">Country</span><span class="muted">United States</span><span class="lr-chevron">›</span></div>
  </div>

  <div class="section-title">Linked accounts</div>
  <div class="card" style="padding:4px 16px;margin-bottom:10px;">
    <div class="list-row"><span class="lr-icon">G</span><span class="lr-title">Google</span><span style="display:inline-block;width:42px;height:24px;border-radius:999px;background:var(--accent);position:relative;"><span style="position:absolute;top:2.5px;right:2.5px;width:19px;height:19px;border-radius:999px;background:#fff;"></span></span></div>
    <div class="list-row"><span class="lr-icon"></span><span class="lr-title">Apple</span><span style="display:inline-block;width:42px;height:24px;border-radius:999px;background:var(--input-border);position:relative;"><span style="position:absolute;top:2.5px;left:2.5px;width:19px;height:19px;border-radius:999px;background:#fff;"></span></span></div>
    <div class="list-row"><span class="lr-icon">🔑</span><span class="lr-title">Passkey</span><span style="display:inline-block;width:42px;height:24px;border-radius:999px;background:var(--input-border);position:relative;"><span style="position:absolute;top:2.5px;left:2.5px;width:19px;height:19px;border-radius:999px;background:#fff;"></span></span></div>
  </div>
  <p class="body-sm" style="margin-bottom:18px;">At least one credential must remain linked.</p>

  <a class="btn btn-danger btn-block" href="01-welcome.html">Delete account</a>
</div>
```

- [ ] **Step 2: View** at `/23-account.html`
- [ ] **Step 3: Checklist** — three account rows, three linked-account toggles (Google on, others off), explanatory caption, Delete account in red
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 23 account"`

---

## Task 30: Screen 24 — Empty home + first-scan tutorial (`24-empty-home.html`)

**Spec reference:** §6 screen 24.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Empty home` ; body — Home shell with no items + tutorial overlay:**

`.screen-content`:

```html
<div class="screen-content">
  <div class="page-header">
    <h1 class="h2">Your pantry</h1>
    <button class="icon-btn" aria-label="Filter">⚙</button>
  </div>

  <div style="text-align:center;padding:80px 20px;">
    <div style="font-size:96px;margin-bottom:14px;opacity:0.7;">🧺</div>
    <h2 class="h3" style="margin-bottom:6px;">Your pantry is empty</h2>
    <p class="body-sm">Tap + to scan your first item.</p>
  </div>
</div>

<a class="fab" href="11-fab-sheet.html" aria-label="Add">+</a>

<nav class="tab-bar">
  <a class="tab active" href="07-home.html"><span class="tab-icon">🏠</span><span>Home</span></a>
  <a class="tab" href="08-browse.html"><span class="tab-icon">🔎</span><span>Browse</span></a>
  <a class="tab" href="09-reviews.html"><span class="tab-icon">★</span><span>Reviews</span></a>
  <a class="tab" href="10-profile.html"><span class="tab-icon">👤</span><span>Profile</span></a>
</nav>

<!-- Tutorial overlay -->
<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:65;pointer-events:none;
            mask:radial-gradient(circle at 50% calc(100% - 130px), transparent 56px, #000 60px);
            -webkit-mask:radial-gradient(circle at 50% calc(100% - 130px), transparent 56px, #000 60px);"></div>

<div style="position:absolute;left:50%;bottom:200px;transform:translateX(-50%);background:#fff;color:#111;padding:14px 18px;border-radius:18px;max-width:240px;text-align:center;z-index:66;box-shadow:0 12px 32px rgba(0,0,0,0.2);">
  <div style="font-weight:600;margin-bottom:4px;">Add your first item</div>
  <div style="font-size:13px;color:#555;">Tap the + button to scan a barcode or add manually.</div>
  <span style="position:absolute;left:50%;bottom:-8px;transform:translateX(-50%) rotate(45deg);width:16px;height:16px;background:#fff;"></span>
</div>
```

- [ ] **Step 2: View** at `/24-empty-home.html`
- [ ] **Step 3: Checklist** — empty-state illustration centered, dimmed overlay with cut-out highlighting the FAB, tooltip pointing at it, tab bar still visible at the bottom
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 24 empty-home"`

---

## Task 31: Screen 25 — Push notification preview (`25-push-preview.html`)

**Spec reference:** §6 screen 25. Lock-screen mockup with wallpaper, clock, two stacked notifications.

- [ ] **Step 1: Write file. `SCREEN_TITLE` = `Lock screen` ; body — uses its own dark surface:**

```html
<div class="screen-content no-tabbar" style="padding:0;height:100%;position:relative;overflow:hidden;background:
  radial-gradient(at 30% 25%, #4338CA 0%, transparent 55%),
  radial-gradient(at 75% 75%, #BE185D 0%, transparent 50%),
  #0F0F23;color:#fff;">

  <!-- Date + time -->
  <div style="text-align:center;padding:90px 20px 0;">
    <div style="font-size:15px;font-weight:500;opacity:0.85;">Sunday, May 24</div>
    <div style="font-family:'Space Grotesk',sans-serif;font-size:84px;font-weight:300;letter-spacing:-0.05em;line-height:1;">9:41</div>
  </div>

  <!-- Notifications -->
  <div style="margin-top:32px;padding:0 14px;display:flex;flex-direction:column;gap:8px;">
    <div style="background:rgba(255,255,255,0.18);backdrop-filter:blur(20px);border-radius:18px;padding:12px 14px;display:flex;gap:10px;border:1px solid rgba(255,255,255,0.10);">
      <div style="width:36px;height:36px;border-radius:10px;background:#06B6D4;display:flex;align-items:center;justify-content:center;font-size:18px;">🥛</div>
      <div style="flex:1;min-width:0;">
        <div class="row-between" style="margin-bottom:2px;">
          <span style="font-size:13px;font-weight:600;">Pantry</span>
          <span style="font-size:11px;opacity:0.7;">now</span>
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:2px;">Milk expires tomorrow</div>
        <div style="font-size:13px;opacity:0.85;">Northland Whole Milk · finish or freeze it today.</div>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.18);backdrop-filter:blur(20px);border-radius:18px;padding:12px 14px;display:flex;gap:10px;border:1px solid rgba(255,255,255,0.10);">
      <div style="width:36px;height:36px;border-radius:10px;background:#EF4444;display:flex;align-items:center;justify-content:center;font-size:18px;">⚠</div>
      <div style="flex:1;min-width:0;">
        <div class="row-between" style="margin-bottom:2px;">
          <span style="font-size:13px;font-weight:600;">Pantry</span>
          <span style="font-size:11px;opacity:0.7;">7m ago</span>
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:2px;">3 items expire today</div>
        <div style="font-size:13px;opacity:0.85;">Yogurt, sourdough, hummus — use them before bed.</div>
      </div>
    </div>
  </div>

  <!-- bottom controls -->
  <div style="position:absolute;bottom:60px;left:0;right:0;display:flex;justify-content:space-between;padding:0 40px;">
    <span style="width:46px;height:46px;border-radius:999px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;">🔦</span>
    <span style="width:46px;height:46px;border-radius:999px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;">📷</span>
  </div>

</div>
```

- [ ] **Step 2: View** at `/25-push-preview.html`
- [ ] **Step 3: Checklist** — dark purple/pink wallpaper gradient, large light clock, two stacked frosted notification cards with realistic copy matching spec, flashlight + camera shortcuts at the bottom
- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 25 push-preview"`

---

## Task 32: Nav hub (`00-nav-hub.html`) — entry point

**Spec reference:** §6 nav hub. Final screen, depends on every other one existing. Uses its own dedicated layout (not the device frame).

- [ ] **Step 1: Write the file (no scaffold; bespoke layout):**

```html
<!doctype html>
<html lang="en" data-theme="aurora">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Pantry Mockup — All Screens</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" />
  <link rel="stylesheet" href="_shared.css" />
  <style>
    body {
      padding: 60px 32px;
      align-items: flex-start;
      background: var(--screen-bg);
      min-height: 100vh;
    }
    .hub-header { max-width: 1200px; margin: 0 auto 36px; }
    .hub-header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 36px; font-weight: 700; letter-spacing: -0.02em; }
    .hub-header p { color: var(--text-secondary); margin-top: 6px; }
    .hub-section { max-width: 1200px; margin: 0 auto 36px; }
    .hub-section h2 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-secondary); margin-bottom: 14px;
    }
    .hub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 20px;
    }
    .hub-tile {
      display: flex; flex-direction: column; align-items: center;
      padding: 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      backdrop-filter: var(--card-blur);
      box-shadow: var(--card-shadow);
      transition: transform 100ms;
    }
    .hub-tile:hover { transform: translateY(-2px); }
    .hub-tile iframe {
      width: 156px; height: 338px;
      border: 0;
      border-radius: 24px;
      background: #000;
      pointer-events: none;
      transform: scale(0.4);
      transform-origin: top left;
      width: 392px; height: 851px;
      margin: 0 0 -510px -118px;
    }
    .hub-tile .frame-wrap {
      width: 156px; height: 338px;
      overflow: hidden;
      border-radius: 24px;
      margin-bottom: 12px;
      background: #000;
      box-shadow: 0 8px 20px rgba(80, 70, 200, 0.10);
    }
    .hub-tile .tile-label { font-size: 13px; font-weight: 600; text-align: center; }
    .hub-tile .tile-num { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }
  </style>
</head>
<body>
  <div class="hub-header">
    <h1>Pantry — Mobile Mockups</h1>
    <p>Every screen of the Pantry App mobile experience. Click a tile to open it full-size.</p>
  </div>

  <div class="hub-section">
    <h2>Onboarding &amp; auth</h2>
    <div class="hub-grid">
      <a class="hub-tile" href="01-welcome.html"><div class="frame-wrap"><iframe src="01-welcome.html" loading="lazy"></iframe></div><div class="tile-label">Welcome</div><div class="tile-num">01</div></a>
      <a class="hub-tile" href="02-sign-up.html"><div class="frame-wrap"><iframe src="02-sign-up.html" loading="lazy"></iframe></div><div class="tile-label">Sign up</div><div class="tile-num">02</div></a>
      <a class="hub-tile" href="03-sign-in.html"><div class="frame-wrap"><iframe src="03-sign-in.html" loading="lazy"></iframe></div><div class="tile-label">Sign in</div><div class="tile-num">03</div></a>
      <a class="hub-tile" href="04-verify-email.html"><div class="frame-wrap"><iframe src="04-verify-email.html" loading="lazy"></iframe></div><div class="tile-label">Verify email</div><div class="tile-num">04</div></a>
      <a class="hub-tile" href="05-forgot-password.html"><div class="frame-wrap"><iframe src="05-forgot-password.html" loading="lazy"></iframe></div><div class="tile-label">Forgot password</div><div class="tile-num">05</div></a>
      <a class="hub-tile" href="06-reset-password.html"><div class="frame-wrap"><iframe src="06-reset-password.html" loading="lazy"></iframe></div><div class="tile-label">Reset password</div><div class="tile-num">06</div></a>
    </div>
  </div>

  <div class="hub-section">
    <h2>Main tabs</h2>
    <div class="hub-grid">
      <a class="hub-tile" href="07-home.html"><div class="frame-wrap"><iframe src="07-home.html" loading="lazy"></iframe></div><div class="tile-label">Home</div><div class="tile-num">07</div></a>
      <a class="hub-tile" href="08-browse.html"><div class="frame-wrap"><iframe src="08-browse.html" loading="lazy"></iframe></div><div class="tile-label">Browse</div><div class="tile-num">08</div></a>
      <a class="hub-tile" href="09-reviews.html"><div class="frame-wrap"><iframe src="09-reviews.html" loading="lazy"></iframe></div><div class="tile-label">Reviews</div><div class="tile-num">09</div></a>
      <a class="hub-tile" href="10-profile.html"><div class="frame-wrap"><iframe src="10-profile.html" loading="lazy"></iframe></div><div class="tile-label">Profile</div><div class="tile-num">10</div></a>
    </div>
  </div>

  <div class="hub-section">
    <h2>Pantry flow</h2>
    <div class="hub-grid">
      <a class="hub-tile" href="11-fab-sheet.html"><div class="frame-wrap"><iframe src="11-fab-sheet.html" loading="lazy"></iframe></div><div class="tile-label">FAB sheet</div><div class="tile-num">11</div></a>
      <a class="hub-tile" href="12-scan.html"><div class="frame-wrap"><iframe src="12-scan.html" loading="lazy"></iframe></div><div class="tile-label">Scan</div><div class="tile-num">12</div></a>
      <a class="hub-tile" href="13-scan-result.html"><div class="frame-wrap"><iframe src="13-scan-result.html" loading="lazy"></iframe></div><div class="tile-label">Scan result</div><div class="tile-num">13</div></a>
      <a class="hub-tile" href="14-expiry-capture.html"><div class="frame-wrap"><iframe src="14-expiry-capture.html" loading="lazy"></iframe></div><div class="tile-label">Set expiry</div><div class="tile-num">14</div></a>
      <a class="hub-tile" href="15-manual-entry.html"><div class="frame-wrap"><iframe src="15-manual-entry.html" loading="lazy"></iframe></div><div class="tile-label">Add manually</div><div class="tile-num">15</div></a>
      <a class="hub-tile" href="16-record-detail.html"><div class="frame-wrap"><iframe src="16-record-detail.html" loading="lazy"></iframe></div><div class="tile-label">Record</div><div class="tile-num">16</div></a>
    </div>
  </div>

  <div class="hub-section">
    <h2>Product &amp; reviews</h2>
    <div class="hub-grid">
      <a class="hub-tile" href="17-product-detail.html"><div class="frame-wrap"><iframe src="17-product-detail.html" loading="lazy"></iframe></div><div class="tile-label">Product detail</div><div class="tile-num">17</div></a>
      <a class="hub-tile" href="18-write-review.html"><div class="frame-wrap"><iframe src="18-write-review.html" loading="lazy"></iframe></div><div class="tile-label">Write review</div><div class="tile-num">18</div></a>
      <a class="hub-tile" href="19-report-modal.html"><div class="frame-wrap"><iframe src="19-report-modal.html" loading="lazy"></iframe></div><div class="tile-label">Report</div><div class="tile-num">19</div></a>
    </div>
  </div>

  <div class="hub-section">
    <h2>Settings</h2>
    <div class="hub-grid">
      <a class="hub-tile" href="20-settings.html"><div class="frame-wrap"><iframe src="20-settings.html" loading="lazy"></iframe></div><div class="tile-label">Settings</div><div class="tile-num">20</div></a>
      <a class="hub-tile" href="21-theme-picker.html"><div class="frame-wrap"><iframe src="21-theme-picker.html" loading="lazy"></iframe></div><div class="tile-label">Theme picker</div><div class="tile-num">21</div></a>
      <a class="hub-tile" href="22-notifications.html"><div class="frame-wrap"><iframe src="22-notifications.html" loading="lazy"></iframe></div><div class="tile-label">Notifications</div><div class="tile-num">22</div></a>
      <a class="hub-tile" href="23-account.html"><div class="frame-wrap"><iframe src="23-account.html" loading="lazy"></iframe></div><div class="tile-label">Account</div><div class="tile-num">23</div></a>
    </div>
  </div>

  <div class="hub-section">
    <h2>Special</h2>
    <div class="hub-grid">
      <a class="hub-tile" href="24-empty-home.html"><div class="frame-wrap"><iframe src="24-empty-home.html" loading="lazy"></iframe></div><div class="tile-label">Empty + tutorial</div><div class="tile-num">24</div></a>
      <a class="hub-tile" href="25-push-preview.html"><div class="frame-wrap"><iframe src="25-push-preview.html" loading="lazy"></iframe></div><div class="tile-label">Push preview</div><div class="tile-num">25</div></a>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: View** at `http://localhost:52271/00-nav-hub.html`

- [ ] **Step 3: Visual checklist**
  - Hub renders with header + 6 sections matching spec §6 groupings
  - Each tile shows a scaled-down preview of the screen (iframe scaled to ~40%)
  - Tile labels and numbers visible below each preview
  - Clicking a tile navigates to the full-size screen
  - On a full-size screen, the `← All screens` link returns here

- [ ] **Step 4: Commit** `git commit --allow-empty -m "chore(mockup): screen 00 nav-hub"`

---

## Task 33: Full prototype walkthrough — acceptance

- [ ] **Step 1: Open nav hub**

Open `http://localhost:52271/00-nav-hub.html`

- [ ] **Step 2: Walk every link**

Click each of the 25 tiles. For each:
- The full-size screen renders inside the device frame
- The `← All screens` link returns to the hub
- In-screen links (CTAs, tabs, list rows) route to the screens listed in this plan's per-task checklists

- [ ] **Step 3: Theme switcher acceptance (spec §11 #3)**

Open `/21-theme-picker.html`. Click each of the four theme cards in turn. Verify:
- Each click cross-fades the chrome (status bar text colour, tab bar background, FAB color via the Settings screen behind the sheet) over ~200ms
- The selected card's cyan ring follows the click
- "Save" returns to `/20-settings.html`

- [ ] **Step 4: Content audit (spec §11 #4)**

Search the content directory:
```bash
grep -RniE "(^|[^a-zA-Z])(Nestlé|Coca-Cola|Pepsi|Kraft|Yoplait|Danone)" .superpowers/brainstorm/68898-1779595911/content/ || echo "no real brand names found"
```
Expected: `no real brand names found`.

- [ ] **Step 5: Verify Aurora glass renders**

Open `/07-home.html`. Confirm:
- Multi-stop radial gradient background visible
- Item cards have visible frosted-glass effect (semi-transparent white with backdrop blur)
- At least one item card per urgency level (urgent/soon/fresh) visible — the left-edge accent bar is the correct color
- FAB visible in cyan above the tab bar

- [ ] **Step 6: Verify push preview copy (spec §11 #6)**

Open `/25-push-preview.html`. Confirm the two notification cards show:
- "Milk expires tomorrow" with brand subhead
- "3 items expire today" enumerating yogurt, sourdough, hummus

- [ ] **Step 7: Final commit**

```bash
git commit --allow-empty -m "chore(mockup): full prototype walkthrough complete"
```

---

## Task 34: Stop the server

- [ ] **Step 1: Find and stop the background HTTP server**

Run:
```bash
pkill -f "python3 -m http.server 52271" && echo "stopped" || echo "no server running"
```

- [ ] **Step 2: Confirm**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:52271/`
Expected: a connection-refused error or non-200 response.

---

## Spec coverage map

| Spec section | Tasks |
|---|---|
| §3 Output and delivery (file map, naming, server) | Task 5 (server), all per-screen tasks |
| §4 Visual language — Aurora Glass | Task 1 (`_shared.css`), Task 3 (`_components.css`), Task 33.5 (verification) |
| §4 Pantry urgency colors | Task 1 (variables), Task 3 (`.pantry-item::before`), Task 13 (Home applies them) |
| §5 Phone frame and chrome | Task 2 (`_frame.css`), scaffold above |
| §6 Onboarding & auth (screens 1–6) | Tasks 6–11 |
| §6 Main app tabs (screens 7–10) | Tasks 13–16 (12 = shared tab-bar snippet) |
| §6 Pantry flow (screens 11–16) | Tasks 17–22 |
| §6 Product & reviews (screens 17–19) | Tasks 23–25 |
| §6 Settings (screens 20–23) | Tasks 26–29 |
| §6 Special (screens 24–25) | Tasks 30–31 |
| §6 Nav hub | Task 32 |
| §7 Theme switcher behavior (centerpiece) | Task 4 (`_themes.js`), Task 27 (Theme Picker screen with the four miniatures), Task 33.3 (acceptance) |
| §8 Architecture and file map | Reflected in foundation tasks 1–4 |
| §9 Content and data (realistic + synthetic) | Per-task content; audit in Task 33.4 |
| §11 Acceptance criteria (1) all 25 render | Task 33.1, 33.2 |
| §11 Acceptance criteria (2) nav bidirectional | Task 33.2 |
| §11 Acceptance criteria (3) theme cross-fade | Task 33.3 |
| §11 Acceptance criteria (4) synthetic content | Task 33.4 |
| §11 Acceptance criteria (5) Aurora visible features | Task 33.5 |
| §11 Acceptance criteria (6) push copy | Task 33.6 |

---

## Execution notes for the implementer

- **All output files are gitignored.** The `.superpowers/` directory is in `.gitignore`. Per-task commits are `--allow-empty` markers tracking plan progress; the prototype binaries themselves never enter git history. This is intentional and matches the spec.
- **No copy-paste of the device frame is needed beyond the scaffold.** Each screen file is ~80–200 lines including the scaffold; per-screen body content is what each task above specifies.
- **The Theme Picker is the only screen requiring `_themes.js`.** Every other screen omits the script tag. Aurora is hardcoded as the initial `data-theme` on `<html>` everywhere.
- **If a step's URL link routes to a screen built in a later task**, the link will 404 until that task lands. This is expected during incremental development — re-verify the link after the target screen exists.
- **Browser:** any Chromium-based browser (Chrome, Edge, Brave, Arc). `backdrop-filter` is required and is supported in all modern Chromium browsers.
