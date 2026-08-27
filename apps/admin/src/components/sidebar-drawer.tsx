// apps/admin/src/components/sidebar-drawer.tsx
'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { Logo } from '@/components/logo';

export function SidebarDrawer({ pendingModerationCount = 0 }: { pendingModerationCount?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-neutral-light/80 transition-colors text-neutral-dark focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        aria-label="Open navigation menu"
      >
        <Menu size={20} className="text-neutral-dark" />
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-card shadow-dropdown transform transition-transform duration-200 ease-in-out lg:hidden flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Logo size={30} withWordmark suffix="Admin" />
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center h-8 w-8 rounded-xl hover:bg-neutral-light text-neutral-mid hover:text-neutral-dark transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          <div onClick={() => setOpen(false)}>
            <Sidebar pendingModerationCount={pendingModerationCount} forceExpanded={true} />
          </div>
        </div>
      </div>
    </>
  );
}
