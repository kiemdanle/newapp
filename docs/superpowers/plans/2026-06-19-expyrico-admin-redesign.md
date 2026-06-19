# Expyrico Admin Full Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full visual redesign of the Expyrico Next.js admin dashboard — 22 pages, 8 nav sections, fully mobile-responsive, using the Expyrico brand palette.

**Architecture:** Token-driven CSS → Tailwind config → shell (layout/header/sidebar) → core components → page pass → mobile verification. Each layer builds on the previous. Pages are a consistency pass — typography + spacing only — since they already consume shared components.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 3, shadcn/ui (CVA), Lucide React, @tanstack/react-table

**Spec:** `docs/superpowers/specs/2026-06-19-expyrico-admin-redesign-design.md`

## Global Constraints

- Color: Expyrico palette — Primary Sage #4BAE8A, Primary Dark #3A8F6F, Primary Light #D6F0E6, Accent Honey #F5A623, Accent Light #FEEFC3, Background Warm White #FAFAF8, Neutrals #F0F0ED / #8C8C85 / #2C2C28
- Typography: Outfit (display/headings), Inter (body), JetBrains Mono (data)
- No dark mode — the palette is intentionally warm and light
- Sidebar: fixed 240px desktop, Sheet overlay on mobile (<1024px)
- Mobile first: tables overflow-x-auto, filters collapse, KPI grids responsive
- All existing business logic and API contracts unchanged
- Cookie names, API paths, component interfaces preserved
- shadcn/ui CVA pattern kept for button/badge — recolor only, don't restructure

---

## Phase 1: Visual Foundation

### Task 1.1: Rewrite globals.css with Expyrico token system

**Files:**
- Modify: `apps/admin/src/app/globals.css`

**Interfaces:**
- Produces: CSS custom properties consumed by `tailwind.config.ts` and every component

- [ ] **Step 1: Replace globals.css**

