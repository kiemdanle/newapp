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

export function Sidebar({ pendingModerationCount = 0 }: { pendingModerationCount?: number }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card h-full overflow-y-auto">
      <nav className="flex flex-col gap-4 p-3.5 pt-5">
        {NAV.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-mid/80">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const active = isActive(item.href);
                const isPendingQueue = item.href === '/products/pending';

                return (
                  <Link
                    key={item.href}
                    href={item.href as never}
                    className={`group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? 'bg-primary-light/40 text-primary-dark font-semibold border border-primary/20 shadow-xs'
                        : 'text-neutral-dark/80 hover:bg-neutral-light/70 hover:text-neutral-dark'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {Icon && (
                        <Icon
                          size={18}
                          className={`shrink-0 transition-colors ${
                            active
                              ? 'text-primary'
                              : 'text-neutral-mid group-hover:text-neutral-dark'
                          }`}
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isPendingQueue && pendingModerationCount > 0 ? (
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-neutral-dark shadow-xs"
                        aria-label={`${pendingModerationCount} moderation items pending`}
                      >
                        {pendingModerationCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
