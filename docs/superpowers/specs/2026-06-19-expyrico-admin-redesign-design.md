# Expyrico Admin Full Redesign — Design Spec

**Date:** 2026-06-19
**Context:** Full visual redesign of the Next.js admin dashboard. 22 pages across 8 sections. One-pass delivery.

## Design Concept: "Fresh Market"

Warm, earthy, alive — a clean, modern marketplace stand. Organized, approachable, quietly confident. The admin is where operators watch over product freshness, quality, and safety.

---

## 1. Visual System

### 1.1 Color Tokens

Map to CSS custom properties in `globals.css`. All tokens use HSL for Tailwind v3 compatibility.

```css
:root {
  /* Primary — Fresh Sage */
  --primary: 157 37% 49%;           /* #4BAE8A — logo, headers, active states */
  --primary-dark: 157 33% 38%;      /* #3A8F6F — pressed states, text on light bg */
  --primary-light: 154 54% 89%;     /* #D6F0E6 — soft panels, success highlights */
  --primary-foreground: 0 0% 100%;  /* white text on primary */

  /* Secondary — Warm White */
  --background: 60 11% 97%;         /* #FAFAF8 — main background */
  --card: 0 0% 100%;                /* #FFFFFF — cards, surfaces */

  /* Accent — Honey */
  --accent: 38 86% 55%;             /* #F5A623 — CTAs, badges, highlights */
  --accent-light: 46 88% 88%;       /* #FEEFC3 — expiring soon bg */
  --accent-foreground: 34 7% 17%;   /* #2C2C28 — text on accent */

  /* Neutral scale */
  --neutral-light: 60 6% 93%;       /* #F0F0ED — section backgrounds, dividers */
  --neutral-mid: 65 3% 55%;         /* #8C8C85 — secondary text, icons */
  --neutral-dark: 60 4% 16%;        /* #2C2C28 — primary text */

  /* Status (reserved, never branding) */
  --good: 157 37% 49%;              /* #4BAE8A — reuses primary */
  --expiring-soon: 38 86% 55%;      /* #F5A623 — reuses accent */
  --expired: 7 72% 52%;             /* #E0442A — status only */

  /* Borders & radius */
  --border: 60 6% 88%;              /* slightly darker neutral-light */
  --radius: 0.625rem;               /* 10px — softer than default */
  --radius-sm: 0.375rem;
  --radius-lg: 0.875rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(44,44,40,0.04);
  --shadow-card: 0 1px 3px rgba(44,44,40,0.06), 0 1px 2px rgba(44,44,40,0.04);
  --shadow-dropdown: 0 4px 12px rgba(44,44,40,0.08);
}
```

**No dark mode** — the Warm White + Sage palette does not need a dark variant. The palette is already dark-friendly for the few dark elements (neutral-dark text).

### 1.2 Typography

| Role | Family | Weight | Size | Usage |
|------|--------|--------|------|-------|
| Display | Outfit | 600 | 28px/1.3 | Page titles (`h1`) |
| Heading | Outfit | 600 | 18px/1.4 | Section headers, KPI labels |
| Body | Inter | 400 | 14px/1.5 | Tables, forms, nav, paragraphs |
| Body-Small | Inter | 400 | 12px/1.4 | Captions, timestamps, meta |
| Body-Strong | Inter | 600 | 14px/1.5 | Table headers, nav labels |
| Mono | JetBrains Mono | 400 | 13px/1.5 | IDs, codes, data values |
| KPI-Value | Outfit | 700 | 32px/1.2 | KPI card numbers |

Google Fonts import: `Outfit:wght@500;600;700`, `Inter:wght@400;500;600`, `JetBrains+Mono:wght@400`