Replace the entire file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Primary — Fresh Sage */
    --primary: 157 37% 49%;
    --primary-dark: 157 33% 38%;
    --primary-light: 154 54% 89%;
    --primary-foreground: 0 0% 100%;

    /* Secondary — Warm White */
    --background: 60 11% 97%;
    --card: 0 0% 100%;
    --card-foreground: 60 4% 16%;

    /* Accent — Honey */
    --accent: 38 86% 55%;
    --accent-light: 46 88% 88%;
    --accent-foreground: 34 7% 17%;

    /* Neutral scale */
    --neutral-light: 60 6% 93%;
    --neutral-mid: 65 3% 55%;
    --neutral-dark: 60 4% 16%;

    /* Status */
    --good: 157 37% 49%;
    --expiring-soon: 38 86% 55%;
    --expired: 7 72% 52%;

    /* Muted (maps to neutral-light for shadcn compat) */
    --muted: 60 6% 93%;
    --muted-foreground: 65 3% 55%;

    /* Borders & radius */
    --border: 60 6% 88%;
    --radius: 0.625rem;
    --radius-sm: 0.375rem;
    --radius-lg: 0.875rem;

    /* Destructive (maps to expired red for shadcn compat) */
    --destructive: 7 72% 52%;
    --destructive-foreground: 0 0% 100%;

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(44,44,40,0.04);
    --shadow-card: 0 1px 3px rgba(44,44,40,0.06), 0 1px 2px rgba(44,44,40,0.04);
    --shadow-dropdown: 0 4px 12px rgba(44,44,40,0.08);
  }

  * {
    border-color: hsl(var(--border));
  }

  body {
    background: hsl(var(--background));
    color: hsl(var(--neutral-dark));
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Outfit', system-ui, sans-serif;
  }

  code, pre, .font-mono {
    font-family: 'JetBrains Mono', monospace;
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

Expected: Build succeeds (or fails only on pre-existing issues, not CSS)

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/globals.css
git commit -m "feat: replace globals.css with Expyrico token system"
```

---

### Task 1.2: Extend Tailwind config with Expyrico colors

**Files:**
- Modify: `apps/admin/tailwind.config.ts`

**Interfaces:**
- Consumes: CSS custom properties from `globals.css`
- Produces: Tailwind utility classes (`bg-primary`, `text-neutral-dark`, `border-accent`, etc.)

- [ ] **Step 1: Update tailwind.config.ts**

Replace the colors and borderRadius blocks:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--neutral-dark))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          dark: 'hsl(var(--primary-dark))',
          light: 'hsl(var(--primary-light))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          light: 'hsl(var(--accent-light))',
        },
        neutral: {
          light: 'hsl(var(--neutral-light))',
          mid: 'hsl(var(--neutral-mid))',
          dark: 'hsl(var(--neutral-dark))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        good: 'hsl(var(--good))',
        'expiring-soon': 'hsl(var(--expiring-soon))',
        expired: 'hsl(var(--expired))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/tailwind.config.ts
git commit -m "feat: extend Tailwind config with Expyrico color palette"
```

---

### Task 1.3: Add Google Fonts to root layout

**Files:**
- Modify: `apps/admin/src/app/layout.tsx`

**Interfaces:**
- Produces: Outfit, Inter, JetBrains Mono available globally

- [ ] **Step 1: Add font link tags to <head>**

Replace `apps/admin/src/app/layout.tsx`:

```tsx
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Expyrico Admin',
  description: 'Expyrico administration dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&family=Outfit:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/layout.tsx
git commit -m "feat: add Google Fonts (Outfit, Inter, JetBrains Mono) to root layout"
```

---

## Phase 2: Shell (Layout, Header, Sidebar)

### Task 2.1: Redesign Header component

**Files:**
- Modify: `apps/admin/src/components/header.tsx`

**Interfaces:**
- Consumes: `email` prop (string) — unchanged from current
- Produces: Sticky header with hamburger (mobile), logo, branding, user avatar

- [ ] **Step 1: Add a Sheet Import for mobile sidebar trigger**

Since the sidebar drawer needs a Sheet trigger in the header, we add a context-based approach. For now, the header exposes a `menuTrigger` slot. Create the new header:

```tsx
// apps/admin/src/components/header.tsx
import type { ReactNode } from 'react';

export function Header({
  email,
  menuTrigger,
}: {
  email: string;
  menuTrigger?: ReactNode;
}) {
  const initials = email
    .split('@')[0]!
    .split(/[.\-_]/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — visible only on mobile (<lg) */}
        <div className="lg:hidden">{menuTrigger}</div>

        {/* Logo mark — 32px Sage square */}
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground font-display">
          E
        </div>

        {/* Branding */}
        <span className="text-base font-semibold text-neutral-dark font-display">
          Expyrico Admin
        </span>
      </div>

      {/* User */}
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-neutral-mid sm:inline">
          {email}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

Note: Build may fail until `(admin)/layout.tsx` is updated in Task 2.3. Accept if the error is about `menuTrigger` prop.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/header.tsx
git commit -m "feat: redesign header with logo mark, avatar, mobile hamburger slot"
```

---

### Task 2.2: Redesign Sidebar with icons and active states

**Files:**
- Modify: `apps/admin/src/components/sidebar.tsx`
- Modify: `apps/admin/src/lib/nav.ts`

**Interfaces:**
- Consumes: None (reads NAV from `@/lib/nav`)
- Produces: Sidebar nav with Lucide icons, active state highlighting

- [ ] **Step 1: Update nav.ts to include icon names**

Replace `apps/admin/src/lib/nav.ts`:

```ts
// apps/admin/src/lib/nav.ts
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/', icon: 'LayoutDashboard' }],
  },
  {
    title: 'Moderation',
    items: [
      { label: 'Reports', href: '/reports', icon: 'Flag' },
      { label: 'Reviews', href: '/reviews', icon: 'MessageSquare' },
      { label: 'Deals', href: '/deals', icon: 'Tags' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Products', href: '/products', icon: 'Package' },
      { label: 'Pending edits', href: '/products/pending', icon: 'Clock' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Users', href: '/users', icon: 'Users' },
      { label: 'Referrals', href: '/referrals', icon: 'Share2' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Overview', href: '/analytics/overview', icon: 'BarChart3' },
      { label: 'Scans', href: '/analytics/scans', icon: 'Smartphone' },
      { label: 'Reviews', href: '/analytics/reviews', icon: 'MessageSquare' },
      { label: 'Geography', href: '/analytics/geography', icon: 'Map' },
    ],
  },
  {
    title: 'Households',
    items: [{ label: 'Households', href: '/households', icon: 'Home' }],
  },
  {
    title: 'System',
    items: [
      { label: 'Queue', href: '/system/queue', icon: 'Server' },
      { label: 'Push logs', href: '/system/push', icon: 'Smartphone' },
      { label: 'API errors', href: '/system/api-errors', icon: 'AlertTriangle' },
      { label: 'External APIs', href: '/system/external-apis', icon: 'Webhook' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Feature flags', href: '/settings/feature-flags', icon: 'ToggleRight' },
      { label: 'Notification templates', href: '/settings/notification-templates', icon: 'Bell' },
      { label: 'Moderation', href: '/settings/moderation', icon: 'Shield' },
      { label: 'Admins', href: '/settings/admins', icon: 'ShieldCheck' },
    ],
  },
];
```

- [ ] **Step 2: Rewrite sidebar.tsx** with icons and active state detection

```tsx
// apps/admin/src/components/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import {
  LayoutDashboard,
  Package,
  Users,
  MessageSquare,
  Flag,
  Tags,
  BarChart3,
  Home,
  Server,
  Smartphone,
  AlertTriangle,
  Webhook,
  Settings,
  ToggleRight,
  Bell,
  Shield,
  ShieldCheck,
  Share2,
  Clock,
  Map,
  Gift,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Users,
  MessageSquare,
  Flag,
  Tags,
  BarChart3,
  Home,
  Server,
  Smartphone,
  AlertTriangle,
  Webhook,
  Settings,
  ToggleRight,
  Bell,
  Shield,
  ShieldCheck,
  Share2,
  Clock,
  Map,
  Gift,
};

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-60 shrink-0 border-r bg-card overflow-y-auto">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {NAV.map((section) => (
          <div key={section.title} className="mb-3">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = ICON_MAP[item.icon];
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-primary-light text-primary-dark font-semibold border-l-2 border-primary'
                      : 'text-neutral-dark hover:bg-neutral-light'
                  }`}
                >
                  {Icon && (
                    <Icon
                      size={18}
                      className={active ? 'text-primary' : 'text-neutral-mid'}
                    />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Verify build compiles**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/sidebar.tsx apps/admin/src/lib/nav.ts
git commit -m "feat: redesign sidebar with Lucide icons and active state highlighting"
```

---

### Task 2.3: Rewrite admin layout with responsive shell

**Files:**
- Modify: `apps/admin/src/app/(admin)/layout.tsx`
- Create: `apps/admin/src/components/sidebar-drawer.tsx`

**Interfaces:**
- Consumes: `requireAdminSession()` from `@/lib/session`
- Produces: Full admin shell — header, sidebar, mobile drawer, main content area

- [ ] **Step 1: Create the mobile sidebar drawer component**

Create `apps/admin/src/components/sidebar-drawer.tsx`:

```tsx
// apps/admin/src/components/sidebar-drawer.tsx
'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';

export function SidebarDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-neutral-light transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} className="text-neutral-dark" />
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-card shadow-dropdown transform transition-transform duration-200 ease-in-out lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b">
          <span className="text-sm font-semibold text-neutral-dark font-display">
            Expyrico Admin
          </span>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-neutral-light"
            aria-label="Close menu"
          >
            <X size={18} className="text-neutral-mid" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-3.5rem)]">
          <div onClick={() => setOpen(false)}>
            <Sidebar />
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Rewrite admin layout.tsx**

