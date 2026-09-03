// apps/admin/src/components/admin-shell.tsx
'use client';

import * as React from 'react';
import { SidebarProvider } from './sidebar-context';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { SidebarDrawer } from './sidebar-drawer';

export interface AdminShellProps {
  email: string;
  pendingModerationCount: number;
  pendingFeedbackCount?: number;
  children: React.ReactNode;
}

export function AdminShell({
  email,
  pendingModerationCount,
  pendingFeedbackCount = 0,
  children,
}: AdminShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header
          email={email}
          menuTrigger={
            <SidebarDrawer
              pendingModerationCount={pendingModerationCount}
              pendingFeedbackCount={pendingFeedbackCount}
            />
          }
        />
        <div className="flex flex-1">
          {/* Desktop sidebar — hidden on mobile */}
          <div className="hidden lg:block sticky top-16 h-[calc(100vh-4rem)]">
            <Sidebar
              pendingModerationCount={pendingModerationCount}
              pendingFeedbackCount={pendingFeedbackCount}
            />
          </div>
          {/* Main content */}
          <main className="flex-1 overflow-auto px-4 py-8 sm:px-6 lg:px-8 max-w-[1440px] mx-auto w-full transition-all">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