### 1.3 Spacing Scale

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
```

Page content padding: `px-4 sm:px-6 lg:px-8`, vertical rhythm: `space-y-6` between sections.

### 1.4 Radius & Borders

- Cards: `rounded-lg` (14px)
- Buttons, inputs: `rounded-md` (10px)
- Badges: `rounded-full`
- Tables: no outer radius, `border-b` rows
- Sidebar items: `rounded-md`

---

## 2. Layout Architecture

### 2.1 Desktop (≥1024px)

```
┌──────────────────────────────────────────┐
│ HEADER  h-14  sticky top  z-30           │
│  [Logo Sage] Expyrico Admin    [email] │
├──────────┬───────────────────────────────┤
│ SIDEBAR  │ MAIN                          │
│ 240px    │ flex-1  max-w-[1400px]        │
│ fixed    │ px-6 lg:px-8  py-6            │
│ overflow │                               │
│ -y-auto  │                               │
├──────────┴───────────────────────────────┤
└──────────────────────────────────────────┘
```

### 2.2 Mobile (<1024px)

```
┌─────────────────────────┐
│ HEADER                  │
│ [☰] Expyrico Admin  [○]│
├─────────────────────────┤
│ MAIN                    │
│ px-4  py-4              │
│ (sidebar hidden,        │
│  triggered by ☰)        │
├─────────────────────────┤
│ SIDEBAR (overlay)       │
│ slides in from left     │
│ backdrop blur           │
└─────────────────────────┘
```

**Sidebar drawer:** Uses shadcn Sheet component. Triggered by hamburger icon in header. 280px wide, slides from left, backdrop with `bg-black/20 backdrop-blur-sm`.

### 2.3 Header

- `sticky top-0 z-30`, height `h-14`
- Background: white card with `border-b`
- Left: hamburger button (mobile-only, hidden on `lg`), logo mark (32px Sage square with "E" or leaf icon), "Expyrico Admin" in Outfit 600 16px
- Right: user email in Inter 13px muted + avatar circle (32px, Sage bg with white initials)

### 2.4 Sidebar

- `w-60` (240px), `border-r`, `bg-card`, `overflow-y-auto`
- Top: padding for header clearance
- Nav sections with `px-3 py-2`
- Section title: Inter 600 11px uppercase tracking-wide, neutral-mid, `px-2 pb-1`
- Nav item: `px-3 py-2 rounded-md text-sm`, Inter 400, neutral-dark
- Active state: `bg-primary-light text-primary-dark font-semibold` + left border accent `border-l-2 border-primary`
- Hover: `bg-neutral-light`
- Icons: Lucide icons 18px next to each label, colored neutral-mid (primary on active)
- Collapsible on mobile via Sheet

### 2.5 Main Content Area

- `flex-1`, `overflow-auto`
- `px-4 sm:px-6 lg:px-8 py-6`
- Page title: Outfit 600 28px, neutral-dark, `mb-6`
- Section spacing: `space-y-6` between content blocks

---

## 3. Core Components

### 3.1 KPI Card (`kpi-card.tsx`)

```
┌─────────────────────┐
│  📦  Total Users    │  ← icon + label
│     12,847          │  ← Outfit 700 32px
│     ▲ +12% this mo  │  ← trend line (optional)
└─────────────────────┘
```

- `rounded-lg border bg-card shadow-sm p-5`
- Icon: 20px Lucide icon in primary color, top-left
- Label: Inter 400 13px neutral-mid, below icon
- Value: Outfit 700 32px neutral-dark, `mt-2`
- Trend (optional): Inter 400 12px, green/red, `mt-1`
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`

### 3.2 Data Table (`data-table.tsx`)

```
┌──────────────────────────────────────────┐
│ Header │ Header  │ Header    │ Header    │ ← sticky top, Inter 600 12px, neutral-mid, bg-neutral-light
├────────┼─────────┼───────────┼───────────┤
│ Row    │         │           │           │ ← Inter 400 14px, border-b
├────────┼─────────┼───────────┼───────────┤
│ Row    │         │           │           │ ← even rows: bg-neutral-light/30
├────────┼─────────┼───────────┼───────────┤
│ Row    │         │           │           │ ← hover: bg-primary-light/30
└──────────────────────────────────────────┘
```

- Sticky header row
- Striped: `even:bg-neutral-light/30`
- Hover: `hover:bg-primary-light/20`
- Mobile: wrapper `overflow-x-auto -mx-4 sm:mx-0` with `min-w-[640px]`
- Empty state: centered Inter 400 14px neutral-mid with icon

### 3.3 Filter Bar (`filter-bar.tsx`)

**Desktop:**
```
[Search input......... ] [Status ▼] [Role ▼] [Apply] [Clear]
```

**Mobile:** Collapsed into expandable row
```
[Filters (2 active) ▼]
↓ expanded:
[Search..........]
[Status ▼]
[Role ▼]
[Apply] [Clear]
```

- Wrapper: `flex flex-wrap items-end gap-3`
- Inputs/selects: `h-9 rounded-md border bg-background px-3 text-sm`
- Active filter count badge on collapse toggle

### 3.4 Status Badge (`status-badge.tsx`)

| Variant | BG | Text | Border |
|---------|-----|------|--------|
| Good/Active | `bg-primary-light` | `text-primary-dark` | none |
| Expiring Soon/Warning | `bg-accent-light` | `text-accent-foreground` | `border border-accent/30` |
| Expired/Danger/Suspended | `bg-red-50` | `text-[#E0442A]` | none |
| Neutral/Default | `bg-neutral-light` | `text-neutral-dark` | none |

- `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`
- Dot indicator before text (6px circle in matching color)

### 3.5 Buttons

Adjust existing CVA `buttonVariants` in `ui/button.tsx` — keep the structure, recolor to palette:

| Variant | BG | Text | Border | Hover |
|---------|-----|------|--------|-------|
| `default` | `bg-primary` | `white` | none | `bg-primary-dark` |
| `outline` | transparent | `neutral-dark` | `border` | `bg-neutral-light` |
| `ghost` | transparent | `neutral-mid` | none | `bg-neutral-light` |
| `destructive` | transparent | `text-[#E0442A]` | none | `bg-red-50` |

Sizes: unchanged (`sm` h-9 px-3, `default` h-10 px-4 py-2, `lg` h-11 px-8)