Replace `apps/admin/src/app/(admin)/layout.tsx`:

```tsx
// apps/admin/src/app/(admin)/layout.tsx
import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { SidebarDrawer } from '@/components/sidebar-drawer';
import { requireAdminSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireAdminSession();
  return (
    <div className="flex min-h-screen flex-col">
      <Header email={me.email} menuTrigger={<SidebarDrawer />} />
      <div className="flex flex-1">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        {/* Main content */}
        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/\(admin\)/layout.tsx apps/admin/src/components/sidebar-drawer.tsx
git commit -m "feat: responsive admin shell with mobile sidebar drawer"
```

---

## Phase 3: Core Components

### Task 3.1: Recolor button variants for Expyrico palette

**Files:**
- Modify: `apps/admin/src/components/ui/button.tsx`

**Interfaces:**
- Produces: Updated CVA variants using Expyrico colors (consumed everywhere via `Button`)

- [ ] **Step 1: Update buttonVariants colors**

In `apps/admin/src/components/ui/button.tsx`, replace the `variants` block:

```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-dark',
        destructive: 'text-expired hover:bg-red-50',
        outline: 'border bg-background text-neutral-dark hover:bg-neutral-light',
        ghost: 'text-neutral-mid hover:bg-neutral-light hover:text-neutral-dark',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
```

