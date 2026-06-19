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
