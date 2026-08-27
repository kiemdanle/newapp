// apps/admin/src/app/(admin)/layout.tsx
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/session';
import { serverAdminApi } from '@/lib/admin-api';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [me, moderationSummary] = await Promise.all([
    requireAdminSession(),
    serverAdminApi.system.moderationNotifications.summary(),
  ]);

  return (
    <AdminShell
      email={me.email}
      pendingModerationCount={moderationSummary.total}
    >
      {children}
    </AdminShell>
  );
}