Leave everything else (Slot, ButtonProps, forwardRef) unchanged.

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ui/button.tsx
git commit -m "feat: recolor button variants to Expyrico palette"
```

---

### Task 3.2: Add contextual badge variants

**Files:**
- Modify: `apps/admin/src/components/ui/badge.tsx`

**Interfaces:**
- Produces: New badge variants `good`, `expiring`, `expired`, `neutral` on top of existing shadcn variants

- [ ] **Step 1: Add new badgeVariants**

Replace `badgeVariants` in `apps/admin/src/components/ui/badge.tsx`:

```tsx
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-neutral-light text-neutral-dark',
        destructive: 'border-transparent bg-red-50 text-expired',
        outline: 'text-neutral-dark border-neutral-light',
        good: 'border-transparent bg-primary-light text-primary-dark',
        expiring: 'border border-accent/30 bg-accent-light text-accent-foreground',
        expired: 'border-transparent bg-red-50 text-expired',
        neutral: 'border-transparent bg-neutral-light text-neutral-dark',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
```

Leave the `Badge` component and `BadgeProps` unchanged.

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ui/badge.tsx
git commit -m "feat: add contextual badge variants (good, expiring, expired, neutral)"
```

---

### Task 3.3: Update StatusBadge to use contextual variants with dot indicator

**Files:**
- Modify: `apps/admin/src/components/status-badge.tsx`

**Interfaces:**
- Consumes: Badge variants from `ui/badge.tsx`
- Produces: StatusBadge with context-aware color mapping + dot indicator

- [ ] **Step 1: Rewrite status-badge.tsx**

```tsx
import { Badge } from '@/components/ui/badge';

const VARIANTS: Record<string, 'good' | 'expiring' | 'expired' | 'neutral'> = {
  active: 'good',
  visible: 'good',
  sent: 'good',
  approved: 'good',
  closed: 'good',
  pending: 'expiring',
  hidden: 'neutral',
  open: 'expiring',
  halfOpen: 'expiring',
  suspended: 'expired',
  deleted: 'expired',
  failed: 'expired',
  rejected: 'expired',
  resolved: 'neutral',
  dismissed: 'neutral',
  merged_into: 'neutral',
};

const DOT_COLORS: Record<string, string> = {
  good: 'bg-primary',
  expiring: 'bg-accent',
  expired: 'bg-expired',
  neutral: 'bg-neutral-mid',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = VARIANTS[status] ?? 'neutral';
  return (
    <Badge variant={variant} className="gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_COLORS[variant]}`} />
      {status}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/status-badge.tsx
git commit -m "feat: contextual status badges with dot indicators"
```

---

### Task 3.4: Redesign DataTable with striped rows and sticky header

**Files:**
- Modify: `apps/admin/src/components/data-table.tsx`
- Modify: `apps/admin/src/components/ui/table.tsx`

**Interfaces:**
- Produces: Updated table styles — sticky header, striped rows, empty state with icon

- [ ] **Step 1: Update ui/table.tsx for sticky headers and striped rows**

Replace the TableRow and TableHead:

```tsx
export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-primary-light/20 even:bg-neutral-light/30',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-3 text-left align-middle text-xs font-semibold text-neutral-mid bg-neutral-light sticky top-0',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';
```

Leave Table, TableHeader, TableBody, TableCell unchanged.

- [ ] **Step 2: Update data-table.tsx empty state**

Replace the empty state in the `DataTable` component (line 23):

```tsx
if (data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-sm text-neutral-mid">
      <span className="mb-2 text-neutral-mid/50">
        {/* empty icon — inline SVG */}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </span>
      {empty}
    </div>
  );
}
```

- [ ] **Step 3: Add mobile scroll wrapper to DataTable Table wrapper**

The `Table` component already has `overflow-x-auto` — ensure it has `-mx-4 sm:mx-0` for mobile bleed. Update Table:

```tsx
export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto -mx-4 sm:mx-0">
    <table ref={ref} className={cn('w-full caption-bottom text-sm min-w-[640px]', className)} {...props} />
  </div>
));
Table.displayName = 'Table';
```

- [ ] **Step 4: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/data-table.tsx apps/admin/src/components/ui/table.tsx
git commit -m "feat: striped rows, sticky headers, mobile scroll for DataTable"
```

---

### Task 3.5: Redesign KPI Card with icon and trend support

**Files:**
- Modify: `apps/admin/src/components/kpi-card.tsx`

