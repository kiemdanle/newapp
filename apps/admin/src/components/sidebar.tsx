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
