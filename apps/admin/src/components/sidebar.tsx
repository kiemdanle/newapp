// apps/admin/src/components/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { useSidebar } from '@/components/sidebar-context';
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
  HelpCircle,
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
  HelpCircle,
};

export function Sidebar({
  pendingModerationCount = 0,
  pendingFeedbackCount = 0,
  forceExpanded = false,
}: {
  pendingModerationCount?: number;
  pendingFeedbackCount?: number;
  forceExpanded?: boolean;
}) {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const collapsed = forceExpanded ? false : isCollapsed;

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={`shrink-0 border-r border-border bg-card h-full overflow-y-auto transition-[width] duration-300 ease-in-out select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <nav className={`flex flex-col gap-4 ${collapsed ? 'p-2.5 pt-5' : 'p-3.5 pt-5'}`}>
        {NAV.map((section, sIndex) => (
          <div key={section.title} className="space-y-1">
            {collapsed ? (
              sIndex > 0 ? (
                <div className="my-2.5 mx-auto w-8 border-t border-neutral-200/80" />
              ) : null
            ) : (
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-mid/80 truncate">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const active = isActive(item.href);
                const isPendingQueue = item.href === '/products/pending';
                const isFeedbackQueue = item.href === '/feedback';
                const badgeCount = isPendingQueue ? pendingModerationCount : (isFeedbackQueue ? pendingFeedbackCount : 0);
                return (
                  <Link
                    key={item.href}
                    href={item.href as never}
                    title={collapsed ? `${section.title}: ${item.label}` : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl transition-all ${
                      collapsed
                        ? 'justify-center px-2 py-2.5'
                        : 'justify-between px-3 py-2.5 text-sm font-medium'
                    } ${
                      active
                        ? 'bg-primary-light/40 text-primary-dark font-semibold border border-primary/20 shadow-xs'
                        : 'text-neutral-dark/80 hover:bg-neutral-light/70 hover:text-neutral-dark'
                    }`}
                  >
                    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'min-w-0'}`}>
                      {Icon && (
                        <div className="relative">
                          <Icon
                            size={19}
                            className={`shrink-0 transition-colors ${
                              active
                                ? 'text-primary'
                                : 'text-neutral-mid group-hover:text-neutral-dark'
                            }`}
                          />
                          {collapsed && badgeCount > 0 && (
                            <span
                              className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-neutral-dark shadow-xs animate-pulse"
                              aria-label={`${badgeCount} items pending`}
                            >
                              {badgeCount}
                            </span>
                          )}
                        </div>
                      )}
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed && badgeCount > 0 && (
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-neutral-dark shadow-xs"
                        aria-label={`${badgeCount} items pending`}
                      >
                        {badgeCount}
                      </span>
                    )}
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