**Interfaces:**
- Consumes: `label`, `value`, optional `icon`, `trend`, `trendUp`
- Produces: Styled KPI card

- [ ] **Step 1: Rewrite kpi-card.tsx**

```tsx
import type { LucideIcon } from 'lucide-react';

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] text-neutral-mid font-body">{label}</div>
          <div className="mt-2 text-[32px] font-bold text-neutral-dark font-display leading-tight">
            {value}
          </div>
          {trend && (
            <div
              className={`mt-1 text-xs font-body ${
                trendUp === undefined ? 'text-neutral-mid' : trendUp ? 'text-primary' : 'text-expired'
              }`}
            >
              {trendUp === true && '▲ '}
              {trendUp === false && '▼ '}
              {trend}
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
            <Icon size={20} className="text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/kpi-card.tsx
git commit -m "feat: redesign KPI card with icon, trend indicator"
```

---

### Task 3.6: Update FilterBar with responsive mobile collapse

**Files:**
- Modify: `apps/admin/src/components/filter-bar.tsx`

**Interfaces:**
- Produces: FilterBar that collapses to "Filters (N)" toggle on mobile

- [ ] **Step 1: Rewrite filter-bar.tsx with mobile collapse**

```tsx
'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  function activeCount(): number {
    if (typeof window === 'undefined') return 0;
    const form = document.querySelector(`form[action="${action}"]`);
    if (!form) return 0;
    const inputs = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type="submit"]):not([type="hidden"]), select',
    );
    let count = 0;
    inputs.forEach((el) => {
      if (el.value && el.value !== '') count++;
    });
    return count;
  }

  // Try reading active count from DOM on initial render
  const count = typeof window !== 'undefined' ? activeCount() : 0;
  const label = count > 0 ? `Filters (${count})` : 'Filters';

  return (
    <form method="get" action={action}>
      {/* Mobile toggle */}
      <div className="lg:hidden mb-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-mid hover:text-neutral-dark"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {label}
        </button>
      </div>

      {/* Filter controls — hidden on mobile when collapsed */}
      <div className={`flex flex-wrap items-end gap-3 ${!expanded ? 'hidden' : 'flex'} lg:flex`}>
        {children}
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </div>
    </form>
  );
}

export function SelectFilter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string | undefined;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-mid font-body">
      {label}
      <select
        name={name}
        defaultValue={value ?? ''}
        className="h-9 rounded-md border bg-background px-3 text-sm text-neutral-dark"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextFilter({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-mid font-body">
      {label}
      <input
        type="text"
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        className="h-9 rounded-md border bg-background px-3 text-sm text-neutral-dark placeholder:text-neutral-mid/60"
      />
    </label>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/filter-bar.tsx
git commit -m "feat: responsive filter bar with mobile collapse toggle"
```

---

### Task 3.7: Update LoadMore with softer styling

**Files:**
- Modify: `apps/admin/src/components/load-more.tsx`

- [ ] **Step 1: Replace the LoadMore return JSX**

Replace the return statement in `load-more.tsx` (lines 23-29):

```tsx
return (
  <div className="flex justify-center pt-4">
    <Button asChild variant="ghost" className="text-neutral-mid hover:text-primary">
      <Link href={`${basePath}?${sp.toString()}`}>Load more</Link>
    </Button>
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/components/load-more.tsx
git commit -m "feat: softer LoadMore button styling"
```

---

### Task 3.8: Style form inputs for new tokens

**Files:**
- Modify: `apps/admin/src/components/ui/input.tsx`
- Modify: `apps/admin/src/components/ui/label.tsx`

- [ ] **Step 1: Update input.tsx focus ring**

Replace the className in `apps/admin/src/components/ui/input.tsx`:

```tsx
className={cn(
  'flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm text-neutral-dark ring-offset-background placeholder:text-neutral-mid/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
  className,
)}
```

- [ ] **Step 2: Update label.tsx** (if it exists)

