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
