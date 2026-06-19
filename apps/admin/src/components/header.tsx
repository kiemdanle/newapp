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