Read the file first. If it exists, update text styling to `text-[13px] font-medium text-neutral-dark`. If not, skip.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ui/input.tsx
# git add apps/admin/src/components/ui/label.tsx  # if modified
git commit -m "feat: update input styling for Expyrico tokens"
```

---

## Phase 4: Page Consistency Pass

Every page gets the same treatment:
1. `text-xl font-semibold` → `text-[28px] font-semibold font-display text-neutral-dark` for `<h1>`
2. `text-muted-foreground` → `text-neutral-mid` in descriptive `<p>` below titles
3. `space-y-6` kept (already correct)
4. No logic changes

### Task 4.1: Update Dashboard page

**Files:**
- Modify: `apps/admin/src/app/(admin)/page.tsx`

- [ ] **Step 1: Update with icons, trend placeholders, and welcome row**

```tsx
import { serverAdminApi } from '@/lib/admin-api';
import { KpiCard } from '@/components/kpi-card';
import { Users, Package, MessageSquare, Smartphone } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const o = await serverAdminApi.analytics.overview();
  return (
    <div className="space-y-6">
      {/* Welcome row */}
      <div>
        <h1 className="text-[28px] font-semibold text-neutral-dark font-display">Overview</h1>
        <p className="text-sm text-neutral-mid mt-1">Key metrics across the Expyrico platform.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total users" value={o.totalUsers.toLocaleString()} icon={Users} trend="All time" />
        <KpiCard label="Active (7d)" value={o.activeUsers7d.toLocaleString()} icon={Users} />
        <KpiCard label="Active (30d)" value={o.activeUsers30d.toLocaleString()} icon={Users} />
        <KpiCard label="Total records" value={o.totalRecords.toLocaleString()} icon={Package} />
        <KpiCard label="Total reviews" value={o.totalReviews.toLocaleString()} icon={MessageSquare} />
        <KpiCard label="Scans (7d)" value={o.scans7d.toLocaleString()} icon={Smartphone} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/page.tsx
git commit -m "feat: redesign dashboard with icons and welcome row"
```

---

### Task 4.2: Update Users pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/users/page.tsx`

- [ ] **Step 1: Update h1 and description**

In `users/page.tsx`:

```tsx
<h1 className="text-[28px] font-semibold text-neutral-dark font-display">Users</h1>
```

No description paragraph needed (filter bar serves as controls). Keep all logic exactly as-is.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/users/page.tsx
git commit -m "feat: update Users page typography"
```

---

### Task 4.3: Update User detail page

**Files:**
- Modify: `apps/admin/src/app/(admin)/users/[id]/page.tsx`

- [ ] **Step 1: Read and update h1**

Read the file and change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/users/\[id\]/page.tsx
git commit -m "feat: update User detail page typography"
```

---

### Task 4.4: Update Products pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/products/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/[id]/merge/page.tsx`
- Modify: `apps/admin/src/app/(admin)/products/pending/page.tsx`

- [ ] **Step 1: Update all products/* h1 tags**

Read each file and change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`. Keep all logic unchanged.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/products/page.tsx apps/admin/src/app/\(admin\)/products/\[id\]/page.tsx apps/admin/src/app/\(admin\)/products/\[id\]/merge/page.tsx apps/admin/src/app/\(admin\)/products/pending/page.tsx
git commit -m "feat: update Products pages typography"
```

---

### Task 4.5: Update Reviews pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/reviews/page.tsx`
- Modify: `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`

- [ ] **Step 1: Update h1 tags**

Read each file and change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/reviews/page.tsx apps/admin/src/app/\(admin\)/reviews/\[id\]/page.tsx
git commit -m "feat: update Reviews pages typography"
```

---

### Task 4.6: Update Reports pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/reports/page.tsx`
- Modify: `apps/admin/src/app/(admin)/reports/[id]/page.tsx`

- [ ] **Step 1: Update h1 tags**

Read each file, change `<h1>`, add description paragraph if missing.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/reports/page.tsx apps/admin/src/app/\(admin\)/reports/\[id\]/page.tsx
git commit -m "feat: update Reports pages typography"
```

---

### Task 4.7: Update Deals page

**Files:**
- Modify: `apps/admin/src/app/(admin)/deals/page.tsx`

- [ ] **Step 1: Update h1**

Change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/deals/page.tsx
git commit -m "feat: update Deals page typography"
```

---

### Task 4.8: Update Giveaways page

**Files:**
- Modify: `apps/admin/src/app/(admin)/giveaways/page.tsx`

- [ ] **Step 1: Update h1**

Change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/giveaways/page.tsx
git commit -m "feat: update Giveaways page typography"
```

---

### Task 4.9: Update Households pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/households/page.tsx`
- Modify: `apps/admin/src/app/(admin)/households/[id]/page.tsx`

- [ ] **Step 1: Update h1 tags**

Read each file, change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/households/page.tsx apps/admin/src/app/\(admin\)/households/\[id\]/page.tsx
git commit -m "feat: update Households pages typography"
```

---

### Task 4.10: Update Analytics pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/analytics/overview/page.tsx`
- Modify: `apps/admin/src/app/(admin)/analytics/scans/page.tsx`
- Modify: `apps/admin/src/app/(admin)/analytics/reviews/page.tsx`
- Modify: `apps/admin/src/app/(admin)/analytics/geography/page.tsx`

- [ ] **Step 1: Update all analytics h1 tags**

Read each file, change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/analytics/overview/page.tsx apps/admin/src/app/\(admin\)/analytics/scans/page.tsx apps/admin/src/app/\(admin\)/analytics/reviews/page.tsx apps/admin/src/app/\(admin\)/analytics/geography/page.tsx
git commit -m "feat: update Analytics pages typography"
```

---

### Task 4.11: Update System pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/system/queue/page.tsx`
- Modify: `apps/admin/src/app/(admin)/system/push/page.tsx`
- Modify: `apps/admin/src/app/(admin)/system/api-errors/page.tsx`
- Modify: `apps/admin/src/app/(admin)/system/external-apis/page.tsx`

- [ ] **Step 1: Update all system h1 tags**

Read each file, change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/system/queue/page.tsx apps/admin/src/app/\(admin\)/system/push/page.tsx apps/admin/src/app/\(admin\)/system/api-errors/page.tsx apps/admin/src/app/\(admin\)/system/external-apis/page.tsx
git commit -m "feat: update System pages typography"
```

---

### Task 4.12: Update Settings pages

**Files:**
- Modify: `apps/admin/src/app/(admin)/settings/admins/page.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/feature-flags/page.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/moderation/page.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/notification-templates/page.tsx`

- [ ] **Step 1: Update all settings h1 and description p tags**

Read each file, change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`. Change `<p className="text-sm text-muted-foreground">` to `<p className="text-sm text-neutral-mid">`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/settings/admins/page.tsx apps/admin/src/app/\(admin\)/settings/feature-flags/page.tsx apps/admin/src/app/\(admin\)/settings/moderation/page.tsx apps/admin/src/app/\(admin\)/settings/notification-templates/page.tsx
git commit -m "feat: update Settings pages typography"
```

---

### Task 4.13: Update Referrals page

**Files:**
- Modify: `apps/admin/src/app/(admin)/referrals/page.tsx`

- [ ] **Step 1: Update h1**

Change `<h1>` to `text-[28px] font-semibold text-neutral-dark font-display`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/referrals/page.tsx
git commit -m "feat: update Referrals page typography"
```

---

## Phase 5: Mobile Verification

### Task 5.1: Mobile verification pass — all pages at 375px

**Files:**
- No new changes unless issues found

- [ ] **Step 1: Build and visually notes**

Build the admin and note any pages that break at mobile widths:

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -5
```

- [ ] **Step 2: Verify key responsive patterns**

Check that these patterns are working:
- Sidebar hidden on mobile, triggered by hamburger
- Tables have horizontal scroll with `-mx-4 sm:mx-0`
- Filter bars collapse to toggle on mobile
- KPI grids stack single column on mobile
- Forms are single-column full-width

- [ ] **Step 3: Fix any mobile issues found**

Read affected files and apply fixes (typically adding `overflow-x-auto` wrappers or adjusting padding).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A apps/admin/src/
git commit -m "fix: mobile responsive fixes from verification pass"
```

---

## Phase 6: Final Verification

### Task 6.1: Full build + test suite

- [ ] **Step 1: Run full admin build**

```bash
cd apps/admin && npx next build --no-lint 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run unit tests**

```bash
cd apps/admin && npx vitest run 2>&1
```

Expected: All 17 tests pass.

- [ ] **Step 3: Verify no Pantry regression**

```bash
grep -rn "Pantry" apps/admin/src/app/layout.tsx apps/admin/src/app/login/page.tsx apps/admin/src/components/header.tsx
```

Expected: No matches (should all say "Expyrico").

- [ ] **Step 4: Verify cookie names untouched**

```bash
grep -rn "pantry_admin" apps/admin/src/lib/cookies.ts
```

Expected: Still shows `pantry_admin_access`, `pantry_admin_refresh`, `pantry_admin_csrf`.

- [ ] **Step 5: Commit final verification**

```bash
git add -A
git commit -m "chore: final verification pass — build, tests, rename checks"
```
