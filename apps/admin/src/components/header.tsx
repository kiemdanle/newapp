// apps/admin/src/components/header.tsx
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { LogoutButton } from '@/components/logout-button';

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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/90 backdrop-blur-md px-4 lg:px-7 shadow-xs">
      <div className="flex items-center gap-3.5">
        {/* Hamburger — visible only on mobile (<lg) */}
        <div className="lg:hidden">{menuTrigger}</div>

        {/* Brand logo + wordmark */}
        <Logo size={34} withWordmark suffix="Admin" />
      </div>

      {/* User & Logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 rounded-full border border-neutral-200/80 bg-neutral-light/40 py-1 pl-1.5 pr-3 shadow-xs">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-xs">
            {initials || 'A'}
          </div>
          <span className="hidden text-xs font-medium text-neutral-dark sm:inline max-w-[200px] truncate">
            {email}
          </span>
          <span className="hidden md:inline-flex items-center rounded-full bg-primary-light/50 px-2 py-0.5 text-[10px] font-semibold text-primary-dark">
            Admin
          </span>
        </div>
        <div className="h-4 w-px bg-neutral-200" />
        <LogoutButton />
      </div>
    </header>
  );
}
