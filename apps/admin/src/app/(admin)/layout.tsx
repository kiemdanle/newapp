// apps/admin/src/app/(admin)/layout.tsx
import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { requireAdminSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireAdminSession();
  return (
    <div className="flex min-h-screen flex-col">
      <Header email={me.email} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