### 3.6 Forms

- Label: Inter 500 13px neutral-dark, `mb-1.5`
- Input: `h-9 rounded-md border bg-background px-3 text-sm`, focus: `ring-2 ring-primary/30 border-primary`
- Helper text: Inter 400 12px neutral-mid, `mt-1`
- Error: Input border turns `#E0442A`, error text below in `#E0442A` 12px
- Section groups separated by `space-y-5`
- Form actions (Save/Cancel) right-aligned at bottom

### 3.7 Load More

Current `<LoadMore>` link → styled button: `w-full text-center py-3 text-sm text-neutral-mid hover:text-primary border-t border-dashed`

---

## 4. Page-Level Patterns

Every page follows the same structure:

```
<div className="space-y-6">
  <h1>Page Title</h1>           ← Outfit 600 28px
  <FilterBar ... />             ← if page has filters
  <DataTable ... />             ← or page-specific content
  <LoadMore ... />              ← if paginated
</div>
```

### 4.1 Dashboard (/) — Priority Page

- Welcome row: "Good morning, [name]" + date
- KPI grid: 6 cards in responsive grid
- Below KPIs: 2-column layout on desktop
  - Left: Recent users table (last 10)
  - Right: Recent reviews feed (last 10)
- Mobile: stacks vertically

### 4.2 Settings Pages

- Settings use a sub-layout: tabs or side nav within the page for Feature Flags / Notification Templates / Moderation / Admins
- Form sections grouped in cards with section headers

### 4.3 Detail Pages (User detail, Product detail, etc.)

- Back button: `← Back to [list]` link at top
- Info card: key fields in a definition list grid
- Actions: contextual buttons in a top-right action bar or inside the info card

---

## 5. Icon System

Use Lucide icons exclusively (already installed). Map:

| Context | Icon |
|---------|------|
| Dashboard | `LayoutDashboard` |
| Products | `Package` |
| Users | `Users` |
| Reviews | `MessageSquare` |
| Reports | `Flag` |
| Deals | `Tags` |
| Analytics | `BarChart3` |
| Households | `Home` |
| System/Queue | `Server` |
| Push logs | `Smartphone` |
| API errors | `AlertTriangle` |
| External APIs | `Webhook` |
| Settings | `Settings` |
| Feature flags | `ToggleRight` |
| Notifications | `Bell` |
| Moderation | `Shield` |
| Admins | `ShieldCheck` |
| Referrals | `Share2` |
| Giveaways | `Gift` |
| Pending edits | `Clock` |

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Base | <640px | Single column, sidebar overlay, stacked filters, table horizontal scroll |
| `sm` | ≥640px | KPI grid 2-col, filters inline |
| `md` | ≥768px | Table full width, form groups 2-col |
| `lg` | ≥1024px | Sidebar visible, KPI grid 3-col, layout columns side-by-side |
| `xl` | ≥1280px | KPI grid 4-col, wider content |
| `2xl` | ≥1536px | `max-w-[1400px]` content cap |

---

## 7. Implementation Order

1. **Step 1: Tokens + globals** — `globals.css` color system, typography, base resets
2. **Step 2: Tailwind config** — extend theme with all new color tokens
3. **Step 3: Shell** — Root layout, admin layout, header, sidebar (with mobile Sheet), nav icons
4. **Step 4: Core components** — KPI card, DataTable, StatusBadge, FilterBar, Button variants, form inputs
5. **Step 5: Pages** — All 22 pages updated with new spacing, typography, and components
6. **Step 6: Mobile pass** — Verify every page at 375px and 768px widths

---

## 8. Files Modified

- `apps/admin/src/app/globals.css` — full rewrite
- `apps/admin/tailwind.config.ts` — extend colors
- `apps/admin/src/app/layout.tsx` — Google Fonts import
- `apps/admin/src/app/(admin)/layout.tsx` — shell rewrite
- `apps/admin/src/components/header.tsx` — full rewrite
- `apps/admin/src/components/sidebar.tsx` — full rewrite with icons, active states, mobile
- `apps/admin/src/components/kpi-card.tsx` — redesign
- `apps/admin/src/components/data-table.tsx` — redesign
- `apps/admin/src/components/status-badge.tsx` — contextual variants
- `apps/admin/src/components/filter-bar.tsx` — responsive collapse
- `apps/admin/src/lib/nav.ts` — add icon names
- ~22 page files — typography + spacing consistency pass
- New: `apps/admin/src/components/sidebar-drawer.tsx` — mobile Sheet wrapper
- Existing `apps/admin/src/components/ui/input.tsx` — already present; adjust styling to match new tokens
- Existing `apps/admin/src/components/ui/button.tsx` — recolor variants per palette, keep CVA structure
- Existing `apps/admin/src/components/ui/badge.tsx` — add contextual badge variants (good, expiring, expired, neutral)
- Existing `apps/admin/src/components/ui/table.tsx` — minor restyle (sticky headers, striped rows)
